/**
 * Etki simülasyonu: iki konfigürasyon arasında firma bazında skor, not, limit
 * ve PD değişimi; nihai skorun bileşenlere ayrıştırılması (şelale grafiği).
 */

import { evaluateFirm, type FirmEvaluation, type FirmInput } from './evaluate'
import { TRADITIONAL_CATEGORY_IDS, type CreditGrade, type ModelConfig } from './modelConfig'
import { gradeRank } from './rating'

export interface ImpactSide {
  score: number
  grade: CreditGrade
  limit: number
  pd: number
}

export interface FirmImpact {
  firmId: string
  before: ImpactSide
  after: ImpactSide
  scoreChange: number
  /** Pozitif = not yükseldi (iyileşti), negatif = düştü. */
  gradeSteps: number
  /** Limit göreli değişimi; eski limit 0 ise yeni limit > 0 → ∞. */
  limitChange: number
}

export interface ImpactSummary {
  upgraded: number
  downgraded: number
  unchanged: number
  totalLimitBefore: number
  totalLimitAfter: number
  avgPdBefore: number
  avgPdAfter: number
}

function side(e: FirmEvaluation): ImpactSide {
  return { score: e.score, grade: e.grade, limit: e.limit.limit, pd: e.pd }
}

export function firmImpact(firmId: string, before: FirmEvaluation, after: FirmEvaluation): FirmImpact {
  const b = side(before)
  const a = side(after)
  return {
    firmId,
    before: b,
    after: a,
    scoreChange: a.score - b.score,
    gradeSteps: gradeRank(b.grade) - gradeRank(a.grade),
    limitChange: b.limit > 0 ? a.limit / b.limit - 1 : a.limit > 0 ? Infinity : 0,
  }
}

export function computeImpact<F extends FirmInput & { id: string }>(
  firms: readonly F[],
  before: ModelConfig,
  after: ModelConfig,
): { firms: FirmImpact[]; summary: ImpactSummary } {
  const rows = firms.map((f) => firmImpact(f.id, evaluateFirm(f, before), evaluateFirm(f, after)))
  return { firms: rows, summary: summarizeImpact(rows) }
}

export function summarizeImpact(rows: readonly FirmImpact[]): ImpactSummary {
  const n = rows.length || 1
  return {
    upgraded: rows.filter((r) => r.gradeSteps > 0).length,
    downgraded: rows.filter((r) => r.gradeSteps < 0).length,
    unchanged: rows.filter((r) => r.gradeSteps === 0).length,
    totalLimitBefore: rows.reduce((a, r) => a + r.before.limit, 0),
    totalLimitAfter: rows.reduce((a, r) => a + r.after.limit, 0),
    avgPdBefore: rows.reduce((a, r) => a + r.before.pd, 0) / n,
    avgPdAfter: rows.reduce((a, r) => a + r.after.pd, 0) / n,
  }
}

export interface ScoreComponent {
  id: string
  label: string
  /** Nihai skora katkı (puan). Bileşenlerin toplamı S'ye eşittir. */
  value: number
}

/**
 * S'yi toplamsal bileşenlere ayırır:
 * S = Σ_c w_G·w_c·G_c + w_A·k·(w_SP·SP + w_SU·SU + w_TR·TR) + w_A·(1 − k)·Nötr
 * (k = kapsama düzeltmesi açıksa c, kapalıysa 1).
 */
export function scoreComponents(ev: FirmEvaluation, config: ModelConfig): ScoreComponent[] {
  const { traditional: wG, alternative: wA } = config.final.weights
  const alt = ev.alternative
  const k = config.alternative.coverage.enabled ? alt.coverage : 1
  const w = config.alternative.weights
  const parts: ScoreComponent[] = TRADITIONAL_CATEGORY_IDS.map((id) => {
    const c = ev.traditional.categories[id]
    return { id, label: c.label, value: wG * c.weight * c.score }
  })
  parts.push(
    { id: 'sp', label: 'Sektörel performans', value: wA * k * w.sp * alt.sp },
    { id: 'su', label: 'Sezon uyumu', value: wA * k * w.su * alt.su },
    { id: 'tr', label: 'Arındırılmış trend', value: wA * k * w.tr * alt.tr },
    { id: 'coverage', label: 'Veri kapsama düzeltmesi', value: wA * (1 - k) * config.alternative.coverage.neutralScore },
  )
  return parts
}

export interface WaterfallStep {
  id: string
  label: string
  delta: number
}

/** Tek firma için eski → yeni skor değişiminin bileşen bazında ayrıştırılması. */
export function scoreWaterfall(
  firm: FirmInput,
  before: ModelConfig,
  after: ModelConfig,
): { before: number; after: number; steps: WaterfallStep[] } {
  const eb = evaluateFirm(firm, before)
  const ea = evaluateFirm(firm, after)
  const cb = scoreComponents(eb, before)
  const ca = scoreComponents(ea, after)
  return {
    before: eb.score,
    after: ea.score,
    steps: ca.map((c, i) => ({ id: c.id, label: c.label, delta: c.value - cb[i].value })),
  }
}
