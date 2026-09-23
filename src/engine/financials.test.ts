import { describe, expect, it } from 'vitest'
import { computeRatios, deriveFinancialStatement } from './financials'
import { SAMPLE_TRADITIONAL_INPUT, SAMPLE_TRIAL_BALANCE } from './testFixtures'
import type { TrialBalanceLine } from './types'

const { supplement, taxReturn } = SAMPLE_TRADITIONAL_INPUT

describe('deriveFinancialStatement — mizan hesap kodlarından tablo', () => {
  const s = deriveFinancialStatement(SAMPLE_TRIAL_BALANCE, supplement)

  it('bilanço kalemleri; düzenleyici hesaplar (103, 257) düşülür', () => {
    expect(s.cashAndEquivalents).toBe(900_000)
    expect(s.tradeReceivables).toBe(2_400_000)
    expect(s.inventories).toBe(3_000_000)
    expect(s.currentAssets).toBe(6_300_000)
    expect(s.nonCurrentAssets).toBe(1_000_000)
    expect(s.totalAssets).toBe(7_300_000)
    expect(s.shortTermLiabilities).toBe(4_000_000)
    expect(s.longTermLiabilities).toBe(1_000_000)
    expect(s.tradePayables).toBe(1_800_000)
    expect(s.financialDebt).toBe(3_000_000)
    expect(s.netFinancialDebt).toBe(2_100_000)
  })

  it('gelir tablosu; 610 iadeler düşülür, 780 finansman gideri alınır', () => {
    expect(s.netSales).toBe(12_000_000)
    expect(s.costOfSales).toBe(8_400_000)
    expect(s.operatingExpenses).toBe(2_300_000)
    expect(s.ebitda).toBe(1_600_000)
    expect(s.financeExpense).toBe(700_000)
    expect(s.netProfit).toBe(500_000)
  })

  it('kapanış öncesi mizanda dönem kârı özkaynağa eklenir; bilanço denkliği sağlanır', () => {
    expect(s.equity).toBe(2_300_000)
    expect(s.totalAssets).toBe(s.totalLiabilities + s.equity)
  })

  it('590 hesabı varsa dönem kârı ikinci kez eklenmez', () => {
    const closed: TrialBalanceLine[] = [
      ...SAMPLE_TRIAL_BALANCE,
      { code: '590', name: 'Dönem Net Kârı', debit: 0, credit: 500_000 },
    ]
    expect(deriveFinancialStatement(closed, supplement).equity).toBe(2_300_000)
  })

  it('alt hesap kodları (102.01 gibi) ana hesaba göre gruplanır', () => {
    const tb: TrialBalanceLine[] = [
      { code: '102.01', name: 'Banka A', debit: 400_000, credit: 0 },
      { code: '102.02', name: 'Banka B', debit: 100_000, credit: 0 },
    ]
    expect(deriveFinancialStatement(tb, supplement).cashAndEquivalents).toBe(500_000)
  })
})

describe('computeRatios', () => {
  const r = computeRatios(deriveFinancialStatement(SAMPLE_TRIAL_BALANCE, supplement), taxReturn, 365)

  it('likidite, kaldıraç, kârlılık oranları', () => {
    expect(r.currentRatio).toBeCloseTo(1.575, 10)
    expect(r.acidTestRatio).toBeCloseTo(0.825, 10)
    expect(r.debtToEquity).toBeCloseTo(5 / 2.3, 10)
    expect(r.netDebtToEbitda).toBeCloseTo(1.3125, 10)
    expect(r.ebitdaMargin).toBeCloseTo(1.6 / 12, 10)
    expect(r.netProfitMargin).toBeCloseTo(0.5 / 12, 10)
    expect(r.returnOnAssets).toBeCloseTo(0.5 / 7.3, 10)
  })

  it('nakit dönüşüm süresi = alacak günü + stok günü − borç günü', () => {
    expect(r.receivableDays).toBeCloseTo(73, 10)
    expect(r.inventoryDays).toBeCloseTo((3 / 8.4) * 365, 10)
    expect(r.payableDays).toBeCloseTo((1.8 / 8.4) * 365, 10)
    expect(r.cashConversionCycle).toBeCloseTo(73 + (1.2 / 8.4) * 365, 10)
  })

  it('faiz karşılama ve mizan–KVB satış sapması', () => {
    expect(r.interestCoverage).toBeCloseTo(1.6 / 0.7, 10)
    expect(r.salesDeviation).toBeCloseTo(0.3 / 12.3, 10)
  })

  it('yıl günü parametresi devir günlerine yansır', () => {
    const r360 = computeRatios(deriveFinancialStatement(SAMPLE_TRIAL_BALANCE, supplement), taxReturn, 360)
    expect(r360.receivableDays).toBeCloseTo(72, 10)
  })

  it('negatif özkaynak ve negatif FAVÖK en kötü uca gider (±∞)', () => {
    const s = deriveFinancialStatement(SAMPLE_TRIAL_BALANCE, supplement)
    const distressed = computeRatios({ ...s, equity: -100_000, ebitda: -50_000 }, taxReturn, 365)
    expect(distressed.debtToEquity).toBe(Infinity)
    expect(distressed.netDebtToEbitda).toBe(Infinity)
    expect(distressed.interestCoverage).toBeLessThan(0)
  })
})
