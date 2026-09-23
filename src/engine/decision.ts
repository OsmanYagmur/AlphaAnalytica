/**
 * Karar kuralları: revize limitin sistem önerisinden sapması ve gerekçe zorunluluğu.
 */

import type { ModelConfig } from './modelConfig'

/** (önerilen − sistem) / sistem. Sistem limiti 0 iken pozitif öneri ∞ sayılır. */
export function limitDeviation(proposed: number, system: number): number {
  if (system > 0) return (proposed - system) / system
  return proposed > 0 ? Infinity : 0
}

/** Sapma eşiği aşıldıysa gerekçe zorunludur. */
export function isJustificationRequired(proposed: number, system: number, config: ModelConfig): boolean {
  return Math.abs(limitDeviation(proposed, system)) > config.decision.revisionJustificationThreshold
}
