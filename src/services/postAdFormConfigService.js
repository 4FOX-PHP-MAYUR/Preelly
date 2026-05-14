// Reuse existing axios instance from `src/services/api.js`
// NOTE: This assumes you have an endpoint that returns the same JSON shape as:
// `src/config/postAdFormConfig.json` i.e. { categories: [{ id, label, fields: [...] }] }
export const postAdFormConfigService = {
  getPostAdFormConfig: async () => {
    // If your backend uses a different path, update this string.
    // We intentionally route through the same axios baseURL that `categoryService` uses.
    // `categoryService` is defined in api.js; we can reach the axios instance via it indirectly,
    // but easiest is to call categoryService.getRootCategories etc. For now, keep it simple:
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002/api'

    // Dynamic import of axios client to avoid circular deps.
    const { default: axios } = await import('axios')
    const axiosClient = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' }
    })

    // If token exists, match existing interceptor behavior minimally.
    const token = localStorage.getItem('token')
    if (token) axiosClient.defaults.headers.Authorization = `Bearer ${token}`

    // If this endpoint doesn't exist yet, the caller will fall back to local JSON.
    return axiosClient.get('/post-ad-form-config')
  }
}

