import { AlertOctagon, ChevronRight, Eye } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../../components/AppShell'
import { CHART_COLORS } from '../../components/charts'
import { Badge, Card, ModelVersionTag, cx } from '../../components/ui'
import { CREDIT_GRADES } from '../../engine/modelConfig'
import { formatPercent, formatTL, formatTLShort } from '../../lib/format'
import { navigate } from '../../lib/router'
import { useActiveConfig, useActiveVersion, useFirmViews } from '../../store/evaluations'
import { SEGMENT_FILTER_LABELS, approvedLimit, matchesSegment, summarizePortfolio, type SegmentFilter } from '../../store/portfolio'
import { GradeChange, KpiCard } from './common'

type GradeScope = 'portfolio' | 'all'

export function PortfolioSummary() {
  const allViews = useFirmViews()
  const [segment, setSegment] = useState<SegmentFilter>('all')
  const views = allViews.filter((v) => matchesSegment(v, segment))
  const version = useActiveVersion()
  const config = useActiveConfig()
  const [scope, setScope] = useState<GradeScope>('portfolio')
  const summary = summarizePortfolio(views, CREDIT_GRADES)

  const gradeCounts =
    scope === 'portfolio'
      ? summary.gradeCounts
      : (Object.fromEntries(CREDIT_GRADES.map((g) => [g, views.filter((v) => v.current.grade === g).length])) as Record<string, number>)
  const gradeData = CREDIT_GRADES.map((g) => ({ grade: g, count: gradeCounts[g] }))
  const pendingCount = views.filter((v) => v.status === 'pending').length

  return (
    <AppShell
      role="portfoy"
      title="Portföy Özeti"
      actions={
        <>
          <div className="flex gap-1 rounded-md border border-line bg-subtle p-0.5" role="group" aria-label="Ölçek">
            {(['all', 'sme', 'holding'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                className={cx('rounded px-2.5 py-1 text-xs', segment === s ? 'bg-surface font-medium text-navy shadow-card' : 'text-muted hover:text-ink')}
              >
                {SEGMENT_FILTER_LABELS[s]}
              </button>
            ))}
          </div>
          <ModelVersionTag version={version} />
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Toplam onaylı limit" value={formatTL(summary.totalLimit)} hint={`${summary.firmCount} firma`} />
        <KpiCard
          label="Kullandırılan risk"
          value={formatTL(summary.utilized)}
          hint={summary.totalLimit > 0 ? `Limit kullanım oranı ${formatPercent(summary.utilized / summary.totalLimit)}` : undefined}
        />
        <KpiCard label="Erken uyarıdaki firma" value={summary.warnings.length} hint="Portföydeki firmalar arasında" />
        <KpiCard label="Beklemedeki başvuru" value={pendingCount} hint="Tahsis kararı bekleniyor" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Not dağılımı"
          subtitle="Aktif model ve güncel veriyle"
          actions={
            <div className="flex gap-1 rounded-md border border-line bg-subtle p-0.5">
              {(['portfolio', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cx('rounded px-2.5 py-1 text-xs', scope === s ? 'bg-surface font-medium text-navy shadow-card' : 'text-muted')}
                >
                  {s === 'portfolio' ? 'Portföy' : 'Tüm firmalar'}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: '#E3E1DA' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F1EFE9' }} formatter={(v) => [`${v} firma`, 'Adet']} contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #E3E1DA' }} />
                <Bar dataKey="count" fill={CHART_COLORS.navy} radius={[2, 2, 0, 0]} maxBarSize={44} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Sektör dağılımı" subtitle="Onaylı limit tutarına göre">
          <div className="space-y-3">
            {summary.sectorLimits.map((s) => {
              const share = summary.totalLimit > 0 ? s.limit / summary.totalLimit : 0
              return (
                <div key={s.sectorId}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink">
                      {config.sectors[s.sectorId].label}
                      <span className="ml-1.5 text-xs text-muted">{s.count} firma</span>
                    </span>
                    <span className="num text-ink">
                      {formatTLShort(s.limit)} <span className="text-xs text-muted">· {formatPercent(share, 0)}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-subtle">
                    <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
                  </div>
                </div>
              )
            })}
            {summary.sectorLimits.length === 0 && <p className="text-sm text-muted">Portföyde onaylı limit yok.</p>}
          </div>
        </Card>
      </div>

      <Card title="Erken uyarıdaki firmalar" subtitle="Portföydeki firmaların aktif model ve güncel veriyle izlenmesi" className="mt-4" bodyClassName="p-0">
        {summary.warnings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Erken uyarı sinyali olan portföy firması yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60 text-left">
                  <th className="label-caps px-5 py-2.5 font-semibold">Firma</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Not (karar → güncel)</th>
                  <th className="label-caps px-3 py-2.5 text-right font-semibold">Onaylı limit</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Sinyaller</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {summary.warnings.map((v) => (
                  <tr key={v.firm.id} onClick={() => navigate(`/portfoy/firma/${v.firm.id}`)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-subtle/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{v.firm.name}</div>
                      <div className="text-xs text-muted">{config.sectors[v.firm.sectorId].label}</div>
                    </td>
                    <td className="px-3 py-3">
                      <GradeChange from={v.decision?.system.grade ?? null} to={v.current.grade} />
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right">{formatTL(approvedLimit(v))}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.current.earlyWarnings.critical.map((s) => (
                          <Badge key={s.id} tone="negative">
                            <AlertOctagon size={11} />
                            {s.label}
                          </Badge>
                        ))}
                        {v.current.earlyWarnings.watch.map((s) => (
                          <Badge key={s.id} tone="warning">
                            <Eye size={11} />
                            {s.label}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="pr-4 text-faint">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
