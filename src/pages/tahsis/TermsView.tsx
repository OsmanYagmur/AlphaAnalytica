import type { ReactNode } from 'react'
import { DataRow } from '../../components/ui'
import type { CollateralTerms, ProductAllocation } from '../../engine/collateral'
import { formatPercent, formatTL } from '../../lib/format'

export interface TermsSummary {
  limit: number
  products: ProductAllocation[]
  collateral: CollateralTerms
  tenorMonths: number
  revolving: boolean
  referenceRate: string
  spreadBp: number
  covenants?: string[]
}

/** Ürün kırılımı, teminat, vade ve fiyatlama özeti (sistem önerisi ve karar için ortak). */
export function TermsView({ terms, highlight }: { terms: TermsSummary; highlight?: (key: string) => ReactNode }) {
  const mark = (key: string, node: ReactNode) => (highlight ? (highlight(key) ?? node) : node)
  return (
    <div className="space-y-4">
      <div>
        <p className="label-caps mb-1.5">Ürün kırılımı</p>
        <table className="w-full text-sm">
          <tbody>
            {terms.products.map((p) => (
              <tr key={p.product} className="border-b border-line last:border-b-0">
                <td className="py-1.5 text-ink">{p.label}</td>
                <td className="num w-14 py-1.5 text-right text-muted">{formatPercent(p.share, 0)}</td>
                <td className="num w-32 py-1.5 text-right">{formatTL(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="label-caps mb-0.5">Teminat</p>
        <dl>
          <DataRow label="Teminat türü" value={<span className="font-sans">{mark('collateralType', terms.collateral.typeLabel)}</span>} />
          <DataRow label="Teminat oranı" value={mark('collateralRatio', formatPercent(terms.collateral.ratio, 0))} />
          <DataRow label="İpotek tutarı" value={terms.collateral.mortgageRequired ? formatTL(terms.collateral.mortgageAmount) : <span className="font-sans text-muted">Gerekmiyor</span>} />
          <DataRow
            label="Gerekli ekspertiz değeri"
            value={terms.collateral.mortgageRequired ? formatTL(terms.collateral.requiredAppraisalValue) : <span className="font-sans text-muted">—</span>}
          />
        </dl>
      </div>
      <div>
        <p className="label-caps mb-0.5">Vade ve fiyatlama</p>
        <dl>
          <DataRow label="Vade" value={mark('tenor', `${terms.tenorMonths} ay${terms.revolving ? ' · rotatif' : ''}`)} />
          <DataRow label="Fiyatlama bandı" value={`${terms.referenceRate} + ${terms.spreadBp} bp`} />
        </dl>
      </div>
      {terms.covenants && terms.covenants.length > 0 && (
        <div>
          <p className="label-caps mb-1.5">Özel şartlar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {terms.covenants.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
