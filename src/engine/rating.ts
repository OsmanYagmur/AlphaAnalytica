/**
 * 3) Nihai Skor, Harf Notu ve Temerrüt Olasılığı.
 *
 * S  = w_G × G + w_A × A
 *      (Findeks skora dahilse: S = (1 − w_F) × (w_G × G + w_A × A) + w_F × F)
 * Not: eşik tablosuna göre (en düşük eşiğin altı C)
 * PD = 1 / (1 + e^((S − merkez) / ölçek))
 */

import { CREDIT_GRADES, LENDABLE_GRADES, type CreditGrade, type ModelConfig } from './modelConfig'

/** Findeks'in nihai skordaki ağırlığı (skora dahil değilse veya not yoksa 0). */
export function findeksWeight(findeksPoints: number | null, config: ModelConfig): number {
  return config.kkb.findeks.includeInScore && findeksPoints !== null ? config.kkb.findeks.weight : 0
}

/** Nihai skor S. `findeksPoints`: Findeks notunun 0–100 puanı (KKB verisi yoksa null). */
export function computeFinalScore(
  traditionalScore: number,
  alternativeScore: number,
  config: ModelConfig,
  findeksPoints: number | null = null,
): number {
  const { traditional, alternative } = config.final.weights
  const base = traditional * traditionalScore + alternative * alternativeScore
  const wF = findeksWeight(findeksPoints, config)
  return wF > 0 ? (1 - wF) * base + wF * findeksPoints! : base
}

/** Skorun harf notu: alt sınırını karşıladığı en iyi not; hiçbirini karşılamıyorsa C. */
export function gradeFromScore(score: number, config: ModelConfig): CreditGrade {
  for (const grade of LENDABLE_GRADES) {
    if (score >= config.rating.minScore[grade]) return grade
  }
  return 'C'
}

/** Temerrüt olasılığı (0–1). */
export function probabilityOfDefault(score: number, config: ModelConfig): number {
  const { center, scale } = config.rating.pd
  return 1 / (1 + Math.exp((score - center) / scale))
}

/** Notun sıra değeri: 0 = AAA (en iyi), büyüdükçe kötüleşir. */
export function gradeRank(grade: CreditGrade): number {
  return CREDIT_GRADES.indexOf(grade)
}

/** `grade`, `other` notundan kötü mü. */
export function isWorseGrade(grade: CreditGrade, other: CreditGrade): boolean {
  return gradeRank(grade) > gradeRank(other)
}

/** Notu en fazla `cap` olacak şekilde sınırlar (daha kötü notu yükseltmez). */
export function capGrade(grade: CreditGrade, cap: CreditGrade): CreditGrade {
  return isWorseGrade(cap, grade) ? cap : grade
}
