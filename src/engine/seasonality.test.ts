import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import {
  calendarMonth,
  computeSeasonalFit,
  computeTrend,
  normalizeSeasonIndex,
  resolveSeasonProfile,
  seasonallyAdjust,
} from './seasonality'
import { MONTHS_24, seasonalSeries } from './testFixtures'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const FLAT = Array(12).fill(1) as number[]

describe('sezon endeksi yardımcıları', () => {
  it('calendarMonth', () => {
    expect(calendarMonth('2025-09')).toBe(9)
    expect(calendarMonth('2026-01')).toBe(1)
    expect(() => calendarMonth('2026-13')).toThrow()
  })

  it('normalizeSeasonIndex ortalamayı 1,00 yapar', () => {
    const n = normalizeSeasonIndex([2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4])
    expect(n.reduce((a, b) => a + b, 0) / 12).toBeCloseTo(1, 12)
    expect(n[0]).toBeCloseTo(2 / 3, 12)
  })

  it('turizmde alt profil seçilir; tanımsız profil varsayılana düşer', () => {
    expect(resolveSeasonProfile(cfg, 'tourism', 'winter').profileId).toBe('winter')
    expect(resolveSeasonProfile(cfg, 'tourism').profileId).toBe('summer')
    expect(resolveSeasonProfile(cfg, 'stationery', 'winter').profileId).toBe('standard')
    const winter = resolveSeasonProfile(cfg, 'tourism', 'winter').index
    expect(winter[11]).toBeCloseTo(2.05, 12)
  })

  it('düzenlenmiş (ortalaması 1 olmayan) endeks motor tarafından normalize edilir', () => {
    const c = createDefaultModelConfig()
    c.sectors.pharmacy.seasonality.profiles.standard.index = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    expect(resolveSeasonProfile(c, 'pharmacy').index.every((v) => Math.abs(v - 1) < 1e-12)).toBe(true)
  })
})

describe('computeSeasonalFit — Sezon Uyumu (SU)', () => {
  const stationery = resolveSeasonProfile(cfg, 'stationery').index

  it('ciro sezon profiline birebir uyuyorsa SU = 100 (eylül piki cezalandırılmaz)', () => {
    const revenue = seasonalSeries(MONTHS_24, stationery, () => 400_000)
    const r = computeSeasonalFit(MONTHS_24, revenue, stationery, cfg)
    expect(r.months).toHaveLength(12)
    expect(r.annualRevenue).toBeCloseTo(4_800_000, 4)
    r.deviations.forEach((d) => expect(d).toBeCloseTo(0, 10))
    expect(r.score).toBeCloseTo(100, 10)
  })

  it('beklenen_m = (yıllık ciro / 12) × S_m', () => {
    const revenue = seasonalSeries(MONTHS_24, stationery, () => 400_000)
    const r = computeSeasonalFit(MONTHS_24, revenue, stationery, cfg)
    const sepIndex = r.months.indexOf('2025-09')
    expect(r.expected[sepIndex]).toBeCloseTo((4_800_000 / 12) * 2.0, 4)
  })

  it('ortalama |sapma| 0,25 ve tolerans 0,5 → SU = 50', () => {
    const revenue = MONTHS_24.map((_, t) => (t % 2 === 0 ? 125 : 75))
    const r = computeSeasonalFit(MONTHS_24, revenue, FLAT, cfg)
    expect(r.meanAbsDeviation).toBeCloseTo(0.25, 12)
    expect(r.score).toBeCloseTo(50, 10)
  })

  it('tolerans konfigürasyondan okunur', () => {
    const revenue = MONTHS_24.map((_, t) => (t % 2 === 0 ? 125 : 75))
    const c = createDefaultModelConfig()
    c.alternative.seasonalFit.tolerance = 1
    expect(computeSeasonalFit(MONTHS_24, revenue, FLAT, c).score).toBeCloseTo(75, 10)
    c.alternative.seasonalFit.tolerance = 0.25
    expect(computeSeasonalFit(MONTHS_24, revenue, FLAT, c).score).toBe(0)
  })

  it('pencere uzunluğu konfigürasyondan okunur', () => {
    const c = createDefaultModelConfig()
    c.alternative.seasonalFit.windowMonths = 6
    const revenue = seasonalSeries(MONTHS_24, stationery, () => 400_000)
    expect(computeSeasonalFit(MONTHS_24, revenue, stationery, c).months).toEqual(MONTHS_24.slice(18))
  })

  it('kış turizmi: yaz düşüşü kış profiliyle cezalandırılmaz, yaz profiliyle cezalandırılır', () => {
    const winter = resolveSeasonProfile(cfg, 'tourism', 'winter').index
    const summer = resolveSeasonProfile(cfg, 'tourism', 'summer').index
    const revenue = seasonalSeries(MONTHS_24, winter, () => 1_000_000)
    expect(computeSeasonalFit(MONTHS_24, revenue, winter, cfg).score).toBeCloseTo(100, 10)
    expect(computeSeasonalFit(MONTHS_24, revenue, summer, cfg).score).toBeLessThan(10)
  })
})

describe('computeTrend — Arındırılmış Trend (TR)', () => {
  it('SA_m = Gerçekleşen_m / S_m', () => {
    const idx = resolveSeasonProfile(cfg, 'stationery').index
    const revenue = seasonalSeries(MONTHS_24, idx, () => 300)
    seasonallyAdjust(MONTHS_24, revenue, idx).forEach((v) => expect(v).toBeCloseTo(300, 10))
  })

  it('sabit arındırılmış seri → büyüme %0 → TR = 50', () => {
    const idx = resolveSeasonProfile(cfg, 'stationery').index
    const r = computeTrend(MONTHS_24, seasonalSeries(MONTHS_24, idx, () => 500), idx, cfg)
    expect(r.annualGrowth).toBeCloseTo(0, 10)
    expect(r.score).toBeCloseTo(50, 10)
  })

  it('yıllık büyüme = eğim × 12 / ortalama SA; sezon deseni trendi bozmaz', () => {
    const idx = resolveSeasonProfile(cfg, 'stationery').index
    // Son 12 ayda SA = 1000 + 10t (t = 12…23) → eğim 10, ortalama 1175
    const revenue = seasonalSeries(MONTHS_24, idx, (t) => 1000 + 10 * t)
    const r = computeTrend(MONTHS_24, revenue, idx, cfg)
    const growth = (10 * 12) / 1175
    expect(r.slope).toBeCloseTo(10, 8)
    expect(r.annualGrowth).toBeCloseTo(growth, 10)
    expect(r.score).toBeCloseTo(50 + (growth / 0.2) * 50, 8)
    // Aynı trend düz endeksle aynı sonucu verir
    const flat = computeTrend(MONTHS_24, MONTHS_24.map((_, t) => 1000 + 10 * t), FLAT, cfg)
    expect(flat.annualGrowth).toBeCloseTo(growth, 10)
  })

  it('güçlü düşüş TR = 0, güçlü artış TR = 100 (kırpma)', () => {
    expect(computeTrend(MONTHS_24, MONTHS_24.map((_, t) => 2000 - 50 * t), FLAT, cfg).score).toBe(0)
    expect(computeTrend(MONTHS_24, MONTHS_24.map((_, t) => 1000 + 50 * t), FLAT, cfg).score).toBe(100)
  })

  it('pencere ve kırılımlar konfigürasyondan okunur', () => {
    const c = createDefaultModelConfig()
    c.alternative.trend.windowMonths = 24
    c.alternative.trend.breakpoints = [
      { value: -0.5, score: 0 },
      { value: 0.5, score: 100 },
    ]
    const revenue = MONTHS_24.map((_, t) => 1000 + 10 * t)
    const r = computeTrend(MONTHS_24, revenue, FLAT, c)
    expect(r.months).toHaveLength(24)
    const growth = (10 * 12) / 1115
    expect(r.annualGrowth).toBeCloseTo(growth, 10)
    expect(r.score).toBeCloseTo(50 + growth * 100, 8)
  })
})
