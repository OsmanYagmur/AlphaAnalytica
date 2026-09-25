import { beforeEach, describe, expect, it } from 'vitest'
import { evaluateFirm } from '../engine/evaluate'
import { DEFAULT_MODEL_CONFIG, SECTOR_IDS } from '../engine/modelConfig'
import { actions, getState } from '../store/appStore'
import { FIRMS } from './firms'
import { DEFAULT_MARKET_INTEL, isValidMarketIntel, negativeSignalCount } from './marketIntel'

const RESEARCH_DATE = '2026-09-25'

describe('piyasa istihbaratı verisi', () => {
  it('10 sektörün her birinde 3–5 madde ve kredi yorumu var', () => {
    for (const id of SECTOR_IDS) {
      const s = DEFAULT_MARKET_INTEL[id]
      expect(s.items.length, id).toBeGreaterThanOrEqual(3)
      expect(s.items.length, id).toBeLessThanOrEqual(5)
      expect(s.creditImplication.trim().length, id).toBeGreaterThan(40)
      expect(s.lastUpdated).toBe(RESEARCH_DATE)
    }
  })

  it('her madde: başlık, 1–2 cümle özet, etki yönü, kaynak, bağlantı ve son 3–6 aya ait tarih', () => {
    const ids = new Set<string>()
    for (const sectorId of SECTOR_IDS) {
      for (const item of DEFAULT_MARKET_INTEL[sectorId].items) {
        const key = `${sectorId}.${item.id}`
        expect(ids.has(item.id), key).toBe(false)
        ids.add(item.id)
        expect(item.title.trim().length, key).toBeGreaterThan(5)
        const sentences = item.summary.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/).length
        expect(sentences, key).toBeLessThanOrEqual(2)
        expect(['positive', 'neutral', 'negative']).toContain(item.impact)
        expect(item.source.trim().length, key).toBeGreaterThan(2)
        expect(item.sourceUrl, key).toMatch(/^https:\/\//)
        expect(item.date, key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        // Araştırma tarihinden en fazla ~6,5 ay önce ve sonrasında değil
        expect(item.date >= '2026-03-01' && item.date <= RESEARCH_DATE, key).toBe(true)
      }
    }
  })

  it('yapı doğrulaması ve olumsuz sinyal sayısı', () => {
    expect(isValidMarketIntel(DEFAULT_MARKET_INTEL, SECTOR_IDS)).toBe(true)
    expect(isValidMarketIntel({}, SECTOR_IDS)).toBe(false)
    const broken = structuredClone(DEFAULT_MARKET_INTEL)
    ;(broken.pharmacy.items[0] as { impact: string }).impact = 'çok kötü'
    expect(isValidMarketIntel(broken, SECTOR_IDS)).toBe(false)
    expect(negativeSignalCount(DEFAULT_MARKET_INTEL.autoDealer)).toBe(3)
  })
})

describe('Model Yöneticisi düzenlemeleri', () => {
  beforeEach(() => actions.resetDemo())

  it('madde eklenir, son güncelleme bugüne çekilir, denetim izine yazılır; araştırma verisine dönülebilir', () => {
    const intel = getState().marketIntel.pharmacy
    const added = { id: 'test', title: 'Test', summary: 'Deneme maddesi.', impact: 'negative' as const, source: 'Test', sourceUrl: '', date: '2026-09-24' }
    actions.saveSectorIntel('pharmacy', { ...intel, items: [...intel.items, added] }, 'Dr. Selin Aydın', 'Eczane: “Test” eklendi')
    const s = getState()
    expect(s.marketIntel.pharmacy.items).toHaveLength(intel.items.length + 1)
    expect(s.marketIntel.pharmacy.lastUpdated).not.toBe('')
    expect(s.modelLog.at(-1)!.action).toContain('Piyasa istihbaratı')
    // Diğer sektörler etkilenmez
    expect(s.marketIntel.stationery).toEqual(DEFAULT_MARKET_INTEL.stationery)

    actions.resetSectorIntel('pharmacy', 'Dr. Selin Aydın', 'Eczane')
    expect(getState().marketIntel.pharmacy).toEqual(DEFAULT_MARKET_INTEL.pharmacy)
  })

  it('içerik skoru etkilemez: istihbarat değişse de değerlendirme aynı kalır', () => {
    const before = FIRMS.map((f) => evaluateFirm(f, DEFAULT_MODEL_CONFIG))
    for (const id of SECTOR_IDS) {
      actions.saveSectorIntel(id, { ...getState().marketIntel[id], items: [] }, 'Test', 'temizlendi')
    }
    expect(FIRMS.map((f) => evaluateFirm(f, DEFAULT_MODEL_CONFIG))).toEqual(before)
  })
})
