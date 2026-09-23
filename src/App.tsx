import { useEffect } from 'react'
import { ROLE_HOME } from './components/AppShell'
import { Toaster, showToast } from './components/toast'
import { navigate, useRouteSegments } from './lib/router'
import { Login } from './pages/Login'
import { ModelAlternative } from './pages/model/AlternativeParams'
import { ModelBalance } from './pages/model/Balance'
import { ModelCollateral } from './pages/model/CollateralPricing'
import { ModelImpact } from './pages/model/ImpactSimulation'
import { ModelVersions } from './pages/model/Versions'
import { ModelOverview } from './pages/model/Overview'
import { ModelRatingLimit } from './pages/model/RatingLimit'
import { ModelSectors } from './pages/model/SectorSettings'
import { ModelTraditional } from './pages/model/TraditionalParams'
import { PortfolioFirmDetail } from './pages/portfoy/FirmDetail'
import { PortfolioFirmList } from './pages/portfoy/FirmList'
import { PortfolioSummary } from './pages/portfoy/Summary'
import { Evaluation } from './pages/tahsis/Evaluation'
import { Queue } from './pages/tahsis/Queue'
import { actions, useAppState } from './store/appStore'
import type { Role } from './store/types'

/** Gizli "Demo'yu sıfırla" kısayolu: Ctrl+Shift+R (Mac'te ⌘+Shift+R da). */
function useResetShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        e.stopPropagation()
        actions.resetDemo()
        showToast('Demo sıfırlandı', 'Kararlar ve model konfigürasyonu başlangıç durumuna (v1.0) döndü.', 'info')
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [])
}

function usePresentationMode() {
  const presentation = useAppState((s) => s.presentation)
  useEffect(() => {
    document.documentElement.classList.toggle('presentation', presentation)
  }, [presentation])
}

const SECTION_ROLE: Record<string, Role> = { tahsis: 'tahsis', portfoy: 'portfoy', model: 'model' }

function Routes() {
  const role = useAppState((s) => s.role)
  const segments = useRouteSegments()
  const section = segments[0]
  const sectionRole = section ? SECTION_ROLE[section] : undefined

  // Rol yoksa giriş ekranı; rol başka bir arayüze aitse kendi ana sayfasına yönlendir.
  const redirect = !role ? (section ? '/' : null) : sectionRole !== role ? ROLE_HOME[role] : null
  useEffect(() => {
    if (redirect !== null) navigate(redirect)
  }, [redirect])

  if (!role || redirect !== null) return role ? null : <Login />

  switch (role) {
    case 'tahsis':
      if (segments[1] === 'firma' && segments[2]) return <Evaluation key={segments[2]} firmId={segments[2]} />
      return <Queue />
    case 'portfoy':
      if (segments[1] === 'firma' && segments[2]) return <PortfolioFirmDetail key={segments[2]} firmId={segments[2]} />
      if (segments[1] === 'firmalar') return <PortfolioFirmList />
      return <PortfolioSummary />
    case 'model':
      switch (segments[1]) {
        case 'denge':
          return <ModelBalance />
        case 'geleneksel':
          return <ModelTraditional />
        case 'alternatif':
          return <ModelAlternative />
        case 'sektorler':
          return <ModelSectors />
        case 'not-limit':
          return <ModelRatingLimit />
        case 'teminat':
          return <ModelCollateral />
        case 'etki':
          return <ModelImpact />
        case 'surumler':
          return <ModelVersions />
        default:
          return <ModelOverview />
      }
  }
}

export default function App() {
  useResetShortcut()
  usePresentationMode()
  return (
    <>
      <Routes />
      <Toaster />
    </>
  )
}
