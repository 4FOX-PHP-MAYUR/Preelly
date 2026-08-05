import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { adminAuthService, ADMIN_TOKEN_STORAGE_KEY } from '../services/api'

const ADMIN_USER_STORAGE_KEY = 'admin_user'
const ADMIN_PERMISSIONS_STORAGE_KEY = 'admin_permissions'

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistSession({ token, adminUser, permissions }) {
  if (token) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
  if (adminUser) localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(adminUser))
  localStorage.setItem(ADMIN_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions ?? null))
}

function clearSession() {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
  localStorage.removeItem(ADMIN_USER_STORAGE_KEY)
  localStorage.removeItem(ADMIN_PERMISSIONS_STORAGE_KEY)
}

const initialState = {
  adminUser: readJson(ADMIN_USER_STORAGE_KEY),
  token: localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || null,
  permissions: readJson(ADMIN_PERMISSIONS_STORAGE_KEY),
  isAuthenticated: Boolean(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)),
  // Bootstraps true so route guards wait for `fetchAdminSession` before deciding.
  hydrating: true,
  loading: false,
  error: null,
}

/** Email + password login against admin_users. */
export const loginAdmin = createAsyncThunk(
  'adminAuth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await adminAuthService.login({ email, password })
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed')
    }
  }
)

/** Restores the session on app load by validating the stored token. */
export const fetchAdminSession = createAsyncThunk(
  'adminAuth/fetchSession',
  async (_, { rejectWithValue }) => {
    if (!localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)) {
      return rejectWithValue('No session')
    }
    try {
      const res = await adminAuthService.me()
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Session expired')
    }
  }
)

export const logoutAdmin = createAsyncThunk('adminAuth/logout', async () => {
  try {
    await adminAuthService.logout()
  } catch {
    // Best-effort — always clear the local session regardless.
  }
  return true
})

const adminAuthSlice = createSlice({
  name: 'adminAuth',
  initialState,
  reducers: {
    clearAdminAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAdmin.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false
        state.hydrating = false
        state.isAuthenticated = true
        state.adminUser = action.payload.adminUser
        state.token = action.payload.token
        state.permissions = action.payload.permissions ?? null
        persistSession(action.payload)
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Login failed'
      })

      .addCase(fetchAdminSession.pending, (state) => {
        state.hydrating = true
      })
      .addCase(fetchAdminSession.fulfilled, (state, action) => {
        state.hydrating = false
        state.isAuthenticated = true
        state.adminUser = action.payload.adminUser
        state.permissions = action.payload.permissions ?? null
        persistSession({ adminUser: action.payload.adminUser, permissions: action.payload.permissions })
      })
      .addCase(fetchAdminSession.rejected, (state) => {
        state.hydrating = false
        state.isAuthenticated = false
        state.adminUser = null
        state.token = null
        state.permissions = null
        clearSession()
      })

      .addCase(logoutAdmin.fulfilled, (state) => {
        state.isAuthenticated = false
        state.adminUser = null
        state.token = null
        state.permissions = null
        clearSession()
      })
  },
})

export const { clearAdminAuthError } = adminAuthSlice.actions

export const selectAdminAuthHydrating = (state) => state.adminAuth.hydrating
export const selectIsAdminAuthenticated = (state) => state.adminAuth.isAuthenticated
export const selectAdminUser = (state) => state.adminAuth.adminUser
export const selectAdminPermissions = (state) => state.adminAuth.permissions
export const selectAdminAuthLoading = (state) => state.adminAuth.loading
export const selectAdminAuthError = (state) => state.adminAuth.error

export default adminAuthSlice.reducer
