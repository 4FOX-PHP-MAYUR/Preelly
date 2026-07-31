import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'
import {
  fetchAddressSuggestions,
  resolveSuggestionCoordinates,
  MIN_QUERY_LENGTH,
} from '../../../../shared/services/addressSuggestionService'

const DEBOUNCE_MS = 350

/**
 * Text field with address autocomplete — used for location/address fields (see
 * shared/utils/addressField.js). Typing queries the geocoder; picking a suggestion
 * writes the full address into the field and hands its coordinates to
 * `onAddressSelect` so the map pin can follow.
 *
 * Free typing is always allowed: suggestions are an aid, not a constraint, so a value
 * the geocoder doesn't know still saves exactly as it did before.
 */
export function AddressSuggestField({ field, value, error, required, onChange, onAddressSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [query, setQuery] = useState(null) // null = nothing typed yet this session

  const containerRef = useRef(null)
  const skipNextLookupRef = useRef(false)

  // Close on outside click so the dropdown never covers the fields below it.
  useEffect(() => {
    const onDocumentClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  // Debounced lookup, aborting whatever is still in flight from the previous keystroke.
  useEffect(() => {
    if (query === null) return
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false
      return
    }
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    const timer = setTimeout(async () => {
      const results = await fetchAddressSuggestions(query, { signal: controller.signal })
      if (controller.signal.aborted) return
      setSuggestions(results)
      setActiveIndex(-1)
      setIsLoading(false)
      setIsOpen(true)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleInputChange = (next) => {
    setQuery(next)
    setIsOpen(true)
    onChange(next)
  }

  const handleSelect = async (suggestion) => {
    // Selecting fills the input; don't treat that as a new search.
    skipNextLookupRef.current = true
    setQuery(suggestion.label)
    onChange(suggestion.label)
    setIsOpen(false)
    setSuggestions([])
    setActiveIndex(-1)

    const coordinates = await resolveSuggestionCoordinates(suggestion)
    onAddressSelect?.({ address: suggestion.label, coordinates })
  }

  const handleKeyDown = (event) => {
    if (!isOpen || !suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const typedEnough = (query ?? '').trim().length >= MIN_QUERY_LENGTH
  const showDropdown = isOpen && typedEnough && (isLoading || suggestions.length > 0)

  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <div className="relative" ref={containerRef}>
        <input
          id={field.fieldName}
          name={field.fieldName}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className={fieldInputClass(Boolean(error))}
          placeholder={field.placeholder || 'Start typing an address'}
          value={value ?? ''}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        {isLoading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}

        {showDropdown && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          >
            {isLoading && !suggestions.length && (
              <li className="px-4 py-2.5 text-sm text-gray-500">Searching addresses…</li>
            )}
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  // onMouseDown: fires before the input's blur, so the click always lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm ${
                    index === activeIndex ? 'bg-blue-50 text-[#2563eb]' : 'text-gray-700'
                  }`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span className="leading-snug">{suggestion.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldShell>
  )
}
