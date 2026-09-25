/**
 * Duyarlılık analizi: seçilen parametre min–max arasında kaydırıldığında
 * seçili firmanın nihai skorunun değişimi. Toplamı 1 olan ağırlık gruplarında
 * diğer ağırlıklar orantılı olarak yeniden dağıtılır.
 */

import { evaluateFirm, type FirmInput } from './evaluate'
import { TRADITIONAL_CATEGORY_IDS, type CreditGrade, type ModelConfig, type SectorId, type TraditionalCategoryId } from './modelConfig'

export interface SensitivityParam {
  id: string
  label: string
  min: number
  max: number
  /** Gösterim ölçeği (ağırlıklar için 100 → %). */
  scale: number
  unit: string
  get: (c: ModelConfig) => number
  apply: (c: ModelConfig, value: number) => ModelConfig
}

/** Gruptaki bir anahtarı `value` yapar, kalan payı diğerlerine mevcut oranlarıyla dağıtır. */
function rebalance<T extends Record<string, number>>(weights: T, key: keyof T & string, value: number): T {
  const others = Object.keys(weights).filter((k) => k !== key)
  const rest = others.reduce((a, k) => a + weights[k], 0)
  const out: Record<string, number> = { ...weights, [key]: value }
  for (const k of others) out[k] = rest > 0 ? (weights[k] / rest) * (1 - value) : (1 - value) / others.length
  return out as T
}

function categoryParam(id: TraditionalCategoryId, label: string): SensitivityParam {
  return {
    id: `traditional.${id}`,
    label: `Geleneksel · ${label} ağırlığı`,
    min: 0,
    max: 0.6,
    scale: 100,
    unit: '%',
    get: (c) => c.traditional.categories[id].weight,
    apply: (c, v) => {
      const current = Object.fromEntries(TRADITIONAL_CATEGORY_IDS.map((k) => [k, c.traditional.categories[k].weight])) as Record<TraditionalCategoryId, number>
      const next = rebalance(current, id, v)
      const categories = { ...c.traditional.categories }
      for (const k of TRADITIONAL_CATEGORY_IDS) categories[k] = { ...categories[k], weight: next[k] } as never
      return { ...c, traditional: { ...c.traditional, categories } }
    },
  }
}

export function sensitivityParams(config: ModelConfig, sectorId: SectorId): SensitivityParam[] {
  const cats = config.traditional.categories
  return [
    {
      id: 'final.alternative',
      label: 'Alternatif veri ağırlığı (w_A)',
      min: 0,
      max: 1,
      scale: 100,
      unit: '%',
      get: (c) => c.final.weights.alternative,
      apply: (c, v) => ({ ...c, final: { weights: { traditional: 1 - v, alternative: v } } }),
    },
    {
      id: 'alternative.sp',
      label: 'SP ağırlığı (alternatif skor içinde)',
      min: 0,
      max: 1,
      scale: 100,
      unit: '%',
      get: (c) => c.alternative.weights.sp,
      apply: (c, v) => ({ ...c, alternative: { ...c.alternative, weights: rebalance(c.alternative.weights, 'sp', v) } }),
    },
    {
      id: 'alternative.tolerance',
      label: 'SU toleransı',
      min: 0.1,
      max: 1,
      scale: 1,
      unit: '',
      get: (c) => c.alternative.seasonalFit.tolerance,
      apply: (c, v) => ({ ...c, alternative: { ...c.alternative, seasonalFit: { ...c.alternative.seasonalFit, tolerance: v } } }),
    },
    {
      id: 'alternative.neutral',
      label: 'Veri kapsama nötr değeri',
      min: 0,
      max: 100,
      scale: 1,
      unit: 'puan',
      get: (c) => c.alternative.coverage.neutralScore,
      apply: (c, v) => ({ ...c, alternative: { ...c.alternative, coverage: { ...c.alternative.coverage, neutralScore: v } } }),
    },
    {
      id: 'kkb.findeks',
      label: 'Findeks ağırlığı (skora dahil edilerek)',
      min: 0,
      max: 0.5,
      scale: 100,
      unit: '%',
      get: (c) => (c.kkb.findeks.includeInScore ? c.kkb.findeks.weight : 0),
      apply: (c, v) => ({ ...c, kkb: { ...c.kkb, findeks: { ...c.kkb.findeks, includeInScore: v > 0, weight: v } } }),
    },
    ...TRADITIONAL_CATEGORY_IDS.map((id) => categoryParam(id, cats[id].label)),
    {
      id: 'sector.ccc',
      label: `${config.sectors[sectorId].label} · NDS medyanı`,
      min: 10,
      max: 180,
      scale: 1,
      unit: 'gün',
      get: (c) => c.sectors[sectorId].cccMedianDays,
      apply: (c, v) => ({ ...c, sectors: { ...c.sectors, [sectorId]: { ...c.sectors[sectorId], cccMedianDays: v } } }),
    },
  ]
}

export interface SensitivityPoint {
  value: number
  score: number
  grade: CreditGrade
}

export function runSensitivity(firm: FirmInput, config: ModelConfig, param: SensitivityParam, steps = 21): SensitivityPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const value = param.min + ((param.max - param.min) * i) / (steps - 1)
    const e = evaluateFirm(firm, param.apply(config, value))
    return { value, score: e.score, grade: e.grade }
  })
}
