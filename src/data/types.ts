import type { FirmInput } from '../engine/evaluate'
import type { KkbReport } from '../engine/types'
import type { CollateralTypeId, ProductMix } from '../engine/modelConfig'

/** İşletme ölçeği: KOBİ tanımındaki çalışan sayısı sınıfları ve holding (büyük kurumsal grup). */
export type FirmSegment = 'micro' | 'small' | 'medium' | 'large' | 'holding'

export const SEGMENT_LABELS: Record<FirmSegment, string> = {
  micro: 'Mikro işletme',
  small: 'Küçük işletme',
  medium: 'Orta büyüklükte işletme',
  large: 'Büyük işletme',
  holding: 'Holding',
}

/** Hayali firma kaydı: künye + motor girdileri. */
export interface Firm extends FirmInput {
  id: string
  name: string
  /** Hayali vergi kimlik numarası (10 hane). */
  vkn: string
  city: string
  foundedYear: number
  employees: number
  segment: FirmSegment
  /** Holdinglerde konsolide edilen grup şirketi sayısı. */
  groupCompanies?: number
  /** Mizan ve KVB'nin ait olduğu mali yıl. */
  fiscalYear: number
  /** Talep edilen kredi tutarı (TL). */
  requestedAmount: number
  /** Başvuru tarihi (ISO, YYYY-MM-DD). */
  applicationDate: string
  /** KKB risk raporu (simülasyon verisi). */
  kkb: KkbReport
}

export type DecisionStatus = 'approved' | 'revisedApproved' | 'rejected'

/** Revize kararında tahsis yöneticisinin değiştirdiği şartlar. */
export interface RevisedTerms {
  limit: number
  collateralRatio: number
  collateralType: CollateralTypeId
  tenorMonths: number
  productMix: ProductMix
  covenants: string[]
}

export interface AuditEntry {
  at: string
  by: string
  action: string
}

/** Başlangıçta karara bağlanmış başvurular. Sistem görüşü, kararın verildiği andaki veriyle motor tarafından hesaplanır. */
export interface SeedDecision {
  firmId: string
  status: DecisionStatus
  /** Kararın verildiği model sürümü. */
  modelVersion: string
  decidedBy: string
  /** ISO tarih-saat */
  decidedAt: string
  /** Kararın verildiği andaki alternatif verinin son ayı ('YYYY-MM'). */
  dataAsOf: string
  /** Yalnızca revize onayda. */
  revisedTerms?: RevisedTerms
  /** Yalnızca redde: red gerekçesi kodu. */
  rejectionReason?: string
  /** Tahsisçinin gerekçe notu. */
  note: string
  /** Onaylı limitin bugün kullandırılan oranı (0–1); red kararında yok. */
  utilizationRate?: number
  auditLog: AuditEntry[]
}
