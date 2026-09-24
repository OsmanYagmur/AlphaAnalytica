import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../../components/charts'
import { ImpactSummaryCards, ImpactTable, firmName } from '../../components/model/impact'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, GradeBadge, cx, inputClass } from '../../components/ui'
import { FIRMS, getFirm } from '../../data'
import { evaluateFirm } from '../../engine/evaluate'
import { scoreWaterfall } from '../../engine/impact'
import { LENDABLE_GRADES } from '../../engine/modelConfig'
import { runSensitivity, sensitivityParams } from '../../engine/sensitivity'
import { formatNumber, formatScore, formatTL } from '../../lib/format'
import { useAppState } from '../../store/appStore'
import { useImpact, useModelEditor } from '../../store/modelEditor'

const tooltipStyle = { fontSize: 12, borderRadius: 4, border: '1px solid #E3E1DA' }

type WaterfallBar = { name: string; offset: number; value: number; kind: 'total' | 'up' | 'down'; delta: number }

/** Şelale çubukları: görünmez taban + görünür değişim (yığılmış çubuk tekniği). */
function waterfallBars(before: number, after: number, steps: { label: string; delta: number }[]): WaterfallBar[] {
  const bars: WaterfallBar[] = [{ name: 'Mevcut skor', offset: 0, value: before, kind: 'total', delta: before }]
  steps.reduce((start, s) => {
    const end = start + s.delta
    bars.push({ name: s.label, offset: Math.min(start, end), value: Math.abs(s.delta), kind: s.delta >= 0 ? 'up' : 'down', delta: s.delta })
    return end
  }, before)
  bars.push({ name: 'Yeni skor', offset: 0, value: after, kind: 'total', delta: after })
  return bars
}

function Waterfall({ firmId }: { firmId: string }) {
  const e = useModelEditor()
  const firm = getFirm(firmId)!
  const w = useMemo(() => scoreWaterfall(firm, e.active, e.working), [firm, e.active, e.working])
  const steps = w.steps.filter((s) => Math.abs(s.delta) >= 0.005)

  const data = waterfallBars(w.before, w.after, steps)
  const lows = data.map((d) => (d.kind === 'total' ? d.value : d.offset))
  const highs = data.map((d) => d.offset + d.value)
  const lo = Math.max(0, Math.floor(Math.min(...lows) - 3))
  const hi = Math.min(100, Math.ceil(Math.max(...highs) + 3))
  // Tek renk ailesi: toplamlar lacivert, artış petrol, azalış soluk lacivert
  const color = (k: string) => (k === 'total' ? CHART_COLORS.navy : k === 'up' ? CHART_COLORS.petrol : '#8FA1B8')

  return (
    <div>
      {steps.length === 0 && <p className="mb-2 text-sm text-muted">Bu firma için skor değişimi yok.</p>}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: -8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={{ stroke: '#E3E1DA' }} tickLine={false} />
            <YAxis domain={[lo, hi]} allowDataOverflow tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#F1EFE9' }}
              contentStyle={tooltipStyle}
              formatter={(_v, name, item) => {
                if (name !== 'value') return [null, null]
                const d = item.payload as (typeof data)[number]
                return [d.kind === 'total' ? formatScore(d.delta) : `${d.delta > 0 ? '+' : ''}${formatNumber(d.delta, 2)} puan`, d.kind === 'total' ? 'Skor' : 'Katkı değişimi']
              }}
            />
            <Bar dataKey="offset" stackId="w" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="w" isAnimationActive={false} maxBarSize={42}>
              {data.map((d, i) => (
                <Cell key={i} fill={color(d.kind)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Sensitivity({ firmId }: { firmId: string }) {
  const e = useModelEditor()
  const firm = getFirm(firmId)!
  const params = useMemo(() => sensitivityParams(e.working, firm.sectorId), [e.working, firm.sectorId])
  const [paramId, setParamId] = useState('final.alternative')
  const param = params.find((p) => p.id === paramId) ?? params[0]
  const points = useMemo(() => runSensitivity(firm, e.working, param, 25), [firm, e.working, param])
  const current = param.get(e.working)
  const data = points.map((p) => ({ x: p.value * param.scale, score: p.score, grade: p.grade }))
  const thresholds = LENDABLE_GRADES.map((g) => ({ g, v: e.working.rating.minScore[g] }))
  const scores = points.map((p) => p.score)
  const lo = Math.max(0, Math.floor(Math.min(...scores) - 5))
  const hi = Math.min(100, Math.ceil(Math.max(...scores) + 5))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={cx(inputClass, 'max-w-sm')} value={param.id} onChange={(ev) => setParamId(ev.target.value)} aria-label="Parametre">
          {params.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="num text-xs text-muted">
          Aralık {formatNumber(param.min * param.scale, param.scale === 100 ? 0 : 1)}–{formatNumber(param.max * param.scale, param.scale === 100 ? 0 : 1)} {param.unit} · mevcut{' '}
          {formatNumber(current * param.scale, 1)} {param.unit}
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 36, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} />
            <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => formatNumber(Number(v), param.scale === 100 ? 0 : 1)} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
            <YAxis domain={[lo, hi]} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
            {thresholds
              .filter((t) => t.v > lo && t.v < hi)
              .map((t) => (
                <ReferenceLine key={t.g} y={t.v} stroke="#C9CCD3" strokeDasharray="3 3" label={{ value: t.g, position: 'right', fontSize: 10, fill: '#8A91A0' }} />
              ))}
            <ReferenceLine x={current * param.scale} stroke={CHART_COLORS.petrol} strokeDasharray="4 3" label={{ value: 'mevcut', position: 'top', fontSize: 10, fill: CHART_COLORS.petrol }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(x) => `${param.label}: ${formatNumber(Number(x), 1)} ${param.unit}`}
              formatter={(v, _n, item) => [`${formatScore(Number(v))} · ${(item.payload as { grade: string }).grade}`, 'Skor · Not']}
            />
            <Line type="monotone" dataKey="score" stroke={CHART_COLORS.navy} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">Diğer tüm parametreler çalışma kopyasındaki değerlerinde tutulur; ağırlık gruplarında kalan pay diğer ağırlıklara orantılı dağıtılır.</p>
    </div>
  )
}

export function ModelImpact() {
  const e = useModelEditor()
  const { firms, summary } = useImpact()
  const activeVersion = useAppState((s) => s.activeVersion)
  const [focus, setFocus] = useState('defne-kirtasiye')
  const firm = getFirm(focus)!
  const before = useMemo(() => evaluateFirm(firm, e.active), [firm, e.active])
  const after = useMemo(() => evaluateFirm(firm, e.working), [firm, e.working])

  return (
    <ModelShell title="Etki Simülasyonu" impactPanel={false}>
      <p className="mb-3 text-sm text-muted">
        Mevcut: aktif model ({activeVersion}). Yeni: kaydedilmemiş ve taslaktaki parametreler ({e.pending.length} değişiklik). Tüm firmalar güncel veriyle hesaplanır.
      </p>
      <ImpactSummaryCards summary={summary} />

      <Card title="Tüm firmalar: mevcut → yeni" subtitle="Notu değişen satırlar vurgulanır; odak için bir satıra tıklayın" className="mt-4" bodyClassName="p-0">
        <ImpactTable rows={firms} onSelect={setFocus} selected={focus} />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card
          title="Tek firma odak modu"
          subtitle="Skor değişiminin kategori bazında şelale grafiği"
          actions={
            <select className={cx(inputClass, 'h-8 w-56 text-xs')} value={focus} onChange={(ev) => setFocus(ev.target.value)} aria-label="Firma">
              {FIRMS.map((f) => (
                <option key={f.id} value={f.id}>
                  {firmName(f.id)}
                </option>
              ))}
            </select>
          }
        >
          <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border border-line px-3 py-2">
              <p className="text-[0.6875rem] text-muted">Skor</p>
              <p className="num font-semibold">
                {formatScore(before.score)} → {formatScore(after.score)}
              </p>
            </div>
            <div className="rounded-md border border-line px-3 py-2">
              <p className="text-[0.6875rem] text-muted">Not</p>
              <p className="flex items-center gap-1">
                <GradeBadge grade={before.grade} /> → <GradeBadge grade={after.grade} />
              </p>
            </div>
            <div className="rounded-md border border-line px-3 py-2">
              <p className="text-[0.6875rem] text-muted">Limit</p>
              <p className="num text-[0.8125rem] font-semibold">
                {formatTL(before.limit.limit)} → {formatTL(after.limit.limit)}
              </p>
            </div>
          </div>
          <Waterfall firmId={focus} />
          <p className="mt-1 flex flex-wrap gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-navy" />Toplam skor</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Skoru artıran</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#8FA1B8]" />Skoru azaltan</span>
          </p>
        </Card>
        <Card title="Duyarlılık analizi" subtitle={`${firmName(focus)} · seçilen parametre min–max arasında kaydırılır`}>
          <Sensitivity firmId={focus} />
        </Card>
      </div>
    </ModelShell>
  )
}
