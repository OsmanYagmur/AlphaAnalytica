/**
 * AlphaAnalytica — Model konfigürasyonu
 *
 * Motorun kullandığı tüm ağırlık, eşik ve katsayılar bu dosyadaki tipli
 * konfigürasyondan okunur. `DEFAULT_MODEL_CONFIG` = Model v1.0 varsayılanları.
 * Motor dosyaları (traditionalScore, alternativeScore, seasonality, limit,
 * collateral) hiçbir sayısal parametreyi sabit kod olarak içermez.
 *
 * Birim kuralları:
 * - Oran ve yüzdeler ondalık kesir olarak tutulur (%20 → 0.20).
 * - Puanlar 0–100 aralığındadır.
 * - Tutarlar TL, süreler gün veya ay cinsindendir (alan adında belirtilir).
 * - Ağırlık grupları toplamı 1'dir.
 *
 * Görünürlük: bu dosyadaki `label` alanları tüm ekranlarda kullanılabilir;
 * `description`, ağırlık, kırılım ve eşikler yalnızca Model Yöneticisi
 * panelinde gösterilir.
 */

// ---------------------------------------------------------------------------
// Temel tipler
// ---------------------------------------------------------------------------

/** Normalizasyon kırılım noktası: gösterge değeri → 0–100 puan. */
export interface Breakpoint {
  value: number
  score: number
}

/**
 * Parçalı doğrusal normalizasyon eğrisi. Noktalar `value` değerine göre kesin
 * artan sıradadır; aralarında doğrusal interpolasyon yapılır. Uç değerler
 * kırpılır: ilk noktanın solunda ilk puan, son noktanın sağında son puan.
 * Puanlar monoton olmak zorunda değildir (ör. depo doluluğunda ters U).
 */
export type BreakpointCurve = Breakpoint[]

/** Ocak → Aralık sırasıyla 12 aylık değer. */
export type MonthlyIndex = [
  number, number, number, number, number, number,
  number, number, number, number, number, number,
]

// ---------------------------------------------------------------------------
// Harf notları
// ---------------------------------------------------------------------------

export const CREDIT_GRADES = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C'] as const
export type CreditGrade = (typeof CREDIT_GRADES)[number]

/** Limit verilebilen notlar (C notunda limit verilmez). */
export type LendableGrade = Exclude<CreditGrade, 'C'>
export const LENDABLE_GRADES: readonly LendableGrade[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B']

// ---------------------------------------------------------------------------
// Geleneksel skor
// ---------------------------------------------------------------------------

/** Her geleneksel kategorinin içerdiği oranlar. */
export interface TraditionalRatioIdMap {
  liquidity: 'currentRatio' | 'acidTestRatio'
  leverage: 'debtToEquity' | 'netDebtToEbitda'
  profitability: 'ebitdaMargin' | 'netProfitMargin' | 'returnOnAssets'
  efficiency: 'cashConversionCycle'
  debtService: 'interestCoverage'
  consistency: 'salesDeviation'
}

export type TraditionalCategoryId = keyof TraditionalRatioIdMap
export type TraditionalRatioId = TraditionalRatioIdMap[TraditionalCategoryId]

export const TRADITIONAL_CATEGORY_IDS: readonly TraditionalCategoryId[] = [
  'liquidity',
  'leverage',
  'profitability',
  'efficiency',
  'debtService',
  'consistency',
]

/**
 * Oran değerinin birimi (gösterim içindir):
 * - `ratio`: düz oran (1,50)
 * - `multiple`: kat (2,1x)
 * - `share`: yüzde olarak gösterilen kesir (0,12 → %12)
 * - `medianMultiple`: sektör medyanına oran (1,0 = medyan)
 */
export type RatioUnit = 'ratio' | 'multiple' | 'share' | 'medianMultiple'

export interface RatioConfig {
  label: string
  description: string
  unit: RatioUnit
  /** Kategori içindeki ağırlık; kategori içi toplam 1. */
  weight: number
  breakpoints: BreakpointCurve
}

export interface TraditionalCategoryConfig<C extends TraditionalCategoryId> {
  label: string
  /** G skorundaki kategori ağırlığı; kategoriler toplamı 1. */
  weight: number
  ratios: Record<TraditionalRatioIdMap[C], RatioConfig>
}

export interface TraditionalConfig {
  categories: { [C in TraditionalCategoryId]: TraditionalCategoryConfig<C> }
  /** KVB matrahı negatifse Beyan Tutarlılığı kategorisinin alabileceği en yüksek puan. */
  negativeTaxBaseScoreCap: number
}

// ---------------------------------------------------------------------------
// Alternatif skor
// ---------------------------------------------------------------------------

export interface AlternativeConfig {
  /** A_ham = sp × SP + su × SU + tr × TR; toplam 1. */
  weights: { sp: number; su: number; tr: number }
  seasonalFit: {
    /** SU = 100 × max(0; 1 − ortalama|Sapma_m| / tolerance) */
    tolerance: number
    /** Sapmanın ortalamasının alındığı son ay sayısı. */
    windowMonths: number
  }
  trend: {
    /** Arındırılmış (SA) seriye regresyon uygulanan son ay sayısı. */
    windowMonths: number
    /** Yıllık % büyüme (kesir) → TR puanı. */
    breakpoints: BreakpointCurve
  }
  coverage: {
    /** Veri kapsama düzeltmesi: A = c × A_ham + (1 − c) × neutralScore */
    enabled: boolean
    neutralScore: number
  }
}

// ---------------------------------------------------------------------------
// Sektörler
// ---------------------------------------------------------------------------

export const SECTOR_IDS = [
  'ecommerce',
  'autoDealer',
  'stationery',
  'tourism',
  'restaurant',
  'buildingMaterials',
  'textileExport',
  'agriFood',
  'logistics',
  'pharmacy',
] as const
export type SectorId = (typeof SECTOR_IDS)[number]

/** Her sektörün alternatif göstergeleri (4–6 adet). */
export interface SectorIndicatorIdMap {
  ecommerce:
    | 'reviewRating'
    | 'negativeReviewRatio'
    | 'orderVolume'
    | 'returnRate'
    | 'onTimeDelivery'
    | 'sellerScore'
  autoDealer: 'newListings' | 'soldListings' | 'daysOnMarket' | 'inventoryValue' | 'priceCutFrequency'
  stationery: 'posRevenue' | 'posTransactions' | 'schoolSeason' | 'inventoryTurnover' | 'supplierPayment'
  tourism: 'bookingVolume' | 'cancellationRate' | 'earlyBookingRate' | 'customerRating' | 'tursabLicense'
  restaurant:
    | 'mapRating'
    | 'deliveryPlatformRating'
    | 'onlineOrders'
    | 'posTransactions'
    | 'averageTicket'
    | 'sgkHeadcount'
  buildingMaterials: 'buildingPermits' | 'eDispatchVolume' | 'chequePayment' | 'publicTenders'
  textileExport:
    | 'exportInvoiceVolume'
    | 'exportDeclarations'
    | 'orderBacklog'
    | 'customerConcentration'
    | 'fxPosition'
  agriFood: 'harvestVolume' | 'commodityPriceTrend' | 'warehouseOccupancy' | 'eDispatchVolume'
  logistics: 'fleetUtilization' | 'tripCount' | 'fuelPerKm' | 'collectionDays'
  pharmacy: 'prescriptionVolume' | 'sgkPaymentDelay' | 'inventoryTurnover' | 'nonPrescriptionShare'
}

export type IndicatorId<S extends SectorId = SectorId> = SectorIndicatorIdMap[S]

/**
 * Göstergenin ölçülen değerinin birimi (gösterim içindir):
 * - `rating5` / `rating10`: 5 / 10 üzerinden puan
 * - `share`: yüzde olarak gösterilen pay (0–1)
 * - `change`: yüzde olarak gösterilen göreli değişim
 * - `days`, `months`, `times` (devir), `count` (adet), `lPer100km`
 * - `ratio`: düz oran
 * - `binary`: 1 = var/geçerli, 0 = yok/geçersiz
 */
export type IndicatorUnit =
  | 'rating5'
  | 'rating10'
  | 'share'
  | 'change'
  | 'days'
  | 'months'
  | 'times'
  | 'count'
  | 'lPer100km'
  | 'ratio'
  | 'binary'

/**
 * Göstergenin aylık seri(ler)den nasıl üretildiği.
 * - `series`: tek seri
 * - `product`: iki serinin aylık çarpımı (ör. sipariş adedi × ortalama sepet)
 * - `ratio`: birinci serinin ikinciye aylık oranı (ör. stok değeri / ciro)
 *
 * Seri anahtarları firma verisindeki alternatif gösterge serilerine karşılık
 * gelir. `revenue` anahtarı firmanın aylık ciro serisini ifade eder.
 */
export type IndicatorSource =
  | { series: string }
  | { product: [string, string] }
  | { ratio: [string, string] }

/**
 * Aylık seriden tek bir gösterge değerinin hesaplanma yöntemi.
 * - `mean`: son `window` ayın ortalaması
 * - `latest`: son gözlem
 * - `change`: son `window` ayın ortalamasının, `lag` ay önceki aynı uzunluktaki
 *   dönemin ortalamasına göre göreli değişimi (lag = 12 → yıllık karşılaştırma)
 * - `projection`: son `window` aya doğrusal regresyon uygulanır, `horizon` ay
 *   sonrası için tahmin edilen değer kullanılır (seviye + trend birlikte)
 * - `periodChange`: belirtilen takvim aylarının (1–12) son 12 aydaki toplamının,
 *   önceki 12 aydaki aynı ayların toplamına göre göreli değişimi (sezon performansı)
 */
export type IndicatorMeasure =
  | { kind: 'mean'; window: number }
  | { kind: 'latest' }
  | { kind: 'change'; window: number; lag: number }
  | { kind: 'projection'; window: number; horizon: number }
  | { kind: 'periodChange'; calendarMonths: number[] }

export interface AlternativeIndicatorConfig {
  label: string
  description: string
  unit: IndicatorUnit
  /** SP içindeki ağırlık; sektör içi toplam 1. */
  weight: number
  source: IndicatorSource
  measure: IndicatorMeasure
  breakpoints: BreakpointCurve
}

/** Sezon profili kimlikleri. Turizmde yaz ve kış alt profilleri vardır. */
export type SeasonProfileId = 'standard' | 'summer' | 'winter'
export type SectorSeasonProfileId<S extends SectorId> = S extends 'tourism'
  ? 'summer' | 'winter'
  : 'standard'

export interface SeasonProfile {
  label: string
  description: string
  /** S_m, Ocak → Aralık; ortalaması 1,00. */
  index: MonthlyIndex
}

export interface SeasonalityConfig<S extends SectorId> {
  /** Firmada alt profil belirtilmemişse kullanılacak profil. */
  defaultProfile: SectorSeasonProfileId<S>
  profiles: Record<SectorSeasonProfileId<S>, SeasonProfile>
}

// ---------------------------------------------------------------------------
// Ürünler ve teminat türleri
// ---------------------------------------------------------------------------

export const PRODUCT_IDS = ['revolving', 'spot', 'nonCash', 'inventoryFinance'] as const
export type ProductId = (typeof PRODUCT_IDS)[number]

export const PRODUCT_LABELS: Record<ProductId, string> = {
  revolving: 'Rotatif kredi',
  spot: 'Spot kredi',
  nonCash: 'Gayrinakdi (teminat mektubu)',
  inventoryFinance: 'Stok finansmanı',
}

/** Limitin ürünlere dağılımı; toplam 1. */
export type ProductMix = Record<ProductId, number>

export const COLLATERAL_TYPE_IDS = [
  'jointSurety',
  'receivablesAssignment',
  'vehiclePledge',
  'depositPledge',
  'mortgage',
] as const
export type CollateralTypeId = (typeof COLLATERAL_TYPE_IDS)[number]

export const COLLATERAL_TYPE_LABELS: Record<CollateralTypeId, string> = {
  jointSurety: 'Müşterek kefalet',
  receivablesAssignment: 'Çek / senet temliki + müşterek kefalet',
  vehiclePledge: 'Taşıt rehni + müşterek kefalet',
  depositPledge: 'Mevduat rehni',
  mortgage: 'Gayrimenkul ipoteği + müşterek kefalet',
}

// ---------------------------------------------------------------------------
// Sektör konfigürasyonu
// ---------------------------------------------------------------------------

export interface SectorConfig<S extends SectorId> {
  label: string
  /** Sektör Risk Katsayısı (SRK), 0,85–1,05. */
  riskCoefficient: number
  /** Sektörel nakit dönüşüm süresi medyanı (gün); pozitif olmalı. */
  cccMedianDays: number
  indicators: Record<IndicatorId<S>, AlternativeIndicatorConfig>
  seasonality: SeasonalityConfig<S>
  productMix: ProductMix
}

export type SectorConfigs = { [S in SectorId]: SectorConfig<S> }

// ---------------------------------------------------------------------------
// Not, PD, erken uyarı
// ---------------------------------------------------------------------------

export interface RatingConfig {
  /** Notun alt sınırı (dahil). En düşük eşiğin altı C. Kesin azalan sırada olmalı. */
  minScore: Record<LendableGrade, number>
  /** PD = 1 / (1 + e^((S − center) / scale)) */
  pd: { center: number; scale: number }
}

export interface SignalRuleBase {
  label: string
  enabled: boolean
}

/** Kritik sinyal: tetiklenirse not en fazla `gradeCap` olabilir. */
export interface CriticalSignalRule extends SignalRuleBase {
  gradeCap: LendableGrade
}

export type CriticalSignalId = 'declarationInconsistency' | 'bouncedCheque' | 'taxOrSgkDebt'
export type WatchSignalId = 'weakIndicator' | 'negativeTrend' | 'scoreDivergence'

export interface EarlyWarningConfig {
  critical: {
    /** |Mizan − KVB| / KVB net satış sapması `threshold` değerini aşarsa. */
    declarationInconsistency: CriticalSignalRule & { threshold: number }
    /** Karşılıksız çek kaydı varsa. */
    bouncedCheque: CriticalSignalRule
    /** Vadesi geçmiş vergi veya SGK borcu varsa. */
    taxOrSgkDebt: CriticalSignalRule
  }
  /** İzleme sinyalleri: notu sınırlamaz, rozet ve izlenecek gösterge olarak çıkar. */
  watch: {
    /** Bir alternatif göstergenin puanı `maxScore` veya altındaysa. */
    weakIndicator: SignalRuleBase & { maxScore: number }
    /** Arındırılmış yıllık ciro büyümesi `maxAnnualGrowth` veya altındaysa. */
    negativeTrend: SignalRuleBase & { maxAnnualGrowth: number }
    /** G − A farkı `minGap` veya üstündeyse (alternatif veri bilançoyu teyit etmiyor). */
    scoreDivergence: SignalRuleBase & { minGap: number }
  }
}

// ---------------------------------------------------------------------------
// Limit
// ---------------------------------------------------------------------------

export interface LimitConfig {
  /** Yıllık gün sayısı (K1'de kullanılır). */
  daysInYear: number
  /** K1 = Net Satış × max(NDS; minDays) / daysInYear × multiplier */
  k1: { multiplier: number; minDays: number }
  /** K2 = Özkaynak × equityMultiplier */
  k2: { equityMultiplier: number }
  /** K3 = max(0; FAVÖK × ebitdaRatio − Mevcut Yıllık Kredi Ödemeleri) × multiplier */
  k3: { ebitdaRatio: number; multiplier: number }
  /** Not çarpanı f. */
  gradeMultiplier: Record<CreditGrade, number>
  /** Önerilen limit bu birime aşağı yuvarlanır (TL). */
  roundingUnit: number
}

// ---------------------------------------------------------------------------
// Teminat, vade, fiyatlama
// ---------------------------------------------------------------------------

export interface TenorTerm {
  months: number
  revolving: boolean
}

export interface TermsConfig {
  /** Teminat oranı (limitin kesri). */
  collateralRatio: Record<LendableGrade, number>
  /** Nota göre varsayılan teminat türü. */
  collateralType: Record<LendableGrade, CollateralTypeId>
  /** Bu not ve altında ipotek zorunludur. */
  mortgageRequiredFrom: LendableGrade
  /** Gerekli Ekspertiz Değeri = İpotek Tutarı / appraisalLtv */
  appraisalLtv: number
  tenor: Record<LendableGrade, TenorTerm>
  pricing: {
    /** Referans faiz adı (ör. TLREF). */
    referenceRate: string
    /** Referans faiz üzerine eklenen spread (baz puan). */
    spreadBp: Record<LendableGrade, number>
  }
  /** Genel varsayılan ürün kırılımı; sektörler kendi kırılımını taşır. */
  defaultProductMix: ProductMix
}

// ---------------------------------------------------------------------------
// Sunum ve karar kuralları
// ---------------------------------------------------------------------------

export interface PresentationConfig {
  /** Alt kategori çubuklarındaki "Güçlü / Orta / Zayıf" etiket sınırları (dahil). */
  strengthBands: { strongMin: number; moderateMin: number }
  /** "Skoru etkileyen faktörler" listesinde gösterilen pozitif/negatif faktör sayısı. */
  topFactorCount: number
}

export interface DecisionConfig {
  /** Revize kararında sistem önerisinden sapma bu oranı aşarsa gerekçe zorunlu. */
  revisionJustificationThreshold: number
}

// ---------------------------------------------------------------------------
// Kök şema
// ---------------------------------------------------------------------------

export const MODEL_SCHEMA_VERSION = 1
export const BASE_MODEL_VERSION = 'v1.0'

export interface ModelConfig {
  /** JSON içe aktarımında şema doğrulaması için. */
  schemaVersion: typeof MODEL_SCHEMA_VERSION
  final: {
    /** S = traditional × G + alternative × A; toplam 1. */
    weights: { traditional: number; alternative: number }
  }
  traditional: TraditionalConfig
  alternative: AlternativeConfig
  rating: RatingConfig
  earlyWarning: EarlyWarningConfig
  limit: LimitConfig
  terms: TermsConfig
  sectors: SectorConfigs
  presentation: PresentationConfig
  decision: DecisionConfig
}

// ---------------------------------------------------------------------------
// v1.0 varsayılanları
// ---------------------------------------------------------------------------

/** Kırılım eğrisi kısaltması: bp([değer, puan], ...). */
const bp = (...points: [number, number][]): BreakpointCurve =>
  points.map(([value, score]) => ({ value, score }))

/** Yıllık karşılaştırma: son `window` ay, geçen yılın aynı dönemine göre. */
const yoy = (window: number): IndicatorMeasure => ({ kind: 'change', window, lag: 12 })
const mean = (window: number): IndicatorMeasure => ({ kind: 'mean', window })

const YOY_DESC = 'geçen yılın aynı dönemine göre değişim'
const TURNOVER_DESC = 'Yıllıklandırılmış satılan malın maliyeti / ortalama stok'

const DEFAULTS: ModelConfig = {
  schemaVersion: MODEL_SCHEMA_VERSION,

  final: {
    weights: { traditional: 0.5, alternative: 0.5 },
  },

  // 1) Geleneksel Skor — mizan + KVB
  traditional: {
    categories: {
      liquidity: {
        label: 'Likidite',
        weight: 0.2,
        ratios: {
          currentRatio: {
            label: 'Cari Oran',
            description: 'Dönen Varlıklar / Kısa Vadeli Yabancı Kaynaklar',
            unit: 'ratio',
            weight: 0.5,
            breakpoints: bp([0.8, 0], [1.0, 40], [1.5, 80], [2.0, 100]),
          },
          acidTestRatio: {
            label: 'Asit-Test Oranı',
            description: '(Dönen Varlıklar − Stoklar) / Kısa Vadeli Yabancı Kaynaklar',
            unit: 'ratio',
            weight: 0.5,
            breakpoints: bp([0.5, 0], [1.0, 80], [1.3, 100]),
          },
        },
      },
      leverage: {
        label: 'Kaldıraç',
        weight: 0.25,
        ratios: {
          debtToEquity: {
            label: 'Toplam Borç / Özkaynak',
            description: '(Kısa + Uzun Vadeli Yabancı Kaynaklar) / Özkaynaklar',
            unit: 'multiple',
            weight: 0.5,
            breakpoints: bp([0.5, 100], [1, 80], [2, 50], [4, 0]),
          },
          netDebtToEbitda: {
            label: 'Net Finansal Borç / FAVÖK',
            description: '(Finansal Borçlar − Nakit ve Nakit Benzerleri) / FAVÖK',
            unit: 'multiple',
            weight: 0.5,
            breakpoints: bp([1, 100], [3, 50], [5, 0]),
          },
        },
      },
      profitability: {
        label: 'Kârlılık',
        weight: 0.2,
        ratios: {
          ebitdaMargin: {
            label: 'FAVÖK Marjı',
            description: 'FAVÖK / Net Satışlar',
            unit: 'share',
            weight: 1 / 3,
            breakpoints: bp([0, 0], [0.1, 70], [0.2, 100]),
          },
          netProfitMargin: {
            label: 'Net Kâr Marjı',
            description: 'Net Dönem Kârı / Net Satışlar',
            unit: 'share',
            weight: 1 / 3,
            breakpoints: bp([0, 0], [0.05, 70], [0.12, 100]),
          },
          returnOnAssets: {
            label: 'Aktif Kârlılığı',
            description: 'Net Dönem Kârı / Toplam Aktifler',
            unit: 'share',
            weight: 1 / 3,
            breakpoints: bp([0, 0], [0.05, 70], [0.1, 100]),
          },
        },
      },
      efficiency: {
        label: 'Faaliyet Etkinliği',
        weight: 0.15,
        ratios: {
          cashConversionCycle: {
            label: 'Nakit Dönüşüm Süresi',
            description:
              'Alacak Devir Günü + Stok Devir Günü − Borç Devir Günü; sektör medyanına oranı üzerinden puanlanır',
            unit: 'medianMultiple',
            weight: 1,
            // medyanın yarısı veya altı → 100; medyan → 70; medyanın 2 katı veya üstü → 0
            breakpoints: bp([0.5, 100], [1, 70], [2, 0]),
          },
        },
      },
      debtService: {
        label: 'Borç Ödeme Gücü',
        weight: 0.1,
        ratios: {
          interestCoverage: {
            label: 'Faiz Karşılama Oranı',
            description: 'FAVÖK / Finansman Giderleri',
            unit: 'multiple',
            weight: 1,
            breakpoints: bp([1, 0], [3, 70], [5, 100]),
          },
        },
      },
      consistency: {
        label: 'Beyan Tutarlılığı',
        weight: 0.1,
        ratios: {
          salesDeviation: {
            label: 'Mizan–KVB Net Satış Sapması',
            description: '|Mizan Net Satış − KVB Net Satış| / KVB Net Satış',
            unit: 'share',
            weight: 1,
            breakpoints: bp([0.02, 100], [0.1, 40], [0.2, 0]),
          },
        },
      },
    },
    negativeTaxBaseScoreCap: 50,
  },

  // 2) Alternatif Skor
  alternative: {
    weights: { sp: 0.55, su: 0.25, tr: 0.2 },
    seasonalFit: { tolerance: 0.5, windowMonths: 12 },
    trend: {
      windowMonths: 12,
      breakpoints: bp([-0.2, 0], [0, 50], [0.2, 100]),
    },
    coverage: { enabled: true, neutralScore: 50 },
  },

  // 3) Nihai skor, not ve PD
  rating: {
    minScore: { AAA: 90, AA: 80, A: 70, BBB: 60, BB: 50, B: 40 },
    pd: { center: 30, scale: 9 },
  },

  earlyWarning: {
    critical: {
      declarationInconsistency: {
        label: 'Beyan tutarsızlığı',
        enabled: true,
        gradeCap: 'BB',
        threshold: 0.2,
      },
      bouncedCheque: { label: 'Karşılıksız çek kaydı', enabled: true, gradeCap: 'BB' },
      taxOrSgkDebt: { label: 'Vergi / SGK borcu', enabled: true, gradeCap: 'BB' },
    },
    watch: {
      weakIndicator: { label: 'Zayıflayan alternatif gösterge', enabled: true, maxScore: 35 },
      negativeTrend: { label: 'Arındırılmış ciro trendi negatif', enabled: true, maxAnnualGrowth: -0.1 },
      scoreDivergence: { label: 'Alternatif veri bilançoyu teyit etmiyor', enabled: true, minGap: 25 },
    },
  },

  // 4) Limit
  limit: {
    daysInYear: 365,
    k1: { multiplier: 1.2, minDays: 30 },
    k2: { equityMultiplier: 1.5 },
    k3: { ebitdaRatio: 0.6, multiplier: 2 },
    gradeMultiplier: { AAA: 1.0, AA: 0.9, A: 0.8, BBB: 0.65, BB: 0.5, B: 0.3, C: 0 },
    roundingUnit: 50_000,
  },

  // 5) Teminat, vade, fiyatlama, ürün kırılımı
  terms: {
    collateralRatio: { AAA: 0, AA: 0.25, A: 0.5, BBB: 0.75, BB: 1.0, B: 1.25 },
    collateralType: {
      AAA: 'jointSurety',
      AA: 'receivablesAssignment',
      A: 'receivablesAssignment',
      BBB: 'mortgage',
      BB: 'mortgage',
      B: 'mortgage',
    },
    mortgageRequiredFrom: 'BBB',
    appraisalLtv: 0.7,
    tenor: {
      AAA: { months: 24, revolving: true },
      AA: { months: 24, revolving: true },
      A: { months: 24, revolving: true },
      BBB: { months: 12, revolving: false },
      BB: { months: 6, revolving: false },
      B: { months: 6, revolving: false },
    },
    pricing: {
      referenceRate: 'TLREF',
      // AAA +150 bp … B +650 bp, aradakiler doğrusal
      spreadBp: { AAA: 150, AA: 250, A: 350, BBB: 450, BB: 550, B: 650 },
    },
    defaultProductMix: { revolving: 0.5, spot: 0.3, nonCash: 0.2, inventoryFinance: 0 },
  },

  // Sektörler
  sectors: {
    ecommerce: {
      label: 'E-ticaret',
      riskCoefficient: 0.95,
      cccMedianDays: 25,
      indicators: {
        reviewRating: {
          label: 'Ürün yorum puanı ve trendi',
          description:
            'Pazaryeri ürün yorumlarının ortalama puanı (5 üzerinden); seviye ve son dönem eğilimi birlikte değerlendirilir',
          unit: 'rating5',
          weight: 0.2,
          source: { series: 'reviewRating' },
          measure: { kind: 'projection', window: 6, horizon: 3 },
          breakpoints: bp([3.5, 0], [4.0, 45], [4.4, 80], [4.7, 100]),
        },
        negativeReviewRatio: {
          label: 'Yorum duygu skoru (olumsuz yorum oranı)',
          description: 'Duygu analizinde olumsuz sınıflanan yorumların toplam yorumlara oranı',
          unit: 'share',
          weight: 0.15,
          source: { series: 'negativeReviewRatio' },
          measure: mean(3),
          breakpoints: bp([0.05, 100], [0.1, 70], [0.2, 25], [0.3, 0]),
        },
        orderVolume: {
          label: 'Sipariş adedi ve ortalama sepet tutarı',
          description: `Sipariş hacmi (sipariş adedi × ortalama sepet tutarı); ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { product: ['orderCount', 'averageBasket'] },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 30], [0, 50], [0.2, 85], [0.4, 100]),
        },
        returnRate: {
          label: 'İade oranı',
          description: 'İade edilen siparişlerin toplam siparişlere oranı',
          unit: 'share',
          weight: 0.2,
          source: { series: 'returnRate' },
          measure: mean(3),
          breakpoints: bp([0.03, 100], [0.06, 75], [0.1, 40], [0.15, 0]),
        },
        onTimeDelivery: {
          label: 'Kargo teslim süresi ve zamanında teslim oranı',
          description: 'Taahhüt edilen kargo teslim süresi içinde teslim edilen siparişlerin oranı',
          unit: 'share',
          weight: 0.1,
          source: { series: 'onTimeDeliveryRate' },
          measure: mean(3),
          breakpoints: bp([0.8, 0], [0.9, 50], [0.95, 80], [0.98, 100]),
        },
        sellerScore: {
          label: 'Pazaryeri satıcı puanı',
          description: 'Pazaryeri A satıcı performans puanı (10 üzerinden)',
          unit: 'rating10',
          weight: 0.15,
          source: { series: 'sellerScore' },
          measure: mean(3),
          breakpoints: bp([7.0, 0], [8.0, 45], [9.0, 85], [9.5, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'Kasım–Aralık kampanya dönemi pik; ocak–şubat durgun',
            index: [0.88, 0.82, 0.9, 0.92, 0.95, 0.9, 0.88, 0.9, 0.95, 1.0, 1.45, 1.45],
          },
        },
      },
      // Kampanya öncesi stok alımı için spot ağırlığı biraz yüksek
      productMix: { revolving: 0.45, spot: 0.35, nonCash: 0.2, inventoryFinance: 0 },
    },

    autoDealer: {
      label: 'Oto Galeri',
      riskCoefficient: 0.9,
      cccMedianDays: 55,
      indicators: {
        newListings: {
          label: 'Aylık yeni ilan sayısı',
          description: `İlan platformlarına eklenen yeni araç ilanı sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.15,
          source: { series: 'newListings' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 90], [0.3, 100]),
        },
        soldListings: {
          label: 'Satılan / kaldırılan ilan sayısı',
          description: `Satış nedeniyle kaldırılan ilan sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.25,
          source: { series: 'soldListings' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 90], [0.3, 100]),
        },
        daysOnMarket: {
          label: 'Ortalama ilanda kalma süresi (stok devir)',
          description:
            'Aracın ilana konmasından satışına kadar geçen ortalama gün; seviye ve son dönem eğilimi birlikte değerlendirilir',
          unit: 'days',
          weight: 0.25,
          source: { series: 'daysOnMarket' },
          measure: { kind: 'projection', window: 6, horizon: 3 },
          breakpoints: bp([30, 100], [45, 75], [60, 50], [90, 15], [120, 0]),
        },
        inventoryValue: {
          label: 'Stok değeri',
          description: 'Araç stok değerinin aylık ciroya oranı (kaç aylık satışa yettiği)',
          unit: 'months',
          weight: 0.15,
          source: { ratio: ['inventoryValue', 'revenue'] },
          measure: mean(3),
          breakpoints: bp([1.0, 100], [2.0, 75], [3.0, 45], [5.0, 0]),
        },
        priceCutFrequency: {
          label: 'Fiyat indirimi sıklığı',
          description: 'Ay içinde fiyatı düşürülen ilanların aktif ilanlara oranı',
          unit: 'share',
          weight: 0.2,
          source: { series: 'priceCutRatio' },
          measure: mean(3),
          breakpoints: bp([0.1, 100], [0.2, 75], [0.35, 35], [0.5, 0]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'İlkbahar–yaz yüksek; aralıkta yıl sonu kampanyası',
            index: [0.75, 0.8, 1.0, 1.1, 1.15, 1.15, 1.1, 1.0, 0.9, 0.9, 0.95, 1.2],
          },
        },
      },
      // Stok finansmanı ağırlıklı
      productMix: { revolving: 0.2, spot: 0.1, nonCash: 0.1, inventoryFinance: 0.6 },
    },

    stationery: {
      label: 'Kırtasiye',
      riskCoefficient: 1.0,
      cccMedianDays: 70,
      indicators: {
        posRevenue: {
          label: 'POS ciro',
          description: `Üye işyeri POS cirosu; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'posRevenue' },
          measure: yoy(3),
          breakpoints: bp([-0.2, 0], [0, 50], [0.2, 85], [0.4, 100]),
        },
        posTransactions: {
          label: 'POS işlem adedi',
          description: `POS işlem sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.15,
          source: { series: 'posTransactions' },
          measure: yoy(3),
          breakpoints: bp([-0.2, 0], [0, 55], [0.15, 90], [0.25, 100]),
        },
        schoolSeason: {
          label: 'Okul sezonu performansı',
          description:
            'Okul açılışı (Ağustos sonu–Eylül) ve ikinci dönem (Şubat) aylarındaki POS cirosunun bir önceki sezona göre değişimi',
          unit: 'change',
          weight: 0.25,
          source: { series: 'posRevenue' },
          measure: { kind: 'periodChange', calendarMonths: [2, 8, 9] },
          breakpoints: bp([-0.2, 0], [0, 50], [0.2, 85], [0.4, 100]),
        },
        inventoryTurnover: {
          label: 'Stok devir hızı',
          description: TURNOVER_DESC,
          unit: 'times',
          weight: 0.15,
          source: { series: 'inventoryTurnover' },
          measure: mean(12),
          breakpoints: bp([2, 0], [4, 50], [6, 80], [8, 100]),
        },
        supplierPayment: {
          label: 'Tedarikçi ödeme düzeni',
          description: 'Tedarikçilere vadesinde yapılan ödemelerin toplam ödemelere oranı',
          unit: 'share',
          weight: 0.25,
          source: { series: 'supplierOnTimePaymentRate' },
          measure: mean(6),
          breakpoints: bp([0.7, 0], [0.85, 50], [0.95, 85], [1.0, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'Ağustos sonu–Eylül ana pik (okul açılışı), Şubat ikinci pik',
            index: [0.75, 1.15, 0.85, 0.8, 0.8, 0.7, 0.75, 1.45, 2.0, 1.0, 0.9, 0.85],
          },
        },
      },
      // Okul sezonu öncesi stok alımı için spot ağırlığı yüksek
      productMix: { revolving: 0.4, spot: 0.4, nonCash: 0.2, inventoryFinance: 0 },
    },

    tourism: {
      label: 'Turizm Acentesi',
      riskCoefficient: 0.85,
      cccMedianDays: 15,
      indicators: {
        bookingVolume: {
          label: 'Rezervasyon hacmi',
          description: `Alınan rezervasyon sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.25,
          source: { series: 'bookings' },
          measure: yoy(6),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.15, 85], [0.3, 100]),
        },
        cancellationRate: {
          label: 'İptal oranı',
          description: 'İptal edilen rezervasyonların toplam rezervasyonlara oranı',
          unit: 'share',
          weight: 0.2,
          source: { series: 'cancellationRate' },
          measure: mean(12),
          breakpoints: bp([0.05, 100], [0.1, 75], [0.2, 35], [0.3, 0]),
        },
        earlyBookingRate: {
          label: 'Erken rezervasyon oranı',
          description: 'Erken rezervasyon döneminde alınan rezervasyonların toplam rezervasyonlara oranı',
          unit: 'share',
          weight: 0.2,
          source: { series: 'earlyBookingRate' },
          measure: mean(12),
          breakpoints: bp([0.05, 0], [0.15, 40], [0.3, 80], [0.45, 100]),
        },
        customerRating: {
          label: 'Müşteri yorum puanı',
          description: 'Seyahat platformlarındaki ortalama müşteri puanı (5 üzerinden)',
          unit: 'rating5',
          weight: 0.2,
          source: { series: 'customerRating' },
          measure: mean(6),
          breakpoints: bp([3.5, 0], [4.0, 50], [4.5, 85], [4.8, 100]),
        },
        tursabLicense: {
          label: 'TÜRSAB belge durumu',
          description: 'TÜRSAB acente belgesinin geçerliliği (geçerli = 1, askıda / iptal = 0)',
          unit: 'binary',
          weight: 0.15,
          source: { series: 'tursabLicenseValid' },
          measure: { kind: 'latest' },
          breakpoints: bp([0, 0], [1, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'summer',
        profiles: {
          summer: {
            label: 'Yaz turizmi',
            description: 'Haziran–Eylül pik; kış ayları düşük',
            index: [0.45, 0.5, 0.65, 0.85, 1.1, 1.5, 1.85, 1.9, 1.4, 0.85, 0.5, 0.45],
          },
          winter: {
            label: 'Kış turizmi',
            description: 'Aralık–Mart pik (kayak ve yılbaşı); yaz ayları düşük',
            index: [1.8, 1.75, 1.3, 0.75, 0.55, 0.45, 0.4, 0.45, 0.6, 0.8, 1.1, 2.05],
          },
        },
      },
      // Sezon öncesi spot ağırlıklı; acente ve otel ön ödeme teminat mektupları
      productMix: { revolving: 0.2, spot: 0.5, nonCash: 0.3, inventoryFinance: 0 },
    },

    restaurant: {
      label: 'Restoran / Kafe',
      riskCoefficient: 0.9,
      cccMedianDays: 10,
      indicators: {
        mapRating: {
          label: 'Harita platformu puanı',
          description: 'Harita uygulamasındaki işletme puanı (5 üzerinden)',
          unit: 'rating5',
          weight: 0.15,
          source: { series: 'mapRating' },
          measure: mean(3),
          breakpoints: bp([3.5, 0], [4.0, 50], [4.4, 85], [4.7, 100]),
        },
        deliveryPlatformRating: {
          label: 'Yemek platformu puanı',
          description: 'Yemek Platformu A restoran puanı (10 üzerinden)',
          unit: 'rating10',
          weight: 0.15,
          source: { series: 'deliveryPlatformRating' },
          measure: mean(3),
          breakpoints: bp([7.0, 0], [8.0, 50], [8.8, 85], [9.4, 100]),
        },
        onlineOrders: {
          label: 'Online sipariş adedi',
          description: `Yemek platformu üzerinden alınan sipariş sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'onlineOrders' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.25, 100]),
        },
        posTransactions: {
          label: 'POS işlem sayısı',
          description: `Salon POS işlem adedi; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'posTransactions' },
          measure: yoy(3),
          breakpoints: bp([-0.25, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        averageTicket: {
          label: 'Ortalama adisyon',
          description: `POS cirosu / POS işlem sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.1,
          source: { ratio: ['posRevenue', 'posTransactions'] },
          measure: yoy(3),
          breakpoints: bp([-0.1, 0], [0, 40], [0.2, 80], [0.35, 100]),
        },
        sgkHeadcount: {
          label: 'SGK çalışan sayısı trendi',
          description: `SGK bildirgelerine göre sigortalı çalışan sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'sgkHeadcount' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 60], [0.15, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'Hafif dalgalı; Ramazan dönemi (Şubat–Mart) hafif düşüş, yaz aylarında artış',
            index: [0.92, 0.93, 0.94, 1.0, 1.03, 1.08, 1.1, 1.08, 1.02, 1.0, 0.95, 0.95],
          },
        },
      },
      productMix: { revolving: 0.6, spot: 0.3, nonCash: 0.1, inventoryFinance: 0 },
    },

    buildingMaterials: {
      label: 'Yapı Malzemesi',
      riskCoefficient: 0.9,
      cccMedianDays: 90,
      indicators: {
        buildingPermits: {
          label: 'Bölgesel yapı ruhsatı verisi',
          description: `Firmanın faaliyet gösterdiği ilde verilen yapı ruhsatı sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'regionalBuildingPermits' },
          measure: yoy(6),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        eDispatchVolume: {
          label: 'e-İrsaliye hacmi',
          description: `Düzenlenen e-irsaliye adedi; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.3,
          source: { series: 'eDispatchCount' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        chequePayment: {
          label: 'Çek ödeme performansı',
          description: 'Vadesinde karşılığı ödenen çeklerin vadesi gelen çeklere oranı',
          unit: 'share',
          weight: 0.3,
          source: { series: 'chequePaidOnTimeRate' },
          measure: mean(6),
          breakpoints: bp([0.85, 0], [0.95, 60], [0.99, 90], [1.0, 100]),
        },
        publicTenders: {
          label: 'Kamu ihale kazanımları',
          description: 'Kazanılan kamu ihalesi sayısı (aylık ortalama)',
          unit: 'count',
          weight: 0.2,
          source: { series: 'publicTenderWins' },
          measure: mean(12),
          breakpoints: bp([0, 30], [0.25, 60], [0.5, 80], [1.0, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'İlkbahar–sonbahar inşaat sezonu yüksek; kış düşük',
            index: [0.7, 0.7, 0.9, 1.1, 1.2, 1.2, 1.15, 1.15, 1.15, 1.1, 0.9, 0.75],
          },
        },
      },
      // Kamu ihaleleri için teminat mektubu payı yüksek
      productMix: { revolving: 0.4, spot: 0.25, nonCash: 0.35, inventoryFinance: 0 },
    },

    textileExport: {
      label: 'Tekstil / Hazır Giyim İhracatçısı',
      riskCoefficient: 0.95,
      cccMedianDays: 95,
      indicators: {
        exportInvoiceVolume: {
          label: 'e-Fatura / e-İhracat hacmi',
          description: `Düzenlenen e-fatura ve e-ihracat faturası tutarı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.25,
          source: { series: 'eExportInvoiceAmount' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.25, 100]),
        },
        exportDeclarations: {
          label: 'İhracat beyannamesi sayısı',
          description: `Gümrük ihracat beyannamesi adedi; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.15,
          source: { series: 'exportDeclarations' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        orderBacklog: {
          label: 'Sipariş birikimi',
          description: 'Teyitli ve henüz sevk edilmemiş siparişlerin aylık ortalama sevkiyata oranı (kaç aylık iş)',
          unit: 'months',
          weight: 0.25,
          source: { series: 'orderBacklogMonths' },
          measure: mean(3),
          breakpoints: bp([0.5, 0], [1.5, 50], [3.0, 85], [4.0, 100]),
        },
        customerConcentration: {
          label: 'Müşteri yoğunlaşması',
          description: 'En büyük 3 müşterinin ihracat içindeki payı',
          unit: 'share',
          weight: 0.2,
          source: { series: 'top3CustomerShare' },
          measure: mean(3),
          breakpoints: bp([0.3, 100], [0.5, 70], [0.7, 30], [0.9, 0]),
        },
        fxPosition: {
          label: 'Döviz pozisyonu',
          description: 'Net döviz açık pozisyonunun özkaynağa oranı (açık pozisyon pozitif, fazla pozisyon negatif)',
          unit: 'ratio',
          weight: 0.15,
          source: { series: 'netFxShortToEquity' },
          measure: { kind: 'latest' },
          breakpoints: bp([0, 100], [0.25, 70], [0.5, 35], [1.0, 0]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'İlkbahar/yaz ve sonbahar/kış koleksiyonları öncesi sevkiyat dönemleri (Şubat–Mart, Ağustos–Eylül)',
            index: [0.9, 1.1, 1.2, 1.05, 0.9, 0.85, 1.0, 1.1, 1.2, 1.05, 0.85, 0.8],
          },
        },
      },
      productMix: { revolving: 0.4, spot: 0.4, nonCash: 0.2, inventoryFinance: 0 },
    },

    agriFood: {
      label: 'Tarım / Gıda Toptan',
      riskCoefficient: 0.9,
      cccMedianDays: 60,
      indicators: {
        harvestVolume: {
          label: 'Hasat dönemi hacmi',
          description: 'Hasat aylarında (Haziran–Ekim) alınan ürün miktarının bir önceki hasat dönemine göre değişimi',
          unit: 'change',
          weight: 0.3,
          source: { series: 'purchaseVolumeTons' },
          measure: { kind: 'periodChange', calendarMonths: [6, 7, 8, 9, 10] },
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        commodityPriceTrend: {
          label: 'Ürün borsası fiyat trendi',
          description: `Firmanın işlediği ürünlerin ticaret borsası ortalama fiyatı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.2,
          source: { series: 'commodityPrice' },
          measure: yoy(3),
          breakpoints: bp([-0.2, 0], [0, 40], [0.3, 85], [0.5, 100]),
        },
        warehouseOccupancy: {
          label: 'Depo doluluk oranı',
          description:
            'Kullanılan depo kapasitesinin toplam kapasiteye oranı; çok düşük doluluk atıl kapasiteyi, çok yüksek doluluk satılamayan stoğu işaret eder',
          unit: 'share',
          weight: 0.2,
          source: { series: 'warehouseOccupancy' },
          measure: mean(12),
          breakpoints: bp([0.2, 0], [0.5, 60], [0.75, 100], [0.9, 80], [1.0, 40]),
        },
        eDispatchVolume: {
          label: 'e-İrsaliye hacmi',
          description: `Düzenlenen e-irsaliye adedi; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.3,
          source: { series: 'eDispatchCount' },
          measure: yoy(3),
          breakpoints: bp([-0.3, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'Hasat ayları (Haziran–Ekim) yüksek; kış ve ilkbahar düşük',
            index: [0.75, 0.7, 0.75, 0.8, 0.9, 1.2, 1.4, 1.35, 1.3, 1.2, 0.9, 0.75],
          },
        },
      },
      // Hasat alımları için spot ağırlıklı
      productMix: { revolving: 0.3, spot: 0.5, nonCash: 0.2, inventoryFinance: 0 },
    },

    logistics: {
      label: 'Lojistik / Nakliye',
      riskCoefficient: 1.0,
      cccMedianDays: 50,
      indicators: {
        fleetUtilization: {
          label: 'Filo kullanım oranı (telematik)',
          description: 'Telematik verisine göre araçların aktif seferde geçirdiği gün oranı',
          unit: 'share',
          weight: 0.3,
          source: { series: 'fleetUtilization' },
          measure: mean(3),
          breakpoints: bp([0.5, 0], [0.7, 50], [0.85, 85], [0.95, 100]),
        },
        tripCount: {
          label: 'Sefer sayısı',
          description: `Tamamlanan sefer adedi; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.25,
          source: { series: 'tripCount' },
          measure: yoy(3),
          breakpoints: bp([-0.25, 0], [-0.1, 35], [0, 55], [0.2, 100]),
        },
        fuelPerKm: {
          label: 'Yakıt harcaması / km',
          description: 'Telematik verisine göre 100 km başına ortalama yakıt tüketimi (litre)',
          unit: 'lPer100km',
          weight: 0.15,
          source: { series: 'fuelLitresPer100Km' },
          measure: mean(3),
          breakpoints: bp([28, 100], [32, 75], [36, 40], [40, 0]),
        },
        collectionDays: {
          label: 'Tahsilat süresi',
          description: 'Faturalandırılan navlun bedelinin ortalama tahsil süresi (gün)',
          unit: 'days',
          weight: 0.3,
          source: { series: 'collectionDays' },
          measure: mean(3),
          breakpoints: bp([30, 100], [45, 80], [60, 55], [90, 15], [120, 0]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: '4. çeyrek pik (yıl sonu ticaret ve ihracat yoğunluğu)',
            index: [0.88, 0.85, 0.95, 0.97, 0.98, 0.97, 0.95, 0.95, 1.02, 1.12, 1.18, 1.18],
          },
        },
      },
      // Taşıma ve gümrük teminat mektupları
      productMix: { revolving: 0.5, spot: 0.25, nonCash: 0.25, inventoryFinance: 0 },
    },

    pharmacy: {
      label: 'Eczane',
      riskCoefficient: 1.05,
      cccMedianDays: 35,
      indicators: {
        prescriptionVolume: {
          label: 'SGK reçete hacmi',
          description: `SGK sistemine göre karşılanan reçete sayısı; ${YOY_DESC}`,
          unit: 'change',
          weight: 0.35,
          source: { series: 'sgkPrescriptions' },
          measure: yoy(3),
          breakpoints: bp([-0.2, 0], [-0.05, 40], [0, 55], [0.15, 100]),
        },
        sgkPaymentDelay: {
          label: 'SGK ödeme gecikmesi',
          description: 'SGK reçete bedellerinin sözleşme vadesini aşan ortalama ödeme gecikmesi (gün)',
          unit: 'days',
          weight: 0.25,
          source: { series: 'sgkPaymentDelayDays' },
          measure: mean(3),
          breakpoints: bp([0, 100], [15, 75], [30, 40], [60, 0]),
        },
        inventoryTurnover: {
          label: 'Stok devir hızı',
          description: TURNOVER_DESC,
          unit: 'times',
          weight: 0.2,
          source: { series: 'inventoryTurnover' },
          measure: mean(3),
          breakpoints: bp([4, 0], [6, 50], [9, 85], [12, 100]),
        },
        nonPrescriptionShare: {
          label: 'Reçete dışı satış payı',
          description:
            'Reçetesiz ilaç, dermokozmetik ve diğer ürün satışlarının toplam satışa oranı; SGK bağımlılığını ölçer',
          unit: 'share',
          weight: 0.2,
          source: { series: 'nonPrescriptionSalesShare' },
          measure: mean(6),
          breakpoints: bp([0, 0], [0.1, 40], [0.2, 75], [0.3, 100]),
        },
      },
      seasonality: {
        defaultProfile: 'standard',
        profiles: {
          standard: {
            label: 'Standart',
            description: 'Kış (grip dönemi) yüksek; yaz ayları düşük',
            index: [1.2, 1.15, 1.05, 0.95, 0.9, 0.85, 0.85, 0.85, 0.95, 1.0, 1.1, 1.15],
          },
        },
      },
      // SGK tahsilat döngüsü nedeniyle rotatif ağırlıklı
      productMix: { revolving: 0.6, spot: 0.25, nonCash: 0.15, inventoryFinance: 0 },
    },
  },

  presentation: {
    strengthBands: { strongMin: 70, moderateMin: 40 },
    topFactorCount: 3,
  },

  decision: {
    revisionJustificationThreshold: 0.2,
  },
}

// ---------------------------------------------------------------------------
// Dışa açılan varsayılanlar
// ---------------------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** Model v1.0 varsayılanları. Değiştirilemez; düzenleme için `createDefaultModelConfig()` kullanın. */
export const DEFAULT_MODEL_CONFIG: Readonly<ModelConfig> = deepFreeze(DEFAULTS)

/** v1.0 varsayılanlarının düzenlenebilir, bağımsız bir kopyası. */
export function createDefaultModelConfig(): ModelConfig {
  return structuredClone(DEFAULTS)
}
