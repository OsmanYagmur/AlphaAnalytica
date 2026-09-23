/**
 * 5) Teminat, Vade, Fiyatlama, Ürün Kırılımı.
 *
 * Teminat Tutarı          = Limit × Teminat Oranı(not)
 * İpotek (zorunluysa)     = Limit × Teminat Oranı(not)
 * Gerekli Ekspertiz Değeri = İpotek Tutarı / Ekspertiz LTV
 * Vade ve spread nota göre; ürün kırılımı sektöre göre.
 * C notunda limit verilmez, şart üretilmez.
 */

import {
  COLLATERAL_TYPE_LABELS,
  PRODUCT_IDS,
  PRODUCT_LABELS,
  type CollateralTypeId,
  type CreditGrade,
  type LendableGrade,
  type ModelConfig,
  type ProductId,
  type SectorId,
  type TenorTerm,
} from './modelConfig'
import { positiveBaseRatio } from './math'
import { gradeRank } from './rating'

export function isLendable(grade: CreditGrade): grade is LendableGrade {
  return grade !== 'C'
}

export interface CollateralTerms {
  /** Teminat oranı (limitin kesri). */
  ratio: number
  type: CollateralTypeId
  typeLabel: string
  /** Toplam teminat tutarı. */
  amount: number
  mortgageRequired: boolean
  mortgageAmount: number
  requiredAppraisalValue: number
}

export function computeCollateral(limit: number, grade: LendableGrade, config: ModelConfig): CollateralTerms {
  const { collateralRatio, collateralType, mortgageRequiredFrom, appraisalLtv } = config.terms
  const ratio = collateralRatio[grade]
  const type = collateralType[grade]
  const amount = limit * ratio
  const mortgageRequired = gradeRank(grade) >= gradeRank(mortgageRequiredFrom)
  const mortgageAmount = mortgageRequired ? amount : 0
  return {
    ratio,
    type,
    typeLabel: COLLATERAL_TYPE_LABELS[type],
    amount,
    mortgageRequired,
    mortgageAmount,
    requiredAppraisalValue: positiveBaseRatio(mortgageAmount, appraisalLtv),
  }
}

export interface PricingTerms {
  referenceRate: string
  spreadBp: number
}

export function computePricing(grade: LendableGrade, config: ModelConfig): PricingTerms {
  return { referenceRate: config.terms.pricing.referenceRate, spreadBp: config.terms.pricing.spreadBp[grade] }
}

export function computeTenor(grade: LendableGrade, config: ModelConfig): TenorTerm {
  return { ...config.terms.tenor[grade] }
}

export interface ProductAllocation {
  product: ProductId
  label: string
  share: number
  amount: number
}

/** Limitin sektörel ürün kırılımına dağılımı (payı sıfır olan ürünler dahil edilmez). */
export function computeProductBreakdown(limit: number, sectorId: SectorId, config: ModelConfig): ProductAllocation[] {
  const mix = config.sectors[sectorId].productMix
  return PRODUCT_IDS.filter((p) => mix[p] > 0).map((product) => ({
    product,
    label: PRODUCT_LABELS[product],
    share: mix[product],
    amount: Math.round(limit * mix[product]),
  }))
}

export interface CreditTerms {
  grade: LendableGrade
  limit: number
  collateral: CollateralTerms
  tenor: TenorTerm
  pricing: PricingTerms
  products: ProductAllocation[]
}

/** Nota ve sektöre göre tüm kredi şartları; C notunda `null`. */
export function computeCreditTerms(
  limit: number,
  grade: CreditGrade,
  sectorId: SectorId,
  config: ModelConfig,
): CreditTerms | null {
  if (!isLendable(grade)) return null
  return {
    grade,
    limit,
    collateral: computeCollateral(limit, grade, config),
    tenor: computeTenor(grade, config),
    pricing: computePricing(grade, config),
    products: computeProductBreakdown(limit, sectorId, config),
  }
}
