import type { CollateralTerms, CreditTerms, ProductAllocation } from '../engine/collateral'
import type { CreditGrade, ModelConfig, ProductMix } from '../engine/modelConfig'
import type { MarketIntel, RejectionReasonId } from '../data'

export type Role = 'tahsis' | 'portfoy' | 'model'

export interface ModelVersion {
  /** 'v1.0', 'v1.1' … */
  version: string
  createdAt: string
  author: string
  note: string
  config: ModelConfig
}

/** Karar anında sistemin görüşü (değişmez görüntü). */
export interface SystemView {
  traditionalScore: number
  alternativeScore: number
  score: number
  baseGrade: CreditGrade
  grade: CreditGrade
  pd: number
  limit: number
  terms: CreditTerms | null
  criticalSignals: string[]
  watchSignals: string[]
}

/** Onaylanan (veya revize edilen) nihai şartlar. */
export interface FinalTerms {
  limit: number
  collateral: CollateralTerms
  tenorMonths: number
  revolving: boolean
  referenceRate: string
  spreadBp: number
  productMix: ProductMix
  products: ProductAllocation[]
  covenants: string[]
}

export type DecisionStatus = 'approved' | 'revisedApproved' | 'rejected'

export interface Decision {
  firmId: string
  status: DecisionStatus
  modelVersion: string
  decidedBy: string
  decidedAt: string
  /** Kararın verildiği andaki verinin son ayı. */
  dataAsOf: string
  system: SystemView
  /** Redde null. */
  final: FinalTerms | null
  rejectionReason?: RejectionReasonId
  note: string
  /** Onaylı limitin kullandırılan oranı (0–1). Yeni kararlarda 0. */
  utilization: number
}

export interface AuditEntry {
  at: string
  by: string
  action: string
}

export interface AppState {
  versions: ModelVersion[]
  activeVersion: string
  lastChange: { at: string; by: string }
  /** Model Yöneticisi'nin kaydettiği, henüz sürüm olarak yayımlanmamış taslak. */
  modelDraft: ModelConfig | null
  /** Model denetim izi: sürüm oluşturma, etkinleştirme, içe aktarma. */
  modelLog: AuditEntry[]
  decisions: Record<string, Decision>
  audit: Record<string, AuditEntry[]>
  role: Role | null
  presentation: boolean
  /** Piyasa İstihbaratı (bilgi amaçlı; skoru etkilemez). Model Yöneticisi'nden düzenlenir. */
  marketIntel: MarketIntel
}
