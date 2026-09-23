import { describe, expect, it } from 'vitest'
import {
  applyEarlyWarningOverride,
  detectEarlyWarnings,
  type CriticalSignal,
  type EarlyWarningInput,
} from './earlyWarning'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig

const clean: EarlyWarningInput = {
  salesDeviation: 0.01,
  riskFlags: { bouncedCheque: false, taxOrSgkDebt: false },
  traditionalScore: 70,
  alternativeScore: 68,
  indicatorScores: { a: 80, b: 60, c: null },
  annualGrowth: 0.05,
}

describe('detectEarlyWarnings — kritik sinyaller', () => {
  it('temiz firmada sinyal yok', () => {
    expect(detectEarlyWarnings(clean, cfg)).toEqual({ critical: [], watch: [] })
  })

  it('beyan tutarsızlığı eşiği aşınca (> %20) tetiklenir, eşitlikte tetiklenmez', () => {
    expect(detectEarlyWarnings({ ...clean, salesDeviation: 0.2 }, cfg).critical).toHaveLength(0)
    const r = detectEarlyWarnings({ ...clean, salesDeviation: 0.21 }, cfg)
    expect(r.critical).toEqual([{ id: 'declarationInconsistency', label: 'Beyan tutarsızlığı', gradeCap: 'BB' }])
  })

  it('karşılıksız çek ve vergi/SGK borcu', () => {
    const r = detectEarlyWarnings({ ...clean, riskFlags: { bouncedCheque: true, taxOrSgkDebt: true } }, cfg)
    expect(r.critical.map((s) => s.id)).toEqual(['bouncedCheque', 'taxOrSgkDebt'])
    r.critical.forEach((s) => expect(s.gradeCap).toBe('BB'))
  })

  it('kural açık/kapalı, eşik ve tavan konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.earlyWarning.critical.bouncedCheque.enabled = false
    c.earlyWarning.critical.declarationInconsistency.threshold = 0.1
    c.earlyWarning.critical.taxOrSgkDebt.gradeCap = 'B'
    const r = detectEarlyWarnings(
      { ...clean, salesDeviation: 0.15, riskFlags: { bouncedCheque: true, taxOrSgkDebt: true } },
      c,
    )
    expect(r.critical.map((s) => [s.id, s.gradeCap])).toEqual([
      ['declarationInconsistency', 'BB'],
      ['taxOrSgkDebt', 'B'],
    ])
  })
})

describe('detectEarlyWarnings — izleme sinyalleri', () => {
  it('zayıf göstergeler listelenir (eksik göstergeler yok sayılır)', () => {
    const r = detectEarlyWarnings({ ...clean, indicatorScores: { a: 35, b: 20, c: null, d: 36 } }, cfg)
    expect(r.watch).toEqual([{ id: 'weakIndicator', label: 'Zayıflayan alternatif gösterge', indicators: ['a', 'b'] }])
  })

  it('negatif arındırılmış trend (≤ −%10)', () => {
    expect(detectEarlyWarnings({ ...clean, annualGrowth: -0.09 }, cfg).watch).toHaveLength(0)
    expect(detectEarlyWarnings({ ...clean, annualGrowth: -0.1 }, cfg).watch.map((s) => s.id)).toEqual(['negativeTrend'])
  })

  it('alternatif veri bilançoyu teyit etmiyor (G − A ≥ 25) — oto galeri senaryosu', () => {
    const r = detectEarlyWarnings({ ...clean, traditionalScore: 80, alternativeScore: 45 }, cfg)
    expect(r.watch.map((s) => s.id)).toEqual(['scoreDivergence'])
    expect(r.critical).toHaveLength(0)
  })

  it('izleme eşikleri konfigürasyondan', () => {
    const c = createDefaultModelConfig()
    c.earlyWarning.watch.weakIndicator.maxScore = 70
    c.earlyWarning.watch.scoreDivergence.enabled = false
    const r = detectEarlyWarnings({ ...clean, traditionalScore: 90, alternativeScore: 40 }, c)
    expect(r.watch).toEqual([{ id: 'weakIndicator', label: 'Zayıflayan alternatif gösterge', indicators: ['b'] }])
  })
})

describe('applyEarlyWarningOverride', () => {
  const bb: CriticalSignal = { id: 'bouncedCheque', label: 'Karşılıksız çek kaydı', gradeCap: 'BB' }
  const b: CriticalSignal = { id: 'taxOrSgkDebt', label: 'Vergi / SGK borcu', gradeCap: 'B' }

  it('kritik sinyal yoksa not değişmez', () => {
    expect(applyEarlyWarningOverride('AA', [])).toEqual({ grade: 'AA', baseGrade: 'AA', capped: false, cap: null })
  })

  it('kritik sinyal varsa not en fazla BB', () => {
    expect(applyEarlyWarningOverride('A', [bb])).toEqual({ grade: 'BB', baseGrade: 'A', capped: true, cap: 'BB' })
  })

  it('zaten tavanın altındaki not yükseltilmez', () => {
    expect(applyEarlyWarningOverride('B', [bb])).toEqual({ grade: 'B', baseGrade: 'B', capped: false, cap: 'BB' })
    expect(applyEarlyWarningOverride('C', [bb]).grade).toBe('C')
  })

  it('birden fazla sinyalde en kısıtlayıcı tavan uygulanır', () => {
    expect(applyEarlyWarningOverride('AAA', [bb, b]).grade).toBe('B')
    expect(applyEarlyWarningOverride('AAA', [b, bb]).cap).toBe('B')
  })

  it('detect → override zinciri', () => {
    const signals = detectEarlyWarnings({ ...clean, salesDeviation: 0.25 }, cfg).critical
    expect(applyEarlyWarningOverride('AA', signals).grade).toBe('BB')
  })
})
