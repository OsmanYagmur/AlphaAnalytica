/**
 * Ziyaretçi istatistikleri (Vercel Web Analytics) için sayfa adresi → rota kalıbı.
 * Uygulama hash yönlendirici kullandığından sayfa görüntülemeleri `#` sonrası
 * yola göre sayılır; firma kimlikleri raporda tek bir kalıpta toplanır.
 */
export function analyticsRoute(path: string): string {
  const s = path.split('/').filter(Boolean)
  if (s.length === 0) return '/'
  if (s[1] === 'firma' && s[2]) return ['', s[0], 'firma', '[firma]', ...(s[3] ? [s[3]] : [])].join('/')
  return `/${s.join('/')}`
}
