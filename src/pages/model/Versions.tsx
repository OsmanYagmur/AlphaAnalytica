import { ChevronDown, ChevronRight, Download, RotateCcw, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { ImpactSummaryCards } from '../../components/model/impact'
import { ModelShell } from '../../components/model/ModelShell'
import { showToast } from '../../components/toast'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { FIRMS } from '../../data'
import { diffConfigs } from '../../engine/configDiff'
import { computeImpact } from '../../engine/impact'
import { BASE_MODEL_VERSION, type ModelConfig } from '../../engine/modelConfig'
import { exportModelConfig, parseModelConfigJson, type ImportResult } from '../../engine/schema'
import { formatDateTime } from '../../lib/format'
import { USERS, actions, activeConfig, useAppState } from '../../store/appStore'
import { editorActions, useModelEditor } from '../../store/modelEditor'
import type { ModelVersion } from '../../store/types'
import { DiffTable } from './Overview'

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportVersion(v: ModelVersion) {
  download(`alphaanalytica-model-${v.version}.json`, exportModelConfig(v.config, v.version))
  actions.appendModelLog({ at: new Date().toISOString(), by: USERS.model.name, action: `${v.version} JSON olarak dışa aktarıldı` })
}

/** Sürüm etkinleştirme / v1.0'a dönüş onay penceresi, beklenen etkiyle birlikte. */
function ActivateModal({ target, onClose }: { target: ModelVersion; onClose: () => void }) {
  const current = useAppState(activeConfig)
  const activeVersion = useAppState((s) => s.activeVersion)
  const impact = useMemo(() => computeImpact(FIRMS, current, target.config), [current, target])
  const revert = target.version === BASE_MODEL_VERSION
  const confirm = () => {
    actions.activateVersion(target.version, USERS.model.name)
    showToast(revert ? 'v1.0 varsayılanlarına dönüldü' : `${target.version} aktif yapıldı`, 'Bekleyen başvurular yeniden hesaplandı; karara bağlanmış kararlar değişmedi.')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={revert ? 'v1.0 varsayılanlarına dön' : `${target.version} sürümünü aktif yap`}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" onClick={confirm}>
            {revert ? 'v1.0’a dön' : 'Aktif yap'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink">
        Aktif model <span className="num font-semibold">{activeVersion}</span> → <span className="num font-semibold">{target.version}</span> olacak. Bekleyen başvurular yeni
        aktif modelle yeniden hesaplanır; karara bağlanmış firmaların kararları verildikleri sürümle sabit kalır.
      </p>
      <p className="label-caps mb-2">Bekleyen ve portföydeki firmalara beklenen etki</p>
      <ImpactSummaryCards summary={impact.summary} />
    </Modal>
  )
}

function ImportModal({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const editor = useModelEditor()
  const changes = result.ok ? diffConfigs(editor.active, result.config) : []
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title="JSON içe aktarma"
      footer={
        <>
          <Button onClick={onClose}>Kapat</Button>
          {result.ok && (
            <Button
              variant="primary"
              onClick={() => {
                editorActions.importConfig(result.config, result.sourceVersion)
                showToast('Konfigürasyon yüklendi', 'Etki önizlemesini inceleyip "Yeni sürüm" ile kaydedebilirsiniz.', 'info')
                onClose()
              }}
            >
              Çalışma kopyasına yükle
            </Button>
          )}
        </>
      }
    >
      {result.ok ? (
        <>
          <p className="mb-3 text-sm text-positive">Şema doğrulaması başarılı{result.sourceVersion ? ` · kaynak sürüm ${result.sourceVersion}` : ''}.</p>
          <p className="mb-2 text-sm text-muted">Aktif modele göre {changes.length} parametre farkı:</p>
          <div className="rounded-md border border-line">
            <DiffTable changes={changes} beforeLabel="Aktif" afterLabel="İçe aktarılan" empty="İçe aktarılan konfigürasyon aktif modelle aynı." />
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm font-medium text-negative">Şema doğrulaması başarısız; dosya içe aktarılmadı.</p>
          <ul className="max-h-72 list-disc space-y-1 overflow-y-auto pl-5 text-[0.8125rem] text-ink">
            {result.errors.map((err) => (
              <li key={err} className="num">
                {err}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}

export function ModelVersions() {
  const versions = useAppState((s) => s.versions)
  const activeVersion = useAppState((s) => s.activeVersion)
  const modelLog = useAppState((s) => s.modelLog)
  const [expanded, setExpanded] = useState<string | null>(versions[versions.length - 1]?.version ?? null)
  const [activating, setActivating] = useState<ModelVersion | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const active = versions.find((v) => v.version === activeVersion)!
  const base = versions.find((v) => v.version === BASE_MODEL_VERSION)!

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setImportResult(parseModelConfigJson(text))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <ModelShell title="Sürümler ve Denetim İzi">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportVersion(active)}>
          Aktif konfigürasyonu dışa aktar (JSON)
        </Button>
        <Button variant="secondary" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
          JSON içe aktar
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="secondary" icon={<RotateCcw size={15} />} disabled={activeVersion === BASE_MODEL_VERSION} onClick={() => setActivating(base)}>
          v1.0 varsayılanlarına dön
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Sürüm listesi" subtitle={`${versions.length} sürüm · aktif: ${activeVersion}`} className="xl:col-span-2" bodyClassName="p-0">
          <ul>
            {[...versions].reverse().map((v) => {
              const index = versions.findIndex((x) => x.version === v.version)
              const prev: ModelConfig | null = index > 0 ? versions[index - 1].config : null
              const changes = prev ? diffConfigs(prev, v.config) : []
              const open = expanded === v.version
              return (
                <li key={v.version} className="border-b border-line last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <button type="button" className="flex min-w-0 items-start gap-2 text-left" onClick={() => setExpanded(open ? null : v.version)}>
                      {open ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted" /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="num text-base font-semibold text-navy">{v.version}</span>
                          {v.version === activeVersion && <Badge tone="positive">Aktif</Badge>}
                          {prev && <span className="text-xs text-muted">{changes.length} parametre değişikliği</span>}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink">{v.note}</span>
                        <span className="num block text-xs text-muted">
                          {formatDateTime(v.createdAt)} · {v.author}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => exportVersion(v)}>
                        JSON
                      </Button>
                      <Button size="sm" variant="secondary" disabled={v.version === activeVersion} onClick={() => setActivating(v)}>
                        Aktif yap
                      </Button>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-line bg-subtle/40">
                      {prev ? (
                        <DiffTable changes={changes} beforeLabel={`Eski (${versions[index - 1].version})`} afterLabel={`Yeni (${v.version})`} empty="Bir önceki sürümle parametre farkı yok." />
                      ) : (
                        <p className="px-5 py-4 text-sm text-muted">İlk sürüm: SPEC'teki varsayılan parametreler (Model v1.0).</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title="Denetim izi" subtitle="Model sürüm işlemleri: kim, ne zaman, ne yaptı">
          <ol className="relative space-y-4 border-l border-line pl-4">
            {[...modelLog].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full border border-surface bg-navy" />
                <p className="num text-xs text-muted">{formatDateTime(e.at)}</p>
                <p className="text-sm text-ink">{e.action}</p>
                <p className="text-xs text-muted">{e.by}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {activating && <ActivateModal target={activating} onClose={() => setActivating(null)} />}
      {importResult && <ImportModal result={importResult} onClose={() => setImportResult(null)} />}
    </ModelShell>
  )
}
