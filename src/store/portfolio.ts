/**
 * Portföy görünümü: onaylı (onay + revize onay) kararların limitleri, kullanım
 * ve güncel izleme. Skorlar motordan gelir; burada yalnızca toplama yapılır.
 */

import type { CreditGrade, SectorId } from '../engine/modelConfig'
import type { FirmView } from './evaluations'

export type PortfolioStatus = 'approved' | 'revisedApproved' | 'rejected' | 'pending'

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  approved: 'Onaylandı',
  revisedApproved: 'Revize Onay',
  rejected: 'Reddedildi',
  pending: 'Beklemede',
}

export type SegmentFilter = 'all' | 'sme' | 'holding'

export const SEGMENT_FILTER_LABELS: Record<SegmentFilter, string> = {
  all: 'Tümü',
  sme: 'KOBİ',
  holding: 'Holding',
}

export function matchesSegment(v: FirmView, filter: SegmentFilter): boolean {
  if (filter === 'all') return true
  return filter === 'holding' ? v.firm.segment === 'holding' : v.firm.segment !== 'holding'
}

export function isInPortfolio(v: FirmView): boolean {
  return v.status === 'approved' || v.status === 'revisedApproved'
}

export function approvedLimit(v: FirmView): number {
  return isInPortfolio(v) ? (v.decision?.final?.limit ?? 0) : 0
}

export function utilizedAmount(v: FirmView): number {
  return approvedLimit(v) * (v.decision?.utilization ?? 0)
}

/** Güncel (aktif model, son veri) değerlendirmede erken uyarı var mı. */
export function hasEarlyWarning(v: FirmView): boolean {
  return v.current.earlyWarnings.critical.length > 0 || v.current.earlyWarnings.watch.length > 0
}

export interface PortfolioSummary {
  firmCount: number
  totalLimit: number
  utilized: number
  gradeCounts: Record<CreditGrade, number>
  sectorLimits: { sectorId: SectorId; limit: number; count: number }[]
  warnings: FirmView[]
}

export function summarizePortfolio(views: FirmView[], grades: readonly CreditGrade[]): PortfolioSummary {
  const portfolio = views.filter(isInPortfolio)
  const gradeCounts = Object.fromEntries(grades.map((g) => [g, 0])) as Record<CreditGrade, number>
  portfolio.forEach((v) => gradeCounts[v.current.grade]++)
  const bySector = new Map<SectorId, { limit: number; count: number }>()
  for (const v of portfolio) {
    const e = bySector.get(v.firm.sectorId) ?? { limit: 0, count: 0 }
    e.limit += approvedLimit(v)
    e.count++
    bySector.set(v.firm.sectorId, e)
  }
  return {
    firmCount: portfolio.length,
    totalLimit: portfolio.reduce((a, v) => a + approvedLimit(v), 0),
    utilized: portfolio.reduce((a, v) => a + utilizedAmount(v), 0),
    gradeCounts,
    sectorLimits: [...bySector.entries()].map(([sectorId, e]) => ({ sectorId, ...e })).sort((a, b) => b.limit - a.limit),
    warnings: portfolio.filter(hasEarlyWarning),
  }
}
