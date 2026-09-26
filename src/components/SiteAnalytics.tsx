import { Suspense, lazy } from 'react'
import { analyticsRoute } from '../lib/analytics'
import { usePath } from '../lib/router'

/**
 * Vercel Web Analytics yalnızca Vercel üzerinde yapılan derlemelerde etkindir
 * (`__VERCEL_ANALYTICS__`, vite.config.ts). Yerel geliştirme, yerel derleme ve
 * çevrimdışı sunumda paket yüklenmez, dışarıya hiçbir istek gitmez.
 */
const VercelAnalytics = __VERCEL_ANALYTICS__ ? lazy(() => import('@vercel/analytics/react').then((m) => ({ default: m.Analytics }))) : null

export function SiteAnalytics() {
  const path = usePath()
  if (!VercelAnalytics) return null
  // route + path verildiğinde otomatik takip kapanır; her hash geçişi ayrı sayfa görüntülemesi sayılır
  return (
    <Suspense fallback={null}>
      <VercelAnalytics mode="production" route={analyticsRoute(path)} path={path} />
    </Suspense>
  )
}
