import { LayoutGrid, SlidersHorizontal } from 'lucide-react'
import { memo } from 'react'

function ListingToolbar({
  sortBy,
  onSortChange,
  onOpenFilters,
  onToggleFiltersPanel,
  showFiltersPanel = true,
  filtersOpen = false,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onOpenFilters}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
          filtersOpen
            ? 'border-brand bg-brand/5 text-brand shadow-sm shadow-brand/10'
            : 'border-[#E4E7EF] bg-white text-[#475569] hover:border-brand/30 hover:text-brand'
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden xs:inline">Advance Filter</span>
        <span className="xs:hidden">Filters</span>
      </button>

      <button
        type="button"
        onClick={onToggleFiltersPanel}
        className="hidden items-center gap-2 rounded-xl border border-[#E4E7EF] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] transition hover:border-brand/30 hover:text-brand lg:inline-flex"
        aria-pressed={showFiltersPanel}
      >
        <LayoutGrid className="h-4 w-4" />
        {showFiltersPanel ? 'Hide panel' : 'Show panel'}
      </button>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-sm text-[#64748B] sm:inline">Sort by</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          className="rounded-xl border border-[#E4E7EF] bg-white px-3 py-2.5 text-sm font-medium text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          aria-label="Sort listings"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  )
}

export default memo(ListingToolbar)
