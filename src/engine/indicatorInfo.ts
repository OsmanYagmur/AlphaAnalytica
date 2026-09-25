/**
 * Alternatif göstergelerin ekranlarda gösterilen niteliksel açıklamaları.
 * Formül, ağırlık veya eşik içermez; yalnızca gösterilen değerin ne olduğunu söyler.
 */

import { DEFAULT_MODEL_CONFIG, type AlternativeIndicatorConfig, type IndicatorMeasure, type ModelConfig } from './modelConfig'

const MONTH_NAMES = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** Göstergenin skora giren değerinin ne olduğunu anlatan kısa etiket (ör. "Geçen yılın aynı dönemine göre değişim · son 3 ay"). */
export function describeIndicatorValue(measure: IndicatorMeasure): string {
  switch (measure.kind) {
    case 'mean':
      return measure.window === 1 ? 'Son ayın değeri' : `Son ${measure.window} ayın ortalaması`
    case 'latest':
      return 'Son durum'
    case 'change': {
      const base = measure.lag === 12 ? 'Geçen yılın aynı dönemine göre değişim' : `${measure.lag} ay önceki döneme göre değişim`
      return measure.window === 1 ? `${base} · son ay` : `${base} · son ${measure.window} ay`
    }
    case 'projection':
      return `Son ${measure.window} ayın eğilimine göre ${measure.horizon} ay sonrası için beklenen değer`
    case 'periodChange':
      return `${measure.calendarMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')} dönemi · önceki yılın aynı dönemine göre değişim`
  }
}

/** Yalnızca gösterim amaçlı, parametre olmayan gösterge alanları. */
export const INDICATOR_TEXT_KEYS = ['aciklama', 'birimAciklamasi'] as const satisfies readonly (keyof AlternativeIndicatorConfig)[]

/**
 * Bu alanlardan önce kaydedilmiş (localStorage veya JSON) konfigürasyonlarda
 * eksik gösterim alanlarını v1.0 varsayılanlarından tamamlar. Parametrelere
 * dokunmaz; eksik alan yoksa aynı nesneyi döner.
 */
export function withIndicatorTexts<T>(config: T, defaults: ModelConfig = DEFAULT_MODEL_CONFIG): T {
  const sectors = (config as { sectors?: unknown } | null)?.sectors
  if (!sectors || typeof sectors !== 'object') return config
  let changed = false
  const nextSectors: Record<string, unknown> = { ...(sectors as Record<string, unknown>) }
  for (const [sectorId, sector] of Object.entries(sectors as Record<string, unknown>)) {
    const indicators = (sector as { indicators?: unknown } | null)?.indicators
    const defaultIndicators = (defaults.sectors as Record<string, { indicators: Record<string, AlternativeIndicatorConfig> }>)[sectorId]?.indicators
    if (!indicators || typeof indicators !== 'object' || !defaultIndicators) continue
    let sectorChanged = false
    const nextIndicators: Record<string, unknown> = { ...(indicators as Record<string, unknown>) }
    for (const [id, ind] of Object.entries(indicators as Record<string, unknown>)) {
      const def = defaultIndicators[id]
      if (!def || !ind || typeof ind !== 'object') continue
      const missing = INDICATOR_TEXT_KEYS.filter((k) => !(k in ind))
      if (missing.length === 0) continue
      nextIndicators[id] = { ...(ind as object), ...Object.fromEntries(missing.map((k) => [k, def[k]])) }
      sectorChanged = true
    }
    if (sectorChanged) {
      nextSectors[sectorId] = { ...(sector as object), indicators: nextIndicators }
      changed = true
    }
  }
  return changed ? ({ ...(config as object), sectors: nextSectors } as T) : config
}
