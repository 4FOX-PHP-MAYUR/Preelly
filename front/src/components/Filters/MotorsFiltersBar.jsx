import MotorsCategoryCascadingDropdowns from './MotorsCategoryCascadingDropdowns'

export default function MotorsFiltersBar({
  city = '',
  subcategories = [],
  selectedHierarchy,
  onChangeCity,
  onSubcategoryChange,
  onBrandChange,
  onModelChange,
  onTrimChange,
  priceRange = '',
  year = '',
  kms = '',
  onChangePriceRange,
  onChangeYear,
  onChangeKms,
  cities = [],
  priceOptions = [],
  yearOptions = [],
  kmsOptions = [],
  onOpenAdvancedFilters,
}) {
  const selectClass =
    'w-full bg-transparent text-sm text-gray-700 outline-none border-none cursor-pointer appearance-none pr-6 bg-no-repeat bg-[length:10px] bg-[right_0_center]'
  const chevronSvg =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231f2937'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")"

  return (
    <div className="w-full bg-gray-100 border border-gray-200 rounded-2xl shadow-sm px-3 sm:px-4 py-3 flex flex-wrap items-end gap-2 sm:gap-0">
      {/* City */}
      <div className="flex flex-col min-w-[100px] sm:min-w-[140px] flex-1 sm:flex-initial sm:border-r sm:border-gray-300 sm:pr-3">
        <label className="text-xs font-medium text-gray-600 mb-1">City</label>
        <select
          aria-label="Select city"
          className={selectClass}
          style={{ backgroundImage: chevronSvg }}
          value={city}
          onChange={(e) => onChangeCity?.(e.target.value)}
        >
          <option value="">Select</option>
          {cities.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Motors hierarchy dropdowns */}
      <div className="flex flex-col flex-[3] min-w-[180px] sm:min-w-[260px] sm:border-r sm:border-gray-300 sm:px-3">
        <MotorsCategoryCascadingDropdowns
          rootLabel="Subcategory"
          subcategories={subcategories}
          selectedHierarchy={selectedHierarchy}
          layout="row"
          onSubcategoryChange={onSubcategoryChange}
          onBrandChange={onBrandChange}
          onModelChange={onModelChange}
          onTrimChange={onTrimChange}
        />
      </div>

      {/* Price Range */}
      <div className="flex flex-col min-w-[90px] sm:min-w-[130px] sm:border-r sm:border-gray-300 sm:px-3">
        <label className="text-xs font-medium text-gray-600 mb-1">Price Range</label>
        <select
          aria-label="Select price range"
          className={selectClass}
          style={{ backgroundImage: chevronSvg }}
          value={priceRange}
          onChange={(e) => onChangePriceRange?.(e.target.value)}
        >
          <option value="">Select</option>
          {priceOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Year */}
      <div className="hidden md:flex flex-col min-w-[80px] border-r border-gray-300 px-3">
        <label className="text-xs font-medium text-gray-600 mb-1">Year</label>
        <select
          aria-label="Select year"
          className={selectClass}
          style={{ backgroundImage: chevronSvg }}
          value={year}
          onChange={(e) => onChangeYear?.(e.target.value)}
        >
          <option value="">Select</option>
          {yearOptions.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
      </div>

      {/* Kilometers */}
      <div className="hidden md:flex flex-col min-w-[100px] border-r border-gray-300 px-3">
        <label className="text-xs font-medium text-gray-600 mb-1">Kilometers</label>
        <select
          aria-label="Select kilometers"
          className={selectClass}
          style={{ backgroundImage: chevronSvg }}
          value={kms}
          onChange={(e) => onChangeKms?.(e.target.value)}
        >
          <option value="">Select</option>
          {kmsOptions.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
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

