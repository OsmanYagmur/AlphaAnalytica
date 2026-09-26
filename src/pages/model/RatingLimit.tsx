import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../../components/charts'
import { Formula, InlineError, ParamInput, SelectParam, Switch } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, NumberInput, cx } from '../../components/ui'
import { CREDIT_GRADES, LENDABLE_GRADES, type CreditGrade } from '../../engine/modelConfig'
import { probabilityOfDefault } from '../../engine/rating'
import { formatNumber, formatPercent } from '../../lib/format'
import { editorActions, useModelEditor } from '../../store/modelEditor'

function Cell({ path, step, min, max, scale = 1, suffix }: { path: string; step: number; min?: number; max?: number; scale?: number; suffix?: string }) {
  const e = useModelEditor()
  const v = e.get(path) as number
  const error = e.issueAt(path)
  return (
    <div>
      <NumberInput value={Math.round(v * scale * 1e6) / 1e6} onChange={(n) => editorActions.set(path, n / scale)} step={step} min={min} max={max} suffix={suffix} edited={e.isEdited(path)} invalid={!!error} ariaLabel={path} />
      <InlineError message={error} />
    </div>
  )
}

function PdCurve() {
  const e = useModelEditor()
  const data = Array.from({ length: 51 }, (_, i) => ({ s: i * 2, pd: probabilityOfDefault(i * 2, e.working) * 100 }))
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} />
          <XAxis dataKey="s" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `%${v}`} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} labelFormatter={(s) => `S = ${s}`} formatter={(v) => [`%${formatNumber(Number(v), 2)}`, 'PD']} />
          <Line type="monotone" dataKey="pd" stroke={CHART_COLORS.petrol} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const CRITICAL = [
  { id: 'declarationInconsistency', hasThreshold: true },
  { id: 'bouncedCheque', hasThreshold: false },
  { id: 'taxOrSgkDebt', hasThreshold: false },
] as const

const WATCH = [
  { id: 'weakIndicator', field: 'maxScore', step: 5, scale: 1, suffix: 'puan', hint: 'Gösterge puanı bu değer veya altındaysa' },
  { id: 'negativeTrend', field: 'maxAnnualGrowth', step: 1, scale: 100, suffix: '%', hint: 'Arındırılmış yıllık büyüme bu değer veya altındaysa' },
  { id: 'scoreDivergence', field: 'minGap', step: 5, scale: 1, suffix: 'puan', hint: 'G − A farkı bu değer veya üstündeyse' },
] as const

export function ModelRatingLimit() {
  const e = useModelEditor()
  const w = e.working
  const gradeOptions = LENDABLE_GRADES.map((g) => ({ value: g, label: `En fazla ${g}` }))

  return (
    <ModelShell title="Not, PD ve Limit Parametreleri">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Harf notu eşikleri ve not çarpanları" subtitle="Eşikler kesin azalan sırada olmalı, çakışamaz" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps px-5 py-2 font-semibold">Not</th>
                <th className="label-caps px-3 py-2 font-semibold">Skor alt sınırı</th>
                <th className="label-caps px-5 py-2 font-semibold">Not çarpanı (f)</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_GRADES.map((g: CreditGrade) => (
                <tr key={g} className="border-b border-line last:border-b-0 align-top">
                  <td className="num px-5 py-2.5 font-semibold text-navy">{g}</td>
                  <td className="w-44 px-3 py-2">
                    {g === 'C' ? <p className="pt-2 text-xs text-muted">B eşiğinin altı · limit verilmez</p> : <Cell path={`rating.minScore.${g}`} step={1} min={0} max={100} />}
                  </td>
                  <td className="w-44 px-5 py-2">
                    <Cell path={`limit.gradeMultiplier.${g}`} step={0.05} min={0} max={1} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Temerrüt olasılığı (PD)">
          <Formula>
            PD = 1 / (1 + e^((S − {formatNumber(w.rating.pd.center, 1)}) / {formatNumber(w.rating.pd.scale, 1)}))
          </Formula>
          <div className="mt-2">
            <ParamInput path="rating.pd.center" label="Merkez" hint="PD'nin %50 olduğu skor" step={1} min={0} max={100} />
            <ParamInput path="rating.pd.scale" label="Ölçek" hint="Eğrinin yatıklığı" step={0.5} min={0.5} />
          </div>
          <PdCurve />
        </Card>

        <Card title="Limit kapasitesi">
          <div className="space-y-1.5">
            <Formula>
              K1 = Net Satış × max(NDS; {formatNumber(w.limit.k1.minDays, 0)}) / {w.daysInYear} × {formatNumber(w.limit.k1.multiplier, 2)}
            </Formula>
            <Formula>K2 = Özkaynak × {formatNumber(w.limit.k2.equityMultiplier, 2)}</Formula>
            <Formula>
              K3 = max(0; FAVÖK × {formatNumber(w.limit.k3.ebitdaRatio, 2)} − Mevcut Yıllık Kredi Ödemeleri) × {formatNumber(w.limit.k3.multiplier, 2)}
            </Formula>
            <Formula>Önerilen Limit = min(K1; K2; K3) × f × SRK → {formatNumber(w.limit.roundingUnit, 0)} TL'ye aşağı yuvarlanır</Formula>
          </div>
          <div className="mt-2">
            <ParamInput path="limit.k1.multiplier" label="K1 çarpanı" step={0.1} min={0.1} />
            <ParamInput path="limit.k1.minDays" label="K1 minimum gün" step={5} min={0} suffix="gün" />
            <ParamInput path="limit.k2.equityMultiplier" label="K2 özkaynak çarpanı" step={0.1} min={0.1} />
            <ParamInput path="limit.k3.ebitdaRatio" label="K3 FAVÖK oranı" step={0.05} min={0.05} max={1} />
            <ParamInput path="limit.k3.multiplier" label="K3 çarpanı" step={0.5} min={0.5} />
            <ParamInput path="limit.roundingUnit" label="Yuvarlama birimi" step={10_000} min={1_000} suffix="₺" />
            <ParamInput path="daysInYear" label="Yıl gün sayısı" hint="Devir günleri ve K1" step={1} min={360} max={366} suffix="gün" />
          </div>
        </Card>

        <Card title="Erken uyarı override kuralları" subtitle="Kritik sinyal varsa not, seçilen tavandan iyi olamaz">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps py-2 pr-3 font-semibold">Kritik sinyal</th>
                <th className="label-caps py-2 pr-3 font-semibold">Aktif</th>
                <th className="label-caps py-2 pr-3 font-semibold">Eşik</th>
                <th className="label-caps py-2 font-semibold">Not tavanı</th>
              </tr>
            </thead>
            <tbody>
              {CRITICAL.map((r) => {
                const p = `earlyWarning.critical.${r.id}`
                const rule = w.earlyWarning.critical[r.id]
                return (
                  <tr key={r.id} className={cx('border-b border-line align-top last:border-b-0', e.isEdited(p) && 'bg-edited')}>
                    <td className="py-2.5 pr-3">{rule.label}</td>
                    <td className="py-2.5 pr-3">
                      <Switch checked={rule.enabled} onChange={(v) => editorActions.set(`${p}.enabled`, v)} label={`${rule.label} aktif`} />
                    </td>
                    <td className="w-36 py-2 pr-3">{r.hasThreshold ? <Cell path={`${p}.threshold`} step={1} scale={100} suffix="%" min={1} max={100} /> : <span className="text-xs text-muted">Kayıt var/yok</span>}</td>
                    <td className="w-36 py-2">
                      <SelectParam path={`${p}.gradeCap`} options={gradeOptions} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <p className="label-caps mb-1 mt-5">İzleme sinyalleri (notu değiştirmez)</p>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <tbody>
              {WATCH.map((r) => {
                const p = `earlyWarning.watch.${r.id}`
                const rule = w.earlyWarning.watch[r.id]
                return (
                  <tr key={r.id} className={cx('border-b border-line align-top last:border-b-0', e.isEdited(p) && 'bg-edited')}>
                    <td className="py-2.5 pr-3">
                      <p>{rule.label}</p>
                      <p className="text-xs text-muted">{r.hint}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Switch checked={rule.enabled} onChange={(v) => editorActions.set(`${p}.enabled`, v)} label={`${rule.label} aktif`} />
                    </td>
                    <td className="w-36 py-2">
                      <Cell path={`${p}.${r.field}`} step={r.step} scale={r.scale} suffix={r.suffix} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>

        <Card title="Sunum ve karar kuralları" subtitle="Tahsis ve Portföy ekranlarındaki niteliksel etiketler" className="xl:col-span-2">
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <ParamInput path="presentation.strengthBands.strongMin" label='"Güçlü" etiketi alt sınırı' step={5} min={0} max={100} suffix="puan" />
              <ParamInput path="presentation.strengthBands.moderateMin" label='"Orta" etiketi alt sınırı' step={5} min={0} max={100} suffix="puan" />
            </div>
            <div>
              <ParamInput path="presentation.topFactorCount" label="Gösterilen faktör sayısı" hint="Skoru en çok yükselten / düşüren" step={1} min={1} max={6} />
              <ParamInput
                path="decision.revisionJustificationThreshold"
                label="Revize gerekçe eşiği"
                hint={`Sistem önerisinden sapma ${formatPercent(w.decision.revisionJustificationThreshold, 0)}'yi aşarsa gerekçe zorunlu`}
                step={1}
                scale={100}
                min={0}
                max={100}
                suffix="%"
              />
            </div>
          </div>
        </Card>
      </div>
    </ModelShell>
  )
}
