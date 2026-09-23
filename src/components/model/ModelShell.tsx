import type { ReactNode } from 'react'
import { useImpactPanelOpen, useModelEditor, useUnsavedChangesGuard } from '../../store/modelEditor'
import { AppShell } from '../AppShell'
import { EditorToolbar } from './editors'
import { ImpactPanel } from './impact'

/**
 * Model Yöneticisi sayfa kabuğu: araç çubuğu, kaydedilmemiş değişiklik koruması
 * ve sağda canlı Etki Önizleme paneli (geniş ekranda sabit sütun, dar ekranda çekmece).
 */
export function ModelShell({ title, children, impactPanel = true }: { title: string; children: ReactNode; impactPanel?: boolean }) {
  const { dirty } = useModelEditor()
  const open = useImpactPanelOpen() && impactPanel
  useUnsavedChangesGuard(dirty)
  return (
    <AppShell role="model" title={title} breadcrumb="Model Yöneticisi" actions={<EditorToolbar impactToggle={impactPanel} />}>
      <div className={open ? '2xl:grid 2xl:grid-cols-[minmax(0,1fr)_440px] 2xl:gap-4' : ''}>
        <div className="min-w-0">{children}</div>
        {open && (
          <>
            <aside className="sticky top-20 hidden h-[calc(100vh-6.5rem)] 2xl:block">
              <ImpactPanel docked />
            </aside>
            <aside className="fixed inset-y-0 right-0 z-20 w-[min(440px,100vw)] pt-[4.25rem] 2xl:hidden">
              <ImpactPanel docked={false} />
            </aside>
          </>
        )}
      </div>
    </AppShell>
  )
}
