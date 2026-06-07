import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '../store/slices/productSlice'
import { fetchRootCategories } from '../store/slices/categorySlice'
import { productService } from '../services/api'
import { categoryService } from '../services/api'
import CategoryBrowseLayout from '../components/Categories/CategoryBrowseLayout'
import CategoryFilterChips from '../components/Categories/CategoryFilterChips'
import CategoryListingCard from '../components/Categories/CategoryListingCard'
import CategoryDynamicFilters from '../components/Categories/CategoryDynamicFilters'
import { CategoryBadge, matchesListingChip } from '../components/Categories/categoryBrowseShared'
import MotorsCategoryCascadingDropdowns from '../components/Filters/MotorsCategoryCascadingDropdowns'
import MotorsFiltersBar from '../components/Filters/MotorsFiltersBar'
import CategoryHierarchyFiltersBar from '../components/Filters/CategoryHierarchyFiltersBar'
import { X } from 'lucide-react'

const VEHICLE_CATEGORY_NAMES = ['Motors', 'Motor', 'Vehicles', 'Vehicle', 'Cars', 'Auto']

function buildPriceOptions(priceRange) {
  const { min = 0, max = 100000 } = priceRange
  const options = [{ value: '', label: 'Select' }]
  const steps = [
    [min, 5000],
    [5000, 10000],
    [10000, 25000],
    [25000, 50000],
    [50000, 100000],
    [100000, 200000],
    [200000, 500000],
    [500000, max],
  ].filter(([a, b]) => a < max)
  steps.forEach(([lo, hi]) => {
    const label =
      hi >= 1000 ? `${(lo / 1000).toFixed(0)}k - ${(hi / 1000).toFixed(0)}k` : `${lo} - ${hi}`
    options.push({ value: `${lo}-${hi}`, label })
  })
  return options
}

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

  // Vehicle bar state
  const [city, setCity] = useState('')
  const [makeModel, setMakeModel] = useState('')
  const [priceRangeSelect, setPriceRangeSelect] = useState('')
  const [year, setYear] = useState('')
  const [kms, setKms] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
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
    selectedCategory &&
    VEHICLE_CATEGORY_NAMES.some((name) =>
      (selectedCategory.name || '').toLowerCase().includes(name.toLowerCase())
    )

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

  const cities = facetCities
  const yearOptions = facetYears.length ? facetYears : buildYearOptions()
  const kmsOptions = buildKmsOptionsFromRange(facetMileageRange)
  const priceOptions = buildPriceOptions(priceRange)

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
  }, [categoryId, location.search, routeSubcategoryId])

  useEffect(() => {
    setSelectedFilterIds([])
  }, [categoryId, subcategoryFilterId, filterChildCategoryId])

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
      if (city && city.trim()) params.location = city.trim()
      // Prefer hierarchy IDs when available; they are the most reliable filter keys.
      // Send label-based filters only when corresponding IDs are not selected.
      if (!selectedHierarchy.brand && makeFilter && makeFilter.trim()) params.make = makeFilter.trim()
      if (!selectedHierarchy.model && modelFilter && modelFilter.trim()) params.model = modelFilter.trim()
      if (!selectedHierarchy.trim && trimFilter && trimFilter.trim()) params.trim = trimFilter.trim()
      // Always send hierarchy category IDs for robust matching against categoryPath/category/subcategory.
      if (selectedHierarchy.brand) params.brandId = selectedHierarchy.brand
      if (selectedHierarchy.model) params.modelId = selectedHierarchy.model
      if (selectedHierarchy.trim) params.trimId = selectedHierarchy.trim
      const searchParts = [makeModel, keywords].filter((s) => s && String(s).trim())
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
      city,
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
    city,
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

  const handleOpenAdvancedFilters = () => setShowAdvancedFilters(true)

  const clearAdvancedFilters = () => {
    setSelectedHierarchy({
      subcategory: '',
      brand: '',
      model: '',
      trim: '',
    })
    setMakeModel('')
    setCondition('')
    setTransmission('')
    setFuelType('')
    setKeywords('')
    setSelectedFilterIds([])
    setShowAdvancedFilters(false)
    fetchWithFilters(1, false)
  }

  const applyAdvancedFilters = () => {
    setShowAdvancedFilters(false)
    fetchWithFilters(1, false)
  }

  const filteredProducts = useMemo(
    () => products.filter((p) => matchesListingChip(p, activeChip)),
    [products, activeChip],
  )

  const featuredProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => {
          if (a.adType === 'premium' && b.adType !== 'premium') return -1
          if (b.adType === 'premium' && a.adType !== 'premium') return 1
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        })
        .slice(0, 3),
    [products],
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

  return (
    <CategoryBrowseLayout activeCategoryId={categoryId} featuredProducts={featuredProducts}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <CategoryFilterChips activeChip={activeChip} onChange={setActiveChip} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <CategoryBadge category={categoryForUi} />
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="text-xs font-medium text-slate-400 transition hover:text-primary-700"
                >
                  ← Categories
                </button>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{categoryForUi.name}</h1>
                <p className="text-sm text-slate-500">{listingCountLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-sm text-slate-500">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-400"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {(isVehicleCategory || categoryLoading) && (
            <div className="mb-5">
              {isVehicleCategory ? (
                <MotorsFiltersBar
                city={city}
                subcategories={subcategories}
                selectedHierarchy={selectedHierarchy}
                onChangeCity={setCity}
                onSubcategoryChange={(id) => {
                  syncSubcategoryToUrl(id, { brandId: '', modelId: '', trimId: '', make: '', model: '', trim: '' })
                  setSelectedHierarchy({
                    subcategory: id,
                    brand: '',
                    model: '',
                    trim: '',
                  })
                  setSelectedHierarchyLabels({ brand: '', model: '', trim: '' })
                }}
                onBrandChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    brand: id,
                    model: '',
                    trim: '',
                  }))
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
                }}
                onModelChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    model: id,
                    trim: '',
                  }))
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
                }}
                onTrimChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    trim: id,
                  }))
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
                }}
                priceRange={priceRangeSelect}
                year={year}
                kms={kms}
                onChangePriceRange={setPriceRangeSelect}
                onChangeYear={setYear}
                onChangeKms={setKms}
                cities={cities}
                priceOptions={priceOptions}
                yearOptions={yearOptions}
                kmsOptions={kmsOptions}
                onOpenAdvancedFilters={handleOpenAdvancedFilters}
              />
            ) : (
              <CategoryHierarchyFiltersBar
                subcategories={subcategories}
                selectedHierarchy={selectedHierarchy}
                onSubcategoryChange={(id) => {
                  syncSubcategoryToUrl(id, { brandId: '', modelId: '', trimId: '', make: '', model: '', trim: '' })
                  setSelectedHierarchy({
                    subcategory: id,
                    brand: '',
                    model: '',
                    trim: '',
                  })
                  setSelectedHierarchyLabels({ brand: '', model: '', trim: '' })
                }}
                onBrandChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    brand: id,
                    model: '',
                    trim: '',
                  }))
                  setSelectedHierarchyLabels((prev) => ({ ...prev, brand: meta?.label || '', model: '', trim: '' }))
                  syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                    brandId: id,
                    modelId: '',
                    trimId: '',
                    make: meta?.label || '',
                    model: '',
                    trim: '',
                  })
                }}
                onModelChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    model: id,
                    trim: '',
                  }))
                  setSelectedHierarchyLabels((prev) => ({ ...prev, model: meta?.label || '', trim: '' }))
                  syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                    brandId: selectedHierarchy.brand,
                    modelId: id,
                    trimId: '',
                    make: makeFilter,
                    model: meta?.label || '',
                    trim: '',
                  })
                }}
                onTrimChange={(id, meta) => {
                  setSelectedHierarchy((prev) => ({
                    ...prev,
                    trim: id,
                  }))
                  setSelectedHierarchyLabels((prev) => ({ ...prev, trim: meta?.label || '' }))
                  syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                    brandId: selectedHierarchy.brand,
                    modelId: selectedHierarchy.model,
                    trimId: id,
                    make: makeFilter,
                    model: modelFilter,
                    trim: meta?.label || '',
                  })
                }}
                onOpenAdvancedFilters={handleOpenAdvancedFilters}
              />
            )}
            </div>
          )}

          {loading && products.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white animate-pulse">
                  <div className="h-52 bg-slate-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 rounded bg-slate-100 w-3/4" />
                    <div className="h-3 rounded bg-slate-100 w-1/2" />
                    <div className="h-6 rounded bg-slate-100 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-2">No listings found</h3>
              <p className="text-slate-500 mb-4">Try adjusting filters or choose another category chip.</p>
              {activeChip !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setActiveChip('all')}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  Show all items
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <CategoryListingCard key={product._id} product={product} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

        {/* Advanced filters drawer (condition, transmission, fuel type, keywords) — responsive */}
        {showAdvancedFilters && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowAdvancedFilters(false)}
              aria-hidden="true"
            />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 p-6 overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Advanced Filters</h2>
                <button
                  onClick={() => setShowAdvancedFilters(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Refine by subcategory, brand, and admin-managed filters for this category.
              </p>

              <div className="flex-1 space-y-6">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Category tree</p>
                  <MotorsCategoryCascadingDropdowns
                  rootLabel="Subcategory"
                  subcategories={subcategories}
                  selectedHierarchy={selectedHierarchy}
                  onSubcategoryChange={(id) => {
                    syncSubcategoryToUrl(id, { brandId: '', modelId: '', trimId: '', make: '', model: '', trim: '' })
                    setSelectedHierarchy({
                      subcategory: id,
                      brand: '',
                      model: '',
                      trim: '',
                    })
                    setSelectedHierarchyLabels({ brand: '', model: '', trim: '' })
                  }}
                  onBrandChange={(id, meta) => {
                    setSelectedHierarchy((prev) => ({
                      ...prev,
                      brand: id,
                      model: '',
                      trim: '',
                    }))
                    setSelectedHierarchyLabels((prev) => ({ ...prev, brand: meta?.label || '', model: '', trim: '' }))
                    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                      brandId: id,
                      modelId: '',
                      trimId: '',
                      make: meta?.label || '',
                      model: '',
                      trim: '',
                    })
                  }}
                  onModelChange={(id, meta) => {
                    setSelectedHierarchy((prev) => ({
                      ...prev,
                      model: id,
                      trim: '',
                    }))
                    setSelectedHierarchyLabels((prev) => ({ ...prev, model: meta?.label || '', trim: '' }))
                    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                      brandId: selectedHierarchy.brand,
                      modelId: id,
                      trimId: '',
                      make: makeFilter,
                      model: meta?.label || '',
                      trim: '',
                    })
                  }}
                  onTrimChange={(id, meta) => {
                    setSelectedHierarchy((prev) => ({
                      ...prev,
                      trim: id,
                    }))
                    setSelectedHierarchyLabels((prev) => ({ ...prev, trim: meta?.label || '' }))
                    syncSubcategoryToUrl(selectedHierarchy.subcategory, {
                      brandId: selectedHierarchy.brand,
                      modelId: selectedHierarchy.model,
                      trimId: id,
                      make: makeFilter,
                      model: modelFilter,
                      trim: meta?.label || '',
                    })
                  }}
                />
                </div>

                <CategoryDynamicFilters
                  categoryId={categoryId}
                  subcategoryId={subcategoryFilterId}
                  childCategoryId={filterChildCategoryId}
                  selectedFilterIds={selectedFilterIds}
                  onChange={setSelectedFilterIds}
                />
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={applyAdvancedFilters}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </>
        )}
    </CategoryBrowseLayout>
  )
}

export default CategoryProductsPage
