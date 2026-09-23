/**
 * Niteliksel açıklamalar: "Güçlü / Orta / Zayıf" etiketi ve skoru en çok
 * etkileyen faktörler. Faktör etkisi, bileşenin nötr değerden sapmasının
 * nihai skora yansıyan payıdır; sıralama için kullanılır, ekranda gösterilmez.
 */

import type { FirmEvaluation } from './evaluate'
import type { ModelConfig, TraditionalCategoryId } from './modelConfig'

export type StrengthLabel = 'Güçlü' | 'Orta' | 'Zayıf'

export function strengthLabel(score: number, config: ModelConfig): StrengthLabel {
  const { strongMin, moderateMin } = config.presentation.strengthBands
  if (score >= strongMin) return 'Güçlü'
  if (score >= moderateMin) return 'Orta'
  return 'Zayıf'
}

export type FactorKind = 'traditional' | 'indicator' | 'seasonalFit' | 'trend'

export interface ScoreFactor {
  id: string
  kind: FactorKind
  label: string
  /** Sıralama için; ekranda gösterilmez. */
  impact: number
  text: string
}

const TRADITIONAL_TEXT: Record<TraditionalCategoryId, [positive: string, negative: string]> = {
  liquidity: [
    'Likidite güçlü: kısa vadeli yükümlülükler dönen varlıklarla rahatça karşılanıyor.',
    'Likidite zayıf: kısa vadeli yükümlülükleri karşılama kapasitesi sınırlı.',
  ],
  leverage: [
    'Borçluluk düzeyi makul; özkaynak yapısı sağlam.',
    'Kaldıraç yüksek: borç yükü özkaynağa ve faaliyet kârına göre ağır.',
  ],
  profitability: [
    'Kârlılık güçlü: faaliyetler yüksek marjla nakit üretiyor.',
    'Kârlılık zayıf: marjlar borç servisini desteklemekte yetersiz kalıyor.',
  ],
  efficiency: [
    'Nakit dönüşüm süresi sektör medyanından kısa; işletme sermayesi verimli kullanılıyor.',
    'Nakit dönüşüm süresi sektör medyanından uzun; işletme sermayesi ihtiyacı yüksek.',
  ],
  debtService: [
    'Faaliyet kârı finansman giderlerini rahatça karşılıyor.',
    'Finansman giderleri faaliyet kârı üzerinde belirgin baskı oluşturuyor.',
  ],
  consistency: [
    'Mizan ile kurumlar vergisi beyannamesi tutarlı.',
    'Mizan ile kurumlar vergisi beyannamesi arasında tutarsızlık var.',
  ],
}

export function computeScoreFactors(
  ev: FirmEvaluation,
  config: ModelConfig,
): { positive: ScoreFactor[]; negative: ScoreFactor[] } {
  const reference = config.alternative.coverage.neutralScore
  const { traditional: wG, alternative: wA } = config.final.weights
  const alt = ev.alternative
  const coverageFactor = config.alternative.coverage.enabled ? alt.coverage : 1
  const altWeight = wA * coverageFactor
  const factors: ScoreFactor[] = []

  for (const [id, cat] of Object.entries(ev.traditional.categories) as [TraditionalCategoryId, (typeof ev.traditional.categories)[TraditionalCategoryId]][]) {
    const impact = wG * cat.weight * (cat.score - reference)
    factors.push({ id, kind: 'traditional', label: cat.label, impact, text: TRADITIONAL_TEXT[id][impact >= 0 ? 0 : 1] })
  }

  const available = Object.entries(alt.indicators).filter(([, r]) => r.score !== null)
  const weightSum = available.reduce((acc, [, r]) => acc + r.weight, 0)
  for (const [id, r] of available) {
    if (weightSum <= 0) break
    const impact = altWeight * config.alternative.weights.sp * (r.weight / weightSum) * (r.score! - reference)
    const text = impact >= 0 ? `${r.label} güçlü seyrediyor ve skoru yukarı taşıyor.` : `${r.label} zayıf seyrediyor ve skoru aşağı çekiyor.`
    factors.push({ id, kind: 'indicator', label: r.label, impact, text })
  }

  const suImpact = altWeight * config.alternative.weights.su * (alt.su - reference)
  factors.push({
    id: 'seasonalFit',
    kind: 'seasonalFit',
    label: 'Sezon uyumu',
    impact: suImpact,
    text:
      suImpact >= 0
        ? 'Aylık ciro sektörün beklenen sezon desenine uyumlu; sezonsal dalgalanma risk olarak değerlendirilmedi.'
        : 'Aylık ciro sektörün beklenen sezon deseninden belirgin biçimde sapıyor.',
  })

  const trImpact = altWeight * config.alternative.weights.tr * (alt.tr - reference)
  factors.push({
    id: 'trend',
    kind: 'trend',
    label: 'Arındırılmış ciro trendi',
    impact: trImpact,
    text:
      trImpact >= 0
        ? 'Sezonsallıktan arındırılmış ciro büyüme eğiliminde.'
        : 'Sezonsallıktan arındırılmış ciro düşüş eğiliminde.',
  })

  const n = config.presentation.topFactorCount
  return {
    positive: factors.filter((f) => f.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, n),
    negative: factors.filter((f) => f.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, n),
  }
}
