import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../../components/charts'
import { ModelShell } from '../../components/model/ModelShell'
import { Card } from '../../components/ui'
import { diffConfigs, type ConfigChange } from '../../engine/configDiff'
import { CREDIT_GRADES, DEFAULT_MODEL_CONFIG, type ModelConfig } from '../../engine/modelConfig'
import { formatDateTime, formatNumber, formatPercent, formatScore, formatTL } from '../../lib/format'
import { useAppState } from '../../store/appStore'
import { useFirmViews } from '../../store/evaluations'
import { useModelEditor } from '../../store/modelEditor'
import { KpiCard } from '../portfoy/common'

export function formatParamValue(v: unknown): string {
  if (typeof v === 'number') return formatNumber(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 3 : 2)
  if (typeof v === 'boolean') return v ? 'Açık' : 'Kapalı'
  if (v === undefined || v === null) return '—'
  return String(v)
}

export function DiffTable({ changes, beforeLabel, afterLabel, empty }: { changes: ConfigChange[]; beforeLabel: string; afterLabel: string; empty: string }) {
  if (changes.length === 0) return <p className="px-5 py-5 text-sm text-muted">{empty}</p>
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left">
            <th className="label-caps px-5 py-2 font-semibold">Parametre</th>
            <th className="label-caps px-3 py-2 text-right font-semibold">{beforeLabel}</th>
            <th className="label-caps px-5 py-2 text-right font-semibold">{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.path} className="border-b border-line last:border-b-0">
              <td className="px-5 py-2 text-ink">{c.label}</td>
              <td className="num px-3 py-2 text-right text-muted">{formatParamValue(c.before)}</td>
              <td className="num px-5 py-2 text-right font-medium text-navy">{formatParamValue(c.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ModelOverview() {
  const editor = useModelEditor()
  const versions = useAppState((s) => s.versions)
  const activeVersion = useAppState((s) => s.activeVersion)
  const lastChange = useAppState((s) => s.lastChange)
  const views = useFirmViews()
  const active = versions.find((v) => v.version === activeVersion)!

  const evals = views.map((v) => v.current)
  const avgScore = evals.reduce((a, e) => a + e.score, 0) / evals.length
  const avgPd = evals.reduce((a, e) => a + e.pd, 0) / evals.length
  const totalLimit = evals.reduce((a, e) => a + e.limit.limit, 0)
  const gradeData = CREDIT_GRADES.map((g) => ({ grade: g, count: evals.filter((e) => e.grade === g).length }))

  const vsBase = diffConfigs(DEFAULT_MODEL_CONFIG as ModelConfig, editor.active)
  const pending = diffConfigs(editor.active, editor.working)

  return (
    <ModelShell title="Model Genel Bakış">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card title="Aktif model sürümü">
          <p className="num text-2xl font-semibold text-navy">{activeVersion}</p>
          <p className="mt-1 text-sm text-muted">{active.note}</p>
        </Card>
        <Card title="Son değişiklik">
          <p className="num text-base font-medium text-ink">{formatDateTime(lastChange.at)}</p>
          <p className="mt-1 text-sm text-muted">{lastChange.by}</p>
        </Card>
        <Card title="Çalışma durumu">
          <p className="text-sm text-ink">
            {pending.length === 0 ? 'Aktif modelle aynı; bekleyen değişiklik yok.' : `Aktif modele göre ${pending.length} parametre değişikliği`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {editor.hasDraft ? 'Kayıtlı taslak var.' : 'Kayıtlı taslak yok.'}
            {editor.dirty && ' Kaydedilmemiş değişiklikler var.'}
            {editor.issues.length > 0 && ` ${editor.issues.length} doğrulama hatası.`}
          </p>
        </Card>
      </div>

      <p className="label-caps mb-2">Portföy geneli · aktif model, güncel veri, {views.length} firma</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Ortalama skor" value={formatScore(avgScore)} />
        <KpiCard label="Toplam önerilen limit" value={formatTL(totalLimit)} />
        <KpiCard label="Ortalama PD" value={formatPercent(avgPd, 2)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Not dağılımı" subtitle="Tüm firmalar, aktif model">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#E3E1DA' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F1EFE9' }} formatter={(v) => [`${v} firma`, 'Adet']} contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                <Bar dataKey="count" fill={CHART_COLORS.navy} radius={[2, 2, 0, 0]} maxBarSize={44} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Aktif model ile v1.0 arasındaki farklar" subtitle={`${vsBase.length} parametre farklı`} bodyClassName="p-0">
          <DiffTable changes={vsBase} beforeLabel="v1.0" afterLabel={activeVersion} empty="Aktif model v1.0 varsayılanlarıyla aynı." />
        </Card>
      </div>

      <Card title="Aktif modele göre bekleyen değişiklikler" subtitle="Taslak ve kaydedilmemiş düzenlemeler (aktif model değişmez)" className="mt-4" bodyClassName="p-0">
        <DiffTable changes={pending} beforeLabel={`Aktif (${activeVersion})`} afterLabel="Çalışma kopyası" empty="Bekleyen değişiklik yok." />
      </Card>
    </ModelShell>
  )
}
