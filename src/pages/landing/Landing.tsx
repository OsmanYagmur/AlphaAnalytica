import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarRange,
  ClipboardCheck,
  Cpu,
  Database,
  Factory,
  FileSpreadsheet,
  GitBranch,
  Landmark,
  Layers,
  LineChart,
  Lock,
  Menu,
  MousePointerClick,
  Scale,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ROLE_HOME } from '../../components/AppShell'
import { Gauge } from '../../components/Gauge'
import { Logo } from '../../components/Logo'
import { SeasonalityChart } from '../../components/charts'
import { GradeBadge, ScoreBar, cx } from '../../components/ui'
import { FIRMS } from '../../data'
import { strengthLabel } from '../../engine/factors'
import { SECTOR_IDS, type AlternativeIndicatorConfig } from '../../engine/modelConfig'
import { formatNumber, formatTL } from '../../lib/format'
import { navigate } from '../../lib/router'
import { MODEL_MANAGER_PIN, actions } from '../../store/appStore'
import { useActiveConfig, useFirmView } from '../../store/evaluations'
import {
  AUDIENCES,
  CAPABILITIES,
  COMPARISON,
  INTERFACES,
  PILLARS,
  PROBLEMS,
  RISKS,
  SALES_STEPS,
  SCENARIOS,
  SLOGAN,
  TEAM,
  type Scenario,
} from './content'
import { EvaluationFlow } from './EvaluationFlow'

const SECTIONS = [
  { id: 'problem', label: 'Problem' },
  { id: 'cozum', label: 'Çözüm' },
  { id: 'urun', label: 'Ürün' },
  { id: 'demo', label: 'Demo' },
  { id: 'pazar', label: 'Kimler için' },
  { id: 'riskler', label: 'Riskler' },
  { id: 'ekip', label: 'Ekip' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openDemo() {
  navigate('/demo')
}

function openScenario(s: Scenario) {
  actions.login(s.role)
  navigate(s.path)
}

// ---------------------------------------------------------------------------
// Yapı taşları
// ---------------------------------------------------------------------------

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}

/**
 * Görünür alana girince bir kez hafifçe belirir. Hareket azaltma tercihinde animasyon yoktur.
 * IntersectionObserver yerine kaydırma olayı kullanılır: bazı gömülü tarayıcılarda gözlemci
 * görünür alanı hatalı bildirir ve içerik gizli kalabilir.
 */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const inView = () => el.getBoundingClientRect().top < window.innerHeight * 0.92
    if (inView()) return
    setHidden(true)
    const onScroll = () => {
      if (!inView()) return
      setHidden(false)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return (
    <div ref={ref} className={cx('transition-[opacity,transform] duration-500 ease-out', hidden && 'translate-y-3 opacity-0', className)}>
      {children}
    </div>
  )
}

function Section({ id, index, eyebrow, title, lead, children, tone = 'canvas' }: { id: SectionId; index: number; eyebrow: string; title: string; lead?: string; children: ReactNode; tone?: 'canvas' | 'surface' }) {
  return (
    <section id={id} className={cx('scroll-mt-16 border-t border-line py-16 sm:py-24', tone === 'surface' ? 'bg-surface' : 'bg-canvas')}>
      <Container>
        <Reveal>
          <p className="flex items-center gap-3 text-accent">
            <span className="num text-xs font-semibold">{String(index).padStart(2, '0')}</span>
            <span aria-hidden className="h-px w-8 bg-accent/40" />
            <span className="label-caps text-accent">{eyebrow}</span>
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-navy sm:text-[2rem]">{title}</h2>
          {lead && <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-[1.0625rem]">{lead}</p>}
        </Reveal>
        <Reveal className="mt-10 sm:mt-12">{children}</Reveal>
      </Container>
    </section>
  )
}

function IconTile({ icon: Icon, tone = 'accent' }: { icon: LucideIcon; tone?: 'accent' | 'navy' }) {
  return (
    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-navy text-white')}>
      <Icon size={20} />
    </span>
  )
}

function PrimaryButton({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#195c59]', className)}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Üst menü
// ---------------------------------------------------------------------------

/** Ekranın üst üçte birindeki bölüm (menüde işaretlenir). */
function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null)
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.33
      let current: SectionId | null = null
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= line) current = s.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return active
}

function TopNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const activeSection = useActiveSection()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const go = (id: string) => {
    setOpen(false)
    scrollToSection(id)
  }
  return (
    <header className={cx('sticky top-0 z-40 border-b transition-colors', scrolled || open ? 'border-sidebar-line bg-sidebar' : 'border-transparent bg-sidebar')}>
      <Container className="flex h-16 items-center gap-6">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Sayfanın başına dön">
          <Logo />
        </button>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Bölümler">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={activeSection === s.id ? 'true' : undefined}
              className={cx('rounded px-3 py-1.5 text-sm transition-colors hover:bg-[#16263d] hover:text-white', activeSection === s.id ? 'bg-[#16263d] text-white' : 'text-[#b9c3d3]')}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto hidden sm:block lg:ml-2">
          <PrimaryButton onClick={openDemo} className="py-2">
            Demoyu aç
            <ArrowRight size={15} />
          </PrimaryButton>
        </div>
        <button type="button" className="ml-auto rounded p-1.5 text-white hover:bg-[#16263d] sm:ml-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menü" aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>
      {open && (
        <div className="border-t border-sidebar-line lg:hidden">
          <Container className="flex flex-col py-2">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => go(s.id)} className="rounded px-2 py-2.5 text-left text-sm text-[#d3dae6] hover:bg-[#16263d]">
                {s.label}
              </button>
            ))}
            <div className="mt-2 sm:hidden">
              <PrimaryButton onClick={openDemo} className="w-full">
                Demoyu aç
                <ArrowRight size={15} />
              </PrimaryButton>
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Giriş (hero) — canlı örnek değerlendirme
// ---------------------------------------------------------------------------

function LiveEvaluationCard() {
  const view = useFirmView('defne-kirtasiye')
  if (!view) return null
  const ev = view.evaluation
  return (
    <div className="rounded-lg border border-[#22344f] bg-surface p-5 shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">Canlı örnek · demo verisi</p>
          <p className="mt-0.5 font-semibold text-navy">{view.firm.name}</p>
          <p className="text-xs text-muted">{view.config.sectors[view.firm.sectorId].label}</p>
        </div>
        <GradeBadge grade={ev.grade} large />
      </div>
      <div className="mt-2 flex justify-center">
        <Gauge score={ev.score} size={200} />
      </div>
      <div className="mt-2 space-y-3">
        <ScoreBar label="Geleneksel analiz (bilanço)" score={ev.traditional.score} strength={strengthLabel(ev.traditional.score, view.config)} />
        <ScoreBar label="Alternatif veri" score={ev.alternative.score} strength={strengthLabel(ev.alternative.score, view.config)} />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
        <span className="text-muted">Önerilen limit</span>
        <span className="num font-semibold text-navy">{formatTL(ev.limit.limit)}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">Bilançosu tek başına zayıf görünen bir kırtasiye; alternatif veriyle kredi alabilir hale geliyor.</p>
    </div>
  )
}

function Hero() {
  const config = useActiveConfig()
  const indicatorCount = SECTOR_IDS.reduce((a, id) => a + Object.keys(config.sectors[id].indicators as Record<string, AlternativeIndicatorConfig>).length, 0)
  const stats = [
    { value: formatNumber(SECTOR_IDS.length), label: 'sektör modeli' },
    { value: formatNumber(indicatorCount), label: 'alternatif gösterge' },
    { value: formatNumber(FIRMS.length), label: 'örnek firma, küçük işletmeden holdinge' },
    { value: '3', label: 'rol bazlı arayüz' },
  ]
  return (
    <section className="relative overflow-hidden bg-sidebar text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(to right, #1d2d45 1px, transparent 1px), linear-gradient(to bottom, #1d2d45 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 85%)',
        }}
      />
      <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <span className="inline-flex rounded border border-[#2a3f5e] bg-[#16263d] px-2.5 py-1 text-xs font-medium text-[#9fd3cd]">
            Alternatif veriyle desteklenen risk değerlendirme platformu
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Dinamik Bilançolar ile Risk Analizi</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#b9c3d3]">
            AlphaAnalytica, firmaların mizan ve beyanname verisini sektöre özgü alternatif verilerle birleştirir. Sezonsallığı ayıklar, diğer bankalardaki riskleri izler; kredi skoru, not, limit ve teminat önerisini saniyeler içinde, gerekçesiyle üretir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton onClick={openDemo} className="px-6 py-3 text-base">
              Canlı demoyu aç
              <ArrowRight size={17} />
            </PrimaryButton>
            <button type="button" onClick={() => scrollToSection('cozum')} className="inline-flex items-center gap-2 rounded-md border border-[#2a3f5e] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#16263d]">
              Nasıl çalışır?
            </button>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-sidebar-line pt-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="num text-3xl font-semibold text-white">{s.value}</dd>
                <dd className="mt-1 text-sm leading-snug text-[#9aa7ba]">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mx-auto w-full max-w-md">
          <LiveEvaluationCard />
        </div>
      </Container>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------

const PROBLEM_ICONS: LucideIcon[] = [CalendarRange, LineChart, Store, BellRing]

function ProblemSection() {
  const view = useFirmView('palandoken-turizm')
  return (
    <Section
      id="problem"
      index={1}
      eyebrow="Problem"
      title="Kredi kararları firmanın bugününü değil, geçen yılını görüyor"
      lead="KOBİ’lerin finansmana erişiminde en büyük engel, kararların yalnızca geçmiş döneme ait finansal tablolara dayanması. Sağlıklı işletmeler reddedilirken bozulmakta olanlar geç fark ediliyor."
    >
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ul className="divide-y divide-line border-y border-line">
        {PROBLEMS.map((p, i) => (
          <li key={p.title} className="flex gap-4 py-5">
            <IconTile icon={PROBLEM_ICONS[i]} />
            <div>
              <h3 className="font-semibold text-navy">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
      {view && (
        <div className="self-start rounded-lg border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-semibold text-navy">Örnek: kış turizmi acentesinin yaz durgunluğu</h3>
            <span className="text-xs text-muted">{view.firm.name} · demo verisi</span>
          </div>
          <p className="mt-1 text-sm text-muted">Yaz aylarında ciro yıllık ortalamanın çok altında. Sezon profili bilinmeden bakıldığında bu bir bozulma gibi görünür; oysa beklenen desenle birebir örtüşüyor.</p>
          <div className="mt-3">
            <SeasonalityChart months={view.evaluation.alternative.seasonalFit.months} expected={view.evaluation.alternative.seasonalFit.expected} actual={view.evaluation.alternative.seasonalFit.actual} />
          </div>
        </div>
      )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Çözüm
// ---------------------------------------------------------------------------

const PILLAR_ICONS: LucideIcon[] = [FileSpreadsheet, Database, CalendarRange, ShieldCheck]

function SolutionSection() {
  return (
    <Section
      id="cozum"
      index={2}
      eyebrow="Çözüm"
      title="Geleneksel analizle alternatif veriyi tek bir açıklanabilir skorda birleştiriyoruz"
      lead="Bilanço firmanın sağlamlığını, alternatif veri bugününü gösterir. AlphaAnalytica ikisini birlikte değerlendirir; sezonsallığı ayıklar, erken uyarıları nota yansıtır ve her kararı gerekçesiyle sunar."
      tone="surface"
    >
      <div className="grid overflow-hidden rounded-lg border border-line bg-canvas sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p, i) => (
          <div key={p.title} className="border-line p-6 max-sm:[&:not(:first-child)]:border-t sm:max-lg:[&:nth-child(n+3)]:border-t sm:max-lg:[&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l">
            <div className="flex items-center justify-between">
              <IconTile icon={PILLAR_ICONS[i]} />
              <span className="num text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-5 font-semibold text-navy">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h3 className="text-xl font-semibold text-navy">Değerlendirme akışı</h3>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MousePointerClick size={15} className="text-accent" />
            Bir adıma tıklayın; örnek firmanın o adımdaki sonucu canlı hesaplanır.
          </p>
        </div>
        <div className="mt-5">
          <EvaluationFlow />
        </div>
      </div>

      <div className="mt-16">
        <div>
          <h3 className="text-xl font-semibold text-navy">Mevcut yaklaşımdan farkı</h3>
          <div className="mt-5 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label-caps w-1/5 bg-subtle/60 px-5 py-3 font-semibold" />
                  <th className="label-caps bg-subtle/60 px-5 py-3 font-semibold">Geleneksel yaklaşım</th>
                  <th className="label-caps bg-accent-soft px-5 py-3 font-semibold text-accent">AlphaAnalytica</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((c) => (
                  <tr key={c.topic} className="border-b border-line align-top last:border-b-0">
                    <td className="px-5 py-3.5 font-medium text-navy">{c.topic}</td>
                    <td className="px-5 py-3.5 text-muted">{c.classic}</td>
                    <td className="bg-accent-soft/40 px-5 py-3.5 text-ink">
                      <span className="flex gap-2">
                        <BadgeCheck size={15} className="mt-0.5 shrink-0 text-accent" />
                        {c.ours}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Ürün
// ---------------------------------------------------------------------------

const INTERFACE_ICONS: LucideIcon[] = [ClipboardCheck, Layers, Lock]
const INTERFACE_ROLES = ['tahsis', 'portfoy', 'model'] as const

/** Tahsis ve Portföy doğrudan açılır; Model Yöneticisi PIN istediği için rol seçimine gider. */
function openInterface(role: (typeof INTERFACE_ROLES)[number]) {
  if (role === 'model') return openDemo()
  actions.login(role)
  navigate(ROLE_HOME[role])
}
const CAPABILITY_ICONS: LucideIcon[] = [Cpu, GitBranch, Activity, Building2, ShieldCheck, BadgeCheck]

function ProductSection() {
  return (
    <Section
      id="urun"
      index={3}
      eyebrow="Ürün"
      title="Kredi sürecinin üç rolü için üç arayüz"
      lead="Tahsis ekibi karar verir, portföy ekibi izler, model ekibi parametreleri yönetir. Üç arayüz aynı hesaplama motorunu ve aynı model sürümünü paylaşır."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {INTERFACES.map((it, i) => (
          <button
            key={it.title}
            type="button"
            onClick={() => openInterface(INTERFACE_ROLES[i])}
            className={cx(
              'group flex flex-col rounded-lg border p-6 text-left shadow-card transition-colors',
              i === 2 ? 'border-[#22344f] bg-sidebar text-white hover:border-[#4FA39C]' : 'border-line bg-surface hover:border-navy',
            )}
          >
            <IconTile icon={INTERFACE_ICONS[i]} tone={i === 2 ? 'navy' : 'accent'} />
            <h3 className={cx('mt-4 text-lg font-semibold', i === 2 ? 'text-white' : 'text-navy')}>{it.title}</h3>
            <p className={cx('mt-1 text-sm', i === 2 ? 'text-[#9aa7ba]' : 'text-muted')}>{it.text}</p>
            <ul className="mt-4 space-y-2">
              {it.points.map((p) => (
                <li key={p} className={cx('flex gap-2 text-sm', i === 2 ? 'text-[#d3dae6]' : 'text-ink')}>
                  <BadgeCheck size={15} className={cx('mt-0.5 shrink-0', i === 2 ? 'text-[#4FA39C]' : 'text-accent')} />
                  {p}
                </li>
              ))}
            </ul>
            <span className={cx('mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium', i === 2 ? 'text-[#4FA39C]' : 'text-accent')}>
              {i === 2 ? 'PIN ile giriş' : 'Arayüzü aç'}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c, i) => {
          const Icon = CAPABILITY_ICONS[i]
          return (
            <div key={c.title} className="flex gap-3">
              <Icon size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h3 className="font-semibold text-navy">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const view = useFirmView(scenario.firmId)
  if (!view) return null
  const ev = scenario.role === 'portfoy' ? view.current : view.evaluation
  const decisionGrade = scenario.role === 'portfoy' ? view.decision?.system.grade : null
  const capped = ev.override.capped
  return (
    <button type="button" onClick={() => openScenario(scenario)} className="group flex flex-col rounded-lg border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-navy">
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{scenario.role === 'portfoy' ? 'Portföy Yöneticisi' : 'Tahsis Yöneticisi'}</p>
          <h3 className="mt-0.5 font-semibold leading-snug text-navy">{scenario.title}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {decisionGrade && decisionGrade !== ev.grade && (
            <>
              <GradeBadge grade={decisionGrade} />
              <ArrowRight size={13} className="text-faint" />
            </>
          )}
          {capped && (
            <>
              <GradeBadge grade={ev.baseGrade} />
              <ArrowRight size={13} className="text-faint" />
            </>
          )}
          <GradeBadge grade={ev.grade} />
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{scenario.text}</p>
      <p className="mt-3 text-xs text-muted">
        {view.firm.name} · <span className="num text-ink">{ev.limit.limit > 0 ? formatTL(ev.limit.limit) : 'limit yok'}</span>
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent">
        Bu senaryoyu aç
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function DemoSection() {
  return (
    <Section
      id="demo"
      index={4}
      eyebrow="Demo"
      title="Hikâyeleri canlı demoda inceleyin"
      lead="Demo, 10 sektörden hayali firmalarla gerçek bir kredi sürecini canlandırır. Aşağıdaki senaryolar sizi doğrudan ilgili ekrana götürür; notlar ve limitler model tarafından şu anda hesaplanır."
      tone="surface"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s.firmId} scenario={s} />
        ))}
        <button type="button" onClick={openDemo} className="group flex flex-col rounded-lg border border-[#22344f] bg-sidebar p-5 text-left text-white shadow-card transition-colors hover:border-[#4FA39C]">
          <p className="text-xs text-[#9aa7ba]">Model Yöneticisi</p>
          <h3 className="mt-0.5 font-semibold leading-snug">Parametreyi değiştirin, etkisini görün</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#b9c3d3]">
            Alternatif verinin ağırlığını değiştirin; kaydetmeden önce hangi firmanın notunun ve limitinin nasıl değişeceğini görün, yeni sürüm olarak yayımlayın.
          </p>
          <p className="mt-3 text-xs text-[#9aa7ba]">
            Demo PIN’i: <span className="num text-white">{MODEL_MANAGER_PIN}</span>
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#4FA39C]">
            Rol seçimine git
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <PrimaryButton onClick={openDemo}>
          Demoyu baştan keşfedin
          <ArrowRight size={15} />
        </PrimaryButton>
        <p className="text-sm text-muted">Demo verileri hayalidir. Yaptığınız değişiklikler yalnızca sizin tarayıcınızda saklanır; Ctrl+Shift+R demoyu sıfırlar.</p>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Ticari potansiyel
// ---------------------------------------------------------------------------

const AUDIENCE_ICONS: LucideIcon[] = [Landmark, Wallet, Factory, Scale]

function MarketSection() {
  return (
    <Section
      id="pazar"
      index={5}
      eyebrow="Ticari potansiyel"
      title="Risk analizine ihtiyaç duyan her kurum için"
      lead="AlphaAnalytica, kurumlara doğrudan satılan bir B2B çözümüdür. Model parametreleri ve sektör göstergeleri her kurumun portföyüne ve risk iştahına göre uyarlanır."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a, i) => (
          <div key={a.title} className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <IconTile icon={AUDIENCE_ICONS[i]} />
            <h3 className="mt-4 font-semibold text-navy">{a.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{a.text}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-12 text-lg font-semibold text-navy">B2B satış süreci</h3>
      <ol className="mt-5 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {SALES_STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <div className="flex items-center gap-3">
              <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-semibold text-white">{i + 1}</span>
              {i < SALES_STEPS.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-line lg:block" />}
            </div>
            <p className="mt-4 font-semibold text-navy">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Riskler
// ---------------------------------------------------------------------------

function RiskSection() {
  return (
    <Section
      id="riskler"
      index={6}
      eyebrow="Risk analizi"
      title="Riskleri biliyor, önlemlerini ürüne yerleştiriyoruz"
      lead="Bir risk değerlendirme ürününün kendisi de güvenilir olmalı. Olası riskleri ve her birine karşı aldığımız önlemleri açıkça paylaşıyoruz."
      tone="surface"
    >
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle/60 text-left">
              <th className="label-caps w-2/5 px-5 py-3 font-semibold">Risk</th>
              <th className="label-caps px-5 py-3 font-semibold">Önlem</th>
            </tr>
          </thead>
          <tbody>
            {RISKS.map((r) => (
              <tr key={r.risk} className="border-b border-line align-top last:border-b-0">
                <td className="px-5 py-3.5 font-medium text-navy">{r.risk}</td>
                <td className="px-5 py-3.5 text-ink">{r.measure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Ekip
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('')
}

function TeamSection() {
  return (
    <Section id="ekip" index={7} eyebrow="Ekip" title="AlphaAnalytica ekibi">
      {TEAM.length === 0 ? (
        <div className="flex items-center gap-4 rounded-lg border border-dashed border-line bg-surface p-6">
          <IconTile icon={Users} />
          <p className="text-sm text-muted">Ekibimizi çok yakında burada tanıtacağız.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m) => (
            <div key={m.name} className="flex gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-navy text-base font-semibold text-white">{initials(m.name)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-navy">{m.link ? <a href={m.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{m.name}</a> : m.name}</p>
                <p className="mt-0.5 text-sm text-accent">{m.role}</p>
                <p className="mt-1 text-sm text-muted">{m.education}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Kapanış
// ---------------------------------------------------------------------------

function Closing() {
  return (
    <section className="bg-sidebar text-white">
      <Container className="flex flex-col items-start gap-6 py-16 sm:py-20 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{SLOGAN}</p>
          <p className="mt-3 max-w-xl text-[#b9c3d3]">Alternatif veriyle desteklenen, açıklanabilir ve yönetilebilir risk değerlendirmesi.</p>
        </div>
        <PrimaryButton onClick={openDemo} className="px-6 py-3 text-base">
          Canlı demoyu aç
          <ArrowRight size={17} />
        </PrimaryButton>
      </Container>
      <div className="border-t border-sidebar-line">
        <Container className="flex flex-col gap-2 py-6 text-xs text-[#7f8ba0] sm:flex-row sm:items-center sm:justify-between">
          <span>AlphaAnalytica · Dinamik Bilançolar ile Risk Analizi</span>
          <span>Demodaki firma adları ve tüm finansal veriler hayalidir.</span>
        </Container>
      </div>
    </section>
  )
}

/** Girişim tanıtım sayfası: ekibi ve projeyi anlatır, canlı demoya yönlendirir. */
export function Landing() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="min-h-screen bg-canvas">
      <TopNav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <ProductSection />
        <DemoSection />
        <MarketSection />
        <RiskSection />
        <TeamSection />
      </main>
      <Closing />
    </div>
  )
}
