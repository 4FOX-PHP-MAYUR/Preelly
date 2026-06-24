import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import PageHeader from '../../components/AdminUI/PageHeader'
import AdminPage from '../../components/AdminUI/AdminPage'
import Button from '../../components/AdminUI/Button'
import FilterBar from '../../components/AdminUI/FilterBar'
import Select from '../../components/AdminUI/Select'
import Panel from '../../components/AdminUI/Panel'
import toast from 'react-hot-toast'
import {
  Edit2, Trash2, Plus, ChevronUp, ChevronDown, LayoutList, RotateCcw,
} from 'lucide-react'

const LIMIT = 20
const LIST_PATH = '/admin/form-fields'

function FormFieldsListPage() {
  const navigate = useNavigate()
  const [formFields, setFormFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const [search, setSearch] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterFieldTypeId, setFilterFieldTypeId] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterQuickView, setFilterQuickView] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [sortBy, setSortBy] = useState('formStep')
  const [sortDir, setSortDir] = useState('asc')

  const [categoryGroups, setCategoryGroups] = useState([])
  const [fieldTypes, setFieldTypes] = useState([])

  const buildListParams = useCallback((p, overrides = {}) => {
    const searchTerm = overrides.search !== undefined ? overrides.search : search
    const catId = overrides.categoryId !== undefined ? overrides.categoryId : filterCategoryId
    const typeId = overrides.fieldTypeId !== undefined ? overrides.fieldTypeId : filterFieldTypeId
    const statusVal = overrides.status !== undefined ? overrides.status : filterStatus
    const quickViewVal = overrides.showOnQuickView !== undefined ? overrides.showOnQuickView : filterQuickView
    const sb = overrides.sortBy !== undefined ? overrides.sortBy : sortBy
    const sd = overrides.sortDir !== undefined ? overrides.sortDir : sortDir

    const params = { page: p, limit: LIMIT, sortBy: sb, sortDir: sd }
    if (searchTerm.trim()) params.search = searchTerm.trim()
    if (catId) params.categoryId = catId
    if (typeId) params.fieldTypeId = typeId
    if (statusVal === 'active' || statusVal === 'inactive') params.status = statusVal
    if (quickViewVal === 'yes') params.showOnQuickView = 'true'
    else if (quickViewVal === 'no') params.showOnQuickView = 'false'
    return params
  }, [search, filterCategoryId, filterFieldTypeId, filterStatus, filterQuickView, sortBy, sortDir])

  const fetchDropdowns = async () => {
    try {
      const res = await adminService.getFormFieldDropdowns()
      const data = res.data || {}
      setCategoryGroups(data.categoryGroups || [])
      setFieldTypes(data.fieldTypes || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dropdown data')
    }
  }

  const fetchFormFields = useCallback(async (p = 1, overrides = {}) => {
    try {
      setLoading(true)
      const params = buildListParams(p, overrides)
      const res = await adminService.getFormFields(params)
      const data = res.data || {}
      setFormFields(data.formFields || [])
      setTotal(data.total || 0)
      setTotalRecords(data.totalRecords ?? data.total ?? 0)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load form fields')
    } finally {
      setLoading(false)
    }
  }, [buildListParams])

  useEffect(() => {
    fetchDropdowns()
    fetchFormFields(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSort = (field) => {
    const newDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortBy(field)
    setSortDir(newDir)
    fetchFormFields(1, { sortBy: field, sortDir: newDir })
  }

  const hasActiveFilters = Boolean(
    search || filterCategoryId || filterFieldTypeId
    || filterStatus !== 'all' || filterQuickView !== 'all'
  )

  const handleSearch = (e) => {
    e.preventDefault()
    fetchFormFields(1, { search })
  }

  const handleFilterCategoryChange = (value) => {
    setFilterCategoryId(value)
    fetchFormFields(1, { categoryId: value })
  }

  const handleFilterFieldTypeChange = (value) => {
    setFilterFieldTypeId(value)
    fetchFormFields(1, { fieldTypeId: value })
  }

  const handleFilterStatusChange = (value) => {
    setFilterStatus(value)
    fetchFormFields(1, { status: value })
  }

  const handleFilterQuickViewChange = (value) => {
    setFilterQuickView(value)
    fetchFormFields(1, { showOnQuickView: value })
  }

  const handleResetFilters = () => {
    setSearch('')
    setFilterCategoryId('')
    setFilterFieldTypeId('')
    setFilterStatus('all')
    setFilterQuickView('all')
    fetchFormFields(1, {
      search: '',
      categoryId: '',
      fieldTypeId: '',
      status: 'all',
      showOnQuickView: 'all',
    })
  }

  const handleToggleStatus = async (row) => {
    try {
      await adminService.updateFormField(row._id, { isActive: !row.isActive })
      toast.success(row.isActive ? 'Set inactive' : 'Set active')
      fetchFormFields(page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.fieldTitle}"? This cannot be undone.`)) return
    try {
      setDeleting(row._id)
      await adminService.deleteFormField(row._id)
      toast.success('Form field deleted')
      fetchFormFields(page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronUp className="h-3 w-3 text-gray-300 shrink-0" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-indigo-500 shrink-0" />
      : <ChevronDown className="h-3 w-3 text-indigo-500 shrink-0" />
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <AdminPage>
      <PageHeader
        title="Form Fields"
        subtitle="Manage dynamic form fields linked to categories, field types and filters"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Form Field
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by Field Title, Field Name, Category..."
        filters={[
          {
            key: 'category',
            render: () => (
              <Select
                label="Category"
                value={filterCategoryId}
                onChange={(e) => handleFilterCategoryChange(e.target.value)}
              >
                <option value="">All Categories</option>
                {categoryGroups.map((group) => (
                  <optgroup key={group._id} label={group.name}>
                    <option value={group._id}>{group.name} (root)</option>
                    {group.children.map((child) => (
                      <option key={child._id} value={child._id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            ),
          },
          {
            key: 'fieldType',
            type: 'select',
            label: 'Field Type',
            value: filterFieldTypeId,
            onChange: (e) => handleFilterFieldTypeChange(e.target.value),
            options: [
              { value: '', label: 'All Field Types' },
              ...fieldTypes.map((ft) => ({ value: ft._id, label: ft.fieldValue })),
            ],
          },
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: filterStatus,
            onChange: (e) => handleFilterStatusChange(e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            key: 'quickView',
            type: 'select',
            label: 'Quick View',
            value: filterQuickView,
            onChange: (e) => handleFilterQuickViewChange(e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
        ]}
        actions={
          hasActiveFilters ? (
            <Button variant="secondary" icon={RotateCcw} onClick={handleResetFilters}>
              Reset Filters
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        <span className="font-medium text-slate-700 dark:text-slate-300">{totalRecords}</span> total records
        {hasActiveFilters && (
          <>
            {' · '}
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{total}</span> matching filter
            {total !== 1 ? 's' : ''}
          </>
        )}
      </p>

      <Panel padding={false} className="overflow-hidden">
        {loading && formFields.length === 0 ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading form fields…</p>
          </div>
        ) : formFields.length === 0 ? (
          <div className="p-14 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <LayoutList className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {hasActiveFilters ? 'No records found' : 'No form fields found'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {hasActiveFilters
                ? 'Try adjusting your search or filters, or reset filters to see all records.'
                : 'Click "Add Form Field" to create the first one.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" icon={RotateCcw} onClick={handleResetFilters} className="mt-4">
                Reset Filters
              </Button>
            ) : (
              <Button icon={Plus} onClick={() => navigate(`${LIST_PATH}/new`)} className="mt-4">
                Add Form Field
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                    onClick={() => handleSort('fieldTitle')}
                  >
                    <div className="flex items-center gap-1">Field Title <SortIcon field="fieldTitle" /></div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Field Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Category Filter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Child Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Field Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Filter
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                    onClick={() => handleSort('formStep')}
                  >
                    <div className="flex items-center gap-1">Step <SortIcon field="formStep" /></div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                    onClick={() => handleSort('fieldOrder')}
                  >
                    <div className="flex items-center gap-1">Order <SortIcon field="fieldOrder" /></div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Quick View
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Date Added
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formFields.map((row, idx) => (
                  <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">{(page - 1) * LIMIT + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]" title={row.fieldTitle}>
                        {row.fieldTitle}
                      </div>
                      {row.placeholder && (
                        <div className="text-xs text-gray-400 truncate max-w-[160px]">{row.placeholder}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                        {row.fieldName}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 truncate max-w-[120px] block" title={row.categoryId?.name}>
                        {row.categoryId?.name || <span className="text-gray-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 truncate max-w-[120px] block" title={row.categoryFilterId?.name}>
                        {row.categoryFilterId?.name || <span className="text-gray-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 truncate max-w-[120px] block" title={row.childCategoryId?.name}>
                        {row.childCategoryId?.name || <span className="text-gray-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {row.fieldTypeId?.fieldValue || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 truncate max-w-[120px] block" title={row.filterId?.name}>
                        {row.filterId?.name || <span className="text-gray-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        {row.formStep ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.fieldOrder ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(row)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          row.isActive
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        }`}
                        title="Click to toggle"
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          row.showOnQuickView
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {row.showOnQuickView ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`${LIST_PATH}/${row._id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={deleting === row._id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{' '}
            <span className="font-semibold text-gray-800">{total}</span>
            {hasActiveFilters ? ' filtered' : ''} record{total !== 1 ? 's' : ''}
            {hasActiveFilters && totalRecords > total && (
              <> (of {totalRecords} total)</>
            )}
          </p>
          {total > LIMIT && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchFormFields(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
              <button
                onClick={() => fetchFormFields(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </AdminPage>
  )
}

export default FormFieldsListPage
