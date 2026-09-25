import { describe, expect, it } from 'vitest'
import { FIRMS, getFirm } from '../data'
import { sectorIndicators } from './alternativeScore'
import { evaluateFirm } from './evaluate'
import { computeIndicatorPeriod, measureForPeriod } from './indicatorPeriod'
import { DEFAULT_MODEL_CONFIG, type AlternativeIndicatorConfig } from './modelConfig'
import type { AlternativeInput } from './types'

const config = DEFAULT_MODEL_CONFIG

/** 24 ay: 2024-09 … 2026-08 */
const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2024, 8 + i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

function input(values: number[]): AlternativeInput {
  return { months: MONTHS.slice(MONTHS.length - values.length), revenue: values.map(() => 1), series: { x: values } }
}

const meanIndicator: AlternativeIndicatorConfig = {
  label: 'Test oranı',
  description: '',
  aciklama: '',
  birimAciklamasi: '',
  unit: 'share',
  seriesUnit: 'share',
  weight: 1,
  source: { series: 'x' },
  measure: { kind: 'mean', window: 3 },
  // Düşük oran iyi (ör. iade oranı)
  breakpoints: [
    { value: 0.05, score: 100 },
    { value: 0.1, score: 50 },
    { value: 0.2, score: 0 },
  ],
}

const yoyIndicator: AlternativeIndicatorConfig = {
  ...meanIndicator,
  label: 'Test hacmi',
  unit: 'change',
  seriesUnit: 'count',
  measure: { kind: 'change', window: 3, lag: 12 },
  breakpoints: [
    { value: -0.2, score: 0 },
    { value: 0, score: 50 },
    { value: 0.2, score: 100 },
  ],
}

describe('measureForPeriod', () => {
  it('ölçüm penceresini seçili döneme uyarlar', () => {
    expect(measureForPeriod({ kind: 'mean', window: 3 }, 12)).toEqual({ kind: 'mean', window: 12 })
    expect(measureForPeriod({ kind: 'change', window: 3, lag: 12 }, 6)).toEqual({ kind: 'change', window: 6, lag: 12 })
    expect(measureForPeriod({ kind: 'projection', window: 6, horizon: 3 }, 1)).toEqual({ kind: 'projection', window: 3, horizon: 3 })
    expect(measureForPeriod({ kind: 'projection', window: 6, horizon: 3 }, 12)).toEqual({ kind: 'projection', window: 12, horizon: 3 })
    expect(measureForPeriod({ kind: 'latest' }, 6)).toEqual({ kind: 'latest' })
    expect(measureForPeriod({ kind: 'periodChange', calendarMonths: [8, 9] }, 1)).toEqual({ kind: 'periodChange', calendarMonths: [8, 9] })
  })
})

describe('computeIndicatorPeriod', () => {
  // Son 3 ay 0,12; önceki 3 ay 0,08; daha öncesi 0,06
  const values = [...Array(18).fill(0.06), 0.08, 0.08, 0.08, 0.12, 0.12, 0.12]

  it('dönem ortalaması, önceki eşit döneme göre değişim ve dönem ayları', () => {
    const s = computeIndicatorPeriod(meanIndicator, input(values), 3, config)
    expect(s.months).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(s.previousMonths).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(s.average).toBeCloseTo(0.12, 12)
    expect(s.previousAverage).toBeCloseTo(0.08, 12)
    expect(s.change).toBeCloseTo(0.5, 12)
  })

  it('oranın artması bu gösterge için olumsuzdur (kırılım eğrisinin yönünden)', () => {
    expect(computeIndicatorPeriod(meanIndicator, input(values), 3, config).favorable).toBe(false)
    const falling = [...Array(18).fill(0.06), 0.12, 0.12, 0.12, 0.08, 0.08, 0.08]
    expect(computeIndicatorPeriod(meanIndicator, input(falling), 3, config).favorable).toBe(true)
  })

  it('Güçlü / Orta / Zayıf etiketi seçili döneme göre, sınırlar modelConfig\'ten', () => {
    const three = computeIndicatorPeriod(meanIndicator, input(values), 3, config)
    // 0,12 → 50 − 0,02/0,1 × 50 = 40 → Orta (sınır 40 dahil)
    expect(three.score).toBeCloseTo(40, 9)
    expect(three.strength).toBe('Orta')
    const twelve = computeIndicatorPeriod(meanIndicator, input(values), 12, config)
    // Son 12 ay: 6 × 0,06 + 3 × 0,08 + 3 × 0,12 = 0,08 → 70 → Güçlü
    expect(twelve.average).toBeCloseTo(0.08, 12)
    expect(twelve.strength).toBe('Güçlü')

    const stricter = structuredClone(config)
    stricter.presentation.strengthBands = { strongMin: 80, moderateMin: 45 }
    expect(computeIndicatorPeriod(meanIndicator, input(values), 3, stricter).strength).toBe('Zayıf')
    expect(computeIndicatorPeriod(meanIndicator, input(values), 12, stricter).strength).toBe('Orta')
  })

  it('değişim ölçümlü göstergede etiket, dönem uzunluğunda yıllık karşılaştırmayla hesaplanır', () => {
    // Geçen yıl 100, bu yıl son 6 ay 110, son 1 ay 90
    const vols = [...Array(12).fill(100), ...Array(6).fill(100), 110, 110, 110, 110, 110, 90]
    const six = computeIndicatorPeriod(yoyIndicator, input(vols), 6, config)
    expect(six.value).toBeCloseTo((110 * 5 + 90) / 6 / 100 - 1, 12)
    const one = computeIndicatorPeriod(yoyIndicator, input(vols), 1, config)
    expect(one.value).toBeCloseTo(-0.1, 12)
    expect(one.score).toBeCloseTo(25, 9) // −%10 → 25
    expect(one.strength).toBe('Zayıf')
    expect(six.strength).toBe('Orta') // +%6,7 → 66,7
    expect(one.change).toBeCloseTo(90 / 110 - 1, 12) // önceki aya göre
    expect(one.favorable).toBe(false)
  })

  it('mini grafik önceki ve seçili dönemi (en az 6 ay) kapsar', () => {
    expect(computeIndicatorPeriod(meanIndicator, input(values), 1, config).spark.values).toHaveLength(6)
    expect(computeIndicatorPeriod(meanIndicator, input(values), 3, config).spark.values).toHaveLength(6)
    const s12 = computeIndicatorPeriod(meanIndicator, input(values), 12, config)
    expect(s12.spark.values).toHaveLength(24)
    expect(s12.spark.months.at(-1)).toBe('2026-08')
  })

  it('veri yetersizse değerler boş kalır, hata vermez', () => {
    const short = computeIndicatorPeriod(yoyIndicator, input(values.slice(-18)), 12, config)
    expect(short.previousAverage).toBeNull()
    expect(short.change).toBeNull()
    expect(short.value).toBeNull()
    expect(short.strength).toBeNull()
    expect(short.average).not.toBeNull()
    const missing = computeIndicatorPeriod({ ...meanIndicator, source: { series: 'yok' } }, input(values), 3, config)
    expect(missing.average).toBeNull()
    expect(missing.spark.values).toEqual([])
  })

  it('çarpım kaynaklı göstergede aylık çarpım serisi kullanılır', () => {
    const ind: AlternativeIndicatorConfig = { ...yoyIndicator, source: { product: ['a', 'b'] } }
    const inp: AlternativeInput = { months: MONTHS, revenue: MONTHS.map(() => 1), series: { a: MONTHS.map(() => 10), b: MONTHS.map((_, i) => (i >= 21 ? 3 : 2)) } }
    const s = computeIndicatorPeriod(ind, inp, 3, config)
    expect(s.average).toBe(30)
    expect(s.previousAverage).toBe(20)
    expect(s.change).toBeCloseTo(0.5, 12)
  })
})

describe('dönem seçimi skoru etkilemez', () => {
  it('tüm demo firmalarında her dönem için hesaplama yapılır; değerlendirme sonucu değişmez', () => {
    for (const firm of FIRMS) {
      const before = evaluateFirm(firm, config)
      for (const [, ind] of sectorIndicators(config, firm.sectorId)) {
        for (const period of [1, 3, 6, 12]) {
          const s = computeIndicatorPeriod(ind, firm.alternative, period, config)
          expect(s.months).toHaveLength(period)
          expect(s.average).not.toBeNull()
        }
      }
      expect(evaluateFirm(firm, config)).toEqual(before)
    }
  })

  it('12 aylık dönemde ortalama ölçümlü gösterge, motorun 12 aylık değeriyle aynıdır', () => {
    const firm = getFirm('defne-kirtasiye')!
    const ind = config.sectors.stationery.indicators.inventoryTurnover
    const s = computeIndicatorPeriod(ind, firm.alternative, 12, config)
    expect(s.value).toBeCloseTo(evaluateFirm(firm, config).alternative.indicators.inventoryTurnover.value!, 12)
  })
})
