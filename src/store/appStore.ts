/**
 * Uygulama durumu: aktif model sürümü, sürüm geçmişi, kararlar, denetim izi,
 * oturum rolü ve sunum modu. localStorage'da tutulur; aynı sekmede
 * useSyncExternalStore, farklı sekmelerde `storage` olayıyla anında senkron olur.
 */

import { useSyncExternalStore } from 'react'
import { FIRMS, SEED_DECISIONS, getFirm, type SeedDecision } from '../data'
import { revisedCollateral, allocateProducts, type CreditTerms } from '../engine/collateral'
import { evaluateFirmAsOf, type FirmEvaluation } from '../engine/evaluate'
import {
  BASE_MODEL_VERSION,
  MODEL_SCHEMA_VERSION,
  createDefaultModelConfig,
  type ModelConfig,
} from '../engine/modelConfig'
import type { AppState, AuditEntry, Decision, FinalTerms, ModelVersion, Role, SystemView } from './types'

const KEYS = {
  model: 'alphaanalytica:model',
  decisions: 'alphaanalytica:decisions',
  audit: 'alphaanalytica:audit',
  ui: 'alphaanalytica:ui',
  draft: 'alphaanalytica:draft',
} as const

export const USERS: Record<Role, { name: string; title: string }> = {
  tahsis: { name: 'Elif Karaca', title: 'Tahsis Yöneticisi' },
  portfoy: { name: 'Can Demir', title: 'Portföy Yöneticisi' },
  model: { name: 'Dr. Selin Aydın', title: 'Model Yöneticisi' },
}

export const MODEL_MANAGER_PIN = '1946'

// ---------------------------------------------------------------------------
// Karar görüntüleri
// ---------------------------------------------------------------------------

export function buildSystemView(ev: FirmEvaluation): SystemView {
  return {
    traditionalScore: ev.traditional.score,
    alternativeScore: ev.alternative.score,
    score: ev.score,
    baseGrade: ev.baseGrade,
    grade: ev.grade,
    pd: ev.pd,
    limit: ev.limit.limit,
    terms: ev.terms,
    criticalSignals: ev.earlyWarnings.critical.map((s) => s.label),
    watchSignals: ev.earlyWarnings.watch.map((s) => s.label),
  }
}

/** Sistem önerisinin aynen onaylanmış hali. */
export function finalFromSystem(terms: CreditTerms, productMix: FinalTerms['productMix'], covenants: string[] = []): FinalTerms {
  return {
    limit: terms.limit,
    collateral: terms.collateral,
    tenorMonths: terms.tenor.months,
    revolving: terms.tenor.revolving,
    referenceRate: terms.pricing.referenceRate,
    spreadBp: terms.pricing.spreadBp,
    productMix,
    products: terms.products,
    covenants,
  }
}

export interface RevisionInput {
  limit: number
  collateralRatio: number
  collateralType: FinalTerms['collateral']['type']
  tenorMonths: number
  revolving: boolean
  productMix: FinalTerms['productMix']
  covenants: string[]
}

/** Revize girdilerinden nihai şartlar (tutarlar motor fonksiyonlarıyla). */
export function finalFromRevision(input: RevisionInput, system: SystemView, config: ModelConfig): FinalTerms {
  return {
    limit: input.limit,
    collateral: revisedCollateral(input.limit, input.collateralRatio, input.collateralType, config),
    tenorMonths: input.tenorMonths,
    revolving: input.revolving,
    referenceRate: config.terms.pricing.referenceRate,
    spreadBp: system.terms?.pricing.spreadBp ?? config.terms.pricing.spreadBp.B,
    productMix: input.productMix,
    products: allocateProducts(input.limit, input.productMix),
    covenants: input.covenants.filter((c) => c.trim().length > 0),
  }
}

function seedDecision(seed: SeedDecision, config: ModelConfig): Decision {
  const firm = getFirm(seed.firmId)!
  const ev = evaluateFirmAsOf(firm, seed.dataAsOf, config)
  const system = buildSystemView(ev)
  let final: FinalTerms | null = null
  if (seed.status === 'approved' && ev.terms) {
    final = finalFromSystem(ev.terms, config.sectors[firm.sectorId].productMix)
  } else if (seed.status === 'revisedApproved' && seed.revisedTerms) {
    const r = seed.revisedTerms
    final = finalFromRevision(
      {
        limit: r.limit,
        collateralRatio: r.collateralRatio,
        collateralType: r.collateralType,
        tenorMonths: r.tenorMonths,
        revolving: ev.terms?.tenor.revolving ?? false,
        productMix: r.productMix,
        covenants: r.covenants,
      },
      system,
      config,
    )
  }
  return {
    firmId: seed.firmId,
    status: seed.status,
    modelVersion: seed.modelVersion,
    decidedBy: seed.decidedBy,
    decidedAt: seed.decidedAt,
    dataAsOf: seed.dataAsOf,
    system,
    final,
    rejectionReason: seed.rejectionReason as Decision['rejectionReason'],
    note: seed.note,
    utilization: seed.utilizationRate ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Başlangıç durumu ve kalıcılık
// ---------------------------------------------------------------------------

const BASE_VERSION_META = {
  createdAt: '2026-01-15T09:00:00+03:00',
  author: 'Model Risk Yönetimi',
  note: 'İlk sürüm: varsayılan parametreler (%50 geleneksel / %50 alternatif).',
}

function initialModel(): Pick<AppState, 'versions' | 'activeVersion' | 'lastChange'> {
  const base: ModelVersion = { version: BASE_MODEL_VERSION, ...BASE_VERSION_META, config: createDefaultModelConfig() }
  return {
    versions: [base],
    activeVersion: BASE_MODEL_VERSION,
    lastChange: { at: BASE_VERSION_META.createdAt, by: BASE_VERSION_META.author },
  }
}

function initialDecisions(config: ModelConfig): Record<string, Decision> {
  return Object.fromEntries(SEED_DECISIONS.map((s) => [s.firmId, seedDecision(s, config)]))
}

function initialAudit(): Record<string, AuditEntry[]> {
  const audit: Record<string, AuditEntry[]> = {}
  for (const firm of FIRMS) {
    const seed = SEED_DECISIONS.find((d) => d.firmId === firm.id)
    audit[firm.id] = seed
      ? seed.auditLog.map((e) => ({ ...e }))
      : [{ at: `${firm.applicationDate}T09:00:00+03:00`, by: 'Sistem', action: 'Başvuru alındı' }]
  }
  return audit
}

export function createInitialState(): AppState {
  const model = initialModel()
  return {
    ...model,
    decisions: initialDecisions(model.versions[0].config),
    audit: initialAudit(),
    modelDraft: null,
    role: null,
    presentation: false,
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Depolama kapalıysa durum yalnızca bellekte tutulur.
  }
}

function isValidModel(m: unknown): m is Pick<AppState, 'versions' | 'activeVersion' | 'lastChange'> {
  if (!m || typeof m !== 'object') return false
  const model = m as AppState
  return (
    Array.isArray(model.versions) &&
    model.versions.length > 0 &&
    model.versions.every((v) => v?.config?.schemaVersion === MODEL_SCHEMA_VERSION) &&
    model.versions.some((v) => v.version === model.activeVersion)
  )
}

function loadState(): AppState {
  const initial = createInitialState()
  if (typeof window === 'undefined') return initial
  const model = read<Pick<AppState, 'versions' | 'activeVersion' | 'lastChange'>>(KEYS.model)
  const decisions = read<AppState['decisions']>(KEYS.decisions)
  const audit = read<AppState['audit']>(KEYS.audit)
  const ui = read<Pick<AppState, 'role' | 'presentation'>>(KEYS.ui)
  const draft = read<ModelConfig>(KEYS.draft)
  return {
    ...(isValidModel(model) ? model : initialModel()),
    decisions: decisions && typeof decisions === 'object' ? decisions : initial.decisions,
    audit: audit && typeof audit === 'object' ? audit : initial.audit,
    modelDraft: draft?.schemaVersion === MODEL_SCHEMA_VERSION ? draft : null,
    role: ui?.role ?? null,
    presentation: ui?.presentation ?? false,
  }
}

function persist(state: AppState): void {
  write(KEYS.model, { versions: state.versions, activeVersion: state.activeVersion, lastChange: state.lastChange })
  write(KEYS.decisions, state.decisions)
  write(KEYS.audit, state.audit)
  write(KEYS.ui, { role: state.role, presentation: state.presentation })
  write(KEYS.draft, state.modelDraft)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let state: AppState = loadState()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function setState(update: (s: AppState) => AppState): void {
  state = update(state)
  persist(state)
  emit()
}

const resetListeners = new Set<() => void>()

/** Demo sıfırlandığında çağrılır (ör. Model Yöneticisi çalışma kopyasını atmak için). */
export function onDemoReset(listener: () => void): () => void {
  resetListeners.add(listener)
  return () => resetListeners.delete(listener)
}

export function getState(): AppState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key.startsWith('alphaanalytica:')) {
      state = loadState()
      emit()
    }
  })
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}

export function versionConfig(s: AppState, version: string): ModelConfig {
  return (s.versions.find((v) => v.version === version) ?? s.versions[0]).config
}

export function activeConfig(s: AppState): ModelConfig {
  return versionConfig(s, s.activeVersion)
}

/** Taslak varsa taslak, yoksa aktif konfigürasyon: düzenlemelerin karşılaştırıldığı taban. */
export function editorBaseConfig(s: AppState): ModelConfig {
  return s.modelDraft ?? activeConfig(s)
}

export function isPending(s: AppState, firmId: string): boolean {
  return !s.decisions[firmId]
}

// ---------------------------------------------------------------------------
// Eylemler
// ---------------------------------------------------------------------------

export const actions = {
  login(role: Role): void {
    setState((s) => ({ ...s, role }))
  },
  logout(): void {
    setState((s) => ({ ...s, role: null }))
  },
  setPresentation(presentation: boolean): void {
    setState((s) => ({ ...s, presentation }))
  },
  recordDecision(decision: Decision, auditAction: string): void {
    setState((s) => ({
      ...s,
      decisions: { ...s.decisions, [decision.firmId]: decision },
      audit: {
        ...s.audit,
        [decision.firmId]: [
          ...(s.audit[decision.firmId] ?? []),
          { at: decision.decidedAt, by: decision.decidedBy, action: auditAction },
        ],
      },
    }))
  },
  appendAudit(firmId: string, entry: AuditEntry): void {
    setState((s) => ({ ...s, audit: { ...s.audit, [firmId]: [...(s.audit[firmId] ?? []), entry] } }))
  },
  /** Model Yöneticisi taslağını kaydeder (aktif modeli değiştirmez). */
  saveDraft(config: ModelConfig): void {
    setState((s) => ({ ...s, modelDraft: structuredClone(config) }))
  },
  discardDraft(): void {
    setState((s) => ({ ...s, modelDraft: null }))
  },
  /** Gizli sıfırlama: kararlar ve model konfigürasyonu v1.0 başlangıç durumuna döner. */
  resetDemo(): void {
    setState((s) => ({ ...createInitialState(), role: s.role, presentation: s.presentation }))
    resetListeners.forEach((l) => l())
  },
}
