import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cx } from './ui'

type ToastTone = 'success' | 'info' | 'danger'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(title: string, message?: string, tone: ToastTone = 'success'): void {
  const toast = { id: nextId++, tone, title, message }
  toasts = [...toasts, toast]
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id)
    emit()
  }, 3800)
}

const ICONS = { success: CheckCircle2, info: Info, danger: XCircle }
const ACCENT = { success: 'border-l-positive text-positive', info: 'border-l-accent text-accent', danger: 'border-l-negative text-negative' }

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.tone]
        return (
          <div key={t.id} className={cx('animate-fade-in pointer-events-auto flex gap-3 rounded-md border border-line border-l-4 bg-surface px-4 py-3 shadow-pop', ACCENT[t.tone])}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-[0.8125rem] text-muted">{t.message}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
