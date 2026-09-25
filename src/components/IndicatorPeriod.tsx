import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react'
import type { IndicatorPeriodStats } from '../engine/indicatorPeriod'
import { formatPeriodComparison, formatPeriodRange, formatSignedPercent } from '../lib/format'
import { SegmentedControl, cx } from './ui'

/** Görüntüleme dönemi seçenekleri (ay). Skor hesaplamasını etkilemez. */
export const PERIOD_OPTIONS = [1, 3, 6, 12] as const
export type PeriodMonths = (typeof PERIOD_OPTIONS)[number]
export const DEFAULT_PERIOD_MONTHS: PeriodMonths = 3

export function PeriodSelector({ value, onChange }: { value: PeriodMonths; onChange: (value: PeriodMonths) => void }) {
  return <SegmentedControl ariaLabel="Zaman aralığı" value={value} onChange={onChange} items={PERIOD_OPTIONS.map((m) => ({ value: m, label: `${m} ay` }))} />
}

/** "Haz 26 – Ağu 26, önceki 3 aya göre" */
export function periodCaption(months: readonly string[], periodMonths: number): string {
  return `${formatPeriodRange(months)}, ${formatPeriodComparison(periodMonths)}`
}

/** Önceki döneme göre değişim; renk göstergenin yönüne göre (ör. iade oranındaki artış olumsuz). */
export function PeriodChange({ stats, className }: { stats: IndicatorPeriodStats; className?: string }) {
  if (stats.change === null) return <span className={cx('num text-xs text-muted', className)}>—</span>
  const Icon = stats.change >= 0 ? ArrowUpRight : ArrowDownRight
  const tone = stats.favorable === null ? 'text-muted' : stats.favorable ? 'text-positive' : 'text-negative'
  return (
    <span className={cx('num inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium', tone, className)}>
      <Icon size={13} strokeWidth={2.25} />
      {formatSignedPercent(stats.change)}
    </span>
  )
}

export function PeriodNote({ className }: { className?: string }) {
  return (
    <p className={cx('flex items-center gap-1.5 text-xs text-muted', className)}>
      <Info size={12} className="shrink-0 text-faint" />
      Dönem seçimi skoru etkilemez.
    </p>
  )
}
