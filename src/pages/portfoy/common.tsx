import { ArrowRight } from 'lucide-react'
import { GradeBadge, StatusBadge } from '../../components/ui'
import type { CreditGrade } from '../../engine/modelConfig'
import { gradeRank } from '../../engine/rating'
import type { FirmView } from '../../store/evaluations'
import { PORTFOLIO_STATUS_LABELS } from '../../store/portfolio'

export function PortfolioStatusBadge({ view }: { view: FirmView }) {
  return <StatusBadge status={view.status} label={PORTFOLIO_STATUS_LABELS[view.status]} />
}

/** Karar anındaki not → güncel not (değişim varsa ok ve renk). */
export function GradeChange({ from, to }: { from: CreditGrade | null; to: CreditGrade }) {
  if (!from || from === to) return <GradeBadge grade={to} />
  const worse = gradeRank(to) > gradeRank(from)
  return (
    <span className="inline-flex items-center gap-1">
      <GradeBadge grade={from} />
      <ArrowRight size={12} className={worse ? 'text-negative' : 'text-positive'} />
      <GradeBadge grade={to} />
    </span>
  )
}

export function KpiCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
      <p className="label-caps">{label}</p>
      <p className="num mt-1 text-2xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}
