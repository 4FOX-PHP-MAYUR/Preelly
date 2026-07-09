import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { dynamicFormService } from '../../services/api'
import { isFieldRequired, hasValue } from '../../utils/dynamicFormValidation'

// Global state for the admin-configured, category-scoped dynamic post-ad form
// (POST /api/v1/web/dynamic-form). Caching is keyed by the exact scope the form
// was fetched with, so navigating back/forth between steps or categories never
// re-fetches a scope that's already loaded.
function buildCacheKey(categoryId, categoryFilterId, childCategoryId) {
  return `${categoryId || ''}::${categoryFilterId || ''}::${childCategoryId || ''}`
}

/** Applies a freshly resolved options list for a field, pruning a now-invalid selection. */
function applyComputedOptions(state, fieldName, options) {
  state.computedOptionsLoading[fieldName] = false
  state.computedOptions[fieldName] = options
  const validValues = new Set(options.map((opt) => String(opt.value)))
  const current = state.values[fieldName]
  if (Array.isArray(current)) {
    state.values[fieldName] = current.filter((v) => validValues.has(String(v)))
  } else if (current !== undefined && current !== '' && !validValues.has(String(current))) {
    state.values[fieldName] = ''
  }
}

/**
 * Invokes a field's admin-configured functionName (e.g. Trim's "getTrimByID") with the
 * current values of its dependency fields (functionForField), refreshing that field's
 * options. See core/services/formFieldFunctions.js on the backend for the registry.
 */
export const fetchFieldFunctionOptions = createAsyncThunk(
  'dynamicForm/fetchFieldFunctionOptions',
  async ({ fieldName, functionName, params }, { rejectWithValue }) => {
    try {
      const res = await dynamicFormService.callFieldFunction({ functionName, params })
      return { fieldName, options: Array.isArray(res.data?.options) ? res.data.options : [] }
    } catch (error) {
      return rejectWithValue({
        fieldName,
        message: error.response?.data?.message || 'Failed to load options',
      })
    }
  }
)

export const fetchDynamicForm = createAsyncThunk(
  'dynamicForm/fetch',
  async ({ categoryId, categoryFilterId, childCategoryId }, { rejectWithValue, signal }) => {
    try {
      const payload = { categoryId }
      if (categoryFilterId) payload.categoryFilterId = categoryFilterId
      if (childCategoryId) payload.childCategoryId = childCategoryId
      const res = await dynamicFormService.getDynamicForm(payload, { signal })
      return { cacheKey: buildCacheKey(categoryId, categoryFilterId, childCategoryId), data: res.data || {} }
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
        return rejectWithValue('Request cancelled')
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to load additional fields')
    }
  },
  {
    condition: ({ categoryId, categoryFilterId, childCategoryId }, { getState }) => {
      if (!categoryId) return false
      const key = buildCacheKey(categoryId, categoryFilterId, childCategoryId)
      const entry = getState().dynamicForm.cache[key]
      // Already loaded (or currently loading) this exact scope — skip the network call.
      return !entry || entry.status === 'failed'
    },
  }
)

const initialState = {
  activeCategoryId: null,
  categoryFilterId: null,
  childCategoryId: null,
  subStep: 0,
  values: {},
  cache: {},
  computedOptions: {},
  computedOptionsLoading: {},
}

const dynamicFormSlice = createSlice({
  name: 'dynamicForm',
  initialState,
  reducers: {
    /**
     * Call when the post-ad category selection changes. `categoryId` should be the
     * deepest category picked in Step 2 (subcategory if selected, else the root).
     */
    setActiveCategory(state, action) {
      const { categoryId = null } = action.payload || {}
      if (state.activeCategoryId === categoryId) return
      state.activeCategoryId = categoryId
      state.categoryFilterId = null
      state.childCategoryId = null
      state.subStep = 0
      state.values = {}
      state.computedOptions = {}
      state.computedOptionsLoading = {}
    },
    setFieldValue(state, action) {
      const { fieldName, value } = action.payload
      state.values[fieldName] = value
    },
    /** Generic dependency hook: a field's own selection can widen the active fetch scope. */
    updateScope(state, action) {
      const { categoryFilterId, childCategoryId } = action.payload || {}
      let changed = false
      if (categoryFilterId !== undefined && categoryFilterId !== state.categoryFilterId) {
        state.categoryFilterId = categoryFilterId
        changed = true
      }
      if (childCategoryId !== undefined && childCategoryId !== state.childCategoryId) {
        state.childCategoryId = childCategoryId
        changed = true
      }
      if (changed) state.subStep = 0
    },
    goToSubStep(state, action) {
      state.subStep = action.payload
    },
    /**
     * Sets a field's options synchronously (no network call) — used when they're
     * derived client-side from another field's already-loaded nested options tree
     * (e.g. Trim options read from the selected Make & Model node's `children`).
     */
    setComputedOptions(state, action) {
      const { fieldName, options } = action.payload
      applyComputedOptions(state, fieldName, Array.isArray(options) ? options : [])
    },
    resetDynamicForm() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDynamicForm.pending, (state, action) => {
        const { categoryId, categoryFilterId, childCategoryId } = action.meta.arg
        const key = buildCacheKey(categoryId, categoryFilterId, childCategoryId)
        const prev = state.cache[key]
        // Keep any previously-loaded fields visible while a dependency-triggered refetch runs.
        state.cache[key] = prev
          ? { ...prev, status: 'loading' }
          : { status: 'loading', error: null, categoryName: null, totalSteps: 0, steps: [] }
      })
      .addCase(fetchDynamicForm.fulfilled, (state, action) => {
        const { cacheKey, data } = action.payload
        state.cache[cacheKey] = {
          status: 'succeeded',
          error: null,
          categoryName: data.categoryName || null,
          totalSteps: data.totalSteps || 0,
          steps: Array.isArray(data.steps) ? data.steps : [],
        }

        const activeKey = buildCacheKey(state.activeCategoryId, state.categoryFilterId, state.childCategoryId)
        if (cacheKey === activeKey) {
          // Drop stale values for fields that no longer exist under the new scope.
          const validNames = new Set()
          for (const step of data.steps || []) {
            for (const field of step.fields || []) validNames.add(field.fieldName)
          }
          Object.keys(state.values).forEach((key) => {
            if (!validNames.has(key)) delete state.values[key]
          })
        }
      })
      .addCase(fetchDynamicForm.rejected, (state, action) => {
        if (action.meta.aborted || action.payload === 'Request cancelled') return
        const { categoryId, categoryFilterId, childCategoryId } = action.meta.arg
        const key = buildCacheKey(categoryId, categoryFilterId, childCategoryId)
        state.cache[key] = {
          status: 'failed',
          error: action.payload || 'Failed to load additional fields',
          categoryName: null,
          totalSteps: 0,
          steps: [],
        }
      })
      .addCase(fetchFieldFunctionOptions.pending, (state, action) => {
        state.computedOptionsLoading[action.meta.arg.fieldName] = true
      })
      .addCase(fetchFieldFunctionOptions.fulfilled, (state, action) => {
        applyComputedOptions(state, action.payload.fieldName, action.payload.options)
      })
      .addCase(fetchFieldFunctionOptions.rejected, (state, action) => {
        const fieldName = action.payload?.fieldName || action.meta.arg.fieldName
        state.computedOptionsLoading[fieldName] = false
        state.computedOptions[fieldName] = []
      })
  },
})

export const { setActiveCategory, setFieldValue, updateScope, goToSubStep, setComputedOptions, resetDynamicForm } =
  dynamicFormSlice.actions

export const selectDynamicFormCacheKey = (state) =>
  buildCacheKey(state.dynamicForm.activeCategoryId, state.dynamicForm.categoryFilterId, state.dynamicForm.childCategoryId)

export const selectDynamicFormEntry = (state) => state.dynamicForm.cache[selectDynamicFormCacheKey(state)] || null

/** Every admin-configured field across every sub-step of the active category — used by the
 * review screen, which needs to display (and let the user edit) fields regardless of which
 * dynamic-form sub-step they originally lived on. */
export const selectDynamicFormAllFields = (state) => {
  const entry = selectDynamicFormEntry(state)
  if (!entry) return []
  return entry.steps.flatMap((step) => step.fields || [])
}

export const selectDynamicFormValues = (state) => state.dynamicForm.values

export const selectComputedOptions = (state, fieldName) => state.dynamicForm.computedOptions[fieldName] || null
export const selectComputedOptionsLoading = (state, fieldName) =>
  Boolean(state.dynamicForm.computedOptionsLoading[fieldName])

/**
 * Whether it's safe to leave Step 4: either there are no admin-configured fields for
 * this category, or the user has reached and completed the final inner sub-step.
 * A failed fetch does not block progression (graceful degradation).
 */
export const selectDynamicFormIsReadyToSubmit = (state) => {
  const df = state.dynamicForm
  if (!df.activeCategoryId) return true
  const entry = selectDynamicFormEntry(state)
  if (!entry) return false
  if (entry.status === 'failed') return true
  const totalSteps = entry.totalSteps || 0
  if (totalSteps === 0) return true
  if (df.subStep !== totalSteps - 1) return false
  const currentFields = entry.steps[df.subStep]?.fields || []
  return currentFields.every((field) => !isFieldRequired(field) || hasValue(df.values[field.fieldName]))
}

export { buildCacheKey as buildDynamicFormCacheKey }

export default dynamicFormSlice.reducer
