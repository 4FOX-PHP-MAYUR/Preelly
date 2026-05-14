import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Search, X, Clock, TrendingUp, MapPin, Tag } from 'lucide-react'
import { productService } from '../../services/api'

function SearchBar({ className = '', placeholder = "Search for products, brands, and more..." }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [popularSearches, setPopularSearches] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef(null)
  const searchInputRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    setRecentSearches(recent.slice(0, 5))
    
    // Popular searches (can be fetched from API or hardcoded)
    setPopularSearches([
      'iPhone',
      'Sofa',
      'Car',
      'Laptop',
      'Bike',
      'Furniture',
      'Electronics',
      'Clothing'
    ])
  }, [dispatch])

  // Fetch search suggestions as user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length > 0) {
      setIsSearching(true)
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await productService.getProducts({
            search: searchQuery.trim(),
            limit: 5,
            page: 1
          })
          
          // Get unique product titles as suggestions
          const productSuggestions = (response.data.products || [])
            .map(p => p.title)
            .filter((title, index, self) => self.indexOf(title) === index)
            .slice(0, 5)
          
          setSuggestions(productSuggestions)
        } catch (error) {
          console.error('Error fetching suggestions:', error)
          setSuggestions([])
        } finally {
          setIsSearching(false)
        }
      }, 300) // Debounce 300ms
    } else {
      setSuggestions([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const saveRecentSearch = (query) => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const updated = [query, ...recent.filter(q => q !== query)].slice(0, 10)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
    setRecentSearches(updated.slice(0, 5))
  }

  const handleSearch = (query = searchQuery) => {
    if (!query.trim()) return
    
    saveRecentSearch(query.trim())
    setShowSuggestions(false)
    
    const params = new URLSearchParams()
    params.set('q', query.trim())
    
    navigate(`/search?${params.toString()}`)
    setSearchQuery('')
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    handleSearch(suggestion)
  }

  const clearRecentSearches = () => {
    localStorage.removeItem('recentSearches')
    setRecentSearches([])
  }

  const hasContent = searchQuery.trim().length > 0 || recentSearches.length > 0 || popularSearches.length > 0

  return (
    <div className={`relative ${className}`} ref={suggestionsRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch()
        }}
        className="relative flex w-full"
      >
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setShowSuggestions(false)
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && hasContent && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Search Suggestions */}
          {searchQuery.trim().length > 0 && (
            <div className="py-2">
              {isSearching ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  Searching...
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggestions</div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
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
                  onClick={() => handleSearch()}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded mx-2 flex items-center gap-3 transition-colors"
                >
                  <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900">Search for "{searchQuery}"</span>
                </button>
              )}
            </div>
          )}

          {/* Recent Searches */}
          {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Recent Searches
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded mx-2 flex items-center gap-3 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
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

