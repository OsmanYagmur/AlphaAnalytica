/**
 * Demo verisinin Model v1.0 çıktıları ve SPEC.md "DEMO VERİSİ" hikâyeleri.
 */

import { describe, expect, it } from 'vitest'
import { DATA_MONTHS, FIRMS, PENDING_FIRM_IDS, SEED_DECISIONS, getFirm, type Firm } from '../data'
import { deriveFinancialStatement } from './financials'
import { evaluateFirm, evaluateFirmAsOf } from './evaluate'
import { mizanDeviation } from './kkb'
import { computeLimit } from './limit'
import {
  DEFAULT_MODEL_CONFIG,
  LENDABLE_GRADES,
  SECTOR_IDS,
  createDefaultModelConfig,
  type AlternativeIndicatorConfig,
  type CreditGrade,
  type ModelConfig,
} from './modelConfig'
import { gradeFromScore, gradeRank, isWorseGrade } from './rating'
import { resolveSeasonProfile, computeSeasonalFit } from './seasonality'

const cfg = DEFAULT_MODEL_CONFIG as ModelConfig
const firm = (id: string): Firm => {
  const f = getFirm(id)
  if (!f) throw new Error(`Firma yok: ${id}`)
  return f
}
const evaluate = (id: string) => evaluateFirm(firm(id), cfg)

// ---------------------------------------------------------------------------
// Model v1.0 beklenen çıktılar
// ---------------------------------------------------------------------------

/** Model v1.0, KKB dahil (güncel veri). */
const EXPECTED: Record<string, { G: number; A: number; S: number; grade: CreditGrade; pd: number; limit: number }> = {
  'defne-kirtasiye': { G: 50.12, A: 78.62, S: 64.37, grade: 'BBB', pd: 0.02149, limit: 1150000 },
  'kuzey-oto': { G: 82.42, A: 45.7, S: 64.06, grade: 'BBB', pd: 0.02222, limit: 900000 },
  'palandoken-turizm': { G: 76.86, A: 77.72, S: 77.29, grade: 'A', pd: 0.0052, limit: 650000 },
  'mavi-sepet': { G: 65.53, A: 66.12, S: 65.82, grade: 'BBB', pd: 0.01833, limit: 250000 },
  'cinaralti-restoran': { G: 73.73, A: 78.15, S: 75.94, grade: 'A', pd: 0.00603, limit: 500000 },
  'anadolu-yapi': { G: 54.14, A: 56.04, S: 55.09, grade: 'BB', pd: 0.05799, limit: 750000 },
  'toros-yapi': { G: 11.62, A: 25.7, S: 18.66, grade: 'C', pd: 0.77895, limit: 0 },
  'denizli-dokuma': { G: 74.12, A: 77.89, S: 76, grade: 'BB', pd: 0.00599, limit: 2700000 },
  'cukurova-tarim': { G: 60.97, A: 74.01, S: 67.49, grade: 'BBB', pd: 0.01529, limit: 1700000 },
  'marmara-lojistik': { G: 93.98, A: 92.94, S: 93.46, grade: 'AAA', pd: 0.00087, limit: 2800000 },
  'sifa-eczanesi': { G: 80.35, A: 83.66, S: 82, grade: 'AA', pd: 0.00308, limit: 1300000 },
  'bodrum-mavi-tur': { G: 58.97, A: 73.91, S: 66.44, grade: 'BBB', pd: 0.01714, limit: 400000 },
  'karadeniz-nakliyat': { G: 88.76, A: 80.8, S: 84.78, grade: 'BB', pd: 0.00227, limit: 350000 },
  'kapadokya-kafe': { G: 46.22, A: 47.38, S: 46.8, grade: 'B', pd: 0.13392, limit: 0 },
  'kuzeyhan-holding': { G: 85.51, A: 87.16, S: 86.33, grade: 'AA', pd: 0.00191, limit: 755900000 },
  'caglayan-holding': { G: 54.42, A: 75.36, S: 64.89, grade: 'BBB', pd: 0.02031, limit: 115250000 },
}

/** KKB modülü öncesi (KKB verisi olmadan) not ve limit — R7 önce/sonra karşılaştırması. */
const EXPECTED_WITHOUT_KKB: Record<string, { grade: CreditGrade; limit: number }> = {
  'defne-kirtasiye': { grade: 'BBB', limit: 1150000 },
  'kuzey-oto': { grade: 'BBB', limit: 1550000 },
  'palandoken-turizm': { grade: 'A', limit: 650000 },
  'mavi-sepet': { grade: 'BBB', limit: 1700000 },
  'cinaralti-restoran': { grade: 'A', limit: 850000 },
  'anadolu-yapi': { grade: 'BB', limit: 750000 },
  'toros-yapi': { grade: 'C', limit: 0 },
  'denizli-dokuma': { grade: 'A', limit: 4350000 },
  'cukurova-tarim': { grade: 'BBB', limit: 1700000 },
  'marmara-lojistik': { grade: 'AAA', limit: 6950000 },
  'sifa-eczanesi': { grade: 'AA', limit: 2250000 },
  'bodrum-mavi-tur': { grade: 'BBB', limit: 800000 },
  'karadeniz-nakliyat': { grade: 'BB', limit: 1550000 },
  'kapadokya-kafe': { grade: 'B', limit: 150000 },
  'kuzeyhan-holding': { grade: 'AA', limit: 866200000 },
  'caglayan-holding': { grade: 'BBB', limit: 115250000 },
}

describe('Demo verisi bütünlüğü', () => {
  it('16 firma (14 KOBİ + 2 holding), benzersiz kimlik ve 10 haneli benzersiz VKN', () => {
    expect(FIRMS).toHaveLength(16)
    expect(FIRMS.filter((f) => f.segment === 'holding')).toHaveLength(2)
    expect(new Set(FIRMS.map((f) => f.id)).size).toBe(16)
    expect(new Set(FIRMS.map((f) => f.vkn)).size).toBe(16)
    FIRMS.forEach((f) => expect(f.vkn).toMatch(/^\d{10}$/))
  })

  it('her sektörden en az bir firma', () => {
    const sectors = new Set(FIRMS.map((f) => f.sectorId))
    SECTOR_IDS.forEach((s) => expect(sectors.has(s)).toBe(true))
  })

  it('gerçek marka/pazaryeri adı kullanılmaz', () => {
    const text = JSON.stringify(FIRMS.map((f) => f.name))
    expect(text).not.toMatch(/Trendyol|Hepsiburada|Amazon|Getir|Yemeksepeti|sahibinden|Google/i)
  })

  it.each(FIRMS.map((f) => [f.id, f] as const))('%s: künye, 24 aylık ciro ve tüm gösterge serileri', (_, f) => {
    expect(f.city.length).toBeGreaterThan(0)
    expect(f.foundedYear).toBeLessThan(2026)
    expect(f.employees).toBeGreaterThan(0)
    expect(f.alternative.months).toEqual(DATA_MONTHS)
    expect(f.alternative.revenue).toHaveLength(24)
    f.alternative.revenue.forEach((v) => expect(v).toBeGreaterThan(0))

    const indicators = Object.values(cfg.sectors[f.sectorId].indicators) as AlternativeIndicatorConfig[]
    for (const ind of indicators) {
      const keys = 'series' in ind.source ? [ind.source.series] : 'product' in ind.source ? ind.source.product : ind.source.ratio
      for (const key of keys) {
        if (key === 'revenue') continue
        expect(f.alternative.series[key], `${f.id}/${key}`).toHaveLength(24)
      }
    }
  })

  it.each(FIRMS.map((f) => [f.id, f] as const))('%s: mizan hesap kodlu, denk ve ciro serisiyle tutarlı', (_, f) => {
    const codes = f.traditional.trialBalance.map((l) => l.code)
    for (const code of ['100', '102', '120', '300', '320', '500', '600', '610', '780']) expect(codes).toContain(code)
    expect(codes.some((c) => c === '153' || c === '150')).toBe(true)
    expect(codes.some((c) => c === '621' || c === '622')).toBe(true)
    codes.forEach((c) => expect(c).toMatch(/^\d{3}$/))

    const s = deriveFinancialStatement(f.traditional.trialBalance, f.traditional.supplement)
    // Mizan kuruşu kuruşuna denk: borç ve alacak bakiye toplamları ile hareket toplamları eşit
    const kurus = (v: number) => Math.round(v * 100)
    const sum = (k: 'debit' | 'credit' | 'debitTotal' | 'creditTotal') => f.traditional.trialBalance.reduce((a, l) => a + kurus(l[k] ?? 0), 0)
    expect(sum('debit')).toBe(sum('credit'))
    expect(sum('debitTotal')).toBe(sum('creditTotal'))
    f.traditional.trialBalance.forEach((l) => {
      expect(kurus(l.debit) / 100).toBe(l.debit)
      expect(kurus(l.debitTotal!) - kurus(l.creditTotal!)).toBe(kurus(l.debit) - kurus(l.credit))
    })
    expect(Math.abs(s.totalAssets - s.totalLiabilities - s.equity)).toBeLessThan(0.01)
    // Mizan net satışı = 2025 aylık ciro toplamı
    const fy = f.alternative.revenue.filter((_, i) => DATA_MONTHS[i].startsWith(`${f.fiscalYear}-`))
    expect(Math.abs(s.netSales - fy.reduce((a, b) => a + b, 0))).toBeLessThan(0.02)
    expect(f.traditional.taxReturn.netSales).toBeGreaterThan(0)
  })
})

describe('Başlangıç karar durumları', () => {
  it('9 firma tahsis bekliyor (8 KOBİ + 1 holding), 7 karara bağlanmış; kümeler ayrık ve tüm firmaları kapsar', () => {
    expect(PENDING_FIRM_IDS).toHaveLength(9)
    expect(PENDING_FIRM_IDS.filter((id) => getFirm(id)!.segment !== 'holding')).toHaveLength(8)
    expect(SEED_DECISIONS).toHaveLength(7)
    const decided = SEED_DECISIONS.map((d) => d.firmId)
    expect(decided.filter((id) => PENDING_FIRM_IDS.includes(id))).toHaveLength(0)
    expect(new Set([...PENDING_FIRM_IDS, ...decided])).toEqual(new Set(FIRMS.map((f) => f.id)))
  })

  it('onay, revize onay ve red kararlarının hepsi var', () => {
    const statuses = new Set(SEED_DECISIONS.map((d) => d.status))
    expect(statuses).toEqual(new Set(['approved', 'revisedApproved', 'rejected']))
  })

  it.each(SEED_DECISIONS.map((d) => [d.firmId, d] as const))('%s: v1.0 ile, başvurudan sonra ve verinin son ayından sonra verilmiş', (_, d) => {
    const f = firm(d.firmId)
    expect(d.modelVersion).toBe('v1.0')
    expect(d.decidedAt.slice(0, 10) >= f.applicationDate).toBe(true)
    expect(d.dataAsOf < d.decidedAt.slice(0, 7)).toBe(true)
    expect(DATA_MONTHS).toContain(d.dataAsOf)
    expect(d.auditLog.length).toBeGreaterThan(0)
    if (d.status === 'revisedApproved') expect(d.revisedTerms).toBeDefined()
    if (d.status === 'rejected') expect(d.rejectionReason).toBeDefined()
  })

  it('revize kararlarda sistem önerisinden sapma %20’yi aşıyorsa gerekçe notu var', () => {
    for (const d of SEED_DECISIONS.filter((x) => x.status === 'revisedApproved')) {
      const system = evaluateFirmAsOf(firm(d.firmId), d.dataAsOf, cfg)
      const deviation = Math.abs(d.revisedTerms!.limit / system.limit.limit - 1)
      if (deviation > cfg.decision.revisionJustificationThreshold) expect(d.note.length).toBeGreaterThan(20)
      expect(system.grade).not.toBe('C')
    }
  })

  it('onaylanan firmaların karar anındaki sistem notu limit verilebilir', () => {
    for (const d of SEED_DECISIONS.filter((x) => x.status !== 'rejected')) {
      expect(evaluateFirmAsOf(firm(d.firmId), d.dataAsOf, cfg).limit.limit).toBeGreaterThan(0)
    }
  })
})

describe('Model v1.0 — firma bazında çıktılar', () => {
  it.each(Object.entries(EXPECTED))('%s', (id, exp) => {
    const e = evaluate(id)
    expect(e.traditional.score).toBeCloseTo(exp.G, 1)
    expect(e.alternative.score).toBeCloseTo(exp.A, 1)
    expect(e.score).toBeCloseTo(exp.S, 1)
    expect(e.grade).toBe(exp.grade)
    expect(e.pd).toBeCloseTo(exp.pd, 4)
    expect(e.limit.limit).toBe(exp.limit)
    expect(e.alternative.coverage).toBe(1)
  })

  it('hiçbir firmanın skoru not eşiğine 0,5 puandan yakın değil (sunumda kararlı sonuç)', () => {
    const thresholds = LENDABLE_GRADES.map((g) => cfg.rating.minScore[g])
    for (const f of FIRMS) {
      const s = evaluateFirm(f, cfg).score
      thresholds.forEach((t) => expect(Math.abs(s - t), f.id).toBeGreaterThanOrEqual(0.5))
    }
  })

  it('limit ve şartlar yalnızca C dışındaki notlarda üretilir; C dışı sıfır limit yalnızca diğer bankalar ihtiyacı tamamen karşılıyorsa', () => {
    for (const f of FIRMS) {
      const e = evaluateFirm(f, cfg)
      if (e.grade === 'C') {
        expect(e.limit.limit).toBe(0)
        expect(e.terms).toBeNull()
      } else if (e.limit.limit === 0) {
        expect(e.limit.binding, f.id).toBe('k1')
        expect(e.limit.otherBankDeduction, f.id).toBeGreaterThanOrEqual(e.limit.k1Gross)
      } else {
        expect(e.terms?.products.reduce((a, p) => a + p.amount, 0)).toBe(e.limit.limit)
      }
    }
  })

  it.each(Object.entries(EXPECTED_WITHOUT_KKB))('KKB öncesi: %s', (id, exp) => {
    const e = evaluateFirm({ ...firm(id), kkb: undefined }, cfg)
    expect(e.grade).toBe(exp.grade)
    expect(e.limit.limit).toBe(exp.limit)
    expect(e.kkb).toBeNull()
  })

  it('KKB notları yalnızca KKB hikâyesi olan firmada değiştirir; skorlar aynı kalır (Findeks varsayılan olarak skora dahil değil)', () => {
    for (const f of FIRMS) {
      const withKkb = evaluateFirm(f, cfg)
      const without = evaluateFirm({ ...f, kkb: undefined }, cfg)
      expect(withKkb.score).toBe(without.score)
      if (f.id !== 'denizli-dokuma') expect(withKkb.grade, f.id).toBe(without.grade)
    }
  })
})

describe('Hikâye 1 — Kırtasiye: zayıf bilanço, güçlü alternatif veri', () => {
  const e = evaluate('defne-kirtasiye')

  it('G ≈ 52 (zayıf), A ≈ 78 (güçlü)', () => {
    expect(e.traditional.score).toBeGreaterThan(48)
    expect(e.traditional.score).toBeLessThan(55)
    expect(e.alternative.score).toBeGreaterThan(75)
    expect(e.alternative.score).toBeLessThan(81)
  })

  it('yalnız geleneksel skorla BBB altında kalıp reddedilecek firma sistemde BBB alıyor', () => {
    expect(isWorseGrade(gradeFromScore(e.traditional.score, cfg), 'BBB')).toBe(true)
    expect(e.grade).toBe('BBB')
    expect(e.limit.limit).toBeGreaterThan(0)
    expect(e.earlyWarnings.critical).toHaveLength(0)
  })

  it('eylül piki ve şubat ikinci piki sezonsallık nedeniyle cezalandırılmıyor', () => {
    expect(e.alternative.su).toBeGreaterThan(90)
  })

  it('sunum son adımı: alternatif ağırlığı %30’a inince not BB’ye düşer, limit azalır', () => {
    const c = createDefaultModelConfig()
    c.final.weights = { traditional: 0.7, alternative: 0.3 }
    const low = evaluateFirm(firm('defne-kirtasiye'), c)
    expect(low.grade).toBe('BB')
    expect(low.limit.limit).toBeLessThan(e.limit.limit)
    expect(low.limit.limit).toBeGreaterThan(0)
  })
})

describe('Hikâye 2 — Oto galeri: güçlü bilanço, bozulan alternatif veri', () => {
  const e = evaluate('kuzey-oto')

  it('G ≈ 80, A ≈ 45', () => {
    expect(e.traditional.score).toBeGreaterThan(77)
    expect(e.traditional.score).toBeLessThan(85)
    expect(e.alternative.score).toBeGreaterThan(42)
    expect(e.alternative.score).toBeLessThan(49)
  })

  it('ilanda kalma süresi artıyor, satılan ilan ve ciro düşüyor', () => {
    const dom = firm('kuzey-oto').alternative.series.daysOnMarket!
    expect(dom[23]).toBeGreaterThan(dom[11] * 1.3)
    expect(e.alternative.indicators.soldListings.value!).toBeLessThan(0)
    expect(e.alternative.trend.annualGrowth).toBeLessThan(-0.1)
  })

  it('erken uyarı çıkıyor: izleme sinyalleri, zayıf gösterge olarak ilanda kalma süresi', () => {
    const watch = e.earlyWarnings.watch.map((s) => s.id)
    expect(watch).toEqual(expect.arrayContaining(['weakIndicator', 'negativeTrend', 'scoreDivergence']))
    const weak = e.earlyWarnings.watch.find((s) => s.id === 'weakIndicator')!
    expect(weak.indicators).toContain('daysOnMarket')
  })

  it('limit düşürülüyor: yalnız bilançoyla AA olacak firma BBB, limit belirgin düşük', () => {
    const traditionalGrade = gradeFromScore(e.traditional.score, cfg)
    expect(traditionalGrade).toBe('AA')
    expect(e.grade).toBe('BBB')
    const s = e.traditional.statement
    const traditionalOnly = computeLimit(
      {
        netSales: s.netSales,
        cashConversionCycle: e.traditional.ratios.cashConversionCycle,
        equity: s.equity,
        ebitda: s.ebitda,
        annualDebtService: s.annualDebtService,
      },
      traditionalGrade,
      'autoDealer',
      cfg,
    ).limit
    expect(e.limit.limit).toBeLessThan(traditionalOnly * 0.8)
  })
})

describe('Hikâye 3 — Kış turizmi: yaz düşüşü cezalandırılmıyor', () => {
  const f = firm('palandoken-turizm')
  const e = evaluate('palandoken-turizm')

  it('kış alt profili kullanılıyor ve yaz aylarında ciro yıllık ortalamanın belirgin altında', () => {
    expect(e.alternative.seasonProfile.id).toBe('winter')
    const last12 = f.alternative.revenue.slice(12)
    const avg = last12.reduce((a, b) => a + b, 0) / 12
    const summer = ['2026-06', '2026-07', '2026-08'].map((m) => f.alternative.revenue[DATA_MONTHS.indexOf(m)])
    summer.forEach((v) => expect(v).toBeLessThan(avg * 0.6))
  })

  it('sezon uyumu yüksek; yaz profiliyle değerlendirilseydi ağır cezalandırılırdı', () => {
    expect(e.alternative.su).toBeGreaterThan(90)
    const summerIdx = resolveSeasonProfile(cfg, 'tourism', 'summer').index
    const wrong = computeSeasonalFit(f.alternative.months, f.alternative.revenue, summerIdx, cfg)
    expect(wrong.score).toBeLessThan(20)
    const asSummer = evaluateFirm({ ...f, alternative: { ...f.alternative, seasonProfile: 'summer' } }, cfg)
    expect(gradeRank(asSummer.grade)).toBeGreaterThan(gradeRank(e.grade))
  })

  it('düşük yaz cirosu erken uyarı üretmiyor', () => {
    expect(e.earlyWarnings.critical).toHaveLength(0)
    expect(e.earlyWarnings.watch.map((s) => s.id)).not.toContain('negativeTrend')
    expect(e.grade).toBe('A')
  })
})

describe('Hikâye 4 — E-ticaret: yorum puanı düşüyor, iade oranı artıyor, not bir kademe düşüyor', () => {
  const f = firm('mavi-sepet')
  const decision = SEED_DECISIONS.find((d) => d.firmId === 'mavi-sepet')!
  const then = evaluateFirmAsOf(f, decision.dataAsOf, cfg)
  const now = evaluate('mavi-sepet')

  it('son 6 ayda yorum puanı düşüyor, iade ve olumsuz yorum oranı artıyor', () => {
    const s = f.alternative.series
    expect(s.reviewRating![23]).toBeLessThan(s.reviewRating![17] - 0.4)
    expect(s.returnRate![23]).toBeGreaterThan(s.returnRate![17] * 2)
    expect(s.negativeReviewRatio![23]).toBeGreaterThan(s.negativeReviewRatio![17] * 2)
  })

  it('karar anında A olan not bugün bir kademe düşerek BBB', () => {
    expect(then.grade).toBe('A')
    expect(now.grade).toBe('BBB')
    expect(gradeRank(now.grade) - gradeRank(then.grade)).toBe(1)
  })

  it('düşüş alternatif veriden geliyor; zayıf göstergeler izleme listesinde', () => {
    expect(now.traditional.score).toBeCloseTo(then.traditional.score, 10)
    expect(now.alternative.score).toBeLessThan(then.alternative.score - 10)
    const weak = now.earlyWarnings.watch.find((s) => s.id === 'weakIndicator')!
    expect(weak.indicators).toContain('reviewRating')
  })
})

describe('Hikâye 5 — Not dağılımı uçları', () => {
  it('en az bir firma C alıyor (red senaryosu): limit yok, kritik sinyaller var', () => {
    const c = FIRMS.filter((f) => evaluateFirm(f, cfg).grade === 'C')
    expect(c.length).toBeGreaterThanOrEqual(1)
    const toros = evaluate('toros-yapi')
    expect(toros.grade).toBe('C')
    expect(toros.earlyWarnings.critical.map((s) => s.id)).toEqual(
      expect.arrayContaining(['declarationInconsistency', 'bouncedCheque']),
    )
    expect(toros.traditional.ratios.salesDeviation).toBeGreaterThan(0.2)
  })

  it('en az bir firma AAA veya AA alıyor', () => {
    const top = FIRMS.filter((f) => ['AAA', 'AA'].includes(evaluateFirm(f, cfg).grade))
    expect(top.length).toBeGreaterThanOrEqual(1)
    expect(evaluate('marmara-lojistik').grade).toBe('AAA')
  })

  it('erken uyarı override: skoru AA olan nakliyat firması vergi/SGK borcu nedeniyle BB', () => {
    const e = evaluate('karadeniz-nakliyat')
    expect(e.baseGrade).toBe('AA')
    expect(e.grade).toBe('BB')
    expect(e.override.capped).toBe(true)
    expect(e.earlyWarnings.critical.map((s) => s.id)).toEqual(['taxOrSgkDebt'])
    expect(firm('karadeniz-nakliyat').traditional.trialBalance.map((l) => l.code)).toContain('368')
  })

  it('bekleyen başvurular farklı notlara dağılıyor', () => {
    const grades = new Set(PENDING_FIRM_IDS.map((id) => evaluate(id).grade))
    expect(grades.size).toBeGreaterThanOrEqual(4)
  })
})

describe('Hikâye 6 — Holding ölçeği', () => {
  it('iki holding milyar TL ölçeğinde ciro ve grup şirketi bilgisiyle', () => {
    for (const id of ['kuzeyhan-holding', 'caglayan-holding']) {
      const f = firm(id)
      expect(f.segment).toBe('holding')
      expect(f.groupCompanies).toBeGreaterThan(1)
      expect(f.employees).toBeGreaterThanOrEqual(250)
      expect(evaluate(id).traditional.statement.netSales).toBeGreaterThan(1_000_000_000)
    }
  })

  it('KOBİ firmalarının ölçeği çalışan sayısından türetilir', () => {
    expect(firm('sifa-eczanesi').segment).toBe('micro')
    expect(firm('defne-kirtasiye').segment).toBe('small')
    expect(firm('denizli-dokuma').segment).toBe('medium')
  })

  it('güçlü holding AA ve karara bağlanmış; kaldıraçlı holding BBB, talebin altında limit', () => {
    const strong = evaluate('kuzeyhan-holding')
    expect(strong.grade).toBe('AA')
    expect(SEED_DECISIONS.find((d) => d.firmId === 'kuzeyhan-holding')?.status).toBe('approved')
    const leveraged = evaluate('caglayan-holding')
    expect(leveraged.grade).toBe('BBB')
    expect(PENDING_FIRM_IDS).toContain('caglayan-holding')
    expect(isWorseGrade(gradeFromScore(leveraged.traditional.score, cfg), 'BBB')).toBe(true)
    expect(leveraged.limit.limit).toBeLessThan(firm('caglayan-holding').requestedAmount)
    expect(leveraged.limit.binding).toBe('k3')
  })
})

describe('Hikâye 7 — KKB: bilançosu iyi görünen firmada başka bankada gecikme', () => {
  const e = evaluate('denizli-dokuma')
  const without = evaluateFirm({ ...firm('denizli-dokuma'), kkb: undefined }, cfg)

  it('bilanço ve alternatif veri güçlü; skor A seviyesinde', () => {
    expect(e.traditional.score).toBeGreaterThan(70)
    expect(e.alternative.score).toBeGreaterThan(70)
    expect(e.baseGrade).toBe('A')
  })

  it('KKB’de başka bir bankada 30 günü aşan gecikme var; not BB ile sınırlanıyor', () => {
    const k = e.kkb!.snapshot
    const bankC = k.banks.find((b) => b.bank === 'Banka C')!
    expect(bankC.maxDelayDays12m).toBeGreaterThanOrEqual(cfg.kkb.signals.overdue.minDays)
    expect(e.earlyWarnings.critical).toEqual([expect.objectContaining({ id: 'overdue', source: 'kkb', gradeCap: 'BB' })])
    expect(e.grade).toBe('BB')
    expect(e.limit.limit).toBeLessThan(without.limit.limit)
  })

  it('son üç ayda yoğun kredi sorgusu ve düşen Findeks notu eşlik ediyor', () => {
    expect(e.earlyWarnings.watch.map((w) => w.id)).toContain('inquiries')
    const f = firm('denizli-dokuma').kkb.findeks
    expect(f[f.length - 1]).toBeLessThan(f[f.length - 7] - 150)
  })

  it('hangi sinyalin not tavanı uygulayacağı konfigüre edilebilir', () => {
    const c = createDefaultModelConfig()
    c.kkb.signals.overdue.gradeCap = 'none'
    const relaxed = evaluateFirm(firm('denizli-dokuma'), c)
    expect(relaxed.grade).toBe('A')
    expect(relaxed.earlyWarnings.watch.map((w) => w.id)).toContain('overdue')
  })
})

describe('KKB verisi ve motor kuralları', () => {
  it('24 aylık seriler, anonim banka adları, limitler riskin altında değil', () => {
    for (const f of FIRMS) {
      expect(f.kkb.months).toEqual(DATA_MONTHS)
      expect(f.kkb.findeks).toHaveLength(24)
      for (const fac of f.kkb.facilities) {
        expect(fac.bank).toMatch(/^Banka [A-Z]$/)
        fac.cashRisk.forEach((r, i) => expect(r, `${f.id} ${fac.bank}`).toBeLessThanOrEqual(fac.cashLimit[i] + 1e-6))
        fac.nonCashRisk.forEach((r, i) => expect(r).toBeLessThanOrEqual(fac.nonCashLimit[i] + 1e-6))
      }
      f.kkb.findeks.forEach((v) => expect(v >= 1 && v <= 1900).toBe(true))
    }
  })

  it('mizan ayında KKB nakdi riski mizandaki banka kredileriyle (300 + 303 + 400) tutarlı; bilinçli istisna Anadolu Yapı', () => {
    for (const f of FIRMS) {
      const e = evaluateFirm(f, cfg)
      const dev = mizanDeviation(e.kkb!.snapshot, e.traditional.statement.financialDebt)!
      if (f.id === 'anadolu-yapi') {
        expect(dev).toBeGreaterThan(cfg.kkb.signals.mizanMismatch.maxDeviation)
        expect(e.earlyWarnings.watch.map((w) => w.id)).toContain('mizanMismatch')
      } else expect(dev, f.id).toBeLessThan(0.05)
    }
  })

  it('karşılıksız çek kaydı KKB ile firma bayrağı arasında tutarlı', () => {
    for (const f of FIRMS) expect(f.kkb.bouncedCheques.length > 0, f.id).toBe(f.riskFlags.bouncedCheque)
  })

  it('K3’teki yıllık kredi ödemeleri KKB’deki taksitli kredilerden türetilir ve beyanla uyumludur', () => {
    for (const f of FIRMS.filter((x) => !['toros-yapi', 'sifa-eczanesi', 'mavi-sepet'].includes(x.id))) {
      const e = evaluateFirm(f, cfg)
      expect(e.kkb!.debtServiceSource).toBe('kkb')
      expect(e.kkb!.snapshot.annualDebtService / f.traditional.supplement.annualDebtService, f.id).toBeCloseTo(1, 2)
    }
    // Onay sonrası başka bankadan yeni taksitli kredi: K3'teki ödeme yükü beyanın üzerine çıkar
    const mavi = firm('mavi-sepet')
    expect(evaluateFirmAsOf(mavi, '2026-02', cfg).kkb!.snapshot.annualDebtService / mavi.traditional.supplement.annualDebtService).toBeCloseTo(1, 2)
    expect(evaluate('mavi-sepet').kkb!.snapshot.annualDebtService).toBeGreaterThan(mavi.traditional.supplement.annualDebtService * 2)
    // Vadesine 12 aydan az kalan krediler: yalnız kalan taksitler
    const toros = evaluate('toros-yapi')
    expect(toros.kkb!.snapshot.annualDebtService).toBeLessThan(firm('toros-yapi').traditional.supplement.annualDebtService)
  })

  it('diğer bankalardaki işletme sermayesi riski K1’den düşülür; kapatılınca KKB öncesi limitlere dönülür', () => {
    const e = evaluate('marmara-lojistik')
    expect(e.limit.otherBankDeduction).toBeCloseTo(e.kkb!.snapshot.workingCapitalCashRisk, 6)
    expect(e.limit.k1).toBeCloseTo(e.limit.k1Gross - e.limit.otherBankDeduction, 6)
    const off = createDefaultModelConfig()
    off.kkb.limit.deductOtherBanks = false
    off.kkb.debtService.fromKkb = false
    for (const f of FIRMS.filter((x) => x.id !== 'denizli-dokuma')) {
      expect(evaluateFirm(f, off).limit.limit, f.id).toBe(EXPECTED_WITHOUT_KKB[f.id].limit)
    }
  })

  it('toplam riskte hızlı artış: stok finansmanı büyüyen oto galeri ve onay sonrası yeni kredi alan e-ticaret firması', () => {
    expect(evaluate('kuzey-oto').earlyWarnings.watch.map((w) => w.id)).toContain('riskGrowth')
    const mavi = firm('mavi-sepet')
    expect(evaluateFirmAsOf(mavi, '2026-02', cfg).kkb!.signals.map((s) => s.id)).not.toContain('riskGrowth')
    expect(evaluate('mavi-sepet').kkb!.signals.map((s) => s.id)).toContain('riskGrowth')
  })

  it('red senaryosu: yasal takip, 90+ gün gecikme, düşük Findeks', () => {
    const e = evaluate('toros-yapi')
    const ids = e.kkb!.signals.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['overdue', 'legalFollowUp', 'lowFindeks']))
    expect(e.kkb!.snapshot.banks.some((b) => b.followUp === 'legal')).toBe(true)
    expect(e.kkb!.snapshot.maxDelayDays).toBeGreaterThanOrEqual(90)
  })

  it('Findeks varsayılan olarak skora dahil değil; anahtar açılınca ağırlığıyla eklenir', () => {
    const on = createDefaultModelConfig()
    on.kkb.findeks.includeInScore = true
    for (const id of ['defne-kirtasiye', 'toros-yapi']) {
      const base = evaluate(id)
      const withF = evaluateFirm(firm(id), on)
      const w = on.kkb.findeks.weight
      expect(withF.score).toBeCloseTo((1 - w) * base.score + w * base.kkb!.findeksPoints, 9)
    }
  })
})
