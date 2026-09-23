import { ShieldCheck, ShieldX } from 'lucide-react'
import { Card } from '../../components/ui'
import type { FirmEvaluation } from '../../engine/evaluate'
import type { Firm } from '../../data'
import { formatTL } from '../../lib/format'
import { TermsView } from './TermsView'

export function SystemRecommendation({ firm, evaluation }: { firm: Firm; evaluation: FirmEvaluation }) {
  const terms = evaluation.terms
  return (
    <Card title="Sistem önerisi">
      {terms && terms.limit > 0 ? (
        <>
          <div className="mb-4 rounded-md border border-[#c8dedc] bg-accent-soft px-4 py-3">
            <div className="flex gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-ink">
                AlphaAnalytica sistemi tarafından <span className="num font-semibold text-navy">{formatTL(terms.limit)}</span> limit uygun
                görülmüştür.
              </p>
            </div>
            <p className="num mt-2 pl-8 text-xs text-muted">Talep edilen: {formatTL(firm.requestedAmount)}</p>
          </div>
          <TermsView
            terms={{
              limit: terms.limit,
              products: terms.products,
              collateral: terms.collateral,
              tenorMonths: terms.tenor.months,
              revolving: terms.tenor.revolving,
              referenceRate: terms.pricing.referenceRate,
              spreadBp: terms.pricing.spreadBp,
            }}
          />
        </>
      ) : (
        <div className="rounded-md border border-[#eccac6] bg-negative-soft px-4 py-3">
          <div className="flex gap-3">
            <ShieldX size={20} className="mt-0.5 shrink-0 text-negative" />
            <div>
              <p className="text-sm font-medium text-ink">AlphaAnalytica sistemi bu başvuru için limit önermemektedir.</p>
              <p className="mt-1 text-sm text-muted">
                {evaluation.grade === 'C'
                  ? 'Nihai not C: kredi verilebilir not aralığının altında.'
                  : 'Firmanın borç servis ve özkaynak kapasitesi ek limit taşımıyor.'}
              </p>
              <p className="num mt-2 text-xs text-muted">Talep edilen: {formatTL(firm.requestedAmount)}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
