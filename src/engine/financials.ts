/**
 * Mizan → finansal tablo → oranlar.
 *
 * Hesap kodu aralıkları Tekdüzen Hesap Planı'nın tanımıdır (model parametresi
 * değildir). Varlık ve gider hesapları borç − alacak, kaynak ve gelir hesapları
 * alacak − borç yönünde toplanır; böylece düzenleyici (−) hesaplar
 * (103 Verilen Çekler, 257 Birikmiş Amortismanlar, 610 Satıştan İadeler vb.)
 * kendiliğinden düşülür.
 */

import { positiveBaseRatio } from './math'
import type { FinancialSupplement, TaxReturn, TrialBalanceLine } from './types'

type CodeRange = readonly [number, number]
type Side = 'debit' | 'credit'

interface AccountGroup {
  ranges: readonly CodeRange[]
  side: Side
}

export const ACCOUNT_GROUPS = {
  /** 10 Hazır Değerler + 11 Menkul Kıymetler */
  cashAndEquivalents: { ranges: [[100, 119]], side: 'debit' },
  /** 12 Ticari Alacaklar */
  tradeReceivables: { ranges: [[120, 129]], side: 'debit' },
  /** 15 Stoklar */
  inventories: { ranges: [[150, 159]], side: 'debit' },
  /** 1 Dönen Varlıklar */
  currentAssets: { ranges: [[100, 199]], side: 'debit' },
  /** 2 Duran Varlıklar */
  nonCurrentAssets: { ranges: [[200, 299]], side: 'debit' },
  /** 3 Kısa Vadeli Yabancı Kaynaklar */
  shortTermLiabilities: { ranges: [[300, 399]], side: 'credit' },
  /** 32 Ticari Borçlar */
  tradePayables: { ranges: [[320, 329]], side: 'credit' },
  /** 4 Uzun Vadeli Yabancı Kaynaklar */
  longTermLiabilities: { ranges: [[400, 499]], side: 'credit' },
  /** 30 + 40 Mali Borçlar */
  financialDebt: { ranges: [[300, 309], [400, 409]], side: 'credit' },
  /** 5 Özkaynaklar */
  equity: { ranges: [[500, 599]], side: 'credit' },
  /** 59 Dönem Net Kârı (Zararı) — 590 / 591 */
  currentPeriodResult: { ranges: [[590, 591]], side: 'credit' },
  /** 60 Brüt Satışlar − 61 Satış İndirimleri */
  netSales: { ranges: [[600, 612]], side: 'credit' },
  /** 62 Satışların Maliyeti */
  costOfSales: { ranges: [[620, 623]], side: 'debit' },
  /** 63 Faaliyet Giderleri */
  operatingExpenses: { ranges: [[630, 632]], side: 'debit' },
  /** 64 Diğer Faaliyetlerden Olağan Gelir ve Kârlar */
  otherOperatingIncome: { ranges: [[640, 649]], side: 'credit' },
  /** 65 Diğer Faaliyetlerden Olağan Gider ve Zararlar */
  otherOperatingExpense: { ranges: [[650, 659]], side: 'debit' },
  /** 66 Finansman Giderleri ve 780 Finansman Giderleri (7/A) */
  financeExpense: { ranges: [[660, 661], [780, 780]], side: 'debit' },
  /** 67 Olağandışı Gelir ve Kârlar */
  extraordinaryIncome: { ranges: [[670, 679]], side: 'credit' },
  /** 68 Olağandışı Gider ve Zararlar */
  extraordinaryExpense: { ranges: [[680, 689]], side: 'debit' },
  /** 691 Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları */
  taxProvision: { ranges: [[691, 691]], side: 'debit' },
} as const satisfies Record<string, AccountGroup>

export type AccountGroupId = keyof typeof ACCOUNT_GROUPS

function inGroup(line: TrialBalanceLine, group: AccountGroup): boolean {
  const code = Number.parseInt(line.code.slice(0, 3), 10)
  return group.ranges.some(([lo, hi]) => code >= lo && code <= hi)
}

/** Bir hesap grubunun mizandaki doğal yönlü toplam bakiyesi. */
export function sumAccountGroup(trialBalance: readonly TrialBalanceLine[], group: AccountGroup): number {
  let total = 0
  for (const line of trialBalance) {
    if (!inGroup(line, group)) continue
    total += group.side === 'debit' ? line.debit - line.credit : line.credit - line.debit
  }
  return total
}

export interface FinancialStatement {
  cashAndEquivalents: number
  tradeReceivables: number
  inventories: number
  currentAssets: number
  nonCurrentAssets: number
  totalAssets: number
  shortTermLiabilities: number
  longTermLiabilities: number
  totalLiabilities: number
  tradePayables: number
  financialDebt: number
  netFinancialDebt: number
  /** Dönem net kârı dahil özkaynak. */
  equity: number
  netSales: number
  costOfSales: number
  operatingExpenses: number
  depreciation: number
  /** FAVÖK = Net Satışlar − SMM − Faaliyet Giderleri + Amortisman */
  ebitda: number
  financeExpense: number
  netProfit: number
  annualDebtService: number
}

export function deriveFinancialStatement(
  trialBalance: readonly TrialBalanceLine[],
  supplement: FinancialSupplement,
): FinancialStatement {
  const g = (id: AccountGroupId) => sumAccountGroup(trialBalance, ACCOUNT_GROUPS[id])

  const cashAndEquivalents = g('cashAndEquivalents')
  const currentAssets = g('currentAssets')
  const nonCurrentAssets = g('nonCurrentAssets')
  const shortTermLiabilities = g('shortTermLiabilities')
  const longTermLiabilities = g('longTermLiabilities')
  const financialDebt = g('financialDebt')

  const netSales = g('netSales')
  const costOfSales = g('costOfSales')
  const operatingExpenses = g('operatingExpenses')
  const financeExpense = g('financeExpense')
  const operatingProfit = netSales - costOfSales - operatingExpenses
  const netProfit =
    operatingProfit +
    g('otherOperatingIncome') -
    g('otherOperatingExpense') -
    financeExpense +
    g('extraordinaryIncome') -
    g('extraordinaryExpense') -
    g('taxProvision')

  // Kapanış öncesi mizanda dönem kârı henüz 590/591'e aktarılmamıştır.
  const hasClosedResult = trialBalance.some((l) => inGroup(l, ACCOUNT_GROUPS.currentPeriodResult))
  const equity = g('equity') + (hasClosedResult ? 0 : netProfit)

  return {
    cashAndEquivalents,
    tradeReceivables: g('tradeReceivables'),
    inventories: g('inventories'),
    currentAssets,
    nonCurrentAssets,
    totalAssets: currentAssets + nonCurrentAssets,
    shortTermLiabilities,
    longTermLiabilities,
    totalLiabilities: shortTermLiabilities + longTermLiabilities,
    tradePayables: g('tradePayables'),
    financialDebt,
    netFinancialDebt: financialDebt - cashAndEquivalents,
    equity,
    netSales,
    costOfSales,
    operatingExpenses,
    depreciation: supplement.depreciation,
    ebitda: operatingProfit + supplement.depreciation,
    financeExpense,
    netProfit,
    annualDebtService: supplement.annualDebtService,
  }
}

export interface FinancialRatios {
  currentRatio: number
  acidTestRatio: number
  debtToEquity: number
  netDebtToEbitda: number
  ebitdaMargin: number
  netProfitMargin: number
  returnOnAssets: number
  receivableDays: number
  inventoryDays: number
  payableDays: number
  /** Nakit Dönüşüm Süresi (gün) = Alacak Devir Günü + Stok Devir Günü − Borç Devir Günü */
  cashConversionCycle: number
  interestCoverage: number
  /** |Mizan Net Satış − KVB Net Satış| / KVB Net Satış */
  salesDeviation: number
}

/** Bakiyenin yıllık akışa göre gün karşılığı; akış sıfır/negatifse 0. */
function turnoverDays(balance: number, annualFlow: number, daysInYear: number): number {
  return annualFlow > 0 ? (balance / annualFlow) * daysInYear : 0
}

export function computeRatios(
  s: FinancialStatement,
  taxReturn: TaxReturn,
  daysInYear: number,
): FinancialRatios {
  const receivableDays = turnoverDays(s.tradeReceivables, s.netSales, daysInYear)
  const inventoryDays = turnoverDays(s.inventories, s.costOfSales, daysInYear)
  const payableDays = turnoverDays(s.tradePayables, s.costOfSales, daysInYear)

  return {
    currentRatio: positiveBaseRatio(s.currentAssets, s.shortTermLiabilities),
    acidTestRatio: positiveBaseRatio(s.currentAssets - s.inventories, s.shortTermLiabilities),
    debtToEquity: positiveBaseRatio(s.totalLiabilities, s.equity),
    netDebtToEbitda: positiveBaseRatio(s.netFinancialDebt, s.ebitda),
    ebitdaMargin: positiveBaseRatio(s.ebitda, s.netSales),
    netProfitMargin: positiveBaseRatio(s.netProfit, s.netSales),
    returnOnAssets: positiveBaseRatio(s.netProfit, s.totalAssets),
    receivableDays,
    inventoryDays,
    payableDays,
    cashConversionCycle: receivableDays + inventoryDays - payableDays,
    interestCoverage: positiveBaseRatio(s.ebitda, s.financeExpense),
    salesDeviation: positiveBaseRatio(Math.abs(s.netSales - taxReturn.netSales), taxReturn.netSales),
  }
}
