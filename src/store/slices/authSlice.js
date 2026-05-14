import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authService } from '../../services/api'

export const initializeAuth = createAsyncThunk('auth/initializeAuth', async (_, { rejectWithValue }) => {
  try {
    const { userService } = await import('../../services/api')
    const response = await userService.getCurrentUserProfile()
    const userData = response.data

    localStorage.setItem('user', JSON.stringify(userData))
    if (userData.permissions) localStorage.setItem('permissions', JSON.stringify(userData.permissions))
    else localStorage.removeItem('permissions')

    return userData
  } catch (error) {
    // Ensure stale client-side auth state doesn't keep the UI “logged in”.
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')

    return rejectWithValue(error.response?.data?.message || 'Not authenticated')
  }
})

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials)
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      if (response.data.user?.permissions) {
        localStorage.setItem('permissions', JSON.stringify(response.data.user.permissions))
      } else {
        localStorage.removeItem('permissions')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed')
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

export const verifyEmailOtp = createAsyncThunk(
  'auth/verifyEmailOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyEmailOtp({ email, otp })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      // No permissions returned by OTP verify, so clear any stale value.
      localStorage.removeItem('permissions')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify OTP')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
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
      const response = await userService.getCurrentUserProfile()
      const userData = response.data
      localStorage.setItem('user', JSON.stringify(userData))
      if (userData.permissions) {
        localStorage.setItem('permissions', JSON.stringify(userData.permissions))
      }
      return userData
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh user data')
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
  isAuthenticated: false,
  hydrating: true,
  permissions: storedPermissions,
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
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
        state.hydrating = true
        state.error = null
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.hydrating = false
        state.user = action.payload
        state.isAuthenticated = true
        state.permissions = action.payload?.permissions || null
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.hydrating = false
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.permissions = null
      })
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
        state.isAuthenticated = !!(action.payload.user?.isVerified || action.payload.user?.role === 'admin')
        state.permissions = action.payload.user?.permissions || null
      })
      .addCase(login.rejected, (state, action) => {
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

      .addCase(refreshUser.rejected, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.permissions = null
      })
      // (Optional background refresh failures don't crash the UI.)

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
      .addCase(verifyEmailOtp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyEmailOtp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
        state.isAuthenticated = true
        state.permissions = null
      })
      .addCase(verifyEmailOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError, setPermissions } = authSlice.actions
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
