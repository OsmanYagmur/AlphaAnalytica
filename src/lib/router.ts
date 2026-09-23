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

/** Guard: gezinmeden önce hedef yolla çağrılır; false dönerse gezinme iptal edilir. */
type NavigationGuard = (target: string) => boolean
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

/** Hedefe gidilebilir mi (kaydedilmemiş değişiklik uyarısı dahil). */
export function canNavigate(path: string): boolean {
  return !guard || guard(path)
}

export function navigate(path: string): void {
  if (currentPath() === path) return
  if (!canNavigate(path)) return
  window.location.hash = path
  window.scrollTo(0, 0)
}
