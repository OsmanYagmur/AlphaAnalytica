import { BreakpointEditor, Formula, InlineError, ParamInput, SelectParam, Switch, ToggleParam } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, NumberInput, cx } from '../../components/ui'
import { KKB_CREDIT_TYPE_LABELS, KKB_CREDIT_TYPES, LENDABLE_GRADES, type KkbCreditType, type KkbSignalId } from '../../engine/modelConfig'
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

interface FieldSpec {
  field: string
  label: string
  step: number
  scale?: number
  suffix?: string
  min?: number
  max?: number
}

const SIGNALS: { id: KkbSignalId; hint: string; fields: FieldSpec[] }[] = [
  {
    id: 'overdue',
    hint: 'Herhangi bir bankada en yüksek gecikme bu gün veya üstündeyse',
    fields: [
      { field: 'minDays', label: 'Gecikme', step: 5, suffix: 'gün', min: 1 },
      { field: 'windowMonths', label: 'Pencere', step: 1, suffix: 'ay', min: 1, max: 24 },
    ],
  },
  { id: 'legalFollowUp', hint: 'Herhangi bir bankada yasal takip kaydı varsa', fields: [] },
  {
    id: 'inquiries',
    hint: 'Pencere içindeki kredi sorgusu sayısı bu değer veya üstündeyse (farklı bankalardan limit arayışı)',
    fields: [
      { field: 'minCount', label: 'Sorgu', step: 1, suffix: 'adet', min: 1 },
      { field: 'windowMonths', label: 'Pencere', step: 1, suffix: 'ay', min: 1, max: 12 },
    ],
  },
  {
    id: 'riskGrowth',
    hint: 'Toplam risk (nakdi + gayrinakdi) geriye bakış süresinde bu oranda veya daha fazla arttıysa',
    fields: [
      { field: 'minGrowth', label: 'Artış', step: 5, scale: 100, suffix: '%', min: 1 },
      { field: 'lookbackMonths', label: 'Geriye bakış', step: 1, suffix: 'ay', min: 1, max: 23 },
    ],
  },
  {
    id: 'mizanMismatch',
    hint: 'Mizan ayındaki KKB nakdi riski ile mizandaki finansal borçlar arasındaki göreli fark bu oranı aşarsa',
    fields: [{ field: 'maxDeviation', label: 'Sapma', step: 5, scale: 100, suffix: '%', min: 1 }],
  },
  {
    id: 'lowFindeks',
    hint: 'Findeks kredi notu bu değer veya altındaysa',
    fields: [{ field: 'maxScore', label: 'Findeks', step: 50, min: 1, max: 1900 }],
  },
]

function TypePicker({ path, label, hint }: { path: string; label: string; hint: string }) {
  const e = useModelEditor()
  const selected = e.get(path) as KkbCreditType[]
  const error = e.issueAt(path)
  const toggle = (t: KkbCreditType) =>
    editorActions.set(path, selected.includes(t) ? selected.filter((x) => x !== t) : KKB_CREDIT_TYPES.filter((x) => x === t || selected.includes(x)))
  return (
    <div className={cx('border-b border-line py-2.5 last:border-b-0', e.isEdited(path) && 'bg-edited')}>
      <p className="text-sm text-ink">{label}</p>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {KKB_CREDIT_TYPES.filter((t) => t !== 'nonCash').map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={selected.includes(t)}
            className={cx(
              'rounded-md border px-2.5 py-1 text-xs transition-colors',
              selected.includes(t) ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink hover:border-navy',
            )}
          >
            {KKB_CREDIT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <InlineError message={error} />
    </div>
  )
}

export function ModelKkb() {
  const e = useModelEditor()
  const w = e.working
  const k = w.kkb
  const capOptions = [{ value: 'none', label: 'Yok (izleme)' }, ...LENDABLE_GRADES.map((g) => ({ value: g, label: `En fazla ${g}` }))]
  const findeksUnit = { scale: 1, suffix: '', step: 50, digits: 0 }

  return (
    <ModelShell title="KKB Parametreleri">
      <div className="mb-4 rounded-md border border-line bg-surface px-4 py-2.5 text-[0.8125rem] text-muted">
        KKB risk raporu simülasyon verisidir (gerçek entegrasyon yok). Aşağıdaki parametreler erken uyarı sinyallerini, limitteki diğer banka düşümünü, K3’teki mevcut kredi
        ödemelerini ve Findeks’in skordaki yerini belirler. Değişikliklerin etkisi sağdaki Etki Önizleme panelinde görülür.
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="KKB erken uyarı sinyalleri" subtitle="Not tavanı seçilen sinyaller kritik sayılır; “Yok” seçilenler notu değiştirmez" className="xl:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60 text-left">
                  <th className="label-caps px-5 py-2.5 font-semibold">Sinyal</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Aktif</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Eşikler</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Not tavanı</th>
                </tr>
              </thead>
              <tbody>
                {SIGNALS.map((sig) => {
                  const p = `kkb.signals.${sig.id}`
                  const rule = k.signals[sig.id]
                  return (
                    <tr key={sig.id} className={cx('border-b border-line align-top last:border-b-0', e.isEdited(p) && 'bg-edited')}>
                      <td className="px-5 py-2.5">
                        <p className="text-ink">{rule.label}</p>
                        <p className="text-xs text-muted">{sig.hint}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Switch checked={rule.enabled} onChange={(v) => editorActions.set(`${p}.enabled`, v)} label={`${rule.label} aktif`} />
                      </td>
                      <td className="px-3 py-2">
                        {sig.fields.length === 0 ? (
                          <span className="text-xs text-muted">Kayıt var/yok</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {sig.fields.map((f) => (
                              <div key={f.field} className="w-36">
                                <p className="mb-0.5 text-[0.6875rem] text-muted">{f.label}</p>
                                <Cell path={`${p}.${f.field}`} step={f.step} scale={f.scale} suffix={f.suffix} min={f.min} max={f.max} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="w-40 px-3 py-2">
                        <SelectParam path={`${p}.gradeCap`} options={capOptions} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Limit: diğer bankalardaki riskler" subtitle="İşletme sermayesi ihtiyacının diğer bankalarca finanse edilen kısmı">
          <div className="space-y-2 text-[0.8125rem]">
            <Formula>
              K1 = Net Satış × max(NDS; {formatNumber(w.limit.k1.minDays, 0)}) / {w.daysInYear} × {formatNumber(w.limit.k1.multiplier, 2)}
              {k.limit.deductOtherBanks ? ` − Diğer bankalardaki işletme sermayesi nakdi riski × ${formatPercent(k.limit.deductionRate, 0)}` : ''}
            </Formula>
          </div>
          <div className="mt-2">
            <ToggleParam path="kkb.limit.deductOtherBanks" label="Diğer banka riskini K1’den düş" hint="Kapalıysa K1 yalnızca brüt işletme sermayesi ihtiyacıdır" />
            <ParamInput path="kkb.limit.deductionRate" label="Düşüm oranı" hint="Diğer bankalardaki işletme sermayesi riskinin düşülen payı" step={5} scale={100} min={0} max={100} suffix="%" />
            <TypePicker path="kkb.limit.workingCapitalTypes" label="İşletme sermayesi sayılan kredi türleri" hint="Bu türlerdeki nakdi risk K1’den düşülür" />
          </div>
        </Card>

        <Card title="K3: mevcut yıllık kredi ödemeleri" subtitle="Borç servis kapasitesinde düşülen yıllık anapara ödemeleri">
          <div className="space-y-2 text-[0.8125rem]">
            <Formula>
              K3 = max(0; FAVÖK × {formatNumber(w.limit.k3.ebitdaRatio, 2)} − Mevcut Yıllık Kredi Ödemeleri) × {formatNumber(w.limit.k3.multiplier, 2)}
            </Formula>
            <Formula>{k.debtService.fromKkb ? 'Mevcut Yıllık Kredi Ödemeleri = Σ vadeli kredi riski × min(1; 12 / kalan taksit sayısı)' : 'Mevcut Yıllık Kredi Ödemeleri = firmanın beyanı'}</Formula>
          </div>
          <div className="mt-2">
            <ToggleParam path="kkb.debtService.fromKkb" label="KKB’den türet" hint="Kapalıysa firmanın beyan ettiği yıllık kredi ödemeleri kullanılır" />
            <TypePicker path="kkb.debtService.termTypes" label="Vadeli kredi türleri" hint="Anapara ödemesi hesaplanan (eşit taksitli) kredi türleri" />
          </div>
        </Card>

        <Card title="Findeks kredi notu" subtitle="Varsayılan olarak yalnızca bilgi ve erken uyarı eşiği olarak kullanılır" className="xl:col-span-2">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <Formula>{k.findeks.includeInScore ? `S = ${formatPercent(1 - k.findeks.weight, 0)} × (w_G·G + w_A·A) + ${formatPercent(k.findeks.weight, 0)} × Findeks puanı` : 'S = w_G·G + w_A·A (Findeks skora dahil değil)'}</Formula>
              <div className="mt-2">
                <ToggleParam path="kkb.findeks.includeInScore" label="Skora dahil et" hint="Açıldığında Findeks puanı nihai skora ağırlığıyla eklenir" />
                <ParamInput path="kkb.findeks.weight" label="Findeks ağırlığı" hint="Nihai skordaki payı (en fazla %50)" step={1} scale={100} min={0} max={50} suffix="%" />
              </div>
            </div>
            <BreakpointEditor path="kkb.findeks.breakpoints" title="Findeks notu → puan" description="1–1900 arası Findeks notunun 0–100 puana çevrilmesi" unit={findeksUnit} valueLabel="Findeks" />
          </div>
        </Card>
      </div>
    </ModelShell>
  )
}
