/**
 * Model konfigürasyonu doğrulaması. Model Yöneticisi'nde satır içi hata
 * mesajları ve kaydetme kilidi için; JSON içe aktarımında da kullanılır.
 * Yol biçimi: 'traditional.categories.liquidity.ratios.currentRatio.breakpoints.2.value'
 */

import {
  CREDIT_GRADES,
  KKB_CREDIT_TYPES,
  LENDABLE_GRADES,
  PRODUCT_IDS,
  SECTOR_IDS,
  TRADITIONAL_CATEGORY_IDS,
  type AlternativeIndicatorConfig,
  type BreakpointCurve,
  type ModelConfig,
  type ProductMix,
  type RatioConfig,
  type SeasonProfile,
} from './modelConfig'
import { gradeRank } from './rating'

export interface ValidationIssue {
  path: string
  message: string
}

/** Ağırlık toplamı toleransı. */
export const WEIGHT_SUM_TOLERANCE = 1e-6

function pct(v: number): string {
  return `%${(Math.round(v * 10000) / 100).toLocaleString('tr-TR')}`
}

class Collector {
  issues: ValidationIssue[] = []
  add(path: string, message: string) {
    this.issues.push({ path, message })
  }

  finite(path: string, v: unknown): v is number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.add(path, 'Geçerli bir sayı girin.')
      return false
    }
    return true
  }

  range(path: string, v: unknown, min: number, max: number, opts: { integer?: boolean; exclusiveMin?: boolean } = {}) {
    if (!this.finite(path, v)) return
    if (opts.integer && !Number.isInteger(v)) this.add(path, 'Tam sayı olmalı.')
    else if (opts.exclusiveMin ? v <= min : v < min) this.add(path, opts.exclusiveMin ? `${min} değerinden büyük olmalı.` : `En az ${min} olmalı.`)
    else if (v > max) this.add(path, `En fazla ${max} olabilir.`)
  }

  weights(path: string, entries: [string, number][]) {
    let ok = true
    for (const [key, v] of entries) {
      if (!this.finite(`${path}.${key}`, v)) ok = false
      else if (v < 0) {
        this.add(`${path}.${key}`, 'Ağırlık negatif olamaz.')
        ok = false
      }
    }
    if (!ok) return
    const sum = entries.reduce((a, [, v]) => a + v, 0)
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) this.add(path, `Ağırlıklar toplamı %100 olmalı (şu an ${pct(sum)}).`)
  }

  curve(path: string, curve: BreakpointCurve) {
    if (!Array.isArray(curve) || curve.length < 2) {
      this.add(path, 'En az iki kırılım noktası gerekli.')
      return
    }
    curve.forEach((p, i) => {
      this.finite(`${path}.${i}.value`, p.value)
      this.range(`${path}.${i}.score`, p.score, 0, 100)
      if (i > 0 && Number.isFinite(p.value) && Number.isFinite(curve[i - 1].value) && p.value <= curve[i - 1].value) {
        this.add(`${path}.${i}.value`, 'Değerler artan sırada olmalı ve tekrar etmemeli.')
      }
    })
  }

  mix(path: string, mix: ProductMix) {
    this.weights(path, PRODUCT_IDS.map((p) => [p, mix[p]]))
  }
}

export function validateModelConfig(config: ModelConfig): ValidationIssue[] {
  const c = new Collector()

  c.range('daysInYear', config.daysInYear, 360, 366, { integer: true })

  // Ana denge
  c.weights('final.weights', Object.entries(config.final.weights))

  // Geleneksel
  const cats = config.traditional.categories
  c.weights('traditional.categories', TRADITIONAL_CATEGORY_IDS.map((id) => [id, cats[id].weight]))
  for (const id of TRADITIONAL_CATEGORY_IDS) {
    const ratios = Object.entries(cats[id].ratios) as [string, RatioConfig][]
    const base = `traditional.categories.${id}.ratios`
    c.weights(base, ratios.map(([rid, r]) => [rid, r.weight]))
    for (const [rid, r] of ratios) c.curve(`${base}.${rid}.breakpoints`, r.breakpoints)
  }
  c.range('traditional.negativeTaxBaseScoreCap', config.traditional.negativeTaxBaseScoreCap, 0, 100)

  // Alternatif
  const alt = config.alternative
  c.weights('alternative.weights', Object.entries(alt.weights))
  c.range('alternative.seasonalFit.tolerance', alt.seasonalFit.tolerance, 0, 5, { exclusiveMin: true })
  c.range('alternative.seasonalFit.windowMonths', alt.seasonalFit.windowMonths, 1, 24, { integer: true })
  c.range('alternative.trend.windowMonths', alt.trend.windowMonths, 3, 24, { integer: true })
  c.curve('alternative.trend.breakpoints', alt.trend.breakpoints)
  c.range('alternative.coverage.neutralScore', alt.coverage.neutralScore, 0, 100)

  // Sektörler
  for (const sid of SECTOR_IDS) {
    const s = config.sectors[sid]
    const base = `sectors.${sid}`
    const inds = Object.entries(s.indicators) as [string, AlternativeIndicatorConfig][]
    c.weights(`${base}.indicators`, inds.map(([iid, ind]) => [iid, ind.weight]))
    for (const [iid, ind] of inds) c.curve(`${base}.indicators.${iid}.breakpoints`, ind.breakpoints)
    c.range(`${base}.riskCoefficient`, s.riskCoefficient, 0.5, 1.5)
    c.range(`${base}.cccMedianDays`, s.cccMedianDays, 0, 365, { exclusiveMin: true })
    c.mix(`${base}.productMix`, s.productMix)
    for (const [pid, profile] of Object.entries(s.seasonality.profiles) as [string, SeasonProfile][]) {
      const path = `${base}.seasonality.profiles.${pid}.index`
      if (!Array.isArray(profile.index) || profile.index.length !== 12) {
        c.add(path, 'Sezon endeksi 12 aylık olmalı.')
        continue
      }
      profile.index.forEach((v, i) => c.range(`${path}.${i}`, v, 0, 10, { exclusiveMin: true }))
      const mean = profile.index.reduce((a, b) => a + b, 0) / 12
      if (Number.isFinite(mean) && Math.abs(mean - 1) > 0.005) c.add(path, 'Sezon endeksinin ortalaması 1,00 olmalı.')
    }
  }

  // Not, PD
  const min = config.rating.minScore
  LENDABLE_GRADES.forEach((g, i) => {
    const path = `rating.minScore.${g}`
    c.range(path, min[g], 0, 100)
    if (i > 0 && Number.isFinite(min[g]) && min[g] >= min[LENDABLE_GRADES[i - 1]]) {
      c.add(path, `${LENDABLE_GRADES[i - 1]} eşiğinden küçük olmalı (eşikler sıralı olmalı, çakışamaz).`)
    }
  })
  c.range('rating.pd.center', config.rating.pd.center, 0, 100)
  c.range('rating.pd.scale', config.rating.pd.scale, 0, 50, { exclusiveMin: true })

  // Erken uyarı
  const ew = config.earlyWarning
  c.range('earlyWarning.critical.declarationInconsistency.threshold', ew.critical.declarationInconsistency.threshold, 0, 1, { exclusiveMin: true })
  for (const [id, rule] of Object.entries(ew.critical)) {
    if (!LENDABLE_GRADES.includes(rule.gradeCap)) c.add(`earlyWarning.critical.${id}.gradeCap`, 'Geçerli bir not seçin.')
  }
  c.range('earlyWarning.watch.weakIndicator.maxScore', ew.watch.weakIndicator.maxScore, 0, 100)
  c.range('earlyWarning.watch.negativeTrend.maxAnnualGrowth', ew.watch.negativeTrend.maxAnnualGrowth, -1, 1)
  c.range('earlyWarning.watch.scoreDivergence.minGap', ew.watch.scoreDivergence.minGap, 0, 100)

  // KKB
  const kkb = config.kkb
  for (const [id, rule] of Object.entries(kkb.signals)) {
    if (rule.gradeCap !== 'none' && !LENDABLE_GRADES.includes(rule.gradeCap)) c.add(`kkb.signals.${id}.gradeCap`, 'Geçerli bir not seçin.')
  }
  c.range('kkb.signals.overdue.minDays', kkb.signals.overdue.minDays, 1, 365, { integer: true })
  c.range('kkb.signals.overdue.windowMonths', kkb.signals.overdue.windowMonths, 1, 24, { integer: true })
  c.range('kkb.signals.inquiries.windowMonths', kkb.signals.inquiries.windowMonths, 1, 12, { integer: true })
  c.range('kkb.signals.inquiries.minCount', kkb.signals.inquiries.minCount, 1, 100, { integer: true })
  c.range('kkb.signals.riskGrowth.lookbackMonths', kkb.signals.riskGrowth.lookbackMonths, 1, 23, { integer: true })
  c.range('kkb.signals.riskGrowth.minGrowth', kkb.signals.riskGrowth.minGrowth, 0, 10, { exclusiveMin: true })
  c.range('kkb.signals.mizanMismatch.maxDeviation', kkb.signals.mizanMismatch.maxDeviation, 0, 10, { exclusiveMin: true })
  c.range('kkb.signals.lowFindeks.maxScore', kkb.signals.lowFindeks.maxScore, 1, 1900, { integer: true })
  c.range('kkb.limit.deductionRate', kkb.limit.deductionRate, 0, 1)
  const typeList = (path: string, list: unknown) => {
    if (!Array.isArray(list) || list.length === 0) c.add(path, 'En az bir kredi türü seçin.')
    else if (list.some((t) => !KKB_CREDIT_TYPES.includes(t))) c.add(path, 'Tanımsız kredi türü.')
  }
  typeList('kkb.limit.workingCapitalTypes', kkb.limit.workingCapitalTypes)
  typeList('kkb.debtService.termTypes', kkb.debtService.termTypes)
  if (kkb.limit.workingCapitalTypes.some((t) => kkb.debtService.termTypes.includes(t))) {
    c.add('kkb.debtService.termTypes', 'Bir kredi türü hem işletme sermayesi hem vadeli kredi sayılamaz.')
  }
  c.range('kkb.findeks.weight', kkb.findeks.weight, 0, 0.5)
  c.curve('kkb.findeks.breakpoints', kkb.findeks.breakpoints)
  kkb.findeks.breakpoints.forEach((p, i) => c.range(`kkb.findeks.breakpoints.${i}.value`, p.value, 1, 1900))

  // Limit
  const lim = config.limit
  c.range('limit.k1.multiplier', lim.k1.multiplier, 0, 10, { exclusiveMin: true })
  c.range('limit.k1.minDays', lim.k1.minDays, 0, 365)
  c.range('limit.k2.equityMultiplier', lim.k2.equityMultiplier, 0, 10, { exclusiveMin: true })
  c.range('limit.k3.ebitdaRatio', lim.k3.ebitdaRatio, 0, 1, { exclusiveMin: true })
  c.range('limit.k3.multiplier', lim.k3.multiplier, 0, 10, { exclusiveMin: true })
  c.range('limit.roundingUnit', lim.roundingUnit, 1_000, 10_000_000)
  CREDIT_GRADES.forEach((g, i) => {
    const path = `limit.gradeMultiplier.${g}`
    c.range(path, lim.gradeMultiplier[g], 0, 1)
    if (i > 0 && lim.gradeMultiplier[g] > lim.gradeMultiplier[CREDIT_GRADES[i - 1]]) {
      c.add(path, `${CREDIT_GRADES[i - 1]} çarpanından büyük olamaz.`)
    }
  })

  // Teminat, vade, fiyatlama
  const t = config.terms
  LENDABLE_GRADES.forEach((g, i) => {
    c.range(`terms.collateralRatio.${g}`, t.collateralRatio[g], 0, 3)
    if (i > 0 && t.collateralRatio[g] < t.collateralRatio[LENDABLE_GRADES[i - 1]]) {
      c.add(`terms.collateralRatio.${g}`, `${LENDABLE_GRADES[i - 1]} oranından küçük olamaz.`)
    }
    c.range(`terms.tenor.${g}.months`, t.tenor[g].months, 1, 120, { integer: true })
    c.range(`terms.pricing.spreadBp.${g}`, t.pricing.spreadBp[g], 0, 5000)
    if (i > 0 && t.pricing.spreadBp[g] < t.pricing.spreadBp[LENDABLE_GRADES[i - 1]]) {
      c.add(`terms.pricing.spreadBp.${g}`, `${LENDABLE_GRADES[i - 1]} spread'inden küçük olamaz.`)
    }
  })
  if (!LENDABLE_GRADES.includes(t.mortgageRequiredFrom) || gradeRank(t.mortgageRequiredFrom) < 0) {
    c.add('terms.mortgageRequiredFrom', 'Geçerli bir not seçin.')
  }
  c.range('terms.appraisalLtv', t.appraisalLtv, 0, 1, { exclusiveMin: true })
  if (!t.pricing.referenceRate.trim()) c.add('terms.pricing.referenceRate', 'Referans faiz adı boş olamaz.')
  c.mix('terms.defaultProductMix', t.defaultProductMix)

  // Sunum ve karar
  const bands = config.presentation.strengthBands
  c.range('presentation.strengthBands.strongMin', bands.strongMin, 0, 100)
  c.range('presentation.strengthBands.moderateMin', bands.moderateMin, 0, 100)
  if (bands.moderateMin >= bands.strongMin) c.add('presentation.strengthBands.moderateMin', '"Güçlü" alt sınırından küçük olmalı.')
  c.range('presentation.topFactorCount', config.presentation.topFactorCount, 1, 6, { integer: true })
  c.range('decision.revisionJustificationThreshold', config.decision.revisionJustificationThreshold, 0, 1)

  return c.issues
}
