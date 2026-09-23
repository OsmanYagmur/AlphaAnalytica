import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, GitCommitHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { FIRMS } from '../../data'
import type { FirmImpact, ImpactSummary } from '../../engine/impact'
import { formatNumber, formatSignedPercent, formatScore, formatTL } from '../../lib/format'
import { navigate } from '../../lib/router'
import { nextVersionNumber, useAppState } from '../../store/appStore'
import { editorActions, setImpactPanelOpen, useImpact, useModelEditor } from '../../store/modelEditor'
import { showToast } from '../toast'
import { Badge, Button, Field, GradeBadge, Modal, cx, inputClass } from '../ui'

const FIRM_NAMES = Object.fromEntries(FIRMS.map((f) => [f.id, f.name]))

export function firmName(id: string): string {
  return FIRM_NAMES[id] ?? id
}

/** PD değişimi yüzde puan olarak. */
function formatPdChange(before: number, after: number): string {
  const d = (after - before) * 100
  if (Math.abs(d) < 0.005) return '0,00 yp'
  return `${d > 0 ? '+' : '−'}${formatNumber(Math.abs(d), 2)} yp`
}

export function ImpactSummaryCards({ summary, compact }: { summary: ImpactSummary; compact?: boolean }) {
  const limitDelta = summary.totalLimitAfter - summary.totalLimitBefore
  const limitPct = summary.totalLimitBefore > 0 ? limitDelta / summary.totalLimitBefore : 0
  const cards = [
    { label: 'Not yükselen', value: summary.upgraded, tone: summary.upgraded ? 'text-positive' : 'text-navy' },
    { label: 'Not düşen', value: summary.downgraded, tone: summary.downgraded ? 'text-negative' : 'text-navy' },
    { label: 'Değişmeyen', value: summary.unchanged, tone: 'text-navy' },
  ]
  return (
    <div className={cx('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-5')}>
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-[0.6875rem] text-muted">{c.label}</p>
          <p className={cx('num text-xl font-semibold', c.tone)}>{c.value}</p>
        </div>
      ))}
      <div className={cx('rounded-md border border-line bg-surface px-3 py-2', compact && 'col-span-3')}>
        <p className="text-[0.6875rem] text-muted">Toplam önerilen limit değişimi</p>
        <p className={cx('num text-base font-semibold', limitDelta < 0 ? 'text-negative' : limitDelta > 0 ? 'text-positive' : 'text-navy')}>
          {limitDelta > 0 ? '+' : ''}
          {formatTL(limitDelta)} <span className="text-xs font-normal">({formatSignedPercent(limitPct)})</span>
        </p>
      </div>
      <div className={cx('rounded-md border border-line bg-surface px-3 py-2', compact && 'col-span-3')}>
        <p className="text-[0.6875rem] text-muted">Ortalama PD değişimi</p>
        <p className="num text-base font-semibold text-navy">
          {formatPdChange(summary.avgPdBefore, summary.avgPdAfter)}
          <span className="ml-1 text-xs font-normal text-muted">
            (%{formatNumber(summary.avgPdBefore * 100, 2)} → %{formatNumber(summary.avgPdAfter * 100, 2)})
          </span>
        </p>
      </div>
    </div>
  )
}

function GradeStep({ steps }: { steps: number }) {
  if (steps > 0) return <ArrowUp size={13} className="text-positive" />
  if (steps < 0) return <ArrowDown size={13} className="text-negative" />
  return <ArrowRight size={13} className="text-faint" />
}

export function ImpactTable({ rows, compact, onSelect, selected }: { rows: FirmImpact[]; compact?: boolean; onSelect?: (id: string) => void; selected?: string }) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.gradeSteps) - Math.abs(a.gradeSteps) || Math.abs(b.scoreChange) - Math.abs(a.scoreChange))
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full', compact ? 'text-xs' : 'min-w-[820px] text-sm')}>
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label-caps px-3 py-2 font-semibold">Firma</th>
            <th className="label-caps px-2 py-2 text-right font-semibold">Skor</th>
            <th className="label-caps px-2 py-2 font-semibold">Not</th>
            {!compact && <th className="label-caps px-2 py-2 text-right font-semibold">Mevcut limit</th>}
            {!compact && <th className="label-caps px-2 py-2 text-right font-semibold">Yeni limit</th>}
            <th className="label-caps px-3 py-2 text-right font-semibold">{compact ? 'Limit' : 'Değişim'}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.firmId}
              onClick={onSelect ? () => onSelect(r.firmId) : undefined}
              className={cx(
                'border-b border-line last:border-b-0',
                r.gradeSteps !== 0 && 'bg-edited',
                onSelect && 'cursor-pointer hover:bg-subtle/60',
                selected === r.firmId && 'outline outline-1 -outline-offset-1 outline-navy',
              )}
            >
              <td className={cx('py-2', compact ? 'max-w-[8.5rem] truncate pl-1 pr-2' : 'px-3')} title={firmName(r.firmId)}>
                {firmName(r.firmId)}
              </td>
              <td className="num whitespace-nowrap px-2 py-2 text-right">
                <span className="text-muted">{formatScore(r.before.score)}</span>
                <span className="px-1 text-faint">→</span>
                <span className={cx(r.scoreChange > 0.05 ? 'text-positive' : r.scoreChange < -0.05 ? 'text-negative' : 'text-ink')}>{formatScore(r.after.score)}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                <span className="inline-flex items-center gap-1">
                  {r.gradeSteps !== 0 && <GradeBadge grade={r.before.grade} />}
                  {r.gradeSteps !== 0 && <GradeStep steps={r.gradeSteps} />}
                  <GradeBadge grade={r.after.grade} />
                </span>
              </td>
              {!compact && <td className="num whitespace-nowrap px-2 py-2 text-right text-muted">{formatTL(r.before.limit)}</td>}
              {!compact && <td className="num whitespace-nowrap px-2 py-2 text-right">{formatTL(r.after.limit)}</td>}
              <td className={cx('num whitespace-nowrap px-3 py-2 text-right', r.limitChange < 0 ? 'text-negative' : r.limitChange > 0 ? 'text-positive' : 'text-muted')}>
                {r.before.limit === 0 && r.after.limit === 0 ? '—' : Number.isFinite(r.limitChange) ? formatSignedPercent(r.limitChange) : 'yeni'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Sağdaki canlı Etki Önizleme paneli (aktif model → çalışma kopyası). */
export function ImpactPanel({ docked }: { docked: boolean }) {
  const editor = useModelEditor()
  const { firms, summary } = useImpact()
  const activeVersion = useAppState((s) => s.activeVersion)
  const unchanged = editor.pending.length === 0
  return (
    <div className={cx('flex h-full flex-col bg-surface', docked ? 'rounded-lg border border-line shadow-card' : 'border-l border-line shadow-pop')}>
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-[0.9375rem] font-semibold text-ink">Etki Önizleme</p>
          <p className="text-xs text-muted">
            Aktif model ({activeVersion}) → kaydedilmemiş parametreler · {firms.length} firma
          </p>
        </div>
        <button type="button" onClick={() => setImpactPanelOpen(false)} className="rounded p-1 text-muted hover:bg-subtle" aria-label="Paneli kapat">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {unchanged ? (
          <p className="rounded-md bg-subtle px-3 py-4 text-center text-sm text-muted">Parametreler aktif modelle aynı. Bir değeri değiştirdiğinizde etkisi burada anında görünür.</p>
        ) : (
          <>
            {editor.issues.length > 0 && <Badge tone="negative">Doğrulama hatası var; önizleme geçici değerlerle hesaplanıyor</Badge>}
            <ImpactSummaryCards summary={summary} compact />
            <ImpactTable rows={firms} compact />
          </>
        )}
      </div>
      <div className="border-t border-line px-4 py-2.5">
        <button type="button" onClick={() => navigate('/model/etki')} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          <ExternalLink size={12} />
          Ayrıntılı etki simülasyonu: şelale ve duyarlılık
        </button>
      </div>
    </div>
  )
}

/** "Yeni sürüm olarak kaydet": değişiklik notu zorunlu, numara otomatik. */
export function SaveVersionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const editor = useModelEditor()
  const { summary } = useImpact()
  const versions = useAppState((s) => s.versions)
  const [note, setNote] = useState('')
  const [activate, setActivate] = useState(true)
  const [touched, setTouched] = useState(false)
  const next = nextVersionNumber(versions)
  const noteError = touched && note.trim().length < 5 ? 'Değişiklik notu zorunludur (en az 5 karakter).' : null

  const save = () => {
    setTouched(true)
    if (note.trim().length < 5 || editor.issues.length > 0 || editor.pending.length === 0) return
    const v = editorActions.saveVersion(note, activate)
    showToast(`${v} kaydedildi`, activate ? `${v} aktif model oldu; bekleyen başvurular yeniden hesaplandı.` : `${v} sürüm listesine eklendi.`)
    setNote('')
    setTouched(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yeni sürüm olarak kaydet"
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" icon={<GitCommitHorizontal size={15} />} onClick={save} disabled={editor.issues.length > 0 || editor.pending.length === 0}>
            {next} olarak kaydet
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="num rounded border border-line bg-subtle px-2 py-1 font-semibold text-navy">{next}</span>
        <span className="text-muted">Aktif modele göre {editor.pending.length} parametre değişikliği</span>
      </div>
      {editor.issues.length > 0 && <p className="mb-3 text-sm text-negative">{editor.issues.length} doğrulama hatası giderilmeden kaydedilemez.</p>}
      <div className="mb-4 max-h-40 overflow-y-auto rounded-md border border-line">
        <table className="w-full text-[0.8125rem]">
          <tbody>
            {editor.pending.slice(0, 40).map((c) => (
              <tr key={c.path} className="border-b border-line last:border-b-0">
                <td className="px-3 py-1.5">{c.label}</td>
                <td className="num px-3 py-1.5 text-right text-muted">{String(typeof c.before === 'number' ? formatNumber(c.before, 3) : c.before)}</td>
                <td className="num px-3 py-1.5 text-right font-medium text-navy">{String(typeof c.after === 'number' ? formatNumber(c.after, 3) : c.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="label-caps mb-2">Beklenen etki</p>
      <ImpactSummaryCards summary={summary} />
      <div className="mt-4">
        <Field label="Değişiklik notu (zorunlu)" error={noteError}>
          <textarea
            className={cx(inputClass, 'h-20 resize-none py-2', noteError && 'border-negative')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Örn. Alternatif veri ağırlığı %30'a düşürüldü"
          />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          Kaydettikten sonra aktif model yap (bekleyen başvurular yeniden hesaplanır)
        </label>
      </div>
    </Modal>
  )
}
