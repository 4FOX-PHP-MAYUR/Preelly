import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

/**
 * Small overflow-menu for table row actions.
 *
 * items: Array<{
 *   label: string,
 *   icon?: React component,
 *   onClick?: () => void,
 *   disabled?: boolean,
 *   danger?: boolean,   // red text, e.g. destructive/reject actions
 *   active?: boolean,   // highlight, e.g. currently-featured toggle
 *   hidden?: boolean,   // convenience flag so callers can inline conditions
 * }>
 */
function DropdownMenu({ items = [], label = 'Actions', triggerClassName = '' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const anchorRectRef = useRef(null)

  const visibleItems = items.filter((item) => !item?.hidden)

  const openMenu = () => {
    anchorRectRef.current = triggerRef.current?.getBoundingClientRect() || null
    setCoords(null)
    setOpen(true)
  }

  // Measure the menu after it mounts (off-screen/invisible) so we know its real
  // width/height, then place it — preferring to open on the right of the trigger,
  // falling back to the left only if it would overflow the viewport.
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !anchorRectRef.current) return
    const rect = anchorRectRef.current
    const menuEl = menuRef.current
    const margin = 8
    const menuWidth = menuEl.offsetWidth
    const menuHeight = menuEl.offsetHeight

    const fitsRight = rect.left + menuWidth <= window.innerWidth - margin
    const left = fitsRight ? rect.left : rect.right
    const transform = fitsRight ? '' : 'translateX(-100%)'

    let top = rect.bottom + 4
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - 4)
    }

    setCoords({ top, left, transform })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleReposition = () => setOpen(false)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open])

  if (visibleItems.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          open ? setOpen(false) : openMenu()
        }}
        className={`admin-table-action text-slate-500 dark:text-slate-400 ${triggerClassName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: coords ? coords.top : 0,
              left: coords ? coords.left : 0,
              transform: coords ? coords.transform : undefined,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-50 min-w-[168px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onClick?.()
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                    : item.active
                    ? 'text-primary-600 dark:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" fill={item.active ? 'currentColor' : 'none'} />}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

export default DropdownMenu
