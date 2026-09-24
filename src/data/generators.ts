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

/** TL → kuruş (tam sayı). Mizan kuruşu kuruşuna denk kurulur. */
const toKurus = (v: number) => Math.round(v * 100)

interface KLine {
  code: string
  name: string
  /** Bakiye, kuruş: pozitif = borç bakiye, negatif = alacak bakiye. */
  balance: number
  /** Dönem içi hareket (borç ve alacak toplamına eşit eklenir), kuruş. */
  turnover: number
}

/**
 * Net satıştan ve profil oranlarından denk bir mizan üretir. Tüm tutarlar
 * kuruş hassasiyetindedir; alt hesap bölüşümleri ve hareket toplamları firmaya
 * özgü tohumlu sapmalarla üretilir (`rand`, alternatif veri serilerinden
 * bağımsız bir üreteçtir). Geçmiş yıllar kâr/zararı (570/580) borç ve alacak
 * bakiye toplamlarını kuruşu kuruşuna eşitleyen kalemdir. Mizan kapanış
 * öncesidir (dönem kârı 590'a aktarılmamış).
 */
export function buildFinancials(
  netSalesInput: number,
  p: FinancialProfile,
  rand: () => number = createRng(1),
): { trialBalance: TrialBalanceLine[]; taxReturn: TaxReturn; supplement: FinancialSupplement } {
  /** Temel değer etrafında ±spread oranında sapma. */
  const j = (base: number, spread = 0.12) => base * (1 + spread * (rand() * 2 - 1))

  const ns = round(netSalesInput, 2)
  const grossSales = ns / (1 - p.returnRate)
  const returns = grossSales - ns
  const cogs = ns * p.cogsRatio
  const opex = ns * p.opexRatio
  const financeExpense = ns * p.financeExpenseRatio
  const preTax = ns - cogs - opex - financeExpense
  const tax = Math.max(0, preTax) * 0.25

  const cash = ns * p.cashRatio
  const receivables = (ns * p.receivableDays) / 365
  const inventory = (cogs * p.inventoryDays) / 365
  const payables = (cogs * p.payableDays) / 365
  const otherCurrent = ns * p.otherCurrentRatio
  const fixedNet = ns * p.fixedAssetRatio
  const fixedGross = fixedNet / (1 - j(0.35, 0.2))
  const stLoans = ns * p.shortTermLoanRatio
  const ltLoans = ns * p.longTermLoanRatio
  const overdue = p.overdueTaxLiability ?? 0
  const otherLiab = ns * p.otherLiabilityRatio
  const exportShare = p.exportShare ?? 0

  const lines: KLine[] = []
  /** Borç bakiyeli hesap. */
  const dr = (code: string, name: string, amount: number, turnover: number) =>
    lines.push({ code, name, balance: toKurus(amount), turnover: toKurus(Math.abs(turnover)) })
  /** Alacak bakiyeli hesap. */
  const cr = (code: string, name: string, amount: number, turnover: number) =>
    lines.push({ code, name, balance: -toKurus(amount), turnover: toKurus(Math.abs(turnover)) })

  // 10 Hazır Değerler: 100 + 101 + 102 − 103 = hazır değerler
  const kasa = cash * j(0.06, 0.4)
  const alinanCek = cash * j(0.1, 0.4)
  const verilenCek = cash * j(0.05, 0.5)
  dr('100', 'Kasa', kasa, j(ns * 0.12, 0.3))
  dr('101', 'Alınan Çekler', alinanCek, j(ns * 0.08, 0.3))
  dr('102', 'Bankalar', cash - kasa - alinanCek + verilenCek, j(ns * 1.05, 0.1))
  cr('103', 'Verilen Çekler ve Ödeme Emirleri (−)', verilenCek, j(ns * 0.15, 0.3))

  // 12 Ticari Alacaklar
  const depozito = receivables * j(0.02, 0.5)
  const alicilar = (receivables - depozito) * j(0.74, 0.08)
  dr('120', 'Alıcılar', alicilar, j(ns * 1.18, 0.05))
  dr('121', 'Alacak Senetleri', receivables - depozito - alicilar, j(ns * 0.25, 0.3))
  dr('126', 'Verilen Depozito ve Teminatlar', depozito, depozito * j(0.3, 0.5))

  // 13 / 18 / 19 Diğer dönen varlıklar
  const digerAlacak = otherCurrent * j(0.25, 0.3)
  const gelecekAy = otherCurrent * j(0.15, 0.3)
  const indirilecekKdv = otherCurrent * j(0.35, 0.2)
  dr('136', 'Diğer Çeşitli Alacaklar', digerAlacak, digerAlacak * j(1.5, 0.4))

  // 15 Stoklar
  if (p.service) {
    dr('150', 'İlk Madde ve Malzeme', inventory, j(cogs * 0.12, 0.2))
  } else {
    const siparisAvansi = inventory * j(0.08, 0.5)
    dr('153', 'Ticari Mallar', inventory - siparisAvansi, j(cogs, 0.05))
    dr('159', 'Verilen Sipariş Avansları', siparisAvansi, siparisAvansi * j(2, 0.4))
  }
  dr('180', 'Gelecek Aylara Ait Giderler', gelecekAy, gelecekAy * j(1.2, 0.3))
  dr('190', 'Devreden KDV', otherCurrent - digerAlacak - gelecekAy - indirilecekKdv, j(cogs * 0.03, 0.4))
  dr('191', 'İndirilecek KDV', indirilecekKdv, j(cogs * 0.18, 0.1))

  // 25 Maddi Duran Varlıklar
  const tesis = fixedGross * j(0.3, 0.3)
  const tasit = fixedGross * j(0.35, 0.3)
  dr('253', 'Tesis, Makine ve Cihazlar', tesis, tesis * j(0.08, 0.5))
  dr('254', 'Taşıtlar', tasit, tasit * j(0.1, 0.5))
  dr('255', 'Demirbaşlar', fixedGross - tesis - tasit, (fixedGross - tesis - tasit) * j(0.12, 0.5))
  cr('257', 'Birikmiş Amortismanlar (−)', fixedGross - fixedNet, (fixedGross - fixedNet) * j(0.1, 0.5))

  // 30 Mali Borçlar
  const ltTaksit = ltLoans > 0 ? stLoans * j(0.2, 0.3) : 0
  cr('300', 'Banka Kredileri', stLoans - ltTaksit, (stLoans - ltTaksit) * j(1.6, 0.2))
  if (ltTaksit > 0) cr('303', 'Uzun Vadeli Kredilerin Anapara Taksitleri ve Faizleri', ltTaksit, ltTaksit * j(1, 0.2))

  // 32 Ticari Borçlar
  const saticilar = payables * j(0.82, 0.08)
  cr('320', 'Satıcılar', saticilar, j(cogs * 1.18, 0.05))
  cr('321', 'Borç Senetleri', payables - saticilar, (payables - saticilar) * j(2.5, 0.3))

  // 33–38 Diğer kısa vadeli yükümlülükler
  const avans = p.service ? otherLiab * j(0.35, 0.2) : 0
  const personel = (otherLiab - avans) * j(0.3, 0.2)
  const vergi = (otherLiab - avans) * j(0.3, 0.2)
  const sgk = (otherLiab - avans) * j(0.2, 0.2)
  cr('335', 'Personele Borçlar', personel, j(opex * 0.3, 0.2))
  if (avans > 0) cr('340', 'Alınan Sipariş Avansları', avans, avans * j(4, 0.3))
  cr('360', 'Ödenecek Vergi ve Fonlar', vergi, j(ns * 0.05, 0.3))
  cr('361', 'Ödenecek Sosyal Güvenlik Kesintileri', sgk, j(opex * 0.12, 0.2))
  if (overdue > 0) {
    cr('368', 'Vadesi Geçmiş, Ertelenmiş veya Taksitlendirilmiş Vergi ve Diğer Yükümlülükler', j(overdue, 0.03), overdue * j(0.2, 0.5))
  }
  cr('381', 'Gider Tahakkukları', otherLiab - avans - personel - vergi - sgk, (otherLiab - avans - personel - vergi - sgk) * j(2, 0.3))

  // 40 Uzun vadeli mali borçlar
  if (ltLoans > 0) cr('400', 'Banka Kredileri', ltLoans, ltLoans * j(0.3, 0.3))

  // 50–54 Özkaynaklar (57/58 denkleştirme kalemi aşağıda)
  cr('500', 'Sermaye', p.capital, 0)
  cr('540', 'Yasal Yedekler', p.capital * j(0.07, 0.4), 0)

  // 6 Gelir tablosu hesapları (kapanış öncesi)
  const iskonto = returns * j(0.2, 0.4)
  cr('600', 'Yurtiçi Satışlar', grossSales * (1 - exportShare), 0)
  if (exportShare > 0) cr('601', 'Yurtdışı Satışlar', grossSales * exportShare, 0)
  dr('610', 'Satıştan İadeler (−)', returns - iskonto, 0)
  dr('611', 'Satış İskontoları (−)', iskonto, 0)
  if (p.service) dr('622', 'Satılan Hizmet Maliyeti (−)', cogs, 0)
  else dr('621', 'Satılan Ticari Mallar Maliyeti (−)', cogs, 0)
  const pazarlama = opex * j(0.55, 0.1)
  dr('631', 'Pazarlama Satış ve Dağıtım Giderleri (−)', pazarlama, 0)
  dr('632', 'Genel Yönetim Giderleri (−)', opex - pazarlama, 0)
  if (tax > 0) dr('691', 'Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)', tax, 0)
  dr('780', 'Finansman Giderleri', financeExpense, 0)

  // Denkleştirme: borç ve alacak bakiye toplamları kuruşu kuruşuna eşit
  const net = lines.reduce((a, l) => a + l.balance, 0)
  const plug: KLine =
    net >= 0
      ? { code: '570', name: 'Geçmiş Yıllar Kârları', balance: -net, turnover: 0 }
      : { code: '580', name: 'Geçmiş Yıllar Zararları (−)', balance: -net, turnover: 0 }
  const at = lines.findIndex((l) => l.code === '600')
  lines.splice(at, 0, plug)

  const trialBalance: TrialBalanceLine[] = lines.map((l) => {
    const debit = l.balance > 0 ? l.balance / 100 : 0
    const credit = l.balance < 0 ? -l.balance / 100 : 0
    return {
      code: l.code,
      name: l.name,
      debit,
      credit,
      debitTotal: (Math.max(l.balance, 0) + l.turnover) / 100,
      creditTotal: (Math.max(-l.balance, 0) + l.turnover) / 100,
    }
  })

  const kvbSales = round(ns * (1 - p.kvbSalesGap), 2)
  return {
    trialBalance,
    taxReturn: { netSales: kvbSales, taxBase: round(preTax, 2), taxPaid: round(tax, 2) },
    supplement: { depreciation: round(j(ns * p.depreciationRatio, 0.01), 2), annualDebtService: round(j(ns * p.debtServiceRatio, 0.01), 2) },
  }
}
