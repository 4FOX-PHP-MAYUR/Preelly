import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
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
  const [importRootCategoryId, setImportRootCategoryId] = useState('')
  const [importRootCategoryOptions, setImportRootCategoryOptions] = useState([])
  const [importSubCategoryId, setImportSubCategoryId] = useState('')
  const [importSubCategoryOptions, setImportSubCategoryOptions] = useState([])
  const [loadingImportSubCategories, setLoadingImportSubCategories] = useState(false)
  const fileInputRef = useRef(null)

  const fetchParentRoots = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryChildren({})
      const roots = Array.isArray(res.data) ? res.data : []
      setImportRootCategoryOptions(roots)
      setImportRootCategoryId((prev) => {
        if (prev) return prev
        const motors = roots.find((c) => String(c?.name || '').toLowerCase() === 'motors')
        return (motors?._id || roots?.[0]?._id || '')?.toString()
      })
    } catch {
      setImportRootCategoryOptions([])
      setImportRootCategoryId('')
    }
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

  useEffect(() => {
    let cancelled = false
    const loadSubCategories = async () => {
      if (!importRootCategoryId) {
        setImportSubCategoryOptions([])
        setImportSubCategoryId('')
        return
      }

      setLoadingImportSubCategories(true)
      try {
        const res = await adminService.getAdminCategoryChildren({ parentId: importRootCategoryId })
        const options = Array.isArray(res.data) ? res.data : []
        if (cancelled) return

        setImportSubCategoryOptions(options)

        setImportSubCategoryId((prev) => {
          if (prev && options.some((c) => String(c._id) === String(prev))) return prev
          const preferred = options.find((c) => String(c?.name || '').toLowerCase() === 'new cars')
          return (preferred?._id || '').toString()
        })
      } catch {
        if (cancelled) return
        setImportSubCategoryOptions([])
        setImportSubCategoryId('')
      } finally {
        if (!cancelled) setLoadingImportSubCategories(false)
      }
    }
    loadSubCategories()
    return () => {
      cancelled = true
    }
  }, [importRootCategoryId])

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
    if (importSubCategoryId) {
      formData.append('targetCategoryId', importSubCategoryId)
    } else if (importRootCategoryId) {
      formData.append('rootCategoryId', importRootCategoryId)
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
              onChange={(e) => setImportRootCategoryId(e.target.value)}
              disabled={!importRootCategoryOptions.length || importing}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 disabled:opacity-60 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              aria-label="Import root category"
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
            <select
              value={importSubCategoryId}
              onChange={(e) => setImportSubCategoryId(e.target.value)}
              disabled={!importRootCategoryId || loadingImportSubCategories || importing}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 disabled:opacity-60 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              aria-label="Import sub category"
            >
              {importRootCategoryId ? (
                <>
                  <option value="">Use Excel sheet name</option>
                  {importSubCategoryOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Select root first</option>
              )}
            </select>
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
                  <span className="font-medium text-gray-900 whitespace-pre dark:text-slate-100">
                    <span className="text-gray-400">{indent}</span>
                    {r.name}
                  </span>
                  {trail ? (
                    <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-slate-500">{trail}</div>
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
