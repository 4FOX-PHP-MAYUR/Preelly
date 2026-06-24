import { useEffect, useState } from 'react'
import { adminService } from '@shared/services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import toast from 'react-hot-toast'
import { Edit2, Trash2, Plus, X, Search, ChevronUp, ChevronDown, Tag } from 'lucide-react'

const LIMIT = 20

function AdminFieldTypesPage() {
  const [fieldTypes, setFieldTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState({ fieldValue: '', sortOrder: '', isActive: true })
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('sortOrder')
  const [sortDir, setSortDir] = useState('asc')

  const fetchFieldTypes = async (p = 1, searchTerm = '', sb = sortBy, sd = sortDir) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: sb, sortDir: sd }
      if (searchTerm.trim()) params.search = searchTerm.trim()
      const res = await adminService.getFieldTypes(params)
      const data = res.data || {}
      setFieldTypes(data.fieldTypes || [])
      setTotal(data.total || 0)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load field types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFieldTypes(1, '', sortBy, sortDir)
  }, [])

  const handleSort = (field) => {
    const newDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortBy(field)
    setSortDir(newDir)
    fetchFieldTypes(1, search, field, newDir)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    fetchFieldTypes(1, searchInput, sortBy, sortDir)
  }

  const handleClearSearch = () => {
    setSearch('')
    setSearchInput('')
    fetchFieldTypes(1, '', sortBy, sortDir)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ fieldValue: '', sortOrder: '', isActive: true })
    setErrors({})
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      fieldValue: row.fieldValue || '',
      sortOrder: typeof row.sortOrder === 'number' ? String(row.sortOrder) : '',
      isActive: row.isActive !== false,
    })
    setErrors({})
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ fieldValue: '', sortOrder: '', isActive: true })
    setErrors({})
  }

  const validate = () => {
    const errs = {}
    if (!form.fieldValue.trim()) errs.fieldValue = 'Field value is required'
    if (form.sortOrder === '' || form.sortOrder === null || form.sortOrder === undefined) {
      errs.sortOrder = 'Sort order is required'
    } else if (Number.isNaN(Number(form.sortOrder))) {
      errs.sortOrder = 'Sort order must be a number'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    try {
      setLoading(true)
      const payload = {
        fieldValue: form.fieldValue.trim(),
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
      }
      if (editing) {
        await adminService.updateFieldType(editing._id, payload)
        toast.success('Field type updated')
      } else {
        await adminService.createFieldType(payload)
        toast.success('Field type created')
      }
      closeForm()
      fetchFieldTypes(editing ? page : 1, search, sortBy, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save field type')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row) => {
    try {
      await adminService.updateFieldType(row._id, { isActive: !row.isActive })
      toast.success(row.isActive ? 'Set inactive' : 'Set active')
      fetchFieldTypes(page, search, sortBy, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.fieldValue}"? This action cannot be undone.`)) return
    try {
      setDeleting(row._id)
      await adminService.deleteFieldType(row._id)
      toast.success('Field type deleted')
      if (editing?._id === row._id) closeForm()
      fetchFieldTypes(page, search, sortBy, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete field type')
    } finally {
      setDeleting(null)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronUp className="h-3.5 w-3.5 text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
      : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Field Types"
        subtitle="Manage field type values used across the platform"
        action={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium transition"
          >
            <Plus className="h-4 w-4" />
            Add Field Type
          </button>
        }
      />

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="mb-6 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search field types…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition"
        >
          Search
        </button>
        {(search || searchInput) && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-1 transition"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </form>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-200">
            <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {editing ? `Edit: ${editing.fieldValue}` : 'Add New Field Type'}
            </h2>
            <button type="button" onClick={closeForm} className="text-indigo-400 hover:text-indigo-600 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              {/* Field Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fieldValue}
                  onChange={(e) => setForm({ ...form, fieldValue: e.target.value })}
                  placeholder="e.g. Text, Number, Date…"
                  autoFocus
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.fieldValue ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.fieldValue && (
                  <p className="mt-1 text-xs text-red-500">{errors.fieldValue}</p>
                )}
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  placeholder="0"
                  min={0}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.sortOrder ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.sortOrder && (
                  <p className="mt-1 text-xs text-red-500">{errors.sortOrder}</p>
                )}
              </div>

              {/* Status + Submit */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                  >
                    {loading ? 'Saving…' : editing ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && fieldTypes.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading field types…</p>
          </div>
        ) : fieldTypes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Tag className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No field types found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? `No results for "${search}"` : 'Click "Add Field Type" to create your first one.'}
            </p>
            {!showForm && (
              <button
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" />
                Add Field Type
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  #
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort('fieldValue')}
                >
                  <div className="flex items-center gap-1">
                    Field Value
                    <SortIcon field="fieldValue" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort('sortOrder')}
                >
                  <div className="flex items-center gap-1">
                    Sort Order
                    <SortIcon field="sortOrder" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fieldTypes.map((row, idx) => (
                <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {(page - 1) * LIMIT + idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{row.fieldValue}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{row.sortOrder}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(row)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        row.isActive
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                      title="Click to toggle status"
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={deleting === row._id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{' '}
            <span className="font-semibold text-gray-800">{total}</span> field types
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchFieldTypes(page - 1, search, sortBy, sortDir)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => fetchFieldTypes(page + 1, search, sortBy, sortDir)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminFieldTypesPage
