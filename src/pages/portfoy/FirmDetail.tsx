import { AlertOctagon, ArrowLeft, Eye, Info } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../../components/AppShell'
import { CHART_COLORS, Sparkline } from '../../components/charts'
import { DEFAULT_PERIOD_MONTHS, PeriodChange, PeriodNote, PeriodSelector, periodCaption, type PeriodMonths } from '../../components/IndicatorPeriod'
import { Gauge } from '../../components/Gauge'
import { IndicatorName } from '../../components/IndicatorName'
import { KkbCompact } from '../../components/Kkb'
import { MarketIntelCompact } from '../../components/MarketIntel'
import { Badge, Button, Card, DataRow, GradeBadge, ModelVersionTag, cx } from '../../components/ui'
import { REJECTION_REASONS, SEGMENT_LABELS } from '../../data'
import { scoreTrend } from '../../engine/evaluate'
import { computeIndicatorPeriod } from '../../engine/indicatorPeriod'
import { PRODUCT_IDS, PRODUCT_LABELS, type AlternativeIndicatorConfig, type CollateralTypeId } from '../../engine/modelConfig'
import { formatDateTime, formatPercent, formatPeriodComparison, formatScore, formatSeriesAverage, formatTL, formatYearMonth } from '../../lib/format'
import { navigate } from '../../lib/router'
import { useActiveConfig, useActiveVersion, useFirmView, type FirmView } from '../../store/evaluations'
import { approvedLimit, utilizedAmount } from '../../store/portfolio'
import type { FinalTerms, SystemView } from '../../store/types'
import { PortfolioStatusBadge } from './common'

/** Müşterek kefalet içeren teminat türleri. */
const WITH_SURETY: CollateralTypeId[] = ['jointSurety', 'receivablesAssignment', 'vehiclePledge', 'mortgage']

function ScoreTrendChart({ view }: { view: FirmView }) {
  const config = useActiveConfig()
  const data = useMemo(() => scoreTrend(view.firm, config, 12), [view.firm, config])
  const scores = data.map((d) => d.score)
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 6) / 5) * 5)
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 6) / 5) * 5)
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => formatYearMonth(String(m))} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={{ stroke: '#E3E1DA' }} tickLine={false} />
          <YAxis domain={[lo, hi]} tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #E3E1DA' }}
            labelFormatter={(m) => formatYearMonth(String(m))}
            formatter={(v, _n, item) => [`${formatScore(Number(v))} · ${(item.payload as { grade: string }).grade}`, 'Skor · Not']}
          />
          <Line type="monotone" dataKey="score" stroke={CHART_COLORS.navy} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.navy }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CompareRow {
  label: string
  system: ReactNode
  decision: ReactNode
  changed: boolean
}

function buildRows(system: SystemView, final: FinalTerms | null, rejected: boolean): CompareRow[] {
  const t = system.terms
  const tenor = (months: number, revolving: boolean) => `${months} ay${revolving ? ' · rotatif' : ''}`
  const dash = <span className="text-muted">—</span>
  const rows: CompareRow[] = [
    { label: 'Nihai skor', system: formatScore(system.score), decision: dash, changed: false },
    { label: 'Not', system: <GradeBadge grade={system.grade} />, decision: dash, changed: false },
    { label: 'PD', system: formatPercent(system.pd, 2), decision: dash, changed: false },
  ]
  if (rejected || !final) {
    rows.push({ label: 'Limit', system: system.limit > 0 ? formatTL(system.limit) : 'Limit yok', decision: <span className="font-sans text-negative">Reddedildi</span>, changed: system.limit > 0 })
    return rows
  }
  const diff = <T,>(a: T, b: T) => a !== b
  rows.push(
    { label: 'Limit', system: t ? formatTL(t.limit) : 'Limit yok', decision: formatTL(final.limit), changed: diff(t?.limit ?? 0, final.limit) },
    { label: 'Teminat türü', system: <span className="font-sans">{t?.collateral.typeLabel ?? '—'}</span>, decision: <span className="font-sans">{final.collateral.typeLabel}</span>, changed: diff(t?.collateral.type, final.collateral.type) },
    { label: 'Teminat oranı', system: t ? formatPercent(t.collateral.ratio, 0) : '—', decision: formatPercent(final.collateral.ratio, 0), changed: diff(t?.collateral.ratio, final.collateral.ratio) },
    { label: 'İpotek tutarı', system: t?.collateral.mortgageRequired ? formatTL(t.collateral.mortgageAmount) : '—', decision: final.collateral.mortgageRequired ? formatTL(final.collateral.mortgageAmount) : '—', changed: diff(Math.round(t?.collateral.mortgageAmount ?? 0), Math.round(final.collateral.mortgageAmount)) },
    { label: 'Vade', system: t ? tenor(t.tenor.months, t.tenor.revolving) : '—', decision: tenor(final.tenorMonths, final.revolving), changed: diff(t?.tenor.months, final.tenorMonths) || diff(t?.tenor.revolving, final.revolving) },
    { label: 'Fiyatlama', system: t ? `${t.pricing.referenceRate} + ${t.pricing.spreadBp} bp` : '—', decision: `${final.referenceRate} + ${final.spreadBp} bp`, changed: diff(t?.pricing.spreadBp, final.spreadBp) },
  )
  for (const p of PRODUCT_IDS) {
    const sys = t?.products.find((x) => x.product === p)?.amount ?? 0
    const dec = final.products.find((x) => x.product === p)?.amount ?? 0
    if (sys === 0 && dec === 0) continue
    rows.push({ label: PRODUCT_LABELS[p], system: formatTL(sys), decision: formatTL(dec), changed: sys !== dec })
  }
  rows.push({
    label: 'Özel şartlar',
    system: dash,
    decision: final.covenants.length > 0 ? `${final.covenants.length} şart` : dash,
    changed: final.covenants.length > 0,
  })
  return rows
}

function Comparison({ view }: { view: FirmView }) {
  const d = view.decision!
  const rows = buildRows(d.system, d.final, d.status === 'rejected')
  return (
    <Card title="Sistem Görüşü ve Tahsis Yöneticisi Kararı" subtitle={`Karar anındaki sistem önerisi (Model ${d.modelVersion}) ile verilen karar`} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-2.5 font-semibold">Kalem</th>
              <th className="label-caps px-3 py-2.5 text-right font-semibold">Sistem Görüşü</th>
              <th className="label-caps px-5 py-2.5 text-right font-semibold">Tahsis Yöneticisi Kararı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={cx('border-b border-line last:border-b-0', r.changed && 'bg-edited')}>
                <td className="px-5 py-2.5 text-ink">
                  {r.label}
                  {r.changed && <Badge tone="warning" className="ml-2">Farklı</Badge>}
                </td>
                <td className="num px-3 py-2.5 text-right text-muted">{r.system}</td>
                <td className={cx('num px-5 py-2.5 text-right', r.changed ? 'font-semibold text-navy' : 'text-ink')}>{r.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function LimitDetail({ view }: { view: FirmView }) {
  const final = view.decision?.final
  if (!final) return null
  const c = final.collateral
  return (
    <Card title="Onaylanan limit detayı">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <span className="num text-xl font-semibold text-navy">{formatTL(final.limit)}</span>
        <span className="num text-xs text-muted">
          Kullandırılan: {formatTL(utilizedAmount(view))} ({formatPercent(view.decision?.utilization ?? 0, 0)})
        </span>
      </div>
      <p className="label-caps mb-1.5">Ürün bazında kırılım</p>
      <table className="mb-4 w-full text-sm">
        <tbody>
          {final.products.map((p) => (
            <tr key={p.product} className="border-b border-line last:border-b-0">
              <td className="py-1.5">{p.label}</td>
              <td className="num w-14 py-1.5 text-right text-muted">{formatPercent(p.share, 0)}</td>
              <td className="num w-32 py-1.5 text-right">{formatTL(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="label-caps mb-0.5">Teminat yapısı</p>
      <dl className="mb-4">
        <DataRow label="Teminat türü" value={<span className="font-sans">{c.typeLabel}</span>} />
        <DataRow label="İpotek yüzdesi" value={c.mortgageRequired ? formatPercent(c.ratio, 0) : <span className="font-sans text-muted">İpotek yok</span>} />
        <DataRow label="İpotek tutarı" value={c.mortgageRequired ? formatTL(c.mortgageAmount) : '—'} />
        <DataRow label="Gerekli ekspertiz değeri" value={c.mortgageRequired ? formatTL(c.requiredAppraisalValue) : '—'} />
        <DataRow label="Kefalet" value={<span className="font-sans">{WITH_SURETY.includes(c.type) ? 'Müşterek kefalet' : 'Yok'}</span>} />
        {!c.mortgageRequired && c.amount > 0 && <DataRow label="Teminat tutarı" value={`${formatTL(c.amount)} (${formatPercent(c.ratio, 0)})`} />}
      </dl>
      <p className="label-caps mb-0.5">Vade ve fiyatlama</p>
      <dl className="mb-4">
        <DataRow label="Vade" value={`${final.tenorMonths} ay${final.revolving ? ' · rotatif' : ''}`} />
        <DataRow label="Fiyatlama" value={`${final.referenceRate} + ${final.spreadBp} bp`} />
      </dl>
      <p className="label-caps mb-1.5">Özel şartlar</p>
      {final.covenants.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {final.covenants.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Özel şart yok.</p>
      )}
    </Card>
  )
}

const STRENGTH_TONE = { Güçlü: 'positive', Orta: 'warning', Zayıf: 'negative' } as const

function Monitoring({ view }: { view: FirmView }) {
  const ev = view.current
  const [period, setPeriod] = useState<PeriodMonths>(DEFAULT_PERIOD_MONTHS)
  const indicators = view.config.sectors[view.firm.sectorId].indicators as Record<string, AlternativeIndicatorConfig>
  // Yalnızca görüntüleme: güncel veriyle seçili dönem; skor ve not motorun kendi pencereleriyle hesaplanır
  const rows = useMemo(
    () =>
      Object.entries(indicators)
        .map(([id, ind]) => ({ id, ind, stats: computeIndicatorPeriod(ind, view.firm.alternative, period, view.config) }))
        .sort((a, b) => (a.stats.score ?? Infinity) - (b.stats.score ?? Infinity)),
    [indicators, view.firm.alternative, view.config, period],
  )
  const periodMonths = rows.find((r) => r.stats.months.length > 0)?.stats.months ?? []
  const hasSignals = ev.earlyWarnings.critical.length > 0 || ev.earlyWarnings.watch.length > 0
  return (
    <Card title="Erken uyarı ve izleme" subtitle={`Aktif model ve güncel veriyle · ${periodCaption(periodMonths, period)}`}>
      <p className="label-caps mb-2">Erken uyarı sinyalleri</p>
      {hasSignals ? (
        <ul className="mb-4 space-y-2">
          {ev.earlyWarnings.critical.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm text-ink">
              <AlertOctagon size={15} className="mt-0.5 shrink-0 text-negative" />
              <span>
                <span className="font-medium">Kritik:</span> {s.source === 'kkb' && 'KKB · '}
                {s.label}
              </span>
            </li>
          ))}
          {ev.earlyWarnings.watch.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm text-ink">
              <Eye size={15} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {s.source === 'kkb' && 'KKB · '}
                {s.label}
                {s.indicators && `: ${s.indicators.map((i) => indicators[i]?.label ?? i).join(', ')}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted">Aktif erken uyarı sinyali yok.</p>
      )}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">İzlenmesi gereken göstergeler</p>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <p className="mb-2 text-xs text-muted">Seçili dönemde zayıftan güçlüye; tutar dönem ortalaması, yüzde {formatPeriodComparison(period)} değişim.</p>
      <ul className="space-y-2.5">
        {rows.map(({ id, ind, stats }) => (
          <li key={id} className="border-b border-line pb-2.5 text-sm last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <IndicatorName label={ind.label} aciklama={ind.aciklama} birimAciklamasi={ind.birimAciklamasi} labelClassName="text-ink" />
              {stats.strength ? <Badge tone={STRENGTH_TONE[stats.strength]}>{stats.strength}</Badge> : <Badge>Yetersiz veri</Badge>}
            </div>
            <div className="mt-1 grid grid-cols-[1fr_6rem] items-center gap-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="num text-ink">{formatSeriesAverage(stats.average, ind.seriesUnit)}</span>
                <PeriodChange stats={stats} />
              </div>
              {stats.spark.values.length > 0 && <Sparkline values={stats.spark.values} months={stats.spark.months} height={28} highlightFrom={stats.months[0]} />}
            </div>
          </li>
        ))}
      </ul>
      <PeriodNote className="mt-3 border-t border-line pt-2.5" />
    </Card>
  )
}

export function PortfolioFirmDetail({ firmId }: { firmId: string }) {
  const view = useFirmView(firmId)
  const activeVersion = useActiveVersion()

  if (!view) {
    return (
      <AppShell role="portfoy" title="Firma bulunamadı">
        <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/portfoy/firmalar')}>
          Firma listesine dön
        </Button>
      </AppShell>
    )
  }

  const d = view.decision
  const ev = view.current
  const oldModel = d && d.modelVersion !== activeVersion

  return (
    <AppShell
      role="portfoy"
      title="Firma Detayı"
      breadcrumb={
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => navigate('/portfoy/firmalar')}>
          <ArrowLeft size={12} />
          Firma Listesi
        </button>
      }
    >
      <div className="space-y-4">
        {oldModel && (
          <div className="flex items-start gap-2 rounded-md border border-[#c8dedc] bg-accent-soft px-4 py-2.5 text-[0.8125rem] text-ink">
            <Info size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>
              Karar {d.modelVersion} modeliyle verildi, güncel model önerisi: <span className="num font-medium">{ev.limit.limit > 0 ? formatTL(ev.limit.limit) : 'limit yok'}</span> (not{' '}
              <span className="num font-medium">{ev.grade}</span>, Model {activeVersion}).
            </span>
          </div>
        )}

        <Card bodyClassName="p-0">
          <div className="grid lg:grid-cols-[1fr_auto]">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-navy">{view.firm.name}</h2>
                <PortfolioStatusBadge view={view} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {view.config.sectors[view.firm.sectorId].label} · {SEGMENT_LABELS[view.firm.segment]}
                {view.firm.groupCompanies ? ` (${view.firm.groupCompanies} grup şirketi)` : ''} · {view.firm.city} · VKN <span className="num">{view.firm.vkn}</span>
              </p>
              <dl className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-6 gap-y-3">
                <div>
                  <dt className="text-xs text-muted">Onaylı limit</dt>
                  <dd className="num mt-0.5 whitespace-nowrap text-sm">{approvedLimit(view) > 0 ? formatTL(approvedLimit(view)) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Kullandırılan</dt>
                  <dd className="num mt-0.5 whitespace-nowrap text-sm">{approvedLimit(view) > 0 ? formatTL(utilizedAmount(view)) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Karar tarihi</dt>
                  <dd className="num mt-0.5 whitespace-nowrap text-sm">{d ? formatDateTime(d.decidedAt) : 'Karar bekleniyor'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Karar notu</dt>
                  <dd className="mt-0.5">{d ? <GradeBadge grade={d.system.grade} /> : '—'}</dd>
                </div>
              </dl>
            </div>
            <div className="flex items-center justify-center gap-5 border-t border-line px-5 py-4 lg:border-l lg:border-t-0">
              <Gauge score={ev.score} label="Mevcut Skor" size={164} />
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted">Mevcut not</p>
                  <div className="mt-1">
                    <GradeBadge grade={ev.grade} large />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted">Temerrüt olasılığı</p>
                  <p className="num text-base font-semibold">{formatPercent(ev.pd, 2)}</p>
                </div>
                <ModelVersionTag version={activeVersion} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="min-w-0 space-y-4 xl:col-span-8">
            <Card title="12 aylık skor trendi" subtitle="Her ay, o aya kadarki veriyle aktif modelden hesaplanır">
              <ScoreTrendChart view={view} />
            </Card>
            {d ? (
              <Comparison view={view} />
            ) : (
              <Card title="Sistem Görüşü ve Tahsis Yöneticisi Kararı">
                <p className="text-sm text-muted">Başvuru tahsis kararı bekliyor. Sistem önerisi: {ev.limit.limit > 0 ? formatTL(ev.limit.limit) : 'limit yok'}.</p>
              </Card>
            )}
            {d && (
              <Card title="Tahsisçinin gerekçe notu" subtitle={`${d.decidedBy} · ${formatDateTime(d.decidedAt)}`}>
                {d.rejectionReason && (
                  <p className="mb-2 text-sm">
                    <span className="text-muted">Red gerekçesi: </span>
                    <span className="font-medium text-negative">{REJECTION_REASONS[d.rejectionReason]}</span>
                  </p>
                )}
                <p className="text-sm leading-relaxed text-ink">{d.note}</p>
              </Card>
            )}
          </div>
          <div className="min-w-0 space-y-4 xl:col-span-4">
            <Monitoring view={view} />
            <KkbCompact view={view} />
            <LimitDetail view={view} />
            <MarketIntelCompact sectorId={view.firm.sectorId} sectorLabel={view.config.sectors[view.firm.sectorId].label} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
