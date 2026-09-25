import { AlertOctagon, ChevronRight, Eye, Info, Landmark } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FirmEvaluation } from '../engine/evaluate'
import type { KkbFollowUp, KkbSnapshot } from '../engine/kkb'
import { KKB_CREDIT_TYPE_LABELS, type ModelConfig } from '../engine/modelConfig'
import { formatNumber, formatPercent, formatSignedPercent, formatTL, formatTLShort, formatYearMonth } from '../lib/format'
import { navigate } from '../lib/router'
import type { FirmView } from '../store/evaluations'
import { CHART_COLORS } from './charts'
import { Badge, Card, cx } from './ui'

export const FOLLOW_UP_LABELS: Record<KkbFollowUp, string> = { none: 'Yok', legal: 'Yasal takipte' }

const tooltipStyle = { border: '1px solid #E3E1DA', borderRadius: 4, fontSize: 12, fontFamily: 'IBM Plex Sans' }

/** "KKB entegrasyonu – simülasyon verisi" etiketi. */
export function KkbSimLabel({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={cx('whitespace-nowrap', className)}>
      KKB entegrasyonu – simülasyon verisi
    </Badge>
  )
}

/** KKB kaynaklı erken uyarı rozetleri. */
export function KkbSignalBadges({ evaluation, prefix = true }: { evaluation: FirmEvaluation; prefix?: boolean }) {
  const critical = evaluation.earlyWarnings.critical.filter((s) => s.source === 'kkb')
  const watch = evaluation.earlyWarnings.watch.filter((s) => s.source === 'kkb')
  if (critical.length + watch.length === 0) return null
  return (
    <>
      {critical.map((s) => (
        <Badge key={s.id} tone="negative" className="whitespace-normal">
          <AlertOctagon size={12} className="shrink-0" />
          {prefix && 'KKB: '}
          {s.label}
        </Badge>
      ))}
      {watch.map((s) => (
        <Badge key={s.id} tone="warning" className="whitespace-normal">
          <Eye size={12} className="shrink-0" />
          {prefix && 'KKB: '}
          {s.label}
        </Badge>
      ))}
    </>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'negative' | 'warning' }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('num mt-0.5 text-base font-semibold', tone === 'negative' ? 'text-negative' : tone === 'warning' ? 'text-warning' : 'text-navy')}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-muted">{hint}</p>}
    </div>
  )
}

function RiskTrendChart({ k }: { k: KkbSnapshot }) {
  const data = k.riskSeries.months.map((m, i) => ({ m, cash: k.riskSeries.cash[i], nonCash: k.riskSeries.nonCash[i] }))
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="m" tickFormatter={(m) => formatYearMonth(String(m))} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={{ stroke: '#E3E1DA' }} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => formatTLShort(Number(v)).replace(' ₺', '')} tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={64} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(m) => formatYearMonth(String(m))} formatter={(v, name) => [formatTL(Number(v)), name === 'cash' ? 'Nakdi risk' : 'Gayrinakdi risk']} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} formatter={(name) => (name === 'cash' ? 'Nakdi risk' : 'Gayrinakdi risk')} />
          <Area type="monotone" dataKey="cash" stackId="r" stroke={CHART_COLORS.navy} fill={CHART_COLORS.navy} fillOpacity={0.18} strokeWidth={1.5} isAnimationActive={false} />
          <Area type="monotone" dataKey="nonCash" stackId="r" stroke={CHART_COLORS.petrol} fill={CHART_COLORS.petrol} fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function DelayChart({ k }: { k: KkbSnapshot }) {
  const data = k.riskSeries.months.map((m, i) => ({ m, days: k.delaySeries[i] }))
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="m" tickFormatter={(m) => formatYearMonth(String(m))} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={{ stroke: '#E3E1DA' }} tickLine={false} minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={{ fill: '#F1EFE9' }} contentStyle={tooltipStyle} labelFormatter={(m) => formatYearMonth(String(m))} formatter={(v) => [`${v} gün`, 'En yüksek gecikme']} />
          <Bar dataKey="days" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.m} fill={d.days === 0 ? '#E3E1DA' : d.days >= 90 ? '#B42318' : '#B7791F'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Tahsis Yöneticisi değerlendirme ekranındaki "KKB / Diğer Bankalar" sekmesi. */
export function KkbTab({ evaluation, config }: { evaluation: FirmEvaluation; config: ModelConfig }) {
  const kkb = evaluation.kkb
  if (!kkb) {
    return (
      <Card title="KKB / Diğer Bankalar">
        <p className="text-sm text-muted">Bu firma için KKB risk raporu yok.</p>
      </Card>
    )
  }
  const k = kkb.snapshot
  const hasSignals = kkb.signals.length > 0
  return (
    <div className="space-y-4">
      <Card
        title="KKB Risk Raporu · Diğer bankalar"
        subtitle={`Rapor ayı: ${formatYearMonth(k.asOf)} · ${k.banks.length} banka`}
        actions={<KkbSimLabel />}
      >
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Kpi label="Findeks kredi notu" value={`${formatNumber(k.findeks)} / 1.900`} tone={kkb.signals.some((s) => s.id === 'lowFindeks') ? 'warning' : undefined} />
          <Kpi label="Toplam limit" value={formatTL(k.totalLimit)} hint={`Nakdi ${formatTLShort(k.totalCashLimit)} · Gayrinakdi ${formatTLShort(k.totalNonCashLimit)}`} />
          <Kpi label="Toplam risk" value={formatTL(k.totalRisk)} hint={`Nakdi ${formatTLShort(k.totalCashRisk)} · Gayrinakdi ${formatTLShort(k.totalNonCashRisk)}`} />
          <Kpi label="Doluluk oranı" value={formatPercent(k.utilization, 0)} hint="Kullanılan limit payı" />
          <Kpi label={`Kredi sorgusu (son ${config.kkb.signals.inquiries.windowMonths} ay)`} value={formatNumber(k.inquiries)} tone={kkb.signals.some((s) => s.id === 'inquiries') ? 'warning' : undefined} />
          <Kpi label="En yüksek gecikme (12 ay)" value={`${formatNumber(Math.max(0, ...k.banks.map((b) => b.maxDelayDays12m)))} gün`} tone={kkb.signals.some((s) => s.id === 'overdue') ? 'negative' : undefined} />
          <Kpi label="Karşılıksız çek (12 ay)" value={formatNumber(k.bouncedCheques12m)} tone={k.bouncedCheques12m > 0 ? 'negative' : undefined} />
          <Kpi label="Protestolu senet (12 ay)" value={formatNumber(k.protestedBills12m)} tone={k.protestedBills12m > 0 ? 'warning' : undefined} />
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <p className="label-caps mb-2">KKB erken uyarı sinyalleri</p>
          {hasSignals ? (
            <div className="flex flex-wrap gap-1.5">
              <KkbSignalBadges evaluation={evaluation} prefix={false} />
            </div>
          ) : (
            <p className="text-sm text-muted">KKB kaynaklı erken uyarı sinyali yok.</p>
          )}
        </div>
      </Card>

      <Card title="Banka bazında riskler" subtitle="Nakdi ve gayrinakdi limit ve riskler, son 12 ayın en yüksek gecikmesi, takip durumu" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/60 text-left">
                <th className="label-caps px-5 py-2.5 font-semibold">Banka</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Kredi türü</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Nakdi limit</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Nakdi risk</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Gayrinakdi limit</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Gayrinakdi risk</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Doluluk</th>
                <th className="label-caps px-3 py-2.5 text-right font-semibold">Gecikme (12 ay)</th>
                <th className="label-caps px-3 py-2.5 font-semibold">Takip</th>
              </tr>
            </thead>
            <tbody>
              {k.banks.map((b) => {
                const limit = b.cashLimit + b.nonCashLimit
                return (
                  <tr key={b.bank} className="border-b border-line">
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium text-ink">{b.bank}</td>
                    <td className="px-3 py-2.5 text-muted">{b.types.map((t) => KKB_CREDIT_TYPE_LABELS[t]).join(', ')}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(b.cashLimit)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(b.cashRisk)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">{b.nonCashLimit > 0 ? formatTL(b.nonCashLimit) : '—'}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">{b.nonCashLimit > 0 ? formatTL(b.nonCashRisk) : '—'}</td>
                    <td className="num px-3 py-2.5 text-right">{limit > 0 ? formatPercent((b.cashRisk + b.nonCashRisk) / limit, 0) : '—'}</td>
                    <td className={cx('num px-3 py-2.5 text-right', b.maxDelayDays12m >= 90 ? 'font-semibold text-negative' : b.maxDelayDays12m > 0 ? 'text-warning' : 'text-muted')}>
                      {b.maxDelayDays12m > 0 ? `${b.maxDelayDays12m} gün` : 'Yok'}
                    </td>
                    <td className="px-3 py-2.5">{b.followUp === 'legal' ? <Badge tone="negative">{FOLLOW_UP_LABELS.legal}</Badge> : <span className="text-muted">Yok</span>}</td>
                  </tr>
                )
              })}
              <tr className="bg-subtle/60 font-semibold">
                <td className="px-5 py-2.5 text-ink" colSpan={2}>
                  Toplam
                </td>
                <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(k.totalCashLimit)}</td>
                <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(k.totalCashRisk)}</td>
                <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(k.totalNonCashLimit)}</td>
                <td className="num whitespace-nowrap px-3 py-2.5 text-right">{formatTL(k.totalNonCashRisk)}</td>
                <td className="num px-3 py-2.5 text-right">{formatPercent(k.utilization, 0)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Risk trendi" subtitle="Diğer bankalardaki toplam risk, aylık">
          <RiskTrendChart k={k} />
        </Card>
        <Card title="Gecikme geçmişi" subtitle="Tüm bankalarda ayın en yüksek gecikme günü">
          <DelayChart k={k} />
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-[0.8125rem] text-ink">
        <Info size={15} className="mt-0.5 shrink-0 text-accent" />
        <div className="space-y-1">
          <p>
            Diğer bankalardaki işletme sermayesi kredileri: <span className="num font-medium">{formatTL(k.workingCapitalCashRisk)}</span>. Limit önerisinde, işletme
            sermayesi ihtiyacının bu kısmının diğer bankalarca finanse edildiği dikkate alınır.
          </p>
          <p>
            Taksitli kredilerin önümüzdeki 12 aydaki anapara ödemeleri: <span className="num font-medium">{formatTL(k.annualDebtService)}</span>
            {kkb.debtServiceSource === 'kkb' ? ' (borç servis kapasitesinde bu tutar kullanılır).' : '.'}
          </p>
          <p className="text-muted">
            {config.kkb.findeks.includeInScore ? 'Findeks notu nihai skora dahildir.' : 'Findeks notu skora dahil değildir; bilgi ve erken uyarı amacıyla kullanılır.'}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Portföy Yöneticisi firma detayında kompakt KKB özeti (aktif model, güncel veri). */
export function KkbCompact({ view }: { view: FirmView }) {
  const kkb = view.current.kkb
  if (!kkb) return null
  const k = kkb.snapshot
  const lookback = view.config.kkb.signals.riskGrowth.lookbackMonths
  return (
    <Card title="KKB özeti" subtitle={`Diğer bankalar · ${formatYearMonth(k.asOf)}`} actions={<Landmark size={16} className="text-faint" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <div>
          <dt className="text-xs text-muted">Findeks notu</dt>
          <dd className="num font-semibold text-navy">{formatNumber(k.findeks)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Toplam risk</dt>
          <dd className="num font-semibold text-navy">{formatTLShort(k.totalRisk)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Doluluk</dt>
          <dd className="num text-ink">{formatPercent(k.utilization, 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Son {lookback} ayda risk</dt>
          <dd className={cx('num', k.riskGrowth !== null && k.riskGrowth > 0 ? 'text-negative' : 'text-ink')}>{k.riskGrowth === null ? '—' : formatSignedPercent(k.riskGrowth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">En yüksek gecikme (12 ay)</dt>
          <dd className={cx('num', k.banks.some((b) => b.maxDelayDays12m > 0) ? 'text-warning' : 'text-ink')}>
            {Math.max(0, ...k.banks.map((b) => b.maxDelayDays12m))} gün
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Takip</dt>
          <dd className={k.legalFollowUp ? 'font-medium text-negative' : 'text-ink'}>{k.legalFollowUp ? FOLLOW_UP_LABELS.legal : 'Yok'}</dd>
        </div>
      </dl>
      {kkb.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          <KkbSignalBadges evaluation={view.current} prefix={false} />
        </div>
      )}
      <div className="mt-3 border-t border-line pt-2.5">
        <KkbSimLabel />
      </div>
    </Card>
  )
}

/** Portföy Özeti: diğer bankalarda riski artan portföy firmaları. */
export function KkbRiskRisers({ views, config }: { views: FirmView[]; config: ModelConfig }) {
  const lookback = config.kkb.signals.riskGrowth.lookbackMonths
  const rows = views
    .filter((v) => v.current.kkb && v.current.kkb.snapshot.riskGrowth !== null && v.current.kkb.snapshot.riskGrowth > 0)
    .sort((a, b) => b.current.kkb!.snapshot.riskGrowth! - a.current.kkb!.snapshot.riskGrowth!)
  return (
    <Card title="Diğer bankalarda riski artan firmalar" subtitle={`Portföy firmaları · KKB toplam riskinin son ${lookback} aydaki değişimi`} actions={<KkbSimLabel />} bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Diğer bankalarda riski artan portföy firması yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((v) => {
            const k = v.current.kkb!.snapshot
            const flagged = v.current.kkb!.signals.some((s) => s.id === 'riskGrowth')
            return (
              <li key={v.firm.id}>
                <button type="button" onClick={() => navigate(`/portfoy/firma/${v.firm.id}`)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-subtle/60">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{v.firm.name}</span>
                    <span className="num text-xs text-muted">Toplam risk {formatTLShort(k.totalRisk)} · Findeks {formatNumber(k.findeks)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {flagged && <Badge tone="warning">Hızlı artış</Badge>}
                    <span className={cx('num text-sm font-semibold', flagged ? 'text-negative' : 'text-ink')}>{formatSignedPercent(k.riskGrowth!)}</span>
                    <ChevronRight size={16} className="text-faint" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
