import { memo, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import CategoryDynamicFilters from '../Categories/CategoryDynamicFilters'
import CategoryIconGrid from './CategoryIconGrid'
import { CityFilterSection, VehiclePropertyFilterSections } from './CategoryFilterSections'
import { PanelSection, ChipRow } from '@shared/components/FilterPanelSection'
import StickyFooter from './StickyFooter'

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
  categoryPath = [],
  selectedFilterIds = [],
  filterValues = {},
  onFilterIdsChange,
  onFilterValuesChange,
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
        <CityFilterSection
          cityId={cityId}
          cities={cityOptions}
          citiesLoading={citiesLoading}
          citiesError={citiesError}
          onCityChange={onCityChange}
        />

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
        <VehiclePropertyFilterSections
          showVehicleExtras={showVehicleExtras}
          isPropertyCategory={isPropertyCategory}
          isClassifiedsCategory={isClassifiedsCategory}
          keywords={keywords}
          onKeywordsChange={onKeywordsChange}
          makeModel={makeModel}
          onMakeModelChange={onMakeModelChange}
          trim={trim}
          onTrimChange={onTrimChange}
          trimOptions={trimOptions}
          priceRange={priceRange}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceRangeChange={onPriceRangeChange}
          yearRange={yearRange}
          yearMin={yearMin}
          yearMax={yearMax}
          onYearRangeChange={onYearRangeChange}
          kmsRange={kmsRange}
          kmsMin={kmsMin}
          kmsMax={kmsMax}
          onKmsRangeChange={onKmsRangeChange}
          condition={condition}
          onConditionChange={onConditionChange}
          transmission={transmission}
          onTransmissionChange={onTransmissionChange}
          fuelType={fuelType}
          onFuelTypeChange={onFuelTypeChange}
          bedrooms={bedrooms}
          onBedroomsChange={onBedroomsChange}
        />

        {/* Dynamic filters from the filters table (Regional Specs, Seller Type, ...) */}
        <CategoryDynamicFilters
          categoryId={categoryId}
          subcategoryId={subcategoryFilterId}
          childCategoryId={filterChildCategoryId}
          categoryPath={categoryPath}
          selectedFilterIds={selectedFilterIds}
          filterValues={filterValues}
          onChange={onFilterIdsChange}
          onFilterValuesChange={onFilterValuesChange}
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
