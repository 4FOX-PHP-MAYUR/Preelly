import { memo, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import CategoryDynamicFilters from '../Categories/CategoryDynamicFilters'
import CategoryIconGrid from './CategoryIconGrid'
import DualRangeSlider from './DualRangeSlider'
import { FilterChip } from './FilterChips'
import StickyFooter from './StickyFooter'

const CONDITION_OPTIONS = [
  { value: 'Brand New', label: 'Brand New' },
  { value: 'Like New', label: 'Like New' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
]

const TRANSMISSION_OPTIONS = [
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'Semi-Automatic', label: 'Semi-Automatic' },
  { value: 'CVT', label: 'CVT' },
  { value: 'Dual Clutch', label: 'Dual Clutch' },
]

const FUEL_OPTIONS = [
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'LPG', label: 'LPG' },
  { value: 'CNG', label: 'CNG' },
]

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5+']

function PanelSection({ title, children }) {
  return (
    <div className="border-b border-[#E8EBF2] py-4 last:border-b-0">
      <p className="mb-3 text-sm font-semibold text-[#0F172A]">{title}</p>
      {children}
    </div>
  )
}

function ChipRow({ options = [], value = '', onChange, allowAny = true, anyLabel = 'Any' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowAny ? <FilterChip label={anyLabel} active={!value} onClick={() => onChange?.('')} /> : null}
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const active = String(value) === String(v)
        return (
          <FilterChip
            key={String(v)}
            label={label}
            active={active}
            onClick={() => onChange?.(active ? '' : v)}
          />
        )
      })}
    </div>
  )
}

function AdvancedFilterPanel({
  className = '',
  title = 'Filter Your Search',
  showClose = false,
  onClose,
  closing = false,
  // Category mode
  isVehicleCategory = false,
  isPropertyCategory = false,
  isClassifiedsCategory = false,
  isBicycleSubcategory = false,
  // Categories icon grid
  rootCategories = [],
  activeCategoryId = '',
  onCategorySelect,
  // Sub categories (chips)
  subcategories = [],
  subcategoryId = '',
  onSubcategoryChange,
  // Make & Model / Trim
  makeModel = '',
  onMakeModelChange,
  trim = '',
  onTrimChange,
  trimOptions = [],
  // Common filters
  cityId = '',
  onCityChange,
  cities = [],
  citiesLoading = false,
  citiesError = '',
  priceRange,
  priceMin,
  priceMax,
  onPriceRangeChange,
  yearRange,
  yearMin,
  yearMax,
  onYearRangeChange,
  kmsRange,
  kmsMin,
  kmsMax,
  onKmsRangeChange,
  condition = '',
  onConditionChange,
  transmission = '',
  onTransmissionChange,
  fuelType = '',
  onFuelTypeChange,
  keywords = '',
  onKeywordsChange,
  bedrooms = '',
  onBedroomsChange,
  categoryId,
  subcategoryFilterId,
  filterChildCategoryId,
  selectedFilterIds = [],
  onFilterIdsChange,
  onApply,
  onReset,
}) {
  const cityOptions = useMemo(
    () =>
      (cities || []).map((c) => {
        if (typeof c === 'string') return { value: c, label: c }
        const value = c.value
        const label = c.label || c.value
        const count = Number(c.count) > 0 ? Number(c.count) : 0
        return { value, label: count > 0 ? `${label} (${count})` : label }
      }),
    [cities],
  )

  const subcategoryOptions = useMemo(
    () => (subcategories || []).map((s) => ({ value: s._id, label: s.name })),
    [subcategories],
  )

  const showVehicleExtras = isVehicleCategory && !isBicycleSubcategory

  // By default only City / Categories / Sub Category are shown. The remaining
  // filters (and the filters scoped to the selection) appear once a sub category
  // is picked. Categories without any sub categories fall back to showing them.
  const hasSubcategories = subcategoryOptions.length > 0
  const showRest = Boolean(subcategoryId) || !hasSubcategories

  const [entered, setEntered] = useState(false)

  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  const slideClass = !entered || closing ? 'translate-x-full' : 'translate-x-0'

  return (
    <div
      className={`flex h-full transform flex-col bg-white transition-transform duration-300 ease-in-out ${slideClass} ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#E8EBF2] px-5 py-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#64748B] transition hover:bg-brand/5 hover:text-brand"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {/* City */}
        {citiesLoading ? (
          <PanelSection title="City">
            <p className="text-sm text-[#64748B]">Loading cities…</p>
          </PanelSection>
        ) : citiesError ? (
          <PanelSection title="City">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {citiesError}
            </p>
          </PanelSection>
        ) : cityOptions.length ? (
          <PanelSection title="City">
            <ChipRow
              options={cityOptions}
              value={cityId}
              onChange={onCityChange}
              anyLabel="All Cities"
            />
          </PanelSection>
        ) : null}

        {/* Categories */}
        {rootCategories.length ? (
          <PanelSection title="Categories">
            <CategoryIconGrid
              items={rootCategories}
              selectedId={activeCategoryId}
              onSelect={(id, item) => onCategorySelect?.(id, item)}
            />
          </PanelSection>
        ) : null}

        {/* Sub Category */}
        {subcategoryOptions.length ? (
          <PanelSection title="Sub Category">
            <ChipRow
              options={subcategoryOptions}
              value={subcategoryId}
              onChange={onSubcategoryChange}
              allowAny={false}
            />
          </PanelSection>
        ) : null}

        {showRest ? (
        <>
        {/* Search */}
        <PanelSection title="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={keywords}
              onChange={(e) => onKeywordsChange?.(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-[#E4E7EF] bg-white py-2.5 pl-10 pr-4 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </PanelSection>

        {/* Make & Model */}
        {showVehicleExtras ? (
          <PanelSection title="Make & Model">
            <input
              type="search"
              value={makeModel}
              onChange={(e) => onMakeModelChange?.(e.target.value)}
              placeholder="Search eg: Toyota Land Cruiser 70"
              className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3.5 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </PanelSection>
        ) : null}

        {/* Trim */}
        {showVehicleExtras ? (
          <PanelSection title="Trim">
            <select
              value={trim}
              onChange={(e) => onTrimChange?.(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3.5 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              <option value="">Select Trim</option>
              {(trimOptions || []).map((opt) => {
                const v = typeof opt === 'string' ? opt : opt.value
                const label = typeof opt === 'string' ? opt : opt.label
                return (
                  <option key={String(v)} value={v}>
                    {label}
                  </option>
                )
              })}
            </select>
          </PanelSection>
        ) : null}

        {/* Price Range */}
        <PanelSection title="Price Range">
          <DualRangeSlider
            min={priceRange?.min ?? 0}
            max={priceRange?.max ?? 100000}
            valueMin={priceMin}
            valueMax={priceMax}
            onChange={onPriceRangeChange}
          />
        </PanelSection>

        {/* Year */}
        {showVehicleExtras && yearRange ? (
          <PanelSection title="Year">
            <DualRangeSlider
              min={yearRange?.min ?? 1990}
              max={yearRange?.max ?? new Date().getFullYear()}
              valueMin={yearMin}
              valueMax={yearMax}
              onChange={onYearRangeChange}
              prefix=""
              step={1}
            />
          </PanelSection>
        ) : null}

        {/* Kilometres */}
        {showVehicleExtras && kmsRange ? (
          <PanelSection title="Kilometres">
            <DualRangeSlider
              min={kmsRange?.min ?? 0}
              max={kmsRange?.max ?? 500000}
              valueMin={kmsMin}
              valueMax={kmsMax}
              onChange={onKmsRangeChange}
              prefix=""
            />
          </PanelSection>
        ) : null}

        {/* Vehicle chip filters */}
        {showVehicleExtras ? (
          <>
            <PanelSection title="Transmission Type">
              <ChipRow options={TRANSMISSION_OPTIONS} value={transmission} onChange={onTransmissionChange} />
            </PanelSection>
            <PanelSection title="Fuel Type">
              <ChipRow options={FUEL_OPTIONS} value={fuelType} onChange={onFuelTypeChange} />
            </PanelSection>
            <PanelSection title="Condition">
              <ChipRow options={CONDITION_OPTIONS} value={condition} onChange={onConditionChange} />
            </PanelSection>
          </>
        ) : null}

        {/* Bedrooms (property / classifieds) */}
        {isPropertyCategory || isClassifiedsCategory ? (
          <PanelSection title="Number of Bedrooms">
            <ChipRow
              options={BEDROOM_OPTIONS.map((b) => ({ value: b, label: b }))}
              value={bedrooms}
              onChange={onBedroomsChange}
            />
          </PanelSection>
        ) : null}

        {/* Dynamic filters from the filters table (Regional Specs, Seller Type, ...) */}
        <CategoryDynamicFilters
          categoryId={categoryId}
          subcategoryId={subcategoryFilterId}
          childCategoryId={filterChildCategoryId}
          selectedFilterIds={selectedFilterIds}
          onChange={onFilterIdsChange}
          variant="flat"
        />
        </>
        ) : null}
      </div>

      <StickyFooter onApply={onApply} onReset={onReset} resetLabel="Clear" />
    </div>
  )
}

export default memo(AdvancedFilterPanel)
