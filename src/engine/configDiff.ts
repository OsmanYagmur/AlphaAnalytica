/**
 * İki model konfigürasyonu arasındaki parametre farkları (eski → yeni) ve
 * yolların okunabilir Türkçe etiketleri.
 */

import { PRODUCT_LABELS, type ModelConfig } from './modelConfig'

export interface ConfigChange {
  path: string
  label: string
  before: unknown
  after: unknown
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const KEY_LABELS: Record<string, string | null> = {
  final: 'Ana denge',
  traditional: 'Geleneksel',
  alternative: 'Alternatif',
  categories: null,
  ratios: null,
  indicators: null,
  sectors: null,
  profiles: null,
  weights: 'ağırlık',
  weight: 'ağırlık',
  breakpoints: 'kırılım',
  value: 'değer',
  score: 'puan',
  sp: 'SP',
  su: 'SU',
  tr: 'TR',
  seasonalFit: 'Sezon uyumu',
  tolerance: 'tolerans',
  windowMonths: 'pencere (ay)',
  trend: 'Trend',
  coverage: 'Veri kapsama',
  enabled: 'etkin',
  neutralScore: 'nötr değer',
  rating: 'Not',
  minScore: 'eşik',
  pd: 'PD',
  center: 'merkez',
  scale: 'ölçek',
  earlyWarning: 'Erken uyarı',
  critical: 'kritik',
  watch: 'izleme',
  threshold: 'eşik',
  gradeCap: 'not tavanı',
  maxScore: 'eşik puan',
  maxAnnualGrowth: 'büyüme eşiği',
  minGap: 'G−A farkı',
  limit: 'Limit',
  k1: 'K1',
  k2: 'K2',
  k3: 'K3',
  multiplier: 'çarpan',
  minDays: 'minimum gün',
  equityMultiplier: 'özkaynak çarpanı',
  ebitdaRatio: 'FAVÖK oranı',
  gradeMultiplier: 'not çarpanı (f)',
  roundingUnit: 'yuvarlama birimi',
  terms: 'Teminat ve fiyatlama',
  collateralRatio: 'teminat oranı',
  collateralType: 'teminat türü',
  mortgageRequiredFrom: 'ipotek zorunlu not',
  appraisalLtv: 'ekspertiz LTV',
  tenor: 'vade',
  months: 'ay',
  revolving: 'rotatif',
  pricing: 'fiyatlama',
  spreadBp: 'spread (bp)',
  referenceRate: 'referans faiz',
  defaultProductMix: 'Varsayılan ürün kırılımı',
  productMix: 'ürün kırılımı',
  seasonality: 'sezon',
  index: 'endeks',
  riskCoefficient: 'SRK',
  cccMedianDays: 'NDS medyanı (gün)',
  negativeTaxBaseScoreCap: 'Negatif matrah tavanı',
  daysInYear: 'Yıl gün sayısı',
  presentation: 'Sunum',
  strengthBands: 'güç bantları',
  strongMin: '"Güçlü" alt sınırı',
  moderateMin: '"Orta" alt sınırı',
  topFactorCount: 'faktör sayısı',
  decision: 'Karar',
  revisionJustificationThreshold: 'revize gerekçe eşiği',
}

/** Yolu okunabilir etikete çevirir (ör. "Kırtasiye · POS ciro · kırılım 2 · puan"). */
export function describePath(config: ModelConfig, path: string): string {
  const parts = path.split('.')
  const labels: string[] = []
  let node: unknown = config
  let parentKey = ''
  for (const part of parts) {
    const next = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
    const nodeLabel = next && typeof next === 'object' && 'label' in next ? String((next as { label: unknown }).label) : null
    if (nodeLabel) labels.push(nodeLabel)
    else if (parentKey === 'breakpoints') labels.push(`${Number(part) + 1}. nokta`)
    else if (parentKey === 'index') labels.push(MONTHS[Number(part)] ?? part)
    else if (part in PRODUCT_LABELS) labels.push(PRODUCT_LABELS[part as keyof typeof PRODUCT_LABELS])
    else if (part in KEY_LABELS) {
      const l = KEY_LABELS[part]
      if (l) labels.push(l)
    } else labels.push(part)
    node = next
    parentKey = part
  }
  return labels.join(' · ')
}

function walk(before: unknown, after: unknown, path: string[], out: { path: string; before: unknown; after: unknown }[]) {
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)])
    for (const key of keys) {
      if (key === 'label' || key === 'description' || key === 'aciklama' || key === 'birimAciklamasi' || key === 'seriesUnit') continue
      walk((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], [...path, key], out)
    }
    return
  }
  const same =
    typeof before === 'number' && typeof after === 'number' ? Math.abs(before - after) < 1e-12 : Object.is(before, after)
  if (!same) out.push({ path: path.join('.'), before, after })
}

export function diffConfigs(before: ModelConfig, after: ModelConfig): ConfigChange[] {
  const raw: { path: string; before: unknown; after: unknown }[] = []
  walk(before, after, [], raw)
  return raw.map((r) => ({ ...r, label: describePath(after, r.path) }))
}
