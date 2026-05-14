import React, { useEffect, useState } from 'react'
import { adminService } from '../services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import toast from 'react-hot-toast'

function flattenTree(nodes, depth = 0) {
  const out = []
  for (const node of nodes || []) {
    const indent = depth > 0 ? '│   '.repeat(depth - 1) + '└─ ' : ''
    out.push({ _id: node._id, name: node.name, label: indent + node.name, level: depth })
    if (Array.isArray(node.children) && node.children.length) {
      out.push(...flattenTree(node.children, depth + 1))
    }
  }
  return out
}

function AdminCategoryFiltersPage() {
  const [categories, setCategories] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [filters, setFilters] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedFilterIds, setSelectedFilterIds] = useState([])
  const [loading, setLoading] = useState(false)

  const loadCategoryTree = async () => {
    try {
      const res = await adminService.getAdminCategoryTree()
      const tree = res.data || []
      setCategoryOptions(flattenTree(tree))
    } catch (err) {
      console.error(err)
      setCategoryOptions([])
    }
  }

  const loadCategoriesFlat = async () => {
    try {
      const res = await adminService.getAdminCategories({ limit: 500, page: 1 })
      const data = res.data || {}
      const items = data.categories || data.data || []
      setCategories(items)
    } catch (err) {
      console.error(err)
      setCategories([])
    }
  }

  const loadRootFilters = async () => {
    try {
      const res = await adminService.getAdminFilters({ limit: 500, page: 1 })
      const data = res.data || {}
      const items = data.filters || data.data || []
      const roots = items.filter((f) => !f.parentId)
      setFilters(roots)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load filters')
      setFilters([])
    }
  }

  const loadAssignments = async (categoryId) => {
    if (!categoryId) {
      setSelectedFilterIds([])
      return
    }
    try {
      setLoading(true)
      const res = await adminService.getAdminCategoryFilters(categoryId)
      const data = res.data || res
      const list = Array.isArray(data.filters) ? data.filters : []
      setSelectedFilterIds(list.map((f) => String(f._id)))
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load assignments')
      setSelectedFilterIds([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategoryTree()
    loadCategoriesFlat()
    loadRootFilters()
  }, [])

  const handleCategoryChange = (e) => {
    const id = e.target.value || ''
    setSelectedCategoryId(id)
    loadAssignments(id)
  }

  const toggleFilter = (filterId) => {
    setSelectedFilterIds((prev) => {
      const idStr = String(filterId)
      if (prev.includes(idStr)) {
        return prev.filter((id) => id !== idStr)
      }
      return [...prev, idStr]
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selectedCategoryId) {
      toast.error('Please select a category')
      return
    }
    try {
      setLoading(true)
      await adminService.setAdminCategoryFilters(selectedCategoryId, selectedFilterIds)
      toast.success('Filters assigned to category')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to save assignments')
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find((c) => String(c._id) === String(selectedCategoryId))

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Assign Filters to Category"
        subtitle="Map reusable filters to any category or subcategory"
      />

      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={handleCategoryChange}
              className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a category...</option>
              {categoryOptions.map((opt) => (
                <option key={opt._id} value={opt._id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {selectedCategory.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filters (root level)
            </label>
            <div className="mt-1 max-h-56 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {filters.length === 0 ? (
                <p className="text-xs text-gray-500 px-1 py-2">
                  No filters found. Create filters first.
                </p>
              ) : (
                filters.map((f) => {
                  const checked = selectedFilterIds.includes(String(f._id))
                  return (
                    <label
                      key={f._id}
                      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          onChange={() => toggleFilter(f._id)}
                        />
                        <span>{f.name}</span>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Check one or more filters to assign them to the selected category.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            {selectedCategoryId
              ? `Assigning ${selectedFilterIds.length} filter(s) to this category`
              : 'Select a category to begin assigning filters.'}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AdminCategoryFiltersPage

