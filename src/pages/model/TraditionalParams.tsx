import { BreakpointEditor, Formula, ParamInput, WeightGroup, unitDisplay } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card } from '../../components/ui'
import { TRADITIONAL_CATEGORY_IDS, type RatioConfig } from '../../engine/modelConfig'
import { useModelEditor } from '../../store/modelEditor'

export function ModelTraditional() {
  const e = useModelEditor()
  const cats = e.working.traditional.categories

  return (
    <ModelShell title="Geleneksel Skor Parametreleri">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Kategori ağırlıkları" subtitle="Geleneksel skor (G, 0–100)" className="xl:col-span-1">
          <Formula>G = Σ (kategori puanı × kategori ağırlığı)</Formula>
          <div className="mt-3">
            <WeightGroup path="traditional.categories" field="weight" items={TRADITIONAL_CATEGORY_IDS.map((id) => ({ key: id, label: cats[id].label }))} />
          </div>
          <div className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
            <p>Her oran, kırılım noktaları arasında parçalı doğrusal interpolasyonla 0–100 puana çevrilir; uç değerler kırpılır.</p>
            <p>Nakit dönüşüm süresi sektör medyanına oranı üzerinden puanlanır (medyan Sektör Ayarları'nda).</p>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          {TRADITIONAL_CATEGORY_IDS.map((id) => {
            const cat = cats[id]
            const ratios = Object.entries(cat.ratios) as [string, RatioConfig][]
            const base = `traditional.categories.${id}.ratios`
            return (
              <Card key={id} title={cat.label} subtitle={`Kategori puanı = Σ (oran puanı × oran ağırlığı) · ${ratios.length} oran`}>
                {ratios.length > 1 && (
                  <div className="mb-4">
                    <WeightGroup path={base} field="weight" title="Alt oran ağırlıkları" items={ratios.map(([rid, r]) => ({ key: rid, label: r.label }))} />
                  </div>
                )}
                <div className="grid gap-3 2xl:grid-cols-2">
                  {ratios.map(([rid, r]) => (
                    <BreakpointEditor
                      key={rid}
                      path={`${base}.${rid}.breakpoints`}
                      title={r.label}
                      description={r.description}
                      unit={unitDisplay(r.unit)}
                      valueLabel={r.unit === 'medianMultiple' ? 'Medyana oran' : 'Değer'}
                    />
                  ))}
                </div>
                {id === 'consistency' && (
                  <div className="mt-3">
                    <ParamInput
                      path="traditional.negativeTaxBaseScoreCap"
                      label="Negatif matrah tavanı"
                      hint="KVB matrahı negatifse Beyan Tutarlılığı kategorisinin alabileceği en yüksek puan"
                      step={5}
                      min={0}
                      max={100}
                      suffix="puan"
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </ModelShell>
  )
}
