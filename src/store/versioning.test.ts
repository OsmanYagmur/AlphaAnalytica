/**
 * Sürümleme ve diğer arayüzlere etkisi (SPEC: "Diğer arayüzlere etkisi"):
 * karara bağlanmış firmalar verildiği sürümle sabit kalır, bekleyenler aktif
 * modelle yeniden hesaplanır.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFirm } from '../data'
import { evaluateFirm } from '../engine/evaluate'
import { createDefaultModelConfig } from '../engine/modelConfig'
import { actions, activeConfig, buildSystemView, finalFromSystem, getState, nextVersionNumber } from './appStore'
import { buildFirmViews } from './evaluations'
import type { Decision } from './types'

const view = (id: string) => buildFirmViews(getState()).find((v) => v.firm.id === id)!

function alt30() {
  const c = createDefaultModelConfig()
  c.final.weights = { traditional: 0.7, alternative: 0.3 }
  return c
}

beforeEach(() => actions.resetDemo())

describe('sürüm kaydetme ve etkinleştirme', () => {
  it('sürüm numarası otomatik artar; not ve yazar saklanır; denetim izine yazılır', () => {
    expect(nextVersionNumber(getState().versions)).toBe('v1.1')
    const v11 = actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', true)
    const v12 = actions.saveVersion(createDefaultModelConfig(), 'Geri alma denemesi', 'Dr. Selin Aydın', false)
    expect([v11, v12]).toEqual(['v1.1', 'v1.2'])
    const s = getState()
    expect(s.activeVersion).toBe('v1.1')
    expect(s.versions.map((v) => v.version)).toEqual(['v1.0', 'v1.1', 'v1.2'])
    expect(s.versions[1].note).toBe('Alternatif ağırlık %30')
    expect(s.lastChange.by).toBe('Dr. Selin Aydın')
    expect(s.modelLog.at(-1)!.action).toContain('v1.2 oluşturuldu')
    expect(s.modelDraft).toBeNull()
  })

  it('herhangi bir sürümü aktif yapma ve v1.0’a dönme', () => {
    actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', false)
    expect(getState().activeVersion).toBe('v1.0')
    actions.activateVersion('v1.1', 'Dr. Selin Aydın')
    expect(activeConfig(getState()).final.weights.alternative).toBe(0.3)
    actions.activateVersion('v1.0', 'Dr. Selin Aydın')
    expect(getState().activeVersion).toBe('v1.0')
    expect(getState().modelLog.at(-1)!.action).toContain('v1.0 varsayılanlarına dönüldü')
    actions.activateVersion('v9.9', 'x')
    expect(getState().activeVersion).toBe('v1.0')
  })

  it('kaydedilen sürüm, sonradan değiştirilen konfigürasyon nesnesinden etkilenmez', () => {
    const c = alt30()
    actions.saveVersion(c, 'Not', 'Dr. Selin Aydın', true)
    c.final.weights.alternative = 0.99
    expect(activeConfig(getState()).final.weights.alternative).toBe(0.3)
  })
})

describe('diğer arayüzlere etkisi', () => {
  it('bekleyen başvurular aktif modelle yeniden hesaplanır', () => {
    const before = view('defne-kirtasiye')
    expect(before.status).toBe('pending')
    expect(before.evaluation.grade).toBe('BBB')

    actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', true)
    const after = view('defne-kirtasiye')
    expect(after.modelVersion).toBe('v1.1')
    expect(after.evaluation.grade).toBe('BB')
    expect(after.evaluation.limit.limit).toBeLessThan(before.evaluation.limit.limit)

    actions.activateVersion('v1.0', 'Dr. Selin Aydın')
    expect(view('defne-kirtasiye').evaluation.grade).toBe('BBB')
  })

  it('karara bağlanmış firmalar verildiği sürümle sabit kalır; güncel izleme aktif modelle', () => {
    const before = view('mavi-sepet')
    const snapshot = structuredClone(getState().decisions['mavi-sepet'])
    actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', true)
    const after = view('mavi-sepet')
    expect(after.modelVersion).toBe('v1.0')
    expect(after.evaluation.score).toBeCloseTo(before.evaluation.score, 12)
    expect(after.evaluation.limit.limit).toBe(before.evaluation.limit.limit)
    expect(getState().decisions['mavi-sepet']).toEqual(snapshot)
    // Portföy izlemesi aktif modeli kullanır
    expect(after.current.score).not.toBeCloseTo(before.current.score, 6)
  })

  it('yeni sürümle verilen karar, model v1.0’a dönse de o sürümle sabit kalır', () => {
    actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', true)
    const pending = view('defne-kirtasiye')
    const decision: Decision = {
      firmId: 'defne-kirtasiye',
      status: 'approved',
      modelVersion: pending.modelVersion,
      decidedBy: 'Elif Karaca',
      decidedAt: '2026-09-23T15:00:00+03:00',
      dataAsOf: '2026-08',
      system: buildSystemView(pending.evaluation),
      final: finalFromSystem(pending.evaluation.terms!, pending.config.sectors.stationery.productMix),
      note: 'Sistem önerisi aynen onaylandı.',
      utilization: 0,
    }
    actions.recordDecision(decision, 'Onaylandı')
    actions.activateVersion('v1.0', 'Dr. Selin Aydın')

    const decided = view('defne-kirtasiye')
    expect(decided.status).toBe('approved')
    expect(decided.modelVersion).toBe('v1.1')
    expect(decided.evaluation.grade).toBe('BB')
    expect(decided.decision!.system.grade).toBe('BB')
    // Aktif model (v1.0) ile güncel görüş farklı
    expect(decided.current.grade).toBe('BBB')
    expect(evaluateFirm(getFirm('defne-kirtasiye')!, activeConfig(getState())).grade).toBe('BBB')
  })

  it('demo sıfırlama sürümleri ve kararları v1.0 başlangıcına döndürür', () => {
    actions.saveVersion(alt30(), 'Alternatif ağırlık %30', 'Dr. Selin Aydın', true)
    actions.resetDemo()
    const s = getState()
    expect(s.versions.map((v) => v.version)).toEqual(['v1.0'])
    expect(s.activeVersion).toBe('v1.0')
    expect(Object.keys(s.decisions)).toHaveLength(6)
  })
})
