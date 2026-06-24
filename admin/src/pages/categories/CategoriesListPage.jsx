import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import PageHeader from '../../components/AdminUI/PageHeader'
import AdminPage from '../../components/AdminUI/AdminPage'
import DataTable from '../../components/AdminUI/DataTable'
import Button from '../../components/AdminUI/Button'
import FilterBar from '../../components/AdminUI/FilterBar'
import StatusBadge from '../../components/AdminUI/StatusBadge'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const LIMIT = 100
const LIST_PATH = '/admin/categories'

function CategoriesListPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterParentId, setFilterParentId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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

  const fetchCategories = async (
    p = 1,
    searchTerm = '',
    parentId = filterParentId,
    status = statusFilter
  ) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim()
      if (parentId) params.parentId = parentId
      const res = await adminService.getAdminCategories(params)
      const data = res.data || {}
      let items = data.categories || data.data || []
      if (status && status !== 'all') {
        const wantActive = status === 'active'
        items = items.filter((c) => (c.isActive !== false) === wantActive)
      }
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

  useEffect(() => {
    fetchCategories(1)
    fetchParentRoots()
  }, [])

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
    fetchCategories(1, search, filterParentId, statusFilter)
  }

  const clearFilters = () => {
    setSearch('')
    setFilterParentId('')
    setStatusFilter('all')
    fetchCategories(1, '', '', 'all')
  }

  const handleToggleStatus = async (row) => {
    const isActive = row.isActive !== false
    try {
      setLoading(true)
      await adminService.updateAdminCategory(row._id, { isActive: !isActive })
      toast.success(isActive ? 'Category set to inactive' : 'Category set to active')
      await fetchCategories(page, search, filterParentId, statusFilter)
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
        fetchCategories(page, search, filterParentId, statusFilter),
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
        fetchCategories(1, search, filterParentId, statusFilter),
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

  const hasActiveFilters = search || filterParentId || statusFilter !== 'all'

  const parentFilterOptions = [
    { value: '', label: 'All parent categories' },
    ...importRootCategoryOptions.map((c) => ({ value: c._id, label: c.name })),
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
            type: 'select',
            label: 'Parent category',
            value: filterParentId,
            onChange: (e) => setFilterParentId(e.target.value),
            options: parentFilterOptions,
          },
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
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
              return (
                <span className="font-medium text-gray-900 whitespace-pre dark:text-slate-100">
                  <span className="text-gray-400">{indent}</span>
                  {r.name}
                </span>
              )
            },
          },
          {
            key: 'parent',
            title: 'Parent',
            render: (r) => {
              const p = categories.find((c) => String(c._id) === String(r.parentId))
              return p ? p.name : 'Root'
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
          onPageChange: (p) => fetchCategories(p, search, filterParentId, statusFilter),
        }}
        onEdit={(row) => navigate(`${LIST_PATH}/${row._id}/edit`)}
        onDelete={handleDelete}
      />
    </AdminPage>
  )
}

export default CategoriesListPage
