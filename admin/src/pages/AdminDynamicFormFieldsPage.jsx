import { useEffect, useState, useCallback } from 'react'
import { adminService } from '@shared/services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import toast from 'react-hot-toast'
import { Edit2, Trash2, Plus, X, ChevronDown } from 'lucide-react'

const EMPTY_FORM = {
  categoryId: '',
  fieldTypeId: '',
  filterId: '',
  fieldTitle: '',
  placeholder: '',
  fieldName: '',
  fieldOrder: 0,
  formStep: '',
}

// Build a tree from a flat category list and return root nodes with nested children
function buildTree(flat) {
  const byId = new Map()
  flat.forEach((c) => byId.set(String(c._id), { ...c, children: [] }))
  const roots = []
  flat.forEach((c) => {
    const node = byId.get(String(c._id))
    const pid = c.parentId ? String(c.parentId) : null
    if (pid && byId.has(pid)) {
      byId.get(pid).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}


function flattenForOptions(nodes, depth = 1) {
  const result = []
  for (const node of nodes) {
    result.push({ ...node, depth })
    if (node.children && node.children.length) {
      result.push(...flattenForOptions(node.children, depth + 1))
    }
  }
  return result
}

function AdminDynamicFormFieldsPage() {
  const [fields, setFields] = useState([])
  // Full category tree roots for grouped dropdown rendering
  const [categoryTree, setCategoryTree] = useState([])
  const [fieldTypes, setFieldTypes] = useState([])
  const [filtersForDropdown, setFiltersForDropdown] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [deleting, setDeleting] = useState(null)

  // persistAcrossRoutes:true stops the route-scope AbortController from cancelling
  // these requests when the page first mounts (fixes empty listing / empty dropdowns).
  const PERSIST = { persistAcrossRoutes: true }

  const fetchFields = useCallback(async (searchTerm = '', catId = '') => {
    try {
      setLoading(true)
      const params = { limit: 100 }
      if (searchTerm.trim()) params.search = searchTerm.trim()
      if (catId) params.categoryId = catId
      const res = await adminService.getDynamicFormFields(params, PERSIST)
      setFields(res.data.fields || [])
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
      console.error('fetchFields error:', err)
      toast.error('Failed to load form fields')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFields()

    // Fetch only level-0 (roots) + level-1 (direct subcategories) for the dropdown.
    // Fetching all 11k+ categories causes pagination cut-off; levels 0+1 cover all
    // valid form-field assignments and are always complete (4 roots, ~20 subcats).
    Promise.all([
      adminService.getAdminCategories({ limit: 200, level: 0 }, PERSIST),
      adminService.getAdminCategories({ limit: 500, level: 1 }, PERSIST),
    ])
      .then(([rootsRes, subsRes]) => {
        const roots = rootsRes.data.categories || []
        const subs = subsRes.data.categories || []
        setCategoryTree(buildTree([...roots, ...subs]))
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        toast.error('Failed to load categories')
      })

    adminService
      .getFieldTypes({ limit: 500 }, PERSIST)
      .then((r) => setFieldTypes(r.data.fieldTypes || []))
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        toast.error('Failed to load field types')
      })

    // Load all non-deleted filters for the Filters dropdown
    adminService
      .getFilterParentOptions({}, PERSIST)
      .then((r) => {
        const data = r.data || {}
        setFiltersForDropdown(Array.isArray(data.options) ? data.options : [])
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
      })
  }, [fetchFields]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault()
    fetchFields(search, filterCategory)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (field) => {
    setFormErrors({})
    setEditing(field)
    setForm({
      categoryId: field.categoryId?._id || field.categoryId || '',
      fieldTypeId: field.fieldTypeId?._id || field.fieldTypeId || '',
      filterId: field.filterId?._id || field.filterId || '',
      fieldTitle: field.fieldTitle || '',
      placeholder: field.placeholder || '',
      fieldName: field.fieldName || '',
      fieldOrder: field.fieldOrder ?? 0,
      formStep: field.formStep || '',
    })
    setShowForm(true)
  }

  const validateForm = () => {
    const errors = {}
    if (!form.categoryId) errors.categoryId = 'Category is required'
    if (!form.fieldTypeId) errors.fieldTypeId = 'Field type is required'
    if (!form.fieldTitle.trim()) errors.fieldTitle = 'Field title is required'
    if (!form.fieldName.trim()) errors.fieldName = 'Field name is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const clearFieldError = (key) => {
    if (formErrors[key]) setFormErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload = { ...form }

    try {
      setSubmitting(true)
      if (editing) {
        await adminService.updateDynamicFormField(editing._id, payload)
        toast.success('Form field updated successfully')
      } else {
        await adminService.createDynamicFormField(payload)
        toast.success('Form field created successfully')
      }
      setShowForm(false)
      setEditing(null)
      setFormErrors({})
      fetchFields(search, filterCategory)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save form field')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this form field?')) return
    try {
      setDeleting(id)
      await adminService.deleteDynamicFormField(id)
      toast.success('Form field deleted')
      fetchFields(search, filterCategory)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete form field')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Dynamic Form Fields"
        subtitle="Configure form fields per category for post-ad dynamic forms"
        action={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>
        }
      />

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or field name..."
          className="flex-1 min-w-[180px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); fetchFields(search, e.target.value) }}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
          >
            <option value="">All Categories</option>
            {categoryTree.map((root) => (
              <optgroup key={root._id} label={root.name}>
                {root.children.map((child) => (
                  <option key={child._id} value={child._id}>{child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Search
        </button>
        {(search || filterCategory) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilterCategory(''); fetchFields('', '') }}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Clear
          </button>
        )}
      </form>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? 'Edit Form Field' : 'Create New Form Field'}
            </h2>
            <button onClick={() => { setShowForm(false); setFormErrors({}) }} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Category + Field Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.categoryId}
                    onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); clearFieldError('categoryId') }}
                    className={`w-full appearance-none pl-3 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white ${formErrors.categoryId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  >
                    <option value="">-- Select Category --</option>
                    {categoryTree.map((root) => (
                      <optgroup key={root._id} label={root.name}>
                        <option value={root._id}>{root.name} (root)</option>
                        {(root.children || []).map((child) => (
                          <option key={child._id} value={child._id}>
                            &nbsp;&nbsp;└ {child.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {formErrors.categoryId && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-500 text-white text-center leading-3.5 font-bold flex-shrink-0">!</span>
                    {formErrors.categoryId}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.fieldTypeId}
                    onChange={(e) => { setForm({ ...form, fieldTypeId: e.target.value }); clearFieldError('fieldTypeId') }}
                    className={`w-full appearance-none pl-3 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white ${formErrors.fieldTypeId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  >
                    <option value="">-- Select Field Type --</option>
                    {fieldTypes.map((ft) => (
                      <option key={ft._id} value={ft._id}>{ft.fieldValue}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {formErrors.fieldTypeId && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-500 text-white text-center leading-3.5 font-bold flex-shrink-0">!</span>
                    {formErrors.fieldTypeId}
                  </p>
                )}
              </div>
            </div>

            {/* Row 1b: Filter (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter <span className="text-xs text-gray-400 font-normal">(optional — link to a filter from the Filters module)</span>
              </label>
              <div className="relative">
                <select
                  value={form.filterId}
                  onChange={(e) => setForm({ ...form, filterId: e.target.value })}
                  className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                >
                  <option value="">-- No Filter (none) --</option>
                  {filtersForDropdown.filter((f) => f.isRoot).map((f) => (
                    <option key={String(f._id)} value={String(f._id)}>
                      {f.name}{f.childCount > 0 ? ` (${f.childCount} values)` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              {filtersForDropdown.filter((f) => f.isRoot).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No parent filters found — add filters in the Filters module first.</p>
              )}
            </div>

            {/* Row 2: Field Title + Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fieldTitle}
                  onChange={(e) => { setForm({ ...form, fieldTitle: e.target.value }); clearFieldError('fieldTitle') }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${formErrors.fieldTitle ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="e.g. Vehicle Brand"
                />
                {formErrors.fieldTitle && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.fieldTitle}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={form.placeholder}
                  onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Enter vehicle brand"
                />
              </div>
            </div>

            {/* Row 3: Field Name + Field Order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fieldName}
                  onChange={(e) => { setForm({ ...form, fieldName: e.target.value }); clearFieldError('fieldName') }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${formErrors.fieldName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="e.g. vehicle_brand"
                />
                {formErrors.fieldName && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.fieldName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Order</label>
                <input
                  type="number"
                  value={form.fieldOrder}
                  onChange={(e) => setForm({ ...form, fieldOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Form Step */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form Step</label>
              <input
                type="text"
                value={form.formStep}
                onChange={(e) => setForm({ ...form, formStep: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Step 1, Basic Info, Details…"
              />
            </div>

            {/* Submit */}
            <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {editing ? 'Updating…' : 'Creating…'}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {editing ? 'Update Field' : 'Create Field'}
                    </>
                  )}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading form fields...</p>
          </div>
        ) : fields.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Plus className="h-7 w-7 text-indigo-400" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">No form fields yet</p>
            <p className="text-sm text-gray-400 mb-5">
              {(search || filterCategory) ? 'No fields match your search. Try clearing the filter.' : 'Click "+ Add Field" above to create your first dynamic form field.'}
            </p>
            {!showForm && !search && !filterCategory && (
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition"
              >
                <Plus className="h-4 w-4" />
                Add First Field
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Step</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fields.map((field, index) => (
                  <tr key={field._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {field.categoryId?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {field.fieldTypeId?.fieldValue || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {field.filterId ? (
                        <div className="flex items-center gap-1.5">
                          {field.filterId.colorCode && (
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-gray-200 flex-shrink-0"
                              style={{ backgroundColor: field.filterId.colorCode }}
                            />
                          )}
                          <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {field.filterId.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{field.fieldTitle}</div>
                      {field.placeholder && (
                        <div className="text-xs text-gray-400 mt-0.5">"{field.placeholder}"</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                        {field.fieldName}
                      </code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {field.formStep || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {field.fieldOrder ?? 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(field)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(field._id)}
                          disabled={deleting === field._id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
      </div>
    </div>
  )
}

export default AdminDynamicFormFieldsPage
