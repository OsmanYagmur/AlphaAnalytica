import { describe, expect, it } from 'vitest'
import { getFirm } from '../data'
import { isJustificationRequired, limitDeviation } from './decision'
import { evaluateFirm } from './evaluate'
import { computeScoreFactors, strengthLabel } from './factors'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { allocateProducts, revisedCollateral } from './collateral'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

describe('strengthLabel', () => {
  it('bant sınırları konfigürasyondan', () => {
    expect(strengthLabel(70, cfg)).toBe('Güçlü')
    expect(strengthLabel(69.9, cfg)).toBe('Orta')
    expect(strengthLabel(40, cfg)).toBe('Orta')
    expect(strengthLabel(39.9, cfg)).toBe('Zayıf')
    const c = createDefaultModelConfig()
    c.presentation.strengthBands.strongMin = 60
    expect(strengthLabel(65, c)).toBe('Güçlü')
  })
})

describe('computeScoreFactors', () => {
  it('kırtasiye: alternatif veri olumlu, bilanço olumsuz faktörlerde', () => {
    const ev = evaluateFirm(getFirm('defne-kirtasiye')!, cfg)
    const { positive, negative } = computeScoreFactors(ev, cfg)
    expect(positive).toHaveLength(3)
    expect(negative.length).toBeGreaterThan(0)
    expect(positive.map((f) => f.kind)).toContain('seasonalFit')
    expect(negative.every((f) => f.impact < 0)).toBe(true)
    expect(negative.map((f) => f.kind)).toContain('traditional')
    for (let i = 1; i < positive.length; i++) expect(positive[i - 1].impact).toBeGreaterThanOrEqual(positive[i].impact)
  })

  it('oto galeri: ilanda kalma süresi ve trend olumsuz', () => {
    const ev = evaluateFirm(getFirm('kuzey-oto')!, cfg)
    const ids = computeScoreFactors(ev, cfg).negative.map((f) => f.id)
    expect(ids).toContain('trend')
    expect(ids).toContain('daysOnMarket')
  })

  it('faktör sayısı konfigürasyondan; metinlerde sayı yok', () => {
    const c = createDefaultModelConfig()
    c.presentation.topFactorCount = 2
    const ev = evaluateFirm(getFirm('marmara-lojistik')!, c)
    const r = computeScoreFactors(ev, c)
    expect(r.positive).toHaveLength(2)
    ;[...r.positive, ...r.negative].forEach((f) => expect(f.text).not.toMatch(/\d/))
  })
})

describe('karar kuralları', () => {
  it('limitDeviation ve gerekçe zorunluluğu', () => {
    expect(limitDeviation(800_000, 1_000_000)).toBeCloseTo(-0.2, 12)
    expect(isJustificationRequired(800_000, 1_000_000, cfg)).toBe(false)
    expect(isJustificationRequired(790_000, 1_000_000, cfg)).toBe(true)
    expect(isJustificationRequired(1_250_000, 1_000_000, cfg)).toBe(true)
    expect(limitDeviation(500_000, 0)).toBe(Infinity)
    expect(isJustificationRequired(500_000, 0, cfg)).toBe(true)
  })

  it('revize teminat ve ürün dağılımı', () => {
    const c = revisedCollateral(1_000_000, 1, 'mortgage', cfg)
    expect(c.mortgageAmount).toBe(1_000_000)
    expect(c.requiredAppraisalValue).toBeCloseTo(1_000_000 / 0.7, 6)
    expect(revisedCollateral(1_000_000, 0.5, 'receivablesAssignment', cfg).mortgageAmount).toBe(0)
    expect(allocateProducts(1_000_000, { revolving: 0.5, spot: 0.5, nonCash: 0, inventoryFinance: 0 }).map((p) => p.amount)).toEqual([500_000, 500_000])
  })
})
