import { Construction } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Card, ModelVersionTag } from '../components/ui'
import { useActiveVersion } from '../store/evaluations'
import type { Role } from '../store/types'

export function Placeholder({ role, title }: { role: Role; title: string }) {
  const version = useActiveVersion()
  return (
    <AppShell role={role} title={title} actions={<ModelVersionTag version={version} />}>
      <Card>
        <div className="flex items-center gap-3 py-6 text-muted">
          <Construction size={20} />
          <p className="text-sm">Bu arayüz sonraki aşamada eklenecek.</p>
        </div>
      </Card>
    </AppShell>
  )
}
