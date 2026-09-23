/**
 * 2) Alternatif Skor (A, 0–100).
 *
 * SP    = sektör göstergelerinin (mevcut olanlar üzerinden) ağırlıklı ortalaması
 * A_ham = w_SP × SP + w_SU × SU + w_TR × TR
 * c     = mevcut gösterge sayısı / toplam gösterge sayısı
 * A     = c × A_ham + (1 − c) × nötr değer   (kapsama düzeltmesi açıksa)
 */

import { MONTHS_PER_YEAR, linearRegression, mean, sum } from './math'
import {
  REVENUE_SERIES,
  type AlternativeIndicatorConfig,
  type IndicatorMeasure,
  type IndicatorSource,
  type ModelConfig,
  type SeasonProfileId,
  type SectorId,
} from './modelConfig'
import { normalize } from './normalize'
import {
  calendarMonth,
  computeSeasonalFit,
  computeTrend,
  resolveSeasonProfile,
  type SeasonalFitResult,
  type TrendResult,
} from './seasonality'
import type { AlternativeInput } from './types'

/** Sektörün gösterge konfigürasyonlarını sıralı olarak döner. */
export function sectorIndicators(config: ModelConfig, sectorId: SectorId): [string, AlternativeIndicatorConfig][] {
  return Object.entries(config.sectors[sectorId].indicators as Record<string, AlternativeIndicatorConfig>)
}

function lookupSeries(input: AlternativeInput, key: string): number[] | null {
  if (key === REVENUE_SERIES) return input.revenue
  return input.series[key] ?? null
}

/**
 * Göstergenin kaynak serisini çözer. Çarpım/oran kaynaklarında iki seri sona
 * hizalanır. Seri yoksa `null` (eksik veri).
 */
export function resolveSourceSeries(source: IndicatorSource, input: AlternativeInput): number[] | null {
  if ('series' in source) return lookupSeries(input, source.series)

  const [keyA, keyB] = 'product' in source ? source.product : source.ratio
  const a = lookupSeries(input, keyA)
  const b = lookupSeries(input, keyB)
  if (!a || !b) return null
  const n = Math.min(a.length, b.length)
  const aTail = a.slice(a.length - n)
  const bTail = b.slice(b.length - n)
  return 'product' in source ? aTail.map((v, i) => v * bTail[i]) : aTail.map((v, i) => v / bTail[i])
}

/**
 * Aylık seriden gösterge değerini hesaplar. Seri sonu `months` dizisinin son
 * ayına hizalıdır. Yetersiz veri veya tanımsız sonuçta `null` döner.
 */
export function computeIndicatorValue(
  values: readonly number[],
  months: readonly string[],
  measure: IndicatorMeasure,
): number | null {
  const n = values.length
  const last = (count: number) => values.slice(n - count)
  let result: number

  switch (measure.kind) {
    case 'latest':
      if (n < 1) return null
      result = values[n - 1]
      break
    case 'mean':
      if (measure.window < 1 || n < measure.window) return null
      result = mean(last(measure.window))
      break
    case 'change': {
      const { window, lag } = measure
      if (window < 1 || lag < 0 || n < window + lag) return null
      const recent = mean(last(window))
      const base = mean(values.slice(n - lag - window, n - lag))
      if (!(base > 0)) return null
      result = recent / base - 1
      break
    }
    case 'projection': {
      const { window, horizon } = measure
      if (window < 2 || n < window) return null
      const { slope, intercept } = linearRegression(last(window))
      result = intercept + slope * (window - 1 + horizon)
      break
    }
    case 'periodChange': {
      const span = 2 * MONTHS_PER_YEAR
      if (n < span || months.length < n) return null
      const alignedMonths = months.slice(months.length - n)
      const selected = new Set(measure.calendarMonths)
      const periodSum = (from: number, to: number) =>
        sum(values.slice(from, to).filter((_, i) => selected.has(calendarMonth(alignedMonths[from + i]))))
      const recent = periodSum(n - MONTHS_PER_YEAR, n)
      const base = periodSum(n - span, n - MONTHS_PER_YEAR)
      if (!(base > 0)) return null
      result = recent / base - 1
      break
    }
  }

  return Number.isFinite(result) ? result : null
}

export interface IndicatorResult {
  label: string
  weight: number
  available: boolean
  /** Ölçülen değer (birimi gösterge konfigürasyonunda). */
  value: number | null
  /** 0–100 puan. */
  score: number | null
}

export interface AlternativeScoreResult {
  /** A (kapsama düzeltmesi sonrası) */
  score: number
  /** A_ham */
  raw: number
  sp: number
  su: number
  tr: number
  /** c = mevcut / toplam gösterge */
  coverage: number
  availableCount: number
  totalCount: number
  indicators: Record<string, IndicatorResult>
  seasonProfile: { id: SeasonProfileId; label: string; index: number[] }
  seasonalFit: SeasonalFitResult
  trend: TrendResult
}

/** Sektörel Performans (SP) ve gösterge sonuçları. */
export function computeSectorPerformance(
  input: AlternativeInput,
  sectorId: SectorId,
  config: ModelConfig,
): { sp: number; indicators: Record<string, IndicatorResult>; availableCount: number; totalCount: number } {
  const entries = sectorIndicators(config, sectorId)
  const indicators: Record<string, IndicatorResult> = {}
  let weightedSum = 0
  let weightTotal = 0
  let availableCount = 0

  for (const [id, ind] of entries) {
    const series = resolveSourceSeries(ind.source, input)
    const value = series ? computeIndicatorValue(series, input.months, ind.measure) : null
    const score = value === null ? null : normalize(value, ind.breakpoints)
    indicators[id] = { label: ind.label, weight: ind.weight, available: score !== null, value, score }
    if (score !== null) {
      availableCount++
      weightedSum += score * ind.weight
      weightTotal += ind.weight
    }
  }

  const sp = weightTotal > 0 ? weightedSum / weightTotal : config.alternative.coverage.neutralScore
  return { sp, indicators, availableCount, totalCount: entries.length }
}

/** Alternatif skoru hesaplar. */
export function computeAlternativeScore(
  input: AlternativeInput,
  sectorId: SectorId,
  config: ModelConfig,
): AlternativeScoreResult {
  const { weights, coverage } = config.alternative
  const profile = resolveSeasonProfile(config, sectorId, input.seasonProfile)
  const seasonalFit = computeSeasonalFit(input.months, input.revenue, profile.index, config)
  const trend = computeTrend(input.months, input.revenue, profile.index, config)
  const { sp, indicators, availableCount, totalCount } = computeSectorPerformance(input, sectorId, config)

  const su = seasonalFit.score
  const tr = trend.score
  const raw = weights.sp * sp + weights.su * su + weights.tr * tr
  const c = totalCount > 0 ? availableCount / totalCount : 0
  const score = coverage.enabled ? c * raw + (1 - c) * coverage.neutralScore : raw

  return {
    score,
    raw,
    sp,
    su,
    tr,
    coverage: c,
    availableCount,
    totalCount,
    indicators,
    seasonProfile: { id: profile.profileId, label: profile.label, index: profile.index },
    seasonalFit,
    trend,
  }
}
