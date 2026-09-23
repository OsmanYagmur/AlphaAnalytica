import type { ReactNode } from 'react'
import { useModelEditor, useUnsavedChangesGuard } from '../../store/modelEditor'
import { AppShell } from '../AppShell'
import { EditorToolbar } from './editors'

/** Model Yöneticisi sayfa kabuğu: araç çubuğu ve kaydedilmemiş değişiklik koruması. */
export function ModelShell({ title, children }: { title: string; children: ReactNode }) {
  const { dirty } = useModelEditor()
  useUnsavedChangesGuard(dirty)
  return (
    <AppShell role="model" title={title} breadcrumb="Model Yöneticisi" actions={<EditorToolbar />}>
      {children}
    </AppShell>
  )
}
