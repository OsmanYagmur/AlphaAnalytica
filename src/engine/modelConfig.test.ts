import { describe, expect, it } from 'vitest'
import {
  CREDIT_GRADES,
  DEFAULT_MODEL_CONFIG,
  LENDABLE_GRADES,
  PRODUCT_IDS,
  SECTOR_IDS,
  TRADITIONAL_CATEGORY_IDS,
  createDefaultModelConfig,
  type AlternativeIndicatorConfig,
  type BreakpointCurve,
  type ProductMix,
  type RatioConfig,
  type SeasonProfile,
} from './modelConfig'

const cfg = DEFAULT_MODEL_CONFIG
const EPS = 1e-9

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const indicatorsOf = (id: (typeof SECTOR_IDS)[number]) =>
  Object.values(cfg.sectors[id].indicators) as AlternativeIndicatorConfig[]
const profilesOf = (id: (typeof SECTOR_IDS)[number]) =>
  Object.values(cfg.sectors[id].seasonality.profiles) as SeasonProfile[]
const mixSum = (mix: ProductMix) => sum(PRODUCT_IDS.map((p) => mix[p]))

function expectValidCurve(curve: BreakpointCurve) {
  expect(curve.length).toBeGreaterThanOrEqual(2)
  for (let i = 1; i < curve.length; i++) {
    expect(curve[i].value).toBeGreaterThan(curve[i - 1].value)
  }
  for (const { score } of curve) {
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  }
}

describe('Model v1.0 — ağırlık grupları', () => {
  it('nihai skor ağırlıkları %50 / %50', () => {
    expect(cfg.final.weights).toEqual({ traditional: 0.5, alternative: 0.5 })
  })

  it('geleneksel kategori ağırlıkları şartnamedeki gibi ve toplamı 1', () => {
    const w = Object.fromEntries(TRADITIONAL_CATEGORY_IDS.map((c) => [c, cfg.traditional.categories[c].weight]))
    expect(w).toEqual({
      liquidity: 0.2,
      leverage: 0.25,
      profitability: 0.2,
      efficiency: 0.15,
      debtService: 0.1,
      consistency: 0.1,
    })
    expect(Math.abs(sum(Object.values(w)) - 1)).toBeLessThan(EPS)
  })

  it('her kategorideki oran ağırlıklarının toplamı 1 ve kırılımlar geçerli', () => {
    for (const c of TRADITIONAL_CATEGORY_IDS) {
      const ratios = Object.values(cfg.traditional.categories[c].ratios) as RatioConfig[]
      expect(Math.abs(sum(ratios.map((r) => r.weight)) - 1)).toBeLessThan(EPS)
      ratios.forEach((r) => expectValidCurve(r.breakpoints))
    }
  })

  it('SP / SU / TR = 0,55 / 0,25 / 0,20', () => {
    expect(cfg.alternative.weights).toEqual({ sp: 0.55, su: 0.25, tr: 0.2 })
  })
})

describe('Model v1.0 — geleneksel kırılımlar şartnameyle aynı', () => {
  const r = cfg.traditional.categories
  const pairs = (c: BreakpointCurve) => c.map((b) => [b.value, b.score])

  it('likidite, kaldıraç, kârlılık, borç ödeme, beyan tutarlılığı', () => {
    expect(pairs(r.liquidity.ratios.currentRatio.breakpoints)).toEqual([[0.8, 0], [1, 40], [1.5, 80], [2, 100]])
    expect(pairs(r.liquidity.ratios.acidTestRatio.breakpoints)).toEqual([[0.5, 0], [1, 80], [1.3, 100]])
    expect(pairs(r.leverage.ratios.debtToEquity.breakpoints)).toEqual([[0.5, 100], [1, 80], [2, 50], [4, 0]])
    expect(pairs(r.leverage.ratios.netDebtToEbitda.breakpoints)).toEqual([[1, 100], [3, 50], [5, 0]])
    expect(pairs(r.profitability.ratios.ebitdaMargin.breakpoints)).toEqual([[0, 0], [0.1, 70], [0.2, 100]])
    expect(pairs(r.profitability.ratios.netProfitMargin.breakpoints)).toEqual([[0, 0], [0.05, 70], [0.12, 100]])
    expect(pairs(r.profitability.ratios.returnOnAssets.breakpoints)).toEqual([[0, 0], [0.05, 70], [0.1, 100]])
    expect(pairs(r.efficiency.ratios.cashConversionCycle.breakpoints)).toEqual([[0.5, 100], [1, 70], [2, 0]])
    expect(pairs(r.debtService.ratios.interestCoverage.breakpoints)).toEqual([[1, 0], [3, 70], [5, 100]])
    expect(pairs(r.consistency.ratios.salesDeviation.breakpoints)).toEqual([[0.02, 100], [0.1, 40], [0.2, 0]])
    expect(cfg.traditional.negativeTaxBaseScoreCap).toBe(50)
  })

  it('TR kırılımları ve SU toleransı', () => {
    expect(pairs(cfg.alternative.trend.breakpoints)).toEqual([[-0.2, 0], [0, 50], [0.2, 100]])
    expect(cfg.alternative.seasonalFit.tolerance).toBe(0.5)
    expect(cfg.alternative.coverage).toEqual({ enabled: true, neutralScore: 50 })
  })
})

describe('Model v1.0 — sektörler', () => {
  it('10 sektör tanımlı', () => {
    expect(Object.keys(cfg.sectors).sort()).toEqual([...SECTOR_IDS].sort())
    expect(SECTOR_IDS).toHaveLength(10)
  })

  it('SRK değerleri şartnamedeki gibi', () => {
    const srk = Object.fromEntries(SECTOR_IDS.map((s) => [s, cfg.sectors[s].riskCoefficient]))
    expect(srk).toEqual({
      ecommerce: 0.95,
      autoDealer: 0.9,
      stationery: 1.0,
      tourism: 0.85,
      restaurant: 0.9,
      buildingMaterials: 0.9,
      textileExport: 0.95,
      agriFood: 0.9,
      logistics: 1.0,
      pharmacy: 1.05,
    })
  })

  it.each(SECTOR_IDS)('%s: 4–6 gösterge, ağırlık toplamı 1, geçerli kırılımlar', (id) => {
    const indicators = indicatorsOf(id)
    expect(indicators.length).toBeGreaterThanOrEqual(4)
    expect(indicators.length).toBeLessThanOrEqual(6)
    expect(Math.abs(sum(indicators.map((i) => i.weight)) - 1)).toBeLessThan(EPS)
    for (const ind of indicators) {
      expect(ind.weight).toBeGreaterThan(0)
      expectValidCurve(ind.breakpoints)
      if (ind.measure.kind === 'periodChange') {
        for (const m of ind.measure.calendarMonths) expect(m >= 1 && m <= 12).toBe(true)
      }
    }
  })

  it.each(SECTOR_IDS)('%s: sezon endeksleri 12 ay, pozitif, ortalaması 1,00', (id) => {
    const { seasonality } = cfg.sectors[id]
    expect(Object.keys(seasonality.profiles)).toContain(seasonality.defaultProfile)
    for (const profile of profilesOf(id)) {
      expect(profile.index).toHaveLength(12)
      profile.index.forEach((v) => expect(v).toBeGreaterThan(0))
      expect(Math.abs(sum(profile.index) / 12 - 1)).toBeLessThan(1e-9)
    }
  })

  it('turizmde yaz ve kış alt profilleri ayrı; yaz Haz–Eyl, kış Ara–Mar pik', () => {
    const { summer, winter } = cfg.sectors.tourism.seasonality.profiles
    const peak = (idx: number[], months: number[]) => Math.min(...months.map((m) => idx[m - 1]))
    const offPeak = (idx: number[], months: number[]) =>
      Math.max(...idx.filter((_, i) => !months.includes(i + 1)))
    expect(peak(summer.index, [6, 7, 8, 9])).toBeGreaterThan(offPeak(summer.index, [6, 7, 8, 9]))
    expect(peak(winter.index, [12, 1, 2, 3])).toBeGreaterThan(offPeak(winter.index, [12, 1, 2, 3]))
  })

  it('kırtasiyede eylül ana pik, şubat ikinci pik', () => {
    const idx = cfg.sectors.stationery.seasonality.profiles.standard.index
    expect(Math.max(...idx)).toBe(idx[8])
    const others = idx.filter((_, i) => i !== 7 && i !== 8)
    expect(Math.max(...others)).toBe(idx[1])
  })

  it.each(SECTOR_IDS)('%s: NDS medyanı pozitif, ürün kırılımı toplamı 1', (id) => {
    expect(cfg.sectors[id].cccMedianDays).toBeGreaterThan(0)
    expect(Math.abs(mixSum(cfg.sectors[id].productMix) - 1)).toBeLessThan(EPS)
  })

  it('ürün kırılımı: varsayılan 50/30/20; turizm spot, oto galeri stok finansmanı ağırlıklı', () => {
    expect(cfg.terms.defaultProductMix).toEqual({ revolving: 0.5, spot: 0.3, nonCash: 0.2, inventoryFinance: 0 })
    const tourism = cfg.sectors.tourism.productMix
    expect(tourism.spot).toBe(Math.max(...PRODUCT_IDS.map((p) => tourism[p])))
    const auto = cfg.sectors.autoDealer.productMix
    expect(auto.inventoryFinance).toBe(Math.max(...PRODUCT_IDS.map((p) => auto[p])))
  })
})

describe('Model v1.0 — not, limit, teminat', () => {
  it('not eşikleri kesin azalan: 90/80/70/60/50/40', () => {
    const t = LENDABLE_GRADES.map((g) => cfg.rating.minScore[g])
    expect(t).toEqual([90, 80, 70, 60, 50, 40])
    expect(cfg.rating.pd).toEqual({ center: 30, scale: 9 })
  })

  it('limit parametreleri', () => {
    expect(cfg.limit.k1).toEqual({ multiplier: 1.2, minDays: 30 })
    expect(cfg.limit.k2).toEqual({ equityMultiplier: 1.5 })
    expect(cfg.limit.k3).toEqual({ ebitdaRatio: 0.6, multiplier: 2 })
    expect(cfg.limit.roundingUnit).toBe(50_000)
    expect(CREDIT_GRADES.map((g) => cfg.limit.gradeMultiplier[g])).toEqual([1, 0.9, 0.8, 0.65, 0.5, 0.3, 0])
  })

  it('teminat oranları, ipotek, LTV, vade ve spread', () => {
    expect(LENDABLE_GRADES.map((g) => cfg.terms.collateralRatio[g])).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25])
    expect(cfg.terms.mortgageRequiredFrom).toBe('BBB')
    expect(cfg.terms.appraisalLtv).toBe(0.7)
    expect(LENDABLE_GRADES.map((g) => cfg.terms.tenor[g].months)).toEqual([24, 24, 24, 12, 6, 6])
    const spreads = LENDABLE_GRADES.map((g) => cfg.terms.pricing.spreadBp[g])
    expect(spreads[0]).toBe(150)
    expect(spreads[spreads.length - 1]).toBe(650)
    for (let i = 1; i < spreads.length; i++) expect(spreads[i] - spreads[i - 1]).toBe(100)
  })

  it('kritik erken uyarılar notu en fazla BB ile sınırlar', () => {
    const { critical } = cfg.earlyWarning
    expect(critical.declarationInconsistency.threshold).toBe(0.2)
    for (const rule of Object.values(critical)) {
      expect(rule.enabled).toBe(true)
      expect(rule.gradeCap).toBe('BB')
    }
  })
})

describe('createDefaultModelConfig', () => {
  it('varsayılanın bağımsız ve düzenlenebilir kopyasını döner', () => {
    const copy = createDefaultModelConfig()
    expect(copy).toEqual(cfg)
    copy.final.weights.alternative = 0.3
    copy.sectors.stationery.seasonality.profiles.standard.index[8] = 3
    expect(cfg.final.weights.alternative).toBe(0.5)
    expect(cfg.sectors.stationery.seasonality.profiles.standard.index[8]).toBe(2)
  })

  it('varsayılan nesne dondurulmuştur', () => {
    expect(Object.isFrozen(cfg)).toBe(true)
    expect(Object.isFrozen(cfg.sectors.tourism.seasonality.profiles.winter.index)).toBe(true)
  })
})
