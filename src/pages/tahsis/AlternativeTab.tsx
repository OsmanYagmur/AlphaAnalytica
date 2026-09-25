import { IndicatorName } from '../../components/IndicatorName'
import { SeasonalityChart, Sparkline } from '../../components/charts'
import { Badge, Card, ScoreBar, cx } from '../../components/ui'
import { resolveSourceSeries, sectorIndicators } from '../../engine/alternativeScore'
import type { FirmEvaluation } from '../../engine/evaluate'
import { strengthLabel } from '../../engine/factors'
import { describeIndicatorValue } from '../../engine/indicatorInfo'
import type { ModelConfig } from '../../engine/modelConfig'
import type { Firm } from '../../data'
import { alternativeInputAsOf } from '../../engine/evaluate'
import { formatIndicatorValue, formatScore } from '../../lib/format'

const STRENGTH_TONE = { Güçlü: 'positive', Orta: 'warning', Zayıf: 'negative' } as const

export function AlternativeTab({
  firm,
  evaluation,
  config,
  dataAsOf,
}: {
  firm: Firm
  evaluation: FirmEvaluation
  config: ModelConfig
  dataAsOf: string
}) {
  const alt = evaluation.alternative
  const input = alternativeInputAsOf(firm.alternative, dataAsOf)
  const indicators = sectorIndicators(config, firm.sectorId)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Alternatif veri özeti" subtitle={`${config.sectors[firm.sectorId].label} sektörüne özgü veriler`}>
          <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
            <span className="text-sm text-muted">Alternatif skor</span>
            <span className="num text-xl font-semibold text-navy">{formatScore(alt.score)}</span>
          </div>
          <div className="space-y-4">
            <ScoreBar label="Sektörel performans" score={alt.sp} strength={strengthLabel(alt.sp, config)} />
            <ScoreBar label="Sezon uyumu" score={alt.su} strength={strengthLabel(alt.su, config)} />
            <ScoreBar label="Arındırılmış trend" score={alt.tr} strength={strengthLabel(alt.tr, config)} />
          </div>
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Veri kapsama:{' '}
            <span className="num text-ink">
              {alt.availableCount} / {alt.totalCount}
            </span>{' '}
            gösterge mevcut
          </p>
        </Card>

        <Card
          title="Sezonsallık"
          subtitle={`Son 12 ay · beklenen ve gerçekleşen aylık ciro · sezon profili: ${alt.seasonProfile.label}`}
          className="xl:col-span-2"
        >
          <SeasonalityChart months={alt.seasonalFit.months} expected={alt.seasonalFit.expected} actual={alt.seasonalFit.actual} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {indicators.map(([id, ind]) => {
          const result = alt.indicators[id]
          const series = resolveSourceSeries(ind.source, input)
          const strength = result.score !== null ? strengthLabel(result.score, config) : null
          return (
            <div key={id} className={cx('rounded-lg border border-line bg-surface p-4 shadow-card', !result.available && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <IndicatorName label={ind.label} aciklama={ind.aciklama} birimAciklamasi={ind.birimAciklamasi} labelClassName="text-sm font-medium leading-snug text-ink" />
                {strength ? <Badge tone={STRENGTH_TONE[strength]}>{strength}</Badge> : <Badge>Veri yok</Badge>}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span className="num text-lg font-semibold text-navy">{formatIndicatorValue(result.value, ind.unit)}</span>
                {result.score !== null && <span className="num text-xs text-muted">Puan {formatScore(result.score)}</span>}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-muted">{describeIndicatorValue(ind.measure)}</p>
              <div className="mt-3 border-t border-line pt-2">
                {series ? <Sparkline values={series} months={input.months} /> : <div className="h-11" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
