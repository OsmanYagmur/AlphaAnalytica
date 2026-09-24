import { Card, DataRow, ScoreBar, Badge } from '../../components/ui'
import { strengthLabel } from '../../engine/factors'
import type { FirmEvaluation } from '../../engine/evaluate'
import { TRADITIONAL_CATEGORY_IDS, type ModelConfig } from '../../engine/modelConfig'
import type { Firm } from '../../data'
import { formatNumber, formatScore, formatSignedPercent, formatTLPrecise as formatTL } from '../../lib/format'

const GROUPS: { title: string; from: number; to: number }[] = [
  { title: 'Dönen Varlıklar', from: 100, to: 199 },
  { title: 'Duran Varlıklar', from: 200, to: 299 },
  { title: 'Kısa Vadeli Yabancı Kaynaklar', from: 300, to: 399 },
  { title: 'Uzun Vadeli Yabancı Kaynaklar', from: 400, to: 499 },
  { title: 'Özkaynaklar', from: 500, to: 599 },
  { title: 'Gelir Tablosu Hesapları', from: 600, to: 699 },
  { title: 'Maliyet Hesapları', from: 700, to: 799 },
]

function Amount({ value }: { value: number }) {
  return <span className="num">{value ? formatNumber(value, 2) : ''}</span>
}

function TrialBalanceTable({ firm }: { firm: Firm }) {
  const lines = firm.traditional.trialBalance
  const total = (k: 'debit' | 'credit' | 'debitTotal' | 'creditTotal') => lines.reduce((a, l) => a + Math.round((l[k] ?? 0) * 100), 0) / 100
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[0.8125rem]">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label-caps w-14 py-2 pr-3 font-semibold">Kod</th>
            <th className="label-caps py-2 pr-3 font-semibold">Hesap Adı</th>
            <th className="label-caps py-2 pr-3 text-right font-semibold">Borç (₺)</th>
            <th className="label-caps py-2 pr-3 text-right font-semibold">Alacak (₺)</th>
            <th className="label-caps py-2 pr-3 text-right font-semibold">Borç Bakiye (₺)</th>
            <th className="label-caps py-2 text-right font-semibold">Alacak Bakiye (₺)</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => {
            const rows = lines.filter((l) => {
              const c = Number(l.code.slice(0, 3))
              return c >= g.from && c <= g.to
            })
            if (rows.length === 0) return null
            return [
              <tr key={g.title} className="bg-subtle/70">
                <td colSpan={6} className="py-1.5 pl-2 text-xs font-semibold text-navy">
                  {g.title}
                </td>
              </tr>,
              ...rows.map((l) => (
                <tr key={l.code} className="border-b border-line/70">
                  <td className="num py-1.5 pr-3 text-muted">{l.code}</td>
                  <td className="py-1.5 pr-3">{l.name}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-muted">
                    <Amount value={l.debitTotal ?? l.debit} />
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-muted">
                    <Amount value={l.creditTotal ?? l.credit} />
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">
                    <Amount value={l.debit} />
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right">
                    <Amount value={l.credit} />
                  </td>
                </tr>
              )),
            ]
          })}
          <tr className="border-t-2 border-navy font-semibold">
            <td />
            <td className="py-2">Toplam</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right">{formatNumber(total('debitTotal'), 2)}</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right">{formatNumber(total('creditTotal'), 2)}</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right">{formatNumber(total('debit'), 2)}</td>
            <td className="num whitespace-nowrap py-2 text-right">{formatNumber(total('credit'), 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function TraditionalTab({ firm, evaluation, config }: { firm: Firm; evaluation: FirmEvaluation; config: ModelConfig }) {
  const t = evaluation.traditional
  const s = t.statement
  const kvb = firm.traditional.taxReturn
  const salesGap = kvb.netSales > 0 ? (s.netSales - kvb.netSales) / kvb.netSales : 0
  const consistency = strengthLabel(t.categories.consistency.score, config)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 2xl:grid-cols-3">
        <Card title="Geleneksel analiz alt kategorileri" subtitle={`Mizan ve ${firm.fiscalYear} Kurumlar Vergisi Beyannamesi`}>
          <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
            <span className="text-sm text-muted">Geleneksel skor</span>
            <span className="num text-xl font-semibold text-navy">{formatScore(t.score)}</span>
          </div>
          <div className="space-y-4">
            {TRADITIONAL_CATEGORY_IDS.map((id) => {
              const c = t.categories[id]
              return <ScoreBar key={id} label={c.label} score={c.score} strength={strengthLabel(c.score, config)} />
            })}
          </div>
        </Card>

        <Card
          title="Beyanname karşılaştırması"
          subtitle={`Mizan ↔ Kurumlar Vergisi Beyannamesi (${firm.fiscalYear})`}
          actions={<Badge tone={consistency === 'Güçlü' ? 'positive' : consistency === 'Orta' ? 'warning' : 'negative'}>{consistency === 'Güçlü' ? 'Tutarlı' : 'Sapma var'}</Badge>}
        >
          <dl>
            <DataRow label="Mizan net satış" value={formatTL(s.netSales)} />
            <DataRow label="KVB net satış" value={formatTL(kvb.netSales)} />
            <DataRow label="Fark" value={`${formatTL(s.netSales - kvb.netSales)} (${formatSignedPercent(salesGap)})`} strong />
            <DataRow label="KVB matrahı" value={<span className={kvb.taxBase < 0 ? 'text-negative' : ''}>{formatTL(kvb.taxBase)}</span>} />
            <DataRow label="Ödenen vergi" value={formatTL(kvb.taxPaid)} />
          </dl>
        </Card>

        <Card title="Temel finansal büyüklükler">
          <dl>
            <DataRow label="Net satışlar" value={formatTL(s.netSales)} />
            <DataRow label="FAVÖK" value={formatTL(s.ebitda)} />
            <DataRow label="Net dönem kârı" value={formatTL(s.netProfit)} />
            <DataRow label="Toplam aktifler" value={formatTL(s.totalAssets)} />
            <DataRow label="Özkaynaklar" value={formatTL(s.equity)} />
            <DataRow label="Finansal borçlar" value={formatTL(s.financialDebt)} />
            <DataRow label="Nakit dönüşüm süresi" value={`${formatNumber(t.ratios.cashConversionCycle, 0)} gün`} />
          </dl>
        </Card>
      </div>

      <Card title="Mizan" subtitle={`01.01–31.12.${firm.fiscalYear} · kapanış öncesi · Tekdüzen Hesap Planı`}>
        <TrialBalanceTable firm={firm} />
      </Card>
    </div>
  )
}
