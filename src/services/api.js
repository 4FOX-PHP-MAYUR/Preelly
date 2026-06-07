import axios from 'axios'
import { isValidObjectId } from '../utils/helpers'
import { API_URL } from '../utils/constants'
import { getRouteAbortSignal } from './apiScope'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests (skip when retrying with cookie-only after 401)
api.interceptors.request.use((config) => {
  // Layout/auth calls survive route changes; page-scoped calls are cancelled on navigate.
  if (!config.signal && !config.persistAcrossRoutes) {
    config.signal = getRouteAbortSignal()
  }
  if (!config.__skipBearer) {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  // Let the browser set Content-Type (with boundary) for FormData uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Drop only a stale Bearer from localStorage — never auto-logout from incidental 401s (e.g. post-ad back).
function stripStaleBearerToken() {
  localStorage.removeItem('token')
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const config = error.config
    const url = String(config?.url || '')
    const isAuthRoute =
      url.includes('/auth/send-otp') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/register') ||
      url.includes('/auth/logout')

    if (status === 401 && config && !isAuthRoute) {
      const hadBearer = Boolean(config.headers?.Authorization)

      if (hadBearer && !config.__retriedWithoutBearer) {
        config.__retriedWithoutBearer = true
        config.__skipBearer = true
        if (config.headers) {
          delete config.headers.Authorization
        }
        try {
          return await api.request(config)
        } catch (retryError) {
          error = retryError
        }
      }

      if (error.response?.status === 401 && hadBearer) {
        stripStaleBearerToken()
      }
    }

    return Promise.reject(error)
  }
)

const asAuthOptional = async (promiseFactory, fallbackData) => {
  try {
    return await promiseFactory()
  } catch (error) {
    if (error?.response?.status === 401) {
      stripStaleBearerToken()
      return { data: fallbackData }
    }
    throw error
  }
}

// Auth service
export const authService = {
  sendOtp: ({ email, phone, phoneCountryCode, phoneCountryIso, mode, channel }) =>
    api.post('/auth/send-otp', { email, phone, phoneCountryCode, phoneCountryIso, mode, channel }),
  verifyOtp: ({ email, phone, phoneCountryCode, phoneCountryIso, otp, mode, channel }) =>
    api.post('/auth/verify-otp', {
      email,
      phone,
      phoneCountryCode,
      phoneCountryIso,
      otp,
      mode,
      channel,
    }),
  register: (userData) => api.post('/auth/register', userData),
  sendEmailOtp: ({ email }) => api.post('/auth/send-email-otp', { email }),
  sendPhoneOtp: ({ phone }) => api.post('/auth/send-phone-otp', { phone }),
  verifyEmailOtp: ({ email, otp }) => api.post('/auth/verify-email-otp', { email, otp }),
  verifyPhoneOtp: ({ phone, otp }) => api.post('/auth/verify-phone-otp', { phone, otp }),
  logout: () => api.post('/auth/logout'),
}

// Category service
export const categoryService = {
  getCategories: (config) => api.get('/categories', config),
  getRootCategories: (config) => api.get('/categories/roots', config),
  getCategoryById: (id, config) => api.get(`/categories/${id}`, config),
  getCategoryChildren: (parentId, config) =>
    api.get('/categories', {
      params: { parent_id: parentId == null || parentId === '' ? '' : parentId },
      ...config,
    }),
  getCategoryPath: (id) => api.get(`/categories/${id}/path`),
  getCategoryFilters: (levels, config) => {
    if (levels && typeof levels === 'object') {
      const params = {}
      if (levels.categoryId) params.category_id = levels.categoryId
      if (levels.subcategoryId) params.subcategory_id = levels.subcategoryId
      if (levels.childCategoryId) params.child_category_id = levels.childCategoryId
      return api.get('/category-filters', { params, ...config })
    }
    return api.get('/category-filters', { params: { category_id: levels }, ...config })
  },
  /** Get level labels for cascading dropdowns. rootName optional: if provided returns { root, labels }, else full map. */
  getLevelLabels: (rootName) =>
    api.get('/categories/level-labels', { params: rootName ? { root: rootName } : {} }),
}

// Product service
export const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProductsReelsFeed: (params) => api.get('/products/reels-feed', { params }),
  getProductById: (id) => api.get(`/products/${id}`),
  getVideoProcessingStatus: (id) => api.get(`/products/${id}/video-processing`),
  getRelatedProducts: (productId, params) =>
    api.get(`/products/${productId}/related`, { params }),
  searchProducts: (params) => api.get('/products/search', { params }),
  getPriceRange: (categoryId) => {
    const params = categoryId ? { categoryId } : {}
    return api.get('/products/price-range', { params })
  },
  getFacets: ({ categoryId, subcategoryId } = {}) => {
    const params = {}
    if (categoryId) params.categoryId = categoryId
    if (subcategoryId) params.subcategoryId = subcategoryId
    return api.get('/products/facets', { params })
  },
  createProduct: (productData) => {
    const formData = new FormData()
    Object.keys(productData).forEach((key) => {
      if (key === 'images' || key === 'video') {
        if (Array.isArray(productData[key])) {
          productData[key].forEach((file) => formData.append(key, file))
        } else if (productData[key]) {
          formData.append(key, productData[key])
        }
      } else if (productData[key] !== undefined && productData[key] !== null) {
        // Handle nested objects/arrays by stringifying them
        if (typeof productData[key] === 'object' && !(productData[key] instanceof File)) {
          formData.append(key, JSON.stringify(productData[key]))
        } else {
          formData.append(key, productData[key])
        }
      }
    })
    return api.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  updateProduct: (id, productData) => {
    const formData = new FormData()
    Object.keys(productData).forEach((key) => {
      if (key === 'images' || key === 'video') {
        if (Array.isArray(productData[key])) {
          productData[key].forEach((file) => formData.append(key, file))
        } else if (productData[key]) {
          formData.append(key, productData[key])
        }
      } else if (productData[key] !== undefined && productData[key] !== null) {
        // Handle nested objects/arrays by stringifying them
        if (typeof productData[key] === 'object' && !(productData[key] instanceof File)) {
          formData.append(key, JSON.stringify(productData[key]))
        } else {
          formData.append(key, String(productData[key]))
        }
      }
    })
    
    return api.put(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  resubmitProduct: (id) => api.put(`/products/${id}/resubmit`),
  deleteProduct: (id) => api.delete(`/products/${id}`),
}

// AI listing extraction
export const listingService = {
  aiExtract: ({
    input_text,
    extracted_data,
    vehicle_type,
    subcategory_name,
    category_name,
    category_filters,
  } = {}) =>
    api.post('/listings/ai-extract', {
      input_text,
      extracted_data,
      vehicle_type,
      subcategory_name,
      category_name,
      category_filters,
    }),
  vehicleEnrich: ({
    extracted_data,
    input_text,
    vehicle_type,
    category_filters,
  } = {}) =>
    api.post('/listings/vehicle-enrich', {
      extracted_data,
      input_text,
      vehicle_type,
      category_filters,
    }),
}

export const vehicleFilterService = {
  getOptions: (params) => api.get('/vehicle-filters/options', { params }),
}

// Optimized “single fan-out” endpoint for reels + liked/saved + chats/unread + price range.
export const feedService = {
  getFeedData: (params) => api.get('/feed-data', { params }),
  getFollowingFeed: (params, config) => api.get('/feed/following', { params, ...config }),
  getTrendingFeed: (params, config) => api.get('/feed/trending', { params, ...config }),
}

// User service
export const userService = {
  getDashboard: () => api.get('/user/dashboard'),
  getSavedProducts: () => api.get('/user/saved'),
  getListings: (params) => api.get('/user/listings', { params }),
  getOrders: (params) => api.get('/user/orders', { params }),
  getWishlist: () => api.get('/user/wishlist'),
  getLikedProducts: () => api.get('/user/liked'),
  getNotifications: (params) => api.get('/user/notifications', { params }),
  markNotificationRead: (id) => api.patch(`/user/notifications/${id}/read`),
  markAllNotificationsRead: () => api.patch('/user/notifications/read-all'),
  followUser: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.post(`/user/${userId}/follow`)
  },
  getFollowStatus: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.get(`/user/${userId}/follow-status`)
  },
  acceptFollowRequest: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.post(`/user/${userId}/follow/accept`)
  },
  rejectFollowRequest: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.post(`/user/${userId}/follow/reject`)
  },
  blockUser: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.post(`/user/${userId}/block`)
  },
  getUserProfile: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.get(`/user/${userId}/profile`)
  },
  /** useCookieSession: true = httpOnly cookie only (avoids stale Bearer 401 on boot) */
  getCurrentUserProfile: (options = {}) =>
    api.get('/user/profile', {
      persistAcrossRoutes: true,
      ...(options.useCookieSession ? { __skipBearer: true } : {}),
    }),
  updateProfile: (data) => api.put('/user/profile', data),
  completeBasicProfile: (formData) =>
    api.post('/user/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getFollowers: (userId) => api.get(`/user/${userId}/followers`),
  getFollowing: (userId) => api.get(`/user/${userId}/following`),
  getFollowRequests: () => api.get('/user/follow-requests'),
  getSuggestedUsers: (limit = 10) => api.get('/user/suggested', { params: { limit } }),
  getReelsProgress: () => asAuthOptional(() => api.get('/user/reels-progress'), { reelsProgress: {} }),
  saveReelsProgress: (feedKey, index) =>
    asAuthOptional(() => api.put('/user/reels-progress', { feedKey, index }), {}),
  changePassword: (currentPassword, newPassword) =>
    api.post('/user/change-password', { currentPassword, newPassword }),
  unlinkSocial: (provider) => api.post('/user/unlink-social', { provider }),
  linkSocial: (provider) => {
    const params = new URLSearchParams({ mode: 'link' })
    const token = localStorage.getItem('token')
    if (token) params.set('token', token)
    window.location.href = `/api/auth/oauth/${encodeURIComponent(provider)}?${params.toString()}`
  },
  getLocations: () => api.get('/user/locations'),
  addLocation: (data) => api.post('/user/locations', data),
  updateLocation: (locId, data) => api.put(`/user/locations/${locId}`, data),
  deleteLocation: (locId) => api.delete(`/user/locations/${locId}`),
  getIdentityVerification: () => api.get('/user/identity-verification'),
  submitIdentityVerification: (formData) =>
    api.post('/user/identity-verification', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// Interaction service
export const interactionService = {
  likeProduct: (productId) => {
    if (!isValidObjectId(productId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid product ID' } } })
    return api.post(`/products/${productId}/like`)
  },
  saveProduct: (productId) => {
    if (!isValidObjectId(productId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid product ID' } } })
    return api.post(`/products/${productId}/save`)
  },
  incrementView: (productId) => {
    if (!isValidObjectId(productId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid product ID' } } })
    return api.post(`/products/${productId}/view`)
  },
  checkLiked: (productId) => {
    if (!isValidObjectId(productId)) return Promise.resolve({ data: { liked: false } })
    return asAuthOptional(() => api.get(`/products/${productId}/liked`), { liked: false })
  },
  checkSaved: (productId) => {
    if (!isValidObjectId(productId)) return Promise.resolve({ data: { saved: false } })
    return asAuthOptional(() => api.get(`/products/${productId}/saved`), { saved: false })
  },
  reportProduct: (productId, data) => api.post(`/products/${productId}/report`, data),
  getComments: (productId) => api.get(`/products/${productId}/comments`),
  addComment: (productId, text) => api.post(`/products/${productId}/comments`, { text }),
  deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
  likeComment: (commentId) => api.post(`/comments/${commentId}/like`),
  reportComment: (commentId, reason) => api.post(`/comments/${commentId}/report`, { reason }),
  getCommentCount: (productId) => api.get(`/products/${productId}/comments/count`),
}

// Chat service
export const chatService = {
  getChats: () => api.get('/chats'),
  getUnreadCount: (config) => api.get('/chats/unread-count', { persistAcrossRoutes: true, ...config }),
  getChatById: (chatId) => api.get(`/chats/${chatId}`),
  createOrGetChat: (productId, sellerId, options = {}) =>
    api.post('/chats', { productId, sellerId, ...options }),
  createSupportChat: () => api.post('/chats', { type: 'support' }),
  sendMessage: (chatId, text, files) => {
    const fileList = !files ? [] : Array.isArray(files) ? files : [files]
    if (fileList.length > 0) {
      const fd = new FormData()
      if (text) fd.append('text', text)
      fileList.forEach((f) => fd.append('files', f))
      return api.post(`/chats/${chatId}/messages`, fd)
    }
    return api.post(`/chats/${chatId}/messages`, { text })
  },
  markAsRead: (chatId) => api.put(`/chats/${chatId}/read`),
  deleteChat: (chatId) => api.delete(`/chats/${chatId}`),
  deleteMessage: (chatId, messageId) => api.delete(`/chats/${chatId}/messages/${messageId}`),
  saveCallEvent: (chatId, data) => api.post(`/chats/${chatId}/call-event`, data),
}

// Admin service
export const adminService = {
  getPendingProducts: (params) => api.get('/admin/products/pending', { params }),
  getAllProducts: (params) => api.get('/admin/products', { params }),
  approveProduct: (productId) => api.put(`/admin/products/${productId}/approve`),
  rejectProduct: (productId, payload) => api.put(`/admin/products/${productId}/reject`, payload),
  getProductRejectionReasons: () => api.get('/admin/products/rejection-reasons'),
   setProductStatus: (productId, status) => api.put(`/admin/products/${productId}/status`, { status }),
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  verifyUser: (userId, isVerified) => api.put(`/admin/users/${userId}/verify`, { isVerified }),
  getIdentityVerifications: (params) => api.get('/admin/identity-verifications', { params }),
  getIdentityVerification: (userId) => api.get(`/admin/identity-verifications/${userId}`),
  approveIdentityVerification: (userId) => api.put(`/admin/identity-verifications/${userId}/approve`),
  rejectIdentityVerification: (userId, reason) =>
    api.put(`/admin/identity-verifications/${userId}/reject`, { reason }),
  setUserRole: (userId, role) => api.put(`/admin/users/${userId}/role`, { role }),
  setUserStatus: (userId, status) => api.put(`/admin/users/${userId}/status`, { status }),
  createUser: (userData) => api.post('/admin/users', userData),
  getContacts: (params) => api.get('/admin/contacts', { params }),
  getSupportUnreadCount: () => api.get('/admin/support-unread-count'),
  getComments: (params) => api.get('/admin/comments', { params }),
  approveComment: (commentId) => api.put(`/admin/comments/${commentId}/approve`),
  rejectComment: (commentId) => api.put(`/admin/comments/${commentId}/reject`),
  getReportedComments: (params) => api.get('/admin/reported-comments', { params }),
  resolveReportedComment: (commentId, action) => api.put(`/admin/reported-comments/comment/${commentId}/action`, { action }),
  // Category admin endpoints
  getAdminCategories: (params) => api.get('/admin/categories', { params }),
  getAdminCategoryChildren: (params) => api.get('/admin/categories/children', { params }),
  /** Nested category tree for cascading dropdowns (all levels). */
  getAdminCategoryNestedForFilters: () => api.get('/admin/categories/nested-for-filters'),
  getAdminCategoryTree: () => api.get('/admin/categories/tree'),
  createAdminCategory: (data) => {
    const hasFile = data?.category_image instanceof File
    if (!hasFile) return api.post('/admin/categories', data)
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if (key === 'category_image' && value instanceof File) {
        formData.append('category_image', value)
      } else if (value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/admin/categories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  updateAdminCategory: (id, data) => {
    const hasFile = data?.category_image instanceof File
    if (!hasFile) {
      const { category_image, ...rest } = data || {}
      return api.patch(`/admin/categories/${id}`, rest)
    }
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if (key === 'category_image' && value instanceof File) {
        formData.append('category_image', value)
      } else {
        formData.append(key, value)
      }
    })
    return api.patch(`/admin/categories/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteAdminCategory: (id) => api.delete(`/admin/categories/${id}`),
  getAllAdminCategories: (params) => api.get('/admin/categories/all', { params }),
  importAdminCategoriesExcel: (formData) =>
    api.post('/admin/categories/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // Filters admin endpoints
  getAdminFilters: (params) => api.get('/admin/filters', { params }),
  getAdminFilterTree: (params) => api.get('/admin/filters/tree', { params }),
  importAdminFiltersExcel: (formData) =>
    api.post('/admin/filters/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createAdminFilter: (data) => {
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null || value === '') return
      if (key === 'thumbImage' && value instanceof File) {
        formData.append('thumbImage', value)
      } else {
        formData.append(key, value)
      }
    })
    return api.post('/admin/filters', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  updateAdminFilter: (id, data) => {
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if (key === 'thumbImage' && value instanceof File) {
        formData.append('thumbImage', value)
      } else {
        formData.append(key, value)
      }
    })
    return api.patch(`/admin/filters/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteAdminFilter: (id) => api.delete(`/admin/filters/${id}`),
  // Dealers admin endpoints
  getDealers: (params) => api.get('/admin/dealers', { params }),
  getDealerById: (id) => api.get(`/admin/dealers/${id}`),
  createDealer: (data) => {
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if (key === 'dealer_image' && value instanceof File) {
        formData.append('dealer_image', value)
      } else if (value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/admin/dealers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  updateDealer: (id, data) => {
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if (key === 'dealer_image' && value instanceof File) {
        formData.append('dealer_image', value)
      } else {
        formData.append(key, value)
      }
    })
    return api.patch(`/admin/dealers/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  setDealerStatus: (id, status) => api.put(`/admin/dealers/${id}/status`, { status }),
  deleteDealer: (id) => api.delete(`/admin/dealers/${id}`),
  // Admin Roles endpoints
  getRoles: (params) => api.get('/admin/roles', { params }),
  getRoleById: (id) => api.get(`/admin/roles/${id}`),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.patch(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
  getRolePermissions: (id) => api.get(`/admin/roles/${id}/permissions`),
  saveRolePermissions: (id, permissions) => api.put(`/admin/roles/${id}/permissions`, { permissions }),
  getModules: () => api.get('/admin/modules'),
  // User admin role assignment
  setUserAdminRole: (userId, adminRole) => api.put(`/admin/users/${userId}/admin-role`, { adminRole }),
  // Field Types endpoints
  getFieldTypes: (params) => api.get('/admin/field-types', { params }),
  getFieldTypeById: (id) => api.get(`/admin/field-types/${id}`),
  createFieldType: (data) => api.post('/admin/field-types', data),
  updateFieldType: (id, data) => api.patch(`/admin/field-types/${id}`, data),
  deleteFieldType: (id) => api.delete(`/admin/field-types/${id}`),
  // Form Fields endpoints
  getFormFields: (params) => api.get('/admin/form-fields', { params }),
  getFormFieldDropdowns: () => api.get('/admin/form-fields/dropdowns'),
  getFormFieldFilters: (categoryId) => api.get('/admin/form-fields/filters', { params: { categoryId } }),
  getFormFieldById: (id) => api.get(`/admin/form-fields/${id}`),
  createFormField: (data) => api.post('/admin/form-fields', data),
  updateFormField: (id, data) => api.patch(`/admin/form-fields/${id}`, data),
  deleteFormField: (id) => api.delete(`/admin/form-fields/${id}`),
}

// Video service
export const videoService = {
  transcribeVideo: (videoFile, category, subcategory, { categoryId, subcategoryId, childCategoryId } = {}) => {
    const formData = new FormData()
    formData.append('video', videoFile)
    if (category) formData.append('category', category)
    if (subcategory) formData.append('subcategory', subcategory)
    if (categoryId) formData.append('categoryId', categoryId)
    if (subcategoryId) formData.append('subcategoryId', subcategoryId)
    if (childCategoryId) formData.append('childCategoryId', childCategoryId)
    return api.post('/video/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
  },
  captureScreenshot: (videoFile, timestamp) => {
    const formData = new FormData()
    formData.append('video', videoFile)
    formData.append('timestamp', timestamp.toString())
    return api.post('/video/screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  enhanceDescription: ({ title, description, category } = {}) =>
    api.post('/ai/enhance-description', { title, description, category }),
}

export const streamingService = {
  uploadMp4: (videoFile, { onUploadProgress } = {}) => {
    const formData = new FormData()
    formData.append('video', videoFile)
    return api.post('/streaming/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
      onUploadProgress,
    })
  },
  getJob: (jobId) => api.get(`/streaming/jobs/${jobId}`),
  getHealth: () => api.get('/streaming/health'),
}

export default api