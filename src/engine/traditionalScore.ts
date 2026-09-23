/**
 * 1) Geleneksel Skor (G, 0–100) — mizan + Kurumlar Vergisi Beyannamesi.
 *
 * G = Σ (kategori puanı × kategori ağırlığı)
 * Kategori puanı = Σ (oran puanı × oran ağırlığı)
 * Oran puanı = kırılım noktalarıyla parçalı doğrusal normalizasyon.
 * Nakit Dönüşüm Süresi sektör medyanına oranı üzerinden puanlanır.
 * KVB matrahı negatifse Beyan Tutarlılığı kategorisi tavanla sınırlanır.
 */

import {
  computeRatios,
  deriveFinancialStatement,
  type FinancialRatios,
  type FinancialStatement,
} from './financials'
import { positiveBaseRatio } from './math'
import {
  TRADITIONAL_CATEGORY_IDS,
  type ModelConfig,
  type RatioConfig,
  type SectorId,
  type TraditionalCategoryId,
  type TraditionalRatioId,
} from './modelConfig'
import { normalize } from './normalize'
import type { TraditionalInput } from './types'

export interface RatioScore {
  label: string
  /** Oranın kendi değeri (NDS için gün). */
  value: number
  /** Normalizasyona giren değer (NDS için sektör medyanına oran; diğerlerinde `value`). */
  input: number
  score: number
  weight: number
}

export interface CategoryScore {
  label: string
  score: number
  weight: number
  /** Kategori puanı × kategori ağırlığı (G'ye katkı). */
  contribution: number
  ratios: Partial<Record<TraditionalRatioId, RatioScore>>
  /** Negatif matrah tavanı uygulandı mı (yalnızca Beyan Tutarlılığı). */
  capped: boolean
}

export interface TraditionalScoreResult {
  /** G */
  score: number
  categories: Record<TraditionalCategoryId, CategoryScore>
  statement: FinancialStatement
  ratios: FinancialRatios
  taxBaseNegative: boolean
}

export interface TraditionalScoringContext {
  /** Sektörel nakit dönüşüm süresi medyanı (gün). */
  cccMedianDays: number
  /** KVB matrahı negatif mi. */
  taxBaseNegative: boolean
}

/** Oran kimliğinden normalizasyona girecek değeri üretir. */
function ratioInput(id: TraditionalRatioId, ratios: FinancialRatios, ctx: TraditionalScoringContext): number {
  if (id === 'cashConversionCycle') return positiveBaseRatio(ratios.cashConversionCycle, ctx.cccMedianDays)
  return ratios[id]
}

/** Hesaplanmış oranlardan G skorunu üretir. */
export function scoreTraditionalRatios(
  ratios: FinancialRatios,
  ctx: TraditionalScoringContext,
  config: ModelConfig,
): Pick<TraditionalScoreResult, 'score' | 'categories'> {
  const { categories: categoryConfigs, negativeTaxBaseScoreCap } = config.traditional
  const categories = {} as Record<TraditionalCategoryId, CategoryScore>
  let total = 0

  for (const categoryId of TRADITIONAL_CATEGORY_IDS) {
    const categoryConfig = categoryConfigs[categoryId]
    const ratioEntries = Object.entries(categoryConfig.ratios) as [TraditionalRatioId, RatioConfig][]
    const ratioScores: Partial<Record<TraditionalRatioId, RatioScore>> = {}
    let categoryScore = 0

    for (const [ratioId, ratioConfig] of ratioEntries) {
      const input = ratioInput(ratioId, ratios, ctx)
      const score = normalize(input, ratioConfig.breakpoints)
      ratioScores[ratioId] = {
        label: ratioConfig.label,
        value: ratios[ratioId],
        input,
        score,
        weight: ratioConfig.weight,
      }
      categoryScore += score * ratioConfig.weight
    }

    let capped = false
    if (categoryId === 'consistency' && ctx.taxBaseNegative && categoryScore > negativeTaxBaseScoreCap) {
      categoryScore = negativeTaxBaseScoreCap
      capped = true
    }

    const contribution = categoryScore * categoryConfig.weight
    total += contribution
    categories[categoryId] = {
      label: categoryConfig.label,
      score: categoryScore,
      weight: categoryConfig.weight,
      contribution,
      ratios: ratioScores,
      capped,
    }
  }

  return { score: total, categories }
}

/** Mizan + KVB'den geleneksel skoru hesaplar. */
export function computeTraditionalScore(
  input: TraditionalInput,
  sectorId: SectorId,
  config: ModelConfig,
): TraditionalScoreResult {
  const statement = deriveFinancialStatement(input.trialBalance, input.supplement)
  const ratios = computeRatios(statement, input.taxReturn, config.daysInYear)
  const taxBaseNegative = input.taxReturn.taxBase < 0
  const scored = scoreTraditionalRatios(
    ratios,
    { cccMedianDays: config.sectors[sectorId].cccMedianDays, taxBaseNegative },
    config,
  )
  return { ...scored, statement, ratios, taxBaseNegative }
}
