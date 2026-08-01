import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Home, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import useCategoryDrilldown, { MAX_CATEGORY_PATH_LENGTH } from '@shared/hooks/useCategoryDrilldown'
import useCategoryFilterFields from '@shared/hooks/useCategoryFilterFields'
import CategoryFilterFields from '@shared/components/CategoryFilterFields'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import { buildListingUrl } from '@shared/utils/categorySearchParams'
import { getLevelLabels } from '@shared/utils/categoryFields'
import { PanelSection, ChipRow } from '@shared/components/FilterPanelSection'
import { CityFilterSection, VehiclePropertyFilterSections } from '../components/Listing/CategoryFilterSections'
import CategoryIconGrid from '../components/Listing/CategoryIconGrid'
import { selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { productService } from '@shared/services/api'
import { useEmirateCities } from '../hooks/useEmirateCities'
import { buildCityFilterOptions } from '@shared/utils/buildCityFilterOptions'
import {
  isVehicleCategoryName,
  isPropertyCategoryName,
  isClassifiedsCategoryName,
} from '../components/Categories/categoryBrowseShared'
import {
  buildCategorySearchSavePayload,
  persistSavedSearch,
} from '@shared/utils/persistSavedSearch'

/**
 * Hierarchical category search (/search).
 *
 * Category selection reuses the Post Ad category API and drill-down logic (see
 * useCategoryDrilldown): a pick with `isChild === 1` opens its children in the
 * section below, up to three levels (root → subcategory → child category), the
 * same depth Post Ad uses. Sections are rendered with the listing page's filter
 * panel primitives. Once the selection is final the category's admin-configured
 * filters render by field type, and Search hands the whole selection to the
 * product listing page through the URL.
 */
function CategorySearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const {
    levelOptions,
    selectedPath,
    selectedCategories,
    categoryPathNames,
    isComplete,
    loadingRoots,
    loadingChildren,
    error,
    selectAtLevel,
    clearFromLevel,
    // Stops at root → subcategory → child category, the same depth the Post Ad
    // flow uses, so the search stays a short 2-3 step selection.
  } = useCategoryDrilldown({ maxLevels: MAX_CATEGORY_PATH_LENGTH })

  const [selectedFilterIds, setSelectedFilterIds] = useState([])
  const [filterValues, setFilterValues] = useState({})

  // Vehicle / property filter sections, matching the listing page's Advanced
  // Filter panel one-for-one (same fields, same order, same data sources) — see
  // CategoryFilterSections.jsx, shared with AdvancedFilterPanel.
  const [cityId, setCityId] = useState(() => searchParams.get('cityId') || '')
  const [keywords, setKeywords] = useState(() => searchParams.get('q') || '')
  const [makeModel, setMakeModel] = useState('')
  const [trim, setTrim] = useState('')
  const [condition, setCondition] = useState('')
  const [transmission, setTransmission] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [priceRangeSelect, setPriceRangeSelect] = useState('')
  const [kms, setKms] = useState('')
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [facetCities, setFacetCities] = useState([])
  const [facetMileageRange, setFacetMileageRange] = useState({ min: 0, max: 0 })

  const { emirates, loading: citiesLoading, error: citiesError } = useEmirateCities()
  const cities = useMemo(() => buildCityFilterOptions(emirates, facetCities), [emirates, facetCities])

  const rootCategoryId = selectedPath[0] || ''
  const subcategoryFilterId = selectedPath[1] || ''

  const isVehicleCategory = Boolean(selectedCategories[0] && isVehicleCategoryName(selectedCategories[0].name))
  const isPropertyCategory = Boolean(selectedCategories[0] && isPropertyCategoryName(selectedCategories[0].name))
  const isClassifiedsCategory = Boolean(
    selectedCategories[0] && isClassifiedsCategoryName(selectedCategories[0].name),
  )
  const isBicycleSubcategory = Boolean(selectedCategories[1] && /bicycle|bike/i.test(selectedCategories[1].name || ''))
  const showVehicleExtras = isVehicleCategory && !isBicycleSubcategory

  const priceMinMax = useMemo(() => {
    if (priceRangeSelect) {
      const [minP, maxP] = priceRangeSelect.split('-').map(Number)
      if (!isNaN(minP) && !isNaN(maxP)) return { min: minP, max: maxP }
    }
    return { min: priceRange.min, max: priceRange.max }
  }, [priceRangeSelect, priceRange])

  const kmsBounds = useMemo(() => {
    const max = Number(facetMileageRange?.max)
    return { min: 0, max: Number.isFinite(max) && max > 0 ? max : 500000 }
  }, [facetMileageRange])

  const kmsSel = useMemo(() => {
    if (!kms) return null
    const [lo, hi] = kms.split('-').map(Number)
    if (Number.isFinite(lo) && Number.isFinite(hi)) return { min: lo, max: hi }
    return null
  }, [kms])

  const kmsMin = kmsSel?.min ?? kmsBounds.min
  const kmsMax = kmsSel?.max ?? kmsBounds.max

  // Same price-range/facets endpoints the listing page uses, so the bounds
  // (and city listing counts) shown here match what the results page shows.
  useEffect(() => {
    if (!rootCategoryId) return
    let cancelled = false
    productService
      .getPriceRange(rootCategoryId)
      .then((response) => {
        if (cancelled) return
        const { minPrice, maxPrice } = response.data
        setPriceRange({ min: minPrice, max: maxPrice })
      })
      .catch((e) => console.error('Error fetching price range:', e))
    return () => {
      cancelled = true
    }
  }, [rootCategoryId])

  useEffect(() => {
    if (!rootCategoryId) return
    let cancelled = false
    productService
      .getFacets({ categoryId: rootCategoryId, subcategoryId: subcategoryFilterId || undefined })
      .then((res) => {
        if (cancelled) return
        const data = res?.data || {}
        setFacetCities(Array.isArray(data.cities) ? data.cities : [])
        setFacetMileageRange(data.mileageRange || { min: 0, max: 0 })
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Error fetching facets:', e)
        setFacetCities([])
        setFacetMileageRange({ min: 0, max: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [rootCategoryId, subcategoryFilterId])

  const resetVehiclePropertyFilters = () => {
    setCityId('')
    setKeywords('')
    setMakeModel('')
    setTrim('')
    setCondition('')
    setTransmission('')
    setFuelType('')
    setBedrooms('')
    setPriceRangeSelect('')
    setKms('')
  }

  // Section titles use the listing page's wording ("Categories" / "Sub Category").
  // Deeper levels take the admin-configured label for the root when there is a
  // real one; otherwise they're named after the category they belong to, since
  // getLevelLabels falls back to generic "Level 3" placeholders.
  const configuredLabels = getLevelLabels(selectedCategories[0]?.name || '')
  const levelTitle = (level) => {
    if (level === 0) return 'Categories'
    if (level === 1) return 'Sub Category'
    const configured = configuredLabels[level]
    if (configured && !/^level\s*\d+$/i.test(configured)) return configured
    return selectedCategories[level - 1]?.name || 'Sub Category'
  }

  const {
    fields,
    loading: filtersLoading,
    error: filtersError,
  } = useCategoryFilterFields(selectedPath, { enabled: isComplete })

  // Search params the app already supports (keyword, city, sort, price) are
  // carried straight through to the listing page.
  const passthroughParams = useMemo(() => {
    const carried = {}
    ;['q', 'cityId', 'location', 'sortBy', 'minPrice', 'maxPrice'].forEach((key) => {
      const value = searchParams.get(key)
      if (value) carried[key] = value
    })
    return carried
  }, [searchParams])

  const handleSelect = (level, categoryId) => {
    // A new pick at this level supersedes deeper picks and their filters.
    setSelectedFilterIds([])
    setFilterValues({})
    resetVehiclePropertyFilters()
    selectAtLevel(level, categoryId)
  }

  const handleEditLevel = (level) => {
    setSelectedFilterIds([])
    setFilterValues({})
    resetVehiclePropertyFilters()
    clearFromLevel(level)
  }

  const handlePriceRangeChange = (lo, hi) => setPriceRangeSelect(`${lo}-${hi}`)
  const handleKmsRangeChange = (lo, hi) => setKms(`${lo}-${hi}`)

  const missingRequiredField = useMemo(
    () =>
      fields.find((field) => {
        if (!field.required) return false
        if (field.options.length) {
          return !field.options.some((opt) =>
            selectedFilterIds.includes(String(opt.filterId || opt.value)),
          )
        }
        return !filterValues[field.id]
      }),
    [fields, selectedFilterIds, filterValues],
  )

  const handleSearch = () => {
    if (!isComplete || !selectedPath.length) {
      toast.error('Please select a category to search')
      return
    }
    if (missingRequiredField) {
      toast.error(`Please select ${missingRequiredField.name}`)
      return
    }

    // Same URL keys the listing page itself reads on load (cityId, q, condition,
    // transmission, fuelType, bedrooms, minPrice, maxPrice) — so these filters
    // are already applied the moment the results page opens. Make & Model, Trim
    // and Kilometres aren't included: the listing page doesn't persist
    // those to its URL either (they're session-only there too), so there is no
    // existing contract to hand them off through.
    const [minP, maxP] = priceRangeSelect ? priceRangeSelect.split('-') : [null, null]
    const extraParams = {
      ...passthroughParams,
      q: keywords || passthroughParams.q || '',
      cityId: cityId || passthroughParams.cityId || '',
      condition,
      transmission,
      fuelType,
      bedrooms,
      ...(minP != null ? { minPrice: minP, maxPrice: maxP } : {}),
    }

    const listingUrl = buildListingUrl({
      categoryPath: selectedPath,
      filterIds: selectedFilterIds,
      filterValues,
      extraParams,
    })

    // Persist full category search into My Search (no UI change).
    if (isAuthenticated) {
      persistSavedSearch(
        buildCategorySearchSavePayload({
          selectedPath,
          categoryPathNames,
          selectedFilterIds,
          filterValues,
          listingUrl,
          passthroughParams: extraParams,
        }),
      )
    }

    navigate(listingUrl)
  }

  return (
    // Same shell (marketplace top bar + category sidebar) as the product
    // listing page, so search and results share one chrome.
    <CategoryBrowseLayout
      activeCategoryId={selectedPath[0] || null}
      variant="listing"
      layoutPreset="marketplace"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FC]">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-[640px] pb-10 md:max-w-[820px] lg:max-w-[1100px]">
          <div className="mb-8 w-full text-center sm:mb-10">
            <h2 className="post-ad-step-heading">What are you looking for?</h2>
            <p className="post-ad-step-subheading">
              Pick a category — we&apos;ll narrow it down and show the filters that apply.
            </p>
          </div>

          {categoryPathNames.length ? (
            <nav className="mb-4 flex w-full flex-wrap items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              {categoryPathNames.map((name, index) => (
                <span key={`${selectedPath[index] || index}`} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <span className="font-medium text-gray-800">{name}</span>
                </span>
              ))}
            </nav>
          ) : null}

          {error ? (
            <p className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </p>
          ) : null}

          {/* Category levels and filters render as the same sections the listing
              page's Advanced Filter panel uses: picking a category appends the
              next section below, it never swaps the layout out. */}
          <div className="w-full">
            {/* City — same section, same data source (useEmirateCities + facet
                counts) as the listing page's Advanced Filter panel. */}
            <CityFilterSection
              cityId={cityId}
              cities={cities}
              citiesLoading={citiesLoading}
              citiesError={citiesError}
              onCityChange={setCityId}
            />

            {loadingRoots && !levelOptions[0]?.length ? (
              <div className="flex items-center gap-2 py-6 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                Loading categories…
              </div>
            ) : null}

            {levelOptions.map((options, level) =>
              options.length ? (
                <PanelSection key={`level-${level}`} title={levelTitle(level)}>
                  {level === 0 ? (
                    <CategoryIconGrid
                      items={options}
                      selectedId={selectedPath[0] || ''}
                      onSelect={(id) => handleSelect(0, id)}
                    />
                  ) : (
                    <ChipRow
                      options={options.map((c) => ({ value: c._id, label: c.name }))}
                      value={selectedPath[level] || ''}
                      onChange={(id) => (id ? handleSelect(level, id) : handleEditLevel(level))}
                      allowAny={false}
                    />
                  )}
                </PanelSection>
              ) : null,
            )}

            {loadingChildren ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                Loading subcategories…
              </div>
            ) : null}

            {/* Search / Make & Model / Trim / Price / Kilometres /
                Transmission / Fuel / Condition / Bedrooms — same sections, same
                order, same category-type gating as the listing page's panel. */}
            {isComplete ? (
              <VehiclePropertyFilterSections
                showVehicleExtras={showVehicleExtras}
                isPropertyCategory={isPropertyCategory}
                isClassifiedsCategory={isClassifiedsCategory}
                keywords={keywords}
                onKeywordsChange={setKeywords}
                makeModel={makeModel}
                onMakeModelChange={setMakeModel}
                trim={trim}
                onTrimChange={setTrim}
                trimOptions={[]}
                priceRange={priceRange}
                priceMin={priceMinMax.min}
                priceMax={priceMinMax.max}
                onPriceRangeChange={handlePriceRangeChange}
                kmsRange={kmsBounds}
                kmsMin={kmsMin}
                kmsMax={kmsMax}
                onKmsRangeChange={handleKmsRangeChange}
                condition={condition}
                onConditionChange={setCondition}
                transmission={transmission}
                onTransmissionChange={setTransmission}
                fuelType={fuelType}
                onFuelTypeChange={setFuelType}
                bedrooms={bedrooms}
                onBedroomsChange={setBedrooms}
              />
            ) : null}

            {isComplete && filtersLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                Loading filters for this category…
              </div>
            ) : null}

            {isComplete && filtersError ? (
              <p className="my-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {filtersError}
              </p>
            ) : null}

            {isComplete && !filtersLoading && !filtersError ? (
              <CategoryFilterFields
                fields={fields}
                selectedFilterIds={selectedFilterIds}
                filterValues={filterValues}
                onFilterIdsChange={setSelectedFilterIds}
                onFilterValuesChange={setFilterValues}
                enableShowMore
              />
            ) : null}
          </div>

          <div className="mt-6 w-full">
            <button
              type="button"
              onClick={handleSearch}
              disabled={!isComplete}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {!isComplete ? (
              <p className="mt-2 text-sm text-[#64748B]">
                Keep selecting until you reach the final category to start your search.
              </p>
            ) : null}
          </div>
          </div>
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default CategorySearchPage
