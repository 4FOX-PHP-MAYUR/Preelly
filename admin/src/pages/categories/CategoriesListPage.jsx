import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService, categoryService } from '@/services/api'
import PageHeader from '../../components/AdminUI/PageHeader'
import AdminPage from '../../components/AdminUI/AdminPage'
import DataTable from '../../components/AdminUI/DataTable'
import Button from '../../components/AdminUI/Button'
import FilterBar from '../../components/AdminUI/FilterBar'
import StatusBadge from '../../components/AdminUI/StatusBadge'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermission } from '../../hooks/usePermission'

const LIMIT = 100
const LIST_PATH = '/categories'
// Import anchor is picked with this many cascading dropdowns (root + 3 deeper
// levels). The deepest one picked becomes the parent the sheet imports under.
const IMPORT_DEPTH = 4
const EMPTY_IMPORT_SELECTION = Array.from({ length: IMPORT_DEPTH }, () => '')
const EMPTY_IMPORT_OPTIONS = Array.from({ length: IMPORT_DEPTH }, () => [])
const DEFAULT_IMPORT_LEVEL_LABELS = ['Category', 'Sub Category', 'Level 3', 'Level 4']

function CategoriesListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Categories')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterParentId, setFilterParentId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('')
  const [rootOnly, setRootOnly] = useState(false)
  // Every category (not just roots) so any level can be filtered on.
  const [allCategoryOptions, setAllCategoryOptions] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [importing, setImporting] = useState(false)
  // One entry per dropdown: selected category id at that depth ('' = not picked).
  const [importSelection, setImportSelection] = useState(EMPTY_IMPORT_SELECTION)
  const [importOptions, setImportOptions] = useState(EMPTY_IMPORT_OPTIONS)
  const [importLoadingDepth, setImportLoadingDepth] = useState(-1)
  const [importLevelLabels, setImportLevelLabels] = useState(DEFAULT_IMPORT_LEVEL_LABELS)
  // Bumped when the tree changes (import/delete) to re-run the cascade so the
  // open dropdowns pick up newly created levels.
  const [importTreeVersion, setImportTreeVersion] = useState(0)
  const fileInputRef = useRef(null)
  // parentId -> children, so re-picking a shallow level doesn't refetch the
  // whole chain every time.
  const importChildrenCacheRef = useRef(new Map())

  const importRootCategoryOptions = importOptions[0]
  const importRootCategoryId = importSelection[0]

  const fetchParentRoots = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryChildren({})
      const roots = Array.isArray(res.data) ? res.data : []
      // A refetch (after import/delete) must not serve stale children.
      importChildrenCacheRef.current.clear()
      setImportTreeVersion((v) => v + 1)
      setImportOptions((prev) => [roots, ...prev.slice(1)])
      setImportSelection((prev) => {
        if (prev[0]) return prev
        const motors = roots.find((c) => String(c?.name || '').toLowerCase() === 'motors')
        const rootId = (motors?._id || roots?.[0]?._id || '').toString()
        return [rootId, ...EMPTY_IMPORT_SELECTION.slice(1)]
      })
    } catch {
      setImportOptions(EMPTY_IMPORT_OPTIONS)
      setImportSelection(EMPTY_IMPORT_SELECTION)
    }
  }, [])

  const fetchImportChildren = useCallback(async (parentId) => {
    const key = String(parentId)
    const cache = importChildrenCacheRef.current
    if (cache.has(key)) return cache.get(key)
    const res = await adminService.getAdminCategoryChildren({ parentId })
    const options = Array.isArray(res.data) ? res.data : []
    cache.set(key, options)
    return options
  }, [])

  /**
   * Every filter is applied server-side, so `total` and the page slice always
   * agree. (Status used to be filtered client-side over the fetched page only,
   * which left the count wrong and later pages unfiltered.)
   */
  const fetchCategories = async (
    p = 1,
    searchTerm = search,
    parentId = filterParentId,
    status = statusFilter,
    rootOnlyFilter = rootOnly,
    level = levelFilter
  ) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim()
      if (rootOnlyFilter) {
        params.rootOnly = 'true'
      } else if (parentId) {
        // Whole subtree, so picking a root shows everything beneath it.
        params.parentId = parentId
      }
      if (status && status !== 'all') params.status = status
      if (level !== '' && level !== null && level !== undefined) params.level = level
      const res = await adminService.getAdminCategories(params)
      const data = res.data || {}
      const items = data.categories || data.data || []
      const totalCount = Number(data.total ?? data.meta?.total ?? items.length)
      setCategories(items)
      setTotal(totalCount)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  // Flatten the nested tree into indented options so any level can be picked as
  // the filter scope — previously only root categories were offered.
  const fetchAllCategoryOptions = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryNestedForFilters()
      const roots = res.data?.categories || []
      const flat = []
      // `hint` carries the ancestor trail so a typed match ("Corolla") can be
      // told apart from the same name under a different parent.
      const walk = (nodes, depth, trail) => {
        nodes.forEach((n) => {
          flat.push({ value: n.id || n._id, label: `${'\u00a0\u00a0'.repeat(depth)}${depth ? '└ ' : ''}${n.name}`, hint: trail.join(' › ') })
          const kids = n.subcategories || n.children || []
          if (kids.length) walk(kids, depth + 1, [...trail, n.name])
        })
      }
      walk(roots, 0, [])
      setAllCategoryOptions(flat)
    } catch {
      setAllCategoryOptions([])
    }
  }, [])

  useEffect(() => {
    fetchCategories(1)
    fetchParentRoots()
    fetchAllCategoryOptions()
  }, [])

  // Debounced search-as-you-type; the form's submit still works for Enter.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return undefined
    }
    const id = setTimeout(() => fetchCategories(1, search), 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  /**
   * Walks the selected chain and loads the option list for each depth below it.
   * Stops at the first depth whose parent is unset, so the dropdowns past the
   * current selection stay empty (and therefore hidden).
   */
  useEffect(() => {
    let cancelled = false
    const loadCascade = async () => {
      const loaded = [null, [], [], []]
      let autoSelect = null

      for (let depth = 1; depth < IMPORT_DEPTH; depth++) {
        const parentId = importSelection[depth - 1]
        if (!parentId) break
        setImportLoadingDepth(depth)
        try {
          const options = await fetchImportChildren(parentId)
          if (cancelled) return
          loaded[depth] = options
          // Preserves the long-standing default of importing under Motors ›
          // New Cars when nothing deeper has been chosen.
          if (depth === 1 && !importSelection[1]) {
            const preferred = options.find((c) => String(c?.name || '').toLowerCase() === 'new cars')
            if (preferred?._id) autoSelect = { depth: 1, id: String(preferred._id) }
          }
        } catch {
          if (cancelled) return
          loaded[depth] = []
        }
        if (!importSelection[depth]) break
      }

      if (cancelled) return
      setImportLoadingDepth(-1)
      setImportOptions((prev) => [prev[0], loaded[1], loaded[2], loaded[3]])
      if (autoSelect) {
        setImportSelection((prev) =>
          prev.map((v, i) => (i === autoSelect.depth ? autoSelect.id : i < autoSelect.depth ? v : ''))
        )
      }
    }
    loadCascade()
    return () => {
      cancelled = true
    }
  }, [importSelection, importTreeVersion, fetchImportChildren])

  // Dropdown captions follow the selected root ("Vehicle Type", "Brand", …).
  useEffect(() => {
    let cancelled = false
    const rootName = importRootCategoryOptions.find(
      (c) => String(c._id) === String(importRootCategoryId)
    )?.name
    if (!rootName) {
      setImportLevelLabels(DEFAULT_IMPORT_LEVEL_LABELS)
      return undefined
    }
    categoryService
      .getLevelLabels(rootName)
      .then((res) => {
        if (cancelled) return
        const labels = res.data?.labels
        setImportLevelLabels(
          Array.isArray(labels) && labels.length
            ? DEFAULT_IMPORT_LEVEL_LABELS.map((fallback, i) => labels[i] || fallback)
            : DEFAULT_IMPORT_LEVEL_LABELS
        )
      })
      .catch(() => {
        if (!cancelled) setImportLevelLabels(DEFAULT_IMPORT_LEVEL_LABELS)
      })
    return () => {
      cancelled = true
    }
  }, [importRootCategoryId, importRootCategoryOptions])

  const handleImportLevelChange = (depth, value) => {
    // Picking a level invalidates everything below it.
    setImportSelection((prev) => prev.map((v, i) => (i < depth ? v : i === depth ? value : '')))
    setImportOptions((prev) => prev.map((opts, i) => (i <= depth ? opts : [])))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCategories(1, search, filterParentId, statusFilter, rootOnly, levelFilter)
  }

  const clearFilters = () => {
    setSearch('')
    setFilterParentId('')
    setStatusFilter('all')
    setLevelFilter('')
    setRootOnly(false)
    fetchCategories(1, '', '', 'all', false, '')
  }

  const handleRootOnlyChange = (e) => {
    const value = e.target.value === 'root'
    setRootOnly(value)
    const nextParent = value ? '' : filterParentId
    if (value) setFilterParentId('')
    fetchCategories(1, search, nextParent, statusFilter, value, levelFilter)
  }

  const handleParentFilterChange = (e) => {
    const value = e.target.value
    setFilterParentId(value)
    if (value) setRootOnly(false)
    fetchCategories(1, search, value, statusFilter, value ? false : rootOnly, levelFilter)
  }

  const handleStatusFilterChange = (e) => {
    const value = e.target.value
    setStatusFilter(value)
    fetchCategories(1, search, filterParentId, value, rootOnly, levelFilter)
  }

  const handleLevelFilterChange = (e) => {
    const value = e.target.value
    setLevelFilter(value)
    fetchCategories(1, search, filterParentId, statusFilter, rootOnly, value)
  }

  const handleToggleStatus = async (row) => {
    const isActive = row.isActive !== false
    try {
      setLoading(true)
      await adminService.updateAdminCategory(row._id, { isActive: !isActive })
      toast.success(isActive ? 'Category set to inactive' : 'Category set to active')
      await fetchCategories(page, search, filterParentId, statusFilter, rootOnly, levelFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete category and its children?')) return
    try {
      setLoading(true)
      await adminService.deleteAdminCategory(row._id)
      toast.success('Deleted')
      await Promise.all([
        fetchCategories(page, search, filterParentId, statusFilter, rootOnly, levelFilter),
        fetchParentRoots(),
      ])
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
    // The deepest picked level is the anchor. With only the root picked we keep
    // the legacy behavior of anchoring under a child named after the sheet.
    const deepestDepth = importSelection.reduce((acc, id, i) => (id ? i : acc), -1)
    if (deepestDepth > 0) {
      formData.append('targetCategoryId', importSelection[deepestDepth])
    } else if (deepestDepth === 0) {
      formData.append('rootCategoryId', importSelection[0])
    }

    try {
      setImporting(true)
      const res = await adminService.importAdminCategoriesExcel(formData)
      const d = res.data || {}
      const summary =
        typeof d.failed === 'number' && d.failed > 0
          ? `${d.message || 'Done'} — ${d.success ?? 0}/${d.total ?? 0} rows, ${d.failed} failed`
          : d.message || 'Categories imported successfully'
      toast.success(summary)
      await Promise.all([
        fetchCategories(1, search, filterParentId, statusFilter, rootOnly, levelFilter),
        fetchParentRoots(),
      ])
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to import categories'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const hasActiveFilters = search || filterParentId || statusFilter !== 'all' || rootOnly || levelFilter !== ''

  const parentFilterOptions = [
    { value: '', label: 'All categories' },
    ...(allCategoryOptions.length
      ? allCategoryOptions
      : importRootCategoryOptions.map((c) => ({ value: c._id, label: c.name }))),
  ]

  const levelFilterOptions = [
    { value: '', label: 'All levels' },
    { value: '0', label: 'Level 0 — Root' },
    { value: '1', label: 'Level 1' },
    { value: '2', label: 'Level 2' },
    { value: '3', label: 'Level 3' },
    { value: '4', label: 'Level 4' },
  ]

  return (
    <AdminPage>
      <PageHeader
        title="Categories"
        subtitle="Manage product categories"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={importRootCategoryId}
              onChange={(e) => handleImportLevelChange(0, e.target.value)}
              disabled={!importRootCategoryOptions.length || importing}
              className="admin-input w-auto min-w-[160px]"
              aria-label={`Import ${importLevelLabels[0]}`}
            >
              {importRootCategoryOptions.length ? (
                importRootCategoryOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="">Loading roots…</option>
              )}
            </select>
            {/* Deeper levels appear one at a time as the chain is picked, and
                stop when the selected category has no children left. */}
            {Array.from({ length: IMPORT_DEPTH - 1 }, (_, i) => i + 1).map((depth) => {
              if (!importSelection[depth - 1]) return null
              const options = importOptions[depth] || []
              const isLoading = importLoadingDepth === depth
              if (!options.length && !isLoading) return null
              const label = importLevelLabels[depth] || `Level ${depth + 1}`
              const parentName =
                (importOptions[depth - 1] || []).find(
                  (c) => String(c._id) === String(importSelection[depth - 1])
                )?.name || 'selected category'
              return (
                <select
                  key={depth}
                  value={importSelection[depth]}
                  onChange={(e) => handleImportLevelChange(depth, e.target.value)}
                  disabled={isLoading || importing}
                  className="admin-input w-auto min-w-[160px]"
                  aria-label={`Import ${label}`}
                >
                  {isLoading ? (
                    <option value="">Loading…</option>
                  ) : (
                    <>
                      <option value="">
                        {depth === 1 ? 'Use Excel sheet name' : `Import under ${parentName}`}
                      </option>
                      {options.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              )
            })}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportFileChange}
            />
            {canCreate ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleImportClick}
                  disabled={importing}
                >
                  {importing ? 'Importing…' : 'Import Excel'}
                </Button>
                <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
                  Add Category
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search categories..."
        filters={[
          {
            key: 'parent',
            type: 'searchable-select',
            label: 'Within category',
            value: filterParentId,
            onChange: handleParentFilterChange,
            options: parentFilterOptions,
            placeholder: 'All categories',
            searchPlaceholder: 'Type a category name…',
          },
          {
            key: 'rootOnly',
            type: 'select',
            label: 'Show Root Category',
            value: rootOnly ? 'root' : '',
            onChange: handleRootOnlyChange,
            options: [
              { value: '', label: 'All categories' },
              { value: 'root', label: 'Root categories only' },
            ],
          },
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: statusFilter,
            onChange: handleStatusFilterChange,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            key: 'level',
            type: 'select',
            label: 'Depth',
            value: levelFilter,
            onChange: handleLevelFilterChange,
            options: levelFilterOptions,
          },
        ]}
        actions={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        Showing{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{categories.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> categories
      </p>

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
              const indent = level > 0 ? '│   '.repeat(Math.max(0, level - 1)) + '└─ ' : ''
              const trail = Array.isArray(r.pathNames) ? r.pathNames.join(' › ') : ''
              return (
                <div className="min-w-0">
                  <span className="font-medium text-slate-900 whitespace-pre dark:text-white">
                    <span className="text-slate-400 dark:text-slate-500">{indent}</span>
                    {r.name}
                  </span>
                  {trail ? (
                    <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{trail}</div>
                  ) : null}
                </div>
              )
            },
          },
          {
            key: 'parent',
            title: 'Parent',
            render: (r) => {
              if (!r.parentId) return 'Root'
              // parentName comes from the API; falling back to the page only works
              // when the parent happens to be on it.
              if (r.parentName) return r.parentName
              const p = categories.find((c) => String(c._id) === String(r.parentId))
              return p ? p.name : '—'
            },
          },
          {
            key: 'order',
            title: 'Order',
            render: (r) => r.xOrder ?? 0,
          },
          {
            key: 'isChild',
            title: 'Is Child',
            render: (r) => {
              // The list is lean-queried, so rows never backfilled show no value
              // at all — worth distinguishing from an explicit 0.
              if (r.isChild === undefined || r.isChild === null) {
                return <span className="text-slate-400 dark:text-slate-500">—</span>
              }
              const isChild = Number(r.isChild) === 1
              return (
                <StatusBadge
                  status={isChild ? 'active' : 'inactive'}
                  label={isChild ? 'Yes (1)' : 'No (0)'}
                />
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
                  className="focus:outline-none"
                >
                  <StatusBadge status={isActive ? 'active' : 'inactive'} />
                </button>
              )
            },
          },
        ]}
        data={categories}
        loading={loading}
        serverSide
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) =>
            fetchCategories(p, search, filterParentId, statusFilter, rootOnly, levelFilter),
        }}
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row._id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
      />
    </AdminPage>
  )
}

export default CategoriesListPage
