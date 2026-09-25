/**
 * Gösterge dönem görünümü (yalnızca görüntüleme).
 *
 * Seçilen N aylık dönem için: dönem ortalaması, bir önceki eşit uzunluktaki
 * döneme göre değişim, mini grafik penceresi ve seçili döneme göre yeniden
 * hesaplanan Güçlü / Orta / Zayıf etiketi. Kredi skoru, not ve limit bu
 * hesaplamayı KULLANMAZ; motor kendi ölçüm pencereleriyle çalışmaya devam eder.
 */

import { computeIndicatorValue, resolveSourceSeries } from './alternativeScore'
import { strengthLabel, type StrengthLabel } from './factors'
import { mean } from './math'
import type { AlternativeIndicatorConfig, IndicatorMeasure, ModelConfig } from './modelConfig'
import { normalize } from './normalize'
import type { AlternativeInput } from './types'

/** Eğilimli seviye ölçümünde regresyon için gereken en az ay. */
const MIN_PROJECTION_WINDOW = 3

/**
 * Göstergenin ölçüm yöntemini seçili döneme uyarlar; etiket bu değerden hesaplanır.
 * - Ortalama → dönemin ortalaması
 * - Değişim → dönem uzunluğunda, aynı karşılaştırma aralığıyla (ör. geçen yılın aynı dönemi)
 * - Eğilimli seviye → dönem uzunluğunda regresyon (en az 3 ay)
 * - Son gözlem ve sezon dönemi ölçümleri dönemden bağımsızdır, olduğu gibi kalır.
 */
export function measureForPeriod(measure: IndicatorMeasure, periodMonths: number): IndicatorMeasure {
  switch (measure.kind) {
    case 'mean':
      return { kind: 'mean', window: periodMonths }
    case 'change':
      return { kind: 'change', window: periodMonths, lag: measure.lag }
    case 'projection':
      return { kind: 'projection', window: Math.max(periodMonths, MIN_PROJECTION_WINDOW), horizon: measure.horizon }
    case 'latest':
    case 'periodChange':
      return measure
  }
}

/** Değişimin gösterge açısından olumlu mu olumsuz mu olduğu; kırılım eğrisi monoton değilse `null`. */
function favorability(ind: AlternativeIndicatorConfig, change: number | null): boolean | null {
  if (change === null || change === 0) return null
  const scores = ind.breakpoints.map((b) => b.score)
  const rising = scores.every((s, i) => i === 0 || s >= scores[i - 1])
  const falling = scores.every((s, i) => i === 0 || s <= scores[i - 1])
  if (rising === falling) return null
  return rising ? change > 0 : change < 0
}

export interface IndicatorPeriodStats {
  periodMonths: number
  /** Seçili dönemin ayları ('YYYY-MM'); veri yetersizse boş. */
  months: string[]
  /** Bir önceki eşit uzunluktaki dönemin ayları; veri yetersizse boş. */
  previousMonths: string[]
  /** Aylık kaynak verinin dönem ortalaması (birim: `seriesUnit`). */
  average: number | null
  previousAverage: number | null
  /** Önceki döneme göre göreli değişim (0,05 = %5). */
  change: number | null
  /** Değişim göstergenin yönüne göre olumlu mu (ör. iade oranındaki artış olumsuzdur). */
  favorable: boolean | null
  /** Mini grafik: önceki + seçili dönem (en az 6 ay), son ay seçili dönemin sonu. */
  spark: { months: string[]; values: number[] }
  /** Seçili döneme uyarlanmış ölçümle hesaplanan değer ve 0–100 puan. */
  value: number | null
  score: number | null
  /** Seçili döneme göre Güçlü / Orta / Zayıf (sınırlar modelConfig'ten). */
  strength: StrengthLabel | null
}

/** Mini grafikte gösterilen en az ay sayısı. */
const MIN_SPARK_MONTHS = 6

/** Bir göstergenin seçili dönem istatistikleri. Veri, firmanın 24 aylık serilerinden okunur. */
export function computeIndicatorPeriod(
  ind: AlternativeIndicatorConfig,
  input: AlternativeInput,
  periodMonths: number,
  config: ModelConfig,
): IndicatorPeriodStats {
  const empty: IndicatorPeriodStats = {
    periodMonths,
    months: [],
    previousMonths: [],
    average: null,
    previousAverage: null,
    change: null,
    favorable: null,
    spark: { months: [], values: [] },
    value: null,
    score: null,
    strength: null,
  }
  const series = periodMonths >= 1 ? resolveSourceSeries(ind.source, input) : null
  if (!series || series.length === 0) return empty

  const n = series.length
  const months = input.months.slice(input.months.length - n)
  const cur = n >= periodMonths ? series.slice(n - periodMonths) : null
  const prev = n >= 2 * periodMonths ? series.slice(n - 2 * periodMonths, n - periodMonths) : null

  const average = cur ? mean(cur) : null
  const previousAverage = prev ? mean(prev) : null
  const change =
    average !== null && previousAverage !== null && previousAverage > 0 && Number.isFinite(average / previousAverage)
      ? average / previousAverage - 1
      : null

  const sparkLength = Math.min(n, Math.max(2 * periodMonths, MIN_SPARK_MONTHS))
  const value = computeIndicatorValue(series, months, measureForPeriod(ind.measure, periodMonths))
  const score = value === null ? null : normalize(value, ind.breakpoints)

  return {
    periodMonths,
    months: cur ? months.slice(n - periodMonths) : [],
    previousMonths: prev ? months.slice(n - 2 * periodMonths, n - periodMonths) : [],
    average,
    previousAverage,
    change,
    favorable: favorability(ind, change),
    spark: { months: months.slice(n - sparkLength), values: series.slice(n - sparkLength) },
    value,
    score,
    strength: score === null ? null : strengthLabel(score, config),
  }
}
