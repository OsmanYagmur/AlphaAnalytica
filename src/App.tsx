import { useEffect } from 'react'
import { ROLE_HOME } from './components/AppShell'
import { Toaster, showToast } from './components/toast'
import { navigate, useRouteSegments } from './lib/router'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'
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
      return <Placeholder role="tahsis" title="Başvuru Kuyruğu" />
    case 'portfoy':
      return <Placeholder role="portfoy" title="Portföy Özeti" />
    case 'model':
      return <Placeholder role="model" title="Model Genel Bakış" />
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
