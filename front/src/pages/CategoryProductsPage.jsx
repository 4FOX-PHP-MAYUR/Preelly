import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '@shared/store/slices/productSlice'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { fetchFeedShell } from '@shared/store/slices/feedSlice'
import { selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { productService } from '@shared/services/api'
import { categoryService } from '@shared/services/api'
import { KMS_FILTER_RANGE } from '@shared/utils/constants'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import {
  matchesListingChip,
  isVehicleCategoryName,
  isPropertyCategoryName,
  isClassifiedsCategoryName,
} from '../components/Categories/categoryBrowseShared'
import AdvancedFilterPanel from '../components/Listing/AdvancedFilterPanel'
import PriceFilterPanel from '../components/Listing/PriceFilterPanel'
import RegionFilterPanel from '../components/Listing/RegionFilterPanel'
import KilometresFilterPanel from '../components/Listing/KilometresFilterPanel'
import ListingToolbar from '../components/Listing/ListingToolbar'
import ProductGrid from '../components/Listing/ProductGrid'
import { useCategoryApiTree } from '../hooks/useCategoryApiTree'
import { useEmirateCities } from '../hooks/useEmirateCities'
import useFilterPanelSlide from '../hooks/useFilterPanelSlide'
import {
  buildCityFilterOptions,
  resolveCityNameById,
} from '@shared/utils/buildCityFilterOptions'
import {
  FILTER_IDS_PARAM,
  FILTER_VALUES_PARAM,
  CATEGORY_PATH_PARAM,
  parseListingSearchParams,
  serializeFilterValues,
  serializeIdList,
} from '@shared/utils/categorySearchParams'
import {
  buildCategorySearchSavePayload,
  persistSavedSearch,
} from '@shared/utils/persistSavedSearch'

/**
 * Toolbar quick-filter label → its own side panel. One map drives both opening the
 * panel and highlighting the chip, so the two can't disagree. A label that isn't
 * here has no dedicated panel and is only editable inside the Advanced panel.
 */
const QUICK_FILTER_PANELS = {
  Price: 'price',
  Region: 'region',
  Kilometres: 'kilometres',
}

const QUICK_FILTER_LABEL_BY_PANEL = Object.fromEntries(
  Object.entries(QUICK_FILTER_PANELS).map(([label, panel]) => [panel, label]),
)

// Price slider bounds. The API reports the real min/max of the category's listings,
// which collapses to a single point when they all cost the same (AED 1 – AED 1) and
// leaves the slider unusable. These floor the range at AED 1 – AED 10,000 while still
// widening to whatever the category actually holds, so Motors keeps its full span.
const PRICE_SLIDER_FLOOR = 1
const PRICE_SLIDER_MIN_CEILING = 10000

function normalizePriceRange({ minPrice, maxPrice } = {}) {
  const apiMax = Number(maxPrice)
  return {
    min: PRICE_SLIDER_FLOOR,
    max: Math.max(Number.isFinite(apiMax) ? apiMax : 0, PRICE_SLIDER_MIN_CEILING),
  }
}

function CategoryProductsPage() {
  const { categoryId, subcategoryId: routeSubcategoryId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { products, loading, hasMore, page } = useSelector((state) => state.products)
  const { rootCategories, rootLoading: categoriesLoading, rootError: categoriesError } = useSelector(
    (state) => state.categories
  )
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const shellLoaded = useSelector((state) => state.feed?.shellLoaded)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [subcategories, setSubcategories] = useState([])
  const didFetchRootsRef = useRef(false)
  const [priceRange, setPriceRange] = useState(normalizePriceRange())
  const [facetCities, setFacetCities] = useState([])

  // Location filter (emirates / cities table id)
  const [cityId, setCityId] = useState('')
  const [makeModel, setMakeModel] = useState('')
  const [priceRangeSelect, setPriceRangeSelect] = useState('')
  const [kms, setKms] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [panelType, setPanelType] = useState(null)
  const {
    open: rightPanelOpen,
    closing: rightPanelClosing,
    visible: rightPanelVisible,
    closePanel: closeRightPanel,
    openPanel: openRightPanelSlide,
  } = useFilterPanelSlide()
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
  // Free-form values of text/number/date filters, keyed by filter id.
  const [filterValues, setFilterValues] = useState({})
  // Full category hierarchy (root → leaf) behind this listing.
  const [categoryPath, setCategoryPath] = useState([])

  const filterChildCategoryId =
    selectedHierarchy.trim || selectedHierarchy.model || selectedHierarchy.brand || ''

  // The route id is the deepest category the user picked (the search page links
  // straight to the leaf), but listings store `product.category` as the ROOT of
  // the hierarchy. So queries, facets and the subcategory chips are scoped to
  // the root of `categoryPath`, while the deeper levels are matched through
  // `categoryPathIds` / brandId / modelId / trimId.
  const rootCategoryId = categoryPath[0] || categoryId
  // Stable identity: this feeds the product query's dependency list.
  const deepCategoryPathIds = useMemo(() => categoryPath.slice(1), [categoryPath])

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
  const priceMinMax = useMemo(() => {
    if (priceRangeSelect) {
      const [minP, maxP] = priceRangeSelect.split('-').map(Number)
      if (!isNaN(minP) && !isNaN(maxP)) return { min: minP, max: maxP }
    }
    return { min: priceRange.min, max: priceRange.max }
  }, [priceRangeSelect, priceRange])

  // Fixed 0 – 7 lakh km scale (shared with advance search) instead of the facet
  // maximum, so the slider does not rescale as inventory changes.
  const kmsBounds = KMS_FILTER_RANGE

  const kmsSel = useMemo(() => {
    if (!kms) return null
    const [lo, hi] = kms.split('-').map(Number)
    if (Number.isFinite(lo) && Number.isFinite(hi)) return { min: lo, max: hi }
    return null
  }, [kms])

  const kmsMin = kmsSel?.min ?? kmsBounds.min
  const kmsMax = kmsSel?.max ?? kmsBounds.max

  useEffect(() => {
    if (!isAuthenticated || shellLoaded) return
    dispatch(fetchFeedShell({ includeChats: true, includePriceRange: false }))
  }, [dispatch, isAuthenticated, shellLoaded])

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

  // Subcategory chips always list the root's children, so a listing opened on a
  // deep leaf still shows (and highlights) the level the user picked.
  useEffect(() => {
    if (!rootCategoryId) return
    let cancelled = false

    const run = async () => {
      try {
        const res = await categoryService.getCategoryChildren(rootCategoryId)
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
  }, [rootCategoryId])

  useEffect(() => {
    isFirstMakeModelRef.current = true
  }, [categoryId])

  const location = useLocation()

  // The URL is the single source of truth for the whole selection: every filter
  // change is written back to it (see patchUrl), and this effect reads it back.
  // That keeps a search built on /search intact, survives a refresh, and makes
  // the listing shareable.
  useEffect(() => {
    // Prefer subcategory from query string, then route param (if present).
    // This covers both navigation styles: /categories/:id/products?subcategoryId=...
    // and /categories/:id/subcategory/:subcategoryId -> routed with useParams.
    const q = new URLSearchParams(location.search || '')
    const { categoryPath: pathFromUrl, filterIds, filterValues: valuesFromUrl } =
      parseListingSearchParams(location.search, categoryId)
    const subFromQuery = q.get('subcategoryId') || ''
    const brandFromQuery = q.get('brandId') || ''
    const modelFromQuery = q.get('modelId') || ''
    const trimFromQuery = q.get('trimId') || ''
    const chosen = subFromQuery || routeSubcategoryId || pathFromUrl[1] || ''
    setSelectedHierarchy({
      subcategory: chosen,
      brand: brandFromQuery || pathFromUrl[2] || '',
      model: modelFromQuery || pathFromUrl[3] || '',
      trim: trimFromQuery || pathFromUrl[4] || '',
    })

    // Restore label-based filters if present (used for API filtering).
    setSelectedHierarchyLabels({
      brand: q.get('make') || '',
      model: q.get('model') || '',
      trim: q.get('trim') || '',
    })
    setCityId(q.get('cityId') || '')

    // Keep the previous array/object when nothing actually changed — these feed
    // the product query, and a fresh identity would trigger a duplicate fetch on
    // every unrelated URL patch (sort, price, …).
    setCategoryPath((prev) => (prev.join(',') === pathFromUrl.join(',') ? prev : pathFromUrl))
    setSelectedFilterIds((prev) =>
      serializeIdList(prev) === serializeIdList(filterIds) ? prev : filterIds,
    )
    setFilterValues((prev) =>
      serializeFilterValues(prev) === serializeFilterValues(valuesFromUrl) ? prev : valuesFromUrl,
    )
    setKeywords(q.get('q') || '')
    setCondition(q.get('condition') || '')
    setTransmission(q.get('transmission') || '')
    setFuelType(q.get('fuelType') || '')
    setBedrooms(q.get('bedrooms') || '')
    setSortBy(q.get('sortBy') || 'newest')
    const minP = q.get('minPrice')
    const maxP = q.get('maxPrice')
    setPriceRangeSelect(minP || maxP ? `${minP || 0}-${maxP || ''}` : '')
    // Mileage is URL-backed like price, so the Kilometres panel's selection
    // survives a refresh instead of silently resetting.
    const minK = q.get('minMileage')
    const maxK = q.get('maxMileage')
    setKms(minK || maxK ? `${minK || 0}-${maxK || ''}` : '')
  }, [categoryId, location.search, routeSubcategoryId])

  // Silent My Search upsert for listing views reached from /search (no UI change).
  const lastListingSaveRef = useRef('')
  useEffect(() => {
    if (!isAuthenticated || !categoryId) return
    const listingUrl = `${location.pathname}${location.search || ''}`
    if (!listingUrl || listingUrl === lastListingSaveRef.current) return

    const q = new URLSearchParams(location.search || '')
    const pathIds = categoryPath.length ? categoryPath : [categoryId]
    const pathNames = []
    if (selectedCategory?.name) pathNames.push(selectedCategory.name)
    const sub = (subcategories || []).find(
      (c) => String(c._id) === String(pathIds[1] || selectedHierarchy.subcategory),
    )
    if (sub?.name) pathNames.push(sub.name)
    if (!pathNames.length) pathNames.push(selectedCategory?.name || 'Search')

    const minPrice = q.get('minPrice') || ''
    const maxPrice = q.get('maxPrice') || ''
    const cityName = selectedCityName || q.get('location') || ''

    const timer = window.setTimeout(() => {
      persistSavedSearch(
        buildCategorySearchSavePayload({
          selectedPath: pathIds,
          categoryPathNames: pathNames,
          selectedFilterIds,
          filterValues,
          listingUrl,
          passthroughParams: {
            q: keywords || q.get('q') || '',
            location: cityName,
            sortBy,
            minPrice,
            maxPrice,
            cityId: cityId || '',
          },
        }),
      ).then((res) => {
        if (res) lastListingSaveRef.current = listingUrl
      })
    }, 600)

    return () => window.clearTimeout(timer)
  }, [
    isAuthenticated,
    categoryId,
    location.pathname,
    location.search,
    categoryPath,
    selectedCategory?.name,
    subcategories,
    selectedHierarchy.subcategory,
    selectedFilterIds,
    filterValues,
    keywords,
    sortBy,
    cityId,
    selectedCityName,
  ])

  useEffect(() => {
    setApiParentId('')
  }, [categoryId])

  // Read at call time rather than closed over, so debounced patches (keywords)
  // never write back a stale query string.
  const locationSearchRef = useRef(location.search)
  locationSearchRef.current = location.search

  /**
   * Write filter state back into the URL (replace, so filtering doesn't stack
   * history entries). Empty values are removed so the URL only carries what the
   * user actually selected.
   */
  const patchUrl = useCallback(
    (patch) => {
      const q = new URLSearchParams(locationSearchRef.current || '')
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) q.delete(key)
        else q.set(key, String(value))
      })
      navigate(
        {
          pathname: `/categories/${categoryId}/products`,
          search: q.toString() ? `?${q.toString()}` : '',
        },
        { replace: true },
      )
    },
    [navigate, categoryId],
  )

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

      // Changing the hierarchy changes which filters apply, so the previous
      // filter selection is dropped and the path is rewritten from the root.
      q.delete(FILTER_IDS_PARAM)
      q.delete(FILTER_VALUES_PARAM)
      const nextPath = [rootCategoryId, next, b, m, t].filter(Boolean)
      if (nextPath.length > 1) q.set(CATEGORY_PATH_PARAM, serializeIdList(nextPath))
      else q.delete(CATEGORY_PATH_PARAM)

      // The URL always points at the deepest selected category, matching how the
      // search page links into this page.
      navigate(
        {
          pathname: `/categories/${nextPath[nextPath.length - 1] || rootCategoryId}/products`,
          search: q.toString() ? `?${q.toString()}` : '',
        },
        { replace: true },
      )
    },
    [navigate, location.search, rootCategoryId],
  )

  // When user selects Bicycles, clear car-only filters so they don't affect results
  useEffect(() => {
    if (isBicycleSubcategory && (transmission || fuelType)) {
      setTransmission('')
      setFuelType('')
      patchUrl({ transmission: '', fuelType: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHierarchy.subcategory, isBicycleSubcategory, transmission, fuelType])

  useEffect(() => {
    const fetchPriceRange = async () => {
      try {
        const response = await productService.getPriceRange(rootCategoryId)
        setPriceRange(normalizePriceRange(response.data))
      } catch (e) {
        console.error('Error fetching price range:', e)
        setPriceRange(normalizePriceRange())
      }
    }
    fetchPriceRange()
  }, [rootCategoryId])

  useEffect(() => {
    if (!rootCategoryId) return
    let cancelled = false

    const run = async () => {
      try {
        const res = await productService.getFacets({
          categoryId: rootCategoryId,
          subcategoryId: subcategoryFilterId || undefined,
        })
        if (cancelled) return
        const data = res?.data || {}
        setFacetCities(Array.isArray(data.cities) ? data.cities : [])
      } catch (e) {
        if (cancelled) return
        console.error('Error fetching facets:', e)
        setFacetCities([])
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [rootCategoryId, subcategoryFilterId])

  const fetchWithFilters = useCallback(
    (pageNum = 1, append = false) => {
      if (!rootCategoryId) return
      if (!append) dispatch(clearProducts())

      const params = { page: pageNum, limit: 20, categoryId: rootCategoryId, sortBy }
      // Levels below the root (unlimited depth) are matched on product.categoryPath.
      if (deepCategoryPathIds.length) params.categoryPathIds = deepCategoryPathIds.join(',')
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
      rootCategoryId,
      deepCategoryPathIds,
      subcategoryFilterId,
      cityId,
      selectedCityName,
      makeModel,
      keywords,
      priceRangeSelect,
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
    if (!rootCategoryId) return
    fetchWithFilters(1, false)
  }, [
    rootCategoryId,
    subcategoryFilterId,
    cityId,
    priceRangeSelect,
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
    keywordsDebounceRef.current = setTimeout(() => {
      patchUrl({ q: keywords })
      fetchWithFilters(1, false)
    }, 400)
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

  const handleCloseRightPanel = useCallback(() => {
    closeRightPanel()
    setTimeout(() => setPanelType(null), 300)
  }, [closeRightPanel])

  const toggleRightPanel = useCallback(
    (type) => {
      const isDesktop =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
      if (!isDesktop) {
        if (type === 'advanced') setShowMobileFilters(true)
        return
      }

      if (panelType === type && rightPanelOpen) {
        handleCloseRightPanel()
        return
      }

      setPanelType(type)
      if (!rightPanelOpen) openRightPanelSlide()
    },
    [panelType, rightPanelOpen, handleCloseRightPanel, openRightPanelSlide],
  )

  const handleOpenFilters = useCallback(() => {
    toggleRightPanel('advanced')
  }, [toggleRightPanel])

  const handleQuickFilter = useCallback(
    (label) => {
      const type = QUICK_FILTER_PANELS[label]
      // Labels without a dedicated panel stay in the Advanced panel only.
      if (!type) return
      toggleRightPanel(type)
    },
    [toggleRightPanel],
  )

  const handleCityChange = useCallback(
    (nextCityId) => {
      const id = String(nextCityId || '').trim()
      setCityId(id)
      patchUrl({ cityId: id })
    },
    [patchUrl],
  )

  const handleFilterIdsChange = useCallback(
    (nextIds) => {
      setSelectedFilterIds(nextIds)
      patchUrl({ [FILTER_IDS_PARAM]: serializeIdList(nextIds) })
    },
    [patchUrl],
  )

  const handleFilterValuesChange = useCallback(
    (nextValues) => {
      setFilterValues(nextValues)
      patchUrl({ [FILTER_VALUES_PARAM]: serializeFilterValues(nextValues) })
    },
    [patchUrl],
  )

  const handleConditionChange = useCallback(
    (value) => {
      setCondition(value)
      patchUrl({ condition: value })
    },
    [patchUrl],
  )

  const handleTransmissionChange = useCallback(
    (value) => {
      setTransmission(value)
      patchUrl({ transmission: value })
    },
    [patchUrl],
  )

  const handleFuelTypeChange = useCallback(
    (value) => {
      setFuelType(value)
      patchUrl({ fuelType: value })
    },
    [patchUrl],
  )

  const handleBedroomsChange = useCallback(
    (value) => {
      setBedrooms(value)
      patchUrl({ bedrooms: value })
    },
    [patchUrl],
  )

  const handleSortChange = useCallback(
    (value) => {
      setSortBy(value)
      patchUrl({ sortBy: value === 'newest' ? '' : value })
    },
    [patchUrl],
  )

  // Keywords are debounced into the query below; the URL is updated with them
  // so a refresh keeps the typed text.
  const handleKeywordsChange = useCallback(
    (value) => {
      setKeywords(value)
    },
    [],
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

  const handlePriceApply = useCallback(
    (lo, hi) => {
      setPriceRangeSelect(`${lo}-${hi}`)
      patchUrl({ minPrice: lo, maxPrice: hi })
      fetchWithFilters(1, false)
    },
    [fetchWithFilters, patchUrl],
  )

  const handlePriceRangeChange = (lo, hi) => {
    setPriceRangeSelect(`${lo}-${hi}`)
  }

  const handleKmsRangeChange = (lo, hi) => {
    setKms(`${lo}-${hi}`)
  }

  // Applying from the dedicated panels commits immediately (and to the URL, so a
  // refresh keeps the filter) rather than waiting for the Advanced panel's Apply.
  const handleKmsApply = useCallback(
    (lo, hi) => {
      const isFullRange = lo <= kmsBounds.min && hi >= kmsBounds.max
      setKms(isFullRange ? '' : `${lo}-${hi}`)
      patchUrl({
        minMileage: isFullRange ? '' : lo,
        maxMileage: isFullRange ? '' : hi,
      })
      fetchWithFilters(1, false)
    },
    [fetchWithFilters, patchUrl, kmsBounds.min, kmsBounds.max],
  )

  const handleRegionApply = useCallback(() => {
    // Chips already patched the URL as they were toggled; this just refetches.
    fetchWithFilters(1, false)
    handleCloseRightPanel()
  }, [fetchWithFilters, handleCloseRightPanel])

  const handleCategorySelect = (id) => {
    const next = String(id || '').trim()
    if (!next || next === String(rootCategoryId)) return
    navigate(`/categories/${next}/products`)
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
    setFilterValues({})
    setApiParentId('')
    setBedrooms('')
    setPriceRangeSelect('')
    setCityId('')
    setKms('')
    setShowMobileFilters(false)
    // Drop every filter from the URL too, so a refresh doesn't bring them back.
    navigate({ pathname: `/categories/${rootCategoryId}/products`, search: '' }, { replace: true })
    fetchWithFilters(1, false)
  }

  const applyAdvancedFilters = () => {
    setShowMobileFilters(false)
    // Persist the values that are only tracked locally while the user drags /
    // types, so Apply makes the whole panel state survive a refresh.
    const [minP, maxP] = priceRangeSelect ? priceRangeSelect.split('-') : ['', '']
    patchUrl({ minPrice: minP, maxPrice: maxP, q: keywords })
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

  const quickFilterLabels = isVehicleCategory
    ? ['Region', 'Price', 'Kilometres']
    : ['Region', 'Price']

  const gridColumns = rightPanelVisible ? 2 : 3

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
      rootCategories,
      activeCategoryId: rootCategoryId,
      subcategories,
      subcategoryId: subcategoryFilterId,
      makeModel,
      trim: selectedHierarchy.trim,
      cityId,
      cities,
      citiesLoading: emiratesLoading,
      citiesError: emiratesError,
      priceRange,
      priceMin: priceMinMax.min,
      priceMax: priceMinMax.max,
      kmsRange: kmsBounds,
      kmsMin,
      kmsMax,
      condition,
      transmission,
      fuelType,
      keywords,
      bedrooms,
      categoryId: rootCategoryId,
      subcategoryFilterId,
      filterChildCategoryId,
      categoryPath,
      selectedFilterIds,
      filterValues,
    }),
    [
      isVehicleCategory,
      isPropertyCategory,
      isClassifiedsCategory,
      isBicycleSubcategory,
      rootCategories,
      rootCategoryId,
      subcategories,
      subcategoryFilterId,
      makeModel,
      selectedHierarchy.trim,
      cityId,
      cities,
      emiratesLoading,
      emiratesError,
      priceRange,
      priceMinMax,
      kmsBounds,
      kmsMin,
      kmsMax,
      condition,
      transmission,
      fuelType,
      keywords,
      bedrooms,
      filterChildCategoryId,
      categoryPath,
      selectedFilterIds,
      filterValues,
    ],
  )

  const filterPanelHandlers = {
    onCityChange: handleCityChange,
    onCategorySelect: handleCategorySelect,
    onSubcategoryChange: handleSubcategoryChange,
    onMakeModelChange: setMakeModel,
    onTrimChange: handleTrimChange,
    onPriceRangeChange: handlePriceRangeChange,
    onKmsRangeChange: handleKmsRangeChange,
    onConditionChange: handleConditionChange,
    onTransmissionChange: handleTransmissionChange,
    onFuelTypeChange: handleFuelTypeChange,
    onKeywordsChange: handleKeywordsChange,
    onBedroomsChange: handleBedroomsChange,
    onFilterIdsChange: handleFilterIdsChange,
    onFilterValuesChange: handleFilterValuesChange,
    onApply: applyAdvancedFilters,
    onReset: clearAdvancedFilters,
  }

  const filterPanel = rightPanelVisible ? (
    panelType === 'price' ? (
      <PriceFilterPanel
        className="h-full"
        showClose
        closing={rightPanelClosing}
        onClose={handleCloseRightPanel}
        min={priceRange.min}
        max={priceRange.max}
        valueMin={priceMinMax.min}
        valueMax={priceMinMax.max}
        onApply={handlePriceApply}
      />
    ) : panelType === 'region' ? (
      <RegionFilterPanel
        className="h-full"
        showClose
        closing={rightPanelClosing}
        onClose={handleCloseRightPanel}
        categoryPath={categoryPath.length ? categoryPath : [categoryId]}
        selectedFilterIds={selectedFilterIds}
        filterValues={filterValues}
        onFilterIdsChange={handleFilterIdsChange}
        onFilterValuesChange={handleFilterValuesChange}
        onApply={handleRegionApply}
      />
    ) : panelType === 'kilometres' ? (
      <KilometresFilterPanel
        className="h-full"
        showClose
        closing={rightPanelClosing}
        onClose={handleCloseRightPanel}
        min={kmsBounds.min}
        max={kmsBounds.max}
        valueMin={kmsMin}
        valueMax={kmsMax}
        onApply={handleKmsApply}
      />
    ) : (
      <AdvancedFilterPanel
        className="h-full"
        showClose
        closing={rightPanelClosing}
        onClose={handleCloseRightPanel}
        {...filterPanelProps}
        {...filterPanelHandlers}
      />
    )
  ) : null

  return (
    <CategoryBrowseLayout
      activeCategoryId={rootCategoryId}
      variant="listing"
      layoutPreset="marketplace"
      filterPanel={filterPanel}
      filterPanelOpen={rightPanelVisible}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FC]">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
                {categoryForUi.name}
              </h1>
              <p className="mt-1 text-sm text-[#64748B]">{listingCountLabel}</p>
            </div>
            <ListingToolbar
              sortBy={sortBy}
              onSortChange={handleSortChange}
              onOpenFilters={handleOpenFilters}
              onQuickFilterClick={handleQuickFilter}
              quickFilters={quickFilterLabels}
              filtersOpen={panelType === 'advanced' && rightPanelOpen}
              activeQuickFilter={rightPanelOpen ? QUICK_FILTER_LABEL_BY_PANEL[panelType] || null : null}
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
          <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-[420px] overflow-hidden shadow-2xl lg:hidden">
            <AdvancedFilterPanel
              className="h-full"
              showClose
              onClose={() => setShowMobileFilters(false)}
              {...filterPanelProps}
              {...filterPanelHandlers}
            />
          </div>
        </>
      ) : null}
    </CategoryBrowseLayout>
  )
}

export default CategoryProductsPage
