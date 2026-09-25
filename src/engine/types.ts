/**
 * Motorun firma verisinden beklediği girdi tipleri. Demo verisi (/src/data)
 * bu sözleşmeye göre üretilir.
 */

import type { KkbCreditType, SeasonProfileId } from './modelConfig'

/**
 * Mizan satırı (Tekdüzen Hesap Planı). Dönem sonu bakiyesi borç veya alacak
 * sütununda tutulur; genellikle biri sıfırdır. Düzenleyici (−) hesaplar
 * (103, 257, 610 vb.) ters yönde bakiye verir ve eşlemede kendiliğinden düşülür.
 */
export interface TrialBalanceLine {
  /** Hesap kodu, ör. '100', '320', '780'. */
  code: string
  name: string
  debit: number
  credit: number
  /** Dönem içi borç hareket toplamı (bakiye dahil); motor kullanmaz, mizan çıktısı içindir. */
  debitTotal?: number
  /** Dönem içi alacak hareket toplamı (bakiye dahil). */
  creditTotal?: number
}

/** Kurumlar Vergisi Beyannamesi özeti. */
export interface TaxReturn {
  netSales: number
  /** Matrah; zarar durumunda negatif olabilir. */
  taxBase: number
  taxPaid: number
}

/** Mizanda doğrudan yer almayan finansal bilgiler. */
export interface FinancialSupplement {
  /** Dönem amortisman gideri (amortisman listesinden). FAVÖK için eklenir. */
  depreciation: number
  /**
   * Mevcut Yıllık Kredi Ödemeleri (K3 için): vadeli kredilerin önümüzdeki 12 ay
   * içindeki anapara taksitleri. Yenilenen rotatif KV krediler dahil edilmez;
   * faiz yükü FAVÖK'ten karşılanan finansman gideri olarak ayrıca izlenir.
   */
  annualDebtService: number
}

/** Kritik erken uyarı kayıtları (KKB / resmi kurum sorguları). */
export interface RiskFlags {
  bouncedCheque: boolean
  taxOrSgkDebt: boolean
}

/** Geleneksel analiz girdisi. */
export interface TraditionalInput {
  trialBalance: TrialBalanceLine[]
  taxReturn: TaxReturn
  supplement: FinancialSupplement
}

/**
 * Alternatif analiz girdisi. Tüm seriler aylıktır ve sonları `months` dizisinin
 * son ayına hizalıdır (dizinin son elemanı = son ay).
 */
export interface AlternativeInput {
  /** Artan sırada ardışık aylar, 'YYYY-MM'. */
  months: string[]
  /** Aylık ciro (TL), `months` ile aynı uzunlukta. */
  revenue: number[]
  /** Seri anahtarı → aylık değerler. Olmayan seri = eksik veri. */
  series: Partial<Record<string, number[]>>
  /** Sezon alt profili (turizmde 'summer' / 'winter'); yoksa sektör varsayılanı. */
  seasonProfile?: SeasonProfileId
}

/** KKB risk raporundaki tek bir kredi (bir bankadaki bir kredi türü). Aylık seriler `KkbReport.months` ile hizalıdır. */
export interface KkbFacility {
  /** Anonim banka adı ("Banka A" …). */
  bank: string
  type: KkbCreditType
  cashLimit: number[]
  cashRisk: number[]
  nonCashLimit: number[]
  nonCashRisk: number[]
  /** Ay içindeki en yüksek gecikme günü. */
  delayDays: number[]
  /** Yasal takibin başladığı ay ('YYYY-MM'); yoksa null. */
  legalFollowUpFrom: string | null
  /** Vadeli kredilerde son taksit ayı ('YYYY-MM'); diğerlerinde null. */
  maturity: string | null
}

/** KKB risk raporu (simülasyon). Firmanın diğer bankalardaki riskleri. */
export interface KkbReport {
  /** Artan sırada ardışık aylar, 'YYYY-MM'. */
  months: string[]
  /** Mizanın kapanış ayı (tutarlılık kontrolü için). */
  mizanMonth: string
  facilities: KkbFacility[]
  /** Aylık kredi sorgusu sayısı. */
  inquiries: number[]
  /** Aylık Findeks kredi notu (1–1900). */
  findeks: number[]
  /** Karşılıksız çek kayıtlarının ayları. */
  bouncedCheques: string[]
  /** Protestolu senet kayıtlarının ayları. */
  protestedBills: string[]
}
