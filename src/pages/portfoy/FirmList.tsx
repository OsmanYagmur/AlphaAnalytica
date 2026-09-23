import { AlertTriangle, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { Card, ModelVersionTag, cx, inputClass } from '../../components/ui'
import { formatDate, formatPercent, formatTL } from '../../lib/format'
import { navigate } from '../../lib/router'
import { useActiveVersion, useFirmViews } from '../../store/evaluations'
import { PORTFOLIO_STATUS_LABELS, approvedLimit, hasEarlyWarning, type PortfolioStatus } from '../../store/portfolio'
import { GradeChange, PortfolioStatusBadge } from './common'

const FILTERS: (PortfolioStatus | 'all')[] = ['all', 'approved', 'revisedApproved', 'rejected', 'pending']

export function PortfolioFirmList() {
  const views = useFirmViews()
  const version = useActiveVersion()
  const [status, setStatus] = useState<PortfolioStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const count = (s: PortfolioStatus | 'all') => (s === 'all' ? views.length : views.filter((v) => v.status === s).length)
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    const order: Record<PortfolioStatus, number> = { approved: 0, revisedApproved: 1, pending: 2, rejected: 3 }
    return views
      .filter((v) => status === 'all' || v.status === status)
      .filter((v) => !q || v.firm.name.toLocaleLowerCase('tr-TR').includes(q) || v.firm.vkn.includes(q))
      .sort((a, b) => order[a.status] - order[b.status] || a.firm.name.localeCompare(b.firm.name, 'tr'))
  }, [views, status, query])

  return (
    <AppShell role="portfoy" title="Firma Listesi" actions={<ModelVersionTag version={version} />}>
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-fit flex-wrap gap-1 rounded-md border border-line bg-subtle p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatus(f)}
                className={cx(
                  'whitespace-nowrap rounded px-3 py-1.5 text-[0.8125rem]',
                  status === f ? 'bg-surface font-medium text-navy shadow-card' : 'text-muted hover:text-ink',
                )}
              >
                {f === 'all' ? 'Tümü' : PORTFOLIO_STATUS_LABELS[f]}
                <span className="num ml-1.5 text-xs text-faint">{count(f)}</span>
              </button>
            ))}
          </div>
          <div className="relative xl:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className={cx(inputClass, 'pl-8')} placeholder="Firma adı veya VKN" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Ara" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/60 text-left">
                <th className="label-caps px-5 py-2.5 font-semibold">Firma</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Sektör</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Durum</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Not (karar → güncel)</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Onaylı limit</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Kullanım</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Karar tarihi</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const limit = approvedLimit(v)
                return (
                  <tr key={v.firm.id} onClick={() => navigate(`/portfoy/firma/${v.firm.id}`)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-subtle/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        {v.firm.name}
                        {hasEarlyWarning(v) && v.status !== 'pending' && (
                          <span title="Erken uyarı">
                            <AlertTriangle size={14} className={v.current.earlyWarnings.critical.length ? 'text-negative' : 'text-warning'} />
                          </span>
                        )}
                      </div>
                      <div className="num text-xs text-muted">
                        {v.firm.city} · VKN {v.firm.vkn}
                      </div>
                    </td>
                    <td className="px-3 py-3">{v.config.sectors[v.firm.sectorId].label}</td>
                    <td className="px-3 py-3">
                      <PortfolioStatusBadge view={v} />
                    </td>
                    <td className="px-3 py-3">
                      <GradeChange from={v.decision?.system.grade ?? null} to={v.current.grade} />
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right">{limit > 0 ? formatTL(limit) : <span className="text-muted">—</span>}</td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right">{limit > 0 ? formatPercent(v.decision?.utilization ?? 0, 0) : <span className="text-muted">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{v.decision ? formatDate(v.decision.decidedAt) : 'Karar bekleniyor'}</td>
                    <td className="pr-4 text-faint">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
