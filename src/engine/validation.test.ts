import { describe, expect, it } from 'vitest'
import { FIRMS, getFirm } from '../data'
import { deepEqual, getIn, setIn } from '../lib/objectPath'
import { describePath, diffConfigs } from './configDiff'
import { evaluateFirm, scoreTrend } from './evaluate'
import { DEFAULT_MODEL_CONFIG, createDefaultModelConfig, type ModelConfig } from './modelConfig'
import { validateModelConfig } from './validation'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const paths = (c: ModelConfig) => validateModelConfig(c).map((i) => i.path)

describe('validateModelConfig', () => {
  it('v1.0 varsayılanları geçerli', () => {
    expect(validateModelConfig(cfg)).toEqual([])
  })

  it('toplamı %100 olmayan ağırlık grubu', () => {
    const c = createDefaultModelConfig()
    c.final.weights.alternative = 0.4
    const issue = validateModelConfig(c).find((i) => i.path === 'final.weights')
    expect(issue?.message).toContain('%90')
  })

  it('negatif ağırlık, sırası bozuk kırılım, aralık dışı puan', () => {
    const c = createDefaultModelConfig()
    c.sectors.stationery.indicators.posRevenue.weight = -0.1
    c.traditional.categories.liquidity.ratios.currentRatio.breakpoints[2].value = 0.9
    c.alternative.trend.breakpoints[0].score = 120
    const p = paths(c)
    expect(p).toContain('sectors.stationery.indicators.posRevenue')
    expect(p).toContain('traditional.categories.liquidity.ratios.currentRatio.breakpoints.2.value')
    expect(p).toContain('alternative.trend.breakpoints.0.score')
  })

  it('not eşikleri sıralı olmalı, çakışamaz', () => {
    const c = createDefaultModelConfig()
    c.rating.minScore.A = 80
    expect(paths(c)).toContain('rating.minScore.A')
  })

  it('sezon endeksi ortalaması 1,00; teminat ve spread nota göre artan; LTV (0,1]', () => {
    const c = createDefaultModelConfig()
    c.sectors.pharmacy.seasonality.profiles.standard.index[0] = 3
    c.terms.collateralRatio.BB = 0.5
    c.terms.pricing.spreadBp.A = 100
    c.terms.appraisalLtv = 1.2
    const p = paths(c)
    expect(p).toContain('sectors.pharmacy.seasonality.profiles.standard.index')
    expect(p).toContain('terms.collateralRatio.BB')
    expect(p).toContain('terms.pricing.spreadBp.A')
    expect(p).toContain('terms.appraisalLtv')
  })

  it('geçersiz sayı ve pozitif olması gereken parametreler', () => {
    const c = createDefaultModelConfig()
    c.limit.k2.equityMultiplier = NaN
    c.rating.pd.scale = 0
    c.sectors.logistics.cccMedianDays = 0
    const p = paths(c)
    expect(p).toEqual(expect.arrayContaining(['limit.k2.equityMultiplier', 'rating.pd.scale', 'sectors.logistics.cccMedianDays']))
  })
})

describe('diffConfigs / describePath', () => {
  it('fark yoksa boş; değişiklikleri eski → yeni listeler', () => {
    expect(diffConfigs(cfg, createDefaultModelConfig())).toEqual([])
    const c = createDefaultModelConfig()
    c.final.weights = { traditional: 0.7, alternative: 0.3 }
    c.sectors.stationery.indicators.posRevenue.breakpoints[1].score = 55
    const d = diffConfigs(cfg, c)
    expect(d.map((x) => [x.path, x.before, x.after])).toEqual([
      ['final.weights.traditional', 0.5, 0.7],
      ['final.weights.alternative', 0.5, 0.3],
      ['sectors.stationery.indicators.posRevenue.breakpoints.1.score', 50, 55],
    ])
    expect(d[2].label).toBe('Kırtasiye · POS ciro · kırılım · 2. nokta · puan')
  })

  it('okunabilir etiketler', () => {
    expect(describePath(cfg, 'traditional.categories.liquidity.weight')).toBe('Geleneksel · Likidite · ağırlık')
    expect(describePath(cfg, 'sectors.tourism.seasonality.profiles.winter.index.11')).toBe('Turizm Acentesi · sezon · Kış turizmi · endeks · Aralık')
    expect(describePath(cfg, 'terms.defaultProductMix.spot')).toBe('Teminat ve fiyatlama · Varsayılan ürün kırılımı · Spot kredi')
  })
})

describe('objectPath', () => {
  it('getIn / setIn değişmez güncelleme', () => {
    const c = createDefaultModelConfig()
    const next = setIn(c, 'traditional.categories.liquidity.ratios.currentRatio.breakpoints.0.score', 5)
    expect(getIn(next, 'traditional.categories.liquidity.ratios.currentRatio.breakpoints.0.score')).toBe(5)
    expect(c.traditional.categories.liquidity.ratios.currentRatio.breakpoints[0].score).toBe(0)
    expect(next.sectors).toBe(c.sectors)
    expect(Array.isArray(next.traditional.categories.liquidity.ratios.currentRatio.breakpoints)).toBe(true)
    expect(deepEqual(c, createDefaultModelConfig())).toBe(true)
    expect(deepEqual(c, next)).toBe(false)
  })
})

describe('scoreTrend', () => {
  it('12 nokta; son nokta güncel değerlendirme; oto galeri ve e-ticarette düşüş', () => {
    for (const f of FIRMS) {
      const t = scoreTrend(f, cfg, 12)
      expect(t).toHaveLength(12)
      expect(t[11].score).toBeCloseTo(evaluateFirm(f, cfg).score, 10)
    }
    const auto = scoreTrend(getFirm('kuzey-oto')!, cfg, 12)
    expect(auto[0].grade).toBe('AA')
    expect(auto[11].grade).toBe('BBB')
    const eco = scoreTrend(getFirm('mavi-sepet')!, cfg, 12)
    expect(eco[0].grade).toBe('A')
    expect(eco[11].grade).toBe('BBB')
  })
})
