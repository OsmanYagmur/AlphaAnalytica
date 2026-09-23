import type { BreakpointCurve } from './modelConfig'

/**
 * Parçalı doğrusal normalizasyon: değeri kırılım noktaları arasında doğrusal
 * interpolasyonla puana çevirir. Uç değerler kırpılır (ilk noktanın solunda ilk
 * puan, son noktanın sağında son puan). ±∞ değerler de uçlara kırpılır.
 * Tanımsız (NaN) değer, eğrinin en düşük puanını alır.
 */
export function normalize(value: number, curve: BreakpointCurve): number {
  if (curve.length === 0) throw new Error('Kırılım eğrisi boş olamaz')
  const points = [...curve].sort((a, b) => a.value - b.value)
  if (Number.isNaN(value)) return Math.min(...points.map((p) => p.score))

  const first = points[0]
  const last = points[points.length - 1]
  if (value <= first.value) return first.score
  if (value >= last.value) return last.score

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (value <= b.value) {
      const t = (value - a.value) / (b.value - a.value)
      return a.score + t * (b.score - a.score)
    }
  }
  return last.score
}
