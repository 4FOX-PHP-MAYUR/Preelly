import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authService } from '../../services/api'

let initializeAuthInFlight = null

async function fetchCurrentUserProfile() {
  const { userService } = await import('../../services/api')
  const response = await userService.getCurrentUserProfile({ useCookieSession: true })
  const userData = response.data

  localStorage.setItem('user', JSON.stringify(userData))
  if (userData.permissions) localStorage.setItem('permissions', JSON.stringify(userData.permissions))
  else localStorage.removeItem('permissions')

  return userData
}

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    try {
      if (!initializeAuthInFlight) {
        initializeAuthInFlight = fetchCurrentUserProfile().finally(() => {
          initializeAuthInFlight = null
        })
      }
      return await initializeAuthInFlight
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
        return rejectWithValue({ message: 'Cancelled', status: null })
      }
      const status = error.response?.status
      if (status === 401) {
        localStorage.removeItem('token')
      }

      return rejectWithValue({
        message: error.response?.data?.message || 'Not authenticated',
        status: status || null,
      })
    }
  },
  {
    // Only while session is being validated (prevents duplicate profile calls on every route).
    condition: (_, { getState }) => getState().auth.hydrating,
  }
)

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ email, phone, phoneCountryCode, phoneCountryIso, mode, channel }, { rejectWithValue }) => {
    try {
      const response = await authService.sendOtp({
        email,
        phone,
        phoneCountryCode,
        phoneCountryIso,
        mode,
        channel,
      })
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || 'Failed to send sign-in code',
        code: error.response?.data?.code || null,
        status: error.response?.status || null,
      })
    }
  }
)

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ email, phone, phoneCountryCode, phoneCountryIso, otp, mode, channel }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyOtp({
        email,
        phone,
        phoneCountryCode,
        phoneCountryIso,
        otp,
        mode,
        channel,
      })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      if (response.data.user?.permissions) {
        localStorage.setItem('permissions', JSON.stringify(response.data.user.permissions))
      } else {
        localStorage.removeItem('permissions')
      }
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || 'Failed to verify sign-in code',
        code: error.response?.data?.code || null,
        status: error.response?.status || null,
      })
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData)
      // Registration now returns `verificationRequired: true` without a JWT.
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed')
    }
  }
)

export const sendEmailOtp = createAsyncThunk(
  'auth/sendEmailOtp',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await authService.sendEmailOtp({ email })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send OTP')
    }
  }
)

export const sendPhoneOtp = createAsyncThunk(
  'auth/sendPhoneOtp',
  async ({ phone }, { rejectWithValue }) => {
    try {
      const response = await authService.sendPhoneOtp({ phone })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send OTP')
    }
  }
)

export const verifyEmailOtp = createAsyncThunk(
  'auth/verifyEmailOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyEmailOtp({ email, otp })
      localStorage.removeItem('permissions')
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify OTP')
    }
  }
)

export const verifyPhoneOtp = createAsyncThunk(
  'auth/verifyPhoneOtp',
  async ({ phone, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyPhoneOtp({ phone, otp })
      localStorage.removeItem('permissions')
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify OTP')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async (reason, { rejectWithValue }) => {
  if (reason !== 'user-click') {
    return rejectWithValue('Logout blocked (missing user-click reason)')
  }
  try {
    await authService.logout()
  } catch {
    // Backend logout is optional; we still clear local state.
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
  }
})

export const refreshUser = createAsyncThunk(
  'auth/refreshUser',
  async (_, { rejectWithValue }) => {
    try {
      const { userService } = await import('../../services/api')
      const response = await userService.getCurrentUserProfile({ useCookieSession: true })
      const userData = response.data
      localStorage.setItem('user', JSON.stringify(userData))
      if (userData.permissions) {
        localStorage.setItem('permissions', JSON.stringify(userData.permissions))
      }
      return userData
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
      }
      return rejectWithValue({
        message: error.response?.data?.message || 'Failed to refresh user data',
        status: error.response?.status || null,
      })
    }
  }
)

const storedPermissions = (() => {
  try {
    const raw = localStorage.getItem('permissions')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const storedUser = (() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const initialState = {
  user: storedUser,
  token: localStorage.getItem('token') || null,
  // Keep user on protected routes while cookie/session is re-validated.
  isAuthenticated: !!storedUser,
  hydrating: true,
  permissions: storedPermissions,
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearSession: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.permissions = null
      state.hydrating = false
    },
    rehydrateSessionFromStorage: (state) => {
      try {
        const raw = localStorage.getItem('user')
        if (!raw) return
        state.user = JSON.parse(raw)
        state.token = localStorage.getItem('token') || null
        const perms = localStorage.getItem('permissions')
        state.permissions = perms ? JSON.parse(perms) : null
        // Do not force isAuthenticated here — avoids stale localStorage bypassing server session checks.
      } catch {
        // ignore corrupt storage
      }
    },
    clearError: (state) => {
      state.error = null
    },
    setPermissions: (state, action) => {
      state.permissions = action.payload
      if (action.payload) {
        localStorage.setItem('permissions', JSON.stringify(action.payload))
      } else {
        localStorage.removeItem('permissions')
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, (state) => {
        if (!state.user) state.hydrating = true
        state.error = null
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.hydrating = false
        state.user = action.payload
        state.isAuthenticated = true
        state.permissions = action.payload?.permissions || null
        if (!state.token && localStorage.getItem('token')) {
          state.token = localStorage.getItem('token')
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.hydrating = false
        if (action.meta.aborted || action.payload?.message === 'Cancelled') return
        // Expired/invalid session — clear stale cache so protected APIs (video transcribe, etc.) don't 401-loop.
        if (action.payload?.status === 401) {
          state.user = null
          state.token = null
          state.isAuthenticated = false
          state.permissions = null
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('permissions')
        }
      })
      .addCase(sendOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(sendOtp.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
        state.isAuthenticated = !!action.payload.token
        state.permissions = action.payload.user?.permissions || null
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user || null
        state.token = action.payload.token || null
        state.isAuthenticated = !!action.payload.token && !!(action.payload.user?.isVerified || action.payload.user?.role === 'admin')
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.permissions = null
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.isAuthenticated = true
        state.permissions = action.payload?.permissions || null
      })

      .addCase(refreshUser.rejected, () => {
        // Keep session on background refresh failures (network, 503, etc.).
      })

      .addCase(sendEmailOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(sendEmailOtp.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(sendEmailOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(sendPhoneOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(sendPhoneOtp.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(sendPhoneOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(verifyEmailOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyEmailOtp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user || null
        state.token = action.payload.token || null
        state.isAuthenticated = !!action.payload.token && !!action.payload.user?.isVerified
        state.permissions = null
      })
      .addCase(verifyEmailOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(verifyPhoneOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyPhoneOtp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user || null
        state.token = action.payload.token || null
        state.isAuthenticated = !!action.payload.token && !!action.payload.user?.isVerified
        state.permissions = null
      })
      .addCase(verifyPhoneOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearSession, clearError, setPermissions, rehydrateSessionFromStorage } = authSlice.actions

export const selectHasSession = (state) =>
  Boolean(state.auth.user) || Boolean(state.auth.isAuthenticated)

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated
export const selectUser = (state) => state.auth.user
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin'
export const selectPermissions = (state) => state.auth.permissions
export const selectAuthHydrating = (state) => state.auth.hydrating

export const selectHasPermission = (moduleName, action) => (state) => {
  const permissions = state.auth.permissions
  if (!permissions) return true
  const mod = permissions[moduleName]
  if (!mod) return false
  return !!mod[action]
}

export default authSlice.reducer
