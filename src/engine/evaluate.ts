/**
 * Firma değerlendirme hattı: G → A → S → not → erken uyarı override → PD →
 * limit → kredi şartları. UI yalnızca bu çıktıyı okur.
 */

import { computeAlternativeScore, type AlternativeScoreResult } from './alternativeScore'
import { computeCreditTerms, type CreditTerms } from './collateral'
import {
  applyEarlyWarningOverride,
  detectEarlyWarnings,
  type EarlyWarningResult,
  type GradeOverrideResult,
} from './earlyWarning'
import { computeLimit, type LimitResult } from './limit'
import type { CreditGrade, ModelConfig, SectorId } from './modelConfig'
import { computeFinalScore, gradeFromScore, probabilityOfDefault } from './rating'
import { computeTraditionalScore, type TraditionalScoreResult } from './traditionalScore'
import type { AlternativeInput, RiskFlags, TraditionalInput } from './types'

export interface FirmInput {
  sectorId: SectorId
  traditional: TraditionalInput
  alternative: AlternativeInput
  riskFlags: RiskFlags
}

export interface FirmEvaluation {
  traditional: TraditionalScoreResult
  alternative: AlternativeScoreResult
  /** Nihai skor S */
  score: number
  /** Override öncesi not */
  baseGrade: CreditGrade
  /** Override sonrası (nihai) not */
  grade: CreditGrade
  override: GradeOverrideResult
  earlyWarnings: EarlyWarningResult
  /** Temerrüt olasılığı (0–1) */
  pd: number
  limit: LimitResult
  /** C notunda null */
  terms: CreditTerms | null
}

export function evaluateFirm(firm: FirmInput, config: ModelConfig): FirmEvaluation {
  const traditional = computeTraditionalScore(firm.traditional, firm.sectorId, config)
  const alternative = computeAlternativeScore(firm.alternative, firm.sectorId, config)
  const score = computeFinalScore(traditional.score, alternative.score, config)
  const baseGrade = gradeFromScore(score, config)

  const indicatorScores = Object.fromEntries(
    Object.entries(alternative.indicators).map(([id, r]) => [id, r.score]),
  )
  const earlyWarnings = detectEarlyWarnings(
    {
      salesDeviation: traditional.ratios.salesDeviation,
      riskFlags: firm.riskFlags,
      traditionalScore: traditional.score,
      alternativeScore: alternative.score,
      indicatorScores,
      annualGrowth: alternative.trend.annualGrowth,
    },
    config,
  )
  const override = applyEarlyWarningOverride(baseGrade, earlyWarnings.critical)
  const grade = override.grade

  const s = traditional.statement
  const limit = computeLimit(
    {
      netSales: s.netSales,
      cashConversionCycle: traditional.ratios.cashConversionCycle,
      equity: s.equity,
      ebitda: s.ebitda,
      annualDebtService: s.annualDebtService,
    },
    grade,
    firm.sectorId,
    config,
  )

  return {
    traditional,
    alternative,
    score,
    baseGrade,
    grade,
    override,
    earlyWarnings,
    pd: probabilityOfDefault(score, config),
    limit,
    terms: computeCreditTerms(limit.limit, grade, firm.sectorId, config),
  }
}

/**
 * Alternatif veriyi belirtilen aya ('YYYY-MM') kadar keser. Karar anı
 * görüntüsü ve skor trendi için kullanılır. Seriler sona hizalıdır.
 */
export function alternativeInputAsOf(input: AlternativeInput, yearMonth: string): AlternativeInput {
  const end = input.months.indexOf(yearMonth)
  if (end < 0) throw new Error(`Ay veride yok: ${yearMonth}`)
  const drop = input.months.length - (end + 1)
  const cut = (values: number[]) => values.slice(0, Math.max(0, values.length - drop))
  const series: AlternativeInput['series'] = {}
  for (const [key, values] of Object.entries(input.series)) {
    if (values) series[key] = cut(values)
  }
  return {
    ...input,
    months: input.months.slice(0, end + 1),
    revenue: cut(input.revenue),
    series,
  }
}

/** Firmayı belirtilen aydaki alternatif veriyle değerlendirir (mizan/KVB değişmez). */
export function evaluateFirmAsOf(firm: FirmInput, yearMonth: string, config: ModelConfig): FirmEvaluation {
  return evaluateFirm({ ...firm, alternative: alternativeInputAsOf(firm.alternative, yearMonth) }, config)
}

export interface TrendPoint {
  month: string
  score: number
  grade: CreditGrade
}

/**
 * Son `count` ayın her biri için o aya kadarki veriyle skor ve not. Son nokta
 * güncel değerlendirmedir. Geçmiş noktalarda, veri penceresi o ay için henüz
 * dolmamış göstergeler firmada "eksik veri" sayılmaz: bu noktalarda kapsama
 * düzeltmesi uygulanmaz, SP mevcut göstergeler üzerinden hesaplanır.
 */
export function scoreTrend(firm: FirmInput, config: ModelConfig, count: number): TrendPoint[] {
  const months = firm.alternative.months.slice(-count)
  const historical: ModelConfig = {
    ...config,
    alternative: { ...config.alternative, coverage: { ...config.alternative.coverage, enabled: false } },
  }
  return months.map((month, i) => {
    const e = evaluateFirmAsOf(firm, month, i === months.length - 1 ? config : historical)
    return { month, score: e.score, grade: e.grade }
  })
}
