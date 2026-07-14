import { ChevronDown } from 'lucide-react'
import { memo } from 'react'

function ListingToolbar({
  sortBy,
  onSortChange,
  onOpenFilters,
  onQuickFilterClick,
  quickFilters = [],
  filtersOpen = false,
  activeQuickFilter = null,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onOpenFilters}
        aria-pressed={filtersOpen}
        className={`inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
          filtersOpen
            ? 'bg-brand text-white shadow-sm shadow-brand/25 hover:bg-brand-700'
            : 'bg-[#F1F3F7] text-[#475569] hover:bg-[#E4E7EF] hover:text-brand'
        }`}
      >
        Advance Filter
      </button>

      {quickFilters.map((label) => {
        const isActive = activeQuickFilter === label
        return (
          <button
            key={label}
            type="button"
            onClick={() => onQuickFilterClick?.(label)}
            aria-pressed={isActive}
            className={`inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-brand text-white shadow-sm shadow-brand/25 hover:bg-brand-700'
                : 'bg-[#F1F3F7] text-[#475569] hover:bg-[#E4E7EF] hover:text-brand'
            }`}
          >
            {label}
          </button>
        )
      })}

      <div className="relative">
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          className="appearance-none rounded-xl border border-[#E4E7EF] bg-white px-4 py-2.5 pr-9 text-sm font-medium text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          aria-label="Sort listings"
        >
          <option value="newest">Sort by</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
      </div>
    </div>
  )
}

export default memo(ListingToolbar)
