import { Formula, InlineError } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, cx } from '../../components/ui'
import { formatNumber } from '../../lib/format'
import { editorActions, useModelEditor } from '../../store/modelEditor'

export function ModelBalance() {
  const e = useModelEditor()
  const { traditional, alternative } = e.working.final.weights
  const pctG = Math.round(traditional * 1000) / 10
  const pctA = Math.round(alternative * 1000) / 10
  const edited = e.isEdited('final.weights')

  const setTraditional = (pct: number) => {
    const g = Math.max(0, Math.min(100, pct)) / 100
    editorActions.set('final.weights', { traditional: g, alternative: Math.round((1 - g) * 1e10) / 1e10 })
  }

  return (
    <ModelShell title="Ana Denge">
      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Geleneksel / Alternatif ağırlık" subtitle="İki ağırlık toplamı %100 olacak şekilde birlikte hareket eder" className="xl:col-span-3">
          <div className={cx('rounded-md p-4', edited && 'bg-edited')}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="label-caps">Geleneksel (w_G)</p>
                <p className="num text-3xl font-semibold text-navy">%{formatNumber(pctG, 1)}</p>
              </div>
              <div className="text-right">
                <p className="label-caps">Alternatif (w_A)</p>
                <p className="num text-3xl font-semibold text-accent">%{formatNumber(pctA, 1)}</p>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pctG}
              onChange={(ev) => setTraditional(Number(ev.target.value))}
              className="w-full accent-[#12233D]"
              aria-label="Geleneksel ağırlık"
            />
            <div className="mt-1 flex justify-between text-[0.6875rem] text-muted">
              <span>Yalnız alternatif</span>
              <span>%50 / %50</span>
              <span>Yalnız geleneksel</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[50, 60, 70].map((g) => (
                <button key={g} type="button" onClick={() => setTraditional(g)} className="num rounded border border-line px-2.5 py-1 text-xs text-muted hover:border-navy hover:text-navy">
                  %{g} / %{100 - g}
                </button>
              ))}
            </div>
          </div>
          <InlineError message={e.issueAt('final.weights')} />
        </Card>
        <Card title="Nihai skor formülü" className="xl:col-span-2">
          <Formula>S = w_G × G + w_A × A</Formula>
          <div className="mt-3">
            <Formula>
              S = {formatNumber(traditional, 2)} × G + {formatNumber(alternative, 2)} × A
            </Formula>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            G: mizan ve kurumlar vergisi beyannamesinden geleneksel skor. A: sektöre özgü alternatif veri, sezon uyumu ve arındırılmış trendden alternatif skor. S harf
            notunu, PD'yi ve limit not çarpanını belirler.
          </p>
        </Card>
      </div>
    </ModelShell>
  )
}
