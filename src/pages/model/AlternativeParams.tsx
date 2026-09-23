import { BreakpointEditor, Formula, ParamInput, ToggleParam, WeightGroup, unitDisplay } from '../../components/model/editors'
import { ModelShell } from '../../components/model/ModelShell'
import { Card } from '../../components/ui'
import { formatNumber } from '../../lib/format'
import { useModelEditor } from '../../store/modelEditor'

export function ModelAlternative() {
  const e = useModelEditor()
  const alt = e.working.alternative
  return (
    <ModelShell title="Alternatif Skor Parametreleri">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="SP / SU / TR ağırlıkları" subtitle="Alternatif skor (A, 0–100)">
          <Formula>A_ham = w_SP × SP + w_SU × SU + w_TR × TR</Formula>
          <div className="mt-1.5">
            <Formula>
              A_ham = {formatNumber(alt.weights.sp, 2)} × SP + {formatNumber(alt.weights.su, 2)} × SU + {formatNumber(alt.weights.tr, 2)} × TR
            </Formula>
          </div>
          <div className="mt-3">
            <WeightGroup
              path="alternative.weights"
              items={[
                { key: 'sp', label: 'SP · Sektörel performans' },
                { key: 'su', label: 'SU · Sezon uyumu' },
                { key: 'tr', label: 'TR · Arındırılmış trend' },
              ]}
            />
          </div>
          <p className="mt-3 text-xs text-muted">SP: sektöre özgü göstergelerin ağırlıklı ortalaması (gösterge ağırlıkları Sektör Ayarları'nda).</p>
        </Card>

        <Card title="Sezon uyumu (SU)">
          <Formula>Beklenen_m = (Yıllık Ciro / 12) × S_m</Formula>
          <div className="mt-1.5">
            <Formula>Sapma_m = Gerçekleşen_m / Beklenen_m − 1</Formula>
          </div>
          <div className="mt-1.5">
            <Formula>SU = 100 × max(0; 1 − ortalama|Sapma_m| / {formatNumber(alt.seasonalFit.tolerance, 2)})</Formula>
          </div>
          <div className="mt-3">
            <ParamInput path="alternative.seasonalFit.tolerance" label="SU toleransı" hint="Ortalama mutlak sapma bu değere ulaşınca SU = 0" step={0.05} min={0.05} />
            <ParamInput path="alternative.seasonalFit.windowMonths" label="Değerlendirme penceresi" hint="Sapmanın ortalamasının alındığı son ay sayısı" step={1} min={1} max={24} suffix="ay" />
          </div>
        </Card>

        <Card title="Arındırılmış trend (TR)">
          <Formula>SA_m = Gerçekleşen_m / S_m · eğim → yıllık % büyüme = eğim × 12 / ortalama SA</Formula>
          <div className="mt-3">
            <ParamInput path="alternative.trend.windowMonths" label="Regresyon penceresi" hint="Doğrusal regresyon uygulanan son ay sayısı" step={1} min={3} max={24} suffix="ay" />
          </div>
          <div className="mt-3">
            <BreakpointEditor path="alternative.trend.breakpoints" title="TR büyüme kırılım noktaları" description="Yıllık büyüme (%) → TR puanı" unit={unitDisplay('growth')} valueLabel="Büyüme" />
          </div>
        </Card>

        <Card title="Veri kapsama düzeltmesi">
          <Formula>c = mevcut gösterge sayısı / toplam gösterge sayısı</Formula>
          <div className="mt-1.5">
            <Formula>
              A = c × A_ham + (1 − c) × {formatNumber(alt.coverage.neutralScore, 0)}
            </Formula>
          </div>
          <div className="mt-3">
            <ToggleParam path="alternative.coverage.enabled" label="Kapsama düzeltmesi" hint="Kapalıyken A = A_ham" />
            <ParamInput path="alternative.coverage.neutralScore" label="Nötr değer" hint="Veri eksikse skorun çekildiği değer" step={5} min={0} max={100} suffix="puan" />
          </div>
        </Card>
      </div>
    </ModelShell>
  )
}
