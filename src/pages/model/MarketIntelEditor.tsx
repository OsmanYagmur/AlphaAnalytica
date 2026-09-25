import { ExternalLink, Info, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ImpactBadge } from '../../components/MarketIntel'
import { ModelShell } from '../../components/model/ModelShell'
import { showToast } from '../../components/toast'
import { Button, Card, Field, Modal, SegmentedControl, cx, inputClass } from '../../components/ui'
import { INTEL_IMPACT_LABELS, negativeSignalCount, type IntelImpact, type MarketIntelItem } from '../../data'
import { SECTOR_IDS, type SectorId } from '../../engine/modelConfig'
import { formatDate } from '../../lib/format'
import { USERS, actions, useAppState } from '../../store/appStore'
import { useActiveConfig } from '../../store/evaluations'

const SUMMARY_MAX = 400
const IMPLICATION_MAX = 400

type Draft = Omit<MarketIntelItem, 'id'> & { id: string | null }

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY_DRAFT: Draft = { id: null, title: '', summary: '', impact: 'neutral', source: '', sourceUrl: '', date: todayIso() }

function draftErrors(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.title.trim()) e.title = 'Başlık zorunlu.'
  if (!d.summary.trim()) e.summary = 'Özet zorunlu.'
  else if (d.summary.length > SUMMARY_MAX) e.summary = `En fazla ${SUMMARY_MAX} karakter.`
  if (!d.source.trim()) e.source = 'Kaynak adı zorunlu.'
  if (d.sourceUrl.trim() && !/^https?:\/\//.test(d.sourceUrl.trim())) e.sourceUrl = 'Bağlantı http:// veya https:// ile başlamalı.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Tarih seçin.'
  return e
}

function textareaClass(invalid?: boolean) {
  return cx(inputClass, 'h-auto min-h-[5.5rem] py-2 leading-relaxed', invalid && 'border-negative')
}

export function ModelMarketIntel() {
  const config = useActiveConfig()
  const marketIntel = useAppState((s) => s.marketIntel)
  const [sector, setSector] = useState<SectorId>('stationery')
  const intel = marketIntel[sector]
  const label = config.sectors[sector].label
  const author = USERS.model.name

  const [draft, setDraft] = useState<Draft | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<MarketIntelItem | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [implication, setImplication] = useState<{ sector: SectorId; text: string } | null>(null)
  const implicationText = implication?.sector === sector ? implication.text : intel.creditImplication

  const errors = draft ? draftErrors(draft) : {}
  const items = [...intel.items].sort((a, b) => b.date.localeCompare(a.date))

  const saveDraft = () => {
    if (!draft) return
    if (Object.keys(errors).length > 0) {
      setShowErrors(true)
      return
    }
    const clean: MarketIntelItem = {
      id: draft.id ?? `${sector}-${Date.now().toString(36)}`,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      impact: draft.impact,
      source: draft.source.trim(),
      sourceUrl: draft.sourceUrl.trim(),
      date: draft.date,
    }
    const isNew = draft.id === null
    const nextItems = isNew ? [...intel.items, clean] : intel.items.map((i) => (i.id === clean.id ? clean : i))
    actions.saveSectorIntel(sector, { ...intel, items: nextItems }, author, `${label}: “${clean.title}” ${isNew ? 'eklendi' : 'güncellendi'}`)
    showToast(isNew ? 'Madde eklendi' : 'Madde güncellendi', `${label} · ${clean.title}`)
    setDraft(null)
    setShowErrors(false)
  }

  const confirmDelete = () => {
    if (!deleting) return
    actions.saveSectorIntel(sector, { ...intel, items: intel.items.filter((i) => i.id !== deleting.id) }, author, `${label}: “${deleting.title}” silindi`)
    showToast('Madde silindi', `${label} · ${deleting.title}`, 'info')
    setDeleting(null)
  }

  const saveImplication = () => {
    actions.saveSectorIntel(sector, { ...intel, creditImplication: implicationText.trim() }, author, `${label}: kredi yorumu güncellendi`)
    setImplication(null)
    showToast('Kredi yorumu kaydedildi', label)
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  return (
    <ModelShell title="Piyasa İstihbaratı" impactPanel={false}>
      <div className="mb-4 flex items-start gap-2 rounded-md border border-[#c8dedc] bg-accent-soft px-4 py-2.5 text-[0.8125rem] text-ink">
        <Info size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>
          Piyasa istihbaratı bilgi amaçlıdır: kredi skorunu, notu ve limiti etkilemez ve model sürümlerine dahil değildir. Değişiklikler kaydedildiği anda Tahsis ve Portföy
          ekranlarına yansır ve model denetim izine yazılır.
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SECTOR_IDS.map((id) => {
          const neg = negativeSignalCount(marketIntel[id])
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSector(id)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[0.8125rem] transition-colors',
                sector === id ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink hover:border-navy',
              )}
            >
              {config.sectors[id].label}
              <span className={cx('num text-xs', sector === id ? 'text-white/70' : 'text-muted')}>
                {marketIntel[id].items.length}
                {neg > 0 && <span className={sector === id ? 'text-[#f3b1aa]' : 'text-negative'}> · {neg}−</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={`${label} · maddeler`}
          subtitle={`Son güncelleme: ${formatDate(intel.lastUpdated)} · ${intel.items.length} madde`}
          actions={
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => (setShowErrors(false), setDraft({ ...EMPTY_DRAFT, date: todayIso() }))}>
              Yeni madde
            </Button>
          }
          bodyClassName="p-0"
        >
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Bu sektör için madde yok.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-ink">{item.title}</h3>
                        <ImpactBadge impact={item.impact} />
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink/90">{item.summary}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="num">{formatDate(item.date)}</span>
                        <span aria-hidden>·</span>
                        <span>{item.source}</span>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                            bağlantı <ExternalLink size={11} />
                          </a>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" icon={<Pencil size={14} />} aria-label={`${item.title} düzenle`} onClick={() => (setShowErrors(false), setDraft({ ...item }))}>
                        Düzenle
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`${item.title} sil`} onClick={() => setDeleting(item)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Kredi açısından ne anlama geliyor" subtitle="1–2 cümle; sektör sekmesinin altında gösterilir">
            <textarea
              className={textareaClass(implicationText.length > IMPLICATION_MAX)}
              rows={5}
              value={implicationText}
              onChange={(e) => setImplication({ sector, text: e.target.value })}
              aria-label="Kredi açısından yorum"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={cx('num text-xs', implicationText.length > IMPLICATION_MAX ? 'text-negative' : 'text-muted')}>
                {implicationText.length} / {IMPLICATION_MAX}
              </span>
              <div className="flex gap-2">
                {implicationText !== intel.creditImplication && (
                  <Button size="sm" variant="ghost" onClick={() => setImplication(null)}>
                    Vazgeç
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="accent"
                  disabled={implicationText.trim() === intel.creditImplication || implicationText.length > IMPLICATION_MAX}
                  onClick={saveImplication}
                >
                  Kaydet
                </Button>
              </div>
            </div>
          </Card>
          <Card title="Araştırma verisi">
            <p className="text-sm text-muted">
              Başlangıç maddeleri 25.09.2026 tarihli web araştırmasından derlenmiştir. Bu sektördeki düzenlemeleri geri almak için araştırma verisine dönebilirsiniz.
            </p>
            <Button className="mt-3" size="sm" icon={<RotateCcw size={14} />} onClick={() => setConfirmReset(true)}>
              Araştırma verisine dön
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Maddeyi düzenle' : `Yeni madde · ${label}`}
        onClose={() => setDraft(null)}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Vazgeç
            </Button>
            <Button variant="primary" onClick={saveDraft}>
              Kaydet
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Başlık" error={showErrors ? errors.title : null}>
                <input className={cx(inputClass, showErrors && errors.title && 'border-negative')} value={draft.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Özet (1–2 cümle, kendi cümlelerinizle)" error={showErrors ? errors.summary : null} hint={`${draft.summary.length} / ${SUMMARY_MAX}`}>
                <textarea className={textareaClass(showErrors && !!errors.summary)} rows={3} value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted">Etki yönü</span>
              <SegmentedControl<IntelImpact>
                ariaLabel="Etki yönü"
                value={draft.impact}
                onChange={(v) => set('impact', v)}
                items={(['positive', 'neutral', 'negative'] as const).map((v) => ({ value: v, label: INTEL_IMPACT_LABELS[v] }))}
              />
            </div>
            <Field label="Kaynak adı" error={showErrors ? errors.source : null}>
              <input className={cx(inputClass, showErrors && errors.source && 'border-negative')} value={draft.source} onChange={(e) => set('source', e.target.value)} placeholder="ör. TÜİK" />
            </Field>
            <Field label="Tarih" error={showErrors ? errors.date : null}>
              <input type="date" className={inputClass} value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Kaynak bağlantısı (isteğe bağlı)" error={showErrors ? errors.sourceUrl : null}>
                <input className={cx(inputClass, showErrors && errors.sourceUrl && 'border-negative')} value={draft.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://" />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Madde silinsin mi?"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Vazgeç
            </Button>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={confirmDelete}>
              Sil
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          “{deleting?.title}” maddesi {label} sektöründen silinecek. Bu işlem denetim izine yazılır; araştırma verisine dönerek geri alınabilir.
        </p>
      </Modal>

      <Modal
        open={confirmReset}
        title="Araştırma verisine dönülsün mü?"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                actions.resetSectorIntel(sector, author, label)
                setImplication(null)
                setConfirmReset(false)
                showToast('Araştırma verisine dönüldü', label, 'info')
              }}
            >
              Dön
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">{label} sektöründeki tüm eklemeler, düzenlemeler ve silmeler geri alınacak.</p>
      </Modal>
    </ModelShell>
  )
}
