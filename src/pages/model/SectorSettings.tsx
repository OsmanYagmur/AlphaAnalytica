import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { BreakpointEditor, Formula, ParamInput, SeasonIndexEditor, WeightGroup, unitDisplay } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card, cx } from '../../components/ui'
import { PRODUCT_IDS, PRODUCT_LABELS, SECTOR_IDS, type AlternativeIndicatorConfig, type IndicatorMeasure, type SeasonProfile, type SectorId } from '../../engine/modelConfig'
import { useModelEditor } from '../../store/modelEditor'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function describeMeasure(m: IndicatorMeasure): string {
  switch (m.kind) {
    case 'mean':
      return `Son ${m.window} ay ortalaması`
    case 'latest':
      return 'Son gözlem'
    case 'change':
      return `Son ${m.window} ay, ${m.lag} ay önceki döneme göre değişim`
    case 'projection':
      return `Son ${m.window} aya doğrusal eğilim, ${m.horizon} ay sonrası tahmin`
    case 'periodChange':
      return `Sezon ayları (${m.calendarMonths.map((c) => MONTHS[c - 1]).join(', ')}) toplamı, önceki yıla göre değişim`
  }
}

export function ModelSectors() {
  const e = useModelEditor()
  const [sector, setSector] = useState<SectorId>('stationery')
  const s = e.working.sectors[sector]
  const base = `sectors.${sector}`
  const indicators = Object.entries(s.indicators) as [string, AlternativeIndicatorConfig][]
  const profiles = Object.entries(s.seasonality.profiles) as [string, SeasonProfile][]

  return (
    <ModelShell title="Sektör Ayarları">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SECTOR_IDS.map((id) => {
          const errors = e.issuesUnder(`sectors.${id}`).length
          const edited = e.isEdited(`sectors.${id}`)
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSector(id)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[0.8125rem] transition-colors',
                sector === id ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink hover:border-navy',
                edited && sector !== id && 'bg-edited',
              )}
            >
              {e.working.sectors[id].label}
              {errors > 0 && <AlertCircle size={13} className={sector === id ? 'text-[#f3b1aa]' : 'text-negative'} />}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Card title="Alternatif gösterge ağırlıkları" subtitle={`${s.label} · ${indicators.length} gösterge`}>
            <Formula>SP = Σ (gösterge puanı × ağırlık) / Σ ağırlık (mevcut göstergeler)</Formula>
            <div className="mt-3">
              <WeightGroup path={`${base}.indicators`} field="weight" items={indicators.map(([id, ind]) => ({ key: id, label: ind.label }))} />
            </div>
          </Card>
          <Card title="Risk ve nakit döngüsü">
            <ParamInput path={`${base}.riskCoefficient`} label="Sektör Risk Katsayısı (SRK)" hint="Önerilen Limit = Kapasite × f × SRK" step={0.01} min={0.5} max={1.5} />
            <ParamInput path={`${base}.cccMedianDays`} label="Nakit dönüşüm süresi medyanı" hint="Faaliyet etkinliği puanlamasında referans" step={5} min={1} suffix="gün" />
          </Card>
          <Card title="Sektörel ürün kırılımı varsayılanları">
            <WeightGroup path={`${base}.productMix`} items={PRODUCT_IDS.map((p) => ({ key: p, label: PRODUCT_LABELS[p] }))} />
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card
            title="12 aylık sezon endeksi"
            subtitle={profiles.length > 1 ? 'Alt profiller ayrı endekslere sahiptir; firmanın alt profiline göre endeks seçilir' : 'Çubukları sürükleyin veya değer girin; ortalama otomatik 1,00’e normalize edilir'}
          >
            <div className="space-y-3">
              {profiles.map(([pid, p]) => (
                <SeasonIndexEditor key={`${sector}-${pid}`} path={`${base}.seasonality.profiles.${pid}.index`} title={profiles.length > 1 ? `${p.label} alt profili` : p.label} description={p.description} />
              ))}
            </div>
          </Card>
          <Card title="Gösterge normalizasyon kırılımları">
            <div className="grid gap-3 2xl:grid-cols-2">
              {indicators.map(([id, ind]) => (
                <BreakpointEditor
                  key={`${sector}-${id}`}
                  path={`${base}.indicators.${id}.breakpoints`}
                  title={ind.label}
                  description={`${ind.description} · ${describeMeasure(ind.measure)}`}
                  unit={unitDisplay(ind.unit)}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </ModelShell>
  )
}
