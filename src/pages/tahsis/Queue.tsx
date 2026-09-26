import { AlertTriangle, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { Badge, Card, GradeBadge, ModelVersionTag, StatusBadge, cx, inputClass } from '../../components/ui'
import { CREDIT_GRADES, SECTOR_IDS, type CreditGrade, type SectorId } from '../../engine/modelConfig'
import { daysSince, formatDate, formatTL } from '../../lib/format'
import { navigate } from '../../lib/router'
import { useActiveConfig, useActiveVersion, useFirmViews, type FirmView } from '../../store/evaluations'
import { SEGMENT_FILTER_LABELS, matchesSegment, type SegmentFilter } from '../../store/portfolio'

type StatusFilter = 'pending' | 'decided' | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Tahsis Bekliyor' },
  { value: 'decided', label: 'Karara Bağlanan' },
  { value: 'all', label: 'Tümü' },
]

function normalize(text: string): string {
  return text.toLocaleLowerCase('tr-TR')
}

function WaitingCell({ view }: { view: FirmView }) {
  if (view.decision) {
    return <span className="text-muted">Karar: {formatDate(view.decision.decidedAt)}</span>
  }
  const days = daysSince(view.firm.applicationDate)
  return (
    <span className={cx('num', days > 14 ? 'text-warning' : 'text-ink')}>
      {days} gün
    </span>
  )
}

export function Queue() {
  const views = useFirmViews()
  const config = useActiveConfig()
  const version = useActiveVersion()
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [sector, setSector] = useState<SectorId | ''>('')
  const [grade, setGrade] = useState<CreditGrade | ''>('')
  const [segment, setSegment] = useState<SegmentFilter>('all')
  const [query, setQuery] = useState('')

  const counts = {
    pending: views.filter((v) => v.status === 'pending').length,
    decided: views.filter((v) => v.status !== 'pending').length,
    all: views.length,
  }

  const rows = useMemo(() => {
    const q = normalize(query.trim())
    return views
      .filter((v) => (status === 'all' ? true : status === 'pending' ? v.status === 'pending' : v.status !== 'pending'))
      .filter((v) => !sector || v.firm.sectorId === sector)
      .filter((v) => !grade || v.evaluation.grade === grade)
      .filter((v) => matchesSegment(v, segment))
      .filter((v) => !q || normalize(v.firm.name).includes(q) || v.firm.vkn.includes(q) || normalize(v.firm.city).includes(q))
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (b.status === 'pending' && a.status !== 'pending') return 1
        if (a.status === 'pending') return a.firm.applicationDate.localeCompare(b.firm.applicationDate)
        return (b.decision?.decidedAt ?? '').localeCompare(a.decision?.decidedAt ?? '')
      })
  }, [views, status, sector, grade, segment, query])

  const pendingTotal = views.filter((v) => v.status === 'pending').reduce((acc, v) => acc + v.firm.requestedAmount, 0)

  return (
    <AppShell role="tahsis" title="Başvuru Kuyruğu" actions={<ModelVersionTag version={version} />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <p className="label-caps">Bekleyen başvuru</p>
          <p className="num mt-1 text-2xl font-semibold text-navy">{counts.pending}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <p className="label-caps">Bekleyen talep toplamı</p>
          <p className="num mt-1 text-2xl font-semibold text-navy">{formatTL(pendingTotal)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <p className="label-caps">Karara bağlanan</p>
          <p className="num mt-1 text-2xl font-semibold text-navy">{counts.decided}</p>
        </div>
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-md border border-line bg-subtle p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={cx(
                  'whitespace-nowrap rounded px-3 py-1.5 text-[0.8125rem] transition-colors',
                  status === f.value ? 'bg-surface font-medium text-navy shadow-card' : 'text-muted hover:text-ink',
                )}
              >
                {f.label}
                <span className="num ml-1.5 text-xs text-faint">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-4 2xl:flex">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                className={cx(inputClass, 'pl-8 2xl:w-64')}
                placeholder="Firma adı, VKN veya il"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Ara"
              />
            </div>
            <select className={cx(inputClass, '2xl:w-52')} value={sector} onChange={(e) => setSector(e.target.value as SectorId | '')} aria-label="Sektör">
              <option value="">Tüm sektörler</option>
              {SECTOR_IDS.map((s) => (
                <option key={s} value={s}>
                  {config.sectors[s].label}
                </option>
              ))}
            </select>
            <select className={cx(inputClass, '2xl:w-36')} value={segment} onChange={(e) => setSegment(e.target.value as SegmentFilter)} aria-label="Ölçek">
              {(['all', 'sme', 'holding'] as const).map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? 'Tüm ölçekler' : SEGMENT_FILTER_LABELS[s]}
                </option>
              ))}
            </select>
            <select className={cx(inputClass, '2xl:w-36')} value={grade} onChange={(e) => setGrade(e.target.value as CreditGrade | '')} aria-label="Not">
              <option value="">Tüm notlar</option>
              {CREDIT_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/60 text-left">
                <th className="label-caps px-5 py-2.5 font-semibold">Firma</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Sektör</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Talep Tutarı</th>
                <th className="label-caps px-3 py-2.5 text-center font-semibold">Sistem Notu</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Önerilen Limit</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Bekleme Süresi</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Durum</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const critical = v.evaluation.earlyWarnings.critical.length > 0
                const watch = v.evaluation.earlyWarnings.watch.length > 0
                return (
                  <tr
                    key={v.firm.id}
                    onClick={() => navigate(`/tahsis/firma/${v.firm.id}`)}
                    className="cursor-pointer border-b border-line last:border-b-0 hover:bg-subtle/60"
                  >
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                        {v.firm.name}
                        {v.firm.segment === 'holding' && <Badge tone="navy">Holding</Badge>}
                      </div>
                      <div className="num text-xs text-muted">
                        {v.firm.city} · VKN {v.firm.vkn}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink">{v.config.sectors[v.firm.sectorId].label}</td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right">{formatTL(v.firm.requestedAmount)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <GradeBadge grade={v.evaluation.grade} />
                        {(critical || watch) && (
                          <span title={critical ? 'Kritik erken uyarı' : 'İzleme sinyali'}>
                            <AlertTriangle size={14} className={critical ? 'text-negative' : 'text-warning'} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right">
                      {v.evaluation.limit.limit > 0 ? formatTL(v.evaluation.limit.limit) : <span className="text-muted">Limit yok</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <WaitingCell view={v} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="pr-4 text-faint">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted">
                    Filtrelere uyan başvuru yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
