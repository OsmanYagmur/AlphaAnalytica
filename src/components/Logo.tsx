import primaryNavy from '../assets/brand/alpha-loop-primary-navy.svg'
import primaryWhite from '../assets/brand/alpha-loop-primary-white.svg'

interface LogoProps {
  /** sm: kenar çubuğu ve üst menü · lg: büyük · xl: giriş ekranı (mobilde küçülür) */
  size?: 'sm' | 'lg' | 'xl'
  /** light: koyu zemin üzerinde beyaz logo · dark: açık zemin üzerinde lacivert logo */
  tone?: 'light' | 'dark'
}

/** Kılavuza göre yatay logo en az 200 px genişlikte kullanılır. */
const LOGO_WIDTHS = {
  sm: 'w-[12.5rem]',
  lg: 'w-[18rem]',
  xl: 'w-[17rem] sm:w-[24rem] xl:w-[27.5rem]',
} as const

/**
 * AlphaAnalytica ana logosu (Alpha Loop, #12233D): resmî logo paketindeki yatay logo,
 * güvenli alan boşluğu kırpılmış SVG. Kılavuz gereği renk değiştirilmez; koyu zeminde beyaz sürüm kullanılır.
 */
export function Logo({ size = 'sm', tone = 'light' }: LogoProps) {
  return (
    <img
      src={tone === 'light' ? primaryWhite : primaryNavy}
      alt="AlphaAnalytica"
      width={922}
      height={128}
      draggable={false}
      className={`${LOGO_WIDTHS[size]} block h-auto max-w-full select-none`}
    />
  )
}
