interface LogoMarkProps {
  size?: number
  className?: string
}

/** Lacivert kare içinde stilize "α" ve sağ üste doğru yükselen ince çizgi. */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="AlphaAnalytica"
    >
      <rect width="40" height="40" rx="5" fill="#12233D" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="4.5" fill="none" stroke="#2A4468" />
      {/* Analitik büyümeyi ima eden ince yükselen çizgi */}
      <polyline
        points="7,32 15,28.5 21,30 33.5,9"
        fill="none"
        stroke="#4FA39C"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.5" cy="9" r="1.6" fill="#4FA39C" />
      {/* Stilize α */}
      <path
        d="M25.2 13.6c-1.1 5.6-3.4 11.6-7.6 11.6-2.9 0-4.7-2.5-4.7-5.8 0-4.1 2.6-7.6 6-7.6 3.5 0 4.4 3.8 5.2 7.4.6 2.6 1.3 6 3.3 6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface LogoProps {
  /** sm: kenar çubuğu · lg: büyük · xl: giriş ekranı (mobilde küçülür) */
  size?: 'sm' | 'lg' | 'xl'
  tone?: 'light' | 'dark'
}

const LOGO_SIZES = {
  sm: { mark: 32, markClass: undefined, text: 'text-[1.0625rem]', gap: 'gap-3' },
  lg: { mark: 56, markClass: undefined, text: 'text-[2.125rem]', gap: 'gap-3' },
  xl: {
    mark: 96,
    markClass: 'h-14 w-14 sm:h-[5.5rem] sm:w-[5.5rem] xl:h-24 xl:w-24',
    text: 'text-[2.25rem] sm:text-[3.5rem] xl:text-[4rem]',
    gap: 'gap-3.5 sm:gap-5',
  },
} as const

/** Tam logo: işaret + "Alpha" kalın, "Analytica" normal ağırlıkta. */
export function Logo({ size = 'sm', tone = 'light' }: LogoProps) {
  const { mark, markClass, text, gap } = LOGO_SIZES[size]
  const color = tone === 'light' ? 'text-white' : 'text-navy'
  return (
    <div className={`flex items-center ${gap}`}>
      <LogoMark size={mark} className={markClass} />
      <span className={`${text} ${color} leading-none tracking-tight`}>
        <span className="font-bold">Alpha</span>
        <span className="font-normal">Analytica</span>
      </span>
    </div>
  )
}
