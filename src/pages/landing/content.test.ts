import { describe, expect, it } from 'vitest'
import { FIRMS, PENDING_FIRM_IDS, SEED_DECISIONS } from '../../data'
import { FLOW_FIRM_ID, FLOW_STEPS, SCENARIOS, TEAM } from './content'

const TAB_SLUGS = ['geleneksel', 'alternatif', 'kkb', 'piyasa']

describe('tanıtım sayfası demo senaryoları', () => {
  it('her senaryo var olan bir firmaya ve rolüne uygun bir yola gider', () => {
    for (const s of SCENARIOS) {
      expect(FIRMS.some((f) => f.id === s.firmId), s.firmId).toBe(true)
      expect(s.path.startsWith(`/${s.role}/firma/${s.firmId}`), s.path).toBe(true)
      const tab = s.path.split('/')[4]
      if (tab !== undefined) expect(TAB_SLUGS, s.path).toContain(tab)
    }
  })

  it('tahsis senaryoları bekleyen başvurular, portföy senaryoları onaylanmış firmalar', () => {
    for (const s of SCENARIOS) {
      if (s.role === 'tahsis') expect(PENDING_FIRM_IDS, s.firmId).toContain(s.firmId)
      else expect(SEED_DECISIONS.find((d) => d.firmId === s.firmId)?.status, s.firmId).toMatch(/approved|revisedApproved/)
    }
  })

  it('ekip kayıtlarında ad, görev ve eğitim dolu', () => {
    for (const m of TEAM) {
      expect(m.name.trim()).not.toBe('')
      expect(m.role.trim()).not.toBe('')
      expect(m.education.trim()).not.toBe('')
    }
  })

  it('değerlendirme akışı var olan bir firmayı ve geçerli sekmeleri kullanır', () => {
    expect(PENDING_FIRM_IDS).toContain(FLOW_FIRM_ID)
    expect(FLOW_STEPS).toHaveLength(5)
    for (const step of FLOW_STEPS) expect(TAB_SLUGS, step.id).toContain(step.tab)
  })
})
