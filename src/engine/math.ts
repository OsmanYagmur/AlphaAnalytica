/**
 * Motor için sayısal yardımcılar. Buradaki sabitler model parametresi değil,
 * tanımsal büyüklüklerdir (takvim ve puan ölçeği).
 */

/** Bir yıldaki ay sayısı. */
export const MONTHS_PER_YEAR = 12

/** Puan ölçeğinin üst sınırı (0–100). */
export const SCORE_SCALE = 100

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : sum(values) / values.length
}

/**
 * Pozitif paydalı oran. Payda sıfır veya negatifse oran anlamını yitirir;
 * bu durumda payın işaretine göre ±∞ (pay sıfırsa 0) döner. Normalizasyon
 * ±∞ değerleri kırılım eğrisinin uçlarına kırpar.
 */
export function positiveBaseRatio(numerator: number, denominator: number): number {
  if (denominator > 0) return numerator / denominator
  if (numerator > 0) return Infinity
  if (numerator < 0) return -Infinity
  return 0
}

/** En küçük kareler doğrusu; x = 0, 1, …, n − 1. */
export function linearRegression(ys: readonly number[]): { slope: number; intercept: number } {
  const n = ys.length
  if (n === 0) return { slope: 0, intercept: 0 }
  if (n === 1) return { slope: 0, intercept: ys[0] }
  const xMean = (n - 1) / 2
  const yMean = mean(ys)
  let sxy = 0
  let sxx = 0
  ys.forEach((y, x) => {
    sxy += (x - xMean) * (y - yMean)
    sxx += (x - xMean) ** 2
  })
  const slope = sxy / sxx
  return { slope, intercept: yMean - slope * xMean }
}

/** Kayan nokta hatasına dayanıklı aşağı yuvarlama (ör. 1.249.999,9999 → 1.250.000 birimine). */
export function floorToUnit(value: number, unit: number): number {
  if (unit <= 0) return value
  return Math.floor(value / unit + 1e-9) * unit
}
