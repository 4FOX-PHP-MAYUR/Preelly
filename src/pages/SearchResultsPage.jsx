import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '../store/slices/productSlice'
import { fetchCategories } from '../store/slices/categorySlice'
import { productService } from '../services/api'
import { getMediaUrl } from '../utils/helpers'
import { Search as SearchIcon, Filter, X, ChevronDown, ChevronUp, Grid, List, MapPin, Calendar } from 'lucide-react'

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dispatch = useDispatch()
  const { products, loading, hasMore, page } = useSelector((state) => state.products)
  const { categories } = useSelector((state) => state.categories)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    categories: [], // Changed to array for multiple selection
    locations: [], // Changed to array for multiple selection
    minPrice: '',
    maxPrice: '',
    conditions: [], // Changed to array for multiple selection
    sortBy: 'newest',
  })
  
  // Price range slider states
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [sliderValues, setSliderValues] = useState({ min: 0, max: 100000 })
  const [expandedSections, setExpandedSections] = useState({
    category: true,
    location: true,
    price: true,
    condition: true,
  })

  // Get unique locations from products
  const uniqueLocations = [...new Set(products.map(p => p.location).filter(Boolean))].sort()

  // Fetch price range from database
  useEffect(() => {
    const fetchPriceRange = async () => {
      try {
        const categoryIdFromQuery = searchParams.get('category') || ''
        const categoryIdFromFilters = Array.isArray(filters.categories) ? filters.categories[0] : ''
        const categoryId = categoryIdFromQuery || categoryIdFromFilters
        if (!categoryId) return
        const response = await productService.getPriceRange(categoryId)
        const { minPrice, maxPrice } = response.data
        setPriceRange({ min: minPrice, max: maxPrice })
        if (!filters.minPrice && !filters.maxPrice) {
          setSliderValues({ min: minPrice, max: maxPrice })
        }
      } catch (error) {
        console.error('Error fetching price range:', error)
      }
    }
    fetchPriceRange()
  }, [filters.categories, searchParams])

  useEffect(() => {
    // Avoid duplicate category fetches on initial load / dev StrictMode.
    if (!categories || categories.length === 0) dispatch(fetchCategories())
  }, [dispatch, categories])

  useEffect(() => {
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category') || ''
    const location = searchParams.get('location') || ''
    const minPrice = searchParams.get('minPrice') || ''
    const maxPrice = searchParams.get('maxPrice') || ''
    const condition = searchParams.get('condition') || ''
    const sortBy = searchParams.get('sortBy') || 'newest'
    
    setSearchQuery(query)
    setFilters({
      categories: category ? [category] : [],
      locations: location ? [location] : [],
      minPrice,
      maxPrice,
      conditions: condition ? [condition] : [],
      sortBy,
    })
    
    if (minPrice || maxPrice) {
      setSliderValues({
        min: minPrice ? Math.max(priceRange.min, Number(minPrice)) : priceRange.min,
        max: maxPrice ? Math.min(priceRange.max, Number(maxPrice)) : priceRange.max,
      })
    } else {
      setSliderValues({ min: priceRange.min, max: priceRange.max })
    }
    
    if (query || category || location || minPrice || maxPrice) {
      dispatch(clearProducts())
      const params = { page: 1, limit: 20 }
      if (query && query.trim() !== '') {
        params.search = query.trim()
      }
      if (category && category.trim() !== '') {
        params.categoryId = category
      }
      if (location && location.trim() !== '') {
        params.location = location.trim()
      }
      if (minPrice && minPrice.toString().trim() !== '') {
        const min = Number(minPrice)
        if (!isNaN(min) && min >= 0) {
          params.minPrice = min
        }
      }
      if (maxPrice && maxPrice.toString().trim() !== '') {
        const max = Number(maxPrice)
        if (!isNaN(max) && max > 0 && max <= priceRange.max) {
          params.maxPrice = max
        }
      }
      
      dispatch(fetchProducts(params))
    }
  }, [searchParams, dispatch])

  const loadMore = () => {
    if (hasMore && !loading) {
      const params = { page: page + 1, limit: 20 }
      if (searchQuery && searchQuery.trim() !== '') {
        params.search = searchQuery.trim()
      }
      if (filters.categories.length > 0) {
        params.categoryId = filters.categories[0] // Use first selected category
      }
      if (filters.locations.length > 0) {
        params.location = filters.locations[0] // Use first selected location
      }
      if (filters.minPrice && filters.minPrice.toString().trim() !== '') {
        const min = Number(filters.minPrice)
        if (!isNaN(min) && min > 0) {
          params.minPrice = min
        }
      }
      if (filters.maxPrice && filters.maxPrice.toString().trim() !== '') {
        const max = Number(filters.maxPrice)
        if (!isNaN(max) && max > 0) {
          params.maxPrice = max
        }
      }
      
      dispatch(fetchProducts(params))
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    
    const newParams = new URLSearchParams(searchParams)
    if (key === 'categories' && value.length > 0) {
      newParams.set('category', value[0])
    } else if (key === 'locations' && value.length > 0) {
      newParams.set('location', value[0])
    } else if (key === 'conditions' && value.length > 0) {
      newParams.set('condition', value[0])
    } else if (value && value !== '' && value !== '0' && !Array.isArray(value)) {
      newParams.set(key, value)
    } else {
      if (key === 'categories') newParams.delete('category')
      else if (key === 'locations') newParams.delete('location')
      else if (key === 'conditions') newParams.delete('condition')
      else newParams.delete(key)
    }
    setSearchParams(newParams)
    
    dispatch(clearProducts())
    const params = { page: 1, limit: 20 }
    if (searchQuery && searchQuery.trim() !== '') {
      params.search = searchQuery.trim()
    }
    if (newFilters.categories.length > 0) {
      params.categoryId = newFilters.categories[0]
    }
    if (newFilters.locations.length > 0) {
      params.location = newFilters.locations[0]
    }
    if (newFilters.minPrice && newFilters.minPrice.toString().trim() !== '') {
      const min = Number(newFilters.minPrice)
      if (!isNaN(min) && min >= 0) {
        params.minPrice = min
      }
    }
    if (newFilters.maxPrice && newFilters.maxPrice.toString().trim() !== '') {
      const max = Number(newFilters.maxPrice)
      if (!isNaN(max) && max > 0 && max <= priceRange.max) {
        params.maxPrice = max
      }
    }
    
    dispatch(fetchProducts(params))
  }

  const toggleCategoryFilter = (categoryId) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [categoryId] // Only allow one category at a time (like Dubizzle)
    handleFilterChange('categories', newCategories)
  }

  const toggleLocationFilter = (location) => {
    const newLocations = filters.locations.includes(location)
      ? filters.locations.filter(loc => loc !== location)
      : [location] // Only allow one location at a time
    handleFilterChange('locations', newLocations)
  }

  const toggleConditionFilter = (condition) => {
    const newConditions = filters.conditions.includes(condition)
      ? filters.conditions.filter(cond => cond !== condition)
      : [condition] // Only allow one condition at a time
    handleFilterChange('conditions', newConditions)
  }

  const removeFilter = (key) => {
    if (key === 'category') handleFilterChange('categories', [])
    else if (key === 'location') handleFilterChange('locations', [])
    else if (key === 'condition') handleFilterChange('conditions', [])
    else handleFilterChange(key, '')
  }

  const clearFilters = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('category')
    newParams.delete('location')
    newParams.delete('minPrice')
    newParams.delete('maxPrice')
    newParams.delete('condition')
    newParams.delete('sortBy')
    setSearchParams(newParams)
    setFilters({
      categories: [],
      locations: [],
      minPrice: '',
      maxPrice: '',
      conditions: [],
      sortBy: 'newest',
    })
    setSliderValues({ min: priceRange.min, max: priceRange.max })
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const hasActiveFilters = filters.categories.length > 0 || filters.locations.length > 0 || filters.minPrice || filters.maxPrice || filters.conditions.length > 0

  // Filter and sort products
  let filteredProducts = [...products]
  
  if (filters.conditions.length > 0) {
    filteredProducts = filteredProducts.filter(p => filters.conditions.includes(p.condition))
  }
  
  const sortedProducts = filteredProducts.sort((a, b) => {
    switch (filters.sortBy) {
      case 'price-low':
        return a.price - b.price
      case 'price-high':
        return b.price - a.price
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt)
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt)
      default:
        return 0
    }
  })

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="mb-4 text-sm text-gray-600">
          <Link to="/" className="hover:text-primary-600">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Search Results</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {searchQuery ? `"${searchQuery}"` : 'All Products'}
          </h1>
              <p className="text-sm text-gray-600">
            {sortedProducts.length > 0 
                  ? `${sortedProducts.length} result${sortedProducts.length !== 1 ? 's' : ''} found`
                  : 'No results found'
            }
          </p>
        </div>
        
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>

              {/* Mobile Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                    {filters.categories.length + filters.locations.length + filters.conditions.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Active filters:</span>
                {filters.categories.map(catId => {
                  const cat = categories.find(c => c._id === catId)
                  return cat ? (
                    <span key={catId} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                      {cat.name}
                      <button onClick={() => removeFilter('category')} className="ml-1 hover:text-primary-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null
                })}
                {filters.locations.map(loc => (
                  <span key={loc} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                    {loc}
                    <button onClick={() => removeFilter('location')} className="ml-1 hover:text-primary-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {(filters.minPrice || filters.maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                    {formatPrice(Number(filters.minPrice || priceRange.min))} - {formatPrice(Number(filters.maxPrice || priceRange.max))}
                    <button onClick={() => { removeFilter('minPrice'); removeFilter('maxPrice') }} className="ml-1 hover:text-primary-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.conditions.map(cond => (
                  <span key={cond} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                    {cond}
                    <button onClick={() => removeFilter('condition')} className="ml-1 hover:text-primary-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Filter Overlay */}
        {showFilters && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setShowFilters(false)}
          ></div>
        )}
        
        {/* Filters Sidebar */}
        <div className={`${
          showFilters
              ? 'fixed left-0 top-0 h-full w-full max-w-xs sm:w-80 bg-white z-50 shadow-2xl overflow-y-auto lg:relative lg:z-auto lg:h-auto lg:w-64 lg:shadow-none'
            : 'hidden lg:block'
          } flex-shrink-0`}>
            <div className="bg-white rounded-lg shadow-sm p-4 lg:sticky lg:top-24">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                <div className="flex items-center gap-3">
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="lg:hidden text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div className="mb-4 border-b pb-4">
                <button
                  onClick={() => toggleSection('category')}
                  className="w-full flex items-center justify-between text-left font-medium text-gray-900 mb-3"
                >
                  <span>Category</span>
                  {expandedSections.category ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {expandedSections.category && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {categories.map((cat) => {
                      const isSelected = filters.categories.includes(cat._id)
                      return (
                        <label
                          key={cat._id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategoryFilter(cat._id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <span>{cat.emoji}</span>
                            <span>{cat.name}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Location Filter */}
              <div className="mb-4 border-b pb-4">
                <button
                  onClick={() => toggleSection('location')}
                  className="w-full flex items-center justify-between text-left font-medium text-gray-900 mb-3"
                >
                  <span>Location</span>
                  {expandedSections.location ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {expandedSections.location && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {uniqueLocations.length > 0 ? (
                      uniqueLocations.map((loc) => {
                        const isSelected = filters.locations.includes(loc)
                        return (
                          <label
                            key={loc}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLocationFilter(loc)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span>{loc}</span>
                            </span>
                          </label>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-500 py-2">No locations available</p>
                    )}
                  </div>
                )}
              </div>

              {/* Price Range Filter */}
              <div className="mb-4 border-b pb-4">
                <button
                  onClick={() => toggleSection('price')}
                  className="w-full flex items-center justify-between text-left font-medium text-gray-900 mb-3"
                >
                  <span>Price Range</span>
                  {expandedSections.price ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {expandedSections.price && (
                  <div className="space-y-4">
                    {/* Price Input Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Min Price</label>
                        <input
                          type="number"
                          value={sliderValues.min}
                          onChange={(e) => {
                            const newMin = Math.max(priceRange.min, Math.min(Number(e.target.value) || priceRange.min, sliderValues.max))
                            setSliderValues({ ...sliderValues, min: newMin })
                            handleFilterChange('minPrice', newMin.toString())
                          }}
                          min={priceRange.min}
                          max={sliderValues.max}
                          placeholder="Min"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Max Price</label>
                        <input
                          type="number"
                          value={sliderValues.max}
                          onChange={(e) => {
                            const newMax = Math.min(priceRange.max, Math.max(Number(e.target.value) || priceRange.max, sliderValues.min))
                            setSliderValues({ ...sliderValues, max: newMax })
                            handleFilterChange('maxPrice', newMax.toString())
                          }}
                          min={sliderValues.min}
                          max={priceRange.max}
                          placeholder="Max"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                        />
                      </div>
                    </div>
                    
                    {/* Range Slider */}
                    <div className="relative pt-4">
                      <div className="flex items-center justify-between mb-3 text-xs text-gray-600 font-medium">
                        <span>{formatPrice(sliderValues.min)}</span>
                        <span>{formatPrice(sliderValues.max)}</span>
                      </div>
                      
                      <div className="relative h-8 py-2">
                        {/* Track Background */}
                        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                        
                        {/* Active Range */}
                        <div
                          className="absolute top-1/2 h-1.5 bg-primary-600 rounded-full transform -translate-y-1/2 pointer-events-none"
                          style={{
                            left: `${((sliderValues.min - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                            width: `${((sliderValues.max - sliderValues.min) / (priceRange.max - priceRange.min)) * 100}%`,
                          }}
                        ></div>
                        
                        {/* Min Slider */}
                        <input
                          type="range"
                          min={priceRange.min}
                          max={sliderValues.max}
                          value={sliderValues.min}
                          onChange={(e) => {
                            const newMin = Math.min(Number(e.target.value), sliderValues.max - 1)
                            setSliderValues({ ...sliderValues, min: newMin })
                            handleFilterChange('minPrice', newMin.toString())
                          }}
                          className="range-input range-input-min absolute top-0 left-0 w-full h-full"
                        />
                        
                        {/* Max Slider */}
                        <input
                          type="range"
                          min={sliderValues.min}
                          max={priceRange.max}
                          value={sliderValues.max}
                          onChange={(e) => {
                            const newMax = Math.max(Number(e.target.value), sliderValues.min + 1)
                            setSliderValues({ ...sliderValues, max: newMax })
                            handleFilterChange('maxPrice', newMax.toString())
                          }}
                          className="range-input range-input-max absolute top-0 left-0 w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Condition Filter */}
              <div className="mb-4">
                <button
                  onClick={() => toggleSection('condition')}
                  className="w-full flex items-center justify-between text-left font-medium text-gray-900 mb-3"
                >
                  <span>Condition</span>
                  {expandedSections.condition ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {expandedSections.condition && (
                  <div className="space-y-2">
                    {['New', 'Like New', 'Good', 'Fair', 'Poor'].map((condition) => {
                      const isSelected = filters.conditions.includes(condition)
                      return (
                        <label
                          key={condition}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleConditionFilter(condition)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">{condition}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Results Section */}
          <div className="flex-1">
      {loading && products.length === 0 ? (
              <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : sortedProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <SearchIcon className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No products found</h3>
                <p className="text-gray-600 mb-6">
              {hasActiveFilters
                    ? "Try adjusting your filters or search terms."
                : searchQuery 
                    ? "Try different keywords or browse categories."
                    : 'Enter a search term to find products'
              }
            </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
        </div>
      ) : (
        <>
                {/* Grid View */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedProducts.map((product) => (
                <Link
                  key={product._id}
                  to={`/products/${product._id}`}
                        className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative h-48 bg-gray-200">
                    {product.video ? (
                      <video
                        src={getMediaUrl(product.video)}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img
                        src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3rem] text-sm">
                      {product.title}
                    </h3>
                    <p className="text-primary-600 font-bold text-lg mb-2">
                      {formatPrice(product.price)}
                    </p>
                          <div className="flex items-center text-xs text-gray-600 gap-2">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{product.location}</span>
                          </div>
                          {product.createdAt && (
                            <div className="flex items-center text-xs text-gray-500 mt-1 gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-3">
                    {sortedProducts.map((product) => (
                      <Link
                        key={product._id}
                        to={`/products/${product._id}`}
                        className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex"
                      >
                        <div className="relative w-24 h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 bg-gray-200 flex-shrink-0">
                          {product.video ? (
                            <video
                              src={getMediaUrl(product.video)}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              autoPlay
                              playsInline
                            />
                          ) : (
                            <img
                              src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                              alt={product.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-3 sm:p-4 flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base md:text-lg line-clamp-2">
                            {product.title}
                          </h3>
                          <p className="text-primary-600 font-bold text-base sm:text-lg md:text-xl mb-1 sm:mb-3">
                            {formatPrice(product.price)}
                          </p>
                          <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-600 gap-2 sm:gap-4">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-none">{product.location}</span>
                            </div>
                            {product.createdAt && (
                              <div className="hidden sm:flex items-center gap-1">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {product.views > 0 && (
                              <span className="hidden md:inline">{product.views} views</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

          {/* Load More */}
          {hasMore && (
                  <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                      className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchResultsPage
