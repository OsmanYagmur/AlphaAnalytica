import { Activity, AlertCircle, GitCommitHorizontal, Plus, RotateCcw, Save, Scale, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Breakpoint, IndicatorUnit, RatioUnit } from '../../engine/modelConfig'
import { formatNumber } from '../../lib/format'
import { getIn, setIn } from '../../lib/objectPath'
import { editorActions, setImpactPanelOpen, useImpact, useImpactPanelOpen, useModelEditor } from '../../store/modelEditor'
import { SaveVersionModal } from './impact'
import { showToast } from '../toast'
import { Badge, Button, ModelVersionTag, NumberInput, cx, inputClass } from '../ui'
import { useAppState } from '../../store/appStore'
import { CHART_COLORS } from '../charts'

// ---------------------------------------------------------------------------
// Birim gösterimi
// ---------------------------------------------------------------------------

export interface UnitDisplay {
  scale: number
  suffix: string
  step: number
  digits: number
}

export function unitDisplay(unit: RatioUnit | IndicatorUnit | 'growth'): UnitDisplay {
  switch (unit) {
    case 'share':
    case 'change':
    case 'growth':
      return { scale: 100, suffix: '%', step: 1, digits: 1 }
    case 'ratio':
      return { scale: 1, suffix: '', step: 0.1, digits: 2 }
    case 'multiple':
      return { scale: 1, suffix: 'x', step: 0.1, digits: 2 }
    case 'medianMultiple':
      return { scale: 1, suffix: '× med.', step: 0.1, digits: 2 }
    case 'rating5':
      return { scale: 1, suffix: '/5', step: 0.1, digits: 2 }
    case 'rating10':
      return { scale: 1, suffix: '/10', step: 0.1, digits: 1 }
    case 'days':
      return { scale: 1, suffix: 'gün', step: 5, digits: 0 }
    case 'months':
      return { scale: 1, suffix: 'ay', step: 0.5, digits: 1 }
    case 'times':
      return { scale: 1, suffix: 'kez', step: 0.5, digits: 1 }
    case 'count':
      return { scale: 1, suffix: '/ay', step: 0.05, digits: 2 }
    case 'lPer100km':
      return { scale: 1, suffix: 'L', step: 1, digits: 1 }
    case 'binary':
      return { scale: 1, suffix: '', step: 1, digits: 0 }
  }
}

/** Görüntüleme için yuvarlama (kayan nokta gürültüsünü gizler). */
function display(v: number, scale: number): number {
  return Math.round(v * scale * 1e6) / 1e6
}

// ---------------------------------------------------------------------------
// Araç çubuğu
// ---------------------------------------------------------------------------

export function EditorToolbar({ impactToggle = true }: { impactToggle?: boolean }) {
  const editor = useModelEditor()
  const activeVersion = useAppState((s) => s.activeVersion)
  const panelOpen = useImpactPanelOpen()
  const { summary } = useImpact()
  const [saveOpen, setSaveOpen] = useState(false)
  const errors = editor.issues.length
  const gradeChanges = summary.upgraded + summary.downgraded
  return (
    <>
      <ModelVersionTag version={activeVersion} />
      {editor.hasDraft && !editor.dirty && <Badge tone="accent">Taslak kayıtlı</Badge>}
      {editor.dirty && <Badge tone="warning">Kaydedilmemiş: {editor.unsaved.length}</Badge>}
      {errors > 0 && (
        <Badge tone="negative">
          <AlertCircle size={11} />
          {errors} hata
        </Badge>
      )}
      <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} disabled={!editor.dirty} onClick={() => editorActions.revert()}>
        Geri al
      </Button>
      <Button
        size="sm"
        variant="primary"
        icon={<Save size={14} />}
        disabled={!editor.dirty || errors > 0}
        title={errors > 0 ? 'Hatalar giderilmeden kaydedilemez' : undefined}
        onClick={() => {
          editorActions.saveDraft()
          showToast('Taslak kaydedildi', 'Parametre değişiklikleri taslak olarak saklandı; aktif model değişmedi.', 'info')
        }}
      >
        Taslak
      </Button>
      <Button
        size="sm"
        variant="accent"
        icon={<GitCommitHorizontal size={14} />}
        disabled={editor.pending.length === 0 || errors > 0}
        title={editor.pending.length === 0 ? 'Aktif modelden farklı parametre yok' : undefined}
        onClick={() => setSaveOpen(true)}
      >
        Yeni sürüm
      </Button>
      {impactToggle && (
        <Button size="sm" variant={panelOpen ? 'primary' : 'secondary'} icon={<Activity size={14} />} onClick={() => setImpactPanelOpen(!panelOpen)} aria-pressed={panelOpen}>
          Etki
          {gradeChanges > 0 && <span className="num rounded bg-warning px-1 text-[0.625rem] text-white">{gradeChanges}</span>}
        </Button>
      )}
      {saveOpen && <SaveVersionModal open onClose={() => setSaveOpen(false)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Yapı taşları
// ---------------------------------------------------------------------------

export function Formula({ children }: { children: ReactNode }) {
  return <div className="num overflow-x-auto whitespace-nowrap rounded-md border border-line bg-subtle px-3 py-2 text-[0.8125rem] text-navy">{children}</div>
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-negative">
      <AlertCircle size={12} className="mt-0.5 shrink-0" />
      {message}
    </p>
  )
}

interface ParamInputProps {
  path: string
  label: ReactNode
  hint?: ReactNode
  step: number
  min?: number
  max?: number
  scale?: number
  suffix?: string
  width?: string
}

/** Etiketli sayısal parametre: sağa hizalı, ± adımlı, değişiklik vurgulu, satır içi hata. */
export function ParamInput({ path, label, hint, step, min, max, scale = 1, suffix, width = 'w-40' }: ParamInputProps) {
  const e = useModelEditor()
  const value = e.get(path) as number
  const error = e.issueAt(path)
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <div className="min-w-0 pt-2">
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className={cx('shrink-0', width)}>
        <NumberInput
          value={display(value, scale)}
          onChange={(v) => editorActions.set(path, v / scale)}
          step={step}
          min={min}
          max={max}
          suffix={suffix}
          edited={e.isEdited(path)}
          invalid={!!error}
          ariaLabel={typeof label === 'string' ? label : path}
        />
        <InlineError message={error} />
      </div>
    </div>
  )
}

export function ToggleParam({ path, label, hint }: { path: string; label: ReactNode; hint?: ReactNode }) {
  const e = useModelEditor()
  const on = e.get(path) as boolean
  return (
    <div className={cx('flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0', e.isEdited(path) && 'bg-edited')}>
      <div>
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <Switch checked={on} onChange={(v) => editorActions.set(path, v)} label={typeof label === 'string' ? label : path} />
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-5 w-9 shrink-0 rounded transition-colors', checked ? 'bg-accent' : 'bg-[#c9ccd3]')}
    >
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-sm bg-white shadow-sm transition-all', checked ? 'left-[1.125rem]' : 'left-0.5')} />
    </button>
  )
}

export function SelectParam<T extends string>({ path, options, className }: { path: string; options: { value: T; label: string }[]; className?: string }) {
  const e = useModelEditor()
  const error = e.issueAt(path)
  return (
    <div className={className}>
      <select
        className={cx(inputClass, e.isEdited(path) && 'bg-edited', error && 'border-negative')}
        value={e.get(path) as string}
        onChange={(ev) => editorActions.set(path, ev.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <InlineError message={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ağırlık grubu
// ---------------------------------------------------------------------------

interface WeightGroupProps {
  /** Grubun yolu (toplam hatası bu yolda raporlanır). */
  path: string
  items: { key: string; label: ReactNode }[]
  /** Öğeler nesneyse ağırlık alanı ('weight'); doğrudan sayıysa verilmez. */
  field?: string
  title?: ReactNode
}

/** Toplamı %100 olması gereken ağırlıklar: canlı toplam göstergesi ve orantılı normalizasyon. */
export function WeightGroup({ path, items, field, title }: WeightGroupProps) {
  const e = useModelEditor()
  const itemPath = (key: string) => (field ? `${path}.${key}.${field}` : `${path}.${key}`)
  const values = items.map((i) => e.get(itemPath(i.key)) as number)
  const total = values.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0)
  const groupError = e.issueAt(path)
  const ok = !groupError && values.every((v) => Number.isFinite(v) && v >= 0)

  const normalize = () => {
    const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
    const sum = clean.reduce((a, v) => a + v, 0)
    editorActions.update((c) => {
      let next = c
      items.forEach((item, i) => {
        const v = sum > 0 ? clean[i] / sum : 1 / items.length
        next = setIn(next, itemPath(item.key), v)
      })
      return next
    })
  }

  return (
    <div>
      {title && <p className="label-caps mb-1">{title}</p>}
      <div>
        {items.map((item, i) => {
          const p = itemPath(item.key)
          const error = e.issueAt(p)
          return (
            <div key={item.key} className="flex items-center justify-between gap-4 border-b border-line py-2">
              <span className="min-w-0 text-sm text-ink">{item.label}</span>
              <div className="w-36 shrink-0">
                <NumberInput
                  value={Math.round(values[i] * 10000) / 100}
                  onChange={(v) => editorActions.set(p, v / 100)}
                  step={1}
                  min={0}
                  max={100}
                  suffix="%"
                  edited={e.isEdited(p)}
                  invalid={!!error}
                  ariaLabel={typeof item.label === 'string' ? item.label : item.key}
                />
                <InlineError message={error} />
              </div>
            </div>
          )
        })}
      </div>
      <div className={cx('mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2', ok ? 'bg-positive-soft' : 'bg-negative-soft')}>
        <span className={cx('num text-sm font-semibold', ok ? 'text-positive' : 'text-negative')}>
          Toplam: %{formatNumber(total * 100, 2)}
        </span>
        <Button size="sm" variant="secondary" icon={<Scale size={14} />} onClick={normalize} disabled={ok}>
          Orantılı olarak normalize et
        </Button>
      </div>
      {groupError && <InlineError message={groupError} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kırılım tablosu ve eğri
// ---------------------------------------------------------------------------

function CurveChart({ points, unit }: { points: Breakpoint[]; unit: UnitDisplay }) {
  const valid = points.filter((p) => Number.isFinite(p.value) && Number.isFinite(p.score))
  if (valid.length < 2) return <div className="flex h-28 items-center justify-center text-xs text-muted">Eğri için en az iki geçerli nokta gerekli</div>
  const sorted = [...valid].sort((a, b) => a.value - b.value)
  const span = sorted[sorted.length - 1].value - sorted[0].value || 1
  const data = [
    { x: (sorted[0].value - span * 0.15) * unit.scale, y: sorted[0].score },
    ...sorted.map((p) => ({ x: p.value * unit.scale, y: p.score })),
    { x: (sorted[sorted.length - 1].value + span * 0.15) * unit.scale, y: sorted[sorted.length - 1].score },
  ]
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => formatNumber(Number(v), unit.digits > 1 ? 1 : unit.digits)} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v) => [formatNumber(Number(v), 1), 'Puan']} labelFormatter={(x) => `${formatNumber(Number(x), unit.digits)} ${unit.suffix}`} />
          <Line type="linear" dataKey="y" stroke={CHART_COLORS.petrol} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BreakpointEditorProps {
  path: string
  title: ReactNode
  description?: ReactNode
  unit: UnitDisplay
  valueLabel?: string
}

/** Normalizasyon kırılım noktaları (değer → puan) ve anında güncellenen eğri. */
export function BreakpointEditor({ path, title, description, unit, valueLabel = 'Değer' }: BreakpointEditorProps) {
  const e = useModelEditor()
  const points = e.get(path) as Breakpoint[]
  const curveError = e.issueAt(path)

  const addRow = () => {
    const last = points[points.length - 1]
    editorActions.set(path, [...points, { value: (last?.value ?? 0) + unit.step / unit.scale, score: last?.score ?? 50 }])
  }
  const removeRow = (i: number) => editorActions.set(path, points.filter((_, j) => j !== i))

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
            <span>{valueLabel}</span>
            <span>Puan</span>
            <span />
          </div>
          {points.map((p, i) => {
            const vp = `${path}.${i}.value`
            const sp = `${path}.${i}.score`
            const err = e.issueAt(vp) ?? e.issueAt(sp)
            return (
              <div key={i} className="pb-1.5">
                <div className="grid grid-cols-[1fr_1fr_28px] items-center gap-1.5">
                  <NumberInput value={display(p.value, unit.scale)} onChange={(v) => editorActions.set(vp, v / unit.scale)} step={unit.step} suffix={unit.suffix} edited={e.isEdited(vp)} invalid={!!e.issueAt(vp)} ariaLabel={`${valueLabel} ${i + 1}`} />
                  <NumberInput value={p.score} onChange={(v) => editorActions.set(sp, v)} step={5} min={0} max={100} edited={e.isEdited(sp)} invalid={!!e.issueAt(sp)} ariaLabel={`Puan ${i + 1}`} />
                  <button type="button" className="flex h-9 items-center justify-center rounded text-faint hover:bg-subtle hover:text-negative disabled:opacity-30" onClick={() => removeRow(i)} disabled={points.length <= 2} aria-label="Satırı sil">
                    <Trash2 size={14} />
                  </button>
                </div>
                <InlineError message={err} />
              </div>
            )
          })}
          <button type="button" onClick={addRow} className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
            <Plus size={12} />
            Nokta ekle
          </button>
          <InlineError message={curveError} />
        </div>
        <CurveChart points={points} unit={unit} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sezon endeksi
// ---------------------------------------------------------------------------

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const BAR_MAX = 2.5

function normalizeIndex(values: number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0.01))
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length
  return clean.map((v) => Math.round((v / mean) * 1000) / 1000)
}

/** Sürüklenebilir çubuk grafik + sayısal giriş; ortalama otomatik 1,00'e normalize edilir. */
export function SeasonIndexEditor({ path, title, description }: { path: string; title: ReactNode; description?: ReactNode }) {
  const e = useModelEditor()
  const committed = e.get(path) as number[]
  const base = getIn(e.base, path) as number[] | undefined
  const [draft, setDraft] = useState<number[] | null>(null)
  const dragIndex = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const values = draft ?? committed
  const mean = values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / 12

  // Klavye / ± girişlerinde kısa bir duraksamadan sonra normalize edip uygula.
  useEffect(() => {
    if (!draft || dragIndex.current !== null) return
    const t = window.setTimeout(() => {
      editorActions.set(path, normalizeIndex(draft))
      setDraft(null)
    }, 700)
    return () => window.clearTimeout(t)
  }, [draft, path])

  const W = 600
  const H = 180
  const pad = 24
  const bw = (W - pad * 2) / 12
  const toY = (v: number) => H - pad - (Math.min(v, BAR_MAX) / BAR_MAX) * (H - pad * 2)

  const valueAt = (clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const y = ((clientY - rect.top) / rect.height) * H
    const v = ((H - pad - y) / (H - pad * 2)) * BAR_MAX
    return Math.max(0.05, Math.min(BAR_MAX, Math.round(v * 100) / 100))
  }

  const onPointerDown = (i: number, ev: React.PointerEvent) => {
    dragIndex.current = i
    ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
    const next = [...values]
    next[i] = valueAt(ev.clientY)
    setDraft(next)
  }
  const onPointerMove = (ev: React.PointerEvent) => {
    if (dragIndex.current === null) return
    const next = [...values]
    next[dragIndex.current] = valueAt(ev.clientY)
    setDraft(next)
  }
  const onPointerUp = () => {
    if (dragIndex.current === null) return
    dragIndex.current = null
    if (draft) {
      editorActions.set(path, normalizeIndex(draft))
      setDraft(null)
    }
  }

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{title}</p>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        <span className={cx('num text-xs', draft ? 'text-warning' : 'text-positive')}>
          Ortalama: {formatNumber(mean, 3)} {draft ? '→ 1,000 olarak normalize edilecek' : ''}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Sezon endeksi"
      >
        <line x1={pad} x2={W - pad} y1={toY(1)} y2={toY(1)} stroke="#B9BDC6" strokeDasharray="4 3" />
        <text x={W - pad + 2} y={toY(1) + 3} fontSize="9" fill="#8A91A0" fontFamily="IBM Plex Mono">
          1,0
        </text>
        {values.map((v, i) => {
          const edited = Math.abs(v - (base?.[i] ?? v)) > 1e-9
          const x = pad + i * bw + 4
          return (
            <g key={i} onPointerDown={(ev) => onPointerDown(i, ev)} className="cursor-ns-resize">
              <rect x={pad + i * bw} y={pad} width={bw} height={H - pad * 2} fill="transparent" />
              <rect x={x} y={toY(v)} width={bw - 8} height={H - pad - toY(v)} fill={edited ? CHART_COLORS.petrol : CHART_COLORS.navy} rx="1" />
              <rect x={x} y={toY(v) - 3} width={bw - 8} height={4} fill={edited ? '#0f4f4c' : '#4FA39C'} rx="1" />
              <text x={x + (bw - 8) / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#5B6475" fontFamily="IBM Plex Sans">
                {MONTH_SHORT[i]}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {values.map((v, i) => (
          <label key={i} className="block">
            <span className="text-[0.6875rem] text-muted">{MONTH_SHORT[i]}</span>
            <NumberInput
              value={Math.round(v * 1000) / 1000}
              onChange={(nv) => {
                const next = [...values]
                next[i] = nv
                setDraft(next)
              }}
              step={0.05}
              min={0.05}
              edited={Math.abs(v - (base?.[i] ?? v)) > 1e-9}
              invalid={!!e.issueAt(`${path}.${i}`)}
              ariaLabel={`${MONTH_SHORT[i]} endeksi`}
            />
          </label>
        ))}
      </div>
      <InlineError message={e.issueAt(path)} />
    </div>
  )
}
