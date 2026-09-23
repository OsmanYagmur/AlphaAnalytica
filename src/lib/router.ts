/**
 * Küçük hash yönlendirici: statik dist klasörü dosya sisteminden açıldığında da çalışır.
 * Rotalar: #/ · #/tahsis · #/tahsis/firma/:id · #/portfoy · #/model
 */

import { useSyncExternalStore } from 'react'

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash.startsWith('/') ? hash : `/${hash}`
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Guard: gezinmeden önce çağrılır; false dönerse gezinme iptal edilir. */
type NavigationGuard = () => boolean
let guard: NavigationGuard | null = null

export function setNavigationGuard(next: NavigationGuard | null): void {
  guard = next
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/')
}

export function useRouteSegments(): string[] {
  return usePath().split('/').filter(Boolean)
}

export function navigate(path: string): void {
  if (guard && !guard()) return
  if (currentPath() === path) return
  window.location.hash = path
  window.scrollTo(0, 0)
}
