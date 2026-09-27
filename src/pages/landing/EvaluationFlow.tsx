import { Activity, ArrowLeft, ArrowRight, Database, FileSpreadsheet, Landmark, TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Gauge } from '../../components/Gauge'
import { DataRow, GradeBadge, ScoreBar, cx } from '../../components/ui'
import type { FirmEvaluation } from '../../engine/evaluate'
import { computeScoreFactors, strengthLabel } from '../../engine/factors'
import { TRADITIONAL_CATEGORY_IDS, type ModelConfig } from '../../engine/modelConfig'
import { formatNumber, formatPercent, formatScore, formatTL } from '../../lib/format'
import { navigate } from '../../lib/router'
import { actions } from '../../store/appStore'
import { useFirmView } from '../../store/evaluations'
import { FLOW_FIRM_ID, FLOW_STEPS } from './content'

type StepId = (typeof FLOW_STEPS)[number]['id']

const STEP_ICONS: Record<StepId, LucideIcon> = {
  mizan: FileSpreadsheet,
  alternatif: Database,
  kkb: Landmark,
  skor: Activity,
  limit: Wallet,
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'negative' | 'warning' }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('num mt-0.5 text-base font-semibold', tone === 'negative' ? 'text-negative' : tone === 'warning' ? 'text-warning' : 'text-navy')}>{value}</p>
    </div>
  )
}

function StepData({ step, evaluation: ev, config }: { step: StepId; evaluation: FirmEvaluation; config: ModelConfig }) {
  switch (step) {
    case 'mizan':
      return (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-line pb-2.5">
            <span className="text-sm text-muted">Geleneksel skor</span>
            <span className="num text-lg font-semibold text-navy">{formatScore(ev.traditional.score)}</span>
          </div>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {TRADITIONAL_CATEGORY_IDS.map((id) => {
              const c = ev.traditional.categories[id]
              return <ScoreBar key={id} label={c.label} score={c.score} strength={strengthLabel(c.score, config)} />
            })}
          </div>
        </div>
      )
    case 'alternatif': {
      const alt = ev.alternative
      const indicators = Object.values(alt.indicators).filter((i) => i.available && i.score !== null)
      return (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-line pb-2.5">
            <span className="text-sm text-muted">Alternatif veri skoru</span>
            <span className="num text-lg font-semibold text-navy">{formatScore(alt.score)}</span>
          </div>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
            <ScoreBar label="Sektörel performans" score={alt.sp} strength={strengthLabel(alt.sp, config)} />
            <ScoreBar label="Sezon uyumu" score={alt.su} strength={strengthLabel(alt.su, config)} />
            <ScoreBar label="Arındırılmış trend" score={alt.tr} strength={strengthLabel(alt.tr, config)} />
          </div>
          <div>
            <p className="label-caps mb-2">Sektör göstergeleri</p>
            <ul className="flex flex-wrap gap-1.5">
              {indicators.map((i) => {
                const s = strengthLabel(i.score!, config)
                return (
                  <li key={i.label} className="inline-flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink">
                    <span className={cx('h-1.5 w-1.5 rounded-full', s === 'Güçlü' ? 'bg-positive' : s === 'Orta' ? 'bg-warning' : 'bg-negative')} />
                    {i.label}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )
    }
    case 'kkb': {
      const k = ev.kkb?.snapshot
      if (!k) return <p className="text-sm text-muted">Bu firma için KKB raporu yok.</p>
      const maxDelay = Math.max(0, ...k.banks.map((b) => b.maxDelayDays12m))
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Banka sayısı" value={formatNumber(k.banks.length)} />
            <Stat label="Toplam limit" value={formatTL(k.totalLimit)} />
            <Stat label="Toplam risk" value={formatTL(k.totalRisk)} />
            <Stat label="Doluluk oranı" value={formatPercent(k.utilization, 0)} />
            <Stat label="En yüksek gecikme (12 ay)" value={`${formatNumber(maxDelay)} gün`} tone={maxDelay > 0 ? 'warning' : undefined} />
            <Stat label="Findeks kredi notu" value={formatNumber(k.findeks)} />
          </div>
          <p className="text-sm text-muted">
            {ev.kkb!.signals.length === 0 ? 'KKB kaynaklı erken uyarı sinyali yok.' : `KKB erken uyarı sinyalleri: ${ev.kkb!.signals.map((s) => s.label).join(', ')}.`}
          </p>
        </div>
      )
    }
    case 'skor': {
      const { positive, negative } = computeScoreFactors(ev, config)
      return (
        <div className="grid items-start gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-2">
            <Gauge score={ev.score} size={150} />
            <div className="flex items-center gap-3">
              <GradeBadge grade={ev.grade} large />
              <div>
                <p className="text-xs text-muted">Temerrüt olasılığı</p>
                <p className="num text-sm font-semibold text-ink">{formatPercent(ev.pd, 2)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <FactorGroup icon={TrendingUp} title="Skoru yükselten" tone="positive" items={positive.slice(0, 2).map((f) => f.text)} />
            <FactorGroup icon={TrendingDown} title="Skoru düşüren" tone="negative" items={negative.slice(0, 2).map((f) => f.text)} />
          </div>
        </div>
      )
    }
    case 'limit': {
      const t = ev.terms
      if (!t || t.limit <= 0) return <p className="text-sm text-muted">Bu firma için limit önerilmiyor.</p>
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-[#c8dedc] bg-accent-soft px-4 py-3">
            <span className="text-sm text-ink">Önerilen limit</span>
            <span className="num text-xl font-semibold text-navy">{formatTL(t.limit)}</span>
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <p className="label-caps mb-1">Ürün kırılımı</p>
              <dl>
                {t.products.map((p) => (
                  <DataRow key={p.product} label={p.label} value={formatTL(p.amount)} />
                ))}
              </dl>
            </div>
            <div>
              <p className="label-caps mb-1">Teminat, vade ve fiyat</p>
              <dl>
                <DataRow label="Teminat" value={<span className="font-sans">{t.collateral.typeLabel}</span>} />
                <DataRow label="Teminat oranı" value={formatPercent(t.collateral.ratio, 0)} />
                <DataRow label="Vade" value={`${t.tenor.months} ay`} />
                <DataRow label="Fiyatlama" value={`${t.pricing.referenceRate} + ${formatNumber(t.pricing.spreadBp)} bp`} />
              </dl>
            </div>
          </div>
        </div>
      )
    }
  }
}

function FactorGroup({ icon: Icon, title, tone, items }: { icon: LucideIcon; title: string; tone: 'positive' | 'negative'; items: string[] }) {
  return (
    <div>
      <p className={cx('mb-1.5 flex items-center gap-1.5 text-xs font-semibold', tone === 'positive' ? 'text-positive' : 'text-negative')}>
        <Icon size={14} />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Belirgin faktör yok.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t} className="text-sm leading-relaxed text-ink">
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Tıklanabilir değerlendirme akışı: seçili adım lacivertle işaretlenir, sağda
 * örnek firmanın o adımdaki canlı sonucu gösterilir ve demoda ilgili sekme açılabilir.
 */
export function EvaluationFlow() {
  const view = useFirmView(FLOW_FIRM_ID)
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const panel = useRef<HTMLDivElement>(null)
  if (!view) return null
  const step = FLOW_STEPS[active]

  const select = (i: number, focus = false) => {
    const next = (i + FLOW_STEPS.length) % FLOW_STEPS.length
    setActive(next)
    if (focus) tabs.current[next]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') select(active + 1, true)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') select(active - 1, true)
    else return
    e.preventDefault()
  }
  const openInDemo = () => {
    actions.login('tahsis')
    navigate(`/tahsis/firma/${FLOW_FIRM_ID}/${step.tab}`)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div role="tablist" aria-label="Değerlendirme akışı" aria-orientation="vertical" onKeyDown={onKeyDown} className="relative space-y-2 self-start">
        <span aria-hidden className="absolute bottom-6 left-[1.9rem] top-6 w-px bg-line" />
        {FLOW_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.id]
          const selected = i === active
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`flow-tab-${s.id}`}
              aria-selected={selected}
              aria-controls="flow-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                select(i)
                // Dar ekranda panel adımların altında kalır; seçilen adımın sonucunu göstermek için panele kaydırılır.
                if (!window.matchMedia('(min-width: 64rem)').matches) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cx(
                'group relative flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors lg:py-4',
                selected ? 'border-navy bg-navy text-white shadow-pop' : 'border-line bg-surface hover:border-navy-soft hover:bg-canvas',
              )}
            >
              <span
                className={cx(
                  'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  selected ? 'border-[#2a3f5e] bg-[#1b2c46] text-[#9fd3cd]' : 'border-line bg-surface text-accent group-hover:border-navy-soft',
                )}
              >
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('num block text-[0.6875rem]', selected ? 'text-[#9fd3cd]' : 'text-faint')}>{String(i + 1).padStart(2, '0')}</span>
                <span className={cx('block text-sm font-semibold', selected ? 'text-white' : 'text-navy')}>{s.title}</span>
                <span className={cx('mt-0.5 hidden text-xs leading-relaxed sm:block', selected ? 'text-[#b9c3d3]' : 'text-muted')}>{s.text}</span>
              </span>
              <ArrowRight size={16} className={cx('mt-1 hidden shrink-0 transition-transform lg:block', selected ? 'text-[#9fd3cd]' : 'text-faint opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100')} />
            </button>
          )
        })}
      </div>

      <div ref={panel} id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${step.id}`} className="flex min-w-0 scroll-mt-20 flex-col rounded-lg border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-caps text-accent">
              Adım {active + 1} / {FLOW_STEPS.length}
            </p>
            <p className="text-xs text-muted">
              Örnek: <span className="text-ink">{view.firm.name}</span> · demo verisi
            </p>
          </div>
          <h4 className="mt-1.5 text-lg font-semibold text-navy">{step.title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{step.detail}</p>
        </div>
        <div key={step.id} className="animate-fade-in flex-1 px-5 py-5">
          <StepData step={step.id} evaluation={view.evaluation} config={view.config} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <button type="button" onClick={openInDemo} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Bu adımı demoda aç
            <ArrowRight size={15} />
          </button>
          <div className="flex gap-1">
            <button type="button" onClick={() => select(active - 1)} aria-label="Önceki adım" className="rounded-md border border-line p-1.5 text-muted hover:border-navy-soft hover:text-ink">
              <ArrowLeft size={15} />
            </button>
            <button type="button" onClick={() => select(active + 1)} aria-label="Sonraki adım" className="rounded-md border border-line p-1.5 text-muted hover:border-navy-soft hover:text-ink">
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
