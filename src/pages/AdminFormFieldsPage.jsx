import { useEffect, useRef, useState } from 'react'
import { adminService } from '../services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import toast from 'react-hot-toast'
import {
  Edit2, Trash2, Plus, X, Search, ChevronUp, ChevronDown, LayoutList, RefreshCw,
} from 'lucide-react'

const LIMIT = 20

// Converts a title string to snake_case field name
function toFieldName(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}

const emptyForm = {
  categoryId: '',
  categoryFilterId: '',
  fieldTypeId: '',
  filterId: '',
  fieldTitle: '',
  placeholder: '',
  fieldName: '',
  fieldOrder: '',
  formStep: '',
  validation: '',
  tableName: '',
  functionName: '',
  isActive: true,
}

function AdminFormFieldsPage() {
  const [formFields, setFormFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [fieldNameEdited, setFieldNameEdited] = useState(false)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('formStep')
  const [sortDir, setSortDir] = useState('asc')

  // Dropdown data
  const [categoryGroups, setCategoryGroups] = useState([])
  const [fieldTypes, setFieldTypes] = useState([])
  const [filters, setFilters] = useState([])
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false)
  const [categoryChildren, setCategoryChildren] = useState([])
  const [loadingCategoryChildren, setLoadingCategoryChildren] = useState(false)
  const [loadingFilters, setLoadingFilters] = useState(false)

  const formRef = useRef(null)

  // ─── Data fetching ───────────────────────────────────────────────────────────

  const fetchDropdowns = async () => {
    try {
      const res = await adminService.getFormFieldDropdowns()
      const data = res.data || {}
      setCategoryGroups(data.categoryGroups || [])
      setFieldTypes(data.fieldTypes || [])
      setDropdownsLoaded(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dropdown data')
    }
  }

  const fetchCategoryChildren = async (categoryId) => {
    if (!categoryId) { setCategoryChildren([]); return }
    setLoadingCategoryChildren(true)
    try {
      const res = await adminService.getAdminCategoryChildren({ parentId: categoryId })
      const children = Array.isArray(res.data) ? res.data : []
      setCategoryChildren(children)
    } catch (err) {
      console.error('Failed to load category children:', err)
      toast.error('Failed to load category children')
      setCategoryChildren([])
    } finally {
      setLoadingCategoryChildren(false)
    }
  }

  const fetchFiltersForCategory = async (categoryId, keepFilter = null) => {
    if (!categoryId) {
      setFilters([])
      return
    }
    setLoadingFilters(true)
    try {
      const res = await adminService.getFormFieldFilters(categoryId)
      let loaded = res.data?.filters || []
      if (
        keepFilter?._id
        && !loaded.some((f) => String(f._id) === String(keepFilter._id))
      ) {
        loaded = [...loaded, keepFilter]
      }
      setFilters(loaded)
    } catch (err) {
      console.error('Failed to load filters:', err)
      toast.error('Failed to load filters for category')
      setFilters([])
    } finally {
      setLoadingFilters(false)
    }
  }

  const handleCategoryChange = (categoryId) => {
    setForm(prev => ({ ...prev, categoryId, categoryFilterId: '', filterId: '' }))
    setErrors(prev => ({ ...prev, categoryId: undefined, fieldName: undefined, filterId: undefined }))
    setCategoryChildren([])
    setFilters([])
    fetchCategoryChildren(categoryId)
    fetchFiltersForCategory(categoryId)
  }

  const getCategoryName = (categoryId) => {
    if (!categoryId) return ''
    for (const group of categoryGroups) {
      if (String(group._id) === String(categoryId)) return group.name
      const child = group.children?.find((c) => String(c._id) === String(categoryId))
      if (child) return child.name
    }
    return 'this category'
  }

  const isDuplicateFieldName = (fieldName, categoryId, excludeId = null) => {
    const normalized = toFieldName(fieldName)
    if (!normalized || !categoryId) return false
    return formFields.some((row) => {
      if (excludeId && row._id === excludeId) return false
      const rowCategoryId = row.categoryId?._id || row.categoryId
      return String(rowCategoryId) === String(categoryId) && row.fieldName === normalized
    })
  }

  const fetchFormFields = async (p = 1, searchTerm = '', sb = sortBy, sd = sortDir) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: sb, sortDir: sd }
      if (searchTerm.trim()) params.search = searchTerm.trim()
      const res = await adminService.getFormFields(params)
      const data = res.data || {}
      setFormFields(data.formFields || [])
      setTotal(data.total || 0)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load form fields')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDropdowns()
    fetchFormFields(1, '', sortBy, sortDir)
  }, [])

  // ─── Sorting ─────────────────────────────────────────────────────────────────

  const handleSort = (field) => {
    const newDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortBy(field)
    setSortDir(newDir)
    fetchFormFields(1, search, field, newDir)
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    fetchFormFields(1, searchInput, sortBy, sortDir)
  }

  const handleClearSearch = () => {
    setSearch('')
    setSearchInput('')
    fetchFormFields(1, '', sortBy, sortDir)
  }

  // ─── Form helpers ─────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setFieldNameEdited(false)
    setCategoryChildren([])
    setFilters([])
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const openEdit = (row) => {
    setEditing(row)
    const catId = row.categoryId?._id || row.categoryId || ''
    const filterId = row.filterId?._id || row.filterId || ''
    setForm({
      categoryId: catId,
      categoryFilterId: row.categoryFilterId?._id || row.categoryFilterId || '',
      fieldTypeId: row.fieldTypeId?._id || row.fieldTypeId || '',
      filterId,
      fieldTitle: row.fieldTitle || '',
      placeholder: row.placeholder || '',
      fieldName: row.fieldName || '',
      fieldOrder: row.fieldOrder != null ? String(row.fieldOrder) : '',
      formStep: row.formStep != null ? String(row.formStep) : '',
      validation: row.validation || '',
      tableName: row.tableName || '',
      functionName: row.functionName || '',
      isActive: row.isActive !== false,
    })
    setErrors({})
    setFieldNameEdited(true)
    setCategoryChildren([])
    fetchCategoryChildren(catId)
    const keepFilter = filterId && row.filterId?.name
      ? { _id: filterId, name: row.filterId.name }
      : null
    fetchFiltersForCategory(catId, keepFilter)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setFieldNameEdited(false)
    setCategoryChildren([])
    setFilters([])
  }

  // Auto-generate fieldName from fieldTitle when not manually edited
  const handleFieldTitleChange = (val) => {
    setForm((prev) => ({
      ...prev,
      fieldTitle: val,
      fieldName: fieldNameEdited ? prev.fieldName : toFieldName(val),
    }))
    if (errors.fieldTitle || errors.fieldName) {
      setErrors((prev) => ({ ...prev, fieldTitle: undefined, fieldName: undefined }))
    }
  }

  const handleFieldNameChange = (val) => {
    setFieldNameEdited(true)
    setForm((prev) => ({ ...prev, fieldName: val }))
    if (errors.fieldName) setErrors((prev) => ({ ...prev, fieldName: undefined }))
  }

  const regenerateFieldName = () => {
    const generated = toFieldName(form.fieldTitle)
    setForm((prev) => ({ ...prev, fieldName: generated }))
    setFieldNameEdited(false)
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {}
    if (!form.categoryId) errs.categoryId = 'Category is required'
    if (!form.fieldTypeId) errs.fieldTypeId = 'Field type is required'
    if (!form.fieldTitle.trim()) errs.fieldTitle = 'Field title is required'
    if (!form.fieldName.trim()) {
      errs.fieldName = 'Field name is required'
    } else if (isDuplicateFieldName(form.fieldName, form.categoryId, editing?._id)) {
      const categoryName = getCategoryName(form.categoryId)
      errs.fieldName = `Field name "${toFieldName(form.fieldName)}" is already in use for ${categoryName}`
    }
    if (form.fieldOrder !== '' && Number.isNaN(Number(form.fieldOrder))) {
      errs.fieldOrder = 'Must be a number'
    }
    if (form.formStep !== '' && Number.isNaN(Number(form.formStep))) {
      errs.formStep = 'Must be a number'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ─── CRUD handlers ────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    try {
      setLoading(true)
      const payload = {
        categoryId: form.categoryId,
        categoryFilterId: form.categoryFilterId,
        fieldTypeId: form.fieldTypeId,
        filterId: form.filterId,
        fieldTitle: form.fieldTitle.trim(),
        placeholder: form.placeholder.trim(),
        fieldName: form.fieldName.trim(),
        fieldOrder: form.fieldOrder === '' ? 0 : Number(form.fieldOrder),
        formStep: form.formStep === '' ? 1 : Number(form.formStep),
        validation: form.validation.trim(),
        tableName: form.tableName.trim(),
        functionName: form.functionName.trim(),
        isActive: form.isActive,
      }
      if (editing) {
        await adminService.updateFormField(editing._id, payload)
        toast.success('Form field updated')
      } else {
        await adminService.createFormField(payload)
        toast.success('Form field created')
      }
      closeForm()
      fetchFormFields(editing ? page : 1, search, sortBy, sortDir)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save form field'
      toast.error(msg)
      if (msg.toLowerCase().includes('field name')) {
        setErrors((prev) => ({ ...prev, fieldName: msg }))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row) => {
    try {
      await adminService.updateFormField(row._id, { isActive: !row.isActive })
      toast.success(row.isActive ? 'Set inactive' : 'Set active')
      fetchFormFields(page, search, sortBy, sortDir)
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
      if (editing?._id === row._id) closeForm()
      fetchFormFields(page, search, sortBy, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronUp className="h-3 w-3 text-gray-300 shrink-0" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-indigo-500 shrink-0" />
      : <ChevronDown className="h-3 w-3 text-indigo-500 shrink-0" />
  }

  const totalPages = Math.ceil(total / LIMIT)

  const inputCls = (field) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Form Fields"
        subtitle="Manage dynamic form fields linked to categories, field types and filters"
        action={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium transition"
          >
            <Plus className="h-4 w-4" />
            Add Form Field
          </button>
        }
      />

      {/* ── Search ── */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by field title or name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition">
          Search
        </button>
        {(search || searchInput) && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-1 transition"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </form>

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <div ref={formRef} className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-200">
            <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              {editing ? `Edit: ${editing.fieldTitle}` : 'Add New Form Field'}
            </h2>
            <button type="button" onClick={closeForm} className="text-indigo-400 hover:text-indigo-700 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Row 1: Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={inputCls('categoryId')}
                >
                  <option value="">— Select Category —</option>
                  {categoryGroups.map((group) => (
                    <optgroup key={group._id} label={group.name}>
                      <option value={group._id}>{group.name} (root)</option>
                      {group.children.map((child) => (
                        <option key={child._id} value={child._id}>
                          {'└ ' + child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.categoryId && <p className="mt-1 text-xs text-red-500">{errors.categoryId}</p>}
                {!dropdownsLoaded && <p className="mt-1 text-xs text-gray-400">Loading…</p>}
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Category Filter
                  <span className="ml-1 text-gray-400 font-normal">(child of Category)</span>
                </label>
                <select
                  value={form.categoryFilterId}
                  onChange={(e) => setForm(prev => ({ ...prev, categoryFilterId: e.target.value }))}
                  disabled={!form.categoryId || loadingCategoryChildren}
                  className={`${inputCls('categoryFilterId')} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {loadingCategoryChildren
                      ? 'Loading…'
                      : !form.categoryId
                      ? '— Select Category first —'
                      : categoryChildren.length === 0
                      ? '— No children —'
                      : '— Select Category Filter —'}
                  </option>
                  {categoryChildren.map((c) => (
                    <option key={String(c._id)} value={String(c._id)}>{c.name}</option>
                  ))}
                </select>
                {!loadingCategoryChildren && form.categoryId && categoryChildren.length === 0 && (
                  <p className="mt-1 text-xs text-amber-500">This category has no sub-categories.</p>
                )}
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Field Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.fieldTypeId}
                  onChange={(e) => { setForm({ ...form, fieldTypeId: e.target.value }); setErrors({ ...errors, fieldTypeId: undefined }) }}
                  className={inputCls('fieldTypeId')}
                >
                  <option value="">— Select Field Type —</option>
                  {fieldTypes.map((ft) => (
                    <option key={ft._id} value={ft._id}>{ft.fieldValue}</option>
                  ))}
                </select>
                {errors.fieldTypeId && <p className="mt-1 text-xs text-red-500">{errors.fieldTypeId}</p>}
              </div>

              {/* Filter */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Filter
                  <span className="ml-1 text-gray-400 font-normal">(Root only)</span>
                </label>
                <select
                  value={form.filterId}
                  onChange={(e) => { setForm({ ...form, filterId: e.target.value }); setErrors({ ...errors, filterId: undefined }) }}
                  disabled={!form.categoryId || loadingFilters}
                  className={`${inputCls('filterId')} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {loadingFilters
                      ? 'Loading…'
                      : !form.categoryId
                      ? '— Select Category first —'
                      : filters.length === 0
                      ? '— No filters for this category —'
                      : '— Select Filter —'}
                  </option>
                  {filters.map((f) => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
                {!loadingFilters && form.categoryId && filters.length === 0 && (
                  <p className="mt-1 text-xs text-amber-500">No root filters assigned to this category.</p>
                )}
                {errors.filterId && <p className="mt-1 text-xs text-red-500">{errors.filterId}</p>}
              </div>
            </div>

            {/* Row 2: Titles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Field Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fieldTitle}
                  onChange={(e) => handleFieldTitleChange(e.target.value)}
                  placeholder="e.g. Full Name"
                  autoFocus
                  className={inputCls('fieldTitle')}
                />
                {errors.fieldTitle && <p className="mt-1 text-xs text-red-500">{errors.fieldTitle}</p>}
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Placeholder</label>
                <input
                  type="text"
                  value={form.placeholder}
                  onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                  placeholder="e.g. Enter your full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Row 3: Field Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Field Name <span className="text-red-500">*</span>
                <span className="ml-1 text-gray-400 font-normal">— unique per category, auto-generated from title</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.fieldName}
                  onChange={(e) => handleFieldNameChange(e.target.value)}
                  placeholder="auto_generated_name"
                  className={`flex-1 ${inputCls('fieldName')} font-mono`}
                />
                <button
                  type="button"
                  onClick={regenerateFieldName}
                  title="Re-generate from title"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {errors.fieldName && <p className="mt-1 text-xs text-red-500">{errors.fieldName}</p>}
              <p className="mt-1 text-xs text-gray-400">
                Only lowercase letters, numbers and underscores. The same name can be reused in different categories.
              </p>
            </div>

            {/* Row 4: Numeric fields + Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Form Step</label>
                <input
                  type="number"
                  value={form.formStep}
                  onChange={(e) => { setForm({ ...form, formStep: e.target.value }); setErrors({ ...errors, formStep: undefined }) }}
                  placeholder="1"
                  min={1}
                  className={inputCls('formStep')}
                />
                {errors.formStep && <p className="mt-1 text-xs text-red-500">{errors.formStep}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Field Order</label>
                <input
                  type="number"
                  value={form.fieldOrder}
                  onChange={(e) => { setForm({ ...form, fieldOrder: e.target.value }); setErrors({ ...errors, fieldOrder: undefined }) }}
                  placeholder="0"
                  min={0}
                  className={inputCls('fieldOrder')}
                />
                {errors.fieldOrder && <p className="mt-1 text-xs text-red-500">{errors.fieldOrder}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
                <select
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Row 5: Validation + Table Name + Function Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Validation Rules
                  <span className="ml-1 text-gray-400 font-normal">e.g. required|min:2|max:100|email</span>
                </label>
                <textarea
                  value={form.validation}
                  onChange={(e) => setForm({ ...form, validation: e.target.value })}
                  placeholder="required|min:2|max:255"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Table Name</label>
                <input
                  type="text"
                  value={form.tableName}
                  onChange={(e) => setForm({ ...form, tableName: e.target.value })}
                  placeholder="e.g. products, users"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Function Name</label>
                <input
                  type="text"
                  value={form.functionName}
                  onChange={(e) => setForm({ ...form, functionName: e.target.value })}
                  placeholder="e.g. calculatePrice"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Form footer */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {loading ? 'Saving…' : editing ? 'Update Form Field' : 'Create Form Field'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
            <p className="text-sm font-semibold text-gray-700">No form fields found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? `No results for "${search}"` : 'Click "Add Form Field" to create the first one.'}
            </p>
            {!showForm && (
              <button
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" /> Add Form Field
              </button>
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
                          onClick={() => openEdit(row)}
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
      </div>

      {/* ── Pagination ── */}
      {total > LIMIT && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{' '}
            <span className="font-semibold text-gray-800">{total}</span> form fields
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchFormFields(page - 1, search, sortBy, sortDir)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => fetchFormFields(page + 1, search, sortBy, sortDir)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminFormFieldsPage
