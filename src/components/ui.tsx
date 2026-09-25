import { Minus, Plus, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { CreditGrade } from '../engine/modelConfig'
import { formatScore } from '../lib/format'
import type { FirmStatus } from '../store/evaluations'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Kart
// ---------------------------------------------------------------------------

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function Card({ title, subtitle, actions, children, className, bodyClassName }: CardProps) {
  return (
    <section className={cx('rounded-lg border border-line bg-surface shadow-card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Düğme
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-soft border border-navy',
  accent: 'bg-accent text-white hover:bg-[#195c59] border border-accent',
  secondary: 'bg-surface text-ink border border-line hover:bg-subtle',
  danger: 'bg-surface text-negative border border-[#e3c1bd] hover:bg-negative-soft',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-subtle hover:text-ink',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-3 text-[0.8125rem]' : 'h-9 px-4 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Rozetler
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent' | 'navy'

const TONES: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted border-line',
  positive: 'bg-positive-soft text-positive border-[#c9e1d4]',
  warning: 'bg-warning-soft text-warning border-[#ecdcbc]',
  negative: 'bg-negative-soft text-negative border-[#eccac6]',
  accent: 'bg-accent-soft text-accent border-[#c8dedc]',
  navy: 'bg-navy text-white border-navy',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium leading-4',
        className?.includes('whitespace-normal') ? '' : 'whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function gradeTone(grade: CreditGrade): Tone {
  if (grade === 'AAA' || grade === 'AA' || grade === 'A') return 'positive'
  if (grade === 'BBB') return 'accent'
  if (grade === 'BB' || grade === 'B') return 'warning'
  return 'negative'
}

export function GradeBadge({ grade, large }: { grade: CreditGrade; large?: boolean }) {
  return (
    <span
      className={cx(
        'num inline-flex items-center justify-center rounded border font-semibold',
        large ? 'h-10 min-w-14 px-2 text-xl' : 'h-6 min-w-10 px-1.5 text-xs',
        TONES[gradeTone(grade)],
      )}
    >
      {grade}
    </span>
  )
}

export const STATUS_LABELS: Record<FirmStatus, string> = {
  pending: 'Tahsis Bekliyor',
  approved: 'Onaylandı',
  revisedApproved: 'Revize Onay',
  rejected: 'Reddedildi',
}

const STATUS_TONES: Record<FirmStatus, Tone> = {
  pending: 'warning',
  approved: 'positive',
  revisedApproved: 'accent',
  rejected: 'negative',
}

export function StatusBadge({ status, label }: { status: FirmStatus; label?: string }) {
  return <Badge tone={STATUS_TONES[status]}>{label ?? STATUS_LABELS[status]}</Badge>
}

export function ModelVersionTag({ version }: { version: string }) {
  return (
    <span className="num inline-flex items-center rounded border border-line bg-subtle px-1.5 py-0.5 text-[0.6875rem] text-muted">
      Model {version}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skor çubuğu
// ---------------------------------------------------------------------------

const STRENGTH_TONE: Record<string, string> = { Güçlü: 'text-positive', Orta: 'text-warning', Zayıf: 'text-negative' }

export function ScoreBar({ label, score, strength, hint }: { label: string; score: number; strength: string; hint?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className={cx('text-xs font-medium', STRENGTH_TONE[strength])}>{strength}</span>
          <span className="num w-10 text-right text-sm font-medium text-ink">{formatScore(score)}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-subtle">
        <div className="h-full rounded-sm bg-navy" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg'
}

export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgb(14_27_46/0.45)] p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'animate-fade-in my-auto w-full rounded-lg border border-line bg-surface shadow-pop',
          width === 'lg' ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-subtle" aria-label="Kapat">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Sekmeler
// ---------------------------------------------------------------------------

interface TabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: ReactNode }[]
}

export function Tabs<T extends string>({ value, onChange, items }: TabsProps<T>) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors',
            item.value === value ? 'border-navy font-medium text-navy' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface SegmentedControlProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: ReactNode }[]
  ariaLabel: string
}

/** Segment kontrol: birbirini dışlayan birkaç seçenek (ör. dönem seçimi). */
export function SegmentedControl<T extends string | number>({ value, onChange, items, ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-md border border-line bg-subtle p-0.5" role="radiogroup" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={item.value === value}
          onClick={() => onChange(item.value)}
          className={cx(
            'whitespace-nowrap rounded px-2.5 py-1 text-xs transition-colors',
            item.value === value ? 'bg-surface font-medium text-navy shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form alanları
// ---------------------------------------------------------------------------

export function Field({ label, children, error, hint }: { label: ReactNode; children: ReactNode; error?: string | null; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-negative">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  max?: number
  suffix?: string
  invalid?: boolean
  edited?: boolean
  ariaLabel?: string
}

/** Sağa hizalı, ± adım butonlu sayısal giriş. */
export function NumberInput({ value, onChange, step, min, max, suffix, invalid, edited, ariaLabel }: NumberInputProps) {
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  const round = (v: number) => Math.round(v / step) * step
  return (
    <div
      className={cx(
        'flex h-9 items-stretch overflow-hidden rounded-md border',
        invalid ? 'border-negative' : 'border-line',
        edited ? 'bg-edited' : 'bg-surface',
      )}
    >
      <button type="button" className="px-2 text-muted hover:bg-subtle" onClick={() => onChange(clamp(round(value - step)))} aria-label="Azalt">
        <Minus size={14} />
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        className="num w-full min-w-0 bg-transparent px-1 text-right text-sm focus:outline-none"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
      {suffix && <span className="flex items-center pr-2 text-xs text-muted">{suffix}</span>}
      <button type="button" className="border-l border-line px-2 text-muted hover:bg-subtle" onClick={() => onChange(clamp(round((Number.isFinite(value) ? value : 0) + step)))} aria-label="Artır">
        <Plus size={14} />
      </button>
    </div>
  )
}

/** Tanım listesi satırı. */
export function DataRow({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx('num text-right text-sm', strong ? 'font-semibold text-ink' : 'text-ink')}>{value}</dd>
    </div>
  )
}
