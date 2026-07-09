import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { productService } from '../../services/api'

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (
    {
      categoryId,
      subcategoryId,
      childCategoryId,
      page = 1,
      limit = 10,
      userId,
      search,
      location,
      cityId,
      minPrice,
      maxPrice,
      year,
      minMileage,
      maxMileage,
      make,
      model,
      trim,
      brandId,
      modelId,
      trimId,
      condition,
      transmission,
      fuelType,
      sortBy,
    },
    { rejectWithValue }
  ) => {
    try {
      const params = { page, limit }
      if (categoryId) params.categoryId = categoryId
      if (subcategoryId) {
        params.subcategoryId = subcategoryId
        params.subcategory_id = subcategoryId
      }
      if (childCategoryId) {
        params.childCategoryId = childCategoryId
        params.child_category_id = childCategoryId
      }
      if (userId) params.userId = userId
      if (search) params.search = search
      if (location) params.location = location
      if (cityId) params.cityId = cityId
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.minPrice = minPrice
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.maxPrice = maxPrice
      if (year !== undefined && year !== null && year !== '') params.year = year
      if (minMileage !== undefined && minMileage !== null && minMileage !== '') params.minMileage = minMileage
      if (maxMileage !== undefined && maxMileage !== null && maxMileage !== '') params.maxMileage = maxMileage
      if (make) params.make = make
      if (model) params.model = model
      if (trim) params.trim = trim
      if (brandId) params.brandId = brandId
      if (modelId) params.modelId = modelId
      if (trimId) params.trimId = trimId
      if (condition) params.condition = condition
      if (transmission) params.transmission = transmission
      if (fuelType) params.fuelType = fuelType
      if (sortBy) params.sortBy = sortBy
      const response = await productService.getProducts(params)
      return response.data
    } catch (error) {
      console.error('❌ Frontend API error:', error)
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch products')
    }
  }
)

export const fetchProductsReelsFeed = createAsyncThunk(
  'products/fetchProductsReelsFeed',
  async ({ categoryId, subcategoryId, page = 1, limit = 10, search, location, minPrice, maxPrice, excludeUserId, excludeIds }, { rejectWithValue }) => {
    try {
      const params = { page, limit }
      if (categoryId) {
        params.categoryId = categoryId
      }
      if (subcategoryId) {
        params.subcategoryId = subcategoryId
      }
      if (search) {
        params.search = search
      }
      if (location) {
        params.location = location
      }
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
        params.minPrice = minPrice
      }
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
        params.maxPrice = maxPrice
      }
      if (excludeUserId) {
        params.excludeUserId = excludeUserId
      }
      // Exclude already-seen IDs for random pagination (no consecutive duplicates)
      if (excludeIds && (Array.isArray(excludeIds) ? excludeIds.length > 0 : excludeIds)) {
        params.excludeIds = Array.isArray(excludeIds) ? excludeIds.join(',') : String(excludeIds)
      }
      const response = await productService.getProductsReelsFeed(params)
      const data = response?.data
      if (data && Array.isArray(data.products)) {
        return {
          products: data.products,
          page: typeof data.page === 'number' ? data.page : 1,
          limit: typeof data.limit === 'number' ? data.limit : 10,
          total: typeof data.total === 'number' ? data.total : 0,
          hasMore: Boolean(data.hasMore),
        }
      }
      return rejectWithValue('Invalid reels feed response')
    } catch (error) {
      const data = error.response?.data
      if (data && Array.isArray(data.products)) {
        return {
          products: data.products,
          page: typeof data.page === 'number' ? data.page : 1,
          limit: typeof data.limit === 'number' ? data.limit : 10,
          total: typeof data.total === 'number' ? data.total : 0,
          hasMore: false,
        }
      }
      const message = (data && typeof data.message === 'string') ? data.message : 'Failed to fetch products'
      return rejectWithValue(message)
    }
  }
)

export const fetchProductById = createAsyncThunk(
  'products/fetchProductById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await productService.getProductById(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch product')
    }
  }
)

export const fetchRelatedProducts = createAsyncThunk(
  'products/fetchRelatedProducts',
  async ({ productId, categoryId, location }, { rejectWithValue }) => {
    try {
      const response = await productService.getRelatedProducts(productId, { categoryId, location })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch related products')
    }
  }
)

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async (productData, { rejectWithValue }) => {
    try {
      const response = await productService.createProduct(productData)
      return response.data
    } catch (error) {
      const payload = error.response?.data
      const message =
        (typeof payload === 'string' ? payload : payload?.message) || 'Failed to create product'
      return rejectWithValue({ message, angleChecklist: payload?.angleChecklist })
    }
  }
)

export const updateProduct = createAsyncThunk(
  'products/updateProduct',
  async ({ id, productData }, { rejectWithValue }) => {
    try {
      const response = await productService.updateProduct(id, productData)
      return response.data
    } catch (error) {
      const payload = error.response?.data
      const message =
        (typeof payload === 'string' ? payload : payload?.message) || 'Failed to update product'
      return rejectWithValue({ message, angleChecklist: payload?.angleChecklist })
    }
  }
)

const initialState = {
  products: [],
  currentProduct: null,
  relatedProducts: [],
  loading: false,
  error: null,
  hasMore: true,
  page: 1,
  latestFetchRequestId: null,
}

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearCurrentProduct: (state) => {
      state.currentProduct = null
    },
    clearProducts: (state) => {
      state.products = []
      state.page = 1
      state.hasMore = true
      state.loading = true
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.latestFetchRequestId = action.meta.requestId
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        if (state.latestFetchRequestId && action.meta.requestId !== state.latestFetchRequestId) {
          return
        }
        state.loading = false
        state.error = null
        if (action.payload && action.payload.products) {
          if (action.payload.page === 1) {
            state.products = action.payload.products || []
          } else {
            state.products = [...state.products, ...(action.payload.products || [])]
          }
          state.hasMore = action.payload.hasMore !== undefined ? action.payload.hasMore : true
          state.page = action.payload.page || 1
        } else {
          // Handle case where payload might be directly an array (backward compatibility)
          state.products = Array.isArray(action.payload) ? action.payload : []
        }
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        if (state.latestFetchRequestId && action.meta.requestId !== state.latestFetchRequestId) {
          return
        }
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchProductsReelsFeed.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProductsReelsFeed.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        if (action.payload && action.payload.products) {
          if (action.payload.page === 1) {
            state.products = action.payload.products || []
          } else {
            state.products = [...state.products, ...(action.payload.products || [])]
          }
          state.hasMore = action.payload.hasMore !== undefined ? action.payload.hasMore : true
          state.page = action.payload.page || 1
        } else {
          state.products = Array.isArray(action.payload) ? action.payload : []
        }
      })
      .addCase(fetchProductsReelsFeed.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchProductById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false
        state.currentProduct = action.payload
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchRelatedProducts.fulfilled, (state, action) => {
        state.relatedProducts = action.payload
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.products.unshift(action.payload)
      })
      .addCase(updateProduct.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.loading = false
        const index = state.products.findIndex(p => p._id === action.payload._id)
        if (index !== -1) {
          state.products[index] = action.payload
        }
        if (state.currentProduct?._id === action.payload._id) {
          state.currentProduct = action.payload
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearCurrentProduct, clearProducts } = productSlice.actions
export default productSlice.reducer

