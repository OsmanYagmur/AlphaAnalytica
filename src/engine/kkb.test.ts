import { describe, expect, it } from 'vitest'
import { annualPrincipal, detectKkbSignals, kkbSnapshot, mizanDeviation, monthDiff } from './kkb'
import { migrateModelConfig } from './migrate'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { exportModelConfig, parseModelConfigJson } from './schema'
import type { KkbFacility, KkbReport } from './types'
import { validateModelConfig } from './validation'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
const flat = (v: number) => MONTHS.map(() => v)

function fac(partial: Partial<KkbFacility>): KkbFacility {
  return {
    bank: 'Banka A',
    type: 'revolving',
    cashLimit: flat(0),
    cashRisk: flat(0),
    nonCashLimit: flat(0),
    nonCashRisk: flat(0),
    delayDays: flat(0),
    legalFollowUpFrom: null,
    maturity: null,
    ...partial,
  }
}

const report: KkbReport = {
  months: MONTHS,
  mizanMonth: '2026-01',
  facilities: [
    fac({ bank: 'Banka A', type: 'revolving', cashLimit: flat(1_000_000), cashRisk: [500e3, 500e3, 500e3, 600e3, 700e3, 800e3, 900e3, 950e3] }),
    fac({ bank: 'Banka B', type: 'installment', cashLimit: flat(600_000), cashRisk: flat(240_000), maturity: '2026-12' }),
    fac({ bank: 'Banka B', type: 'nonCash', nonCashLimit: flat(200_000), nonCashRisk: flat(100_000), delayDays: [0, 0, 0, 0, 12, 35, 0, 0] }),
  ],
  inquiries: [0, 1, 0, 0, 2, 2, 1, 2],
  findeks: [1500, 1490, 1480, 1450, 1400, 1300, 1150, 1080],
  bouncedCheques: ['2025-06'],
  protestedBills: ['2026-05'],
}

describe('KKB yardımcıları', () => {
  it('ay farkı ve eşit taksitli kredide yıllık anapara', () => {
    expect(monthDiff('2025-12', '2026-08')).toBe(8)
    expect(annualPrincipal(1_200_000, 60)).toBeCloseTo(240_000, 6)
    expect(annualPrincipal(300_000, 4)).toBe(300_000) // 12 aydan az kalan: kalan anaparanın tamamı
    expect(annualPrincipal(100_000, 0)).toBe(0)
  })
})

describe('kkbSnapshot', () => {
  const k = kkbSnapshot(report, '2026-08', cfg)

  it('banka bazında toplamlar, doluluk ve türler', () => {
    expect(k.banks.map((b) => b.bank)).toEqual(['Banka A', 'Banka B'])
    const b = k.banks[1]
    expect(b.types).toEqual(['installment', 'nonCash'])
    expect(b.cashRisk).toBe(240_000)
    expect(b.nonCashRisk).toBe(100_000)
    expect(b.maxDelayDays12m).toBe(35)
    expect(k.totalRisk).toBe(950_000 + 240_000 + 100_000)
    expect(k.totalLimit).toBe(1_000_000 + 600_000 + 200_000)
    expect(k.utilization).toBeCloseTo(k.totalRisk / k.totalLimit, 12)
  })

  it('K1 düşümü ve K3 anapara ödemeleri türlere göre ayrılır', () => {
    expect(k.workingCapitalCashRisk).toBe(950_000)
    // Ağu 26 → Ara 26: 4 taksit kaldı, tamamı 12 ay içinde ödenir
    expect(k.annualDebtService).toBe(240_000)
  })

  it('pencere hesapları: sorgu (3 ay), risk artışı (6 ay), 12 aylık kayıtlar', () => {
    expect(k.inquiries).toBe(1 + 2 + 2)
    const base = 500e3 + 240e3 + 100e3 // 2026-02
    expect(k.riskGrowth).toBeCloseTo(k.totalRisk / base - 1, 12)
    expect(k.bouncedCheques12m).toBe(0) // 2025-06, 12 ayın dışında
    expect(k.protestedBills12m).toBe(1)
  })

  it('sinyaller eşiklere göre; not tavanı config’ten', () => {
    const signals = detectKkbSignals(k, 700_000, cfg)
    expect(signals.map((s) => s.id)).toEqual(['overdue', 'riskGrowth', 'lowFindeks'])
    expect(signals[0].gradeCap).toBe('BB')
    // Mizan ayında KKB nakdi riski 740.000; finansal borç 700.000 → %5,7 sapma, eşiğin altında
    expect(mizanDeviation(k, 700_000)).toBeCloseTo(40_000 / 700_000, 12)
    expect(detectKkbSignals(k, 400_000, cfg).map((s) => s.id)).toContain('mizanMismatch')
    const strict = createDefaultModelConfig()
    strict.kkb.signals.inquiries.minCount = 5
    strict.kkb.signals.riskGrowth.minGrowth = 0.6
    const ids = detectKkbSignals(k, 700_000, strict).map((s) => s.id)
    expect(ids).toContain('inquiries')
    expect(ids).not.toContain('riskGrowth')
  })

  it('geçmiş bir ayın görüntüsü o aya kadarki veriyle alınır', () => {
    const early = kkbSnapshot(report, '2026-03', cfg)
    expect(early.maxDelayDays).toBe(0)
    expect(early.riskSeries.months).toEqual(MONTHS.slice(0, 3))
    expect(early.riskGrowth).toBeNull() // 6 ay öncesi raporda yok
  })
})

describe('KKB parametreleri: doğrulama ve eski konfigürasyonlar', () => {
  it('geçersiz not tavanı, çakışan kredi türü ve aralık dışı ağırlık reddedilir', () => {
    const c = createDefaultModelConfig()
    ;(c.kkb.signals.overdue as { gradeCap: string }).gradeCap = 'ZZ'
    c.kkb.debtService.termTypes = ['installment', 'spot']
    c.kkb.findeks.weight = 0.8
    const paths = validateModelConfig(c).map((i) => i.path)
    expect(paths).toEqual(expect.arrayContaining(['kkb.signals.overdue.gradeCap', 'kkb.debtService.termTypes', 'kkb.findeks.weight']))
  })

  it('KKB bölümü olmayan eski konfigürasyon v1.0 KKB parametreleriyle tamamlanır; temel bölümü eksik dosya reddedilir', () => {
    const old = structuredClone(DEFAULT_MODEL_CONFIG) as Partial<ModelConfig>
    delete old.kkb
    const migrated = migrateModelConfig(old)
    expect(migrated.kkb).toEqual(DEFAULT_MODEL_CONFIG.kkb)
    expect(parseModelConfigJson(exportModelConfig(old as ModelConfig, 'v1.2')).ok).toBe(true)

    const broken = structuredClone(DEFAULT_MODEL_CONFIG) as Partial<ModelConfig>
    delete broken.rating
    expect(parseModelConfigJson(JSON.stringify(broken)).ok).toBe(false)
  })
})
