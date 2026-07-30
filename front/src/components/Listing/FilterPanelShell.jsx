import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Chrome shared by the single-filter side panels (Price, Region, Kilometres):
 * slide-in transition, header with an optional Reset and close button, scrollable
 * body, and a sticky Apply footer. Extracted so a new dedicated filter is just its
 * own body, and all of them animate and lay out identically.
 */
function FilterPanelShell({
  title,
  className = '',
  showClose = false,
  onClose,
  closing = false,
  onReset,
  resetLabel = 'Reset',
  applyLabel = 'Apply',
  applyDisabled = false,
  onApply,
  children,
}) {
  const [entered, setEntered] = useState(false)

  // Two frames so the browser paints the off-screen position before transitioning.
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  const slideClass = !entered || closing ? 'translate-x-full' : 'translate-x-0'

  return (
    <div
      className={`flex h-full transform flex-col bg-white transition-transform duration-300 ease-in-out ${slideClass} ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E8EBF2] px-5 py-5">
        <h2 className="text-xl font-bold leading-tight text-[#0F172A]">{title}</h2>
        <div className="flex items-center gap-1">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              {resetLabel}
            </button>
          ) : null}
          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[#64748B] transition hover:bg-brand/5 hover:text-brand"
              aria-label={`Close ${String(title).toLowerCase()} filter`}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">{children}</div>

      <div className="sticky bottom-0 rounded-t-2xl border-t border-[#E8EBF2] bg-white px-5 py-4 shadow-[0_-6px_20px_-12px_rgba(15,23,42,0.25)]">
        <button
          type="button"
          onClick={onApply}
          disabled={applyDisabled}
          className="mx-auto block w-[85%] rounded-full bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}

export default FilterPanelShell
