import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Clock, TrendingUp, Tag } from 'lucide-react'
import { globalSearchService } from '@shared/services/api'

const SUGGESTION_MIN_LENGTH = 2

const VARIANT_STYLES = {
  default: {
    input:
      'w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600',
    icon: 'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400',
    clearButton: 'absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600',
    dropdown:
      'absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto',
  },
  home: {
    input:
      'h-10 sm:h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 sm:pl-11 pr-10 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white',
    icon: 'pointer-events-none absolute left-3 sm:left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400',
    clearButton: 'absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600',
    dropdown:
      'absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[200] max-h-96 overflow-y-auto',
  },
}

function SearchBar({
  className = '',
  placeholder = 'Search for products, brands, and more...',
  variant = 'default',
}) {
  const navigate = useNavigate()
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [popularSearches, setPopularSearches] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [loadingExtras, setLoadingExtras] = useState(true)
  const searchTimeoutRef = useRef(null)
  const containerRef = useRef(null)

  const refreshRecentSearches = () => {
    return globalSearchService
      .getRecent()
      .then((response) => {
        const keywords = response.data?.data?.keywords || []
        setRecentSearches(keywords.slice(0, 5))
      })
      .catch(() => {
        try {
          const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
          setRecentSearches(recent.slice(0, 5))
        } catch {
          setRecentSearches([])
        }
      })
  }

  useEffect(() => {
    setLoadingExtras(true)
    Promise.all([
      globalSearchService
        .getPopular({ limit: 8 })
        .then((response) => {
          const keywords = response.data?.data?.keywords || []
          setPopularSearches(keywords)
        })
        .catch(() => {
          setPopularSearches([])
        }),
      refreshRecentSearches(),
    ]).finally(() => {
      setLoadingExtras(false)
    })
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const trimmedQuery = searchQuery.trim()

    if (trimmedQuery.length >= SUGGESTION_MIN_LENGTH) {
      setIsSearching(true)
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await globalSearchService.getSuggestions({
            keyword: trimmedQuery,
            limit: 8,
          })
          const items = response.data?.data?.suggestions || []
          setSuggestions(items)
        } catch (error) {
          console.error('Error fetching suggestions:', error)
          setSuggestions([])
        } finally {
          setIsSearching(false)
        }
      }, 300)
    } else {
      setSuggestions([])
      setIsSearching(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (query = searchQuery) => {
    if (!query.trim()) return

    setShowSuggestions(false)

    const params = new URLSearchParams()
    params.set('q', query.trim())

    navigate(`/search?${params.toString()}`)
    setSearchQuery('')
    setTimeout(refreshRecentSearches, 500)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    handleSearch(suggestion)
  }

  const clearRecentSearches = async () => {
    try {
      await globalSearchService.clearRecent()
      setRecentSearches([])
    } catch (error) {
      console.error('Error clearing recent searches:', error)
      setRecentSearches([])
    }
  }

  const hasContent =
    loadingExtras ||
    searchQuery.trim().length > 0 ||
    recentSearches.length > 0 ||
    popularSearches.length > 0

  return (
    <div className={`relative min-w-0 ${className}`} ref={containerRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch()
        }}
        className="relative flex w-full"
      >
        <div className="relative flex-1">
          <Search className={styles.icon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className={styles.input}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setShowSuggestions(false)
              }}
              className={styles.clearButton}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {showSuggestions && hasContent && (
        <div className={styles.dropdown}>
          {loadingExtras && searchQuery.trim().length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
              Loading searches...
            </div>
          ) : null}

          {searchQuery.trim().length > 0 && (
            <div className="py-2">
              {searchQuery.trim().length < SUGGESTION_MIN_LENGTH ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  Type at least {SUGGESTION_MIN_LENGTH} characters for suggestions
                </div>
              ) : isSearching ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                  Searching...
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded mx-2 flex items-center gap-3 transition-colors"
                    >
                      <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-900">{suggestion}</span>
                    </button>
                  ))}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded mx-2 flex items-center gap-3 transition-colors"
                >
                  <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900">Search for &quot;{searchQuery}&quot;</span>
                </button>
              )}
            </div>
          )}

          {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Recent Searches
                </div>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded mx-2 flex items-center gap-3 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900">{search}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim().length === 0 && popularSearches.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Popular Searches
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {popularSearches.map((search, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(search)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-sm transition-colors flex items-center gap-1.5 font-medium"
                  >
                    <Tag className="h-3 w-3" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
