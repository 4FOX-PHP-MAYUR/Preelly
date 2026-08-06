import axios from 'axios'
import { API_URL } from '../config/env'
import { getRouteAbortSignal } from './apiScope'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Admin Panel auth is completely independent of the marketplace app's
// `token`/`user`/`permissions` localStorage keys — a dedicated key means an
// admin and a customer session can coexist in the same browser without
// clobbering each other, even though both apps may share an origin.
export const ADMIN_TOKEN_STORAGE_KEY = 'admin_token'

// Add token to requests (skip when retrying with cookie-only after 401)
api.interceptors.request.use((config) => {
  // Layout/auth calls survive route changes; page-scoped calls are cancelled on navigate.
  if (!config.signal && !config.persistAcrossRoutes) {
    config.signal = getRouteAbortSignal()
  }
  if (!config.__skipBearer) {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
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

// Drop only a stale Bearer from localStorage — never auto-logout from incidental 401s.
function stripStaleBearerToken() {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const config = error.config
    const url = String(config?.url || '')
    const isAuthRoute =
      url.includes('/admin/auth/login') ||
      url.includes('/admin/auth/logout')

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

// Admin Panel authentication — completely independent of the marketplace
// OTP/`users`-collection login flow. Email + password against admin_users.
export const adminAuthService = {
  login: (data) => api.post('/admin/auth/login', data),
  logout: () => api.post('/admin/auth/logout'),
  me: () => api.get('/admin/auth/me'),
  changePassword: (data) => api.patch('/admin/auth/change-password', data),
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
  /** Property category tree (parents + nested subcategories). */
  getPropertyCategories: (config) => api.get('/v1/web/categories/property-categories', config),
  /** Classifieds category tree (parents + nested subcategories). */
  getClassifiedCategories: (config) => api.get('/v1/classifieds/categories', config),
}

// Packages (public web API — `packages` collection)
export const packageService = {
  listActivePackages: (config) => api.get('/v1/web/packages', config),
  getPackageById: (id, config) => api.get(`/v1/web/packages/${id}`, config),
  // Attaches the chosen package to a submitted listing (payment still pending).
  selectPackageForProduct: (productId, packageId) =>
    api.put(`/products/${productId}/package`, { packageId }),
}

// Storage facility durations (public web API — `storagefacilities` collection)
export const storageFacilityService = {
  listActiveStorageFacilities: (config) => api.get('/v1/web/storage-facilities', config),
}

// Testimonials (public web API — `testimonials` collection)
export const testimonialService = {
  listActiveTestimonials: (config) => api.get('/v1/web/testimonials', config),
}

/**
 * Storage facilities are sent as multipart so the icon can ride along.
 * `imageIcon` is a File when replacing the icon; everything else is coerced to a
 * string by FormData, which the API's validators and service already expect.
 */
function toStorageFacilityFormData(data = {}) {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'imageIcon') {
      if (value instanceof File) formData.append('imageIcon', value)
      return
    }
    formData.append(key, value)
  })
  return formData
}

/**
 * Testimonials are sent as multipart so the profile image can ride along.
 * `profileImage` is a File when replacing the image; everything else is coerced to a
 * string by FormData, which the API's validators and service already expect.
 */
function toTestimonialFormData(data = {}) {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'profileImage') {
      if (value instanceof File) formData.append('profileImage', value)
      return
    }
    formData.append(key, value)
  })
  return formData
}

/**
 * Pages are sent as multipart so the banner image can ride along.
 * `pageBannerImage` is a File when replacing the banner; everything else is coerced
 * to a string by FormData, which the API's validators and service already expect.
 */
function toPageFormData(data = {}) {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'pageBannerImage') {
      if (value instanceof File) formData.append('pageBannerImage', value)
      return
    }
    formData.append(key, value)
  })
  return formData
}

/**
 * Admin Users are sent as multipart so the profile image can ride along.
 * `profileImage` is a File when adding/replacing the photo; everything else is
 * coerced to a string by FormData, which the API's admin-users route expects.
 */
function toAdminUserFormData(data = {}) {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'profileImage') {
      if (value instanceof File) formData.append('profileImage', value)
      return
    }
    formData.append(key, value)
  })
  return formData
}

/**
 * Admin Dashboard service.
 *
 * Every read takes the same filter params (`range`, `fromDate`, `toDate`,
 * `category`, `packageId`, `paymentStatus`, `productStatus`, `userType`,
 * `platform`) so cards, charts and tables always describe one window.
 */
export const dashboardService = {
  getSummary: (params) => api.get('/admin/dashboard/summary', { params }),
  getCharts: (params) => api.get('/admin/dashboard/charts', { params }),
  getInsights: (params) => api.get('/admin/dashboard/insights', { params }),
  getFilterOptions: () => api.get('/admin/dashboard/filters'),
  getPerformance: () => api.get('/admin/dashboard/performance'),
  getTable: (table, params) => api.get(`/admin/dashboard/tables/${table}`, { params }),
  getReports: () => api.get('/admin/dashboard/reports'),
  downloadReport: (type, params) =>
    api.get(`/admin/dashboard/reports/${type}/download`, { params, responseType: 'blob' }),
}

// Admin service
export const adminService = {
  getPendingProducts: (params) => api.get('/admin/products/pending', { params }),
  getAllProducts: (params) => api.get('/admin/products', { params }),
  exportProducts: (params) => api.get('/admin/products/export', { params, responseType: 'blob' }),
  approveProduct: (productId) => api.put(`/admin/products/${productId}/approve`),
  rejectProduct: (productId, payload) => api.put(`/admin/products/${productId}/reject`, payload),
  getProductRejectionReasons: () => api.get('/admin/products/rejection-reasons'),
   setProductStatus: (productId, status) => api.put(`/admin/products/${productId}/status`, { status }),
  setProductFeatured: (productId, isFeature) => api.put(`/admin/products/${productId}/feature`, { isFeature }),
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  exportUsers: (params) => api.get('/admin/users/export', { params, responseType: 'blob' }),
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
  // User Reports (reports collection grouped by reported user)
  getUserReports: (params) => api.get('/admin/user-reports', { params }),
  getUserReportByUserId: (userId) => api.get(`/admin/user-reports/${userId}`),
  getUserReportStats: () => api.get('/admin/user-reports/stats'),
  getMostReportedUsers: (params) => api.get('/admin/user-reports/most-reported', { params }),
  getUserReportReasons: () => api.get('/admin/user-reports/reasons'),
  resolveUserReport: (userId, payload) => api.put(`/admin/user-reports/${userId}/action`, payload),
  // Category admin endpoints
  getAdminCategories: (params) => api.get('/admin/categories', { params }),
  getAdminCategoryChildren: (params) => api.get('/admin/categories/children', { params }),
  /** Nested category tree for cascading dropdowns (all levels). */
  getAdminCategoryNestedForFilters: () => api.get('/admin/categories/nested-for-filters'),
  getAdminCategoryTree: () => api.get('/admin/categories/tree'),
  createAdminCategory: (data) => {
    const hasFile = data?.category_image instanceof File || data?.categoryImage instanceof File
    if (!hasFile) return api.post('/admin/categories', data)
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if ((key === 'category_image' || key === 'categoryImage') && value instanceof File) {
        formData.append(key, value)
      } else if (value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/admin/categories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  updateAdminCategory: (id, data) => {
    const hasFile = data?.category_image instanceof File || data?.categoryImage instanceof File
    if (!hasFile) {
      const { category_image, categoryImage, ...rest } = data || {}
      return api.patch(`/admin/categories/${id}`, rest)
    }
    const formData = new FormData()
    Object.keys(data || {}).forEach((key) => {
      const value = data[key]
      if (value === undefined || value === null) return
      if ((key === 'category_image' || key === 'categoryImage') && value instanceof File) {
        formData.append(key, value)
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
  // Emirates (Cities) admin endpoints
  getEmirates: (params) => api.get('/admin/emirates', { params }),
  getEmirateById: (id) => api.get(`/admin/emirates/${id}`),
  createEmirate: (data) => api.post('/admin/emirates', data),
  updateEmirate: (id, data) => api.patch(`/admin/emirates/${id}`, data),
  setEmirateStatus: (id, status) => api.put(`/admin/emirates/${id}/status`, { status }),
  deleteEmirate: (id) => api.delete(`/admin/emirates/${id}`),
  // Packages admin endpoints
  getPackages: (params) => api.get('/admin/packages', { params }),
  getPackageById: (id) => api.get(`/admin/packages/${id}`),
  createPackage: (data) => api.post('/admin/packages', data),
  updatePackage: (id, data) => api.patch(`/admin/packages/${id}`, data),
  setPackageStatus: (id, status) => api.put(`/admin/packages/${id}/status`, { status }),
  deletePackage: (id) => api.delete(`/admin/packages/${id}`),
  // Storage Facilities admin endpoints (multipart — optional icon upload)
  getStorageFacilities: (params) => api.get('/admin/storage-facilities', { params }),
  getStorageFacilityById: (id) => api.get(`/admin/storage-facilities/${id}`),
  createStorageFacility: (data) =>
    api.post('/admin/storage-facilities', toStorageFacilityFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateStorageFacility: (id, data) =>
    api.patch(`/admin/storage-facilities/${id}`, toStorageFacilityFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  setStorageFacilityStatus: (id, status) =>
    api.put(`/admin/storage-facilities/${id}/status`, { status }),
  deleteStorageFacility: (id) => api.delete(`/admin/storage-facilities/${id}`),
  // Testimonials admin endpoints (multipart — optional profile image upload)
  getTestimonials: (params) => api.get('/admin/testimonials', { params }),
  getTestimonialById: (id) => api.get(`/admin/testimonials/${id}`),
  createTestimonial: (data) =>
    api.post('/admin/testimonials', toTestimonialFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateTestimonial: (id, data) =>
    api.patch(`/admin/testimonials/${id}`, toTestimonialFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  setTestimonialStatus: (id, status) =>
    api.put(`/admin/testimonials/${id}/status`, { status }),
  deleteTestimonial: (id) => api.delete(`/admin/testimonials/${id}`),
  exportTestimonials: (params) =>
    api.get('/admin/testimonials/export', { params, responseType: 'blob' }),
  // Pages admin endpoints (multipart — optional banner image upload)
  getPages: (params) => api.get('/admin/pages', { params }),
  getPageById: (id) => api.get(`/admin/pages/${id}`),
  createPage: (data) =>
    api.post('/admin/pages', toPageFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updatePage: (id, data) =>
    api.patch(`/admin/pages/${id}`, toPageFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  setPageStatus: (id, status) => api.put(`/admin/pages/${id}/status`, { status }),
  deletePage: (id) => api.delete(`/admin/pages/${id}`),
  exportPages: (params) => api.get('/admin/pages/export', { params, responseType: 'blob' }),
  // Checkout Service endpoints (JSON; highlights ride along as an array)
  getCheckoutServices: (params) => api.get('/admin/checkout-services', { params }),
  getCheckoutServiceById: (id) => api.get(`/admin/checkout-services/${id}`),
  createCheckoutService: (data) => api.post('/admin/checkout-services', data),
  updateCheckoutService: (id, data) => api.patch(`/admin/checkout-services/${id}`, data),
  setCheckoutServiceStatus: (id, status) =>
    api.put(`/admin/checkout-services/${id}/status`, { status }),
  deleteCheckoutService: (id) => api.delete(`/admin/checkout-services/${id}`),
  // Transactions (PaymentTransaction admin module)
  getTransactions: (params) => api.get('/admin/transactions', { params }),
  getTransactionById: (id) => api.get(`/admin/transactions/${id}`),
  getTransactionStats: (params) => api.get('/admin/transactions/stats', { params }),
  exportTransactions: (params) =>
    api.get('/admin/transactions/export', { params, responseType: 'blob' }),
  // Cart (Marketplace admin module; reads the existing carts collection)
  getCartItems: (params) => api.get('/admin/cart', { params }),
  getPendingCartItems: (params) => api.get('/admin/cart/pending', { params }),
  getPurchasedCartItems: (params) => api.get('/admin/cart/purchased', { params }),
  getCartItemById: (id) => api.get(`/admin/cart/${id}`),
  exportCartItems: (params) =>
    api.get('/admin/cart/export', { params, responseType: 'blob' }),
  // Coupon endpoints (mounted at /api/coupon)
  getCoupons: (params) => api.get('/coupon/list', { params }),
  getCouponById: (id) => api.get(`/coupon/${id}`),
  createCoupon: (data) => api.post('/coupon/create', data),
  updateCoupon: (id, data) => api.put(`/coupon/update/${id}`, data),
  setCouponStatus: (id, status) => api.patch(`/coupon/status/${id}`, { status }),
  deleteCoupon: (id) => api.delete(`/coupon/${id}`),
  generateCouponCode: () => api.get('/coupon/generate-code'),
  // Buyer Coupons (checkout-service-only coupons; mounted at /api/buyer-coupon)
  getBuyerCoupons: (params) => api.get('/buyer-coupon/list', { params }),
  getBuyerCouponById: (id) => api.get(`/buyer-coupon/${id}`),
  createBuyerCoupon: (data) => api.post('/buyer-coupon/create', data),
  updateBuyerCoupon: (id, data) => api.put(`/buyer-coupon/update/${id}`, data),
  setBuyerCouponStatus: (id, status) => api.patch(`/buyer-coupon/status/${id}`, { status }),
  deleteBuyerCoupon: (id) => api.delete(`/buyer-coupon/${id}`),
  // Admin Roles endpoints
  getRoles: (params) => api.get('/admin/roles', { params }),
  getRoleById: (id) => api.get(`/admin/roles/${id}`),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.patch(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
  getRolePermissions: (id) => api.get(`/admin/roles/${id}/permissions`),
  saveRolePermissions: (id, permissions) => api.put(`/admin/roles/${id}/permissions`, { permissions }),
  getModules: () => api.get('/admin/modules'),
  exportRoles: (params) => api.get('/admin/roles/export', { params, responseType: 'blob' }),
  // Assign Users endpoints (admin_role_assignments — mapping layer between Admin Users and Admin Roles)
  getRoleAssignments: (params) => api.get('/admin/role-assignments', { params }),
  getRoleAssignmentById: (id) => api.get(`/admin/role-assignments/${id}`),
  createRoleAssignment: (data) => api.post('/admin/role-assignments', data),
  updateRoleAssignment: (id, data) => api.patch(`/admin/role-assignments/${id}`, data),
  deleteRoleAssignment: (id) => api.delete(`/admin/role-assignments/${id}`),
  exportRoleAssignments: (params) => api.get('/admin/role-assignments/export', { params, responseType: 'blob' }),
  // Admin Users endpoints (dedicated module — separate from the marketplace Users module)
  getAdminUsers: (params) => api.get('/admin/admin-users', { params }),
  getAdminUserById: (id) => api.get(`/admin/admin-users/${id}`),
  createAdminUser: (data) => api.post('/admin/admin-users', toAdminUserFormData(data)),
  updateAdminUser: (id, data) => api.patch(`/admin/admin-users/${id}`, toAdminUserFormData(data)),
  deleteAdminUser: (id) => api.delete(`/admin/admin-users/${id}`),
  exportAdminUsers: (params) => api.get('/admin/admin-users/export', { params, responseType: 'blob' }),
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
  getFormFieldOptionTables: () => api.get('/admin/form-fields/option-tables'),
  getFormFieldById: (id) => api.get(`/admin/form-fields/${id}`),
  createFormField: (data) => api.post('/admin/form-fields', data),
  updateFormField: (id, data) => api.patch(`/admin/form-fields/${id}`, data),
  deleteFormField: (id) => api.delete(`/admin/form-fields/${id}`),
}

export default api
