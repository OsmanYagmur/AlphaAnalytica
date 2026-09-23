/**
 * Birim testleri için elle doğrulanabilir örnek girdiler. Uygulama tarafından
 * kullanılmaz.
 */

import type { TraditionalInput, TrialBalanceLine } from './types'

const line = (code: string, name: string, debit: number, credit = 0): TrialBalanceLine => ({
  code,
  name,
  debit,
  credit,
})

/**
 * Örnek mizan (kapanış öncesi; 590/591 yok).
 * Beklenen: Hazır değerler 900.000, Dönen varlıklar 6.300.000, Duran 1.000.000,
 * KVYK 4.000.000, UVYK 1.000.000, Net satış 12.000.000, SMM 8.400.000,
 * Faaliyet gid. 2.300.000, FAVÖK 1.600.000, Net kâr 500.000, Özkaynak 2.300.000.
 */
export const SAMPLE_TRIAL_BALANCE: TrialBalanceLine[] = [
  line('100', 'Kasa', 150_000),
  line('102', 'Bankalar', 850_000),
  line('103', 'Verilen Çekler ve Ödeme Emirleri (−)', 0, 100_000),
  line('120', 'Alıcılar', 2_400_000),
  line('153', 'Ticari Mallar', 3_000_000),
  line('255', 'Demirbaşlar', 1_500_000),
  line('257', 'Birikmiş Amortismanlar (−)', 0, 500_000),
  line('300', 'Banka Kredileri', 0, 2_000_000),
  line('320', 'Satıcılar', 0, 1_800_000),
  line('360', 'Ödenecek Vergi ve Fonlar', 0, 200_000),
  line('400', 'Banka Kredileri', 0, 1_000_000),
  line('500', 'Sermaye', 0, 1_500_000),
  line('570', 'Geçmiş Yıllar Kârları', 0, 300_000),
  line('600', 'Yurtiçi Satışlar', 0, 12_500_000),
  line('610', 'Satıştan İadeler (−)', 500_000),
  line('621', 'Satılan Ticari Mallar Maliyeti (−)', 8_400_000),
  line('631', 'Pazarlama Satış ve Dağıtım Giderleri (−)', 1_400_000),
  line('632', 'Genel Yönetim Giderleri (−)', 900_000),
  line('780', 'Finansman Giderleri', 700_000),
  line('691', 'Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)', 100_000),
]

export const SAMPLE_TRADITIONAL_INPUT: TraditionalInput = {
  trialBalance: SAMPLE_TRIAL_BALANCE,
  taxReturn: { netSales: 12_300_000, taxBase: 600_000, taxPaid: 150_000 },
  supplement: { depreciation: 300_000, annualDebtService: 300_000 },
}

/** 'YYYY-MM' başlangıçlı ardışık `count` ay. */
export function monthRange(start: string, count: number): string[] {
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5, 7))
  const months: string[] = []
  for (let i = 0; i < count; i++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  return months
}

/** Eylül 2024 – Ağustos 2026 (24 ay). */
export const MONTHS_24 = monthRange('2024-09', 24)

/** Aylara sezon endeksini uygular: değer_t = f(t) × S_{ay(t)}. */
export function seasonalSeries(months: string[], index: readonly number[], level: (t: number) => number): number[] {
  return months.map((m, t) => level(t) * index[Number(m.slice(5, 7)) - 1])
}
