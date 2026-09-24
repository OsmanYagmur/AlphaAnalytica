/** tr-TR biçimlendirme yardımcıları. */

import type { IndicatorUnit } from '../engine/modelConfig'

const numberFormats = new Map<number, Intl.NumberFormat>()
function nf(digits: number): Intl.NumberFormat {
  let f = numberFormats.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    numberFormats.set(digits, f)
  }
  return f
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return nf(digits).format(value)
}

/** 1.250.000 ₺ */
export function formatTL(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${nf(0).format(Math.round(value))} ₺`
}

/** Kısa tutar: 1,25 mn ₺ */
export function formatTLShort(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2)} mr ₺`
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} mn ₺`
  if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 0)} bin ₺`
  return formatTL(value)
}

/** Skor: bir ondalık, aşağı yuvarlanır (not eşiğiyle çelişmesin). */
export function formatScore(value: number): string {
  return formatNumber(Math.floor(value * 10 + 1e-9) / 10, 1)
}

/** Kesir → Türkçe yüzde: 0,125 → %12,5 */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  const s = formatNumber(Math.abs(value) * 100, digits)
  return value < 0 ? `−%${s}` : `%${s}`
}

export function formatSignedPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '—'
  if (value > 0) return `+%${formatNumber(value * 100, digits)}`
  return formatPercent(value, digits)
}

const dateFormat = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** '2026-09' → 'Eyl 26' */
export function formatYearMonth(ym: string): string {
  return `${MONTHS_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`
}

/** Bugünden geriye gün sayısı. */
export function daysSince(isoDate: string, now = new Date()): number {
  const start = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86_400_000))
}

/** Alternatif gösterge değerini birimine göre biçimlendirir. */
export function formatIndicatorValue(value: number | null, unit: IndicatorUnit): string {
  if (value === null || !Number.isFinite(value)) return 'Veri yok'
  switch (unit) {
    case 'rating5':
      return `${formatNumber(value, 2)} / 5`
    case 'rating10':
      return `${formatNumber(value, 1)} / 10`
    case 'share':
      return formatPercent(value)
    case 'change':
      return formatSignedPercent(value)
    case 'days':
      return `${formatNumber(value, 0)} gün`
    case 'months':
      return `${formatNumber(value, 1)} ay`
    case 'times':
      return `${formatNumber(value, 1)} kez`
    case 'count':
      return `${formatNumber(value, 2)} / ay`
    case 'lPer100km':
      return `${formatNumber(value, 1)} L/100 km`
    case 'ratio':
      return formatNumber(value, 2)
    case 'binary':
      return value >= 1 ? 'Geçerli' : 'Geçersiz'
  }
}

/** Gösterge serisinin tek bir aylık değerini (grafik ipucu için) biçimlendirir. */
export function formatSeriesValue(value: number): string {
  if (Math.abs(value) >= 10_000) return formatNumber(value, 0)
  if (Math.abs(value) >= 100) return formatNumber(value, 0)
  if (Math.abs(value) >= 10) return formatNumber(value, 1)
  return formatNumber(value, 2)
}
