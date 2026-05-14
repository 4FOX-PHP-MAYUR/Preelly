import React, { useEffect, useMemo, useRef, useState } from 'react'
import { adminService } from '../services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import DataTable from '../components/AdminUI/DataTable'
import toast from 'react-hot-toast'
import { getMediaUrl } from '../utils/helpers'

function adminLoadErrorMessage(err, fallback) {
  const server = err.response?.data?.message
  if (server) return server
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return 'Network error — check that the API server is running and VITE_API_URL matches it.'
  }
  return err.message || fallback
}

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

/** Options for cascading category dropdown at `depth` (0 = roots). */
function getCategoryOptionsAtLevel(roots, path, depth) {
  if (!roots || !roots.length) return []
  if (depth === 0) return roots
  let cur = roots
  for (let i = 0; i < depth; i++) {
    const id = path[i]
    if (!id) return []
    const node = cur.find((n) => String(n.id) === String(id))
    if (!node) return []
    cur = i === 0 ? node.subcategories || [] : node.children || []
  }
  return cur
}

function AdminFiltersPage() {
  const [filters, setFilters] = useState([])
  const [filterOptions, setFilterOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    parentId: '',
    sortOrder: 0,
    isActive: true,
    colorCode: '',
    thumbFile: null,
    thumbPreview: '',
    clearThumb: false,
  })
  const [search, setSearch] = useState('')
  const LIMIT = 100
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Cascading category path from nested tree API (all levels)
  const [nestedCategoryRoots, setNestedCategoryRoots] = useState([])
  const [categoryPath, setCategoryPath] = useState([])

  const categoryLabelById = useMemo(() => {
    const map = new Map()
    const walk = (nodes, parentNames = []) => {
      ;(nodes || []).forEach((node) => {
        const nodeId = node?.id ?? node?._id
        if (!nodeId) return
        const currentNames = [...parentNames, node.name].filter(Boolean)
        map.set(String(nodeId), currentNames.join(' > '))
        const children = Array.isArray(node.subcategories)
          ? node.subcategories
          : Array.isArray(node.children)
          ? node.children
          : []
        if (children.length) walk(children, currentNames)
      })
    }
    walk(nestedCategoryRoots)
    return map
  }, [nestedCategoryRoots])

  const fileInputRef = useRef(null)

  const fetchNestedCategoryTree = async () => {
    try {
      const res = await adminService.getAdminCategoryNestedForFilters()
      const payload = res.data || {}
      const roots = Array.isArray(payload.categories) ? payload.categories : []
      setNestedCategoryRoots(roots)
    } catch (err) {
      console.error(err)
      setNestedCategoryRoots([])
      toast.error(adminLoadErrorMessage(err, 'Failed to load category tree'), {
        id: 'admin-filters-category-tree',
      })
    }
  }

  const fetchFilterTree = async () => {
    try {
      const res = await adminService.getAdminFilterTree()
      const tree = res.data || []
      setFilterOptions(flattenTree(tree))
    } catch (err) {
      console.error(err)
      setFilterOptions([])
    }
  }

  const fetchFilters = async (p = 1, searchTerm = '', pathOverride = null) => {
    try {
      setLoading(true)
      const path = pathOverride !== null ? pathOverride : categoryPath
      const segs = (path || []).filter(Boolean)
      const params = { limit: LIMIT, page: p }
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim()
      if (segs.length === 1) params.mainCategoryId = segs[0]
      else if (segs.length > 1) params.subCategoryId = segs[segs.length - 1]
      const res = await adminService.getAdminFilters(params)
      const data = res.data || {}
      const items = data.filters || data.data || []
      const totalCount = Number(data.total ?? data.meta?.total ?? items.length)
      setFilters(items)
      setTotal(totalCount)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(adminLoadErrorMessage(err, 'Failed to load filters'), { id: 'admin-filters-list' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilters(1)
    fetchFilterTree()
    fetchNestedCategoryTree()
  }, [])

  const handleCategoryLevelChange = async (depth, value) => {
    const next = categoryPath.slice(0, depth)
    if (value) next[depth] = value
    setCategoryPath(next)
    await fetchFilters(1, search, next)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '',
      parentId: '',
      sortOrder: 0,
      isActive: true,
      colorCode: '',
      thumbFile: null,
      thumbPreview: '',
      clearThumb: false,
    })
    setShowForm(true)
  }

  const handleThumbChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, thumbFile: null, thumbPreview: '', clearThumb: false }))
      return
    }
    const preview = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, thumbFile: file, thumbPreview: preview, clearThumb: false }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload = {
        name: form.name,
        parentId: form.parentId || null,
        sortOrder: Number.isNaN(Number(form.sortOrder)) ? 0 : Number(form.sortOrder),
        isActive: form.isActive !== false,
      }
      const selectedCategoryPath = categoryPath.filter(Boolean)
      const selectedCategoryId = selectedCategoryPath.length
        ? selectedCategoryPath[selectedCategoryPath.length - 1]
        : ''
      if (!editing && selectedCategoryId) {
        payload.categoryId = selectedCategoryPath[0] || selectedCategoryId
        payload.subcategoryId = selectedCategoryPath[1] || selectedCategoryId
        if (selectedCategoryPath.length > 2) {
          payload.childCategoryId = selectedCategoryId
        }
      }
      if (form.colorCode && form.colorCode.trim()) {
        payload.colorCode = form.colorCode.trim()
      }
      if (form.thumbFile) {
        payload.thumbImage = form.thumbFile
      } else if (editing?.thumbImage && form.clearThumb) {
        payload.clearThumb = 'true'
      }

      if (editing) {
        await adminService.updateAdminFilter(editing._id, payload)
        toast.success('Filter updated')
      } else {
        await adminService.createAdminFilter(payload)
        toast.success('Filter created')
      }
      setShowForm(false)
      setEditing(null)
      setForm({
        name: '',
        parentId: '',
        sortOrder: 0,
        isActive: true,
        colorCode: '',
        thumbFile: null,
        thumbPreview: '',
        clearThumb: false,
      })
      await Promise.all([fetchFilters(1, search), fetchFilterTree()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row) => {
    const isActive = row.isActive !== false
    try {
      setLoading(true)
      await adminService.updateAdminFilter(row._id, { isActive: !isActive })
      toast.success(isActive ? 'Filter set to inactive' : 'Filter set to active')
      await fetchFilters(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete filter and its children?')) return
    try {
      setLoading(true)
      await adminService.deleteAdminFilter(row._id)
      toast.success('Deleted')
      setShowForm(false)
      setEditing(null)
      await Promise.all([fetchFilters(page, search), fetchFilterTree()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    // Assign imported filters to the selected Motors -> subcategory.
    const segs = categoryPath.filter(Boolean)
    const assignCategoryId = segs.length ? segs[segs.length - 1] : ''
    if (assignCategoryId) {
      // Keep legacy key and send categories-import-style key for parity.
      formData.append('categoryId', assignCategoryId)
      formData.append('targetCategoryId', assignCategoryId)
    }

    try {
      setImporting(true)
      const res = await adminService.importAdminFiltersExcel(formData)
      const d = res.data || {}
      const summary =
        typeof d.failed === 'number' && d.failed > 0
          ? `${d.message || 'Done'} — ${d.success ?? 0}/${d.total ?? 0} rows, ${d.failed} failed`
          : d.message || 'Filters imported successfully'
      toast.success(summary)
      await Promise.all([fetchFilters(1, search), fetchFilterTree()])
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to import filters'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Filters"
        subtitle="Manage product filters"
        action={
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-60"
            >
              {importing ? 'Importing…' : 'Import Excel'}
            </button>
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Add Filter
            </button>
          </div>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="flex items-center gap-4 flex-col sm:flex-row flex-wrap">
            {Array.from({ length: 12 }).map((_, depth) => {
              const options = getCategoryOptionsAtLevel(nestedCategoryRoots, categoryPath, depth)
              if (depth > 0 && !categoryPath[depth - 1]) return null
              if (depth > 0 && options.length === 0) return null
              const label =
                depth === 0
                  ? 'Category (root)'
                  : `Subcategory (level ${depth + 1})`
              return (
                <select
                  key={depth}
                  value={categoryPath[depth] || ''}
                  onChange={(e) => handleCategoryLevelChange(depth, e.target.value)}
                  disabled={importing}
                  className="h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 disabled:opacity-60 min-w-[200px]"
                  aria-label={label}
                >
                  <option value="">
                    {depth === 0 ? 'All categories' : `Select ${label.toLowerCase()}…`}
                  </option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )
            })}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); fetchFilters(1, search) }} className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filters..."
              className="h-10 w-full max-w-sm border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  fetchFilters(1, search)
                }
              }}
              aria-label="Search filters"
            />

            <button
              type="button"
              onClick={() => fetchFilters(1, search)}
              className="h-10 px-4 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={loading || importing}
            >
              Search
            </button>

            {search && (
              <button
                type="button"
                onClick={() => fetchFilters(1, '')}
                className="h-10 px-3 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={loading || importing}
              >
                Clear search
              </button>
            )}

            {categoryPath.some(Boolean) && (
              <button
                type="button"
                onClick={async () => {
                  setCategoryPath([])
                  await fetchFilters(1, search, [])
                }}
                className="h-10 px-3 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={loading || importing}
              >
                Clear categories
              </button>
            )}
          </form>
        </div>
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{filters.length}</span> of{' '}
          <span className="font-medium">{total}</span> filters
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Filter' : 'Add Filter'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Filter name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Parent Filter</label>
              <select
                value={form.parentId || ''}
                onChange={(e) => setForm({ ...form, parentId: e.target.value || '' })}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">(No parent)</option>
                {filterOptions
                  .filter((opt) => !editing || String(opt._id) !== String(editing._id))
                  .map((opt) => (
                    <option key={opt._id} value={opt._id}>
                      {opt.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sortOrder: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                min={0}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color Code</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.colorCode || '#ffffff'}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  className="w-10 h-10 border border-gray-200 rounded"
                />
                <input
                  type="text"
                  value={form.colorCode}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  placeholder="#RRGGBB"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Thumb Image</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbChange}
                  className="text-xs"
                />
                {(form.thumbPreview || editing?.thumbImage) && !form.clearThumb && (
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        form.thumbPreview ||
                        getMediaUrl(editing.thumbImage) ||
                        editing.thumbImage
                      }
                      alt="Thumb"
                      className="h-10 w-10 rounded object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          thumbFile: null,
                          thumbPreview: '',
                          clearThumb: true,
                        }))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-4 flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                    setForm({
                      name: '',
                      parentId: '',
                    sortOrder: 0,
                      isActive: true,
                      colorCode: '',
                      thumbFile: null,
                      thumbPreview: '',
                      clearThumb: false,
                    })
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'name',
            title: 'Name',
            render: (r) => {
              const level =
                typeof r.level === 'number'
                  ? r.level
                  : Array.isArray(r.path)
                  ? r.path.length
                  : 0
              const indent =
                level > 0 ? '│   '.repeat(Math.max(0, level - 1)) + '└─ ' : ''
              // In the filters listing, the admin selected category level is the
              // correct context for the second-line label (especially when a
              // single filter document can be linked to multiple categories).
              const selectedLevelId = (categoryPath || []).filter(Boolean).slice(-1)[0] || ''
              const categoryLabel = selectedLevelId
                ? categoryLabelById.get(String(selectedLevelId)) || ''
                : ''
              return (
                <div className="leading-tight">
                  <span className="font-medium text-gray-900 whitespace-pre block">
                    <span className="text-gray-400">{indent}</span>
                    {r.name}
                  </span>
                  {categoryLabel && (
                    <span className="mt-1 block text-xs text-gray-500">{categoryLabel}</span>
                  )}
                </div>
              )
            },
          },
          {
            key: 'parent',
            title: 'Parent',
            render: (r) => {
              const p = filterOptions.find((c) => String(c._id) === String(r.parentId))
              return p ? p.name : 'Root'
            },
          },
          {
            key: 'sortOrder',
            title: 'Sort Order',
            render: (r) => (
              <span className="text-xs text-gray-700">
                {typeof r.sortOrder === 'number' ? r.sortOrder : ''}
              </span>
            ),
          },
          {
            key: 'thumb',
            title: 'Thumb',
            render: (r) => {
              if (!r.thumbImage) return null
              const src = getMediaUrl(r.thumbImage) || r.thumbImage
              return (
                <img
                  src={src}
                  alt={r.name}
                  className="h-8 w-8 rounded object-cover border border-gray-200"
                />
              )
            },
          },
          {
            key: 'color',
            title: 'Color',
            render: (r) => {
              if (!r.colorCode) return null
              return (
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: r.colorCode }}
                  />
                  <span className="text-xs text-gray-600">{r.colorCode}</span>
                </div>
              )
            },
          },
          {
            key: 'status',
            title: 'Status',
            render: (r) => {
              const isActive = r.isActive !== false
              return (
                <button
                  type="button"
                  onClick={() => handleToggleStatus(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </button>
              )
            },
          },
        ]}
        data={filters}
        loading={loading}
        serverSide
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchFilters(p, search),
        }}
        onEdit={(r) => {
          setEditing(r)
          setForm({
            name: r.name || '',
            parentId: r.parentId || '',
            sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
            isActive: r.isActive !== false,
            colorCode: r.colorCode || '',
            thumbFile: null,
            thumbPreview: '',
            clearThumb: false,
          })
          setShowForm(true)
        }}
        onDelete={(r) => handleDelete(r)}
      />
    </div>
  )
}

export default AdminFiltersPage

