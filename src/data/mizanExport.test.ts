/// <reference types="node" />
/**
 * Mizan PDF'leri için veri dışa aktarımı. MIZAN_EXPORT ortam değişkeni bir dosya
 * yolu verildiğinde firmaların mizanlarını (kuruş cinsinden) JSON olarak yazar:
 *   MIZAN_EXPORT=mizan.json npx vitest run src/data/mizanExport.test.ts
 *   python3 scripts/mizan_pdf.py mizan.json docs/mizanlar
 * Değişken yoksa yalnızca dışa aktarılan yapının tutarlılığını doğrular.
 */

import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_CONFIG } from '../engine/modelConfig'
import { FIRMS, SEGMENT_LABELS } from './index'

const kurus = (v: number) => Math.round(v * 100)

export function exportTrialBalances() {
  return FIRMS.map((f, i) => ({
    no: i + 1,
    id: f.id,
    name: f.name,
    vkn: f.vkn,
    city: f.city,
    foundedYear: f.foundedYear,
    employees: f.employees,
    segment: SEGMENT_LABELS[f.segment],
    groupCompanies: f.groupCompanies ?? null,
    sector: DEFAULT_MODEL_CONFIG.sectors[f.sectorId].label,
    fiscalYear: f.fiscalYear,
    exporter: f.traditional.trialBalance.some((l) => l.code === '601'),
    lines: f.traditional.trialBalance.map((l) => ({
      code: l.code,
      name: l.name,
      dt: kurus(l.debitTotal ?? l.debit),
      ct: kurus(l.creditTotal ?? l.credit),
      db: kurus(l.debit),
      cb: kurus(l.credit),
    })),
  }))
}

describe('mizan dışa aktarımı', () => {
  it('her firma için denk mizan; istenirse JSON yazar', () => {
    const data = exportTrialBalances()
    expect(data).toHaveLength(FIRMS.length)
    for (const f of data) {
      const sum = (k: 'dt' | 'ct' | 'db' | 'cb') => f.lines.reduce((a, l) => a + l[k], 0)
      expect(sum('dt')).toBe(sum('ct'))
      expect(sum('db')).toBe(sum('cb'))
    }
    const target = process.env.MIZAN_EXPORT
    if (target) writeFileSync(target, JSON.stringify(data, null, 1))
  })
})
