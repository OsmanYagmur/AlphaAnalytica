/**
 * KKB risk raporları (simülasyon verisi). Gerçek bir KKB entegrasyonu yoktur;
 * banka adları anonimdir ("Banka A" …).
 *
 * Mizanla tutarlılık: mizan ayında (2025-12) işletme sermayesi kredilerinin
 * (rotatif, spot, kart) toplam nakdi riski 300 Banka Kredileri bakiyesine,
 * taksitli kredilerin riski 303 + 400 bakiyelerine karşılık gelir (±%2 raporlama
 * farkı). Taksitli kredilerin aylık anapara taksiti, firmanın beyan ettiği yıllık
 * kredi ödemelerinden türetilir; böylece KKB'den hesaplanan yıllık anapara
 * ödemesi beyanla uyumludur. Bilinçli istisnalar hikâyelerde belirtilmiştir.
 */

import type { KkbCreditType } from '../engine/modelConfig'
import type { KkbFacility, KkbReport, TraditionalInput } from '../engine/types'
import { DATA_MONTHS, FISCAL_YEAR, path, round } from './generators'

type Points = [number, number][]

interface WorkingCapitalLine {
  bank: string
  type: Extract<KkbCreditType, 'revolving' | 'spot' | 'card'>
  /** Mizan ayındaki işletme sermayesi riskinden payı (toplam 1). */
  share: number
  /** Dönemin en yüksek riskinde limit doluluğu. */
  util: number
}

interface TermLine {
  bank: string
  /** Aylık anapara taksitinden payı (toplam 1). */
  share: number
}

/** Pencere içinde açılmış yeni taksitli kredi. */
interface NewTermLine {
  bank: string
  principal: number
  openedAt: string
  installments: number
}

interface NonCashLine {
  bank: string
  limit: number
  risk: number
}

export interface KkbProfile {
  workingCapital: WorkingCapitalLine[]
  /** İşletme sermayesi riskinin aylık seyri (t = 0 … 23; t = 15 mizan ayı). */
  shape: Points
  /** Mizandaki 300 bakiyesine göre çarpan (varsayılan 1; tutarsızlık hikâyesi için > 1). */
  mizanFactor?: number
  term: TermLine[]
  newTerm?: NewTermLine[]
  nonCash?: NonCashLine[]
  findeks: Points
  /** Bir ayda sorgu olma olasılığı. */
  inquiryRate: number
  inquiries?: Record<string, number>
  delays?: { bank: string; type?: KkbCreditType; months: Record<string, number> }[]
  legalFollowUp?: { bank: string; from: string }
  bouncedCheques?: string[]
  protestedBills?: string[]
}

const MIZAN_MONTH = `${FISCAL_YEAR}-12`

function addMonths(ym: string, n: number): string {
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const ceilTo = (value: number, unit: number) => Math.ceil(value / unit) * unit

function balance(trad: TraditionalInput, code: string): number {
  return trad.trialBalance.filter((l) => l.code === code).reduce((a, l) => a + l.credit - l.debit, 0)
}

export function buildKkbReport(p: KkbProfile, trad: TraditionalInput, rand: () => number): KkbReport {
  const months = [...DATA_MONTHS]
  const mi = months.indexOf(MIZAN_MONTH)
  const n = months.length
  const zeros = () => months.map(() => 0)
  const jitter = (amp: number) => 1 + amp * (rand() * 2 - 1)
  const limitUnit = (v: number) => (v >= 100_000_000 ? 5_000_000 : v >= 10_000_000 ? 500_000 : 50_000)

  const shortTerm = balance(trad, '300')
  const longTerm = balance(trad, '303') + balance(trad, '400')
  const annualDebt = trad.supplement.annualDebtService
  const shape = path(...p.shape)
  const reportingGap = jitter(0.02)
  const wcAtMizan = shortTerm * (p.mizanFactor ?? 1) * reportingGap
  const facilities: KkbFacility[] = []

  const facility = (bank: string, type: KkbCreditType, partial: Partial<KkbFacility>): KkbFacility => ({
    bank,
    type,
    cashLimit: zeros(),
    cashRisk: zeros(),
    nonCashLimit: zeros(),
    nonCashRisk: zeros(),
    delayDays: zeros(),
    legalFollowUpFrom: null,
    maturity: null,
    ...partial,
  })

  // İşletme sermayesi kredileri (rotatif, spot, kart)
  for (const line of p.workingCapital) {
    const risk = months.map((_, t) => round(wcAtMizan * line.share * (shape(t) / shape(mi)) * (t === mi ? 1 : jitter(0.04)), 2))
    const limit = ceilTo(Math.max(...risk) / line.util, limitUnit(Math.max(...risk)))
    facilities.push(facility(line.bank, line.type, { cashRisk: risk, cashLimit: months.map(() => limit) }))
  }

  // Taksitli krediler: eşit anapara taksitli; mizan ayındaki risk ≈ 303 + 400
  const monthly = annualDebt / 12
  if (longTerm > 0 && monthly > 0) {
    const remainingAtMizan = Math.max(1, Math.round(longTerm / monthly))
    const maturity = addMonths(MIZAN_MONTH, remainingAtMizan)
    for (const line of p.term) {
      const m = monthly * line.share
      const risk = months.map((_, t) => round(m * Math.max(0, remainingAtMizan - (t - mi)), 2))
      const original = ceilTo(risk[0], 1_000)
      facilities.push(facility(line.bank, 'installment', { cashRisk: risk, cashLimit: months.map(() => original), maturity }))
    }
  }
  for (const line of p.newTerm ?? []) {
    const open = months.indexOf(line.openedAt)
    const m = line.principal / line.installments
    const risk = months.map((_, t) => (t < open ? 0 : round(m * Math.max(0, line.installments - (t - open)), 2)))
    const limit = months.map((_, t) => (t < open ? 0 : line.principal))
    facilities.push(facility(line.bank, 'installment', { cashRisk: risk, cashLimit: limit, maturity: addMonths(line.openedAt, line.installments) }))
  }

  // Gayrinakdi (teminat mektubu)
  for (const line of p.nonCash ?? []) {
    const risk = months.map(() => round(Math.min(line.limit, line.risk * jitter(0.05)), 2))
    facilities.push(facility(line.bank, 'nonCash', { nonCashLimit: months.map(() => line.limit), nonCashRisk: risk }))
  }

  // Gecikmeler ve yasal takip ilgili bankanın ilk (veya belirtilen türdeki) kredisine işlenir
  const facilityOf = (bank: string, type?: KkbCreditType) =>
    facilities.find((f) => f.bank === bank && (type === undefined || f.type === type)) ?? facilities.find((f) => f.bank === bank)
  for (const d of p.delays ?? []) {
    const f = facilityOf(d.bank, d.type)
    if (!f) throw new Error(`KKB gecikmesi için kredi yok: ${d.bank}`)
    for (const [month, days] of Object.entries(d.months)) f.delayDays[months.indexOf(month)] = days
  }
  if (p.legalFollowUp) {
    const f = facilityOf(p.legalFollowUp.bank)
    if (!f) throw new Error(`Yasal takip için kredi yok: ${p.legalFollowUp.bank}`)
    f.legalFollowUpFrom = p.legalFollowUp.from
  }

  const findeksPath = path(...p.findeks)
  return {
    months,
    mizanMonth: MIZAN_MONTH,
    facilities,
    inquiries: months.map((m) => p.inquiries?.[m] ?? (rand() < p.inquiryRate ? (rand() < 0.3 ? 2 : 1) : 0)),
    findeks: Array.from({ length: n }, (_, t) => Math.min(1900, Math.max(1, Math.round(findeksPath(t) + 8 * (rand() * 2 - 1))))),
    bouncedCheques: [...(p.bouncedCheques ?? [])],
    protestedBills: [...(p.protestedBills ?? [])],
  }
}

/**
 * Firma bazında KKB profilleri. t indeksleri: 0 = Eyl 24, 15 = Ara 25 (mizan),
 * 17 = Şub 26, 19 = Nis 26, 23 = Ağu 26.
 */
export const KKB_PROFILES: Record<string, KkbProfile> = {
  // Okul sezonu öncesi (ağustos) stok finansmanı artıyor
  'defne-kirtasiye': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.55, util: 0.85 },
      { bank: 'Banka C', type: 'spot', share: 0.35, util: 0.9 },
      { bank: 'Banka E', type: 'card', share: 0.1, util: 0.7 },
    ],
    shape: [[0, 0.95], [11, 1.2], [12, 1.1], [15, 1], [18, 0.9], [21, 0.95], [23, 1.15]],
    term: [{ bank: 'Banka A', share: 0.6 }, { bank: 'Banka C', share: 0.4 }],
    findeks: [[0, 1290], [23, 1330]],
    inquiryRate: 0.25,
  },
  // Stok finansmanı son altı ayda hızla büyüyor (toplam riskte hızlı artış)
  'kuzey-oto': {
    workingCapital: [
      { bank: 'Banka B', type: 'revolving', share: 0.6, util: 0.9 },
      { bank: 'Banka D', type: 'spot', share: 0.3, util: 0.85 },
      { bank: 'Banka F', type: 'card', share: 0.1, util: 0.6 },
    ],
    shape: [[0, 0.9], [15, 1], [17, 1], [20, 1.3], [23, 1.75]],
    term: [{ bank: 'Banka B', share: 1 }],
    findeks: [[0, 1480], [17, 1470], [23, 1400]],
    inquiryRate: 0.35,
    inquiries: { '2026-06': 2, '2026-07': 2, '2026-08': 1 },
  },
  // Kış turizmi: sezon öncesi (ekim–aralık) otel ön ödemeleri için borçlanma
  'palandoken-turizm': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.7, util: 0.8 },
      { bank: 'Banka D', type: 'spot', share: 0.3, util: 0.9 },
    ],
    shape: [[0, 0.5], [1, 0.8], [3, 1.05], [6, 0.6], [9, 0.35], [12, 0.5], [13, 0.85], [15, 1], [18, 0.55], [21, 0.35], [23, 0.45]],
    term: [{ bank: 'Banka A', share: 1 }],
    findeks: [[0, 1540], [23, 1575]],
    inquiryRate: 0.2,
  },
  // Kampanya dönemi (kasım–aralık) borçlanması şubatta kapanıyor; onay sonrası yeni taksitli kredi
  'mavi-sepet': {
    workingCapital: [
      { bank: 'Banka B', type: 'revolving', share: 0.5, util: 0.85 },
      { bank: 'Banka C', type: 'spot', share: 0.35, util: 0.9 },
      { bank: 'Banka E', type: 'card', share: 0.15, util: 0.75 },
    ],
    shape: [[0, 0.7], [2, 0.9], [3, 1], [5, 0.6], [13, 0.8], [14, 1.05], [15, 1], [16, 0.7], [17, 0.55], [19, 0.7], [21, 0.8], [23, 0.86]],
    term: [{ bank: 'Banka B', share: 1 }],
    newTerm: [{ bank: 'Banka D', principal: 900_000, openedAt: '2026-04', installments: 24 }],
    findeks: [[0, 1510], [17, 1500], [23, 1395]],
    inquiryRate: 0.3,
    inquiries: { '2026-03': 2, '2026-04': 2 },
  },
  'cinaralti-restoran': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.6, util: 0.8 },
      { bank: 'Banka E', type: 'card', share: 0.4, util: 0.7 },
    ],
    shape: [[0, 0.9], [15, 1], [20, 0.9], [23, 0.82]],
    term: [{ bank: 'Banka A', share: 0.5 }, { bank: 'Banka C', share: 0.5 }],
    findeks: [[0, 1500], [23, 1520]],
    inquiryRate: 0.25,
  },
  // KKB'deki nakdi risk mizandaki banka kredilerinin belirgin üzerinde (beyan dışı borç)
  'anadolu-yapi': {
    workingCapital: [
      { bank: 'Banka B', type: 'revolving', share: 0.5, util: 0.9 },
      { bank: 'Banka C', type: 'spot', share: 0.3, util: 0.9 },
      { bank: 'Banka F', type: 'revolving', share: 0.2, util: 0.85 },
    ],
    shape: [[0, 0.85], [6, 1], [15, 1], [18, 0.95], [23, 1.05]],
    mizanFactor: 1.6,
    term: [{ bank: 'Banka B', share: 0.7 }, { bank: 'Banka C', share: 0.3 }],
    nonCash: [{ bank: 'Banka F', limit: 1_200_000, risk: 900_000 }],
    findeks: [[0, 1230], [23, 1180]],
    inquiryRate: 0.35,
    delays: [{ bank: 'Banka C', months: { '2026-02': 9, '2026-06': 7 } }],
  },
  // Red senaryosu: gecikmeler 180 güne ulaşmış, yasal takip, karşılıksız çek ve protesto
  'toros-yapi': {
    workingCapital: [
      { bank: 'Banka B', type: 'revolving', share: 0.5, util: 0.95 },
      { bank: 'Banka D', type: 'spot', share: 0.35, util: 0.95 },
      { bank: 'Banka A', type: 'card', share: 0.15, util: 0.9 },
    ],
    shape: [[0, 0.8], [15, 1], [23, 1.15]],
    term: [{ bank: 'Banka B', share: 0.6 }, { bank: 'Banka D', share: 0.4 }],
    nonCash: [{ bank: 'Banka A', limit: 800_000, risk: 800_000 }],
    findeks: [[0, 1050], [14, 900], [19, 700], [23, 620]],
    inquiryRate: 0.5,
    inquiries: { '2026-06': 4, '2026-07': 3, '2026-08': 3 },
    delays: [
      {
        bank: 'Banka B',
        type: 'revolving',
        months: {
          '2025-11': 15, '2025-12': 35, '2026-01': 62, '2026-02': 95, '2026-03': 124,
          '2026-04': 150, '2026-05': 180, '2026-06': 180, '2026-07': 180, '2026-08': 180,
        },
      },
      { bank: 'Banka D', type: 'spot', months: { '2026-05': 31, '2026-06': 44, '2026-07': 38 } },
    ],
    legalFollowUp: { bank: 'Banka B', from: '2026-04' },
    bouncedCheques: ['2025-10', '2026-02', '2026-05'],
    protestedBills: ['2026-01', '2026-06'],
  },
  // KKB hikâyesi: bilanço ve alternatif veri güçlü, ancak başka bir bankada 47 güne varan gecikme
  'denizli-dokuma': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.4, util: 0.85 },
      { bank: 'Banka C', type: 'revolving', share: 0.35, util: 0.95 },
      { bank: 'Banka E', type: 'spot', share: 0.25, util: 0.8 },
    ],
    shape: [[0, 0.9], [3, 1], [8, 0.95], [15, 1], [19, 1.1], [23, 1]],
    term: [{ bank: 'Banka A', share: 0.5 }, { bank: 'Banka E', share: 0.5 }],
    nonCash: [{ bank: 'Banka A', limit: 3_000_000, risk: 2_100_000 }],
    findeks: [[0, 1580], [18, 1590], [20, 1480], [23, 1310]],
    inquiryRate: 0.3,
    inquiries: { '2026-06': 3, '2026-07': 4, '2026-08': 3 },
    delays: [{ bank: 'Banka C', months: { '2026-03': 8, '2026-04': 22, '2026-05': 41, '2026-06': 47, '2026-07': 18 } }],
  },
  // Hasat dönemi (haziran–ekim) finansmanı
  'cukurova-tarim': {
    workingCapital: [
      { bank: 'Banka B', type: 'spot', share: 0.6, util: 0.9 },
      { bank: 'Banka D', type: 'revolving', share: 0.4, util: 0.85 },
    ],
    shape: [[0, 1.1], [1, 1.2], [4, 0.8], [9, 1.05], [12, 1.3], [15, 1], [19, 0.8], [21, 1.1], [23, 1.3]],
    term: [{ bank: 'Banka B', share: 1 }],
    nonCash: [{ bank: 'Banka D', limit: 800_000, risk: 500_000 }],
    findeks: [[0, 1420], [23, 1450]],
    inquiryRate: 0.25,
  },
  'marmara-lojistik': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.5, util: 0.8 },
      { bank: 'Banka C', type: 'revolving', share: 0.3, util: 0.8 },
      { bank: 'Banka F', type: 'card', share: 0.2, util: 0.6 },
    ],
    shape: [[0, 0.95], [15, 1], [18, 0.85], [23, 0.9]],
    term: [{ bank: 'Banka A', share: 0.6 }, { bank: 'Banka C', share: 0.4 }],
    nonCash: [{ bank: 'Banka A', limit: 2_500_000, risk: 1_600_000 }],
    findeks: [[0, 1750], [23, 1790]],
    inquiryRate: 0.15,
  },
  // SGK ödemeleri düzenli geldiği için yılbaşından sonra rotatif kullanım azalıyor
  'sifa-eczanesi': {
    workingCapital: [
      { bank: 'Banka B', type: 'revolving', share: 0.8, util: 0.85 },
      { bank: 'Banka E', type: 'card', share: 0.2, util: 0.6 },
    ],
    shape: [[0, 0.9], [15, 1], [17, 0.7], [20, 0.5], [23, 0.6]],
    term: [],
    findeks: [[0, 1620], [23, 1660]],
    inquiryRate: 0.15,
  },
  // Erken rezervasyon tahsilatlarıyla yılbaşı sonrası borç azalıyor, sezon öncesi yeniden artıyor
  'bodrum-mavi-tur': {
    workingCapital: [
      { bank: 'Banka A', type: 'spot', share: 0.6, util: 0.9 },
      { bank: 'Banka D', type: 'revolving', share: 0.4, util: 0.85 },
    ],
    shape: [[0, 0.8], [6, 0.5], [12, 0.6], [15, 1], [18, 0.5], [21, 0.9], [23, 0.7]],
    term: [{ bank: 'Banka A', share: 1 }],
    findeks: [[0, 1390], [23, 1410]],
    inquiryRate: 0.25,
  },
  'karadeniz-nakliyat': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.6, util: 0.85 },
      { bank: 'Banka D', type: 'spot', share: 0.4, util: 0.9 },
    ],
    shape: [[0, 1], [15, 1], [23, 0.9]],
    term: [{ bank: 'Banka A', share: 0.5 }, { bank: 'Banka D', share: 0.5 }],
    nonCash: [{ bank: 'Banka D', limit: 1_000_000, risk: 600_000 }],
    findeks: [[0, 1330], [23, 1260]],
    inquiryRate: 0.2,
  },
  // Farklı bankalardan limit arayışı (yoğun sorgu), düşük Findeks, küçük gecikmeler
  'kapadokya-kafe': {
    workingCapital: [
      { bank: 'Banka C', type: 'revolving', share: 0.7, util: 0.95 },
      { bank: 'Banka E', type: 'card', share: 0.3, util: 0.9 },
    ],
    shape: [[0, 0.8], [15, 1], [19, 1.1], [23, 1.15]],
    term: [{ bank: 'Banka C', share: 1 }],
    findeks: [[0, 1180], [19, 1070], [23, 1020]],
    inquiryRate: 0.4,
    inquiries: { '2026-02': 3, '2026-03': 2, '2026-04': 3 },
    delays: [{ bank: 'Banka E', months: { '2026-03': 12, '2026-04': 16 } }],
    protestedBills: ['2026-03'],
  },
  'kuzeyhan-holding': {
    workingCapital: [
      { bank: 'Banka A', type: 'revolving', share: 0.25, util: 0.8 },
      { bank: 'Banka B', type: 'revolving', share: 0.2, util: 0.8 },
      { bank: 'Banka C', type: 'spot', share: 0.2, util: 0.85 },
      { bank: 'Banka D', type: 'spot', share: 0.15, util: 0.85 },
      { bank: 'Banka E', type: 'revolving', share: 0.1, util: 0.75 },
      { bank: 'Banka F', type: 'card', share: 0.1, util: 0.5 },
    ],
    shape: [[0, 0.8], [6, 0.7], [12, 0.9], [15, 1], [17, 0.75], [19, 0.58], [23, 0.8]],
    term: [{ bank: 'Banka A', share: 0.3 }, { bank: 'Banka B', share: 0.3 }, { bank: 'Banka D', share: 0.4 }],
    nonCash: [
      { bank: 'Banka A', limit: 150_000_000, risk: 105_000_000 },
      { bank: 'Banka C', limit: 100_000_000, risk: 65_000_000 },
    ],
    findeks: [[0, 1700], [23, 1730]],
    inquiryRate: 0.3,
  },
  'caglayan-holding': {
    workingCapital: [
      { bank: 'Banka A', type: 'spot', share: 0.3, util: 0.9 },
      { bank: 'Banka B', type: 'revolving', share: 0.25, util: 0.85 },
      { bank: 'Banka C', type: 'spot', share: 0.25, util: 0.9 },
      { bank: 'Banka E', type: 'revolving', share: 0.2, util: 0.8 },
    ],
    shape: [[0, 1.1], [3, 1], [8, 0.9], [11, 1.25], [15, 1], [18, 0.85], [21, 1.15], [23, 1.3]],
    term: [{ bank: 'Banka A', share: 0.4 }, { bank: 'Banka C', share: 0.3 }, { bank: 'Banka E', share: 0.3 }],
    nonCash: [{ bank: 'Banka B', limit: 120_000_000, risk: 80_000_000 }],
    findeks: [[0, 1400], [23, 1360]],
    inquiryRate: 0.3,
  },
}
