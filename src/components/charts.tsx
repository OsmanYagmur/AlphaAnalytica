import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatSeriesValue, formatTL, formatTLShort, formatYearMonth } from '../lib/format'

export const CHART_COLORS = {
  navy: '#12233D',
  petrol: '#1F6F6B',
  petrolLight: '#6FA8A4',
  grid: '#ECEAE4',
  axis: '#8A91A0',
}

const tooltipStyle = {
  border: '1px solid #E3E1DA',
  borderRadius: 4,
  boxShadow: '0 4px 16px rgb(18 35 61 / 0.08)',
  fontSize: 12,
  fontFamily: 'IBM Plex Sans',
}

interface SparklineProps {
  values: number[]
  months: string[]
  height?: number
  /** Bu aydan serinin sonuna kadarki bölge (seçili dönem) hafifçe vurgulanır. */
  highlightFrom?: string
}

/** Mini grafik: gösterge serisi; isteğe bağlı olarak seçili dönem vurgulu. */
export function Sparkline({ values, months, height = 44, highlightFrom }: SparklineProps) {
  const offset = months.length - values.length
  const data = values.map((v, i) => ({ m: months[offset + i], v }))
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(m) => formatYearMonth(String(m))}
            formatter={(v) => [formatSeriesValue(Number(v)), '']}
            separator=""
            labelStyle={{ color: '#5B6475' }}
          />
          <XAxis dataKey="m" hide />
          {highlightFrom && data.length > 0 && (
            <ReferenceArea x1={highlightFrom} x2={data[data.length - 1].m} fill={CHART_COLORS.petrol} fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />
          )}
          <Line type="monotone" dataKey="v" stroke={CHART_COLORS.petrol} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface SeasonalityChartProps {
  months: string[]
  expected: number[]
  actual: number[]
}

/** Beklenen ve gerçekleşen aylık ciro (iki çizgi). */
export function SeasonalityChart({ months, expected, actual }: SeasonalityChartProps) {
  const data = months.map((m, i) => ({ m, expected: expected[i], actual: actual[i] }))
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="m"
            tickFormatter={(m) => formatYearMonth(String(m))}
            tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: '#E3E1DA' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatTLShort(Number(v)).replace(' ₺', '')}
            tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(m) => formatYearMonth(String(m))}
            formatter={(v, name) => [formatTL(Number(v)), name === 'expected' ? 'Beklenen' : 'Gerçekleşen']}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(name) => (name === 'expected' ? 'Beklenen (sezon profiline göre)' : 'Gerçekleşen')}
          />
          <Line type="monotone" dataKey="expected" stroke={CHART_COLORS.petrolLight} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.navy} strokeWidth={2} dot={{ r: 2.5, fill: CHART_COLORS.navy }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
