import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { categoryService } from '../../services/api'

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue, signal }) => {
    try {
      const response = await categoryService.getCategories({ signal })
      return response.data
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
        return rejectWithValue('Request cancelled')
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch categories')
    }
  },
  {
    condition: (_, { getState }) => !getState().categories.loading,
  }
)

export const fetchRootCategories = createAsyncThunk(
  'categories/fetchRootCategories',
  async (_, { rejectWithValue, signal }) => {
    try {
      const response = await categoryService.getRootCategories({ signal })
      return response.data
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
        return rejectWithValue('Request cancelled')
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch root categories')
    }
  },
  {
    condition: (_, { getState }) => !getState().categories.rootLoading,
  }
)

const initialState = {
  categories: [],
  rootCategories: [],
  loading: false,
  rootLoading: false,
  error: null,
  rootError: null,
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
        if (action.meta.aborted || action.payload === 'Request cancelled') return
        state.error = action.payload
      })
      .addCase(fetchRootCategories.pending, (state) => {
        state.rootLoading = true
        state.rootError = null
      })
      .addCase(fetchRootCategories.fulfilled, (state, action) => {
        state.rootLoading = false
        state.rootCategories = Array.isArray(action.payload) ? action.payload : []
      })
      .addCase(fetchRootCategories.rejected, (state, action) => {
        state.rootLoading = false
        if (action.meta.aborted || action.payload === 'Request cancelled') return
        state.rootCategories = []
        state.rootError = action.payload || 'Failed to fetch root categories'
      })
  },
})

export default categorySlice.reducer

