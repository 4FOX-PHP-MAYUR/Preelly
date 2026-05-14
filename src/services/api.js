import axios from 'axios'
import { isValidObjectId } from '../utils/helpers'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Invalid/expired token or user removed from DB: clear client session so UI matches API (fixes stale "Super Admin" + 401 "User not found").
let clearingUnauthorizedSession = false
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const url = String(error.config?.url || '')
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/admin-login')

    if (
      status === 401 &&
      !isAuthRoute &&
      localStorage.getItem('token') &&
      !clearingUnauthorizedSession
    ) {
      clearingUnauthorizedSession = true
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('permissions')
        const { store } = await import('../store/store')
        const { logout } = await import('../store/slices/authSlice')
        store.dispatch(logout())
        const path = window.location.pathname
        if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
          window.location.assign('/admin/login?reason=session')
        }
      } finally {
        clearingUnauthorizedSession = false
      }
    }
    return Promise.reject(error)
  }
)

const asAuthOptional = async (promiseFactory, fallbackData) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return { data: fallbackData }
  }
  try {
    return await promiseFactory()
  } catch (error) {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token')
      return { data: fallbackData }
    }
    throw error
  }
}

// Auth service
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  adminLogin: (credentials) => api.post('/auth/admin-login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  sendEmailOtp: ({ email }) => api.post('/auth/send-email-otp', { email }),
  verifyEmailOtp: ({ email, otp }) => api.post('/auth/verify-email-otp', { email, otp }),
  logout: () => api.post('/auth/logout'),
}

// Category service
export const categoryService = {
  getCategories: () => api.get('/categories'),
  getRootCategories: () => api.get('/categories/roots'),
  getCategoryById: (id) => api.get(`/categories/${id}`),
  getCategoryChildren: (parentId) =>
    api.get('/categories', { params: { parent_id: parentId == null || parentId === '' ? '' : parentId } }),
  getCategoryPath: (id) => api.get(`/categories/${id}/path`),
  getCategoryFilters: (levels) => {
    if (levels && typeof levels === 'object') {
      const params = {}
      if (levels.categoryId) params.category_id = levels.categoryId
      if (levels.subcategoryId) params.subcategory_id = levels.subcategoryId
      if (levels.childCategoryId) params.child_category_id = levels.childCategoryId
      return api.get('/category-filters', { params })
    }
    return api.get('/category-filters', { params: { category_id: levels } })
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
  aiExtract: ({ input_text } = {}) => api.post('/listings/ai-extract', { input_text }),
}

// Optimized “single fan-out” endpoint for reels + liked/saved + chats/unread + price range.
export const feedService = {
  getFeedData: (params) => api.get('/feed-data', { params }),
  getFollowingFeed: (params) => api.get('/feed/following', { params }),
  getTrendingFeed: (params) => api.get('/feed/trending', { params }),
}

// User service
export const userService = {
  getDashboard: () => api.get('/user/dashboard'),
  getSavedProducts: () => api.get('/user/saved'),
  getListings: (params) => api.get('/user/listings', { params }),
  getOrders: (params) => api.get('/user/orders', { params }),
  getWishlist: () => api.get('/user/wishlist'),
  getNotifications: (params) => api.get('/user/notifications', { params }),
  followUser: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.post(`/user/${userId}/follow`)
  },
  getUserProfile: (userId) => {
    if (!isValidObjectId(userId)) return Promise.reject({ response: { status: 400, data: { message: 'Invalid user ID' } } })
    return api.get(`/user/${userId}/profile`)
  },
  getCurrentUserProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  completeBasicProfile: (formData) =>
    api.post('/user/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getFollowers: (userId) => api.get(`/user/${userId}/followers`),
  getFollowing: (userId) => api.get(`/user/${userId}/following`),
  getReelsProgress: () => api.get('/user/reels-progress'),
  saveReelsProgress: (feedKey, index) => api.put('/user/reels-progress', { feedKey, index }),
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
  getUnreadCount: () => api.get('/chats/unread-count'),
  getChatById: (chatId) => api.get(`/chats/${chatId}`),
  createOrGetChat: (productId, sellerId) => api.post('/chats', { productId, sellerId }),
  createSupportChat: () => api.post('/chats', { type: 'support' }),
  sendMessage: (chatId, text) => api.post(`/chats/${chatId}/messages`, { text }),
  markAsRead: (chatId) => api.put(`/chats/${chatId}/read`),
  deleteChat: (chatId) => api.delete(`/chats/${chatId}`),
  deleteMessage: (chatId, messageId) => api.delete(`/chats/${chatId}/messages/${messageId}`),
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
  createAdminCategory: (data) => api.post('/admin/categories', data),
  updateAdminCategory: (id, data) => api.patch(`/admin/categories/${id}`, data),
  deleteAdminCategory: (id) => api.delete(`/admin/categories/${id}`),
  getAllAdminCategories: (params) => api.get('/admin/categories/all', { params }),
  importAdminCategoriesExcel: (formData) =>
    api.post('/admin/categories/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // Filters admin endpoints
  getAdminFilters: (params) => api.get('/admin/filters', { params }),
  getAdminFilterTree: () => api.get('/admin/filters/tree'),
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

export default api