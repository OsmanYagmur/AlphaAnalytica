/**
 * Uygulama durumu: aktif model sürümü, sürüm geçmişi, kararlar, denetim izi,
 * oturum rolü ve sunum modu. localStorage'da tutulur; aynı sekmede
 * useSyncExternalStore, farklı sekmelerde `storage` olayıyla anında senkron olur.
 */

import { useSyncExternalStore } from 'react'
import { DEFAULT_MARKET_INTEL, FIRMS, SEED_DECISIONS, getFirm, isValidMarketIntel, type MarketIntel, type SectorIntel, type SeedDecision } from '../data'
import { revisedCollateral, allocateProducts, type CreditTerms } from '../engine/collateral'
import { evaluateFirmAsOf, type FirmEvaluation } from '../engine/evaluate'
import { migrateModelConfig } from '../engine/migrate'
import {
  BASE_MODEL_VERSION,
  MODEL_SCHEMA_VERSION,
  SECTOR_IDS,
  createDefaultModelConfig,
  type ModelConfig,
  type SectorId,
} from '../engine/modelConfig'
import type { AppState, AuditEntry, Decision, FinalTerms, ModelVersion, Role, SystemView } from './types'

const KEYS = {
  model: 'alphaanalytica:model',
  decisions: 'alphaanalytica:decisions',
  audit: 'alphaanalytica:audit',
  ui: 'alphaanalytica:ui',
  draft: 'alphaanalytica:draft',
  marketIntel: 'alphaanalytica:marketIntel',
  dataVersion: 'alphaanalytica:dataVersion',
} as const

/**
 * Demo verisinin (firmalar, başlangıç kararları) sürümü. Değiştiğinde tarayıcıda
 * kayıtlı kararlar ve karar geçmişi başlangıç durumuna döner; model sürümleri korunur.
 * R7: KKB verisi ve güncellenen başlangıç kararları.
 */
const DATA_VERSION = 'r7'

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

type ModelSlice = Pick<AppState, 'versions' | 'activeVersion' | 'lastChange' | 'modelLog'>

function initialModel(): ModelSlice {
  const base: ModelVersion = { version: BASE_MODEL_VERSION, ...BASE_VERSION_META, config: createDefaultModelConfig() }
  return {
    versions: [base],
    activeVersion: BASE_MODEL_VERSION,
    lastChange: { at: BASE_VERSION_META.createdAt, by: BASE_VERSION_META.author },
    modelLog: [{ at: BASE_VERSION_META.createdAt, by: BASE_VERSION_META.author, action: `${BASE_MODEL_VERSION} oluşturuldu ve aktif yapıldı` }],
  }
}

/** Sonraki sürüm numarası: v1.0 → v1.1 → v1.2 … */
export function nextVersionNumber(versions: readonly ModelVersion[]): string {
  const minors = versions.map((v) => Number(/^v1\.(\d+)$/.exec(v.version)?.[1] ?? 0))
  return `v1.${Math.max(0, ...minors) + 1}`
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
    marketIntel: structuredClone(DEFAULT_MARKET_INTEL),
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

function isValidModel(m: unknown): m is ModelSlice {
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
  const model = read<ModelSlice>(KEYS.model)
  const decisions = read<AppState['decisions']>(KEYS.decisions)
  const audit = read<AppState['audit']>(KEYS.audit)
  const ui = read<Pick<AppState, 'role' | 'presentation'>>(KEYS.ui)
  const draft = read<ModelConfig>(KEYS.draft)
  const marketIntel = read<MarketIntel>(KEYS.marketIntel)
  // Demo verisi değiştiyse eski kararlar yeni veriyle tutarsız olur: başlangıç kararlarına dön
  const sameData = read<string>(KEYS.dataVersion) === DATA_VERSION
  // Yeni alanlar eklenmeden önce kaydedilmiş sürümler: eksik alanlar v1.0'dan tamamlanır
  const modelSlice = isValidModel(model)
    ? {
        ...model,
        versions: model.versions.map((v) => ({ ...v, config: migrateModelConfig(v.config) })),
        modelLog: Array.isArray(model.modelLog) ? model.modelLog : initialModel().modelLog,
      }
    : initialModel()
  return {
    ...modelSlice,
    decisions: sameData && decisions && typeof decisions === 'object' ? decisions : initial.decisions,
    audit: sameData && audit && typeof audit === 'object' ? audit : initial.audit,
    modelDraft: draft?.schemaVersion === MODEL_SCHEMA_VERSION ? migrateModelConfig(draft) : null,
    role: ui?.role ?? null,
    presentation: ui?.presentation ?? false,
    marketIntel: isValidMarketIntel(marketIntel, SECTOR_IDS) ? marketIntel : initial.marketIntel,
  }
}

function persist(state: AppState): void {
  write(KEYS.model, { versions: state.versions, activeVersion: state.activeVersion, lastChange: state.lastChange, modelLog: state.modelLog })
  write(KEYS.decisions, state.decisions)
  write(KEYS.audit, state.audit)
  write(KEYS.ui, { role: state.role, presentation: state.presentation })
  write(KEYS.draft, state.modelDraft)
  write(KEYS.marketIntel, state.marketIntel)
  write(KEYS.dataVersion, DATA_VERSION)
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

/** ISO zaman damgası → yerel 'YYYY-MM-DD'. */
function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useSectorIntel(sectorId: SectorId): SectorIntel {
  return useAppState((s) => s.marketIntel[sectorId])
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
  /**
   * Konfigürasyonu yeni sürüm olarak kaydeder (numara otomatik artar), taslağı
   * temizler; `activate` ise yeni sürüm aktif model olur. Yeni sürüm numarasını döner.
   */
  saveVersion(config: ModelConfig, note: string, author: string, activate: boolean, at = new Date().toISOString()): string {
    let created = ''
    setState((s) => {
      created = nextVersionNumber(s.versions)
      const version: ModelVersion = { version: created, createdAt: at, author, note: note.trim(), config: structuredClone(config) }
      const log = [...s.modelLog, { at, by: author, action: `${created} oluşturuldu${activate ? ' ve aktif yapıldı' : ''}: ${note.trim()}` }]
      return {
        ...s,
        versions: [...s.versions, version],
        activeVersion: activate ? created : s.activeVersion,
        lastChange: { at, by: author },
        modelDraft: null,
        modelLog: log,
      }
    })
    return created
  },
  /** Mevcut bir sürümü aktif model yapar (v1.0'a dönüş dahil). */
  activateVersion(version: string, author: string, at = new Date().toISOString()): void {
    setState((s) => {
      if (!s.versions.some((v) => v.version === version) || s.activeVersion === version) return s
      const action = version === BASE_MODEL_VERSION ? `${BASE_MODEL_VERSION} varsayılanlarına dönüldü` : `${version} aktif yapıldı`
      return { ...s, activeVersion: version, lastChange: { at, by: author }, modelLog: [...s.modelLog, { at, by: author, action }] }
    })
  },
  /** Bir sektörün piyasa istihbaratını kaydeder; son güncelleme tarihi bugüne çekilir. */
  saveSectorIntel(sectorId: SectorId, intel: SectorIntel, author: string, summary: string): void {
    const at = new Date().toISOString()
    setState((s) => ({
      ...s,
      marketIntel: { ...s.marketIntel, [sectorId]: { ...intel, lastUpdated: localDate(at) } },
      modelLog: [...s.modelLog, { at, by: author, action: `Piyasa istihbaratı · ${summary}` }],
    }))
  },
  /** Bir sektörün piyasa istihbaratını araştırma verisine (varsayılan) döndürür. */
  resetSectorIntel(sectorId: SectorId, author: string, sectorLabel: string): void {
    const at = new Date().toISOString()
    setState((s) => ({
      ...s,
      marketIntel: { ...s.marketIntel, [sectorId]: structuredClone(DEFAULT_MARKET_INTEL[sectorId]) },
      modelLog: [...s.modelLog, { at, by: author, action: `Piyasa istihbaratı · ${sectorLabel}: araştırma verisine dönüldü` }],
    }))
  },
  appendModelLog(entry: AuditEntry): void {
    setState((s) => ({ ...s, modelLog: [...s.modelLog, entry] }))
  },
  /** Gizli sıfırlama: kararlar ve model konfigürasyonu v1.0 başlangıç durumuna döner. */
  resetDemo(): void {
    setState((s) => ({ ...createInitialState(), role: s.role, presentation: s.presentation }))
    resetListeners.forEach((l) => l())
  },
}
