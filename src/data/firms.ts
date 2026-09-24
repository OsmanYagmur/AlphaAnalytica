/**
 * 16 hayali firma (14 KOBİ + 2 holding). Adlar, VKN'ler ve tüm rakamlar hayalidir.
 * Mizan ve KVB 2025 mali yılına, aylık seriler Eylül 2024 – Ağustos 2026 dönemine aittir.
 */

import type { SeasonProfileId, SectorId } from '../engine/modelConfig'
import type { RiskFlags } from '../engine/types'
import {
  DATA_MONTHS,
  FISCAL_YEAR,
  buildFinancials,
  createRng,
  fiscalYearTotal,
  growth,
  path,
  round,
  sectorPattern,
  series,
  type FinancialProfile,
} from './generators'
import type { Firm, FirmSegment } from './types'

interface SeriesContext {
  rand: () => number
  /** Aylık ciro */
  revenue: number[]
  /** Firmanın sezon deseni */
  pattern: number[]
}

interface FirmDefinition {
  id: string
  name: string
  vkn: string
  city: string
  foundedYear: number
  employees: number
  /** Verilmezse çalışan sayısından (KOBİ sınıfları) türetilir. */
  segment?: FirmSegment
  groupCompanies?: number
  sectorId: SectorId
  seasonProfile?: SeasonProfileId
  requestedAmount: number
  applicationDate: string
  seed: number
  /** Aylık ciro seviyesi (sezon öncesi), t = 0 … 23 */
  revenueLevel: (t: number) => number
  revenueNoise: number
  financial: FinancialProfile
  riskFlags?: Partial<RiskFlags>
  series: (ctx: SeriesContext) => Record<string, number[]>
}

/** KOBİ tanımındaki çalışan sınıfları: <10 mikro, <50 küçük, <250 orta. */
function segmentFromEmployees(employees: number): FirmSegment {
  if (employees < 10) return 'micro'
  if (employees < 50) return 'small'
  if (employees < 250) return 'medium'
  return 'large'
}

function defineFirm(def: FirmDefinition): Firm {
  const rand = createRng(def.seed)
  const pattern = sectorPattern(def.sectorId, def.seasonProfile)
  const revenue = series(rand, def.revenueLevel, { noise: def.revenueNoise, pattern, digits: 2 })
  // Mizan için ayrı tohum: alternatif veri serilerini etkilemez
  const traditional = buildFinancials(fiscalYearTotal(revenue), def.financial, createRng(def.seed * 7919 + 17))
  return {
    id: def.id,
    name: def.name,
    vkn: def.vkn,
    city: def.city,
    foundedYear: def.foundedYear,
    employees: def.employees,
    segment: def.segment ?? segmentFromEmployees(def.employees),
    ...(def.groupCompanies ? { groupCompanies: def.groupCompanies } : {}),
    fiscalYear: FISCAL_YEAR,
    requestedAmount: def.requestedAmount,
    applicationDate: def.applicationDate,
    sectorId: def.sectorId,
    traditional,
    alternative: {
      months: [...DATA_MONTHS],
      revenue,
      series: def.series({ rand, revenue, pattern }),
      ...(def.seasonProfile ? { seasonProfile: def.seasonProfile } : {}),
    },
    riskFlags: { bouncedCheque: false, taxOrSgkDebt: false, ...def.riskFlags },
  }
}

/** Ortalama bir KOBİ bilanço profili; firmalar bunun üzerinden sapar. */
const BASE: FinancialProfile = {
  returnRate: 0.02,
  cogsRatio: 0.7,
  opexRatio: 0.18,
  depreciationRatio: 0.02,
  financeExpenseRatio: 0.03,
  receivableDays: 60,
  inventoryDays: 60,
  payableDays: 50,
  cashRatio: 0.05,
  otherCurrentRatio: 0.03,
  fixedAssetRatio: 0.12,
  shortTermLoanRatio: 0.15,
  longTermLoanRatio: 0.05,
  otherLiabilityRatio: 0.03,
  capital: 2_000_000,
  debtServiceRatio: 0.06,
  kvbSalesGap: 0.01,
}

const flat = (value: number) => () => value

export const FIRMS: Firm[] = [
  // 1) Kırtasiye — zayıf bilanço, güçlü alternatif veri (demonun ana mesajı)
  defineFirm({
    id: 'defne-kirtasiye',
    name: 'Defne Kırtasiye Ltd. Şti.',
    vkn: '2710458391',
    city: 'Eskişehir',
    foundedYear: 2009,
    employees: 18,
    sectorId: 'stationery',
    requestedAmount: 2_000_000,
    applicationDate: '2026-09-08',
    seed: 101,
    revenueLevel: growth(1_250_000, 0.12),
    revenueNoise: 0.04,
    financial: {
      ...BASE,
      cogsRatio: 0.73,
      opexRatio: 0.175,
      depreciationRatio: 0.015,
      financeExpenseRatio: 0.055,
      receivableDays: 45,
      inventoryDays: 110,
      payableDays: 60,
      cashRatio: 0.05,
      otherCurrentRatio: 0.03,
      fixedAssetRatio: 0.06,
      shortTermLoanRatio: 0.195,
      longTermLoanRatio: 0.04,
      otherLiabilityRatio: 0.03,
      capital: 1_000_000,
      debtServiceRatio: 0.012,
      kvbSalesGap: 0.03,
    },
    series: ({ rand, revenue }) => ({
      posRevenue: revenue.map((v) => round(v * (0.6 + 0.04 * rand()), 2)),
      posTransactions: series(rand, growth(9_000, 0.07), { noise: 0.03, pattern: sectorPattern('stationery') }),
      inventoryTurnover: series(rand, flat(4.6), { noise: 0.05, digits: 2 }),
      supplierOnTimePaymentRate: series(rand, flat(0.935), { noise: 0.01, digits: 3 }),
    }),
  }),

  // 2) Oto galeri — güçlü bilanço, bozulan alternatif veri
  defineFirm({
    id: 'kuzey-oto',
    name: 'Kuzey Oto Galeri A.Ş.',
    vkn: '5830192746',
    city: 'Bursa',
    foundedYear: 2006,
    employees: 14,
    sectorId: 'autoDealer',
    requestedAmount: 3_000_000,
    applicationDate: '2026-09-02',
    seed: 202,
    revenueLevel: path([0, 2_800_000], [11, 3_250_000], [23, 2_600_000]),
    revenueNoise: 0.03,
    financial: {
      ...BASE,
      cogsRatio: 0.86,
      opexRatio: 0.065,
      depreciationRatio: 0.006,
      financeExpenseRatio: 0.012,
      receivableDays: 12,
      inventoryDays: 55,
      payableDays: 18,
      cashRatio: 0.06,
      otherCurrentRatio: 0.02,
      fixedAssetRatio: 0.05,
      shortTermLoanRatio: 0.08,
      longTermLoanRatio: 0.02,
      otherLiabilityRatio: 0.015,
      capital: 5_000_000,
      debtServiceRatio: 0.012,
      kvbSalesGap: 0.005,
    },
    series: ({ rand, revenue }) => {
      const pattern = sectorPattern('autoDealer')
      return {
        newListings: series(rand, path([0, 60], [11, 66], [23, 62]), { noise: 0.04, pattern }),
        soldListings: series(rand, path([0, 42], [11, 48], [23, 42]), { noise: 0.04, pattern }),
        daysOnMarket: series(rand, path([0, 38], [17, 42], [23, 68]), { noise: 0.02 }),
        inventoryValue: revenue.map((v, t) => round(v * path([0, 1.6], [14, 1.8], [23, 2.6])(t), 2)),
        priceCutRatio: series(rand, path([0, 0.14], [14, 0.16], [23, 0.3]), { noise: 0.03, digits: 3 }),
      }
    },
  }),

  // 3) Kış turizmi acentesi — yaz düşüşü sezonsallıkla cezalandırılmıyor
  defineFirm({
    id: 'palandoken-turizm',
    name: 'Palandöken Kar Turizm Seyahat Acentesi Ltd. Şti.',
    vkn: '7401926358',
    city: 'Erzurum',
    foundedYear: 2012,
    employees: 11,
    sectorId: 'tourism',
    seasonProfile: 'winter',
    requestedAmount: 1_000_000,
    applicationDate: '2026-09-15',
    seed: 303,
    revenueLevel: growth(1_350_000, 0.1),
    revenueNoise: 0.05,
    financial: {
      ...BASE,
      kvbSalesGap: 0.03,
      service: true,
      cogsRatio: 0.84,
      opexRatio: 0.11,
      depreciationRatio: 0.01,
      financeExpenseRatio: 0.015,
      receivableDays: 35,
      inventoryDays: 4,
      payableDays: 25,
      cashRatio: 0.12,
      fixedAssetRatio: 0.08,
      shortTermLoanRatio: 0.05,
      longTermLoanRatio: 0.02,
      otherLiabilityRatio: 0.08,
      capital: 1_500_000,
      debtServiceRatio: 0.007,
    },
    series: ({ rand, pattern }) => ({
      bookings: series(rand, growth(420, 0.05), { noise: 0.04, pattern }),
      cancellationRate: series(rand, flat(0.12), { noise: 0.05, digits: 3 }),
      earlyBookingRate: series(rand, flat(0.22), { noise: 0.05, digits: 3 }),
      customerRating: series(rand, flat(4.3), { noise: 0.01, digits: 2 }),
      tursabLicenseValid: series(rand, flat(1)),
    }),
  }),

  // 4) E-ticaret — yorum puanı düşüyor, iade oranı artıyor (karara bağlanmış)
  defineFirm({
    id: 'mavi-sepet',
    name: 'Mavi Sepet E-Ticaret A.Ş.',
    vkn: '3928517460',
    city: 'İstanbul',
    foundedYear: 2016,
    employees: 32,
    sectorId: 'ecommerce',
    requestedAmount: 2_500_000,
    applicationDate: '2026-03-04',
    seed: 404,
    revenueLevel: growth(2_300_000, 0.08),
    revenueNoise: 0.04,
    financial: {
      ...BASE,
      otherLiabilityRatio: 0.05,
      cogsRatio: 0.72,
      opexRatio: 0.2,
      depreciationRatio: 0.015,
      financeExpenseRatio: 0.02,
      receivableDays: 30,
      inventoryDays: 40,
      payableDays: 45,
      cashRatio: 0.06,
      fixedAssetRatio: 0.12,
      shortTermLoanRatio: 0.12,
      longTermLoanRatio: 0.03,
      capital: 3_000_000,
      debtServiceRatio: 0.01,
    },
    series: ({ rand, pattern }) => ({
      reviewRating: series(rand, path([0, 4.6], [17, 4.62], [23, 4.0]), { noise: 0.004, digits: 2 }),
      negativeReviewRatio: series(rand, path([0, 0.06], [17, 0.06], [23, 0.15]), { noise: 0.03, digits: 3 }),
      orderCount: series(rand, growth(9_500, 0.05), { noise: 0.03, pattern }),
      averageBasket: series(rand, growth(245, 0.1), { noise: 0.02, digits: 2 }),
      returnRate: series(rand, path([0, 0.04], [17, 0.04], [23, 0.1]), { noise: 0.03, digits: 3 }),
      onTimeDeliveryRate: series(rand, path([0, 0.93], [17, 0.93], [23, 0.9]), { noise: 0.005, digits: 3 }),
      sellerScore: series(rand, path([0, 9.1], [17, 9.1], [23, 8.6]), { noise: 0.005, digits: 1 }),
    }),
  }),

  // 5) Restoran / kafe — dengeli, iyi
  defineFirm({
    id: 'cinaralti-restoran',
    name: 'Çınaraltı Restoran ve Kafe İşletmeleri Ltd. Şti.',
    vkn: '6159273048',
    city: 'İzmir',
    foundedYear: 2014,
    employees: 38,
    sectorId: 'restaurant',
    requestedAmount: 1_000_000,
    applicationDate: '2026-09-10',
    seed: 505,
    revenueLevel: growth(980_000, 0.09),
    revenueNoise: 0.04,
    financial: {
      ...BASE,
      service: true,
      cogsRatio: 0.4,
      opexRatio: 0.47,
      depreciationRatio: 0.04,
      financeExpenseRatio: 0.02,
      receivableDays: 6,
      inventoryDays: 12,
      payableDays: 35,
      cashRatio: 0.07,
      otherCurrentRatio: 0.02,
      fixedAssetRatio: 0.22,
      shortTermLoanRatio: 0.07,
      longTermLoanRatio: 0.08,
      otherLiabilityRatio: 0.05,
      capital: 1_500_000,
      debtServiceRatio: 0.05,
    },
    series: ({ rand, pattern }) => {
      const pos = series(rand, growth(7_800, 0.05), { noise: 0.03, pattern })
      return {
        mapRating: series(rand, flat(4.4), { noise: 0.005, digits: 1 }),
        deliveryPlatformRating: series(rand, flat(8.7), { noise: 0.005, digits: 1 }),
        onlineOrders: series(rand, growth(2_100, 0.1), { noise: 0.04, pattern }),
        posTransactions: pos,
        posRevenue: pos.map((n, t) => round(n * growth(95, 0.2)(t), 2)),
        sgkHeadcount: series(rand, growth(36, 0.04), { noise: 0.02 }),
      }
    },
  }),

  // 6) Yapı malzemesi — orta-zayıf (BB)
  defineFirm({
    id: 'anadolu-yapi',
    name: 'Anadolu Yapı Market Ltd. Şti.',
    vkn: '4072816539',
    city: 'Konya',
    foundedYear: 2003,
    employees: 26,
    sectorId: 'buildingMaterials',
    requestedAmount: 1_500_000,
    applicationDate: '2026-08-27',
    seed: 606,
    revenueLevel: growth(2_100_000, -0.08),
    revenueNoise: 0.1,
    financial: {
      ...BASE,
      cogsRatio: 0.78,
      opexRatio: 0.14,
      depreciationRatio: 0.015,
      financeExpenseRatio: 0.04,
      receivableDays: 120,
      inventoryDays: 80,
      payableDays: 70,
      cashRatio: 0.03,
      fixedAssetRatio: 0.1,
      shortTermLoanRatio: 0.25,
      longTermLoanRatio: 0.06,
      otherLiabilityRatio: 0.03,
      capital: 2_500_000,
      debtServiceRatio: 0.02,
      kvbSalesGap: 0.03,
    },
    series: ({ rand }) => ({
      regionalBuildingPermits: series(rand, growth(640, -0.12), { noise: 0.05, pattern: sectorPattern('buildingMaterials') }),
      eDispatchCount: series(rand, growth(880, -0.1), { noise: 0.04, pattern: sectorPattern('buildingMaterials') }),
      chequePaidOnTimeRate: series(rand, flat(0.95), { noise: 0.008, digits: 3 }),
      publicTenderWins: series(rand, (t) => (t % 4 === 1 ? 1 : 0)),
    }),
  }),

  // 7) Yapı malzemesi — red senaryosu (C): zarar, karşılıksız çek, beyan tutarsızlığı
  defineFirm({
    id: 'toros-yapi',
    name: 'Toros Yapı Malzemeleri İnşaat Ltd. Şti.',
    vkn: '8264019375',
    city: 'Mersin',
    foundedYear: 2015,
    employees: 12,
    sectorId: 'buildingMaterials',
    requestedAmount: 2_000_000,
    applicationDate: '2026-09-05',
    seed: 707,
    revenueLevel: path([0, 1_500_000], [10, 1_400_000], [23, 1_000_000]),
    revenueNoise: 0.14,
    financial: {
      ...BASE,
      cogsRatio: 0.84,
      opexRatio: 0.15,
      depreciationRatio: 0.012,
      financeExpenseRatio: 0.07,
      receivableDays: 150,
      inventoryDays: 120,
      payableDays: 110,
      cashRatio: 0.01,
      fixedAssetRatio: 0.08,
      shortTermLoanRatio: 0.34,
      longTermLoanRatio: 0.08,
      otherLiabilityRatio: 0.05,
      capital: 1_000_000,
      debtServiceRatio: 0.12,
      kvbSalesGap: 0.22,
    },
    riskFlags: { bouncedCheque: true },
    series: ({ rand }) => ({
      regionalBuildingPermits: series(rand, growth(410, -0.18), { noise: 0.06, pattern: sectorPattern('buildingMaterials') }),
      eDispatchCount: series(rand, path([0, 520], [10, 480], [23, 330]), { noise: 0.06, pattern: sectorPattern('buildingMaterials') }),
      chequePaidOnTimeRate: series(rand, path([0, 0.93], [23, 0.86]), { noise: 0.01, digits: 3 }),
      publicTenderWins: series(rand, flat(0)),
    }),
  }),

  // 8) Tekstil ihracatçısı — sağlam (A)
  defineFirm({
    id: 'denizli-dokuma',
    name: 'Denizli Dokuma Tekstil San. ve Tic. A.Ş.',
    vkn: '1938405726',
    city: 'Denizli',
    foundedYear: 1998,
    employees: 64,
    sectorId: 'textileExport',
    requestedAmount: 6_000_000,
    applicationDate: '2026-09-11',
    seed: 808,
    revenueLevel: growth(4_200_000, 0.08),
    revenueNoise: 0.04,
    financial: {
      ...BASE,
      exportShare: 0.85,
      cogsRatio: 0.77,
      opexRatio: 0.12,
      depreciationRatio: 0.03,
      financeExpenseRatio: 0.025,
      receivableDays: 75,
      inventoryDays: 85,
      payableDays: 65,
      cashRatio: 0.07,
      fixedAssetRatio: 0.2,
      shortTermLoanRatio: 0.2,
      longTermLoanRatio: 0.12,
      otherLiabilityRatio: 0.03,
      capital: 8_000_000,
      debtServiceRatio: 0.03,
    },
    series: ({ rand, pattern }) => ({
      eExportInvoiceAmount: series(rand, growth(3_500_000, 0.1), { noise: 0.04, pattern, digits: 2 }),
      exportDeclarations: series(rand, growth(38, 0.05), { noise: 0.05, pattern }),
      orderBacklogMonths: series(rand, flat(2.2), { noise: 0.04, digits: 2 }),
      top3CustomerShare: series(rand, flat(0.45), { noise: 0.02, digits: 3 }),
      netFxShortToEquity: series(rand, flat(0.15), { noise: 0.05, digits: 3 }),
    }),
  }),

  // 9) Tarım / gıda toptan — orta (BBB), revize onaylı
  defineFirm({
    id: 'cukurova-tarim',
    name: 'Çukurova Tarım Ürünleri Toptan Ticaret Ltd. Şti.',
    vkn: '6605173982',
    city: 'Adana',
    foundedYear: 2008,
    employees: 22,
    sectorId: 'agriFood',
    requestedAmount: 2_500_000,
    applicationDate: '2026-05-12',
    seed: 909,
    revenueLevel: growth(3_000_000, 0.05),
    revenueNoise: 0.05,
    financial: {
      ...BASE,
      cogsRatio: 0.83,
      opexRatio: 0.09,
      depreciationRatio: 0.012,
      financeExpenseRatio: 0.03,
      receivableDays: 55,
      inventoryDays: 70,
      payableDays: 40,
      cashRatio: 0.04,
      fixedAssetRatio: 0.1,
      shortTermLoanRatio: 0.18,
      longTermLoanRatio: 0.04,
      capital: 3_000_000,
      debtServiceRatio: 0.015,
      kvbSalesGap: 0.015,
    },
    series: ({ rand, pattern }) => ({
      purchaseVolumeTons: series(rand, growth(1_150, 0.04), { noise: 0.04, pattern }),
      commodityPrice: series(rand, growth(18.5, 0.12), { noise: 0.03, digits: 2 }),
      warehouseOccupancy: series(rand, flat(0.64), { noise: 0.05, digits: 3 }),
      eDispatchCount: series(rand, growth(610, 0.02), { noise: 0.04, pattern }),
    }),
  }),

  // 10) Lojistik — çok güçlü (AAA/AA)
  defineFirm({
    id: 'marmara-lojistik',
    name: 'Marmara Lojistik ve Taşımacılık A.Ş.',
    vkn: '9017364285',
    city: 'Kocaeli',
    foundedYear: 2001,
    employees: 85,
    sectorId: 'logistics',
    requestedAmount: 7_000_000,
    applicationDate: '2026-04-21',
    seed: 1010,
    revenueLevel: growth(5_200_000, 0.16),
    revenueNoise: 0.02,
    financial: {
      ...BASE,
      service: true,
      cogsRatio: 0.72,
      opexRatio: 0.09,
      depreciationRatio: 0.07,
      financeExpenseRatio: 0.012,
      receivableDays: 38,
      inventoryDays: 6,
      payableDays: 30,
      cashRatio: 0.1,
      otherCurrentRatio: 0.03,
      fixedAssetRatio: 0.3,
      shortTermLoanRatio: 0.08,
      longTermLoanRatio: 0.14,
      otherLiabilityRatio: 0.03,
      capital: 15_000_000,
      debtServiceRatio: 0.04,
      kvbSalesGap: 0.003,
    },
    series: ({ rand, pattern }) => ({
      fleetUtilization: series(rand, flat(0.93), { noise: 0.01, digits: 3 }),
      tripCount: series(rand, growth(1_450, 0.18), { noise: 0.02, pattern }),
      fuelLitresPer100Km: series(rand, flat(29), { noise: 0.01, digits: 1 }),
      collectionDays: series(rand, flat(35), { noise: 0.03 }),
    }),
  }),

  // 11) Eczane — güçlü (AA), revize onaylı
  defineFirm({
    id: 'sifa-eczanesi',
    name: 'Şifa Eczanesi Sağlık Ürünleri Ltd. Şti.',
    vkn: '2583940617',
    city: 'Kayseri',
    foundedYear: 2011,
    employees: 9,
    sectorId: 'pharmacy',
    requestedAmount: 2_000_000,
    applicationDate: '2026-06-03',
    seed: 1111,
    revenueLevel: growth(1_600_000, 0.1),
    revenueNoise: 0.03,
    financial: {
      ...BASE,
      cogsRatio: 0.76,
      opexRatio: 0.1,
      depreciationRatio: 0.01,
      financeExpenseRatio: 0.01,
      receivableDays: 55,
      inventoryDays: 50,
      payableDays: 70,
      cashRatio: 0.05,
      otherCurrentRatio: 0.02,
      fixedAssetRatio: 0.04,
      shortTermLoanRatio: 0.08,
      longTermLoanRatio: 0,
      otherLiabilityRatio: 0.02,
      capital: 1_000_000,
      debtServiceRatio: 0.01,
      kvbSalesGap: 0.004,
    },
    series: ({ rand, pattern }) => ({
      sgkPrescriptions: series(rand, growth(4_200, 0.08), { noise: 0.03, pattern }),
      sgkPaymentDelayDays: series(rand, flat(10), { noise: 0.1 }),
      inventoryTurnover: series(rand, flat(9.5), { noise: 0.03, digits: 2 }),
      nonPrescriptionSalesShare: series(rand, flat(0.22), { noise: 0.03, digits: 3 }),
    }),
  }),

  // 12) Yaz turizmi acentesi — orta (BBB), onaylı
  defineFirm({
    id: 'bodrum-mavi-tur',
    name: 'Bodrum Mavi Tur Seyahat Acentesi Ltd. Şti.',
    vkn: '4719306258',
    city: 'Muğla',
    foundedYear: 2013,
    employees: 16,
    sectorId: 'tourism',
    seasonProfile: 'summer',
    requestedAmount: 1_000_000,
    applicationDate: '2026-04-08',
    seed: 1212,
    revenueLevel: growth(1_900_000, 0.06),
    revenueNoise: 0.06,
    financial: {
      ...BASE,
      service: true,
      cogsRatio: 0.84,
      opexRatio: 0.1,
      depreciationRatio: 0.01,
      financeExpenseRatio: 0.03,
      receivableDays: 30,
      inventoryDays: 4,
      payableDays: 22,
      cashRatio: 0.1,
      fixedAssetRatio: 0.08,
      shortTermLoanRatio: 0.12,
      longTermLoanRatio: 0.02,
      otherLiabilityRatio: 0.07,
      capital: 1_500_000,
      debtServiceRatio: 0.007,
      kvbSalesGap: 0.02,
    },
    series: ({ rand, pattern }) => ({
      bookings: series(rand, growth(610, 0.03), { noise: 0.05, pattern }),
      cancellationRate: series(rand, flat(0.13), { noise: 0.05, digits: 3 }),
      earlyBookingRate: series(rand, flat(0.25), { noise: 0.05, digits: 3 }),
      customerRating: series(rand, flat(4.2), { noise: 0.01, digits: 2 }),
      tursabLicenseValid: series(rand, flat(1)),
    }),
  }),

  // 13) Nakliyat — skor A, vadesi geçmiş vergi/SGK borcu nedeniyle not BB ile sınırlanır
  defineFirm({
    id: 'karadeniz-nakliyat',
    name: 'Karadeniz Nakliyat ve Lojistik Ltd. Şti.',
    vkn: '5391028467',
    city: 'Samsun',
    foundedYear: 2010,
    employees: 41,
    sectorId: 'logistics',
    requestedAmount: 2_500_000,
    applicationDate: '2026-09-09',
    seed: 1313,
    revenueLevel: growth(2_400_000, 0.1),
    revenueNoise: 0.03,
    financial: {
      ...BASE,
      service: true,
      cogsRatio: 0.76,
      opexRatio: 0.1,
      depreciationRatio: 0.06,
      financeExpenseRatio: 0.025,
      receivableDays: 55,
      inventoryDays: 6,
      payableDays: 30,
      cashRatio: 0.06,
      fixedAssetRatio: 0.3,
      shortTermLoanRatio: 0.1,
      longTermLoanRatio: 0.12,
      otherLiabilityRatio: 0.03,
      overdueTaxLiability: 420_000,
      capital: 4_000_000,
      debtServiceRatio: 0.04,
    },
    riskFlags: { taxOrSgkDebt: true },
    series: ({ rand, pattern }) => ({
      fleetUtilization: series(rand, flat(0.84), { noise: 0.015, digits: 3 }),
      tripCount: series(rand, growth(760, 0.08), { noise: 0.03, pattern }),
      fuelLitresPer100Km: series(rand, flat(31.5), { noise: 0.01, digits: 1 }),
      collectionDays: series(rand, flat(52), { noise: 0.04 }),
    }),
  }),

  // 14) Kafe — zayıf (B), reddedilmiş
  defineFirm({
    id: 'kapadokya-kafe',
    name: 'Kapadokya Lezzet Kafe Ltd. Şti.',
    vkn: '3046182795',
    city: 'Nevşehir',
    foundedYear: 2019,
    employees: 15,
    sectorId: 'restaurant',
    requestedAmount: 800_000,
    applicationDate: '2026-05-20',
    seed: 1414,
    revenueLevel: growth(620_000, -0.08),
    revenueNoise: 0.08,
    financial: {
      ...BASE,
      service: true,
      cogsRatio: 0.44,
      opexRatio: 0.49,
      depreciationRatio: 0.04,
      financeExpenseRatio: 0.05,
      receivableDays: 8,
      inventoryDays: 15,
      payableDays: 45,
      cashRatio: 0.06,
      otherCurrentRatio: 0.02,
      fixedAssetRatio: 0.35,
      shortTermLoanRatio: 0.16,
      longTermLoanRatio: 0.12,
      otherLiabilityRatio: 0.06,
      capital: 500_000,
      debtServiceRatio: 0.02,
      kvbSalesGap: 0.04,
    },
    series: ({ rand, pattern }) => {
      const pos = series(rand, growth(5_200, -0.1), { noise: 0.05, pattern })
      return {
        mapRating: series(rand, path([0, 4.2], [23, 3.8]), { noise: 0.005, digits: 1 }),
        deliveryPlatformRating: series(rand, path([0, 8.2], [23, 7.6]), { noise: 0.005, digits: 1 }),
        onlineOrders: series(rand, growth(1_300, -0.12), { noise: 0.05, pattern }),
        posTransactions: pos,
        posRevenue: pos.map((n, t) => round(n * growth(110, 0.05)(t), 2)),
        sgkHeadcount: series(rand, growth(17, -0.12), { noise: 0.03 }),
      }
    },
  }),

  // 15) Holding — büyük ölçekli tekstil ihracatçısı grubu, güçlü bilanço (karara bağlanmış)
  defineFirm({
    id: 'kuzeyhan-holding',
    name: 'Kuzeyhan Tekstil Holding A.Ş.',
    vkn: '6120938457',
    city: 'İstanbul',
    foundedYear: 1987,
    employees: 2_400,
    segment: 'holding',
    groupCompanies: 7,
    sectorId: 'textileExport',
    requestedAmount: 900_000_000,
    applicationDate: '2026-05-25',
    seed: 1515,
    revenueLevel: growth(420_000_000, 0.12),
    revenueNoise: 0.03,
    financial: {
      ...BASE,
      exportShare: 0.82,
      cogsRatio: 0.72,
      opexRatio: 0.12,
      depreciationRatio: 0.035,
      financeExpenseRatio: 0.02,
      receivableDays: 70,
      inventoryDays: 80,
      payableDays: 70,
      cashRatio: 0.07,
      fixedAssetRatio: 0.28,
      shortTermLoanRatio: 0.16,
      longTermLoanRatio: 0.1,
      otherLiabilityRatio: 0.03,
      capital: 600_000_000,
      debtServiceRatio: 0.025,
      kvbSalesGap: 0.004,
    },
    series: ({ rand, pattern }) => ({
      eExportInvoiceAmount: series(rand, growth(340_000_000, 0.12), { noise: 0.03, pattern, digits: 2 }),
      exportDeclarations: series(rand, growth(610, 0.08), { noise: 0.04, pattern }),
      orderBacklogMonths: series(rand, flat(3.2), { noise: 0.03, digits: 2 }),
      top3CustomerShare: series(rand, flat(0.28), { noise: 0.02, digits: 3 }),
      netFxShortToEquity: series(rand, flat(0.05), { noise: 0.1, digits: 3 }),
    }),
  }),

  // 16) Holding — satın alma sonrası kaldıraçlı tarım/gıda grubu (tahsis bekliyor)
  defineFirm({
    id: 'caglayan-holding',
    name: 'Çağlayan Gıda ve Tarım Holding A.Ş.',
    vkn: '3875016249',
    city: 'Konya',
    foundedYear: 1994,
    employees: 1_150,
    segment: 'holding',
    groupCompanies: 5,
    sectorId: 'agriFood',
    requestedAmount: 250_000_000,
    applicationDate: '2026-09-14',
    seed: 1616,
    revenueLevel: growth(250_000_000, 0.06),
    revenueNoise: 0.05,
    financial: {
      ...BASE,
      cogsRatio: 0.86,
      opexRatio: 0.075,
      depreciationRatio: 0.012,
      financeExpenseRatio: 0.033,
      receivableDays: 60,
      inventoryDays: 75,
      payableDays: 45,
      cashRatio: 0.04,
      fixedAssetRatio: 0.26,
      shortTermLoanRatio: 0.17,
      longTermLoanRatio: 0.1,
      otherLiabilityRatio: 0.03,
      capital: 300_000_000,
      debtServiceRatio: 0.015,
      kvbSalesGap: 0.012,
    },
    series: ({ rand, pattern }) => ({
      purchaseVolumeTons: series(rand, growth(98_000, 0.02), { noise: 0.04, pattern }),
      commodityPrice: series(rand, growth(18.5, 0.1), { noise: 0.03, digits: 2 }),
      warehouseOccupancy: series(rand, flat(0.82), { noise: 0.04, digits: 3 }),
      eDispatchCount: series(rand, growth(9_400, 0.04), { noise: 0.04, pattern }),
    }),
  }),
]

export function getFirm(id: string): Firm | undefined {
  return FIRMS.find((f) => f.id === id)
}
