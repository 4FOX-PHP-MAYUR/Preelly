import React, { useEffect, useMemo, useRef, useState } from 'react'
import { adminService } from '../services/api'
import toast from 'react-hot-toast'
import { getMediaUrl } from '../utils/helpers'
import {
  ChevronRight,
  Filter,
  FolderOpen,
  Upload,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  Tag,
  Layers,
  AlertCircle,
} from 'lucide-react'

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

// Build a flat list of groups (root filters) with their children for display
function groupFilters(filters) {
  const byId = new Map()
  filters.forEach((f) => byId.set(String(f._id), { ...f, children: [] }))
  const roots = []
  filters.forEach((f) => {
    const node = byId.get(String(f._id))
    if (f.parentId && byId.has(String(f.parentId))) {
      byId.get(String(f.parentId)).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

const LEVEL_LABELS = ['Category', 'Sub-category', 'Type', 'Sub-type']
const getLevelLabel = (depth) => LEVEL_LABELS[depth] || `Level ${depth + 1}`

function CategoryBreadcrumb({ roots, path, labelById }) {
  if (!path.filter(Boolean).length) return null
  const crumbs = path.filter(Boolean).map((id) => labelById.get(String(id))?.split(' > ').pop() || id)
  return (
    <div className="flex items-center gap-1 flex-wrap text-sm">
      <span className="text-gray-400">Showing filters for:</span>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          <span
            className={
              i === crumbs.length - 1
                ? 'font-semibold text-indigo-700'
                : 'text-gray-600'
            }
          >
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

function CategoryPathBadge({ filter, labelById }) {
  // Resolve the most-specific category label available on the filter document
  const scopeId =
    filter.childCategoryId
      ? String(filter.childCategoryId)
      : filter.subcategoryId
      ? String(filter.subcategoryId)
      : filter.categoryId
      ? String(filter.categoryId)
      : null

  const fullLabel = scopeId ? labelById.get(scopeId) : null
  if (!fullLabel) return null

  // Split "Motors > New Cars" into individual crumbs
  const crumbs = fullLabel.split(' > ')

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              i === 0
                ? 'bg-violet-50 text-violet-700 border border-violet-100'
                : i === crumbs.length - 1
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                : 'bg-blue-50 text-blue-700 border border-blue-100'
            }`}
          >
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

function FilterGroupRow({ group, filterOptions, onEdit, onDelete, onToggleStatus, categoryLabelById }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = group.children && group.children.length > 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      {/* Group header (root filter) */}
      <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Expand/collapse */}
        <div className="mt-0.5 shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
              />
            </button>
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* Icon */}
        <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
          <Tag className="h-3.5 w-3.5 text-indigo-600" />
        </div>

        {/* Name + category path */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{group.name}</span>
            {hasChildren ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                {group.children.length} {group.children.length === 1 ? 'value' : 'values'}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs">
                No values
              </span>
            )}
          </div>
          {/* Category breadcrumb badges */}
          <CategoryPathBadge filter={group} labelById={categoryLabelById} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => onToggleStatus(group)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              group.isActive !== false
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            {group.isActive !== false ? 'Active' : 'Inactive'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(group)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(group)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children (filter values) */}
      {hasChildren && expanded && (
        <div className="divide-y divide-gray-100">
          {group.children.map((child) => (
            <div key={child._id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition">
              <div className="w-4 shrink-0" />
              <div className="w-4 shrink-0 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              </div>
              <span className="flex-1 text-sm text-gray-700 truncate">{child.name}</span>
              {child.colorCode && (
                <div
                  className="h-4 w-4 rounded border border-gray-300 shrink-0"
                  style={{ backgroundColor: child.colorCode }}
                  title={child.colorCode}
                />
              )}
              {child.thumbImage && (
                <img
                  src={getMediaUrl(child.thumbImage) || child.thumbImage}
                  alt={child.name}
                  className="h-6 w-6 rounded object-cover border border-gray-200 shrink-0"
                />
              )}
              <button
                type="button"
                onClick={() => onToggleStatus(child)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                  child.isActive !== false
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                {child.isActive !== false ? 'Active' : 'Inactive'}
              </button>
              <button
                type="button"
                onClick={() => onEdit(child)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(child)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
  const [searchInput, setSearchInput] = useState('')
  const LIMIT = 200
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [nestedCategoryRoots, setNestedCategoryRoots] = useState([])
  const [categoryPath, setCategoryPath] = useState([])

  const [formCategoryPath, setFormCategoryPath] = useState([])
  const [formFilterOptions, setFormFilterOptions] = useState([])

  const fileInputRef = useRef(null)

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

  const selectedCategoryLabel = useMemo(() => {
    const segs = categoryPath.filter(Boolean)
    if (!segs.length) return ''
    return categoryLabelById.get(segs[segs.length - 1]) || ''
  }, [categoryPath, categoryLabelById])

  const filterGroups = useMemo(() => groupFilters(filters), [filters])

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return filterGroups
    const q = search.trim().toLowerCase()
    return filterGroups
      .map((g) => {
        const matchParent = g.name.toLowerCase().includes(q)
        const matchedChildren = (g.children || []).filter((c) => c.name.toLowerCase().includes(q))
        if (matchParent || matchedChildren.length) {
          return { ...g, children: matchParent ? g.children : matchedChildren }
        }
        return null
      })
      .filter(Boolean)
  }, [filterGroups, search])

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

  const fetchFormFilterTree = async (path) => {
    try {
      const segs = (path || []).filter(Boolean)
      const params = {}
      if (segs.length === 1) params.mainCategoryId = segs[0]
      else if (segs.length > 1) params.subCategoryId = segs[segs.length - 1]
      const res = await adminService.getAdminFilterTree(params)
      const tree = res.data || []
      setFormFilterOptions(flattenTree(tree))
    } catch (err) {
      console.error(err)
      setFormFilterOptions([])
    }
  }

  const fetchFilterTree = async (pathOverride = null) => {
    try {
      const path = pathOverride !== null ? pathOverride : categoryPath
      const segs = (path || []).filter(Boolean)
      const params = {}
      if (segs.length === 1) params.mainCategoryId = segs[0]
      else if (segs.length > 1) params.subCategoryId = segs[segs.length - 1]
      const res = await adminService.getAdminFilterTree(params)
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
    setSearch('')
    setSearchInput('')
    await Promise.all([fetchFilters(1, '', next), fetchFilterTree(next)])
  }

  const clearCategory = async () => {
    setCategoryPath([])
    setSearch('')
    setSearchInput('')
    await Promise.all([fetchFilters(1, '', []), fetchFilterTree([])])
  }

  const openAdd = () => {
    setEditing(null)
    const initialPath = categoryPath.filter(Boolean)
    setFormCategoryPath(initialPath)
    fetchFormFilterTree(initialPath)
    setForm({ name: '', parentId: '', sortOrder: 0, isActive: true, colorCode: '', thumbFile: null, thumbPreview: '', clearThumb: false })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', parentId: '', sortOrder: 0, isActive: true, colorCode: '', thumbFile: null, thumbPreview: '', clearThumb: false })
    setFormCategoryPath([])
    setFormFilterOptions([])
  }

  const handleThumbChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) { setForm((p) => ({ ...p, thumbFile: null, thumbPreview: '', clearThumb: false })); return }
    setForm((p) => ({ ...p, thumbFile: file, thumbPreview: URL.createObjectURL(file), clearThumb: false }))
  }

  const handleFormCategoryChange = async (depth, value) => {
    const next = formCategoryPath.slice(0, depth)
    if (value) next[depth] = value
    setFormCategoryPath(next)
    setForm((p) => ({ ...p, parentId: '' }))
    await fetchFormFilterTree(next)
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
      const segs = formCategoryPath.filter(Boolean)
      const deepestId = segs.length ? segs[segs.length - 1] : ''
      if (deepestId) {
        if (segs.length >= 3) payload.childCategoryId = deepestId
        else if (segs.length === 2) payload.subcategoryId = deepestId
        else payload.categoryId = deepestId
      }
      if (form.colorCode?.trim()) payload.colorCode = form.colorCode.trim()
      if (form.thumbFile) payload.thumbImage = form.thumbFile
      else if (editing?.thumbImage && form.clearThumb) payload.clearThumb = 'true'

      if (editing) {
        await adminService.updateAdminFilter(editing._id, payload)
        toast.success('Filter updated')
      } else {
        await adminService.createAdminFilter(payload)
        toast.success('Filter created')
      }
      closeForm()
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
      await adminService.updateAdminFilter(row._id, { isActive: !isActive })
      toast.success(isActive ? 'Set inactive' : 'Set active')
      await fetchFilters(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete "${row.name}" and all its child values?`)) return
    try {
      await adminService.deleteAdminFilter(row._id)
      toast.success('Deleted')
      if (editing?._id === row._id) closeForm()
      await Promise.all([fetchFilters(page, search), fetchFilterTree()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    }
  }

  const handleEdit = (row) => {
    setEditing(row)
    const editPath = []
    if (row.categoryId) editPath.push(String(row.categoryId))
    if (row.subcategoryId) editPath.push(String(row.subcategoryId))
    if (row.childCategoryId) editPath.push(String(row.childCategoryId))
    setFormCategoryPath(editPath)
    fetchFormFilterTree(editPath)
    setForm({
      name: row.name || '',
      parentId: row.parentId || '',
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
      isActive: row.isActive !== false,
      colorCode: row.colorCode || '',
      thumbFile: null,
      thumbPreview: '',
      clearThumb: false,
    })
    setShowForm(true)
  }

  const handleImportClick = () => {
    if (!categoryPath.filter(Boolean).length) {
      toast.error('Please select a category before importing', { id: 'import-no-cat' })
      return
    }
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click() }
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const segs = categoryPath.filter(Boolean)
    const assignCategoryId = segs.length ? segs[segs.length - 1] : ''
    if (assignCategoryId) {
      formData.append('categoryId', assignCategoryId)
      formData.append('targetCategoryId', assignCategoryId)
    }
    try {
      setImporting(true)
      const res = await adminService.importAdminFiltersExcel(formData)
      const d = res.data || {}
      const summary = typeof d.failed === 'number' && d.failed > 0
        ? `${d.message || 'Done'} — ${d.success ?? 0}/${d.total ?? 0} rows, ${d.failed} failed`
        : d.message || 'Filters imported successfully'
      toast.success(summary)
      await Promise.all([fetchFilters(1, search), fetchFilterTree()])
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to import filters')
    } finally {
      setImporting(false)
    }
  }

  const hasCategory = categoryPath.filter(Boolean).length > 0
  const totalGroups = filterGroups.length
  const totalValues = filterGroups.reduce((n, g) => n + (g.children?.length || 0), 0)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} className="hidden" onChange={handleImportFileChange} />

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-600" />
            Filters
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Select a category first, then manage its filters and values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            title={!hasCategory ? 'Select a category first' : 'Import Excel (Types | Filters | Properties)'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${
              hasCategory
                ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'border-gray-100 text-gray-400 cursor-not-allowed'
            } disabled:opacity-60`}
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition"
          >
            <Plus className="h-4 w-4" />
            Add Filter
          </button>
        </div>
      </div>

      {/* ── Category Selector Card ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Step 1 — Select Category
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: 6 }).map((_, depth) => {
            const options = getCategoryOptionsAtLevel(nestedCategoryRoots, categoryPath, depth)
            if (depth > 0 && !categoryPath[depth - 1]) return null
            if (depth > 0 && options.length === 0) return null
            const isSelected = !!categoryPath[depth]
            return (
              <React.Fragment key={depth}>
                {depth > 0 && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
                <div className="relative">
                  <select
                    value={categoryPath[depth] || ''}
                    onChange={(e) => handleCategoryLevelChange(depth, e.target.value)}
                    disabled={importing || loading}
                    className={`h-9 pl-3 pr-8 text-sm rounded-lg border transition appearance-none cursor-pointer disabled:opacity-60 ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                        : 'border-gray-200 bg-white text-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-300`}
                  >
                    <option value="">{getLevelLabel(depth)}{depth === 0 ? ' (All)' : '…'}</option>
                    {options.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                </div>
              </React.Fragment>
            )
          })}
          {hasCategory && (
            <button
              type="button"
              onClick={clearCategory}
              className="flex items-center gap-1 h-9 px-3 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Selected path breadcrumb */}
        {hasCategory && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <CategoryBreadcrumb roots={nestedCategoryRoots} path={categoryPath} labelById={categoryLabelById} />
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span><span className="font-semibold text-gray-800">{totalGroups}</span> filter groups</span>
              <span className="text-gray-300">|</span>
              <span><span className="font-semibold text-gray-800">{totalValues}</span> values</span>
              <span className="text-gray-300">|</span>
              <span><span className="font-semibold text-gray-800">{total}</span> total</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Hint when no category selected (soft, not alarming) ── */}
      {!hasCategory && !loading && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Showing all {total} filters across every category. Select a category above to narrow the view.
        </p>
      )}

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-200">
            <div>
              <h2 className="text-sm font-semibold text-indigo-900">
                {editing ? `Edit: ${editing.name}` : 'Add New Filter'}
              </h2>
              {formCategoryPath.filter(Boolean).length > 0 ? (
                <p className="text-xs text-indigo-600 mt-0.5">
                  {editing ? 'Category: ' : 'Will be added to: '}
                  <span className="font-medium">{categoryLabelById.get(formCategoryPath.filter(Boolean).at(-1)) || ''}</span>
                </p>
              ) : !editing ? (
                <p className="text-xs text-amber-600 mt-0.5">
                  No category selected — filter won't be scoped to any category
                </p>
              ) : null}
            </div>
            <button type="button" onClick={closeForm} className="text-indigo-400 hover:text-indigo-600 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5">
            {/* Category assignment — cascading dropdowns */}
            <div className="mb-5 pb-5 border-b border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                Assign to Category
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, depth) => {
                  const opts = getCategoryOptionsAtLevel(nestedCategoryRoots, formCategoryPath, depth)
                  if (depth > 0 && !formCategoryPath[depth - 1]) return null
                  if (depth > 0 && opts.length === 0) return null
                  const isSelected = !!formCategoryPath[depth]
                  return (
                    <React.Fragment key={depth}>
                      {depth > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                      <div className="relative">
                        <select
                          value={formCategoryPath[depth] || ''}
                          onChange={(e) => handleFormCategoryChange(depth, e.target.value)}
                          className={`h-8 pl-3 pr-8 text-xs rounded-lg border transition appearance-none cursor-pointer ${
                            isSelected
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                              : 'border-gray-200 bg-white text-gray-700'
                          } focus:outline-none focus:ring-2 focus:ring-indigo-300`}
                        >
                          <option value="">{getLevelLabel(depth)}{depth === 0 ? ' (optional)' : '…'}</option>
                          {opts.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      </div>
                    </React.Fragment>
                  )
                })}
                {formCategoryPath.filter(Boolean).length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setFormCategoryPath([]); fetchFormFilterTree([]) }}
                    className="flex items-center gap-1 h-8 px-2.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Name */}
              <div className="lg:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Filter Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="e.g. Regional Specs"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                />
                <p className="text-xs text-gray-400 mt-1">This is the filter group name</p>
              </div>

              {/* Parent */}
              <div className="lg:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Parent Filter
                </label>
                {formCategoryPath.filter(Boolean).length === 0 ? (
                  <div className="w-full border border-dashed border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 cursor-not-allowed">
                    Select a category first
                  </div>
                ) : (
                  <select
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value || '' })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                  >
                    <option value="">(Root — no parent)</option>
                    {formFilterOptions
                      .filter((opt) => !editing || String(opt._id) !== String(editing._id))
                      .map((opt) => (
                        <option key={opt._id} value={opt._id}>{opt.label}</option>
                      ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">Leave empty for a top-level filter group</p>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value === '' ? '' : Number(e.target.value) })}
                  min={0}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Color (optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.colorCode || '#ffffff'}
                    onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                    className="h-9 w-10 border border-gray-200 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.colorCode}
                    onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                    placeholder="#RRGGBB"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            </div>

            {/* Thumb image row */}
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Thumb Image</label>
                <input type="file" accept="image/*" onChange={handleThumbChange} className="text-xs" />
              </div>
              {(form.thumbPreview || editing?.thumbImage) && !form.clearThumb && (
                <div className="flex items-center gap-2">
                  <img
                    src={form.thumbPreview || getMediaUrl(editing?.thumbImage) || editing?.thumbImage}
                    alt="Thumb"
                    className="h-10 w-10 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, thumbFile: null, thumbPreview: '', clearThumb: true }))}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                <span>Active</span>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
                  {loading ? 'Saving…' : editing ? 'Update Filter' : 'Save Filter'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); fetchFilters(1, searchInput) } }}
            placeholder="Search filter name…"
            className="w-full pl-9 pr-3 h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          type="button"
          onClick={() => { setSearch(searchInput); fetchFilters(1, searchInput) }}
          disabled={loading}
          className="h-9 px-4 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          Search
        </button>
        {(search || searchInput) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); fetchFilters(1, '') }}
            className="h-9 px-3 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1 transition"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Filter Groups List ── */}
      <div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No filters found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search
                ? `No results for "${search}"`
                : hasCategory
                ? `No filters assigned to "${selectedCategoryLabel}" yet. Click "Add Filter" to create one.`
                : 'Select a category above to see its filters, or add a new one.'}
            </p>
            {!showForm && (
              <button onClick={openAdd} className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                <Plus className="h-4 w-4" /> Add First Filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{filteredGroups.length}</span> filter group{filteredGroups.length !== 1 ? 's' : ''}
                {search && <span className="ml-1">matching <em>"{search}"</em></span>}
              </p>
              {total > LIMIT && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <button onClick={() => fetchFilters(Math.max(1, page - 1), search)} disabled={page <= 1 || loading} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
                  <span>Page {page}</span>
                  <button onClick={() => fetchFilters(page + 1, search)} disabled={(page * LIMIT) >= total || loading} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
                </div>
              )}
            </div>

            {filteredGroups.map((group) => (
              <FilterGroupRow
                key={group._id}
                group={group}
                filterOptions={filterOptions}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                categoryLabelById={categoryLabelById}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminFiltersPage
