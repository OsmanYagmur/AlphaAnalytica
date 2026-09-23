/**
 * Başlangıç karar durumları: 8 firma "Tahsis Bekliyor", 6 firma karara bağlanmış.
 * Karara bağlanmış firmaların sistem görüşü, kararın verildiği andaki veriyle
 * (`dataAsOf`) ve kararın model sürümüyle motor tarafından hesaplanır; burada
 * yalnızca tahsis yöneticisinin kararı ve gerekçesi tutulur.
 */

import { BASE_MODEL_VERSION } from '../engine/modelConfig'
import type { SeedDecision } from './types'

/** Red gerekçeleri (Karar Paneli açılır listesi). */
export const REJECTION_REASONS = {
  insufficientRepayment: 'Yetersiz geri ödeme kapasitesi',
  weakAlternativeData: 'Alternatif veride belirgin bozulma',
  highLeverage: 'Yüksek kaldıraç / zayıf özkaynak',
  collateralInsufficient: 'Teminat yetersizliği',
  declarationInconsistency: 'Beyan tutarsızlığı',
  negativeRecords: 'Olumsuz kayıt (çek / vergi / SGK)',
  other: 'Diğer',
} as const

export type RejectionReasonId = keyof typeof REJECTION_REASONS

/** Tahsis kuyruğunda bekleyen firmalar. */
export const PENDING_FIRM_IDS: readonly string[] = [
  'defne-kirtasiye',
  'kuzey-oto',
  'palandoken-turizm',
  'cinaralti-restoran',
  'anadolu-yapi',
  'toros-yapi',
  'denizli-dokuma',
  'karadeniz-nakliyat',
]

export const SEED_DECISIONS: SeedDecision[] = [
  {
    firmId: 'mavi-sepet',
    status: 'approved',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Elif Karaca',
    decidedAt: '2026-03-06T10:42:00+03:00',
    dataAsOf: '2026-02',
    note: 'Pazaryeri performansı ve sipariş hacmi güçlü; sistem önerisi aynen onaylandı.',
    auditLog: [
      { at: '2026-03-04T09:15:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      { at: '2026-03-06T10:42:00+03:00', by: 'Elif Karaca', action: 'Sistem önerisiyle onaylandı' },
    ],
  },
  {
    firmId: 'marmara-lojistik',
    status: 'approved',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Murat Aksoy',
    decidedAt: '2026-04-24T14:05:00+03:00',
    dataAsOf: '2026-03',
    note: 'Filo kullanımı ve tahsilat performansı sektörün üzerinde; müşterek kefaletle onaylandı.',
    auditLog: [
      { at: '2026-04-21T11:20:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      { at: '2026-04-24T14:05:00+03:00', by: 'Murat Aksoy', action: 'Sistem önerisiyle onaylandı' },
    ],
  },
  {
    firmId: 'sifa-eczanesi',
    status: 'revisedApproved',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Elif Karaca',
    decidedAt: '2026-06-05T16:30:00+03:00',
    dataAsOf: '2026-05',
    revisedTerms: {
      limit: 2_000_000,
      collateralRatio: 0.25,
      collateralType: 'receivablesAssignment',
      tenorMonths: 24,
      productMix: { revolving: 0.6, spot: 0.25, nonCash: 0.15, inventoryFinance: 0 },
      covenants: ['SGK reçete alacaklarının bankaya temliki', 'Aylık SGK ödeme listesinin paylaşılması'],
    },
    note: 'Limit, firmanın talep ettiği tutarla sınırlandırıldı; SGK alacak temliki şartı eklendi.',
    auditLog: [
      { at: '2026-06-03T10:00:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      { at: '2026-06-05T16:30:00+03:00', by: 'Elif Karaca', action: 'Revize onay: limit 2.250.000 → 2.000.000 ₺, kovenant eklendi' },
    ],
  },
  {
    firmId: 'cukurova-tarim',
    status: 'revisedApproved',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Murat Aksoy',
    decidedAt: '2026-05-14T11:10:00+03:00',
    dataAsOf: '2026-04',
    revisedTerms: {
      limit: 1_300_000,
      collateralRatio: 1,
      collateralType: 'mortgage',
      tenorMonths: 12,
      productMix: { revolving: 0.3, spot: 0.5, nonCash: 0.2, inventoryFinance: 0 },
      covenants: ['Hasat dönemi alımlarında ürün senedi rehni', 'Aylık e-irsaliye özetinin paylaşılması'],
    },
    note:
      'Hasat dönemi verisi başvuru anında eksikti ve emtia fiyatlarında oynaklık yüksek; limit düşürülüp teminat oranı %100’e çıkarıldı.',
    auditLog: [
      { at: '2026-05-12T09:40:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      {
        at: '2026-05-14T11:10:00+03:00',
        by: 'Murat Aksoy',
        action: 'Revize onay: limit 1.700.000 → 1.300.000 ₺, teminat %75 → %100',
      },
    ],
  },
  {
    firmId: 'bodrum-mavi-tur',
    status: 'approved',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Zeynep Tunç',
    decidedAt: '2026-04-10T15:25:00+03:00',
    dataAsOf: '2026-03',
    note: 'Sezon öncesi finansman ihtiyacı; sistem önerisi ipotek teminatıyla onaylandı.',
    auditLog: [
      { at: '2026-04-08T10:30:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      { at: '2026-04-10T15:25:00+03:00', by: 'Zeynep Tunç', action: 'Sistem önerisiyle onaylandı' },
    ],
  },
  {
    firmId: 'kapadokya-kafe',
    status: 'rejected',
    modelVersion: BASE_MODEL_VERSION,
    decidedBy: 'Zeynep Tunç',
    decidedAt: '2026-05-22T12:00:00+03:00',
    dataAsOf: '2026-04',
    rejectionReason: 'weakAlternativeData',
    note: 'Platform puanları, online sipariş ve SGK çalışan sayısı düşüşte; nakit akışı talebi karşılamıyor.',
    auditLog: [
      { at: '2026-05-20T13:45:00+03:00', by: 'Sistem', action: 'Başvuru alındı' },
      { at: '2026-05-22T12:00:00+03:00', by: 'Zeynep Tunç', action: 'Reddedildi: Alternatif veride belirgin bozulma' },
    ],
  },
]
