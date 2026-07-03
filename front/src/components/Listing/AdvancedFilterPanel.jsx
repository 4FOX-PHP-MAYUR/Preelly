import { memo, useMemo } from 'react'
import { X } from 'lucide-react'
import CategoryDynamicFilters from '../Categories/CategoryDynamicFilters'
import MotorsCategoryCascadingDropdowns from '../Filters/MotorsCategoryCascadingDropdowns'
import CategoryApiFilterForm from './CategoryApiFilterForm'
import DualRangeSlider from './DualRangeSlider'
import FilterChips from './FilterChips'
import FilterSection from './FilterSection'
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

function SelectField({ label, value, onChange, options = [] }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#64748B]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function AdvancedFilterPanel({
  className = '',
  title = 'Filter Your Search',
  showClose = false,
  onClose,
  // Category mode
  isVehicleCategory = false,
  isPropertyCategory = false,
  isClassifiedsCategory = false,
  isBicycleSubcategory = false,
  useApiCategoryTree = false,
  apiCategories = [],
  apiCategoriesLoading = false,
  apiCategoriesError = '',
  apiParentId = '',
  onApiParentChange,
  apiSubcategoryId = '',
  onApiSubcategoryChange,
  // Hierarchy (default / motors)
  subcategories = [],
  selectedHierarchy,
  onSubcategoryChange,
  onBrandChange,
  onModelChange,
  onTrimChange,
  // Common filters
  sortBy,
  onSortChange,
  cityId = '',
  onCityChange,
  cities = [],
  citiesLoading = false,
  citiesError = '',
  priceRange,
  priceMin,
  priceMax,
  onPriceRangeChange,
  year = '',
  onYearChange,
  yearOptions = [],
  kms = '',
  onKmsChange,
  kmsOptions = [],
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
        return {
          value,
          label: count > 0 ? `${label} (${count})` : label,
        }
      }),
    [cities],
  )

  const yearSelectOptions = useMemo(
    () =>
      (yearOptions || [])
        .filter((y) => y.value !== '')
        .map((y) => ({ value: y.value, label: y.label })),
    [yearOptions],
  )

  const kmsSelectOptions = useMemo(
    () =>
      (kmsOptions || [])
        .filter((k) => k.value !== '')
        .map((k) => ({ value: k.value, label: k.label })),
    [kmsOptions],
  )

  const showVehicleExtras = isVehicleCategory && !isBicycleSubcategory

  return (
    <div className={`flex h-full flex-col bg-white ${className}`}>
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
        <FilterSection title="Sort by" defaultOpen>
          <select
            value={sortBy}
            onChange={(e) => onSortChange?.(e.target.value)}
            className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </FilterSection>

        <FilterSection title="Price" defaultOpen>
          <DualRangeSlider
            min={priceRange?.min ?? 0}
            max={priceRange?.max ?? 100000}
            valueMin={priceMin}
            valueMax={priceMax}
            onChange={onPriceRangeChange}
          />
        </FilterSection>

        {citiesLoading ? (
          <div className="py-4 text-sm text-[#64748B]">Loading cities…</div>
        ) : citiesError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {citiesError}
          </div>
        ) : cityOptions.length > 0 ? (
          <FilterSection title="Location" defaultOpen>
            <SelectField label="City" value={cityId} onChange={onCityChange} options={cityOptions} />
          </FilterSection>
        ) : null}

        {useApiCategoryTree ? (
          <CategoryApiFilterForm
            categories={apiCategories}
            loading={apiCategoriesLoading}
            error={apiCategoriesError}
            selectedParentId={apiParentId}
            selectedSubcategoryId={apiSubcategoryId}
            onParentChange={onApiParentChange}
            onSubcategoryChange={onApiSubcategoryChange}
          />
        ) : isVehicleCategory ? (
          <>
            <FilterSection title="Category" defaultOpen>
              <MotorsCategoryCascadingDropdowns
                rootLabel="Subcategory"
                subcategories={subcategories}
                selectedHierarchy={selectedHierarchy}
                onSubcategoryChange={onSubcategoryChange}
                onBrandChange={onBrandChange}
                onModelChange={onModelChange}
                onTrimChange={onTrimChange}
              />
            </FilterSection>
            <FilterSection title="Year">
              <SelectField label="Year" value={year} onChange={onYearChange} options={yearSelectOptions} />
            </FilterSection>
            <FilterSection title="Kilometers">
              <SelectField label="Kilometers" value={kms} onChange={onKmsChange} options={kmsSelectOptions} />
            </FilterSection>
          </>
        ) : (
          <FilterSection title="Category" defaultOpen>
            <MotorsCategoryCascadingDropdowns
              rootLabel="Subcategory"
              subcategories={subcategories}
              selectedHierarchy={selectedHierarchy}
              onSubcategoryChange={onSubcategoryChange}
              onBrandChange={onBrandChange}
              onModelChange={onModelChange}
              onTrimChange={onTrimChange}
            />
          </FilterSection>
        )}

        {(isPropertyCategory || isClassifiedsCategory) && (
          <FilterSection title="Number of Bedrooms">
            <FilterChips
              options={BEDROOM_OPTIONS.map((b) => ({ value: b, label: b }))}
              value={bedrooms}
              onChange={onBedroomsChange}
              allowAny
              anyLabel="Any"
            />
          </FilterSection>
        )}

        {showVehicleExtras ? (
          <>
            <FilterSection title="Condition">
              <FilterChips
                options={CONDITION_OPTIONS}
                value={condition}
                onChange={onConditionChange}
                allowAny
              />
            </FilterSection>
            <FilterSection title="Transmission Type">
              <FilterChips
                options={TRANSMISSION_OPTIONS}
                value={transmission}
                onChange={onTransmissionChange}
                allowAny
              />
            </FilterSection>
            <FilterSection title="Fuel Type">
              <FilterChips options={FUEL_OPTIONS} value={fuelType} onChange={onFuelTypeChange} allowAny />
            </FilterSection>
          </>
        ) : null}

        <FilterSection title="Keywords">
          <input
            type="search"
            value={keywords}
            onChange={(e) => onKeywordsChange?.(e.target.value)}
            placeholder="Search keywords…"
            className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </FilterSection>

        {!useApiCategoryTree || apiSubcategoryId || subcategoryFilterId ? (
          <FilterSection title="More filters" defaultOpen={false}>
            <CategoryDynamicFilters
              categoryId={categoryId}
              subcategoryId={subcategoryFilterId}
              childCategoryId={filterChildCategoryId}
              selectedFilterIds={selectedFilterIds}
              onChange={onFilterIdsChange}
            />
          </FilterSection>
        ) : null}
      </div>

      <StickyFooter onApply={onApply} onReset={onReset} />
    </div>
  )
}

export default memo(AdvancedFilterPanel)
