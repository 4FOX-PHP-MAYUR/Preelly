import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '@shared/store/slices/productSlice'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { productService } from '@shared/services/api'
import { categoryService } from '@shared/services/api'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import CategoryFilterChips from '../components/Categories/CategoryFilterChips'
import {
  CategoryBadge,
  matchesListingChip,
  isVehicleCategoryName,
  isPropertyCategoryName,
  isClassifiedsCategoryName,
} from '../components/Categories/categoryBrowseShared'
import AdvancedFilterPanel from '../components/Listing/AdvancedFilterPanel'
import ListingToolbar from '../components/Listing/ListingToolbar'
import ProductGrid from '../components/Listing/ProductGrid'
import { useCategoryApiTree } from '../hooks/useCategoryApiTree'
import { useEmirateCities } from '../hooks/useEmirateCities'
import {
  buildCityFilterOptions,
  resolveCityNameById,
} from '@shared/utils/buildCityFilterOptions'

function buildYearOptions() {
  const currentYear = new Date().getFullYear()
  const options = [{ value: '', label: 'Select' }]
  for (let y = currentYear; y >= 1990; y--) {
    options.push({ value: String(y), label: String(y) })
  }
  return options
}

function buildKmsOptionsFromRange(range) {
  const min = Math.max(0, Number(range?.min) || 0)
  const max = Math.max(0, Number(range?.max) || 0)
  const options = [{ value: '', label: 'Select' }]
  if (!max || max <= 0) return options

  const steps = [
    [0, 10000, 'Under 10k'],
    [10000, 50000, '10k - 50k'],
    [50000, 100000, '50k - 100k'],
    [100000, 200000, '100k - 200k'],
    [200000, Math.max(500000, max), '200k+'],
  ]

  for (const [lo, hi, label] of steps) {
    if (hi <= min) continue
    const upper = Math.min(hi, Math.max(hi, max))
    if (lo >= upper) continue
    options.push({ value: `${lo}-${upper}`, label })
  }

  return options
}

const CONDITION_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'Brand New', label: 'Brand New' },
  { value: 'Like New', label: 'Like New' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
]

const TRANSMISSION_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'Semi-Automatic', label: 'Semi-Automatic' },
  { value: 'CVT', label: 'CVT' },
  { value: 'Dual Clutch', label: 'Dual Clutch' },
]

const FUEL_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'LPG', label: 'LPG' },
  { value: 'CNG', label: 'CNG' },
]

function CategoryProductsPage() {
  const { categoryId, subcategoryId: routeSubcategoryId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { products, loading, hasMore, page } = useSelector((state) => state.products)
  const { rootCategories, rootLoading: categoriesLoading, rootError: categoriesError } = useSelector(
    (state) => state.categories
  )
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [subcategories, setSubcategories] = useState([])
  const didFetchRootsRef = useRef(false)
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [facetCities, setFacetCities] = useState([])
  const [facetYears, setFacetYears] = useState([])
  const [facetMileageRange, setFacetMileageRange] = useState({ min: 0, max: 0 })

  // Location filter (emirates / cities table id)
  const [cityId, setCityId] = useState('')
  const [makeModel, setMakeModel] = useState('')
  const [priceRangeSelect, setPriceRangeSelect] = useState('')
  const [year, setYear] = useState('')
  const [kms, setKms] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [apiParentId, setApiParentId] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const makeModelDebounceRef = useRef(null)

  // Advanced filters (vehicle hierarchy: subcategory -> brand -> model -> trim)
  const [selectedHierarchy, setSelectedHierarchy] = useState({
    subcategory: '',
    brand: '',
    model: '',
    trim: '',
  })
  const [selectedHierarchyLabels, setSelectedHierarchyLabels] = useState({
    brand: '',
    model: '',
    trim: '',
  })

  const normalizeBrandLabel = (label) => {
    const s = String(label || '').trim()
    if (!s) return ''
    // Use the primary portion for matching against saved product strings.
    // Example: "Mercedes-Benz" -> "Mercedes"
    return s.split(/[-–•|]/)[0].trim()
  }

  const normalizeModelOrTrimLabel = (label) => String(label || '').trim()
  const [condition, setCondition] = useState('')
  const [transmission, setTransmission] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [keywords, setKeywords] = useState('')
  const [activeChip, setActiveChip] = useState('all')
  const [selectedFilterIds, setSelectedFilterIds] = useState([])

  const filterChildCategoryId =
    selectedHierarchy.trim || selectedHierarchy.model || selectedHierarchy.brand || ''

  const isVehicleCategory =
    selectedCategory && isVehicleCategoryName(selectedCategory.name)

  const isPropertyCategory =
    selectedCategory && isPropertyCategoryName(selectedCategory.name)

  const isClassifiedsCategory =
    selectedCategory && isClassifiedsCategoryName(selectedCategory.name)

  const useApiCategoryTree = isPropertyCategory || isClassifiedsCategory

  const { categories: apiCategories, loading: apiCategoriesLoading, error: apiCategoriesError } =
    useCategoryApiTree(useApiCategoryTree ? selectedCategory?.name : '')

  const { emirates, loading: emiratesLoading, error: emiratesError } = useEmirateCities()

  const selectedSubcategory = subcategories?.find((s) => String(s._id) === String(selectedHierarchy.subcategory))
  const isBicycleSubcategory =
    selectedSubcategory && /bicycle|bike/i.test(selectedSubcategory.name || '')

  // Only level-1 vehicle subcategory is stored as `product.subcategory`.
  // Brand/Model/Trim are part of the cascading UI (category tree) but are not directly mapped
  // to backend `subcategoryId` filtering in the current product schema.
  const subcategoryFilterId = selectedHierarchy.subcategory
  const makeFilter = selectedHierarchyLabels.brand
  const modelFilter = selectedHierarchyLabels.model
  const trimFilter = selectedHierarchyLabels.trim

  const cities = useMemo(
    () => buildCityFilterOptions(emirates, facetCities),
    [emirates, facetCities],
  )
  const selectedCityName = useMemo(
    () => resolveCityNameById(cityId, emirates),
    [cityId, emirates],
  )
  const yearOptions = facetYears.length ? facetYears : buildYearOptions()
  const kmsOptions = buildKmsOptionsFromRange(facetMileageRange)

  const priceMinMax = useMemo(() => {
    if (priceRangeSelect) {
      const [minP, maxP] = priceRangeSelect.split('-').map(Number)
      if (!isNaN(minP) && !isNaN(maxP)) return { min: minP, max: maxP }
    }
    return { min: priceRange.min, max: priceRange.max }
  }, [priceRangeSelect, priceRange])

  useEffect(() => {
    // Avoid duplicate category fetches on initial load / dev StrictMode.
    if (didFetchRootsRef.current) return
    if ((!rootCategories || rootCategories.length === 0) && !categoriesLoading) {
      didFetchRootsRef.current = true
      dispatch(fetchRootCategories())
    }
  }, [dispatch, rootCategories, categoriesLoading])

  useEffect(() => {
    if (!categoryId) return

    let cancelled = false
    const run = async () => {
      setCategoryLoading(true)
      setCategoryError('')
      try {
        const res = await categoryService.getCategoryById(categoryId)
        if (cancelled) return
        setSelectedCategory(res.data)
      } catch (e) {
        if (cancelled) return
        setCategoryError(e?.response?.data?.message || e?.message || 'Failed to load category')
        // Fallback so the page doesn't stay stuck.
        setSelectedCategory({ _id: categoryId, name: 'Category', icon: null, emoji: '📦' })
      } finally {
        if (cancelled) return
        setCategoryLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [categoryId])

  useEffect(() => {
    if (!categoryId) return
    let cancelled = false

    const run = async () => {
      try {
        const res = await categoryService.getCategoryChildren(categoryId)
        if (cancelled) return
        setSubcategories(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setSubcategories([])
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [categoryId])

  useEffect(() => {
    isFirstMakeModelRef.current = true
  }, [categoryId])

  const location = useLocation()
  useEffect(() => {
    // Prefer subcategory from query string, then route param (if present).
    // This covers both navigation styles: /categories/:id/products?subcategoryId=...
    // and /categories/:id/subcategory/:subcategoryId -> routed with useParams.
    const q = new URLSearchParams(location.search || '')
    const subFromQuery = q.get('subcategoryId') || ''
    const brandFromQuery = q.get('brandId') || ''
    const modelFromQuery = q.get('modelId') || ''
    const trimFromQuery = q.get('trimId') || ''
    const chosen = subFromQuery || routeSubcategoryId || ''
    setSelectedHierarchy({
      subcategory: chosen,
      brand: brandFromQuery,
      model: modelFromQuery,
      trim: trimFromQuery,
    })

    // Restore label-based filters if present (used for API filtering).
    setSelectedHierarchyLabels({
      brand: q.get('make') || '',
      model: q.get('model') || '',
      trim: q.get('trim') || '',
    })
    setCityId(q.get('cityId') || '')
  }, [categoryId, location.search, routeSubcategoryId])

  useEffect(() => {
    setSelectedFilterIds([])
    setApiParentId('')
    setBedrooms('')
  }, [categoryId, subcategoryFilterId, filterChildCategoryId])

  useEffect(() => {
    setCityId('')
  }, [categoryId])

  // NOTE: removed automatic URL sync to avoid navigation loops that could trigger
  // repeated fetches. Subcategory is read from either query string or route param.
  const syncSubcategoryToUrl = useCallback(
    (nextSubcategoryId, { brandId = '', modelId = '', trimId = '', make = '', model = '', trim = '' } = {}) => {
      const q = new URLSearchParams(location.search || '')
      const next = String(nextSubcategoryId || '').trim()
      if (next) q.set('subcategoryId', next)
      else q.delete('subcategoryId')

      const b = String(brandId || '').trim()
      const m = String(modelId || '').trim()
      const t = String(trimId || '').trim()
      if (b) q.set('brandId', b)
      else q.delete('brandId')
      if (m) q.set('modelId', m)
      else q.delete('modelId')
      if (t) q.set('trimId', t)
      else q.delete('trimId')

      // Also store label-based filters so backend filtering works even if options change.
      const makeLabel = String(make || '').trim()
      const modelLabel = String(model || '').trim()
      const trimLabel = String(trim || '').trim()
      if (makeLabel) q.set('make', makeLabel)
      else q.delete('make')
      if (modelLabel) q.set('model', modelLabel)
      else q.delete('model')
      if (trimLabel) q.set('trim', trimLabel)
      else q.delete('trim')

      navigate(
        {
          pathname: `/categories/${categoryId}/products`,
          search: q.toString() ? `?${q.toString()}` : '',
        },
        { replace: true },
      )
    },
    [navigate, location.search, categoryId],
  )

  // When user selects Bicycles, clear car-only filters so they don't affect results
  useEffect(() => {
    if (isBicycleSubcategory) {
      setTransmission('')
      setFuelType('')
    }
  }, [selectedHierarchy.subcategory, isBicycleSubcategory])

  useEffect(() => {
    const fetchPriceRange = async () => {
      try {
        const response = await productService.getPriceRange(categoryId)
        const { minPrice, maxPrice } = response.data
        setPriceRange({ min: minPrice, max: maxPrice })
      } catch (e) {
        console.error('Error fetching price range:', e)
      }
    }
    fetchPriceRange()
  }, [categoryId])

  useEffect(() => {
    if (!categoryId) return
    let cancelled = false

    const run = async () => {
      try {
        const res = await productService.getFacets({
          categoryId,
          subcategoryId: subcategoryFilterId || undefined,
        })
        if (cancelled) return
        const data = res?.data || {}
        setFacetCities(Array.isArray(data.cities) ? data.cities : [])
        setFacetYears(Array.isArray(data.years) ? data.years : [])
        setFacetMileageRange(data.mileageRange || { min: 0, max: 0 })
      } catch (e) {
        if (cancelled) return
        console.error('Error fetching facets:', e)
        setFacetCities([])
        setFacetYears([])
        setFacetMileageRange({ min: 0, max: 0 })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [categoryId, subcategoryFilterId])

  const fetchWithFilters = useCallback(
    (pageNum = 1, append = false) => {
      if (!categoryId) return
      if (!append) dispatch(clearProducts())

      const params = { page: pageNum, limit: 20, categoryId, sortBy }
      if (subcategoryFilterId && subcategoryFilterId.trim()) params.subcategoryId = subcategoryFilterId.trim()
      if (cityId && String(cityId).trim()) {
        params.cityId = String(cityId).trim()
      } else if (selectedCityName) {
        params.location = selectedCityName
      }
      // Prefer hierarchy IDs when available; they are the most reliable filter keys.
      // Send label-based filters only when corresponding IDs are not selected.
      if (!selectedHierarchy.brand && makeFilter && makeFilter.trim()) params.make = makeFilter.trim()
      if (!selectedHierarchy.model && modelFilter && modelFilter.trim()) params.model = modelFilter.trim()
      if (!selectedHierarchy.trim && trimFilter && trimFilter.trim()) params.trim = trimFilter.trim()
      // Always send hierarchy category IDs for robust matching against categoryPath/category/subcategory.
      if (selectedHierarchy.brand) params.brandId = selectedHierarchy.brand
      if (selectedHierarchy.model) params.modelId = selectedHierarchy.model
      if (selectedHierarchy.trim) params.trimId = selectedHierarchy.trim
      const searchParts = [makeModel, keywords]
        .filter((s) => s && String(s).trim())
      if (bedrooms && (isPropertyCategory || isClassifiedsCategory)) {
        searchParts.push(`${bedrooms} bedroom`)
      }
      if (searchParts.length) params.search = searchParts.join(' ').trim()
      if (priceRangeSelect) {
        const [minP, maxP] = priceRangeSelect.split('-').map(Number)
        if (!isNaN(minP)) params.minPrice = minP
        if (!isNaN(maxP)) params.maxPrice = maxP
      }
      if (year) params.year = year
      if (kms) {
        const [minK, maxK] = kms.split('-').map(Number)
        if (!isNaN(minK)) params.minMileage = minK
        if (!isNaN(maxK)) params.maxMileage = maxK
      }
      if (condition && condition.trim()) params.condition = condition.trim()
      if (!isBicycleSubcategory) {
        if (transmission && transmission.trim()) params.transmission = transmission.trim()
        if (fuelType && fuelType.trim()) params.fuelType = fuelType.trim()
      }
      if (selectedFilterIds.length) {
        params.filterIds = selectedFilterIds.join(',')
      }

      dispatch(fetchProducts(params))
    },
    [
      categoryId,
      subcategoryFilterId,
      cityId,
      selectedCityName,
      makeModel,
      keywords,
      priceRangeSelect,
      year,
      kms,
      condition,
      transmission,
      fuelType,
      sortBy,
      isBicycleSubcategory,
      makeFilter,
      modelFilter,
      trimFilter,
      selectedHierarchy.brand,
      selectedHierarchy.model,
      selectedHierarchy.trim,
      selectedFilterIds,
      bedrooms,
      isPropertyCategory,
      isClassifiedsCategory,
      dispatch,
    ]
  )

  // Initial load and when category or filters (except makeModel, keywords) change — real-time update
  // Include hierarchy IDs: URL hydration runs in a separate effect; without these deps the first fetch
  // can run before brand/model/trim IDs exist and return the wrong product set (e.g. any BMW).
  useEffect(() => {
    if (!categoryId) return
    fetchWithFilters(1, false)
  }, [
    categoryId,
    subcategoryFilterId,
    cityId,
    priceRangeSelect,
    year,
    kms,
    condition,
    transmission,
    fuelType,
    sortBy,
    makeFilter,
    modelFilter,
    trimFilter,
    selectedHierarchy.brand,
    selectedHierarchy.model,
    selectedHierarchy.trim,
    selectedFilterIds,
    bedrooms,
    fetchWithFilters,
  ])

  // Debounced search when makeModel changes
  const isFirstMakeModelRef = useRef(true)
  useEffect(() => {
    if (!categoryId) return
    if (isFirstMakeModelRef.current) {
      isFirstMakeModelRef.current = false
      return
    }
    if (makeModelDebounceRef.current) clearTimeout(makeModelDebounceRef.current)
    makeModelDebounceRef.current = setTimeout(() => {
      fetchWithFilters(1, false)
    }, 400)
    return () => {
      if (makeModelDebounceRef.current) clearTimeout(makeModelDebounceRef.current)
    }
  }, [makeModel])

  // Debounced refetch when keywords change
  const keywordsDebounceRef = useRef(null)
  const isFirstKeywordsRef = useRef(true)
  useEffect(() => {
    if (!categoryId) return
    if (isFirstKeywordsRef.current) {
      isFirstKeywordsRef.current = false
      return
    }
    if (keywordsDebounceRef.current) clearTimeout(keywordsDebounceRef.current)
    keywordsDebounceRef.current = setTimeout(() => fetchWithFilters(1, false), 400)
    return () => {
      if (keywordsDebounceRef.current) clearTimeout(keywordsDebounceRef.current)
    }
  }, [keywords])

  useEffect(() => {
    isFirstKeywordsRef.current = true
  }, [categoryId])

  const loadMore = () => {
    if (hasMore && !loading) fetchWithFilters(page + 1, true)
  }

  const handleOpenFilters = useCallback(() => {
    const isDesktop =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) setShowFiltersPanel(true)
    else setShowMobileFilters(true)
  }, [])

  const handleCityChange = useCallback(
    (nextCityId) => {
      const id = String(nextCityId || '').trim()
      setCityId(id)
      const q = new URLSearchParams(location.search || '')
      if (id) q.set('cityId', id)
      else q.delete('cityId')
      navigate(
        {
          pathname: `/categories/${categoryId}/products`,
          search: q.toString() ? `?${q.toString()}` : '',
        },
        { replace: true },
      )
    },
    [navigate, location.search, categoryId],
  )

  const handleSubcategoryChange = (id) => {
    syncSubcategoryToUrl(id, { brandId: '', modelId: '', trimId: '', make: '', model: '', trim: '' })
    setSelectedHierarchy({ subcategory: id, brand: '', model: '', trim: '' })
    setSelectedHierarchyLabels({ brand: '', model: '', trim: '' })
  }

  const handleBrandChange = (id, meta) => {
    setSelectedHierarchy((prev) => ({ ...prev, brand: id, model: '', trim: '' }))
    setSelectedHierarchyLabels({
      brand: normalizeBrandLabel(meta?.label || ''),
      model: '',
      trim: '',
    })
    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
      brandId: id,
      modelId: '',
      trimId: '',
      make: normalizeBrandLabel(meta?.label || ''),
      model: '',
      trim: '',
    })
  }

  const handleModelChange = (id, meta) => {
    setSelectedHierarchy((prev) => ({ ...prev, model: id, trim: '' }))
    setSelectedHierarchyLabels((prev) => ({
      ...prev,
      model: normalizeModelOrTrimLabel(meta?.label || ''),
      trim: '',
    }))
    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
      brandId: selectedHierarchy.brand,
      modelId: id,
      trimId: '',
      make: makeFilter,
      model: normalizeModelOrTrimLabel(meta?.label || ''),
      trim: '',
    })
  }

  const handleTrimChange = (id, meta) => {
    setSelectedHierarchy((prev) => ({ ...prev, trim: id }))
    setSelectedHierarchyLabels((prev) => ({
      ...prev,
      trim: normalizeModelOrTrimLabel(meta?.label || ''),
    }))
    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
      brandId: selectedHierarchy.brand,
      modelId: selectedHierarchy.model,
      trimId: id,
      make: makeFilter,
      model: modelFilter,
      trim: normalizeModelOrTrimLabel(meta?.label || ''),
    })
  }

  const handleApiParentChange = (parentId) => {
    setApiParentId(parentId)
    handleSubcategoryChange(parentId)
  }

  const handleApiSubcategoryChange = (subId) => {
    const effective = subId || apiParentId
    if (effective) handleSubcategoryChange(effective)
  }

  const handlePriceRangeChange = (lo, hi) => {
    setPriceRangeSelect(`${lo}-${hi}`)
  }

  const clearAdvancedFilters = () => {
    setSelectedHierarchy({ subcategory: '', brand: '', model: '', trim: '' })
    setSelectedHierarchyLabels({ brand: '', model: '', trim: '' })
    setMakeModel('')
    setCondition('')
    setTransmission('')
    setFuelType('')
    setKeywords('')
    setSelectedFilterIds([])
    setApiParentId('')
    setBedrooms('')
    setPriceRangeSelect('')
    setCityId('')
    setYear('')
    setKms('')
    setShowMobileFilters(false)
    fetchWithFilters(1, false)
  }

  const applyAdvancedFilters = () => {
    setShowMobileFilters(false)
    fetchWithFilters(1, false)
  }

  const filteredProducts = useMemo(
    () => products.filter((p) => matchesListingChip(p, activeChip)),
    [products, activeChip],
  )

  const categoryForUi =
    selectedCategory ||
    ({
      _id: categoryId,
      name: categoryLoading ? 'Loading category...' : categoryError ? String(categoryError) : 'Category',
      icon: null,
      emoji: '📦',
    })

  const listingCountLabel =
    loading && products.length === 0
      ? 'Loading listings…'
      : `${filteredProducts.length} listing${filteredProducts.length !== 1 ? 's' : ''} found`

  const breadcrumbLabel = selectedSubcategory?.name
    ? `${categoryForUi.name} › ${selectedSubcategory.name}`
    : categoryForUi.name

  const gridColumns = showFiltersPanel ? 2 : 3

  const apiSubcategoryId = useMemo(() => {
    if (!useApiCategoryTree || !apiParentId) return ''
    const parent = apiCategories.find((c) => String(c._id) === String(apiParentId))
    if (!parent) return ''
    const match = (parent.subcategories || []).find((s) => String(s._id) === String(subcategoryFilterId))
    return match ? subcategoryFilterId : ''
  }, [useApiCategoryTree, apiParentId, apiCategories, subcategoryFilterId])

  useEffect(() => {
    if (!useApiCategoryTree || !apiCategories.length) return
    const subId = subcategoryFilterId
    if (!subId) return
    const asParent = apiCategories.find((c) => String(c._id) === String(subId))
    if (asParent) {
      setApiParentId(subId)
      return
    }
    for (const parent of apiCategories) {
      const child = (parent.subcategories || []).find((s) => String(s._id) === String(subId))
      if (child) {
        setApiParentId(parent._id)
        return
      }
    }
  }, [useApiCategoryTree, apiCategories, subcategoryFilterId])

  const filterPanelProps = useMemo(
    () => ({
      isVehicleCategory,
      isPropertyCategory,
      isClassifiedsCategory,
      isBicycleSubcategory,
      useApiCategoryTree,
      apiCategories,
      apiCategoriesLoading,
      apiCategoriesError,
      apiParentId,
      apiSubcategoryId,
      subcategories,
      selectedHierarchy,
      sortBy,
      cityId,
      cities,
      citiesLoading: emiratesLoading,
      citiesError: emiratesError,
      priceRange,
      priceMin: priceMinMax.min,
      priceMax: priceMinMax.max,
      year,
      yearOptions,
      kms,
      kmsOptions,
      condition,
      transmission,
      fuelType,
      keywords,
      bedrooms,
      categoryId,
      subcategoryFilterId,
      filterChildCategoryId,
      selectedFilterIds,
    }),
    [
      isVehicleCategory,
      isPropertyCategory,
      isClassifiedsCategory,
      isBicycleSubcategory,
      useApiCategoryTree,
      apiCategories,
      apiCategoriesLoading,
      apiCategoriesError,
      apiParentId,
      apiSubcategoryId,
      subcategories,
      selectedHierarchy,
      sortBy,
      cityId,
      cities,
      emiratesLoading,
      emiratesError,
      priceRange,
      priceMinMax,
      year,
      yearOptions,
      kms,
      kmsOptions,
      condition,
      transmission,
      fuelType,
      keywords,
      bedrooms,
      categoryId,
      subcategoryFilterId,
      filterChildCategoryId,
      selectedFilterIds,
    ],
  )

  const filterPanel = showFiltersPanel ? (
    <AdvancedFilterPanel
      className="h-full"
      {...filterPanelProps}
      onSortChange={setSortBy}
      onCityChange={handleCityChange}
      onPriceRangeChange={handlePriceRangeChange}
      onYearChange={setYear}
      onKmsChange={setKms}
      onConditionChange={setCondition}
      onTransmissionChange={setTransmission}
      onFuelTypeChange={setFuelType}
      onKeywordsChange={setKeywords}
      onBedroomsChange={setBedrooms}
      onSubcategoryChange={handleSubcategoryChange}
      onBrandChange={handleBrandChange}
      onModelChange={handleModelChange}
      onTrimChange={handleTrimChange}
      onApiParentChange={handleApiParentChange}
      onApiSubcategoryChange={handleApiSubcategoryChange}
      onFilterIdsChange={setSelectedFilterIds}
      onApply={applyAdvancedFilters}
      onReset={clearAdvancedFilters}
    />
  ) : null

  return (
    <CategoryBrowseLayout
      activeCategoryId={categoryId}
      variant="listing"
      filterPanel={filterPanel}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FC]">
        <div className="shrink-0 border-b border-[#E8EBF2] bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <CategoryFilterChips activeChip={activeChip} onChange={setActiveChip} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <CategoryBadge category={categoryForUi} />
              <div>
                <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#94A3B8]">
                  <button
                    type="button"
                    onClick={() => navigate('/categories')}
                    className="transition hover:text-brand"
                  >
                    Categories
                  </button>
                  <span className="text-[#CBD5E1]" aria-hidden>
                    ›
                  </span>
                  <span className="text-[#475569]">{breadcrumbLabel}</span>
                </nav>
                <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
                  {categoryForUi.name}
                </h1>
                <p className="mt-1 text-sm text-[#64748B]">{listingCountLabel}</p>
              </div>
            </div>
            <ListingToolbar
              sortBy={sortBy}
              onSortChange={setSortBy}
              onOpenFilters={handleOpenFilters}
              onToggleFiltersPanel={() => setShowFiltersPanel((v) => !v)}
              showFiltersPanel={showFiltersPanel}
              filtersOpen={showMobileFilters}
            />
          </div>

          <ProductGrid
            products={filteredProducts}
            loading={loading}
            columns={gridColumns}
            emptyState={
              <div className="rounded-2xl border border-[#E8EBF2] bg-white p-12 text-center shadow-sm">
                <h3 className="mb-2 text-xl font-bold text-[#0F172A]">No listings found</h3>
                <p className="mb-4 text-[#64748B]">Try adjusting filters or choose another category chip.</p>
                {activeChip !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setActiveChip('all')}
                    className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 hover:shadow-brand/35"
                  >
                    Show all items
                  </button>
                ) : null}
              </div>
            }
          />

          {hasMore && filteredProducts.length > 0 ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 hover:shadow-brand/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showMobileFilters ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-[#0F172A]/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setShowMobileFilters(false)}
            aria-label="Close filters overlay"
          />
          <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-[420px] animate-drawer-slide-in shadow-2xl lg:hidden">
            <AdvancedFilterPanel
              className="h-full"
              showClose
              onClose={() => setShowMobileFilters(false)}
              {...filterPanelProps}
              onSortChange={setSortBy}
              onCityChange={handleCityChange}
              onPriceRangeChange={handlePriceRangeChange}
              onYearChange={setYear}
              onKmsChange={setKms}
              onConditionChange={setCondition}
              onTransmissionChange={setTransmission}
              onFuelTypeChange={setFuelType}
              onKeywordsChange={setKeywords}
              onBedroomsChange={setBedrooms}
              onSubcategoryChange={handleSubcategoryChange}
              onBrandChange={handleBrandChange}
              onModelChange={handleModelChange}
              onTrimChange={handleTrimChange}
              onApiParentChange={handleApiParentChange}
              onApiSubcategoryChange={handleApiSubcategoryChange}
              onFilterIdsChange={setSelectedFilterIds}
              onApply={applyAdvancedFilters}
              onReset={clearAdvancedFilters}
            />
          </div>
        </>
      ) : null}
    </CategoryBrowseLayout>
  )
}

export default CategoryProductsPage
