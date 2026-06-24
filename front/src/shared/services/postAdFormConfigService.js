// Fetches the dynamic form configuration for a given category.
// POST /api/dynamic-form  →  { categoryId, categoryName, totalSteps, steps: [...] }
export const postAdFormConfigService = {
  getPostAdFormConfig: async (categoryId) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8029/api'

    const { default: axios } = await import('axios')
    const axiosClient = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' },
    })

    const token = localStorage.getItem('token')
    if (token) axiosClient.defaults.headers.Authorization = `Bearer ${token}`

    return axiosClient.post('/v1/web/dynamic-form', { categoryId })
  },
}
