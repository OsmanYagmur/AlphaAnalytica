import { AlertOctagon, ArrowLeft, Eye, Info, RefreshCw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { Gauge } from '../../components/Gauge'
import { MarketIntelTab } from '../../components/MarketIntel'
import { Badge, Button, Card, GradeBadge, ModelVersionTag, StatusBadge, Tabs } from '../../components/ui'
import { formatDate, formatDateTime, formatNumber, formatPercent, formatTL } from '../../lib/format'
import { SEGMENT_LABELS } from '../../data'
import { navigate } from '../../lib/router'
import { useActiveVersion, useFirmView, type FirmView } from '../../store/evaluations'
import { AlternativeTab } from './AlternativeTab'
import { AnalysisAnimation } from './AnalysisAnimation'
import { AuditLog, DecisionPanel } from './DecisionPanel'
import { Factors } from './Factors'
import { SystemRecommendation } from './SystemRecommendation'
import { TraditionalTab } from './TraditionalTab'

function Kunye({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-0.5 whitespace-nowrap text-sm text-ink">{value}</dd>
    </div>
  )
}

function TopStrip({ view }: { view: FirmView }) {
  const { firm, evaluation: ev, config } = view
  const indicatorLabels = Object.fromEntries(Object.entries(ev.alternative.indicators).map(([id, r]) => [id, r.label]))

  return (
    <Card bodyClassName="p-0">
      <div className="grid lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-navy">{firm.name}</h2>
            <StatusBadge status={view.status} />
            {firm.segment === 'holding' && <Badge tone="navy">Holding</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{config.sectors[firm.sectorId].label}</span>
            {ev.alternative.seasonProfile.id !== 'standard' && <Badge>{ev.alternative.seasonProfile.label}</Badge>}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
            <Kunye label="VKN" value={firm.vkn} />
            <Kunye label="İl" value={firm.city} />
            <Kunye label="Kuruluş" value={String(firm.foundedYear)} />
            <Kunye label="Çalışan" value={formatNumber(firm.employees)} />
            <Kunye label="Ölçek" value={SEGMENT_LABELS[firm.segment]} />
            {firm.groupCompanies && <Kunye label="Grup şirketi" value={String(firm.groupCompanies)} />}
            <Kunye label="Talep tutarı" value={formatTL(firm.requestedAmount)} />
            <Kunye label="Başvuru" value={formatDate(firm.applicationDate)} />
          </dl>
          {(ev.earlyWarnings.critical.length > 0 || ev.earlyWarnings.watch.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {ev.earlyWarnings.critical.map((s) => (
                <Badge key={s.id} tone="negative" className="whitespace-normal">
                  <AlertOctagon size={12} className="shrink-0" />
                  Erken uyarı: {s.label}
                </Badge>
              ))}
              {ev.earlyWarnings.watch.map((s) => (
                <Badge key={s.id} tone="warning" className="whitespace-normal">
                  <Eye size={12} className="shrink-0" />
                  {s.label}
                  {s.indicators && s.indicators.length > 0 && `: ${s.indicators.map((i) => indicatorLabels[i] ?? i).join(', ')}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-5 border-t border-line px-5 py-4 lg:border-l lg:border-t-0">
          <Gauge score={ev.score} />
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted">Harf notu</p>
              <div className="mt-1">
                <GradeBadge grade={ev.grade} large />
              </div>
              {ev.override.capped && <p className="mt-1 max-w-[9rem] text-[0.6875rem] leading-snug text-negative">Skor notu {ev.baseGrade}; erken uyarı nedeniyle {ev.grade}</p>}
            </div>
            <div>
              <p className="text-xs text-muted">Temerrüt olasılığı</p>
              <p className="num text-base font-semibold text-ink">{formatPercent(ev.pd, 2)}</p>
            </div>
            <ModelVersionTag version={view.modelVersion} />
          </div>
        </div>
      </div>
    </Card>
  )
}

type TabId = 'traditional' | 'alternative' | 'market'

function EvaluationContent({ view }: { view: FirmView }) {
  const [tab, setTab] = useState<TabId>('traditional')
  const activeVersion = useActiveVersion()
  const months = view.firm.alternative.months
  const dataAsOf = view.decision?.dataAsOf ?? months[months.length - 1]

  return (
    <div className="animate-fade-in space-y-4">
      {view.decision && (
        <div className="flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-[0.8125rem] text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Bu başvuru {formatDateTime(view.decision.decidedAt)} tarihinde {view.decision.decidedBy} tarafından karara bağlandı. Değerlendirme, kararın verildiği andaki
            veriyle ve Model {view.decision.modelVersion} ile gösterilmektedir.
            {view.decision.modelVersion !== activeVersion && ` Aktif model: ${activeVersion}.`}
          </span>
        </div>
      )}
      <TopStrip view={view} />
      <Factors firm={view.firm} evaluation={view.evaluation} config={view.config} />
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Tabs<TabId>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'traditional', label: 'Geleneksel Analiz' },
              { value: 'alternative', label: 'Alternatif Veri' },
              { value: 'market', label: 'Piyasa İstihbaratı' },
            ]}
          />
          {tab === 'traditional' && <TraditionalTab firm={view.firm} evaluation={view.evaluation} config={view.config} />}
          {tab === 'alternative' && <AlternativeTab firm={view.firm} evaluation={view.evaluation} config={view.config} dataAsOf={dataAsOf} />}
          {tab === 'market' && <MarketIntelTab sectorId={view.firm.sectorId} sectorLabel={view.config.sectors[view.firm.sectorId].label} />}
        </div>
        <div className="min-w-0 space-y-4 xl:col-span-4">
          <SystemRecommendation firm={view.firm} evaluation={view.evaluation} />
          <DecisionPanel view={view} />
          <AuditLog firmId={view.firm.id} />
        </div>
      </div>
    </div>
  )
}

export function Evaluation({ firmId }: { firmId: string }) {
  const view = useFirmView(firmId)
  const [analyzing, setAnalyzing] = useState(true)
  const done = useCallback(() => setAnalyzing(false), [])

  if (!view) {
    return (
      <AppShell role="tahsis" title="Firma bulunamadı">
        <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/tahsis')}>
          Başvuru kuyruğuna dön
        </Button>
      </AppShell>
    )
  }

  return (
    <AppShell
      role="tahsis"
      title="Firma Değerlendirme"
      breadcrumb={
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => navigate('/tahsis')}>
          <ArrowLeft size={12} />
          Başvuru Kuyruğu
        </button>
      }
      actions={
        <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => setAnalyzing(true)} disabled={analyzing}>
          <span className="hidden sm:inline">Yeniden analiz et</span>
        </Button>
      }
    >
      {analyzing ? <AnalysisAnimation firmName={view.firm.name} onDone={done} /> : <EvaluationContent view={view} />}
    </AppShell>
  )
}
