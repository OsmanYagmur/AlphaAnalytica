/**
 * Model konfigürasyonu JSON dışa/içe aktarımı ve şema doğrulaması.
 * Şema, v1.0 varsayılanlarının yapısıdır: aynı anahtarlar ve aynı türler
 * beklenir; ardından değer kuralları (validateModelConfig) uygulanır.
 */

import { DEFAULT_MODEL_CONFIG, MODEL_SCHEMA_VERSION, type ModelConfig } from './modelConfig'
import { withIndicatorTexts } from './indicatorInfo'
import { validateModelConfig } from './validation'

export const EXPORT_FORMAT = 'alphaanalytica-model-config'

export interface ModelExport {
  format: typeof EXPORT_FORMAT
  modelVersion: string
  exportedAt: string
  config: ModelConfig
}

export function exportModelConfig(config: ModelConfig, modelVersion: string, now = new Date()): string {
  const payload: ModelExport = { format: EXPORT_FORMAT, modelVersion, exportedAt: now.toISOString(), config }
  return JSON.stringify(payload, null, 2)
}

function typeOf(v: unknown): string {
  if (Array.isArray(v)) return 'array'
  if (v === null) return 'null'
  return typeof v
}

/** Beklenen yapıyla karşılaştırır. Diziler: ilk elemanın yapısı tüm elemanlara uygulanır. */
function checkShape(expected: unknown, actual: unknown, path: string, errors: string[]) {
  const et = typeOf(expected)
  const at = typeOf(actual)
  const where = path || '(kök)'
  if (et !== at) {
    errors.push(`${where}: ${et} bekleniyordu, ${at} bulundu`)
    return
  }
  if (et === 'array') {
    const exp = expected as unknown[]
    const act = actual as unknown[]
    if (exp.length > 0) act.forEach((item, i) => checkShape(exp[0], item, `${path}[${i}]`, errors))
    return
  }
  if (et !== 'object') return
  const exp = expected as Record<string, unknown>
  const act = actual as Record<string, unknown>
  for (const key of Object.keys(exp)) {
    if (!(key in act)) errors.push(`${path ? `${path}.` : ''}${key}: eksik alan`)
    else checkShape(exp[key], act[key], path ? `${path}.${key}` : key, errors)
  }
  for (const key of Object.keys(act)) {
    if (!(key in exp)) errors.push(`${path ? `${path}.` : ''}${key}: tanımsız alan`)
  }
}

export type ImportResult =
  | { ok: true; config: ModelConfig; sourceVersion: string | null }
  | { ok: false; errors: string[] }

/** JSON metnini ayrıştırır, şemayı ve değer kurallarını doğrular. */
export function parseModelConfigJson(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['Dosya geçerli bir JSON değil.'] }
  }
  let sourceVersion: string | null = null
  if (data && typeof data === 'object' && (data as ModelExport).format === EXPORT_FORMAT) {
    sourceVersion = typeof (data as ModelExport).modelVersion === 'string' ? (data as ModelExport).modelVersion : null
    data = (data as ModelExport).config
  }
  if (!data || typeof data !== 'object') return { ok: false, errors: ['Konfigürasyon nesnesi bulunamadı.'] }
  if ((data as ModelConfig).schemaVersion !== MODEL_SCHEMA_VERSION) {
    return { ok: false, errors: [`schemaVersion ${MODEL_SCHEMA_VERSION} olmalı.`] }
  }

  // Gösterge açıklamalarından önce dışa aktarılmış dosyalar: eksik metinler varsayılandan tamamlanır
  data = withIndicatorTexts(data)
  const shapeErrors: string[] = []
  checkShape(DEFAULT_MODEL_CONFIG, data, '', shapeErrors)
  const config = data as ModelConfig
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors.slice(0, 20) }

  const issues = validateModelConfig(config)
  if (issues.length > 0) return { ok: false, errors: issues.slice(0, 20).map((i) => `${i.path}: ${i.message}`) }
  return { ok: true, config: structuredClone(config), sourceVersion }
}
