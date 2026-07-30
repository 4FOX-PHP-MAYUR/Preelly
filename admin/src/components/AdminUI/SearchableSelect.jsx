import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

// The category list runs to thousands of entries, so only a slice is ever put in
// the DOM — typing narrows it down rather than scrolling.
const MAX_VISIBLE = 100

// Labels may carry tree indentation (nbsp, │, └, ─), which must not affect
// matching or the closed-input text.
const INDENT_CHARS = /[ │└─]/g

// Typing "corolla" should still find "└ Corolla".
const normalize = (s) =>
  String(s ?? '')
    .replace(INDENT_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const plainLabel = (s) => String(s ?? '').replace(INDENT_CHARS, '').trim()

/**
 * Drop-in replacement for <Select> that lets the user type to filter.
 * `onChange` receives a synthetic `{ target: { value } }` so existing select
 * handlers keep working unchanged.
 */
function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches',
  disabled = false,
  className = '',
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  const listboxId = selectId ? `${selectId}-listbox` : undefined

  const selected = options.find((o) => String(o.value) === String(value ?? ''))
  const selectedText = selected ? plainLabel(selected.label) : ''

  // Haystacks are built once per option list, not per keystroke.
  const haystacks = useMemo(() => options.map((o) => normalize(o.label)), [options])

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return options
    const terms = q.split(' ')
    return options.filter((_, i) => terms.every((t) => haystacks[i].includes(t)))
  }, [options, haystacks, query])

  const visible = filtered.slice(0, MAX_VISIBLE)
  const hiddenCount = filtered.length - visible.length

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const idx = selected ? filtered.findIndex((o) => String(o.value) === String(selected.value)) : 0
    setActiveIndex(idx > 0 ? idx : 0)
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const commit = (opt) => {
    onChange?.({ target: { value: opt.value } })
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => Math.min(visible.length - 1, Math.max(0, i + dir)))
      return
    }
    if (e.key === 'Enter') {
      // The filter bar is a <form>; don't let Enter submit while choosing.
      e.preventDefault()
      if (!open) setOpen(true)
      else if (visible[activeIndex]) commit(visible[activeIndex])
      return
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
      return
    }
    if (e.key === 'Tab' && open) setOpen(false)
  }

  const clear = () => {
    onChange?.({ target: { value: '' } })
    setQuery('')
    setOpen(false)
  }

  const showClear = !disabled && !!selected && String(selected.value) !== ''

  return (
    <div ref={rootRef} className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={selectId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={disabled}
          className="admin-input w-full pl-10 pr-16 truncate"
          value={open ? query : selectedText}
          placeholder={open ? selectedText || searchPlaceholder : placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
            if (!open) setOpen(true)
          }}
          onMouseDown={() => {
            if (!disabled && !open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {showClear && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear selection"
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!disabled) setOpen((o) => !o)
            }}
            aria-label={open ? 'Close options' : 'Open options'}
            className="p-1 text-slate-400"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <ul ref={listRef} id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1 text-sm">
              {visible.length === 0 && (
                <li className="px-3 py-2 text-slate-500 dark:text-slate-400">{emptyText}</li>
              )}
              {visible.map((opt, i) => {
                const isSelected = String(opt.value) === String(value ?? '')
                const isActive = i === activeIndex
                return (
                  <li
                    key={`${opt.value}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      commit(opt)
                    }}
                    className={`cursor-pointer px-3 py-1.5 whitespace-pre ${
                      isActive ? 'bg-slate-100 dark:bg-slate-800' : ''
                    } ${isSelected ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}
                  >
                    <span className="block truncate">{opt.label}</span>
                    {query && opt.hint ? (
                      <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{opt.hint}</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {hiddenCount > 0 && (
              <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
                {hiddenCount} more — keep typing to narrow
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchableSelect
