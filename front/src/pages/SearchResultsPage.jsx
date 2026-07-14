import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '@shared/store/slices/productSlice'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { fetchFeedShell } from '@shared/store/slices/feedSlice'
import { selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { categoryService, productService } from '@shared/services/api'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import ListingToolbar from '../components/Listing/ListingToolbar'
import ProductGrid from '../components/Listing/ProductGrid'
import SearchFilterPanel from '../components/Listing/SearchFilterPanel'
import PriceFilterPanel from '../components/Listing/PriceFilterPanel'
import useFilterPanelSlide from '../hooks/useFilterPanelSlide'

function resolveCategoryFromQuery(query, rootCategories) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || !Array.isArray(rootCategories) || !rootCategories.length) return null
  const exact = rootCategories.find((c) => String(c.name || '').trim().toLowerCase() === q)
  if (exact) return exact
  return (
    rootCategories.find((c) => {
      const name = String(c.name || '').trim().toLowerCase()
      return name.includes(q) || q.includes(name)
    }) || null
  )
}

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { products, loading, hasMore, page } = useSelector((state) => state.products)
  const { rootCategories, rootLoading: categoriesLoading } = useSelector((state) => state.categories)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const shellLoaded = useSelector((state) => state.feed?.shellLoaded)

  const searchQuery = (searchParams.get('q') || '').trim()
  const categoryParam = searchParams.get('category') || ''
  const matchedCategory = useMemo(
    () => resolveCategoryFromQuery(searchQuery, rootCategories),
    [searchQuery, rootCategories],
  )
  const categoryId = categoryParam || matchedCategory?._id || ''
  const isExactCategoryQuery =
    matchedCategory &&
    String(matchedCategory.name || '').trim().toLowerCase() === searchQuery.toLowerCase()

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [city, setCity] = useState(searchParams.get('location') || '')
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get('subcategoryId') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [keywords, setKeywords] = useState('')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'newest')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [panelType, setPanelType] = useState(null)
  const {
    open: rightPanelOpen,
    closing: rightPanelClosing,
    visible: rightPanelVisible,
    closePanel: closeRightPanel,
    openPanel: openRightPanelSlide,
  } = useFilterPanelSlide()
  const didFetchRootsRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || shellLoaded) return
    dispatch(fetchFeedShell({ includeChats: true, includePriceRange: false }))
  }, [dispatch, isAuthenticated, shellLoaded])

  useEffect(() => {
    if (didFetchRootsRef.current) return
    if ((!rootCategories || rootCategories.length === 0) && !categoriesLoading) {
      didFetchRootsRef.current = true
      dispatch(fetchRootCategories())
    }
  }, [dispatch, rootCategories, categoriesLoading])

  useEffect(() => {
    if (!categoryId) {
      setSelectedCategory(matchedCategory || null)
      return
    }
    let cancelled = false
    categoryService
      .getCategoryById(categoryId)
      .then((res) => {
        if (!cancelled) setSelectedCategory(res.data)
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedCategory(
            matchedCategory || { _id: categoryId, name: searchQuery || 'Search', icon: null, emoji: '🔍' },
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, matchedCategory, searchQuery])

  useEffect(() => {
    if (!categoryId) return
    productService
      .getPriceRange(categoryId)
      .then((response) => {
        const { minPrice: minP, maxPrice: maxP } = response.data || {}
        setPriceRange({ min: minP ?? 0, max: maxP ?? 100000 })
      })
      .catch(() => {})
  }, [categoryId])

  const syncUrl = useCallback(
    (patch = {}) => {
      const q = new URLSearchParams(searchParams.toString())
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) q.delete(key)
        else q.set(key, String(value))
      })
      setSearchParams(q, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const fetchWithFilters = useCallback(
    (pageNum = 1, append = false) => {
      if (!categoryId && !searchQuery) return
      if (!append) dispatch(clearProducts())

      const params = { page: pageNum, limit: 20, sortBy }
      if (categoryId) params.categoryId = categoryId
      if (subcategoryId) params.subcategoryId = subcategoryId
      if (city) params.location = city
      if (minPrice) params.minPrice = Number(minPrice)
      if (maxPrice) params.maxPrice = Number(maxPrice)

      const textParts = []
      if (keywords.trim()) textParts.push(keywords.trim())
      if (searchQuery && !isExactCategoryQuery) textParts.push(searchQuery)
      if (textParts.length) params.search = textParts.join(' ').trim()

      dispatch(fetchProducts(params))
    },
    [
      categoryId,
      searchQuery,
      isExactCategoryQuery,
      subcategoryId,
      city,
      minPrice,
      maxPrice,
      keywords,
      sortBy,
      dispatch,
    ],
  )

  useEffect(() => {
    fetchWithFilters(1, false)
  }, [fetchWithFilters])

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

  const handleOpenFilters = () => {
    toggleRightPanel('advanced')
  }

  const handleQuickFilter = useCallback(
    (label) => {
      if (label === 'Price') toggleRightPanel('price')
    },
    [toggleRightPanel],
  )

  const handleCityChange = (nextCity) => {
    setCity(nextCity)
    syncUrl({ location: nextCity })
  }

  const handleSubcategoryChange = (nextId) => {
    setSubcategoryId(nextId)
    syncUrl({ subcategoryId: nextId })
  }

  const handlePriceChange = useCallback(
    (lo, hi) => {
      setMinPrice(String(lo))
      setMaxPrice(String(hi))
      syncUrl({ minPrice: lo, maxPrice: hi })
    },
    [syncUrl],
  )

  const handlePriceApply = useCallback(
    (lo, hi) => {
      handlePriceChange(lo, hi)
      fetchWithFilters(1, false)
    },
    [handlePriceChange, fetchWithFilters],
  )

  const priceMinMax = useMemo(() => {
    const lo = minPrice ? Number(minPrice) : priceRange.min
    const hi = maxPrice ? Number(maxPrice) : priceRange.max
    return {
      min: Number.isFinite(lo) ? lo : priceRange.min,
      max: Number.isFinite(hi) ? hi : priceRange.max,
    }
  }, [minPrice, maxPrice, priceRange])

  const clearFilters = () => {
    setCity('')
    setSubcategoryId('')
    setMinPrice('')
    setMaxPrice('')
    setKeywords('')
    setShowMobileFilters(false)
    const q = new URLSearchParams(searchParams.toString())
    ;['location', 'subcategoryId', 'minPrice', 'maxPrice'].forEach((key) => q.delete(key))
    setSearchParams(q, { replace: true })
    fetchWithFilters(1, false)
  }

  const applyFilters = () => {
    setShowMobileFilters(false)
    fetchWithFilters(1, false)
  }

  const categoryForUi =
    selectedCategory ||
    (matchedCategory
      ? matchedCategory
      : {
          _id: 'search',
          name: searchQuery ? searchQuery : 'Search',
          icon: null,
          emoji: '🔍',
        })

  const listingCountLabel =
    loading && products.length === 0
      ? 'Loading listings…'
      : `${products.length} result${products.length !== 1 ? 's' : ''} found`

  const showAdvancedFilters = Boolean(categoryId)
  const quickFilterLabels = showAdvancedFilters ? ['Region', 'Price'] : []
  const gridColumns = rightPanelVisible && showAdvancedFilters ? 2 : 3

  const filterPanelProps = {
    categoryId,
    city,
    onCityChange: handleCityChange,
    minPrice,
    maxPrice,
    priceMin: priceRange.min,
    priceMax: priceRange.max,
    onPriceChange: handlePriceChange,
    keywords,
    onKeywordsChange: setKeywords,
    subcategoryId,
    onSubcategoryChange: handleSubcategoryChange,
    onApply: applyFilters,
    onReset: clearFilters,
  }

  const filterPanel =
    showAdvancedFilters && rightPanelVisible ? (
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
      ) : (
        <SearchFilterPanel
          className="h-full"
          showClose
          closing={rightPanelClosing}
          onClose={handleCloseRightPanel}
          {...filterPanelProps}
        />
      )
    ) : null

  return (
    <CategoryBrowseLayout
      activeCategoryId={categoryId || null}
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
              onSortChange={(value) => {
                setSortBy(value)
                syncUrl({ sortBy: value })
              }}
              onOpenFilters={handleOpenFilters}
              onQuickFilterClick={handleQuickFilter}
              quickFilters={quickFilterLabels}
              filtersOpen={panelType === 'advanced' && rightPanelOpen && showAdvancedFilters}
              activeQuickFilter={panelType === 'price' && rightPanelOpen ? 'Price' : null}
            />
          </div>

          {!searchQuery && !categoryId ? (
            <div className="rounded-2xl border border-[#E8EBF2] bg-white p-12 text-center shadow-sm">
              <h3 className="mb-2 text-xl font-bold text-[#0F172A]">Search the marketplace</h3>
              <p className="text-[#64748B]">Use the search bar above to find listings, categories, and more.</p>
            </div>
          ) : (
            <>
              <ProductGrid
                products={products}
                loading={loading}
                columns={gridColumns}
                emptyState={
                  <div className="rounded-2xl border border-[#E8EBF2] bg-white p-12 text-center shadow-sm">
                    <h3 className="mb-2 text-xl font-bold text-[#0F172A]">No listings found</h3>
                    <p className="text-[#64748B]">
                      {searchQuery
                        ? `No results for "${searchQuery}". Try adjusting filters or another keyword.`
                        : 'Try adjusting filters or choose another category.'}
                    </p>
                  </div>
                }
              />

              {hasMore && products.length > 0 ? (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showMobileFilters && showAdvancedFilters ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-[#0F172A]/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setShowMobileFilters(false)}
            aria-label="Close filters overlay"
          />
          <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-[420px] shadow-2xl lg:hidden">
            <SearchFilterPanel showClose onClose={() => setShowMobileFilters(false)} {...filterPanelProps} />
          </div>
        </>
      ) : null}
    </CategoryBrowseLayout>
  )
}

export default SearchResultsPage
