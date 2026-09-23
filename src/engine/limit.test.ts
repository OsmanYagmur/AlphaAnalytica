import { describe, expect, it } from 'vitest'
import { computeCapacity, computeLimit, type LimitInput } from './limit'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

// Örnek mizandaki firma: net satış 12 M, NDS ≈ 125,14 gün, özkaynak 2,3 M, FAVÖK 1,6 M
const CCC = 73 + (1.2 / 8.4) * 365
const base: LimitInput = {
  netSales: 12_000_000,
  cashConversionCycle: CCC,
  equity: 2_300_000,
  ebitda: 1_600_000,
  annualDebtService: 300_000,
}

describe('computeCapacity — K1, K2, K3', () => {
  const c = computeCapacity(base, cfg)

  it('K1 = Net Satış × max(NDS; 30) / 365 × 1,2', () => {
    expect(c.k1).toBeCloseTo((12_000_000 * CCC) / 365 * 1.2, 4)
  })

  it('K2 = Özkaynak × 1,5', () => {
    expect(c.k2).toBe(3_450_000)
  })

  it('K3 = max(0; FAVÖK × 0,6 − Mevcut Yıllık Kredi Ödemeleri) × 2', () => {
    expect(c.k3).toBeCloseTo(1_320_000, 6)
  })

  it('Kapasite = min(K1; K2; K3) ve belirleyici bileşen', () => {
    expect(c.capacity).toBeCloseTo(1_320_000, 6)
    expect(c.binding).toBe('k3')
  })

  it('NDS 30 günün altındaysa minimum gün kullanılır', () => {
    const short = computeCapacity({ ...base, cashConversionCycle: 10 }, cfg)
    expect(short.k1).toBeCloseTo((12_000_000 * 30) / 365 * 1.2, 4)
    expect(short.binding).toBe('k1')
    const negative = computeCapacity({ ...base, cashConversionCycle: -20 }, cfg)
    expect(negative.k1).toBeCloseTo(short.k1, 6)
  })

  it('FAVÖK kredi ödemelerini karşılamıyorsa K3 = 0', () => {
    expect(computeCapacity({ ...base, annualDebtService: 1_000_000 }, cfg).k3).toBe(0)
  })

  it('K parametreleri konfigürasyondan', () => {
    const m = createDefaultModelConfig()
    m.limit.k1 = { multiplier: 1, minDays: 200 }
    m.limit.k2 = { equityMultiplier: 1 }
    m.limit.k3 = { ebitdaRatio: 0.5, multiplier: 3 }
    m.daysInYear = 360
    const r = computeCapacity(base, m)
    expect(r.k1).toBeCloseTo((12_000_000 * 200) / 360, 4)
    expect(r.k2).toBe(2_300_000)
    expect(r.k3).toBeCloseTo((800_000 - 300_000) * 3, 6)
  })
})

describe('computeLimit — Kapasite × f × SRK, 50.000 TL aşağı yuvarlama', () => {
  it('BBB kırtasiye: 1.320.000 × 0,65 × 1,00 = 858.000 → 850.000', () => {
    const r = computeLimit(base, 'BBB', 'stationery', cfg)
    expect(r.gradeMultiplier).toBe(0.65)
    expect(r.sectorRiskCoefficient).toBe(1)
    expect(r.unrounded).toBeCloseTo(858_000, 6)
    expect(r.limit).toBe(850_000)
  })

  it('not çarpanları: AAA 1,00 … B 0,30, C 0', () => {
    expect(computeLimit(base, 'AAA', 'stationery', cfg).limit).toBe(1_300_000)
    expect(computeLimit(base, 'A', 'stationery', cfg).limit).toBe(1_050_000)
    expect(computeLimit(base, 'B', 'stationery', cfg).limit).toBe(350_000)
    expect(computeLimit(base, 'C', 'stationery', cfg).limit).toBe(0)
  })

  it('SRK sektöre göre uygulanır (turizm 0,85)', () => {
    const r = computeLimit(base, 'AAA', 'tourism', cfg)
    expect(r.unrounded).toBeCloseTo(1_320_000 * 0.85, 6)
    expect(r.limit).toBe(1_100_000)
  })

  it('tam katları yuvarlamada kaybetmez', () => {
    const exact = computeLimit({ ...base, equity: 1_000_000 / 1.5, annualDebtService: 0 }, 'AAA', 'stationery', cfg)
    expect(exact.binding).toBe('k2')
    expect(exact.limit).toBe(1_000_000)
  })

  it('negatif özkaynakta limit 0', () => {
    expect(computeLimit({ ...base, equity: -500_000 }, 'BB', 'stationery', cfg).limit).toBe(0)
  })

  it('not çarpanı, SRK ve yuvarlama birimi konfigürasyondan', () => {
    const m = createDefaultModelConfig()
    m.limit.gradeMultiplier.BBB = 0.7
    m.limit.roundingUnit = 100_000
    m.sectors.stationery.riskCoefficient = 0.95
    const r = computeLimit(base, 'BBB', 'stationery', m)
    expect(r.unrounded).toBeCloseTo(1_320_000 * 0.7 * 0.95, 6)
    expect(r.limit).toBe(800_000)
  })
})
