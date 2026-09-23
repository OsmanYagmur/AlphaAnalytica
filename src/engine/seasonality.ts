/**
 * Sezonsallık: Sezon Uyumu (SU) ve Arındırılmış Trend (TR).
 *
 * Beklenen_m = (Yıllık Ciro / 12) × S_m
 * Sapma_m    = Gerçekleşen_m / Beklenen_m − 1
 * SU         = 100 × max(0; 1 − ortalama|Sapma_m| / tolerans)
 * SA_m       = Gerçekleşen_m / S_m
 * TR         = normalize(yıllık büyüme); yıllık büyüme = SA eğimi × 12 / ortalama SA
 */

import { MONTHS_PER_YEAR, SCORE_SCALE, linearRegression, mean, positiveBaseRatio, sum } from './math'
import type { ModelConfig, SeasonProfile, SeasonProfileId, SectorId } from './modelConfig'
import { normalize } from './normalize'

/** 'YYYY-MM' → takvim ayı (1–12). */
export function calendarMonth(yearMonth: string): number {
  const month = Number.parseInt(yearMonth.slice(5, 7), 10)
  if (!(month >= 1 && month <= MONTHS_PER_YEAR)) throw new Error(`Geçersiz ay: ${yearMonth}`)
  return month
}

/** Endeksi ortalaması 1,00 olacak şekilde ölçekler. */
export function normalizeSeasonIndex(index: readonly number[]): number[] {
  const avg = mean(index)
  return avg > 0 ? index.map((v) => v / avg) : index.map(() => 1)
}

export interface ResolvedSeasonProfile {
  profileId: SeasonProfileId
  label: string
  /** Ortalaması 1,00'e normalize edilmiş S_m (Ocak → Aralık). */
  index: number[]
}

/** Sektörün ilgili sezon profilini döner; profil sektörde yoksa varsayılan profil kullanılır. */
export function resolveSeasonProfile(
  config: ModelConfig,
  sectorId: SectorId,
  profileId?: SeasonProfileId,
): ResolvedSeasonProfile {
  const { seasonality } = config.sectors[sectorId]
  const profiles = seasonality.profiles as Partial<Record<SeasonProfileId, SeasonProfile>>
  const id = profileId && profiles[profileId] ? profileId : (seasonality.defaultProfile as SeasonProfileId)
  const profile = profiles[id]
  if (!profile) throw new Error(`Sezon profili bulunamadı: ${sectorId}/${id}`)
  return { profileId: id, label: profile.label, index: normalizeSeasonIndex(profile.index) }
}

/** Ayın sezon endeksi değeri S_m. */
function indexFor(index: readonly number[], yearMonth: string): number {
  return index[calendarMonth(yearMonth) - 1]
}

function tail<T>(values: readonly T[], count: number): T[] {
  return values.slice(Math.max(0, values.length - count))
}

export interface SeasonalFitResult {
  /** Değerlendirme penceresindeki aylar. */
  months: string[]
  actual: number[]
  expected: number[]
  deviations: number[]
  /** Son 12 ayın cirosu (12 aydan kısa veride yıllıklandırılır). */
  annualRevenue: number
  meanAbsDeviation: number
  /** SU */
  score: number
}

/** Sezon Uyumu (SU). */
export function computeSeasonalFit(
  months: readonly string[],
  revenue: readonly number[],
  seasonIndex: readonly number[],
  config: ModelConfig,
): SeasonalFitResult {
  const { tolerance, windowMonths } = config.alternative.seasonalFit
  const yearSlice = tail(revenue, MONTHS_PER_YEAR)
  const annualRevenue = yearSlice.length > 0 ? (sum(yearSlice) / yearSlice.length) * MONTHS_PER_YEAR : 0

  const windowCount = Math.min(windowMonths, revenue.length, months.length)
  const windowMonthsList = tail(months, windowCount)
  const actual = tail(revenue, windowCount)
  const expected = windowMonthsList.map((m) => (annualRevenue / MONTHS_PER_YEAR) * indexFor(seasonIndex, m))
  const deviations = actual.map((a, i) => positiveBaseRatio(a, expected[i]) - 1)
  const meanAbsDeviation = deviations.length > 0 ? mean(deviations.map(Math.abs)) : 0
  const score = SCORE_SCALE * Math.max(0, 1 - positiveBaseRatio(meanAbsDeviation, tolerance))

  return { months: windowMonthsList, actual, expected, deviations, annualRevenue, meanAbsDeviation, score }
}

/** Sezonsallıktan arındırılmış seri: SA_m = Gerçekleşen_m / S_m. */
export function seasonallyAdjust(
  months: readonly string[],
  values: readonly number[],
  seasonIndex: readonly number[],
): number[] {
  const alignedMonths = tail(months, values.length)
  return values.map((v, i) => v / indexFor(seasonIndex, alignedMonths[i]))
}

export interface TrendResult {
  months: string[]
  /** SA_m */
  adjusted: number[]
  /** Aylık eğim (TL/ay). */
  slope: number
  /** Yıllık büyüme (kesir). */
  annualGrowth: number
  /** TR */
  score: number
}

/** Arındırılmış Trend (TR). */
export function computeTrend(
  months: readonly string[],
  revenue: readonly number[],
  seasonIndex: readonly number[],
  config: ModelConfig,
): TrendResult {
  const { windowMonths, breakpoints } = config.alternative.trend
  const windowCount = Math.min(windowMonths, revenue.length, months.length)
  const windowMonthsList = tail(months, windowCount)
  const adjusted = seasonallyAdjust(windowMonthsList, tail(revenue, windowCount), seasonIndex)
  const { slope } = linearRegression(adjusted)
  const level = mean(adjusted)
  const annualGrowth = level > 0 ? (slope * MONTHS_PER_YEAR) / level : 0
  return {
    months: windowMonthsList,
    adjusted,
    slope,
    annualGrowth,
    score: normalize(annualGrowth, breakpoints),
  }
}
