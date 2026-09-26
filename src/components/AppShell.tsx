import {
  Activity,
  Banknote,
  BarChart3,
  History,
  Briefcase,
  Building2,
  ClipboardList,
  Gauge as GaugeIcon,
  Landmark,
  LayoutList,
  LogOut,
  Menu,
  Monitor,
  Newspaper,
  Radar,
  Scale,
  Shield,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { canNavigate, navigate, usePath } from '../lib/router'
import { USERS, actions, useAppState } from '../store/appStore'
import type { Role } from '../store/types'
import { Logo } from './Logo'
import { cx } from './ui'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Bu öğeyi etkin gösteren ek yol önekleri. */
  match?: string[]
}

export const ROLE_HOME: Record<Role, string> = {
  tahsis: '/tahsis',
  portfoy: '/portfoy',
  model: '/model',
}

const NAV: Record<Role, NavItem[]> = {
  tahsis: [{ label: 'Başvuru Kuyruğu', path: '/tahsis', icon: ClipboardList, match: ['/tahsis/firma/'] }],
  portfoy: [
    { label: 'Portföy Özeti', path: '/portfoy', icon: Briefcase },
    { label: 'Firma Listesi', path: '/portfoy/firmalar', icon: LayoutList, match: ['/portfoy/firma/'] },
  ],
  model: [
    { label: 'Genel Bakış', path: '/model', icon: BarChart3 },
    { label: 'Ana Denge', path: '/model/denge', icon: Scale },
    { label: 'Geleneksel Skor', path: '/model/geleneksel', icon: Landmark },
    { label: 'Alternatif Skor', path: '/model/alternatif', icon: Radar },
    { label: 'Sektör Ayarları', path: '/model/sektorler', icon: Building2 },
    { label: 'Not · PD · Limit', path: '/model/not-limit', icon: GaugeIcon },
    { label: 'Teminat ve Fiyatlama', path: '/model/teminat', icon: Shield },
    { label: 'KKB Parametreleri', path: '/model/kkb', icon: Banknote },
    { label: 'Etki Simülasyonu', path: '/model/etki', icon: Activity },
    { label: 'Piyasa İstihbaratı', path: '/model/piyasa', icon: Newspaper },
    { label: 'Sürümler ve Denetim İzi', path: '/model/surumler', icon: History },
  ],
}

function PresentationToggle() {
  const on = useAppState((s) => s.presentation)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => actions.setPresentation(!on)}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[0.8125rem] text-[#b7c2d3] hover:bg-sidebar-line"
    >
      <span className="flex items-center gap-2">
        <Monitor size={15} />
        Sunum Modu
      </span>
      <span className={cx('relative h-4 w-7 rounded transition-colors', on ? 'bg-accent' : 'bg-[#34465f]')}>
        <span className={cx('absolute top-0.5 h-3 w-3 rounded-sm bg-white transition-all', on ? 'left-3.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const path = usePath()
  const presentation = useAppState((s) => s.presentation)
  const user = USERS[role]
  const items = NAV[role]
  const isActive = (item: NavItem) => path === item.path || (item.match ?? []).some((m) => path.startsWith(m))

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-sidebar-line px-5 py-5">
        <Logo />
        {!presentation && <p className="mt-2 text-[0.6875rem] text-[#7f8ba0]">Dinamik Bilançolar ile Risk Analizi</p>}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {!presentation && <p className="px-3 pb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-[#6d7a90]">{user.title}</p>}
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                navigate(item.path)
                onNavigate?.()
              }}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                active ? 'bg-[#1b2c46] text-white' : 'text-[#b7c2d3] hover:bg-sidebar-line hover:text-white',
              )}
            >
              <Icon size={16} className={active ? 'text-[#4FA39C]' : ''} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-line px-3 py-3">
        {!presentation && (
          <div className="px-3 pb-2 pt-1">
            <p className="text-sm text-white">{user.name}</p>
            <p className="text-[0.75rem] text-[#7f8ba0]">{user.title}</p>
          </div>
        )}
        <PresentationToggle />
        <button
          type="button"
          onClick={() => {
            if (!canNavigate('/')) return
            actions.logout()
            navigate('/')
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-[#b7c2d3] hover:bg-sidebar-line"
        >
          <LogOut size={15} />
          Rol değiştir
        </button>
      </div>
    </div>
  )
}

/** Tüm sayfalarda sağ altta soluk etiket ve köşede "Demo Verisi" etiketi. */
export function CornerLabels() {
  return (
    <>
      <div className="pointer-events-none fixed bottom-2 right-3 z-30 select-none text-[0.6875rem] text-[#9aa0ab] opacity-80">
        AlphaAnalytica · TEKNOFEST 2026 Finansal Teknolojiler
      </div>
    </>
  )
}

export function DemoDataTag() {
  return (
    <span className="inline-flex items-center rounded border border-[#ecdcbc] bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-warning">
      Demo Verisi
    </span>
  )
}

interface AppShellProps {
  role: Role
  title: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ role, title, breadcrumb, actions: headerActions, children }: AppShellProps) {
  const [drawer, setDrawer] = useState(false)
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <Sidebar role={role} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgb(14_27_46/0.5)]" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <Sidebar role={role} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          {/* Yer yoksa araç çubuğu alt satıra geçer; başlık kesilmez */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
            <button type="button" className="rounded p-1.5 text-navy hover:bg-subtle lg:hidden" onClick={() => setDrawer(true)} aria-label="Menü">
              {drawer ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="min-w-0 flex-1 basis-[15rem]">
              {breadcrumb && <div className="mb-0.5 text-xs text-muted">{breadcrumb}</div>}
              <h1 className="break-words text-lg font-semibold leading-snug text-navy">{title}</h1>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {headerActions}
              <DemoDataTag />
            </div>
          </div>
        </header>
        <main className="px-4 pb-12 pt-5 sm:px-6 lg:px-8">{children}</main>
      </div>
      <CornerLabels />
    </div>
  )
}
