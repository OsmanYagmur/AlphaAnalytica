import { Info } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../store/appStore'
import { cx } from './ui'

const TIP_WIDTH = 272
const VIEWPORT_GUTTER = 8

/** Bilgi ikonu: üzerine gelince veya odaklanınca görünür, tıklayınca sabitlenir. */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const id = useId()
  const visible = pinned || hovered

  useLayoutEffect(() => {
    if (!visible || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(r.left + r.width / 2 - TIP_WIDTH / 2, VIEWPORT_GUTTER), window.innerWidth - TIP_WIDTH - VIEWPORT_GUTTER)
    setPos({ left, top: r.bottom + 6 })
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const close = () => {
      setPinned(false)
      setHovered(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !tipRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [visible])

  return (
    <span ref={wrapRef} className="inline-flex shrink-0 align-middle" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-label={`${label} hakkında`}
        aria-describedby={visible ? id : undefined}
        aria-expanded={pinned}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((p) => !p)
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={cx('rounded-sm p-0.5 transition-colors hover:text-accent', visible ? 'text-accent' : 'text-faint')}
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {visible &&
        pos &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            id={id}
            style={{ left: pos.left, top: pos.top, width: TIP_WIDTH }}
            className="fixed z-50 block rounded-md border border-line bg-surface px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-ink shadow-pop"
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  )
}

interface IndicatorNameProps {
  label: string
  aciklama: string
  birimAciklamasi: string
  /** Gösterge adının yazı stili (kartta başlık, listede satır metni). */
  labelClassName?: string
  className?: string
}

/**
 * Gösterge adı ve açıklaması. Normalde adın yanında bilgi ikonu ve ipucu;
 * Sunum Modu'nda açıklama adın altında soluk ikincil metin olarak sürekli görünür.
 */
export function IndicatorName({ label, aciklama, birimAciklamasi, labelClassName, className }: IndicatorNameProps) {
  const presentation = useAppState((s) => s.presentation)

  if (presentation) {
    return (
      <div className={cx('min-w-0', className)}>
        <span className={labelClassName}>{label}</span>
        <p className="mt-0.5 text-xs font-normal leading-snug text-muted">{aciklama}</p>
      </div>
    )
  }

  return (
    <div className={cx('min-w-0', className)}>
      <span className={labelClassName}>
        {label}
        <span className="ml-1 inline-flex -translate-y-px align-middle">
          <InfoTip label={label}>
            <span className="block">{aciklama}</span>
            <span className="mt-2 block border-t border-line pt-2 text-muted">
              <span className="font-medium text-ink">Veri:</span> {birimAciklamasi}
            </span>
          </InfoTip>
        </span>
      </span>
    </div>
  )
}
