import { useNavigate } from 'react-router-dom'
import { Clock, TrendingUp, Tag, Search } from 'lucide-react'

function SearchExtrasPanel({
  recentSearches = {},
  popularSearches = {},
  suggestions = {},
  currentQuery = '',
  onClearRecent,
  className = '',
}) {
  const navigate = useNavigate()

  const recentKeywords = recentSearches.keywords || []
  const popularKeywords = popularSearches.keywords || []
  const suggestionItems = suggestions.suggestions || []

  const handleKeywordClick = (keyword) => {
    if (!keyword?.trim()) return
    navigate(`/search?q=${encodeURIComponent(keyword.trim())}`)
  }

  const hasRecent = recentKeywords.length > 0
  const hasPopular = popularKeywords.length > 0
  const hasSuggestions = suggestionItems.length > 0

  if (!hasRecent && !hasPopular && !hasSuggestions) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {hasSuggestions && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3">
            <Search className="h-3.5 w-3.5" />
            Suggestions
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestionItems.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleKeywordClick(item)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-sm transition-colors font-medium"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {hasRecent && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Recent Searches
            </div>
            {onClearRecent && (
              <button
                type="button"
                onClick={onClearRecent}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recentKeywords
              .filter((keyword) => keyword.toLowerCase() !== currentQuery.toLowerCase())
              .map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => handleKeywordClick(keyword)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-sm transition-colors flex items-center gap-1.5 font-medium"
                >
                  <Clock className="h-3 w-3" />
                  {keyword}
                </button>
              ))}
          </div>
        </section>
      )}

      {hasPopular && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5" />
            Popular Searches
          </div>
          <div className="flex flex-wrap gap-2">
            {popularKeywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => handleKeywordClick(keyword)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-sm transition-colors flex items-center gap-1.5 font-medium"
              >
                <Tag className="h-3 w-3" />
                {keyword}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default SearchExtrasPanel
