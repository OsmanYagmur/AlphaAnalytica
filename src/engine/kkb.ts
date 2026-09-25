/**
 * KKB risk raporu: belirli bir aydaki anlık görüntü, KKB kaynaklı erken uyarı
 * sinyalleri, K1'den düşülecek diğer banka işletme sermayesi riski ve K3 için
 * vadeli kredilerin önümüzdeki 12 aydaki anapara ödemeleri.
 *
 * Tüm eşikler ve sınıflandırmalar modelConfig.kkb'den okunur.
 */

import { MONTHS_PER_YEAR } from './math'
import type { KkbCreditType, KkbSignalId, LendableGrade, ModelConfig } from './modelConfig'
import type { KkbFacility, KkbReport } from './types'

export type KkbFollowUp = 'none' | 'legal'

export interface KkbBankRow {
  bank: string
  types: KkbCreditType[]
  cashLimit: number
  cashRisk: number
  nonCashLimit: number
  nonCashRisk: number
  /** Son 12 aydaki en yüksek gecikme günü. */
  maxDelayDays12m: number
  followUp: KkbFollowUp
}

export interface KkbSnapshot {
  asOf: string
  banks: KkbBankRow[]
  totalCashLimit: number
  totalCashRisk: number
  totalNonCashLimit: number
  totalNonCashRisk: number
  totalLimit: number
  totalRisk: number
  /** Doluluk = toplam risk / toplam limit (limit yoksa 0). */
  utilization: number
  /** Son `overdue.windowMonths` aydaki en yüksek gecikme günü. */
  maxDelayDays: number
  legalFollowUp: boolean
  /** Son `inquiries.windowMonths` aydaki sorgu sayısı. */
  inquiries: number
  findeks: number
  /** Son 12 aydaki karşılıksız çek / protestolu senet sayısı. */
  bouncedCheques12m: number
  protestedBills12m: number
  /** Toplam riskin `riskGrowth.lookbackMonths` ay öncesine göre göreli değişimi (hesaplanamazsa null). */
  riskGrowth: number | null
  /** İşletme sermayesi türündeki nakdi risk (K1 düşümü). */
  workingCapitalCashRisk: number
  /** Vadeli kredilerin önümüzdeki 12 aydaki anapara ödemeleri (K3). */
  annualDebtService: number
  /** Mizan ayındaki toplam nakdi risk (mizan ayı rapor aralığında değilse null). */
  mizanMonthCashRisk: number | null
  /** Aylık toplam risk serisi (raporun başından `asOf`'a kadar). */
  riskSeries: { months: string[]; cash: number[]; nonCash: number[] }
  /** Aylık en yüksek gecikme günü serisi (tüm bankalar). */
  delaySeries: number[]
}

export interface KkbSignal {
  id: KkbSignalId
  label: string
  /** 'none' değilse not tavanı uygulanır (kritik sinyal). */
  gradeCap: LendableGrade | 'none'
}

/** 'YYYY-MM' ayları arasındaki ay farkı (to − from). */
export function monthDiff(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * MONTHS_PER_YEAR + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
}

/** Eşit taksitli vadeli kredide önümüzdeki 12 ayda ödenecek anapara. */
export function annualPrincipal(risk: number, remainingMonths: number): number {
  if (risk <= 0 || remainingMonths <= 0) return 0
  return risk * Math.min(1, MONTHS_PER_YEAR / remainingMonths)
}

const sumAt = (facilities: readonly KkbFacility[], key: 'cashLimit' | 'cashRisk' | 'nonCashLimit' | 'nonCashRisk', i: number) =>
  facilities.reduce((a, f) => a + (f[key][i] ?? 0), 0)

/** Raporun `asOf` ayındaki görüntüsü. Ay raporda yoksa hata verir. */
export function kkbSnapshot(report: KkbReport, asOf: string, config: ModelConfig): KkbSnapshot {
  const i = report.months.indexOf(asOf)
  if (i < 0) throw new Error(`KKB raporunda ay yok: ${asOf}`)
  const { signals, limit, debtService } = config.kkb
  const window = (n: number) => Math.max(0, i - n + 1)

  const byBank = new Map<string, KkbFacility[]>()
  for (const f of report.facilities) byBank.set(f.bank, [...(byBank.get(f.bank) ?? []), f])
  const maxDelay = (facilities: readonly KkbFacility[], months: number) =>
    Math.max(0, ...facilities.flatMap((f) => f.delayDays.slice(window(months), i + 1)))
  const inFollowUp = (f: KkbFacility) => f.legalFollowUpFrom !== null && f.legalFollowUpFrom <= asOf

  const banks: KkbBankRow[] = [...byBank.entries()]
    .map(([bank, fs]) => ({
      bank,
      types: [...new Set(fs.filter((f) => f.cashLimit[i] > 0 || f.nonCashLimit[i] > 0 || f.cashRisk[i] > 0 || f.nonCashRisk[i] > 0).map((f) => f.type))],
      cashLimit: sumAt(fs, 'cashLimit', i),
      cashRisk: sumAt(fs, 'cashRisk', i),
      nonCashLimit: sumAt(fs, 'nonCashLimit', i),
      nonCashRisk: sumAt(fs, 'nonCashRisk', i),
      maxDelayDays12m: maxDelay(fs, MONTHS_PER_YEAR),
      followUp: (fs.some(inFollowUp) ? 'legal' : 'none') as KkbFollowUp,
    }))
    .filter((b) => b.types.length > 0 || b.followUp === 'legal')
    .sort((a, b) => a.bank.localeCompare(b.bank, 'tr'))

  const totalCashLimit = sumAt(report.facilities, 'cashLimit', i)
  const totalCashRisk = sumAt(report.facilities, 'cashRisk', i)
  const totalNonCashLimit = sumAt(report.facilities, 'nonCashLimit', i)
  const totalNonCashRisk = sumAt(report.facilities, 'nonCashRisk', i)
  const totalLimit = totalCashLimit + totalNonCashLimit
  const totalRisk = totalCashRisk + totalNonCashRisk

  const totalAt = (k: number) => sumAt(report.facilities, 'cashRisk', k) + sumAt(report.facilities, 'nonCashRisk', k)
  const lag = signals.riskGrowth.lookbackMonths
  const base = i - lag >= 0 ? totalAt(i - lag) : 0
  const riskGrowth = base > 0 ? totalRisk / base - 1 : null

  const within12 = (months: readonly string[]) => months.filter((m) => m <= asOf && monthDiff(m, asOf) < MONTHS_PER_YEAR).length

  const workingCapitalCashRisk = report.facilities
    .filter((f) => limit.workingCapitalTypes.includes(f.type))
    .reduce((a, f) => a + (f.cashRisk[i] ?? 0), 0)
  const annualDebtService = report.facilities
    .filter((f) => debtService.termTypes.includes(f.type) && f.maturity !== null)
    .reduce((a, f) => a + annualPrincipal(f.cashRisk[i] ?? 0, monthDiff(asOf, f.maturity!)), 0)

  const mi = report.months.indexOf(report.mizanMonth)
  const months = report.months.slice(0, i + 1)
  return {
    asOf,
    banks,
    totalCashLimit,
    totalCashRisk,
    totalNonCashLimit,
    totalNonCashRisk,
    totalLimit,
    totalRisk,
    utilization: totalLimit > 0 ? totalRisk / totalLimit : 0,
    maxDelayDays: maxDelay(report.facilities, signals.overdue.windowMonths),
    legalFollowUp: report.facilities.some(inFollowUp),
    inquiries: report.inquiries.slice(window(signals.inquiries.windowMonths), i + 1).reduce((a, v) => a + v, 0),
    findeks: report.findeks[i],
    bouncedCheques12m: within12(report.bouncedCheques),
    protestedBills12m: within12(report.protestedBills),
    riskGrowth,
    workingCapitalCashRisk,
    annualDebtService,
    mizanMonthCashRisk: mi >= 0 && mi <= i ? sumAt(report.facilities, 'cashRisk', mi) : null,
    riskSeries: {
      months,
      cash: months.map((_, k) => sumAt(report.facilities, 'cashRisk', k)),
      nonCash: months.map((_, k) => sumAt(report.facilities, 'nonCashRisk', k)),
    },
    delaySeries: months.map((_, k) => Math.max(0, ...report.facilities.map((f) => f.delayDays[k] ?? 0))),
  }
}

/** KKB riski ile mizandaki finansal borçlar arasındaki göreli fark (mizan ayı yoksa null). */
export function mizanDeviation(snapshot: KkbSnapshot, financialDebt: number): number | null {
  if (snapshot.mizanMonthCashRisk === null) return null
  if (financialDebt <= 0) return snapshot.mizanMonthCashRisk > 0 ? Infinity : 0
  return Math.abs(snapshot.mizanMonthCashRisk - financialDebt) / financialDebt
}

/** KKB kaynaklı erken uyarı sinyalleri. */
export function detectKkbSignals(snapshot: KkbSnapshot, financialDebt: number, config: ModelConfig): KkbSignal[] {
  const s = config.kkb.signals
  const out: KkbSignal[] = []
  const add = (id: KkbSignalId) => out.push({ id, label: s[id].label, gradeCap: s[id].gradeCap })

  if (s.overdue.enabled && snapshot.maxDelayDays >= s.overdue.minDays) add('overdue')
  if (s.legalFollowUp.enabled && snapshot.legalFollowUp) add('legalFollowUp')
  if (s.inquiries.enabled && snapshot.inquiries >= s.inquiries.minCount) add('inquiries')
  if (s.riskGrowth.enabled && snapshot.riskGrowth !== null && snapshot.riskGrowth >= s.riskGrowth.minGrowth) add('riskGrowth')
  const dev = mizanDeviation(snapshot, financialDebt)
  if (s.mizanMismatch.enabled && dev !== null && dev > s.mizanMismatch.maxDeviation) add('mizanMismatch')
  if (s.lowFindeks.enabled && snapshot.findeks <= s.lowFindeks.maxScore) add('lowFindeks')
  return out
}
