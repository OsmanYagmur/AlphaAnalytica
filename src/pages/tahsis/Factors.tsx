import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '../../components/ui'
import type { FirmEvaluation } from '../../engine/evaluate'
import { computeScoreFactors, type ScoreFactor } from '../../engine/factors'
import type { AlternativeIndicatorConfig, ModelConfig } from '../../engine/modelConfig'
import type { Firm } from '../../data'
import { formatIndicatorValue } from '../../lib/format'

function FactorList({ items, tone, empty }: { items: ScoreFactor[]; tone: 'positive' | 'negative'; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ol className="space-y-2.5">
      {items.map((f, i) => (
        <li key={f.id} className="flex gap-3">
          <span
            className={`num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.6875rem] font-semibold ${
              tone === 'positive' ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'
            }`}
          >
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed text-ink">{f.text}</span>
        </li>
      ))}
    </ol>
  )
}

export function Factors({ firm, evaluation, config }: { firm: Firm; evaluation: FirmEvaluation; config: ModelConfig }) {
  const { positive, negative } = computeScoreFactors(evaluation, config)
  const indicators = config.sectors[firm.sectorId].indicators as Record<string, AlternativeIndicatorConfig>
  const withValue = (list: ScoreFactor[]) =>
    list.map((f) => {
      if (f.kind !== 'indicator') return f
      const value = evaluation.alternative.indicators[f.id]?.value ?? null
      return { ...f, text: `${f.text.replace(/\.$/, '')} (${formatIndicatorValue(value, indicators[f.id].unit)}).` }
    })

  return (
    <Card title="Skoru etkileyen faktörler">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold text-positive">
            <TrendingUp size={16} />
            Skoru en çok yükselten faktörler
          </h3>
          <FactorList items={withValue(positive)} tone="positive" empty="Skoru belirgin şekilde yükselten faktör yok." />
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold text-negative">
            <TrendingDown size={16} />
            Skoru en çok düşüren faktörler
          </h3>
          <FactorList items={withValue(negative)} tone="negative" empty="Skoru belirgin şekilde düşüren faktör yok." />
        </div>
      </div>
    </Card>
  )
}
