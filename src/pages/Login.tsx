import { ArrowRight, Briefcase, ClipboardCheck, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CornerLabels, DemoDataTag, ROLE_HOME } from '../components/AppShell'
import { Logo } from '../components/Logo'
import { cx } from '../components/ui'
import { navigate } from '../lib/router'
import { MODEL_MANAGER_PIN, actions } from '../store/appStore'
import type { Role } from '../store/types'

function enter(role: Role) {
  actions.login(role)
  navigate(ROLE_HOME[role])
}

function RoleCard({ role, title, description, icon: Icon }: { role: Role; title: string; description: string; icon: typeof Briefcase }) {
  return (
    <button
      type="button"
      onClick={() => enter(role)}
      className="group flex flex-col rounded-lg border border-line bg-surface p-6 text-left shadow-card transition-colors hover:border-navy"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
        <Icon size={20} />
      </span>
      <h2 className="mt-5 text-base font-semibold text-navy">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        Demo girişi
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function ModelManagerCard() {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (pin === MODEL_MANAGER_PIN) {
      enter('model')
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-[#22344f] bg-sidebar p-6 text-left shadow-card">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1b2c46] text-[#4FA39C]">
        <Lock size={20} />
      </span>
      <h2 className="mt-5 text-base font-semibold text-white">Model Yöneticisi</h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#9aa7ba]">
        Formüller, ağırlıklar ve eşikler; etki simülasyonu ve sürümleme. Yetkili erişim.
      </p>
      {open ? (
        <form onSubmit={submit} className="mt-6">
          <label className="mb-1.5 block text-xs text-[#9aa7ba]" htmlFor="pin">
            Demo PIN
          </label>
          <div className="flex gap-2">
            <input
              id="pin"
              autoFocus
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''))
                setError(false)
              }}
              className={cx(
                'num h-9 w-full rounded-md border bg-[#13233a] px-3 text-center text-base tracking-[0.5em] text-white focus:outline-none',
                error ? 'border-negative' : 'border-[#2a3f5e] focus:border-[#4FA39C]',
              )}
              aria-invalid={error}
            />
            <button type="submit" className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-[#195c59]">
              Giriş
            </button>
          </div>
          <p className={cx('mt-1.5 text-xs', error ? 'text-[#e08b83]' : 'text-transparent')}>PIN hatalı. Tekrar deneyin.</p>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-6 inline-flex items-center gap-1.5 text-left text-sm font-medium text-[#4FA39C]">
          PIN ile giriş
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}

export function Login() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="absolute right-4 top-4">
        <DemoDataTag />
      </div>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" tone="dark" />
          <p className="mt-5 text-base text-ink">Dinamik Bilançolar ile Risk Analizi</p>
          <p className="mt-1 text-sm text-muted">KOBİ ticari kredi tahsis platformu · rol seçin</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <RoleCard
            role="tahsis"
            title="Tahsis Yöneticisi"
            description="Başvuru kuyruğu, firma değerlendirmesi, sistem önerisi ve kredi kararı."
            icon={ClipboardCheck}
          />
          <RoleCard
            role="portfoy"
            title="Portföy Yöneticisi"
            description="Portföy özeti, not ve sektör dağılımı, erken uyarı takibi ve karar detayları."
            icon={Briefcase}
          />
          <ModelManagerCard />
        </div>
      </div>
      <CornerLabels />
    </div>
  )
}
