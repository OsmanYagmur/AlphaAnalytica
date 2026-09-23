import { describe, expect, it } from 'vitest'
import { floorToUnit, linearRegression, positiveBaseRatio } from './math'
import type { BreakpointCurve } from './modelConfig'
import { normalize } from './normalize'

const bp = (...p: [number, number][]): BreakpointCurve => p.map(([value, score]) => ({ value, score }))

describe('normalize — parçalı doğrusal interpolasyon', () => {
  const currentRatio = bp([0.8, 0], [1.0, 40], [1.5, 80], [2.0, 100])

  it('kırılım noktalarında tam puanı verir', () => {
    expect(normalize(0.8, currentRatio)).toBe(0)
    expect(normalize(1.0, currentRatio)).toBe(40)
    expect(normalize(1.5, currentRatio)).toBe(80)
    expect(normalize(2.0, currentRatio)).toBe(100)
  })

  it('noktalar arasında doğrusal interpolasyon yapar', () => {
    expect(normalize(0.9, currentRatio)).toBeCloseTo(20, 10)
    expect(normalize(1.25, currentRatio)).toBeCloseTo(60, 10)
    expect(normalize(1.575, currentRatio)).toBeCloseTo(83, 10)
  })

  it('uç değerleri kırpar (±∞ dahil)', () => {
    expect(normalize(0.1, currentRatio)).toBe(0)
    expect(normalize(5, currentRatio)).toBe(100)
    expect(normalize(Infinity, currentRatio)).toBe(100)
    expect(normalize(-Infinity, currentRatio)).toBe(0)
  })

  it('azalan eğrilerde (düşük değer iyi) çalışır', () => {
    const debtToEquity = bp([0.5, 100], [1, 80], [2, 50], [4, 0])
    expect(normalize(0.2, debtToEquity)).toBe(100)
    expect(normalize(1.5, debtToEquity)).toBeCloseTo(65, 10)
    expect(normalize(3, debtToEquity)).toBeCloseTo(25, 10)
    expect(normalize(Infinity, debtToEquity)).toBe(0)
  })

  it('monoton olmayan (ters U) eğrileri destekler', () => {
    const occupancy = bp([0.2, 0], [0.5, 60], [0.75, 100], [0.9, 80], [1.0, 40])
    expect(normalize(0.75, occupancy)).toBe(100)
    expect(normalize(0.95, occupancy)).toBeCloseTo(60, 10)
  })

  it('sırasız verilen noktaları sıralayarak kullanır', () => {
    expect(normalize(1.25, bp([2.0, 100], [1.0, 40], [1.5, 80], [0.8, 0]))).toBeCloseTo(60, 10)
  })

  it('NaN değer eğrinin en düşük puanını alır; tek noktalı eğri sabittir; boş eğri hata verir', () => {
    expect(normalize(NaN, currentRatio)).toBe(0)
    expect(normalize(3, bp([1, 70]))).toBe(70)
    expect(() => normalize(1, [])).toThrow()
  })
})

describe('math yardımcıları', () => {
  it('positiveBaseRatio: pozitif paydada bölme, aksi halde payın işaretine göre ±∞ / 0', () => {
    expect(positiveBaseRatio(6, 4)).toBe(1.5)
    expect(positiveBaseRatio(5, 0)).toBe(Infinity)
    expect(positiveBaseRatio(5, -2)).toBe(Infinity)
    expect(positiveBaseRatio(-5, 0)).toBe(-Infinity)
    expect(positiveBaseRatio(0, 0)).toBe(0)
  })

  it('linearRegression: eğim ve kesişim', () => {
    const { slope, intercept } = linearRegression([1, 2, 3, 4, 5, 6])
    expect(slope).toBeCloseTo(1, 12)
    expect(intercept).toBeCloseTo(1, 12)
    expect(linearRegression([7])).toEqual({ slope: 0, intercept: 7 })
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0 })
  })

  it('floorToUnit: birime aşağı yuvarlar, kayan nokta hatasına dayanıklıdır', () => {
    expect(floorToUnit(858_000, 50_000)).toBe(850_000)
    expect(floorToUnit(0.1 * 3 * 1_000_000, 100_000)).toBe(300_000)
    expect(floorToUnit(1_249_999.99999999, 50_000)).toBe(1_250_000)
    expect(floorToUnit(-10_000, 50_000)).toBe(-50_000)
  })
})
