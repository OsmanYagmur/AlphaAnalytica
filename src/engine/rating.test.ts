import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { capGrade, computeFinalScore, gradeFromScore, gradeRank, isWorseGrade, probabilityOfDefault } from './rating'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

describe('computeFinalScore — S = w_G × G + w_A × A', () => {
  it('varsayılan %50 / %50', () => {
    expect(computeFinalScore(52, 78, cfg)).toBeCloseTo(65, 12)
    expect(computeFinalScore(80, 45, cfg)).toBeCloseTo(62.5, 12)
  })

  it('ağırlıklar konfigürasyondan (alternatif %30)', () => {
    const c = createDefaultModelConfig()
    c.final.weights = { traditional: 0.7, alternative: 0.3 }
    expect(computeFinalScore(52, 78, c)).toBeCloseTo(59.8, 12)
  })
})

describe('gradeFromScore — harf notu', () => {
  it.each([
    [100, 'AAA'],
    [90, 'AAA'],
    [89.99, 'AA'],
    [80, 'AA'],
    [79.5, 'A'],
    [70, 'A'],
    [65, 'BBB'],
    [60, 'BBB'],
    [59.9, 'BB'],
    [50, 'BB'],
    [49, 'B'],
    [40, 'B'],
    [39.99, 'C'],
    [0, 'C'],
  ] as const)('%d → %s', (score, grade) => {
    expect(gradeFromScore(score, cfg)).toBe(grade)
  })

  it('eşikler konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.rating.minScore.BBB = 64
    expect(gradeFromScore(62.5, c)).toBe('BB')
    expect(gradeFromScore(64, c)).toBe('BBB')
  })
})

describe('probabilityOfDefault — PD = 1 / (1 + e^((S − 30) / 9))', () => {
  it('merkezde %50, skor arttıkça azalır', () => {
    expect(probabilityOfDefault(30, cfg)).toBeCloseTo(0.5, 12)
    expect(probabilityOfDefault(39, cfg)).toBeCloseTo(1 / (1 + Math.E), 12)
    expect(probabilityOfDefault(65, cfg)).toBeCloseTo(1 / (1 + Math.exp(35 / 9)), 12)
    expect(probabilityOfDefault(90, cfg)).toBeLessThan(probabilityOfDefault(60, cfg))
    expect(probabilityOfDefault(0, cfg)).toBeGreaterThan(0.9)
  })

  it('merkez ve ölçek konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.rating.pd = { center: 40, scale: 5 }
    expect(probabilityOfDefault(40, c)).toBeCloseTo(0.5, 12)
    expect(probabilityOfDefault(45, c)).toBeCloseTo(1 / (1 + Math.E), 12)
  })
})

describe('not sıralama yardımcıları', () => {
  it('gradeRank / isWorseGrade', () => {
    expect(gradeRank('AAA')).toBe(0)
    expect(gradeRank('C')).toBe(6)
    expect(isWorseGrade('BB', 'A')).toBe(true)
    expect(isWorseGrade('A', 'BB')).toBe(false)
  })

  it('capGrade: notu tavanla sınırlar, kötü notu yükseltmez', () => {
    expect(capGrade('AAA', 'BB')).toBe('BB')
    expect(capGrade('A', 'BB')).toBe('BB')
    expect(capGrade('BB', 'BB')).toBe('BB')
    expect(capGrade('B', 'BB')).toBe('B')
    expect(capGrade('C', 'BB')).toBe('C')
  })
})
