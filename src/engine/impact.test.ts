import { describe, expect, it } from 'vitest'
import { FIRMS, getFirm } from '../data'
import { evaluateFirm } from './evaluate'
import { computeImpact, scoreComponents, scoreWaterfall } from './impact'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { EXPORT_FORMAT, exportModelConfig, parseModelConfigJson } from './schema'
import { runSensitivity, sensitivityParams } from './sensitivity'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const alt30 = (): ModelConfig => {
  const c = createDefaultModelConfig()
  c.final.weights = { traditional: 0.7, alternative: 0.3 }
  return c
}

describe('computeImpact', () => {
  it('aynı konfigürasyonda değişim yok', () => {
    const { firms, summary } = computeImpact(FIRMS, cfg, createDefaultModelConfig())
    expect(summary.unchanged).toBe(14)
    firms.forEach((f) => expect(f.scoreChange).toBeCloseTo(0, 12))
    expect(summary.totalLimitAfter).toBe(summary.totalLimitBefore)
  })

  it('alternatif ağırlık %30: kırtasiye BBB → BB, limit düşer; oto galeri yükselir', () => {
    const { firms, summary } = computeImpact(FIRMS, cfg, alt30())
    const defne = firms.find((f) => f.firmId === 'defne-kirtasiye')!
    expect(defne.before.grade).toBe('BBB')
    expect(defne.after.grade).toBe('BB')
    expect(defne.gradeSteps).toBe(-1)
    expect(defne.limitChange).toBeLessThan(0)
    const auto = firms.find((f) => f.firmId === 'kuzey-oto')!
    expect(auto.scoreChange).toBeGreaterThan(0)
    expect(summary.upgraded + summary.downgraded + summary.unchanged).toBe(14)
    expect(summary.downgraded).toBeGreaterThanOrEqual(1)
  })
})

describe('scoreComponents / scoreWaterfall', () => {
  it('bileşenler toplamı nihai skora eşit', () => {
    for (const f of FIRMS) {
      const e = evaluateFirm(f, cfg)
      const total = scoreComponents(e, cfg).reduce((a, c) => a + c.value, 0)
      expect(total).toBeCloseTo(e.score, 9)
    }
  })

  it('şelale adımları toplamı skor değişimine eşit; kapsama kapalıyken de', () => {
    const c = alt30()
    c.alternative.coverage.enabled = false
    const w = scoreWaterfall(getFirm('defne-kirtasiye')!, cfg, c)
    expect(w.before + w.steps.reduce((a, s) => a + s.delta, 0)).toBeCloseTo(w.after, 9)
    expect(w.steps.find((s) => s.id === 'liquidity')!.delta).toBeGreaterThan(0)
    expect(w.steps.find((s) => s.id === 'su')!.delta).toBeLessThan(0)
  })
})

describe('duyarlılık analizi', () => {
  const firm = getFirm('defne-kirtasiye')!
  const params = sensitivityParams(cfg, 'stationery')

  it('alternatif ağırlık arttıkça kırtasiyenin skoru artar (A > G)', () => {
    const points = runSensitivity(firm, cfg, params.find((p) => p.id === 'final.alternative')!, 11)
    expect(points).toHaveLength(11)
    for (let i = 1; i < points.length; i++) expect(points[i].score).toBeGreaterThan(points[i - 1].score)
    expect(points[0].score).toBeCloseTo(evaluateFirm(firm, cfg).traditional.score, 9)
  })

  it('ağırlık parametrelerinde grup toplamı %100 kalır', () => {
    for (const p of params.filter((x) => x.scale === 100)) {
      const c = p.apply(cfg, p.min + (p.max - p.min) * 0.37)
      const sums = [
        c.final.weights.traditional + c.final.weights.alternative,
        c.alternative.weights.sp + c.alternative.weights.su + c.alternative.weights.tr,
        Object.values(c.traditional.categories).reduce((a, x) => a + x.weight, 0),
      ]
      sums.forEach((s) => expect(s).toBeCloseTo(1, 9))
      expect(p.get(c)).toBeCloseTo(p.min + (p.max - p.min) * 0.37, 9)
    }
  })
})

describe('JSON dışa / içe aktarma ve şema doğrulaması', () => {
  it('dışa aktarılan dosya geri içe aktarılır', () => {
    const text = exportModelConfig(alt30(), 'v1.1')
    expect(JSON.parse(text).format).toBe(EXPORT_FORMAT)
    const r = parseModelConfigJson(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.sourceVersion).toBe('v1.1')
      expect(r.config.final.weights.alternative).toBe(0.3)
    }
  })

  it('yalın konfigürasyon nesnesi de kabul edilir', () => {
    expect(parseModelConfigJson(JSON.stringify(cfg)).ok).toBe(true)
  })

  it('geçersiz JSON, yanlış şema sürümü, eksik/tanımsız alan ve tür hatası reddedilir', () => {
    expect(parseModelConfigJson('{ bozuk').ok).toBe(false)
    expect(parseModelConfigJson(JSON.stringify({ ...cfg, schemaVersion: 2 })).ok).toBe(false)

    const missing = structuredClone(cfg) as Partial<ModelConfig>
    delete missing.limit
    const r1 = parseModelConfigJson(JSON.stringify(missing))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.errors.join()).toContain('limit: eksik alan')

    const extra = { ...structuredClone(cfg), fazla: 1 }
    const r2 = parseModelConfigJson(JSON.stringify(extra))
    if (!r2.ok) expect(r2.errors.join()).toContain('fazla: tanımsız alan')
    expect(r2.ok).toBe(false)

    const wrongType = structuredClone(cfg) as unknown as { rating: { pd: { center: unknown } } }
    wrongType.rating.pd.center = 'otuz'
    const r3 = parseModelConfigJson(JSON.stringify(wrongType))
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.errors[0]).toContain('rating.pd.center')
  })

  it('yapısı doğru ama değer kuralını ihlal eden konfigürasyon reddedilir', () => {
    const c = createDefaultModelConfig()
    c.final.weights.alternative = 0.9
    const r = parseModelConfigJson(JSON.stringify(c))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toContain('final.weights')
  })
})
