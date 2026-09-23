import { describe, expect, it } from 'vitest'
import {
  computeCollateral,
  computeCreditTerms,
  computePricing,
  computeProductBreakdown,
  computeTenor,
} from './collateral'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

describe('computeCollateral — teminat oranı, ipotek, ekspertiz', () => {
  it('AAA: %0 teminat, müşterek kefalet, ipotek yok', () => {
    expect(computeCollateral(2_000_000, 'AAA', cfg)).toEqual({
      ratio: 0,
      type: 'jointSurety',
      typeLabel: 'Müşterek kefalet',
      amount: 0,
      mortgageRequired: false,
      mortgageAmount: 0,
      requiredAppraisalValue: 0,
    })
  })

  it('AA %25 ve A %50: teminat var, ipotek zorunlu değil', () => {
    const aa = computeCollateral(2_000_000, 'AA', cfg)
    expect(aa.amount).toBe(500_000)
    expect(aa.mortgageRequired).toBe(false)
    const a = computeCollateral(2_000_000, 'A', cfg)
    expect(a.amount).toBe(1_000_000)
    expect(a.mortgageAmount).toBe(0)
  })

  it('BBB ve altı ipotek zorunlu: İpotek = Limit × Oran; Ekspertiz = İpotek / 0,70', () => {
    const bbb = computeCollateral(850_000, 'BBB', cfg)
    expect(bbb.mortgageRequired).toBe(true)
    expect(bbb.type).toBe('mortgage')
    expect(bbb.mortgageAmount).toBeCloseTo(637_500, 6)
    expect(bbb.requiredAppraisalValue).toBeCloseTo(637_500 / 0.7, 6)

    expect(computeCollateral(1_000_000, 'BB', cfg).mortgageAmount).toBe(1_000_000)
    const b = computeCollateral(400_000, 'B', cfg)
    expect(b.mortgageAmount).toBe(500_000)
    expect(b.requiredAppraisalValue).toBeCloseTo(500_000 / 0.7, 6)
  })

  it('ipotek başlangıç notu, oranlar ve LTV konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.terms.mortgageRequiredFrom = 'A'
    c.terms.collateralRatio.A = 0.6
    c.terms.appraisalLtv = 0.5
    const a = computeCollateral(1_000_000, 'A', c)
    expect(a.mortgageRequired).toBe(true)
    expect(a.mortgageAmount).toBeCloseTo(600_000, 6)
    expect(a.requiredAppraisalValue).toBeCloseTo(1_200_000, 6)
  })
})

describe('vade ve fiyatlama', () => {
  it('vade: AAA–A 24 ay rotatif, BBB 12 ay, BB–B 6 ay', () => {
    expect(computeTenor('AAA', cfg)).toEqual({ months: 24, revolving: true })
    expect(computeTenor('A', cfg)).toEqual({ months: 24, revolving: true })
    expect(computeTenor('BBB', cfg)).toEqual({ months: 12, revolving: false })
    expect(computeTenor('BB', cfg)).toEqual({ months: 6, revolving: false })
    expect(computeTenor('B', cfg)).toEqual({ months: 6, revolving: false })
  })

  it('fiyatlama: TLREF + not bazlı spread', () => {
    expect(computePricing('AAA', cfg)).toEqual({ referenceRate: 'TLREF', spreadBp: 150 })
    expect(computePricing('BBB', cfg)).toEqual({ referenceRate: 'TLREF', spreadBp: 450 })
    expect(computePricing('B', cfg)).toEqual({ referenceRate: 'TLREF', spreadBp: 650 })
  })

  it('vade ve spread konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.terms.tenor.BBB = { months: 18, revolving: true }
    c.terms.pricing.spreadBp.BBB = 500
    expect(computeTenor('BBB', c)).toEqual({ months: 18, revolving: true })
    expect(computePricing('BBB', c).spreadBp).toBe(500)
  })
})

describe('computeProductBreakdown — sektörel ürün kırılımı', () => {
  it('kırtasiye 40/40/20; payı sıfır olan ürün listelenmez; toplam = limit', () => {
    const p = computeProductBreakdown(850_000, 'stationery', cfg)
    expect(p.map((x) => [x.product, x.amount])).toEqual([
      ['revolving', 340_000],
      ['spot', 340_000],
      ['nonCash', 170_000],
    ])
    expect(p.reduce((a, x) => a + x.amount, 0)).toBe(850_000)
  })

  it('oto galeride stok finansmanı, turizmde spot ağırlıklı', () => {
    const auto = computeProductBreakdown(1_000_000, 'autoDealer', cfg)
    expect(auto.find((x) => x.product === 'inventoryFinance')?.amount).toBe(600_000)
    const tourism = computeProductBreakdown(1_000_000, 'tourism', cfg)
    expect(tourism.find((x) => x.product === 'spot')?.amount).toBe(500_000)
  })

  it('kırılım konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.sectors.pharmacy.productMix = { revolving: 1, spot: 0, nonCash: 0, inventoryFinance: 0 }
    expect(computeProductBreakdown(700_000, 'pharmacy', c)).toEqual([
      { product: 'revolving', label: 'Rotatif kredi', share: 1, amount: 700_000 },
    ])
  })
})

describe('computeCreditTerms', () => {
  it('tüm şartları birlikte üretir', () => {
    const t = computeCreditTerms(850_000, 'BBB', 'stationery', cfg)!
    expect(t.grade).toBe('BBB')
    expect(t.limit).toBe(850_000)
    expect(t.collateral.mortgageAmount).toBeCloseTo(637_500, 6)
    expect(t.tenor.months).toBe(12)
    expect(t.pricing.spreadBp).toBe(450)
    expect(t.products).toHaveLength(3)
  })

  it('C notunda şart üretilmez', () => {
    expect(computeCreditTerms(0, 'C', 'stationery', cfg)).toBeNull()
  })
})
