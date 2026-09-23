/**
 * 3) Nihai Skor, Harf Notu ve Temerrüt Olasılığı.
 *
 * S  = w_G × G + w_A × A
 * Not: eşik tablosuna göre (en düşük eşiğin altı C)
 * PD = 1 / (1 + e^((S − merkez) / ölçek))
 */

import { CREDIT_GRADES, LENDABLE_GRADES, type CreditGrade, type ModelConfig } from './modelConfig'

/** Nihai skor S. */
export function computeFinalScore(traditionalScore: number, alternativeScore: number, config: ModelConfig): number {
  const { traditional, alternative } = config.final.weights
  return traditional * traditionalScore + alternative * alternativeScore
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
