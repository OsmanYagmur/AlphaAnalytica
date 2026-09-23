import { formatScore } from '../lib/format'

interface GaugeProps {
  score: number
  label?: string
  size?: number
}

/** Yarım daire skor göstergesi (0–100). Eşik bölgeleri gösterilmez. */
export function Gauge({ score, label = 'Nihai Skor', size = 184 }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = 80
  const cx = 100
  const cy = 96
  const angle = Math.PI * (1 - clamped / 100)
  const x = cx + r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const value = clamped <= 0 ? '' : `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`

  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 200 124" role="img" aria-label={`${label}: ${formatScore(score)}`}>
      <path d={track} fill="none" stroke="#E3E1DA" strokeWidth="12" strokeLinecap="butt" />
      {value && <path d={value} fill="none" stroke="#12233D" strokeWidth="12" strokeLinecap="butt" />}
      {[0, 25, 50, 75, 100].map((t) => {
        const a = Math.PI * (1 - t / 100)
        return (
          <line
            key={t}
            x1={cx + (r - 10) * Math.cos(a)}
            y1={cy - (r - 10) * Math.sin(a)}
            x2={cx + (r - 15) * Math.cos(a)}
            y2={cy - (r - 15) * Math.sin(a)}
            stroke="#B9BDC6"
            strokeWidth="1"
          />
        )
      })}
      <text x={cx} y={cy - 14} textAnchor="middle" className="num" fontSize="30" fontWeight="600" fill="#12233D" fontFamily="IBM Plex Mono">
        {formatScore(score)}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="10" fill="#5B6475" fontFamily="IBM Plex Sans">
        {label}
      </text>
      <text x={cx - r} y={cy + 20} textAnchor="middle" fontSize="9" fill="#8A91A0" fontFamily="IBM Plex Mono">
        0
      </text>
      <text x={cx + r} y={cy + 20} textAnchor="middle" fontSize="9" fill="#8A91A0" fontFamily="IBM Plex Mono">
        100
      </text>
    </svg>
  )
}
