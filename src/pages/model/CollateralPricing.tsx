import { Formula, InlineError, ParamInput, SelectParam, WeightGroup } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, NumberInput, cx, inputClass } from '../../components/ui'
import { COLLATERAL_TYPE_IDS, COLLATERAL_TYPE_LABELS, LENDABLE_GRADES, PRODUCT_IDS, PRODUCT_LABELS } from '../../engine/modelConfig'
import { formatNumber } from '../../lib/format'
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

export function ModelCollateral() {
  const e = useModelEditor()
  const t = e.working.terms
  const typeOptions = COLLATERAL_TYPE_IDS.map((id) => ({ value: id, label: COLLATERAL_TYPE_LABELS[id] }))

  return (
    <ModelShell title="Teminat ve Fiyatlama">
      <Card title="Nota göre teminat, vade ve spread" subtitle="Teminat oranı limitin yüzdesidir; oran ve spread nota göre azalmamalı" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps px-5 py-2 font-semibold">Not</th>
                <th className="label-caps px-3 py-2 font-semibold">Teminat oranı</th>
                <th className="label-caps px-3 py-2 font-semibold">Teminat türü</th>
                <th className="label-caps px-3 py-2 font-semibold">Vade</th>
                <th className="label-caps px-3 py-2 font-semibold">Rotatif</th>
                <th className="label-caps px-5 py-2 font-semibold">Spread</th>
              </tr>
            </thead>
            <tbody>
              {LENDABLE_GRADES.map((g) => {
                const rp = `terms.tenor.${g}.revolving`
                return (
                  <tr key={g} className="border-b border-line align-top last:border-b-0">
                    <td className="num px-5 py-3 font-semibold text-navy">{g}</td>
                    <td className="w-40 px-3 py-2">
                      <Cell path={`terms.collateralRatio.${g}`} step={5} scale={100} suffix="%" min={0} />
                    </td>
                    <td className="w-72 px-3 py-2">
                      <SelectParam path={`terms.collateralType.${g}`} options={typeOptions} />
                    </td>
                    <td className="w-36 px-3 py-2">
                      <Cell path={`terms.tenor.${g}.months`} step={6} min={1} suffix="ay" />
                    </td>
                    <td className="px-3 py-2">
                      <label className={cx('flex h-9 items-center gap-2 rounded-md px-2 text-sm', e.isEdited(rp) && 'bg-edited')}>
                        <input type="checkbox" checked={t.tenor[g].revolving} onChange={(ev) => editorActions.set(rp, ev.target.checked)} />
                        Rotatif
                      </label>
                    </td>
                    <td className="w-40 px-5 py-2">
                      <Cell path={`terms.pricing.spreadBp.${g}`} step={25} min={0} suffix="bp" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="İpotek ve ekspertiz">
          <Formula>İpotek Tutarı = Limit × Teminat Oranı</Formula>
          <div className="mt-1.5">
            <Formula>Gerekli Ekspertiz Değeri = İpotek Tutarı / {formatNumber(t.appraisalLtv, 2)}</Formula>
          </div>
          <div className="mt-2">
            <div className="flex items-start justify-between gap-4 border-b border-line py-2.5">
              <div className="pt-2">
                <p className="text-sm">İpotek zorunluluğunun başladığı not</p>
                <p className="text-xs text-muted">Bu not ve altında ipotek zorunludur</p>
              </div>
              <SelectParam path="terms.mortgageRequiredFrom" options={LENDABLE_GRADES.map((g) => ({ value: g, label: `${g} ve altı` }))} className="w-40" />
            </div>
            <ParamInput path="terms.appraisalLtv" label="Ekspertiz LTV oranı" step={5} scale={100} min={5} max={100} suffix="%" />
          </div>
        </Card>
        <Card title="Fiyatlama ve ürün kırılımı">
          <Formula>Fiyat = {t.pricing.referenceRate || '—'} + not bazlı spread (bp)</Formula>
          <div className="mt-2 flex items-start justify-between gap-4 border-b border-line py-2.5">
            <p className="pt-2 text-sm">Referans faiz</p>
            <div className="w-40">
              <input
                className={cx(inputClass, 'num text-right', e.isEdited('terms.pricing.referenceRate') && 'bg-edited', e.issueAt('terms.pricing.referenceRate') && 'border-negative')}
                value={t.pricing.referenceRate}
                onChange={(ev) => editorActions.set('terms.pricing.referenceRate', ev.target.value)}
                aria-label="Referans faiz"
              />
              <InlineError message={e.issueAt('terms.pricing.referenceRate')} />
            </div>
          </div>
          <div className="mt-4">
            <WeightGroup path="terms.defaultProductMix" title="Varsayılan ürün kırılımı (sektörler kendi kırılımını taşır)" items={PRODUCT_IDS.map((p) => ({ key: p, label: PRODUCT_LABELS[p] }))} />
          </div>
        </Card>
      </div>
    </ModelShell>
  )
}
