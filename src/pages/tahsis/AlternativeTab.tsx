import { useState } from 'react'
import { DEFAULT_PERIOD_MONTHS, PeriodChange, PeriodNote, PeriodSelector, periodCaption, type PeriodMonths } from '../../components/IndicatorPeriod'
import { IndicatorName } from '../../components/IndicatorName'
import { SeasonalityChart, Sparkline } from '../../components/charts'
import { Badge, Card, ScoreBar, cx } from '../../components/ui'
import { sectorIndicators } from '../../engine/alternativeScore'
import type { FirmEvaluation } from '../../engine/evaluate'
import { strengthLabel } from '../../engine/factors'
import { describeIndicatorValue } from '../../engine/indicatorInfo'
import { computeIndicatorPeriod, type IndicatorPeriodStats } from '../../engine/indicatorPeriod'
import type { ModelConfig } from '../../engine/modelConfig'
import type { Firm } from '../../data'
import { alternativeInputAsOf } from '../../engine/evaluate'
import { formatIndicatorValue, formatPeriodComparison, formatScore, formatSeriesAverage } from '../../lib/format'

const STRENGTH_TONE = { Güçlü: 'positive', Orta: 'warning', Zayıf: 'negative' } as const

/** Seçili dönemin ayları (ilk verisi olan göstergeden). */
function periodMonthsOf(stats: Record<string, IndicatorPeriodStats>): string[] {
  return Object.values(stats).find((s) => s.months.length > 0)?.months ?? []
}

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
  const [period, setPeriod] = useState<PeriodMonths>(DEFAULT_PERIOD_MONTHS)
  // Yalnızca görüntüleme: skor, not ve limit motorun kendi pencereleriyle hesaplanır
  const periodStats = Object.fromEntries(indicators.map(([id, ind]) => [id, computeIndicatorPeriod(ind, input, period, config)]))

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

      <Card
        title="Sektör göstergeleri"
        subtitle={periodCaption(periodMonthsOf(periodStats), period)}
        actions={<PeriodSelector value={period} onChange={setPeriod} />}
      >
        <PeriodNote className="-mt-1 mb-3" />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {indicators.map(([id, ind]) => {
            const result = alt.indicators[id]
            const stats = periodStats[id]
            return (
              <div key={id} className={cx('flex flex-col rounded-lg border border-line bg-surface p-4', !result.available && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <IndicatorName label={ind.label} aciklama={ind.aciklama} birimAciklamasi={ind.birimAciklamasi} labelClassName="text-sm font-medium leading-snug text-ink" />
                  {stats.strength ? <Badge tone={STRENGTH_TONE[stats.strength]}>{stats.strength}</Badge> : <Badge>Yetersiz veri</Badge>}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <span className="num text-lg font-semibold text-navy">{formatSeriesAverage(stats.average, ind.seriesUnit)}</span>
                  <PeriodChange stats={stats} />
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
                  <span>{period === 1 ? 'Dönem değeri' : 'Dönem ortalaması (aylık)'}</span>
                  <span>{formatPeriodComparison(period)}</span>
                </div>
                <div className="mt-2">
                  {stats.spark.values.length > 0 ? (
                    <Sparkline values={stats.spark.values} months={stats.spark.months} highlightFrom={stats.months[0]} />
                  ) : (
                    <div className="h-11" />
                  )}
                </div>
                <p className="mt-auto border-t border-line pt-2 text-xs leading-snug text-muted">
                  <span className="text-ink">Skordaki değer:</span>{' '}
                  <span className="num text-ink">{formatIndicatorValue(result.value, ind.unit)}</span> · {describeIndicatorValue(ind.measure)}
                  {result.score !== null && (
                    <>
                      {' '}· <span className="num">Puan {formatScore(result.score)}</span>
                    </>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
