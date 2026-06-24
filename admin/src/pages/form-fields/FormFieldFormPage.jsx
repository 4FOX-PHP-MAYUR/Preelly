import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Textarea from '../../components/AdminUI/Textarea'
import Checkbox from '../../components/AdminUI/Checkbox'
import FormSection from '../../components/AdminUI/FormSection'
import Button from '../../components/AdminUI/Button'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

const LIST_PATH = '/admin/form-fields'

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
  childCategoryId: '',
  fieldTypeId: '',
  filterId: '',
  fieldTitle: '',
  placeholder: '',
  fieldName: '',
  fieldOrder: '',
  formStep: '',
  validation: '',
  tableName: '',
  tableConfig: {
    valueColumn: '',
    labelColumn: '',
    parentColumn: '',
    statusColumn: '',
    sortColumn: '',
    slugColumn: '',
  },
  functionName: '',
  isActive: true,
  showOnQuickView: false,
}

function rowToForm(row) {
  const catId = row.categoryId?._id || row.categoryId || ''
  const filterId = row.filterId?._id || row.filterId || ''
  return {
    categoryId: catId,
    categoryFilterId: row.categoryFilterId?._id || row.categoryFilterId || '',
    childCategoryId: row.childCategoryId?._id || row.childCategoryId || '',
    fieldTypeId: row.fieldTypeId?._id || row.fieldTypeId || '',
    filterId,
    fieldTitle: row.fieldTitle || '',
    placeholder: row.placeholder || '',
    fieldName: row.fieldName || '',
    fieldOrder: row.fieldOrder != null ? String(row.fieldOrder) : '',
    formStep: row.formStep != null ? String(row.formStep) : '',
    validation: row.validation || '',
    tableName: row.tableName || '',
    tableConfig: {
      valueColumn: row.tableConfig?.valueColumn || '',
      labelColumn: row.tableConfig?.labelColumn || '',
      parentColumn: row.tableConfig?.parentColumn || '',
      statusColumn: row.tableConfig?.statusColumn || '',
      sortColumn: row.tableConfig?.sortColumn || '',
      slugColumn: row.tableConfig?.slugColumn || '',
    },
    functionName: row.functionName || '',
    isActive: row.isActive !== false,
    showOnQuickView: row.showOnQuickView === true,
  }
}

function FormFieldFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [fieldNameEdited, setFieldNameEdited] = useState(false)
  const [scopeFormFields, setScopeFormFields] = useState([])

  const [categoryGroups, setCategoryGroups] = useState([])
  const [fieldTypes, setFieldTypes] = useState([])
  const [filters, setFilters] = useState([])
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false)
  const [categoryChildren, setCategoryChildren] = useState([])
  const [childCategoryChildren, setChildCategoryChildren] = useState([])
  const [loadingCategoryChildren, setLoadingCategoryChildren] = useState(false)
  const [loadingChildCategoryChildren, setLoadingChildCategoryChildren] = useState(false)
  const [loadingFilters, setLoadingFilters] = useState(false)

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

  const fetchCategoryChildren = async (categoryId, { setChildren = setCategoryChildren, setLoading = setLoadingCategoryChildren } = {}) => {
    if (!categoryId) {
      setChildren([])
      return []
    }
    setLoading(true)
    try {
      const res = await adminService.getAdminCategoryChildren({ parentId: categoryId })
      const children = Array.isArray(res.data) ? res.data : []
      setChildren(children)
      return children
    } catch (err) {
      console.error('Failed to load category children:', err)
      toast.error('Failed to load category children')
      setChildren([])
      return []
    } finally {
      setLoading(false)
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

  const resolveFilterCategoryId = (categoryId, categoryFilterId, childCategoryId) => (
    childCategoryId || categoryFilterId || categoryId
  )

  const fetchScopeFormFields = useCallback(async (categoryId) => {
    if (!categoryId) {
      setScopeFormFields([])
      return
    }
    try {
      const res = await adminService.getFormFields({ categoryId, limit: 500, page: 1 })
      setScopeFormFields(res.data?.formFields || [])
    } catch {
      setScopeFormFields([])
    }
  }, [])

  const handleCategoryChange = async (categoryId) => {
    setForm((prev) => ({
      ...prev,
      categoryId,
      categoryFilterId: '',
      childCategoryId: '',
      filterId: '',
    }))
    setErrors((prev) => ({ ...prev, categoryId: undefined, fieldName: undefined, filterId: undefined }))
    setCategoryChildren([])
    setChildCategoryChildren([])
    setFilters([])
    await fetchCategoryChildren(categoryId)
    if (categoryId) {
      fetchFiltersForCategory(categoryId)
      fetchScopeFormFields(categoryId)
    } else {
      setScopeFormFields([])
    }
  }

  const handleCategoryFilterChange = async (categoryFilterId) => {
    setForm((prev) => {
      const filterCategoryId = resolveFilterCategoryId(prev.categoryId, categoryFilterId, '')
      if (filterCategoryId) {
        fetchFiltersForCategory(filterCategoryId)
      } else {
        setFilters([])
      }
      return {
        ...prev,
        categoryFilterId,
        childCategoryId: '',
        filterId: '',
      }
    })
    setChildCategoryChildren([])
    if (categoryFilterId) {
      await fetchCategoryChildren(categoryFilterId, {
        setChildren: setChildCategoryChildren,
        setLoading: setLoadingChildCategoryChildren,
      })
    }
    setErrors((prev) => ({ ...prev, filterId: undefined }))
  }

  const handleChildCategoryChange = (childCategoryId) => {
    setForm((prev) => {
      const filterCategoryId = resolveFilterCategoryId(
        prev.categoryId,
        prev.categoryFilterId,
        childCategoryId
      )
      if (filterCategoryId) {
        fetchFiltersForCategory(filterCategoryId)
      } else {
        setFilters([])
      }
      return { ...prev, childCategoryId, filterId: '' }
    })
    setErrors((prev) => ({ ...prev, filterId: undefined }))
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

  const getFormFieldScopeLabel = (categoryId, categoryFilterId = '', childCategoryId = '') => {
    const categoryName = getCategoryName(categoryId)
    if (!categoryFilterId && !childCategoryId) return categoryName
    const filterName = categoryChildren.find((c) => String(c._id) === String(categoryFilterId))?.name
      || getCategoryName(categoryFilterId)
    if (!childCategoryId) {
      return categoryFilterId ? `${categoryName} → ${filterName}` : categoryName
    }
    const childName = childCategoryChildren.find((c) => String(c._id) === String(childCategoryId))?.name
      || getCategoryName(childCategoryId)
    return `${categoryName} → ${filterName} → ${childName}`
  }

  const isDuplicateFieldName = (
    fieldName,
    categoryId,
    categoryFilterId = '',
    childCategoryId = '',
    excludeId = null
  ) => {
    const normalized = toFieldName(fieldName)
    if (!normalized || !categoryId) return false
    return scopeFormFields.some((row) => {
      if (excludeId && row._id === excludeId) return false
      const rowCategoryId = row.categoryId?._id || row.categoryId
      const rowCategoryFilterId = row.categoryFilterId?._id || row.categoryFilterId || ''
      const rowChildCategoryId = row.childCategoryId?._id || row.childCategoryId || ''
      if (String(rowCategoryId) !== String(categoryId)) return false
      if (String(rowCategoryFilterId || '') !== String(categoryFilterId || '')) return false
      if (String(rowChildCategoryId || '') !== String(childCategoryId || '')) return false
      return row.fieldName === normalized
    })
  }

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

  const validate = () => {
    const errs = {}
    if (!form.categoryId) errs.categoryId = 'Category is required'
    if (!form.fieldTypeId) errs.fieldTypeId = 'Field type is required'
    if (!form.fieldTitle.trim()) errs.fieldTitle = 'Field title is required'
    if (!form.fieldName.trim()) {
      errs.fieldName = 'Field name is required'
    } else if (isDuplicateFieldName(
      form.fieldName,
      form.categoryId,
      form.categoryFilterId,
      form.childCategoryId,
      isEdit ? id : null
    )) {
      const scopeLabel = getFormFieldScopeLabel(
        form.categoryId,
        form.categoryFilterId,
        form.childCategoryId
      )
      errs.fieldName = `Field name "${toFieldName(form.fieldName)}" is already in use for ${scopeLabel}`
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

  const handleSave = async () => {
    if (!validate()) return
    try {
      setLoading(true)
      const payload = {
        categoryId: form.categoryId,
        categoryFilterId: form.categoryFilterId,
        childCategoryId: form.childCategoryId,
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
        showOnQuickView: form.showOnQuickView,
      }
      const tc = form.tableConfig || {}
      const hasTableConfig = Object.values(tc).some((v) => String(v || '').trim())
      if (hasTableConfig) {
        payload.tableConfig = Object.fromEntries(
          Object.entries(tc).filter(([, v]) => String(v || '').trim())
        )
      }
      if (isEdit) {
        await adminService.updateFormField(id, payload)
        toast.success('Form field updated')
      } else {
        await adminService.createFormField(payload)
        toast.success('Form field created')
      }
      navigate(LIST_PATH)
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

  useEffect(() => {
    fetchDropdowns()
  }, [])

  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getFormFieldById(id)
        const row = res.data
        if (!row) throw new Error('Form field not found')
        if (cancelled) return

        setForm(rowToForm(row))
        setErrors({})
        setFieldNameEdited(true)
        setCategoryChildren([])
        setChildCategoryChildren([])

        const catId = row.categoryId?._id || row.categoryId || ''
        const catFilterId = row.categoryFilterId?._id || row.categoryFilterId || ''
        const childCatId = row.childCategoryId?._id || row.childCategoryId || ''
        const filterId = row.filterId?._id || row.filterId || ''
        const keepFilter = filterId && row.filterId?.name
          ? { _id: filterId, name: row.filterId.name }
          : null

        await fetchCategoryChildren(catId)
        if (catFilterId) {
          await fetchCategoryChildren(catFilterId, {
            setChildren: setChildCategoryChildren,
            setLoading: setLoadingChildCategoryChildren,
          })
        }
        const filterCategoryId = resolveFilterCategoryId(catId, catFilterId, childCatId)
        if (filterCategoryId) {
          await fetchFiltersForCategory(filterCategoryId, keepFilter)
        }
        await fetchScopeFormFields(catId)
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load form field')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate, fetchScopeFormFields])

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Form Field' : 'Add Form Field'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Form Field' : 'Add New Form Field'}
      subtitle="Configure dynamic form field linked to category, field type and filters"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Update Form Field' : 'Create Form Field'}
    >
      <FormSection title="Category & type">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            label="Category"
            required
            value={form.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            error={errors.categoryId}
            placeholder="— Select Category —"
          >
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
          </Select>
          {!dropdownsLoaded && <p className="text-xs text-gray-400 lg:col-span-5">Loading dropdowns…</p>}

          <Select
            label="Category Filter"
            hint="Child of Category"
            value={form.categoryFilterId}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            disabled={!form.categoryId || loadingCategoryChildren}
            placeholder={
              loadingCategoryChildren
                ? 'Loading…'
                : !form.categoryId
                ? '— Select Category first —'
                : categoryChildren.length === 0
                ? '— No children —'
                : '— Select Category Filter —'
            }
          >
            {categoryChildren.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>{c.name}</option>
            ))}
          </Select>
          {!loadingCategoryChildren && form.categoryId && categoryChildren.length === 0 && (
            <p className="text-xs text-amber-500 lg:col-span-5">This category has no sub-categories.</p>
          )}

          <Select
            label="Child Category"
            hint="Child of Category Filter"
            value={form.childCategoryId}
            onChange={(e) => handleChildCategoryChange(e.target.value)}
            disabled={!form.categoryFilterId || loadingChildCategoryChildren}
            placeholder={
              loadingChildCategoryChildren
                ? 'Loading…'
                : !form.categoryFilterId
                ? '— Select Category Filter first —'
                : childCategoryChildren.length === 0
                ? '— No children —'
                : '— Select Child Category —'
            }
          >
            {childCategoryChildren.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>{c.name}</option>
            ))}
          </Select>
          {!loadingChildCategoryChildren && form.categoryFilterId && childCategoryChildren.length === 0 && (
            <p className="text-xs text-amber-500 lg:col-span-5">This category filter has no sub-categories.</p>
          )}

          <Select
            label="Field Type"
            required
            value={form.fieldTypeId}
            onChange={(e) => {
              setForm({ ...form, fieldTypeId: e.target.value })
              setErrors({ ...errors, fieldTypeId: undefined })
            }}
            error={errors.fieldTypeId}
            placeholder="— Select Field Type —"
            options={fieldTypes.map((ft) => ({ value: ft._id, label: ft.fieldValue }))}
          />

          <Select
            label="Filter"
            hint="Root only"
            value={form.filterId}
            onChange={(e) => {
              setForm({ ...form, filterId: e.target.value })
              setErrors({ ...errors, filterId: undefined })
            }}
            disabled={!form.categoryId || loadingFilters}
            error={errors.filterId}
            placeholder={
              loadingFilters
                ? 'Loading…'
                : !form.categoryId
                ? '— Select Category first —'
                : filters.length === 0
                ? '— No filters for this category —'
                : '— Select Filter —'
            }
            options={filters.map((f) => ({ value: f._id, label: f.name }))}
          />
          {!loadingFilters && form.categoryId && filters.length === 0 && (
            <p className="text-xs text-amber-500 lg:col-span-5">No root filters assigned to this category.</p>
          )}
        </div>
      </FormSection>

      <FormSection title="Field details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Field Title"
            required
            value={form.fieldTitle}
            onChange={(e) => handleFieldTitleChange(e.target.value)}
            placeholder="e.g. Full Name"
            error={errors.fieldTitle}
            autoFocus={!isEdit}
          />
          <Input
            label="Placeholder"
            value={form.placeholder}
            onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
            placeholder="e.g. Enter your full name"
          />
        </div>

        <div>
          <Input
            label="Field Name"
            required
            value={form.fieldName}
            onChange={(e) => handleFieldNameChange(e.target.value)}
            placeholder="auto_generated_name"
            error={errors.fieldName}
            hint="Unique per category filter scope, auto-generated from title. Only lowercase letters, numbers and underscores."
            inputClassName="font-mono"
          />
          <div className="mt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={regenerateFieldName}
            >
              Re-generate from title
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Form Step"
            type="number"
            value={form.formStep}
            onChange={(e) => {
              setForm({ ...form, formStep: e.target.value })
              setErrors({ ...errors, formStep: undefined })
            }}
            placeholder="1"
            min={1}
            error={errors.formStep}
          />
          <Input
            label="Field Order"
            type="number"
            value={form.fieldOrder}
            onChange={(e) => {
              setForm({ ...form, fieldOrder: e.target.value })
              setErrors({ ...errors, fieldOrder: undefined })
            }}
            placeholder="0"
            min={0}
            error={errors.fieldOrder}
          />
          <div className="sm:col-span-2">
            <Select
              label="Status"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Advanced configuration">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Textarea
            label="Validation Rules"
            hint="e.g. required|min:2|max:100|email"
            value={form.validation}
            onChange={(e) => setForm({ ...form, validation: e.target.value })}
            placeholder="required|min:2|max:255"
            rows={2}
            className="font-mono"
          />
          <Input
            label="Table Name"
            value={form.tableName}
            onChange={(e) => setForm({ ...form, tableName: e.target.value })}
            placeholder="e.g. filters, categories, emirates"
            hint="Registered: filters, categories, emirates"
          />
          <Input
            label="Function Name"
            value={form.functionName}
            onChange={(e) => setForm({ ...form, functionName: e.target.value })}
            placeholder="e.g. calculatePrice"
          />
        </div>

        {form.tableName.trim() && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-900 p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
              Dynamic Option Source Config
              <span className="ml-2 font-normal text-indigo-600 dark:text-indigo-400">
                Optional — leave blank to use table defaults. Example for emirates: valueColumn=id, labelColumn=name, statusColumn=status, sortColumn=name
              </span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['valueColumn', 'labelColumn', 'parentColumn', 'statusColumn', 'sortColumn', 'slugColumn'].map((key) => (
                <Input
                  key={key}
                  label={key}
                  value={form.tableConfig?.[key] || ''}
                  onChange={(e) => setForm({
                    ...form,
                    tableConfig: { ...form.tableConfig, [key]: e.target.value },
                  })}
                  inputClassName="font-mono text-sm"
                />
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <Checkbox
        label="Show On Quick View"
        checked={form.showOnQuickView}
        onChange={(e) => setForm({ ...form, showOnQuickView: e.target.checked })}
      />
    </AdminFormShell>
  )
}

export default FormFieldFormPage
