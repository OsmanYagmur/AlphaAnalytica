import { describe, expect, it } from 'vitest'
import { computeRatios, deriveFinancialStatement, type FinancialRatios } from './financials'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { SAMPLE_TRADITIONAL_INPUT } from './testFixtures'
import { computeTraditionalScore, scoreTraditionalRatios } from './traditionalScore'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

// Örnek mizanın elle hesaplanmış kategori puanları (kırtasiye, NDS medyanı 70 gün)
const EXPECTED = {
  liquidity: (83 + 52) / 2, // cari oran 1,575 → 83; asit-test 0,825 → 52
  leverage: (50 - ((5 / 2.3 - 2) / 2) * 50 + (100 - (0.3125 / 2) * 50)) / 2,
  profitability: (80 + (0.5 / 12 / 0.05) * 70 + (70 + ((0.5 / 7.3 - 0.05) / 0.05) * 30)) / 3,
  efficiency: 70 - ((73 + (1.2 / 8.4) * 365) / 70 - 1) * 70,
  debtService: 45, // 2,2857 → 45
  consistency: 100 - ((0.3 / 12.3 - 0.02) / 0.08) * 60,
}
const EXPECTED_G =
  0.2 * EXPECTED.liquidity +
  0.25 * EXPECTED.leverage +
  0.2 * EXPECTED.profitability +
  0.15 * EXPECTED.efficiency +
  0.1 * EXPECTED.debtService +
  0.1 * EXPECTED.consistency

describe('computeTraditionalScore — mizan + KVB → G', () => {
  const result = computeTraditionalScore(SAMPLE_TRADITIONAL_INPUT, 'stationery', cfg)

  it('6 kategori puanı elle hesaplananla aynı', () => {
    for (const [id, expected] of Object.entries(EXPECTED)) {
      expect(result.categories[id as keyof typeof EXPECTED].score).toBeCloseTo(expected, 8)
    }
  })

  it('G = Σ kategori puanı × ağırlık (≈ 61,76)', () => {
    expect(result.score).toBeCloseTo(EXPECTED_G, 8)
    expect(result.score).toBeCloseTo(61.7579, 3)
    const contributions = Object.values(result.categories).reduce((a, c) => a + c.contribution, 0)
    expect(contributions).toBeCloseTo(result.score, 10)
  })

  it('oran ayrıntıları: NDS gün olarak saklanır, medyana oranı normalizasyona girer', () => {
    const ccc = result.categories.efficiency.ratios.cashConversionCycle!
    expect(ccc.value).toBeCloseTo(result.ratios.cashConversionCycle, 10)
    expect(ccc.input).toBeCloseTo(result.ratios.cashConversionCycle / 70, 10)
    expect(result.categories.liquidity.ratios.currentRatio!.score).toBeCloseTo(83, 10)
  })

  it('KVB matrahı negatifse Beyan Tutarlılığı en fazla 50', () => {
    const negative = computeTraditionalScore(
      { ...SAMPLE_TRADITIONAL_INPUT, taxReturn: { ...SAMPLE_TRADITIONAL_INPUT.taxReturn, taxBase: -100_000 } },
      'stationery',
      cfg,
    )
    expect(negative.taxBaseNegative).toBe(true)
    expect(negative.categories.consistency.score).toBe(50)
    expect(negative.categories.consistency.capped).toBe(true)
    expect(negative.score).toBeCloseTo(EXPECTED_G - 0.1 * (EXPECTED.consistency - 50), 8)
  })

  it('sektör NDS medyanı faaliyet etkinliği puanını değiştirir', () => {
    // Oto galeri medyanı 55 gün → oran 2,27 → 0 puan
    const auto = computeTraditionalScore(SAMPLE_TRADITIONAL_INPUT, 'autoDealer', cfg)
    expect(auto.categories.efficiency.score).toBe(0)
    // Yapı malzemesi medyanı 90 gün → oran 1,39 → 70 − 0,39 × 70
    const building = computeTraditionalScore(SAMPLE_TRADITIONAL_INPUT, 'buildingMaterials', cfg)
    expect(building.categories.efficiency.score).toBeCloseTo(70 - (result.ratios.cashConversionCycle / 90 - 1) * 70, 8)
  })
})

describe('scoreTraditionalRatios — tüm parametreler konfigürasyondan', () => {
  const ratios = computeRatios(
    deriveFinancialStatement(SAMPLE_TRADITIONAL_INPUT.trialBalance, SAMPLE_TRADITIONAL_INPUT.supplement),
    SAMPLE_TRADITIONAL_INPUT.taxReturn,
    365,
  )
  const ctx = { cccMedianDays: 70, taxBaseNegative: false }

  it('kategori ağırlıkları değişince G değişir', () => {
    const c = createDefaultModelConfig()
    for (const cat of Object.values(c.traditional.categories)) cat.weight = 0
    c.traditional.categories.liquidity.weight = 1
    expect(scoreTraditionalRatios(ratios, ctx, c).score).toBeCloseTo(EXPECTED.liquidity, 10)
  })

  it('kategori içi oran ağırlıkları değişince kategori puanı değişir', () => {
    const c = createDefaultModelConfig()
    c.traditional.categories.liquidity.ratios.currentRatio.weight = 1
    c.traditional.categories.liquidity.ratios.acidTestRatio.weight = 0
    expect(scoreTraditionalRatios(ratios, ctx, c).categories.liquidity.score).toBeCloseTo(83, 10)
  })

  it('kırılım noktaları değişince oran puanı değişir', () => {
    const c = createDefaultModelConfig()
    c.traditional.categories.debtService.ratios.interestCoverage.breakpoints = [
      { value: 2, score: 0 },
      { value: 4, score: 100 },
    ]
    const ic = 1.6 / 0.7
    expect(scoreTraditionalRatios(ratios, ctx, c).categories.debtService.score).toBeCloseTo(((ic - 2) / 2) * 100, 10)
  })

  it('negatif matrah tavanı konfigürasyondan okunur', () => {
    const c = createDefaultModelConfig()
    c.traditional.negativeTaxBaseScoreCap = 30
    const r = scoreTraditionalRatios(ratios, { ...ctx, taxBaseNegative: true }, c)
    expect(r.categories.consistency.score).toBe(30)
  })

  it('tavanın altında kalan puan değişmez', () => {
    const weak: FinancialRatios = { ...ratios, salesDeviation: 0.15 } // → 20 puan
    const r = scoreTraditionalRatios(weak, { ...ctx, taxBaseNegative: true }, cfg)
    expect(r.categories.consistency.score).toBeCloseTo(20, 10)
    expect(r.categories.consistency.capped).toBe(false)
  })

  it('en iyi ve en kötü uç oranlar 100 ve 0 verir', () => {
    const best: FinancialRatios = {
      ...ratios,
      currentRatio: 3,
      acidTestRatio: 2,
      debtToEquity: 0.2,
      netDebtToEbitda: -1,
      ebitdaMargin: 0.3,
      netProfitMargin: 0.2,
      returnOnAssets: 0.2,
      cashConversionCycle: 10,
      interestCoverage: Infinity,
      salesDeviation: 0,
    }
    expect(scoreTraditionalRatios(best, ctx, cfg).score).toBeCloseTo(100, 10)
    const worst: FinancialRatios = {
      ...ratios,
      currentRatio: 0.5,
      acidTestRatio: 0.2,
      debtToEquity: Infinity,
      netDebtToEbitda: Infinity,
      ebitdaMargin: -0.1,
      netProfitMargin: -0.1,
      returnOnAssets: -0.1,
      cashConversionCycle: 300,
      interestCoverage: 0.5,
      salesDeviation: 0.5,
    }
    expect(scoreTraditionalRatios(worst, ctx, cfg).score).toBe(0)
  })
})
