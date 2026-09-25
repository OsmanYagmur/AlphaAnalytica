/**
 * Eski konfigürasyonların (localStorage'daki sürümler, dışa aktarılmış JSON)
 * sonradan eklenen alanlarla uyumlu hale getirilmesi. Yalnızca v1.0 şemasına
 * sonradan eklenen alanlar varsayılanlardan tamamlanır; temel bir bölümü eksik
 * olan dosyalar şema doğrulamasında reddedilmeye devam eder.
 *
 * Sonradan eklenenler:
 * - R4/R5: gösterge metinleri ve veri birimi (aciklama, birimAciklamasi, seriesUnit)
 * - R7: `kkb` bölümü (KKB parametreleri)
 */

import { withIndicatorTexts } from './indicatorInfo'
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from './modelConfig'

/** Sonradan eklenen kök bölümler. */
export const ADDED_SECTIONS = ['kkb'] as const satisfies readonly (keyof ModelConfig)[]

/** Eksik sonradan-eklenen alanları varsayılanlardan tamamlar; eksik yoksa aynı nesneyi döner. */
export function migrateModelConfig<T>(config: T, defaults: ModelConfig = DEFAULT_MODEL_CONFIG): T {
  let out = withIndicatorTexts(config, defaults)
  if (!out || typeof out !== 'object') return out
  const missing = ADDED_SECTIONS.filter((k) => !(k in (out as object)))
  if (missing.length > 0) {
    out = { ...(out as object), ...Object.fromEntries(missing.map((k) => [k, structuredClone(defaults[k])])) } as T
  }
  return out
}
