import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function SearchableDropdown({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  isVisible = true,
  disabled = false,
  loading = false,
  allowClear = true,
  clearLabel = 'Any',
}) {
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isVisible) {
      setOpen(false)
      setQuery('')
    }
  }, [isVisible])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (open && searchInputRef.current) searchInputRef.current.focus()
  }, [open])

  const selected = useMemo(() => {
    if (value === '' || value == null) return null
    return options.find((o) => String(o.value) === String(value)) || null
  }, [options, value])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => String(o.label || '').toLowerCase().includes(q))
  }, [options, query])

  const displayLabel = selected?.label || placeholder

  const choose = (nextValue) => {
    if (disabled) return
    onChange?.(nextValue)
    setOpen(false)
    setQuery('')
  }

  const canClear = allowClear && value != null && String(value).trim() !== ''

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-500 truncate'}>{displayLabel}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && isVisible && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder={searchPlaceholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {canClear && (
              <button
                type="button"
                onClick={() => choose('')}
                className="mt-2 w-full text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors"
              >
                {clearLabel}
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <div className="p-3 text-sm text-gray-500">
                Loading...
              </div>
            )}

            {!loading && filteredOptions.length === 0 && (
              <div className="p-3 text-sm text-gray-500">No results</div>
            )}

            {!loading &&
              filteredOptions.map((o) => {
                const isSelected = selected && String(selected.value) === String(o.value)
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => choose(o.value)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected ? 'bg-primary-50 text-primary-900' : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

