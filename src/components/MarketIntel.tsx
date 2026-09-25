import { ExternalLink, Info, Newspaper } from 'lucide-react'
import { INTEL_IMPACT_LABELS, negativeSignalCount, type IntelImpact, type MarketIntelItem, type SectorIntel } from '../data'
import type { SectorId } from '../engine/modelConfig'
import { formatDate } from '../lib/format'
import { useAppState, useSectorIntel } from '../store/appStore'
import { Badge, Card, cx, type Tone } from './ui'

const IMPACT_TONE: Record<IntelImpact, Tone> = { positive: 'positive', neutral: 'neutral', negative: 'negative' }
const IMPACT_DOT: Record<IntelImpact, string> = { positive: 'bg-positive', neutral: 'bg-faint', negative: 'bg-negative' }
const IMPACT_ORDER: Record<IntelImpact, number> = { negative: 0, neutral: 1, positive: 2 }

export function ImpactBadge({ impact }: { impact: IntelImpact }) {
  return <Badge tone={IMPACT_TONE[impact]}>{INTEL_IMPACT_LABELS[impact]}</Badge>
}

export function IntelNote({ className }: { className?: string }) {
  return (
    <p className={cx('flex items-center gap-1.5 text-xs text-muted', className)}>
      <Info size={12} className="shrink-0 text-faint" />
      Bilgi amaçlıdır; kredi skorunu, notu ve limiti etkilemez.
    </p>
  )
}

function ImpactCounts({ intel }: { intel: SectorIntel }) {
  const count = (i: IntelImpact) => intel.items.filter((x) => x.impact === i).length
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {(['negative', 'neutral', 'positive'] as const).map((i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className={cx('h-2 w-2 rounded-full', IMPACT_DOT[i])} />
          {INTEL_IMPACT_LABELS[i]} <span className="num text-ink">{count(i)}</span>
        </span>
      ))}
    </div>
  )
}

function sortedItems(items: MarketIntelItem[]): MarketIntelItem[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date))
}

function SourceLine({ item }: { item: MarketIntelItem }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
      <span className="num">{formatDate(item.date)}</span>
      <span aria-hidden>·</span>
      {item.sourceUrl ? (
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent hover:underline">
          {item.source}
          <ExternalLink size={11} />
        </a>
      ) : (
        <span>{item.source}</span>
      )}
    </p>
  )
}

function CreditImplication({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#c8dedc] bg-accent-soft px-4 py-3">
      <p className="label-caps mb-1 text-accent">Kredi açısından ne anlama geliyor</p>
      <p className="text-sm leading-relaxed text-ink">{text}</p>
    </div>
  )
}

/** Tahsis Yöneticisi değerlendirme ekranındaki "Piyasa İstihbaratı" sekmesi. */
export function MarketIntelTab({ sectorId, sectorLabel }: { sectorId: SectorId; sectorLabel: string }) {
  const intel = useSectorIntel(sectorId)
  return (
    <Card
      title={`Piyasa İstihbaratı · ${sectorLabel}`}
      subtitle={`Son güncelleme: ${formatDate(intel.lastUpdated)} · Türkiye, son 3–6 ayın gelişmeleri`}
      actions={<ImpactCounts intel={intel} />}
    >
      <IntelNote className="-mt-1 mb-4" />
      {intel.items.length === 0 ? (
        <p className="text-sm text-muted">Bu sektör için kayıtlı madde yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sortedItems(intel.items).map((item) => (
            <li key={item.id} className="py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium leading-snug text-ink">{item.title}</h3>
                <ImpactBadge impact={item.impact} />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink/90">{item.summary}</p>
              <SourceLine item={item} />
            </li>
          ))}
        </ul>
      )}
      {intel.creditImplication.trim() && (
        <div className="mt-4">
          <CreditImplication text={intel.creditImplication} />
        </div>
      )}
    </Card>
  )
}

/** Portföy Yöneticisi firma detayı: sağ sütunda kompakt kart. */
export function MarketIntelCompact({ sectorId, sectorLabel }: { sectorId: SectorId; sectorLabel: string }) {
  const intel = useSectorIntel(sectorId)
  const items = [...intel.items].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.date.localeCompare(a.date))
  return (
    <Card title="Piyasa İstihbaratı" subtitle={`${sectorLabel} · Son güncelleme: ${formatDate(intel.lastUpdated)}`}>
      <ImpactCounts intel={intel} />
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', IMPACT_DOT[item.impact])} title={INTEL_IMPACT_LABELS[item.impact]} />
            <span className="min-w-0">
              <span className="text-ink">{item.title}</span>
              <span className="num ml-1.5 text-xs text-muted">{formatDate(item.date)}</span>
            </span>
          </li>
        ))}
      </ul>
      {intel.creditImplication.trim() && (
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink">
          <span className="font-medium">Kredi açısından: </span>
          {intel.creditImplication}
        </p>
      )}
      <IntelNote className="mt-3" />
    </Card>
  )
}

/** Portföy Özeti: sektör bazında olumsuz sinyal sayısı. */
export function MarketIntelSummary({ sectors }: { sectors: { sectorId: SectorId; label: string; firmCount: number }[] }) {
  const marketIntel = useAppState((s) => s.marketIntel)
  const rows = sectors
    .map((s) => ({ ...s, negatives: negativeSignalCount(marketIntel[s.sectorId]), total: marketIntel[s.sectorId].items.length }))
    .sort((a, b) => b.negatives - a.negatives || a.label.localeCompare(b.label, 'tr'))
  return (
    <Card title="Piyasa istihbaratı" subtitle="Sektör bazında olumsuz sinyal sayısı" actions={<Newspaper size={16} className="text-faint" />}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Gösterilecek sektör yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.sectorId} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
              <span className="min-w-0 text-ink">
                {r.label}
                <span className="ml-1.5 text-xs text-muted">{r.firmCount} firma</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="num text-xs text-muted">{r.total} madde</span>
                <Badge tone={r.negatives > 0 ? 'negative' : 'neutral'}>
                  <span className="num">{r.negatives}</span> olumsuz
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      <IntelNote className="mt-3 border-t border-line pt-2.5" />
    </Card>
  )
}
