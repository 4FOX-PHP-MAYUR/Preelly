import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Checkbox from '../../components/AdminUI/Checkbox'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'
import { ChevronRight, ChevronDown, Layers, X } from 'lucide-react'

const LIST_PATH = '/admin/filters'

const emptyForm = {
  name: '',
  parentId: '',
  sortOrder: 0,
  isActive: true,
  colorCode: '',
  thumbFile: null,
  thumbPreview: '',
  clearThumb: false,
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

const LEVEL_LABELS = ['Category', 'Sub-category', 'Type', 'Sub-type']
const getLevelLabel = (depth) => LEVEL_LABELS[depth] || `Level ${depth + 1}`

function FilterFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [nestedCategoryRoots, setNestedCategoryRoots] = useState([])
  const [formCategoryPath, setFormCategoryPath] = useState([])
  const [formFilterOptions, setFormFilterOptions] = useState([])

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

  const fetchNestedCategoryTree = async () => {
    try {
      const res = await adminService.getAdminCategoryNestedForFilters()
      const payload = res.data || {}
      const roots = Array.isArray(payload.categories) ? payload.categories : []
      setNestedCategoryRoots(roots)
    } catch (err) {
      console.error(err)
      setNestedCategoryRoots([])
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

  const applyRowToForm = (row) => {
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
  }

  useEffect(() => {
    fetchNestedCategoryTree()
  }, [])

  useEffect(() => {
    if (isEdit) {
      let cancelled = false
      const load = async () => {
        try {
          setLoadingRecord(true)

          const stateFilter = location.state?.filter
          if (stateFilter && String(stateFilter._id) === String(id)) {
            if (!cancelled) applyRowToForm(stateFilter)
            return
          }

          const res = await adminService.getAdminFilters({ limit: 500 })
          const data = res.data || {}
          const items = data.filters || data.data || []
          const row = items.find((f) => String(f._id) === String(id))
          if (!row) throw new Error('Filter not found')
          if (!cancelled) applyRowToForm(row)
        } catch (err) {
          toast.error(err.response?.data?.message || err.message || 'Failed to load filter')
          navigate(LIST_PATH)
        } finally {
          if (!cancelled) setLoadingRecord(false)
        }
      }
      load()
      return () => {
        cancelled = true
      }
    }

    const initialPath = Array.isArray(location.state?.categoryPath)
      ? location.state.categoryPath.filter(Boolean)
      : []
    setFormCategoryPath(initialPath)
    if (initialPath.length) fetchFormFilterTree(initialPath)
    setLoadingRecord(false)
  }, [id, isEdit, navigate, location.state])

  const handleThumbChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((p) => ({ ...p, thumbFile: null, thumbPreview: '', clearThumb: false }))
      return
    }
    setForm((p) => ({
      ...p,
      thumbFile: file,
      thumbPreview: URL.createObjectURL(file),
      clearThumb: false,
    }))
  }

  const handleFormCategoryChange = async (depth, value) => {
    const next = formCategoryPath.slice(0, depth)
    if (value) next[depth] = value
    setFormCategoryPath(next)
    setForm((p) => ({ ...p, parentId: '' }))
    await fetchFormFilterTree(next)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Filter name is required')
      return
    }
    try {
      setLoading(true)
      const payload = {
        name: form.name.trim(),
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

      if (isEdit) {
        await adminService.updateAdminFilter(id, payload)
        toast.success('Filter updated')
      } else {
        await adminService.createAdminFilter(payload)
        toast.success('Filter created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const selectedCategoryLabel = formCategoryPath.filter(Boolean).length
    ? categoryLabelById.get(formCategoryPath.filter(Boolean).at(-1)) || ''
    : ''

  const formSubtitle = isEdit
    ? editing?.name
      ? `Editing "${editing.name}"`
      : 'Update filter details'
    : selectedCategoryLabel
    ? `Will be added to: ${selectedCategoryLabel}`
    : 'Create a new filter'

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Filter' : 'Add Filter'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? `Edit: ${editing?.name || 'Filter'}` : 'Add New Filter'}
      subtitle={formSubtitle}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Update Filter' : 'Save Filter'}
    >
      <FormSection
        title="Assign to Category"
        description={
          !isEdit && !formCategoryPath.filter(Boolean).length
            ? 'No category selected — filter will not be scoped to any category'
            : undefined
        }
      >
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
                    className={`h-9 pl-3 pr-8 text-sm rounded-lg border transition appearance-none cursor-pointer ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                        : 'border-gray-200 bg-white text-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-300 admin-input`}
                  >
                    <option value="">
                      {getLevelLabel(depth)}
                      {depth === 0 ? ' (optional)' : '…'}
                    </option>
                    {opts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
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
              onClick={() => {
                setFormCategoryPath([])
                fetchFormFilterTree([])
              }}
              className="flex items-center gap-1 h-9 px-2.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        {selectedCategoryLabel && (
          <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {isEdit ? 'Category: ' : 'Target: '}
            <span className="font-medium">{selectedCategoryLabel}</span>
          </p>
        )}
      </FormSection>

      <FormSection title="Filter details">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Filter Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
            placeholder="e.g. Regional Specs"
            hint="This is the filter group name"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Parent Filter
            </label>
            {formCategoryPath.filter(Boolean).length === 0 ? (
              <div className="w-full border border-dashed border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 cursor-not-allowed admin-input">
                Select a category first
              </div>
            ) : (
              <select
                value={form.parentId || ''}
                onChange={(e) => setForm({ ...form, parentId: e.target.value || '' })}
                className="admin-input w-full"
              >
                <option value="">(Root — no parent)</option>
                {formFilterOptions
                  .filter((opt) => !editing || String(opt._id) !== String(editing._id))
                  .map((opt) => (
                    <option key={opt._id} value={opt._id}>
                      {opt.label}
                    </option>
                  ))}
              </select>
            )}
            <p className="text-xs text-slate-400 mt-1">Leave empty for a top-level filter group</p>
          </div>

          <Input
            label="Sort Order"
            type="number"
            value={form.sortOrder}
            onChange={(e) =>
              setForm({
                ...form,
                sortOrder: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
            min={0}
            placeholder="0"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Color (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.colorCode || '#ffffff'}
                onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                className="h-10 w-10 border border-gray-200 rounded cursor-pointer"
              />
              <input
                type="text"
                value={form.colorCode}
                onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                placeholder="#RRGGBB"
                className="admin-input flex-1"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Thumb image">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbChange}
              className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
            />
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
                onClick={() =>
                  setForm((p) => ({ ...p, thumbFile: null, thumbPreview: '', clearThumb: true }))
                }
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </FormSection>

      <Checkbox
        label="Active"
        description="Filter is visible and available"
        checked={form.isActive !== false}
        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
      />
    </AdminFormShell>
  )
}

export default FilterFormPage
