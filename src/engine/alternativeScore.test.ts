import { describe, expect, it } from 'vitest'
import {
  computeAlternativeScore,
  computeIndicatorValue,
  computeSectorPerformance,
  resolveSourceSeries,
} from './alternativeScore'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { resolveSeasonProfile } from './seasonality'
import { MONTHS_24, seasonalSeries } from './testFixtures'
import type { AlternativeInput } from './types'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const constant = (v: number, n = 24) => Array(n).fill(v) as number[]

describe('computeIndicatorValue — ölçüm yöntemleri', () => {
  it('latest ve mean', () => {
    expect(computeIndicatorValue([1, 2, 3], MONTHS_24, { kind: 'latest' })).toBe(3)
    expect(computeIndicatorValue([1, 2, 3], MONTHS_24, { kind: 'mean', window: 2 })).toBe(2.5)
    expect(computeIndicatorValue([1, 2, 3], MONTHS_24, { kind: 'mean', window: 4 })).toBeNull()
    expect(computeIndicatorValue([], MONTHS_24, { kind: 'latest' })).toBeNull()
  })

  it('change: son pencere ortalamasının lag ay önceki pencereye göre göreli değişimi', () => {
    const values = [...constant(100, 12), ...constant(110, 12)]
    expect(computeIndicatorValue(values, MONTHS_24, { kind: 'change', window: 3, lag: 12 })).toBeCloseTo(0.1, 12)
    // Önceki dönem: son 3 ay vs ondan önceki 3 ay
    const steps = [10, 10, 10, 20, 20, 20]
    expect(computeIndicatorValue(steps, MONTHS_24, { kind: 'change', window: 3, lag: 3 })).toBeCloseTo(1, 12)
    expect(computeIndicatorValue(constant(1, 14), MONTHS_24, { kind: 'change', window: 3, lag: 12 })).toBeNull()
    expect(computeIndicatorValue([0, 0, 0, 5, 5, 5], MONTHS_24, { kind: 'change', window: 3, lag: 3 })).toBeNull()
  })

  it('projection: son pencereye doğrusal regresyon, horizon ay sonrası tahmin', () => {
    expect(computeIndicatorValue([1, 2, 3, 4, 5, 6], MONTHS_24, { kind: 'projection', window: 6, horizon: 3 })).toBeCloseTo(9, 10)
    // Düşen yorum puanı: 4,6 → 4,1 (aylık −0,1) → 3 ay sonra 3,8
    const falling = [4.6, 4.5, 4.4, 4.3, 4.2, 4.1]
    expect(computeIndicatorValue(falling, MONTHS_24, { kind: 'projection', window: 6, horizon: 3 })).toBeCloseTo(3.8, 10)
  })

  it('periodChange: seçili takvim aylarının son 12 ay toplamı / önceki 12 ay toplamı − 1', () => {
    // Şubat, Ağustos, Eylül: ilk yıl 100, ikinci yıl 130; diğer aylar 50
    const months = MONTHS_24
    const values = months.map((m, t) => {
      const cal = Number(m.slice(5, 7))
      if (![2, 8, 9].includes(cal)) return 50
      return t < 12 ? 100 : 130
    })
    expect(computeIndicatorValue(values, months, { kind: 'periodChange', calendarMonths: [2, 8, 9] })).toBeCloseTo(0.3, 12)
    expect(computeIndicatorValue(values.slice(1), months, { kind: 'periodChange', calendarMonths: [2] })).toBeNull()
  })

  it('tanımsız sonuç (∞ / NaN) eksik veri sayılır', () => {
    expect(computeIndicatorValue([1, 2, Infinity], MONTHS_24, { kind: 'latest' })).toBeNull()
  })
})

describe('resolveSourceSeries', () => {
  const input: AlternativeInput = {
    months: MONTHS_24.slice(0, 3),
    revenue: [100, 200, 400],
    series: { orders: [10, 20, 40], basket: [5, 5, 5], stock: [200, 200, 200] },
  }

  it('tek seri, çarpım, oran ve ciro serisi', () => {
    expect(resolveSourceSeries({ series: 'orders' }, input)).toEqual([10, 20, 40])
    expect(resolveSourceSeries({ product: ['orders', 'basket'] }, input)).toEqual([50, 100, 200])
    expect(resolveSourceSeries({ ratio: ['stock', 'revenue'] }, input)).toEqual([2, 1, 0.5])
    expect(resolveSourceSeries({ series: 'revenue' }, input)).toEqual([100, 200, 400])
  })

  it('eksik seri null döner', () => {
    expect(resolveSourceSeries({ series: 'missing' }, input)).toBeNull()
    expect(resolveSourceSeries({ product: ['orders', 'missing'] }, input)).toBeNull()
  })
})

// Kırtasiye: son 12 ay ciro ve POS geçen yılın %120'si, sezon profiline birebir uyumlu
const stationeryIndex = resolveSeasonProfile(cfg, 'stationery').index
const level = (t: number) => (t < 12 ? 500_000 : 600_000)
const revenue = seasonalSeries(MONTHS_24, stationeryIndex, level)
const stationeryInput: AlternativeInput = {
  months: MONTHS_24,
  revenue,
  series: {
    posRevenue: revenue.map((v) => v * 0.6),
    posTransactions: [...constant(1_000, 12), ...constant(1_100, 12)],
    inventoryTurnover: constant(5),
    supplierOnTimePaymentRate: constant(0.92),
  },
}
// Elle hesaplanan gösterge puanları
const IND = {
  posRevenue: 85, // +%20 → 85
  posTransactions: 55 + (0.1 / 0.15) * 35, // +%10
  schoolSeason: 85, // sezon ayları +%20
  inventoryTurnover: 65, // 5 kez → 65
  supplierPayment: 50 + (0.07 / 0.1) * 35, // %92 → 74,5
}
const SP_FULL =
  0.2 * IND.posRevenue +
  0.15 * IND.posTransactions +
  0.25 * IND.schoolSeason +
  0.15 * IND.inventoryTurnover +
  0.25 * IND.supplierPayment

describe('computeAlternativeScore — kırtasiye örneği', () => {
  const r = computeAlternativeScore(stationeryInput, 'stationery', cfg)

  it('gösterge puanları elle hesaplananla aynı', () => {
    for (const [id, score] of Object.entries(IND)) {
      expect(r.indicators[id].score).toBeCloseTo(score, 8)
      expect(r.indicators[id].available).toBe(true)
    }
  })

  it('SP = ağırlıklı ortalama; SU = 100 (sezona uyumlu); TR = 50 (arındırılmış seri düz)', () => {
    expect(r.sp).toBeCloseTo(SP_FULL, 8)
    expect(r.su).toBeCloseTo(100, 8)
    expect(r.tr).toBeCloseTo(50, 8)
  })

  it('A_ham = 0,55 × SP + 0,25 × SU + 0,20 × TR; tam kapsama → A = A_ham', () => {
    expect(r.raw).toBeCloseTo(0.55 * SP_FULL + 0.25 * 100 + 0.2 * 50, 8)
    expect(r.coverage).toBe(1)
    expect(r.score).toBeCloseTo(r.raw, 12)
  })
})

describe('veri kapsama düzeltmesi', () => {
  const partial: AlternativeInput = {
    ...stationeryInput,
    series: { ...stationeryInput.series, supplierOnTimePaymentRate: undefined },
  }

  it('eksik gösterge: SP mevcutlar üzerinden yeniden ağırlıklanır, A nötre çekilir', () => {
    const r = computeAlternativeScore(partial, 'stationery', cfg)
    const sp = (SP_FULL - 0.25 * IND.supplierPayment) / 0.75
    const raw = 0.55 * sp + 0.25 * 100 + 0.2 * 50
    expect(r.indicators.supplierPayment.available).toBe(false)
    expect(r.coverage).toBeCloseTo(4 / 5, 12)
    expect(r.sp).toBeCloseTo(sp, 8)
    expect(r.raw).toBeCloseTo(raw, 8)
    expect(r.score).toBeCloseTo(0.8 * raw + 0.2 * 50, 8)
  })

  it('tek seri birden fazla göstergeyi besleyebilir (POS ciro yoksa 2 gösterge eksik)', () => {
    const noPos: AlternativeInput = { ...stationeryInput, series: { ...stationeryInput.series, posRevenue: undefined } }
    const r = computeAlternativeScore(noPos, 'stationery', cfg)
    expect(r.availableCount).toBe(3)
    expect(r.coverage).toBeCloseTo(3 / 5, 12)
  })

  it('düzeltme kapalıysa A = A_ham; nötr değer konfigürasyondan okunur', () => {
    const c = createDefaultModelConfig()
    c.alternative.coverage.enabled = false
    const off = computeAlternativeScore(partial, 'stationery', c)
    expect(off.score).toBeCloseTo(off.raw, 12)

    const c2 = createDefaultModelConfig()
    c2.alternative.coverage.neutralScore = 40
    const on = computeAlternativeScore(partial, 'stationery', c2)
    expect(on.score).toBeCloseTo(0.8 * on.raw + 0.2 * 40, 8)
  })

  it('hiç gösterge yoksa c = 0 ve A = nötr değer', () => {
    const r = computeAlternativeScore({ ...stationeryInput, series: {} }, 'stationery', cfg)
    expect(r.coverage).toBe(0)
    expect(r.score).toBe(50)
  })
})

describe('parametreler konfigürasyondan', () => {
  it('SP / SU / TR ağırlıkları', () => {
    const c = createDefaultModelConfig()
    c.alternative.weights = { sp: 1, su: 0, tr: 0 }
    expect(computeAlternativeScore(stationeryInput, 'stationery', c).raw).toBeCloseTo(SP_FULL, 8)
  })

  it('gösterge ağırlıkları ve kırılımları', () => {
    const c = createDefaultModelConfig()
    const inds = c.sectors.stationery.indicators
    for (const ind of Object.values(inds)) ind.weight = 0
    inds.inventoryTurnover.weight = 1
    inds.inventoryTurnover.breakpoints = [
      { value: 0, score: 0 },
      { value: 10, score: 100 },
    ]
    expect(computeSectorPerformance(stationeryInput, 'stationery', c).sp).toBeCloseTo(50, 10)
  })

  it('gösterge ölçüm penceresi', () => {
    const c = createDefaultModelConfig()
    c.sectors.stationery.indicators.supplierPayment.measure = { kind: 'latest' }
    const input: AlternativeInput = {
      ...stationeryInput,
      series: { ...stationeryInput.series, supplierOnTimePaymentRate: [...constant(0.8, 23), 0.95] },
    }
    expect(computeSectorPerformance(input, 'stationery', c).indicators.supplierPayment.score).toBeCloseTo(85, 10)
  })
})

describe('turizm alt profilleri', () => {
  const winter = resolveSeasonProfile(cfg, 'tourism', 'winter').index
  const input: AlternativeInput = {
    months: MONTHS_24,
    revenue: seasonalSeries(MONTHS_24, winter, () => 800_000),
    series: {},
    seasonProfile: 'winter',
  }

  it('kış acentesinin düşük yaz cirosu kış profiliyle cezalandırılmaz', () => {
    const r = computeAlternativeScore(input, 'tourism', cfg)
    expect(r.seasonProfile.id).toBe('winter')
    expect(r.su).toBeCloseTo(100, 8)
    const wrongProfile = computeAlternativeScore({ ...input, seasonProfile: 'summer' }, 'tourism', cfg)
    expect(wrongProfile.su).toBeLessThan(10)
    expect(wrongProfile.raw).toBeLessThan(r.raw)
  })
})
