/**
 * Demo verisi üreteçleri. Tüm seriler tohumlu (deterministik) rastgele sayı
 * üreteciyle üretilir; her çalıştırmada aynı veri çıkar.
 */

import { DEFAULT_MODEL_CONFIG, type SeasonProfileId, type SectorId } from '../engine/modelConfig'
import type { FinancialSupplement, TaxReturn, TrialBalanceLine } from '../engine/types'

/** Eylül 2024 – Ağustos 2026 (24 ay). */
export const DATA_MONTHS: string[] = (() => {
  const months: string[] = []
  for (let i = 0; i < 24; i++) {
    const year = 2024 + Math.floor((8 + i) / 12)
    const month = ((8 + i) % 12) + 1
    months.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return months
})()

export const FISCAL_YEAR = 2025

/** mulberry32 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function round(value: number, digits = 0): number {
  if (digits < 0) {
    const unit = 10 ** -digits
    return Math.round(value / unit) * unit
  }
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Sektörün tipik aylık sezon deseni (Ocak → Aralık). */
export function sectorPattern(sectorId: SectorId, profile?: SeasonProfileId): number[] {
  const { seasonality } = DEFAULT_MODEL_CONFIG.sectors[sectorId]
  const profiles = seasonality.profiles as Partial<Record<SeasonProfileId, { index: number[] }>>
  return [...(profiles[profile ?? (seasonality.defaultProfile as SeasonProfileId)]!.index)]
}

/** Parçalı doğrusal seviye fonksiyonu: [[t, değer], ...]. */
export function path(...points: [number, number][]): (t: number) => number {
  return (t) => {
    if (t <= points[0][0]) return points[0][1]
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i]
      const [t0, v0] = points[i - 1]
      if (t <= t1) return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0)
    }
    return points[points.length - 1][1]
  }
}

/** Sabit yıllık büyümeli seviye: base × (1 + g)^(t/12). */
export function growth(base: number, annualGrowth: number): (t: number) => number {
  return (t) => base * (1 + annualGrowth) ** (t / 12)
}

interface SeriesOptions {
  noise?: number
  digits?: number
  /** Ocak → Aralık sezon deseni; verilmezse sezonsuz. */
  pattern?: number[]
}

/** Seviye × sezon × (1 ± gürültü) serisi. */
export function series(
  rand: () => number,
  level: (t: number) => number,
  { noise = 0, digits = 0, pattern }: SeriesOptions = {},
): number[] {
  return DATA_MONTHS.map((m, t) => {
    const season = pattern ? pattern[Number(m.slice(5, 7)) - 1] : 1
    const jitter = 1 + noise * (rand() * 2 - 1)
    return round(level(t) * season * jitter, digits)
  })
}

/** Mali yıl aylarının toplamı. */
export function fiscalYearTotal(values: number[], year = FISCAL_YEAR): number {
  return DATA_MONTHS.reduce((acc, m, i) => (m.startsWith(`${year}-`) ? acc + values[i] : acc), 0)
}

// ---------------------------------------------------------------------------
// Mizan üreteci
// ---------------------------------------------------------------------------

export interface FinancialProfile {
  /** Satış iadelerinin brüt satışa oranı. */
  returnRate: number
  /** SMM / net satış */
  cogsRatio: number
  /** Faaliyet giderleri / net satış (amortisman dahil). */
  opexRatio: number
  /** Amortisman / net satış */
  depreciationRatio: number
  /** Finansman giderleri / net satış */
  financeExpenseRatio: number
  receivableDays: number
  /** SMM'ye göre */
  inventoryDays: number
  /** SMM'ye göre */
  payableDays: number
  /** Hazır değerler / net satış */
  cashRatio: number
  /** Diğer dönen varlıklar / net satış */
  otherCurrentRatio: number
  /** Net maddi duran varlık / net satış */
  fixedAssetRatio: number
  /** KV banka kredileri / net satış */
  shortTermLoanRatio: number
  /** UV banka kredileri / net satış */
  longTermLoanRatio: number
  /** Diğer KV yükümlülükler / net satış */
  otherLiabilityRatio: number
  /** Ödenmiş sermaye (TL) */
  capital: number
  /** Mevcut yıllık kredi ödemeleri / net satış */
  debtServiceRatio: number
  /** KVB net satışının mizandan göreli farkı (KVB = mizan × (1 − fark)). */
  kvbSalesGap: number
  /** Vadesi geçmiş vergi/SGK yükümlülüğü (368 hesabı), TL */
  overdueTaxLiability?: number
  /** Yurtdışı satış payı (601) */
  exportShare?: number
  /** Hizmet işletmesi: SMM 622, stok 150 İlk Madde ve Malzeme */
  service?: boolean
}

const line = (code: string, name: string, debit: number, credit = 0): TrialBalanceLine => ({
  code,
  name,
  debit: round(debit),
  credit: round(credit),
})

/**
 * Net satıştan ve profil oranlarından denk bir mizan üretir. Geçmiş yıllar
 * kâr/zararı (570/580) bilanço denkliğini sağlayan kalemdir. Mizan kapanış
 * öncesidir (dönem kârı 590'a aktarılmamış).
 */
export function buildFinancials(
  netSalesInput: number,
  p: FinancialProfile,
): { trialBalance: TrialBalanceLine[]; taxReturn: TaxReturn; supplement: FinancialSupplement } {
  const ns = round(netSalesInput)
  const grossSales = ns / (1 - p.returnRate)
  const returns = grossSales - ns
  const cogs = ns * p.cogsRatio
  const opex = ns * p.opexRatio
  const financeExpense = ns * p.financeExpenseRatio
  const preTax = ns - cogs - opex - financeExpense
  const tax = Math.max(0, preTax) * 0.25
  const netProfit = preTax - tax

  const cash = ns * p.cashRatio
  const receivables = (ns * p.receivableDays) / 365
  const inventory = (cogs * p.inventoryDays) / 365
  const payables = (cogs * p.payableDays) / 365
  const otherCurrent = ns * p.otherCurrentRatio
  const fixedNet = ns * p.fixedAssetRatio
  const fixedGross = fixedNet / 0.65
  const stLoans = ns * p.shortTermLoanRatio
  const ltLoans = ns * p.longTermLoanRatio
  const overdue = p.overdueTaxLiability ?? 0
  const otherLiab = ns * p.otherLiabilityRatio

  const totalAssets = cash + receivables + inventory + otherCurrent + fixedNet
  const totalLiabilities = stLoans + payables + otherLiab + overdue + ltLoans
  const equityBeforeProfit = totalAssets - totalLiabilities - netProfit
  const retained = equityBeforeProfit - p.capital

  const exportShare = p.exportShare ?? 0
  const lines: TrialBalanceLine[] = [
    line('100', 'Kasa', cash * 0.08),
    line('102', 'Bankalar', cash * 0.92),
    line('120', 'Alıcılar', receivables * 0.75),
    line('121', 'Alacak Senetleri', receivables * 0.25),
    line('136', 'Diğer Çeşitli Alacaklar', otherCurrent * 0.4),
    p.service
      ? line('150', 'İlk Madde ve Malzeme', inventory)
      : line('153', 'Ticari Mallar', inventory),
    line('191', 'İndirilecek KDV', otherCurrent * 0.6),
    line('254', 'Taşıtlar', fixedGross * 0.45),
    line('255', 'Demirbaşlar', fixedGross * 0.55),
    line('257', 'Birikmiş Amortismanlar (−)', 0, fixedGross - fixedNet),
    line('300', 'Banka Kredileri', 0, stLoans),
    line('320', 'Satıcılar', 0, payables * 0.8),
    line('321', 'Borç Senetleri', 0, payables * 0.2),
    line('335', 'Personele Borçlar', 0, otherLiab * 0.35),
    line('360', 'Ödenecek Vergi ve Fonlar', 0, otherLiab * 0.4),
    line('361', 'Ödenecek Sosyal Güvenlik Kesintileri', 0, otherLiab * 0.25),
  ]
  if (overdue > 0) {
    lines.push(line('368', 'Vadesi Geçmiş, Ertelenmiş veya Taksitlendirilmiş Vergi ve Diğer Yükümlülükler', 0, overdue))
  }
  if (ltLoans > 0) lines.push(line('400', 'Banka Kredileri', 0, ltLoans))
  lines.push(line('500', 'Sermaye', 0, p.capital))
  lines.push(
    retained >= 0
      ? line('570', 'Geçmiş Yıllar Kârları', 0, retained)
      : line('580', 'Geçmiş Yıllar Zararları (−)', -retained),
  )
  lines.push(line('600', 'Yurtiçi Satışlar', 0, grossSales * (1 - exportShare)))
  if (exportShare > 0) lines.push(line('601', 'Yurtdışı Satışlar', 0, grossSales * exportShare))
  lines.push(line('610', 'Satıştan İadeler (−)', returns))
  lines.push(
    p.service
      ? line('622', 'Satılan Hizmet Maliyeti (−)', cogs)
      : line('621', 'Satılan Ticari Mallar Maliyeti (−)', cogs),
  )
  lines.push(line('631', 'Pazarlama Satış ve Dağıtım Giderleri (−)', opex * 0.55))
  lines.push(line('632', 'Genel Yönetim Giderleri (−)', opex * 0.45))
  lines.push(line('780', 'Finansman Giderleri', financeExpense))
  if (tax > 0) lines.push(line('691', 'Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)', tax))

  const kvbSales = round(ns * (1 - p.kvbSalesGap))
  return {
    trialBalance: lines,
    taxReturn: { netSales: kvbSales, taxBase: round(preTax), taxPaid: round(tax) },
    supplement: { depreciation: round(ns * p.depreciationRatio), annualDebtService: round(ns * p.debtServiceRatio) },
  }
}
