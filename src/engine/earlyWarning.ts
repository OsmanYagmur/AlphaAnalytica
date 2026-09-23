/**
 * Erken uyarı sinyalleri ve not override'ı.
 *
 * Kritik sinyaller (beyan tutarsızlığı, karşılıksız çek, vergi/SGK borcu)
 * tetiklenirse not, kuralın tavanından (varsayılan BB) iyi olamaz.
 * İzleme sinyalleri notu değiştirmez; rozet ve izlenecek gösterge olarak çıkar.
 */

import type {
  CreditGrade,
  CriticalSignalId,
  LendableGrade,
  ModelConfig,
  WatchSignalId,
} from './modelConfig'
import { capGrade, isWorseGrade } from './rating'
import type { RiskFlags } from './types'

export interface EarlyWarningInput {
  /** |Mizan − KVB| / KVB net satış sapması. */
  salesDeviation: number
  riskFlags: RiskFlags
  /** G */
  traditionalScore: number
  /** A */
  alternativeScore: number
  /** Gösterge kimliği → puan (eksik gösterge = null). */
  indicatorScores: Record<string, number | null>
  /** Arındırılmış yıllık ciro büyümesi (kesir). */
  annualGrowth: number
}

export interface CriticalSignal {
  id: CriticalSignalId
  label: string
  gradeCap: LendableGrade
}

export interface WatchSignal {
  id: WatchSignalId
  label: string
  /** weakIndicator için zayıf göstergelerin kimlikleri. */
  indicators?: string[]
}

export interface EarlyWarningResult {
  critical: CriticalSignal[]
  watch: WatchSignal[]
}

export function detectEarlyWarnings(input: EarlyWarningInput, config: ModelConfig): EarlyWarningResult {
  const { critical: c, watch: w } = config.earlyWarning
  const critical: CriticalSignal[] = []
  const watch: WatchSignal[] = []

  const addCritical = (id: CriticalSignalId, rule: { label: string; gradeCap: LendableGrade }) =>
    critical.push({ id, label: rule.label, gradeCap: rule.gradeCap })

  if (c.declarationInconsistency.enabled && input.salesDeviation > c.declarationInconsistency.threshold) {
    addCritical('declarationInconsistency', c.declarationInconsistency)
  }
  if (c.bouncedCheque.enabled && input.riskFlags.bouncedCheque) {
    addCritical('bouncedCheque', c.bouncedCheque)
  }
  if (c.taxOrSgkDebt.enabled && input.riskFlags.taxOrSgkDebt) {
    addCritical('taxOrSgkDebt', c.taxOrSgkDebt)
  }

  if (w.weakIndicator.enabled) {
    const weak = Object.entries(input.indicatorScores)
      .filter(([, score]) => score !== null && score <= w.weakIndicator.maxScore)
      .map(([id]) => id)
    if (weak.length > 0) watch.push({ id: 'weakIndicator', label: w.weakIndicator.label, indicators: weak })
  }
  if (w.negativeTrend.enabled && input.annualGrowth <= w.negativeTrend.maxAnnualGrowth) {
    watch.push({ id: 'negativeTrend', label: w.negativeTrend.label })
  }
  if (w.scoreDivergence.enabled && input.traditionalScore - input.alternativeScore >= w.scoreDivergence.minGap) {
    watch.push({ id: 'scoreDivergence', label: w.scoreDivergence.label })
  }

  return { critical, watch }
}

export interface GradeOverrideResult {
  /** Override sonrası not. */
  grade: CreditGrade
  /** Skordan gelen not. */
  baseGrade: CreditGrade
  /** Override notu düşürdü mü. */
  capped: boolean
  /** Uygulanan en kısıtlayıcı tavan (kritik sinyal yoksa null). */
  cap: LendableGrade | null
}

/** Kritik sinyallerin en kısıtlayıcı tavanını nota uygular. */
export function applyEarlyWarningOverride(baseGrade: CreditGrade, critical: readonly CriticalSignal[]): GradeOverrideResult {
  let cap: LendableGrade | null = null
  for (const signal of critical) {
    if (cap === null || isWorseGrade(signal.gradeCap, cap)) cap = signal.gradeCap
  }
  const grade = cap === null ? baseGrade : capGrade(baseGrade, cap)
  return { grade, baseGrade, capped: grade !== baseGrade, cap }
}
