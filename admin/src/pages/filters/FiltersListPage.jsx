import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'
import AdminPage from '../../components/AdminUI/AdminPage'
import PageHeader from '../../components/AdminUI/PageHeader'
import FilterBar from '../../components/AdminUI/FilterBar'
import Button from '../../components/AdminUI/Button'
import {
  ChevronRight,
  FolderOpen,
  Upload,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  Tag,
  Layers,
  AlertCircle,
} from 'lucide-react'

const LIST_PATH = '/admin/filters'
const LIMIT = 200

function adminLoadErrorMessage(err, fallback) {
  const server = err.response?.data?.message
  if (server) return server
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return 'Network error — check that the API server is running and VITE_API_URL matches it.'
  }
  return err.message || fallback
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

function CategoryBreadcrumb({ path, labelById }) {
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

function FilterGroupRow({ group, onEdit, onDelete, onToggleStatus, categoryLabelById }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = group.children && group.children.length > 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
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

        <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
          <Tag className="h-3.5 w-3.5 text-indigo-600" />
        </div>

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
          <CategoryPathBadge filter={group} labelById={categoryLabelById} />
        </div>

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

function FiltersListPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [nestedCategoryRoots, setNestedCategoryRoots] = useState([])
  const [categoryPath, setCategoryPath] = useState([])

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
    fetchNestedCategoryTree()
  }, [])

  const handleCategoryLevelChange = async (depth, value) => {
    const next = categoryPath.slice(0, depth)
    if (value) next[depth] = value
    setCategoryPath(next)
    setSearch('')
    setSearchInput('')
    await fetchFilters(1, '', next)
  }

  const clearCategory = async () => {
    setCategoryPath([])
    setSearch('')
    setSearchInput('')
    await fetchFilters(1, '', [])
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    fetchFilters(1, searchInput)
  }

  const clearSearch = () => {
    setSearch('')
    setSearchInput('')
    fetchFilters(1, '')
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
      await fetchFilters(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    }
  }

  const handleEdit = (row) => {
    navigate(`${LIST_PATH}/${row._id}/edit`, { state: { filter: row } })
  }

  const handleAdd = () => {
    navigate(`${LIST_PATH}/new`, { state: { categoryPath: categoryPath.filter(Boolean) } })
  }

  const handleImportClick = () => {
    if (!categoryPath.filter(Boolean).length) {
      toast.error('Please select a category before importing', { id: 'import-no-cat' })
      return
    }
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
      const summary =
        typeof d.failed === 'number' && d.failed > 0
          ? `${d.message || 'Done'} — ${d.success ?? 0}/${d.total ?? 0} rows, ${d.failed} failed`
          : d.message || 'Filters imported successfully'
      toast.success(summary)
      await fetchFilters(1, search)
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to import filters')
    } finally {
      setImporting(false)
    }
  }

  const hasCategory = categoryPath.filter(Boolean).length > 0
  const totalGroups = filterGroups.length
  const totalValues = filterGroups.reduce((n, g) => n + (g.children?.length || 0), 0)
  const hasActiveSearch = Boolean(search || searchInput)

  const renderCategoryCascade = () => (
    <div className="w-full space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" />
        Category
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
                  <option value="">
                    {getLevelLabel(depth)}
                    {depth === 0 ? ' (All)' : '…'}
                  </option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
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
    </div>
  )

  return (
    <AdminPage>
      <PageHeader
        title="Filters"
        subtitle="Select a category first, then manage its filters and values"
        action={
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              icon={Upload}
              onClick={handleImportClick}
              disabled={importing || !hasCategory}
              title={!hasCategory ? 'Select a category first' : 'Import Excel (Types | Filters | Properties)'}
            >
              {importing ? 'Importing…' : 'Import Excel'}
            </Button>
            <Button onClick={handleAdd} icon={Plus}>
              Add Filter
            </Button>
          </div>
        }
      />
      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search filter name…"
        filters={[
          {
            key: 'category',
            render: renderCategoryCascade,
          },
        ]}
        actions={
          hasActiveSearch ? (
            <Button type="button" variant="secondary" onClick={clearSearch}>
              Clear
            </Button>
          ) : null
        }
        className="mb-4"
      />

      {hasCategory && (
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <CategoryBreadcrumb path={categoryPath} labelById={categoryLabelById} />
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-800">{totalGroups}</span> filter groups
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-semibold text-gray-800">{totalValues}</span> values
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-semibold text-gray-800">{total}</span> total
            </span>
          </div>
        </div>
      )}

      {!hasCategory && !loading && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1 mb-4">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Showing all {total} filters across every category. Select a category above to narrow the view.
        </p>
      )}

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
            <Button onClick={handleAdd} icon={Plus} className="mt-4">
              Add First Filter
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{filteredGroups.length}</span> filter group
                {filteredGroups.length !== 1 ? 's' : ''}
                {search && (
                  <span className="ml-1">
                    matching <em>&quot;{search}&quot;</em>
                  </span>
                )}
              </p>
              {total > LIMIT && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => fetchFilters(Math.max(1, page - 1), search)}
                    disabled={page <= 1 || loading}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <span>Page {page}</span>
                  <button
                    type="button"
                    onClick={() => fetchFilters(page + 1, search)}
                    disabled={page * LIMIT >= total || loading}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {filteredGroups.map((group) => (
              <FilterGroupRow
                key={group._id}
                group={group}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                categoryLabelById={categoryLabelById}
              />
            ))}
          </>
        )}
      </div>
    </AdminPage>
  )
}

export default FiltersListPage
