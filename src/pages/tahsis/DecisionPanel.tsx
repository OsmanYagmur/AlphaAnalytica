import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { showToast } from '../../components/toast'
import { Badge, Button, Card, DataRow, Field, Modal, NumberInput, StatusBadge, cx, inputClass } from '../../components/ui'
import { REJECTION_REASONS, type RejectionReasonId } from '../../data'
import { isJustificationRequired, limitDeviation } from '../../engine/decision'
import { COLLATERAL_TYPE_IDS, COLLATERAL_TYPE_LABELS, PRODUCT_IDS, PRODUCT_LABELS, type ProductMix } from '../../engine/modelConfig'
import { formatDateTime, formatPercent, formatSignedPercent, formatTL } from '../../lib/format'
import {
  USERS,
  actions,
  buildSystemView,
  finalFromRevision,
  finalFromSystem,
  useAppState,
  type RevisionInput,
} from '../../store/appStore'
import type { FirmView } from '../../store/evaluations'
import type { Decision } from '../../store/types'
import { TermsView } from './TermsView'

const TENOR_OPTIONS = [3, 6, 12, 18, 24, 36]

/** ± adımı: tutarın büyüklüğüne göre (holding ölçeğinde 1 mn ₺). */
function limitStep(reference: number): number {
  if (reference >= 100_000_000) return 1_000_000
  if (reference >= 10_000_000) return 250_000
  return 50_000
}
const COVENANT_SUGGESTIONS = [
  'Ciro ile orantılı hesap çalıştırma',
  'Üç aylık mizan ve KDV beyannamesi paylaşımı',
  'Kredi süresince kâr dağıtımı kısıtı',
  'Ortakların şahsi kefaleti',
]

function baseDecision(view: FirmView): Pick<Decision, 'firmId' | 'modelVersion' | 'decidedBy' | 'decidedAt' | 'dataAsOf' | 'system' | 'utilization'> {
  const months = view.firm.alternative.months
  return {
    firmId: view.firm.id,
    modelVersion: view.modelVersion,
    decidedBy: USERS.tahsis.name,
    decidedAt: new Date().toISOString(),
    dataAsOf: months[months.length - 1],
    system: buildSystemView(view.evaluation),
    utilization: 0,
  }
}

// ---------------------------------------------------------------------------
// Onay
// ---------------------------------------------------------------------------

function ApproveModal({ view, open, onClose }: { view: FirmView; open: boolean; onClose: () => void }) {
  const terms = view.evaluation.terms
  if (!terms) return null
  const confirm = () => {
    const decision: Decision = {
      ...baseDecision(view),
      status: 'approved',
      final: finalFromSystem(terms, view.config.sectors[view.firm.sectorId].productMix),
      note: 'Sistem önerisi aynen onaylandı.',
    }
    actions.recordDecision(decision, `Sistem önerisiyle onaylandı: ${formatTL(terms.limit)}`)
    showToast('Karar kaydedildi', `${view.firm.name} · Onaylandı · ${formatTL(terms.limit)}`)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sistem önerisini onayla"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="accent" icon={<Check size={16} />} onClick={confirm}>
            Onayla
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        <span className="font-medium text-ink">{view.firm.name}</span> için sistem önerisi aşağıdaki şartlarla aynen onaylanacak.
      </p>
      <dl className="mb-4">
        <DataRow label="Limit" value={formatTL(terms.limit)} strong />
      </dl>
      <TermsView
        terms={{
          limit: terms.limit,
          products: terms.products,
          collateral: terms.collateral,
          tenorMonths: terms.tenor.months,
          revolving: terms.tenor.revolving,
          referenceRate: terms.pricing.referenceRate,
          spreadBp: terms.pricing.spreadBp,
        }}
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------

function RejectModal({ view, open, onClose }: { view: FirmView; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<RejectionReasonId | ''>('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const reasonError = touched && !reason ? 'Red gerekçesi seçilmelidir.' : null
  const noteError = touched && note.trim().length < 10 ? 'Açıklama zorunludur (en az 10 karakter).' : null

  const confirm = () => {
    setTouched(true)
    if (!reason || note.trim().length < 10) return
    const decision: Decision = { ...baseDecision(view), status: 'rejected', final: null, rejectionReason: reason, note: note.trim() }
    actions.recordDecision(decision, `Reddedildi: ${REJECTION_REASONS[reason]} — ${note.trim()}`)
    showToast('Karar kaydedildi', `${view.firm.name} · Reddedildi`, 'danger')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Başvuruyu reddet"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" icon={<X size={16} />} onClick={confirm}>
            Reddet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Red gerekçesi" error={reasonError}>
          <select className={cx(inputClass, reasonError && 'border-negative')} value={reason} onChange={(e) => setReason(e.target.value as RejectionReasonId)}>
            <option value="">Seçiniz…</option>
            {Object.entries(REJECTION_REASONS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Açıklama" error={noteError}>
          <textarea
            className={cx(inputClass, 'h-28 resize-none py-2', noteError && 'border-negative')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Red kararının gerekçesini açıklayın"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Revize
// ---------------------------------------------------------------------------

interface RevisionForm {
  limit: number
  collateralType: RevisionInput['collateralType']
  collateralPct: number
  tenorMonths: number
  revolving: boolean
  mixPct: Record<keyof ProductMix, number>
  covenants: string[]
  justification: string
}

function initialForm(view: FirmView): RevisionForm {
  const terms = view.evaluation.terms
  const mix = view.config.sectors[view.firm.sectorId].productMix
  return {
    limit: terms?.limit ?? 0,
    collateralType: terms?.collateral.type ?? 'mortgage',
    collateralPct: Math.round((terms?.collateral.ratio ?? view.config.terms.collateralRatio.B) * 100),
    tenorMonths: terms?.tenor.months ?? 6,
    revolving: terms?.tenor.revolving ?? false,
    mixPct: Object.fromEntries(PRODUCT_IDS.map((p) => [p, Math.round(mix[p] * 100)])) as RevisionForm['mixPct'],
    covenants: [],
    justification: '',
  }
}

function ReviseModal({ view, open, onClose }: { view: FirmView; open: boolean; onClose: () => void }) {
  const initial = useMemo(() => initialForm(view), [view])
  const [form, setForm] = useState<RevisionForm>(initial)
  const [touched, setTouched] = useState(false)
  const set = <K extends keyof RevisionForm>(key: K, value: RevisionForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const systemLimit = view.evaluation.limit.limit
  const deviation = limitDeviation(form.limit, systemLimit)
  const needsJustification = isJustificationRequired(form.limit, systemLimit, view.config)
  const mixTotal = PRODUCT_IDS.reduce((a, p) => a + (Number.isFinite(form.mixPct[p]) ? form.mixPct[p] : 0), 0)

  const errors = {
    limit: !(form.limit > 0) ? 'Limit sıfırdan büyük olmalıdır.' : null,
    collateral: !(form.collateralPct >= 0) ? 'Teminat oranı negatif olamaz.' : null,
    mix: Math.abs(mixTotal - 100) > 0.01 || PRODUCT_IDS.some((p) => !(form.mixPct[p] >= 0)) ? `Ürün kırılımı toplamı %100 olmalıdır (şu an %${mixTotal}).` : null,
    justification: needsJustification && form.justification.trim().length < 10 ? 'Sistem önerisinden sapma yüksek; gerekçe zorunludur (en az 10 karakter).' : null,
  }
  const valid = Object.values(errors).every((e) => e === null)

  const edited = {
    limit: form.limit !== initial.limit,
    collateralType: form.collateralType !== initial.collateralType,
    collateralPct: form.collateralPct !== initial.collateralPct,
    tenor: form.tenorMonths !== initial.tenorMonths || form.revolving !== initial.revolving,
  }

  const confirm = () => {
    setTouched(true)
    if (!valid) return
    const productMix = Object.fromEntries(PRODUCT_IDS.map((p) => [p, form.mixPct[p] / 100])) as ProductMix
    const base = baseDecision(view)
    const final = finalFromRevision(
      {
        limit: form.limit,
        collateralRatio: form.collateralPct / 100,
        collateralType: form.collateralType,
        tenorMonths: form.tenorMonths,
        revolving: form.revolving,
        productMix,
        covenants: form.covenants,
      },
      base.system,
      view.config,
    )
    const changes: string[] = []
    if (edited.limit) changes.push(`limit ${formatTL(systemLimit)} → ${formatTL(form.limit)} (${formatSignedPercent(deviation)})`)
    if (edited.collateralPct) changes.push(`teminat %${initial.collateralPct} → %${form.collateralPct}`)
    if (edited.collateralType) changes.push(`teminat türü → ${COLLATERAL_TYPE_LABELS[form.collateralType]}`)
    if (edited.tenor) changes.push(`vade ${initial.tenorMonths} → ${form.tenorMonths} ay${form.revolving ? ' rotatif' : ''}`)
    if (PRODUCT_IDS.some((p) => form.mixPct[p] !== initial.mixPct[p])) changes.push('ürün kırılımı değişti')
    if (final.covenants.length > 0) changes.push(`${final.covenants.length} özel şart eklendi`)

    const decision: Decision = {
      ...base,
      status: 'revisedApproved',
      final,
      note: form.justification.trim() || 'Şartlar revize edilerek onaylandı.',
    }
    actions.recordDecision(decision, `Revize onay: ${changes.length ? changes.join('; ') : 'sistem şartlarıyla'}`)
    showToast('Karar kaydedildi', `${view.firm.name} · Revize Onay · ${formatTL(form.limit)}`)
    onClose()
  }

  const deviationTone = !Number.isFinite(deviation) || needsJustification ? 'text-negative' : deviation === 0 ? 'text-muted' : 'text-warning'

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title="Şartları revize et"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" icon={<Check size={16} />} onClick={confirm} disabled={touched && !valid}>
            Revize ederek onayla
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle px-4 py-3">
        <div className="text-sm">
          <span className="text-muted">Sistem önerisi: </span>
          <span className="num font-medium">{systemLimit > 0 ? formatTL(systemLimit) : 'Limit yok'}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted">Sistem önerisinden sapma: </span>
          <span className={cx('num font-semibold', deviationTone)}>{Number.isFinite(deviation) ? formatSignedPercent(deviation) : 'Sistem limiti yok'}</span>
        </div>
      </div>
      {needsJustification && (
        <p className="mb-4 rounded-md border border-[#eccac6] bg-negative-soft px-3 py-2 text-[0.8125rem] text-negative">
          Sistem önerisinden sapma yüksek; bu kararın gerekçesi zorunludur.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Limit (₺)" error={touched ? errors.limit : null} hint={<span className="num">{formatTL(form.limit)}</span>}>
          <NumberInput value={form.limit} onChange={(v) => set('limit', v)} step={limitStep(systemLimit || view.firm.requestedAmount)} min={0} suffix="₺" edited={edited.limit} invalid={touched && !!errors.limit} ariaLabel="Limit" />
        </Field>
        <Field label="Vade">
          <div className="flex gap-2">
            <select
              className={cx(inputClass, edited.tenor && 'bg-edited')}
              value={form.tenorMonths}
              onChange={(e) => set('tenorMonths', Number(e.target.value))}
            >
              {TENOR_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} ay
                </option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-2 rounded-md border border-line px-3 text-sm">
              <input type="checkbox" checked={form.revolving} onChange={(e) => set('revolving', e.target.checked)} />
              Rotatif
            </label>
          </div>
        </Field>
        <Field label="Teminat türü">
          <select
            className={cx(inputClass, edited.collateralType && 'bg-edited')}
            value={form.collateralType}
            onChange={(e) => set('collateralType', e.target.value as RevisionForm['collateralType'])}
          >
            {COLLATERAL_TYPE_IDS.map((t) => (
              <option key={t} value={t}>
                {COLLATERAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teminat oranı (limitin yüzdesi)" error={touched ? errors.collateral : null}>
          <NumberInput value={form.collateralPct} onChange={(v) => set('collateralPct', v)} step={5} min={0} suffix="%" edited={edited.collateralPct} ariaLabel="Teminat oranı" />
        </Field>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted">Ürün kırılımı (%)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_IDS.map((p) => (
            <Field key={p} label={PRODUCT_LABELS[p]}>
              <NumberInput
                value={form.mixPct[p]}
                onChange={(v) => set('mixPct', { ...form.mixPct, [p]: v })}
                step={5}
                min={0}
                max={100}
                suffix="%"
                edited={form.mixPct[p] !== initial.mixPct[p]}
                invalid={touched && !!errors.mix}
                ariaLabel={PRODUCT_LABELS[p]}
              />
            </Field>
          ))}
        </div>
        <p className={cx('num mt-1.5 text-xs', Math.abs(mixTotal - 100) > 0.01 ? 'text-negative' : 'text-positive')}>
          Toplam: %{mixTotal} {touched && errors.mix ? `· ${errors.mix}` : ''}
        </p>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted">Özel şartlar (kovenant)</p>
        <div className="space-y-2">
          {form.covenants.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputClass}
                value={c}
                onChange={(e) => set('covenants', form.covenants.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="Özel şart"
              />
              <Button variant="ghost" size="sm" className="h-9" aria-label="Kaldır" onClick={() => set('covenants', form.covenants.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set('covenants', [...form.covenants, ''])}>
            Şart ekle
          </Button>
          {COVENANT_SUGGESTIONS.filter((s) => !form.covenants.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('covenants', [...form.covenants, s])}
              className="rounded border border-dashed border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Field label={needsJustification ? 'Gerekçe (zorunlu)' : 'Gerekçe notu'} error={touched ? errors.justification : null}>
          <textarea
            className={cx(inputClass, 'h-24 resize-none py-2', touched && errors.justification && 'border-negative')}
            value={form.justification}
            onChange={(e) => set('justification', e.target.value)}
            placeholder="Revizyonun gerekçesini açıklayın"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Karar paneli
// ---------------------------------------------------------------------------

function DecisionSummary({ decision }: { decision: Decision }) {
  const final = decision.final
  const system = decision.system
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={decision.status} />
        <span className="text-xs text-muted">
          {decision.decidedBy} · {formatDateTime(decision.decidedAt)}
        </span>
      </div>
      {decision.status === 'rejected' ? (
        <dl>
          <DataRow label="Red gerekçesi" value={<span className="font-sans">{decision.rejectionReason ? REJECTION_REASONS[decision.rejectionReason] : '—'}</span>} />
          <DataRow label="Sistem önerisi" value={system.limit > 0 ? formatTL(system.limit) : 'Limit yok'} />
        </dl>
      ) : (
        final && (
          <>
            <dl>
              <DataRow label="Sistem önerisi" value={system.limit > 0 ? formatTL(system.limit) : 'Limit yok'} />
              <DataRow
                label="Onaylanan limit"
                value={
                  <span className={final.limit !== system.limit ? 'text-accent' : ''}>
                    {formatTL(final.limit)}
                    {final.limit !== system.limit && system.limit > 0 && <span className="ml-1 text-xs">({formatSignedPercent(limitDeviation(final.limit, system.limit))})</span>}
                  </span>
                }
                strong
              />
              {system.terms && final.collateral.ratio !== system.terms.collateral.ratio && (
                <DataRow label="Teminat oranı" value={`${formatPercent(system.terms.collateral.ratio, 0)} → ${formatPercent(final.collateral.ratio, 0)}`} />
              )}
              {system.terms && final.tenorMonths !== system.terms.tenor.months && (
                <DataRow label="Vade" value={`${system.terms.tenor.months} → ${final.tenorMonths} ay`} />
              )}
            </dl>
            <TermsView terms={final} />
          </>
        )
      )}
      <div>
        <p className="label-caps mb-1">Tahsisçi notu</p>
        <p className="text-sm leading-relaxed text-ink">{decision.note}</p>
      </div>
    </div>
  )
}

export function DecisionPanel({ view }: { view: FirmView }) {
  const [modal, setModal] = useState<'approve' | 'reject' | 'revise' | null>(null)
  const close = () => setModal(null)
  const canApprove = !!view.evaluation.terms && view.evaluation.limit.limit > 0

  if (view.decision) {
    return (
      <Card title="Karar" actions={<Badge tone="neutral">Karara bağlandı</Badge>}>
        <DecisionSummary decision={view.decision} />
      </Card>
    )
  }

  return (
    <Card title="Karar paneli" subtitle={`${USERS.tahsis.name} · ${USERS.tahsis.title}`}>
      <div className="grid gap-2">
        <Button variant="accent" icon={<Check size={16} />} onClick={() => setModal('approve')} disabled={!canApprove}>
          Onayla
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setModal('revise')}>
            Revize Et
          </Button>
          <Button variant="danger" icon={<X size={16} />} onClick={() => setModal('reject')}>
            Reddet
          </Button>
        </div>
      </div>
      {!canApprove && <p className="mt-3 text-xs text-muted">Sistem limit önermediği için doğrudan onay kapalıdır.</p>}
      {modal === 'approve' && <ApproveModal view={view} open onClose={close} />}
      {modal === 'reject' && <RejectModal view={view} open onClose={close} />}
      {modal === 'revise' && <ReviseModal view={view} open onClose={close} />}
    </Card>
  )
}

export function AuditLog({ firmId }: { firmId: string }) {
  const entries = useAppState((s) => s.audit[firmId])
  const list = [...(entries ?? [])].reverse()
  return (
    <Card title="Karar geçmişi" subtitle="Denetim izi: kim, ne zaman, ne değişti">
      {list.length === 0 ? (
        <p className="text-sm text-muted">Kayıt yok.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-4">
          {list.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative">
              <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full border border-surface bg-navy" />
              <p className="num text-xs text-muted">{formatDateTime(e.at)}</p>
              <p className="text-sm text-ink">{e.action}</p>
              <p className="text-xs text-muted">{e.by}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
