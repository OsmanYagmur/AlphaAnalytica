import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cx } from '../../components/ui'

const STEPS = [
  'Mizan okunuyor',
  'Beyanname eşleştiriliyor',
  'Alternatif veriler toplanıyor',
  'Sezonsallık arındırılıyor',
  'Skor hesaplanıyor',
]

const STEP_MS = 240

/** Analiz tetiklendiğinde ~1,2 saniyelik adım adım yükleme. Formül yok, yalnızca adım adları. */
export function AnalysisAnimation({ firmName, onDone }: { firmName: string; onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = window.setTimeout(onDone, 120)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => window.clearTimeout(t)
  }, [step, onDone])

  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-card">
        <p className="label-caps">Analiz</p>
        <p className="mt-1 text-[0.9375rem] font-semibold text-navy">{firmName}</p>
        <ol className="mt-5 space-y-3">
          {STEPS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={cx(
                    'flex h-5 w-5 items-center justify-center rounded-full border',
                    done ? 'border-accent bg-accent text-white' : active ? 'border-accent text-accent' : 'border-line text-transparent',
                  )}
                >
                  {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : null}
                </span>
                <span className={cx('text-sm', done ? 'text-ink' : active ? 'font-medium text-navy' : 'text-faint')}>{label}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-5 h-1 overflow-hidden rounded-sm bg-subtle">
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
