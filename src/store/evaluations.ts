/**
 * Firma görünümleri: bekleyen başvurular aktif modelle, karara bağlanmış
 * başvurular kararın model sürümü ve karar anındaki veriyle hesaplanır.
 */

import { FIRMS, type Firm } from '../data'
import { evaluateFirm, evaluateFirmAsOf, type FirmEvaluation } from '../engine/evaluate'
import type { ModelConfig } from '../engine/modelConfig'
import { activeConfig, useAppState, versionConfig } from './appStore'
import type { AppState, Decision } from './types'

export type FirmStatus = 'pending' | Decision['status']

export interface FirmView {
  firm: Firm
  status: FirmStatus
  decision: Decision | null
  /** Görüntülenen değerlendirmenin model sürümü ve konfigürasyonu. */
  modelVersion: string
  config: ModelConfig
  evaluation: FirmEvaluation
  /** Aktif model ve güncel veriyle değerlendirme (portföy izleme). */
  current: FirmEvaluation
}

function buildView(s: AppState, firm: Firm): FirmView {
  const decision = s.decisions[firm.id] ?? null
  if (decision) {
    const config = versionConfig(s, decision.modelVersion)
    const active = activeConfig(s)
    return {
      firm,
      status: decision.status,
      decision,
      modelVersion: decision.modelVersion,
      config,
      evaluation: evaluateFirmAsOf(firm, decision.dataAsOf, config),
      current: evaluateFirm(firm, active),
    }
  }
  const config = activeConfig(s)
  const evaluation = evaluateFirm(firm, config)
  return { firm, status: 'pending', decision: null, modelVersion: s.activeVersion, config, evaluation, current: evaluation }
}

let cacheKey: [AppState['versions'], string, AppState['decisions']] | null = null
let cache: FirmView[] = []

function allViews(s: AppState): FirmView[] {
  if (cacheKey && cacheKey[0] === s.versions && cacheKey[1] === s.activeVersion && cacheKey[2] === s.decisions) {
    return cache
  }
  cache = FIRMS.map((f) => buildView(s, f))
  cacheKey = [s.versions, s.activeVersion, s.decisions]
  return cache
}

export function useFirmViews(): FirmView[] {
  return useAppState(allViews)
}

export function useFirmView(id: string): FirmView | null {
  const views = useFirmViews()
  return views.find((v) => v.firm.id === id) ?? null
}

export function useActiveConfig(): ModelConfig {
  return useAppState(activeConfig)
}

export function useActiveVersion(): string {
  return useAppState((s) => s.activeVersion)
}
