import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { categoryService } from '../../services/api'

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await categoryService.getCategories()
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch categories')
    }
  }
)

export const fetchRootCategories = createAsyncThunk(
  'categories/fetchRootCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await categoryService.getRootCategories()
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch root categories')
    }
  }
)

const initialState = {
  categories: [],
  rootCategories: [],
  loading: false,
  error: null,
}

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false
        // Only update if we don't have categories or if payload is different
        if (state.categories.length === 0 || action.payload.length > 0) {
        state.categories = action.payload
        }
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchRootCategories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRootCategories.fulfilled, (state, action) => {
        state.loading = false
        state.rootCategories = Array.isArray(action.payload) ? action.payload : []
      })
      .addCase(fetchRootCategories.rejected, (state, action) => {
        state.loading = false
        state.rootCategories = []
        state.error = action.payload || 'Failed to fetch root categories'
      })
  },
})

export default categorySlice.reducer

