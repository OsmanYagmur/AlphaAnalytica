/**
 * Model Yöneticisi çalışma kopyası. Alt sayfalar arasında gezinirken korunur.
 * Taban = kaydedilmiş taslak (yoksa aktif konfigürasyon). Çalışma kopyası
 * tabandan farklıysa kaydedilmemiş değişiklik vardır.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { diffConfigs, type ConfigChange } from '../engine/configDiff'
import type { ModelConfig } from '../engine/modelConfig'
import { validateModelConfig, type ValidationIssue } from '../engine/validation'
import { deepEqual, getIn, setIn } from '../lib/objectPath'
import { setNavigationGuard } from '../lib/router'
import { actions, activeConfig, editorBaseConfig, getState, onDemoReset, subscribe as subscribeApp, useAppState } from './appStore'

let working: ModelConfig | null = null
let workingBase: ModelConfig | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function currentWorking(): ModelConfig {
  const base = editorBaseConfig(getState())
  // Taban dışarıdan değiştiyse ve kaydedilmemiş değişiklik yoksa yeni tabanı izle.
  if (!working || (workingBase !== base && working === workingBase)) {
    working = base
    workingBase = base
  }
  return working
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const unsubApp = subscribeApp(listener)
  return () => {
    listeners.delete(listener)
    unsubApp()
  }
}

onDemoReset(() => {
  working = null
  workingBase = null
  emit()
})

export const editorActions = {
  set(path: string, value: unknown): void {
    working = setIn(currentWorking(), path, value)
    emit()
  },
  update(fn: (c: ModelConfig) => ModelConfig): void {
    working = fn(currentWorking())
    emit()
  },
  /** Çalışma kopyasını taslak olarak kaydeder. */
  saveDraft(): void {
    const w = currentWorking()
    actions.saveDraft(w)
    working = editorBaseConfig(getState())
    workingBase = working
    emit()
  },
  /** Kaydedilmemiş değişiklikleri atar. */
  revert(): void {
    working = null
    workingBase = null
    emit()
  },
  /** Taslağı siler; çalışma kopyası aktif konfigürasyona döner. */
  discardDraft(): void {
    actions.discardDraft()
    working = null
    workingBase = null
    emit()
  },
}

export interface ModelEditor {
  working: ModelConfig
  base: ModelConfig
  active: ModelConfig
  hasDraft: boolean
  dirty: boolean
  issues: ValidationIssue[]
  /** Kaydedilmemiş değişiklikler (taban → çalışma kopyası). */
  unsaved: ConfigChange[]
  get: (path: string) => unknown
  isEdited: (path: string) => boolean
  issueAt: (path: string) => string | null
  issuesUnder: (prefix: string) => ValidationIssue[]
}

export function useModelEditor(): ModelEditor {
  const w = useSyncExternalStore(subscribe, currentWorking)
  const base = useAppState(editorBaseConfig)
  const active = useAppState(activeConfig)
  const hasDraft = useAppState((s) => s.modelDraft !== null)
  const issues = useMemo(() => validateModelConfig(w), [w])
  const unsaved = useMemo(() => (w === base ? [] : diffConfigs(base, w)), [w, base])
  return {
    working: w,
    base,
    active,
    hasDraft,
    dirty: unsaved.length > 0,
    issues,
    unsaved,
    get: (path) => getIn(w, path),
    isEdited: (path) => !deepEqual(getIn(w, path), getIn(base, path)),
    issueAt: (path) => issues.find((i) => i.path === path)?.message ?? null,
    issuesUnder: (prefix) => issues.filter((i) => i.path === prefix || i.path.startsWith(`${prefix}.`)),
  }
}

const LEAVE_MESSAGE = 'Kaydedilmemiş değişiklikler var. Model Yöneticisi’nden çıkarsanız bu değişiklikler kaybolur. Devam edilsin mi?'

/** Kaydedilmemiş değişiklik varken Model Yöneticisi dışına çıkışta ve sayfa kapanışında uyarır. */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) {
      setNavigationGuard(null)
      return
    }
    setNavigationGuard((target) => {
      if (target.startsWith('/model')) return true
      const ok = window.confirm(LEAVE_MESSAGE)
      if (ok) editorActions.revert()
      return ok
    })
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      setNavigationGuard(null)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])
}
