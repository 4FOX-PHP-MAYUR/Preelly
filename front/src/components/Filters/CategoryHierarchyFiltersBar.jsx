import MotorsCategoryCascadingDropdowns from './MotorsCategoryCascadingDropdowns'

export default function CategoryHierarchyFiltersBar({
  subcategories = [],
  selectedHierarchy,
  onSubcategoryChange,
  onBrandChange,
  onModelChange,
  onTrimChange,
  onOpenAdvancedFilters,
}) {
  return (
    <div className="w-full bg-gray-100 border border-gray-200 rounded-2xl shadow-sm px-3 sm:px-4 py-3 flex flex-wrap items-end gap-2 sm:gap-0">
      <div className="flex flex-col flex-[3] min-w-[180px] sm:min-w-[260px] sm:border-r sm:border-gray-300 sm:px-3">
        <MotorsCategoryCascadingDropdowns
          rootLabel="Subcategory"
          subcategories={subcategories}
          selectedHierarchy={selectedHierarchy}
          onSubcategoryChange={onSubcategoryChange}
          onBrandChange={onBrandChange}
          onModelChange={onModelChange}
          onTrimChange={onTrimChange}
          layout="row"
        />
      </div>

      <div className="ml-auto flex items-end sm:pl-2">
        <button
          type="button"
          onClick={onOpenAdvancedFilters}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label="Open more filters"
        >
          Filters
        </button>
      </div>
    </div>
  )
}

