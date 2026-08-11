import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const PANEL_SLIDE_MS = 280

/**
 * Right-hand slide-over holding the same light comments/share panels the home page
 * shows beside its reels. The home page docks them inside its aside column; this
 * page has no aside, so the panel is fixed to the viewport edge and brings its own
 * backdrop. `children` is called with a close handler so the panel's own Close
 * button plays the slide-out before unmounting, exactly as it does on the home page.
 *
 * Rendered through a portal because callers live inside the gallery's overlay,
 * which is `absolute … z-20` — a stacking context. Left in place, the panel's
 * z-index would be resolved *inside* that context, so the gallery's own z-20 image
 * counter and next/prev arrows (later in the DOM) would paint over it.
 */
function SlideOverPanel({ onClose, children }) {
  const [slideIn, setSlideIn] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  const close = useCallback(() => {
    setSlideIn(false)
    window.setTimeout(onClose, PANEL_SLIDE_MS)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div
        className="fixed bottom-0 right-0 top-0 z-[10001] flex w-full min-w-0 flex-col bg-white shadow-[-8px_0_24px_rgba(15,23,42,0.12)] transition-transform ease-out sm:max-w-[420px] md:max-w-[520px]"
        style={{
          transitionDuration: `${PANEL_SLIDE_MS}ms`,
          transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          paddingRight: 'env(safe-area-inset-right, 0)',
        }}
      >
        {children(close)}
      </div>
    </>,
    document.body,
  )
}

export default SlideOverPanel
