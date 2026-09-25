/**
 * 4) Limit.
 *
 * K1 = Net Satış × max(NDS; min gün) / yıl günü × K1 çarpanı − Diğer bankalardaki işletme sermayesi nakdi riski × düşüm oranı
 *      (işletme sermayesi ihtiyacının henüz finanse edilmemiş kısmı; negatifse 0)
 * K2 = Özkaynak × K2 çarpanı                                   (özkaynak kapasitesi)
 * K3 = max(0; FAVÖK × FAVÖK oranı − Mevcut Yıllık Kredi Ödemeleri) × K3 çarpanı
 *      (mevcut yıllık kredi ödemeleri: KKB'deki vadeli kredilerin önümüzdeki 12 aydaki anapara ödemeleri)
 * Kapasite = min(K1; K2; K3)
 * Önerilen Limit = Kapasite × f(not) × SRK, yuvarlama birimine aşağı yuvarlanır (negatifse 0).
 */

import { floorToUnit } from './math'
import type { CreditGrade, ModelConfig, SectorId } from './modelConfig'

export interface LimitInput {
  netSales: number
  /** Nakit Dönüşüm Süresi (gün). */
  cashConversionCycle: number
  equity: number
  ebitda: number
  annualDebtService: number
  /** K1'den düşülecek tutar: diğer bankalardaki işletme sermayesi nakdi riski × düşüm oranı (KKB yoksa 0). */
  otherBankDeduction?: number
}

export type CapacityComponent = 'k1' | 'k2' | 'k3'

export interface LimitResult {
  /** Düşüm öncesi işletme sermayesi ihtiyacı. */
  k1Gross: number
  /** K1'den düşülen diğer banka işletme sermayesi riski. */
  otherBankDeduction: number
  k1: number
  k2: number
  k3: number
  capacity: number
  /** Kapasiteyi belirleyen (en küçük) bileşen. */
  binding: CapacityComponent
  gradeMultiplier: number
  sectorRiskCoefficient: number
  /** Yuvarlama öncesi tutar. */
  unrounded: number
  /** Önerilen limit (TL). */
  limit: number
}

export function computeCapacity(
  input: LimitInput,
  config: ModelConfig,
): Pick<LimitResult, 'k1Gross' | 'otherBankDeduction' | 'k1' | 'k2' | 'k3' | 'capacity' | 'binding'> {
  const { k1: k1c, k2: k2c, k3: k3c } = config.limit
  const k1Gross = (input.netSales * Math.max(input.cashConversionCycle, k1c.minDays) / config.daysInYear) * k1c.multiplier
  const otherBankDeduction = Math.max(0, input.otherBankDeduction ?? 0)
  const k1 = Math.max(0, k1Gross - otherBankDeduction)
  const k2 = input.equity * k2c.equityMultiplier
  const k3 = Math.max(0, input.ebitda * k3c.ebitdaRatio - input.annualDebtService) * k3c.multiplier

  const components: [CapacityComponent, number][] = [['k1', k1], ['k2', k2], ['k3', k3]]
  const [binding, capacity] = components.reduce((min, cur) => (cur[1] < min[1] ? cur : min))
  return { k1Gross, otherBankDeduction, k1, k2, k3, capacity, binding }
}

export function computeLimit(
  input: LimitInput,
  grade: CreditGrade,
  sectorId: SectorId,
  config: ModelConfig,
): LimitResult {
  const capacity = computeCapacity(input, config)
  const gradeMultiplier = config.limit.gradeMultiplier[grade]
  const sectorRiskCoefficient = config.sectors[sectorId].riskCoefficient
  const unrounded = capacity.capacity * gradeMultiplier * sectorRiskCoefficient
  const limit = Math.max(0, floorToUnit(unrounded, config.limit.roundingUnit))
  return { ...capacity, gradeMultiplier, sectorRiskCoefficient, unrounded, limit }
}
