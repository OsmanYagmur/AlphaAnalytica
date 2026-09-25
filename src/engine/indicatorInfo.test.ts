import { describe, expect, it } from 'vitest'
import { diffConfigs } from './configDiff'
import { INDICATOR_TEXT_KEYS, describeIndicatorValue, withIndicatorTexts } from './indicatorInfo'
import { DEFAULT_MODEL_CONFIG, SECTOR_IDS, type AlternativeIndicatorConfig, type ModelConfig } from './modelConfig'
import { exportModelConfig, parseModelConfigJson } from './schema'

const allIndicators = SECTOR_IDS.flatMap((sectorId) =>
  Object.entries(DEFAULT_MODEL_CONFIG.sectors[sectorId].indicators as Record<string, AlternativeIndicatorConfig>).map(
    ([id, ind]) => [`${sectorId}.${id}`, ind] as const,
  ),
)

function withoutTexts(config: ModelConfig): ModelConfig {
  const copy = structuredClone(config)
  for (const sectorId of SECTOR_IDS) {
    for (const ind of Object.values(copy.sectors[sectorId].indicators as Record<string, Partial<AlternativeIndicatorConfig>>)) {
      delete ind.aciklama
      delete ind.birimAciklamasi
    }
  }
  return copy
}

describe('gösterge açıklamaları (v1.0)', () => {
  it('10 sektörün tüm göstergelerinde açıklama ve birim açıklaması var', () => {
    expect(allIndicators).toHaveLength(48)
    for (const [key, ind] of allIndicators) {
      expect(ind.aciklama.trim().length, key).toBeGreaterThan(20)
      expect(ind.birimAciklamasi.trim().length, key).toBeGreaterThan(10)
    }
  })

  it('açıklama tek cümledir; formül, ağırlık, eşik veya rakam içermez', () => {
    for (const [key, ind] of allIndicators) {
      const text = ind.aciklama
      expect(text.endsWith('.'), key).toBe(true)
      expect(text.slice(0, -1).includes('. '), key).toBe(false)
      expect(/[0-9%×=+/]/.test(text), key).toBe(false)
      expect(/ağırlık|katsayı|eşik|puanı \d/i.test(text), key).toBe(false)
    }
  })

  it('birim açıklaması ağırlık veya eşik içermez', () => {
    for (const [key, ind] of allIndicators) {
      expect(/ağırlık|katsayı|eşik|[×=]/i.test(ind.birimAciklamasi), key).toBe(false)
    }
  })
})

describe('describeIndicatorValue', () => {
  it('ölçüm yöntemine göre değerin ne olduğunu söyler', () => {
    expect(describeIndicatorValue({ kind: 'change', window: 3, lag: 12 })).toBe('Geçen yılın aynı dönemine göre değişim · son 3 ay')
    expect(describeIndicatorValue({ kind: 'change', window: 1, lag: 6 })).toBe('6 ay önceki döneme göre değişim · son ay')
    expect(describeIndicatorValue({ kind: 'mean', window: 3 })).toBe('Son 3 ayın ortalaması')
    expect(describeIndicatorValue({ kind: 'mean', window: 1 })).toBe('Son ayın değeri')
    expect(describeIndicatorValue({ kind: 'latest' })).toBe('Son durum')
    expect(describeIndicatorValue({ kind: 'projection', window: 6, horizon: 3 })).toBe('Son 6 ayın eğilimine göre 3 ay sonrası için beklenen değer')
    expect(describeIndicatorValue({ kind: 'periodChange', calendarMonths: [2, 8, 9] })).toBe('Şub, Ağu, Eyl dönemi · önceki yılın aynı dönemine göre değişim')
  })
})

describe('withIndicatorTexts', () => {
  it('eksiksiz konfigürasyonda aynı nesneyi döner', () => {
    expect(withIndicatorTexts(DEFAULT_MODEL_CONFIG)).toBe(DEFAULT_MODEL_CONFIG)
  })

  it('eski kayıtlarda eksik metinleri varsayılandan tamamlar, parametrelere dokunmaz', () => {
    const old = withoutTexts(DEFAULT_MODEL_CONFIG)
    old.sectors.stationery.indicators.posRevenue.weight = 0.25
    old.sectors.stationery.indicators.supplierPayment.weight = 0.2
    const filled = withIndicatorTexts(old)
    expect(filled.sectors.stationery.indicators.posRevenue.aciklama).toBe(DEFAULT_MODEL_CONFIG.sectors.stationery.indicators.posRevenue.aciklama)
    expect(filled.sectors.stationery.indicators.posRevenue.weight).toBe(0.25)
    for (const sectorId of SECTOR_IDS) {
      for (const ind of Object.values(filled.sectors[sectorId].indicators as Record<string, AlternativeIndicatorConfig>)) {
        for (const k of INDICATOR_TEXT_KEYS) expect(typeof ind[k]).toBe('string')
      }
    }
    // Girdi değiştirilmez
    expect('aciklama' in old.sectors.stationery.indicators.posRevenue).toBe(false)
  })

  it('açıklamalar eklenmeden önce dışa aktarılmış JSON içe aktarılabilir', () => {
    const text = exportModelConfig(withoutTexts(DEFAULT_MODEL_CONFIG), 'v1.3')
    const result = parseModelConfigJson(text)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config.sectors.buildingMaterials.indicators.publicTenders.birimAciklamasi).toBe('Aylık ortalama kazanılan kamu ihalesi sayısı.')
  })

  it('metin alanları sürüm farkında parametre değişikliği sayılmaz', () => {
    const edited = structuredClone(DEFAULT_MODEL_CONFIG)
    edited.sectors.logistics.indicators.tripCount.aciklama = 'Farklı bir açıklama.'
    expect(diffConfigs(DEFAULT_MODEL_CONFIG, edited)).toEqual([])
  })
})
