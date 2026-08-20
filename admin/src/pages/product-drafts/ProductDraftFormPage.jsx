import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminFormShell,
  FormSection,
  Input,
  Textarea,
  Select,
  SearchableSelect,
  Button,
  Alert,
} from '../../components/AdminUI'
import { RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { LIST_PATH, STATUS_FORM_OPTIONS, formatDateTime } from './draftShared'

const MAX_STEP = 20
const MAX_CATEGORY_LEVELS = 4
const CURRENCY_OPTIONS = ['AED', 'USD', 'INR']

const EMPTY_FORM = {
  userId: '',
  status: 'draft',
  currentStep: '1',
  lastSavedStep: '',
  title: '',
  description: '',
  price: '',
  currency: 'AED',
  locationAddress: '',
}

function validate(form) {
  const errors = {}

  if (!form.userId) errors.userId = 'Seller is required'

  const step = Number(form.currentStep)
  if (!Number.isInteger(step) || step < 1 || step > MAX_STEP) {
    errors.currentStep = `Current step must be a whole number between 1 and ${MAX_STEP}`
  }

  if (form.lastSavedStep !== '') {
    const saved = Number(form.lastSavedStep)
    if (!Number.isInteger(saved) || saved < 1 || saved > MAX_STEP) {
      errors.lastSavedStep = `Last saved step must be a whole number between 1 and ${MAX_STEP}`
    }
  }

  if (form.price !== '') {
    const price = Number(form.price)
    if (!Number.isFinite(price) || price < 0) {
      errors.price = 'Price must be 0 or greater'
    }
  }

  return errors
}

function ProductDraftFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [users, setUsers] = useState([])
  const [record, setRecord] = useState(null)

  // Category is edited as a cascade of levels (root → child → …), the same shape
  // the wizard stores: `selectedPath` chain + `selectedCategory` leaf.
  const [categoryLevels, setCategoryLevels] = useState([]) // [{ options: [], value: '' }]
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)

  const fetchChildren = useCallback(async (parentId) => {
    try {
      const res = await adminService.getAdminCategoryChildren(parentId ? { parentId } : {})
      const raw = res.data
      const list = Array.isArray(raw) ? raw : raw?.categories || raw?.data || []
      return list.map((c) => ({ value: String(c._id), label: c.name }))
    } catch {
      return []
    }
  }, [])

  // Root options (always needed) + the seller dropdown source.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingCategories(true)
      const [roots, usersRes] = await Promise.allSettled([
        fetchChildren(null),
        adminService.getUsers({ limit: 200 }),
      ])
      if (cancelled) return
      if (roots.status === 'fulfilled') {
        setCategoryLevels((prev) => (prev.length ? prev : [{ options: roots.value, value: '' }]))
      }
      if (usersRes.status === 'fulfilled') {
        const raw = usersRes.value.data
        setUsers(Array.isArray(raw) ? raw : raw?.users || [])
      }
      setLoadingCategories(false)
    }
    load()
    return () => { cancelled = true }
  }, [fetchChildren])

  // Load the record being edited, then rebuild its category cascade level by level.
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getProductDraftById(id)
        const row = res.data
        if (!row) throw new Error('Draft not found')
        if (cancelled) return

        setRecord(row)
        setForm({
          userId: row.user?.id || '',
          status: row.status || 'draft',
          currentStep: String(row.currentStep ?? 1),
          lastSavedStep: row.lastSavedStep ? String(row.lastSavedStep) : '',
          title: row.title || '',
          description: row.description || '',
          price: row.formValues?.price === undefined || row.formValues?.price === null
            ? ''
            : String(row.formValues.price),
          currency: row.formValues?.currency || 'AED',
          locationAddress: row.formValues?.locationAddress || '',
        })

        // Keep the owner selectable even when they fall outside the first 200 users.
        if (row.user?.id) {
          setUsers((prev) =>
            prev.some((u) => String(u._id) === String(row.user.id))
              ? prev
              : [{ _id: row.user.id, name: row.user.name, email: row.user.email }, ...prev]
          )
        }

        const path = (row.categoryPath || []).map((c) => c.id)
        const levels = []
        let parent = null
        for (let i = 0; i <= path.length && i < MAX_CATEGORY_LEVELS; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const options = await fetchChildren(parent)
          if (cancelled) return
          if (!options.length) break
          const value = path[i] || ''
          levels.push({ options, value })
          if (!value) break
          parent = value
        }
        if (levels.length) setCategoryLevels(levels)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load draft')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate, fetchChildren])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const handleCategoryChange = async (levelIndex, value) => {
    setCategoryTouched(true)
    const next = categoryLevels.slice(0, levelIndex + 1).map((lvl, i) =>
      i === levelIndex ? { ...lvl, value } : lvl
    )
    setCategoryLevels(next)
    if (!value || next.length >= MAX_CATEGORY_LEVELS) return

    setLoadingCategories(true)
    const children = await fetchChildren(value)
    setLoadingCategories(false)
    if (children.length) {
      setCategoryLevels([...next, { options: children, value: '' }])
    }
  }

  const handleClearCategory = () => {
    setCategoryTouched(true)
    setCategoryLevels((prev) => (prev.length ? [{ ...prev[0], value: '' }] : prev))
  }

  const selectedPath = useMemo(
    () => categoryLevels.map((lvl) => lvl.value).filter(Boolean),
    [categoryLevels]
  )

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: String(u._id),
        label: u.email ? `${u.name || 'Unnamed'} — ${u.email}` : u.name || String(u._id),
      })),
    [users]
  )

  const handleSave = async () => {
    const nextErrors = validate(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields')
      return
    }

    // Only the fields this form owns are sent; the API merges them onto the
    // stored formValues so wizard data the admin never sees is preserved.
    const formValues = {
      title: form.title.trim(),
      description: form.description.trim(),
      currency: form.currency,
      locationAddress: form.locationAddress.trim(),
    }
    if (form.price === '') {
      if (isEdit && record?.formValues?.price !== undefined) formValues.price = null
    } else {
      formValues.price = Number(form.price)
    }

    const payload = {
      status: form.status,
      currentStep: Number(form.currentStep),
      lastSavedStep: form.lastSavedStep === '' ? null : Number(form.lastSavedStep),
      formValues,
    }

    if (!isEdit || form.userId !== record?.user?.id) {
      payload.userId = form.userId
    }

    if (!isEdit || categoryTouched) {
      payload.selectedPath = selectedPath
      payload.selectedCategory = selectedPath[selectedPath.length - 1] || null
      payload.categoryLevel = Math.max(0, selectedPath.length - 1)
    }

    try {
      setSaving(true)
      if (isEdit) {
        await adminService.updateProductDraft(id, payload)
        toast.success('Draft updated')
        navigate(`${LIST_PATH}/${id}`)
      } else {
        const res = await adminService.createProductDraft(payload)
        toast.success('Draft created')
        navigate(res.data?.id ? `${LIST_PATH}/${res.data.id}` : LIST_PATH)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title="Edit Draft"
        backTo={LIST_PATH}
        hideSubmit
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Draft' : 'Add Draft'}
      subtitle={
        isEdit
          ? `Last updated ${formatDateTime(record?.updatedAt)}`
          : 'Create an in-progress Post Your Ad draft on a seller’s behalf'
      }
      backTo={LIST_PATH}
      loading={saving}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save Changes' : 'Create Draft'}
    >
      <Alert variant="info">
        A seller can only have one draft with status <strong>Draft</strong> at a time. Photos and video stay
        in the seller’s own browser storage, so only their metadata is visible here.
      </Alert>

      <FormSection title="Owner & Status">
        <SearchableSelect
          label="Seller"
          value={form.userId}
          onChange={(e) => setField('userId', e.target.value)}
          options={userOptions}
          placeholder="Select a seller…"
          searchPlaceholder="Search by name or email…"
        />
        {errors.userId ? (
          <p className="-mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{errors.userId}</p>
        ) : null}
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setField('status', e.target.value)}
          options={STATUS_FORM_OPTIONS}
          hint="Discarded drafts stay in the database but are hidden from the seller’s flow"
        />
      </FormSection>

      <FormSection title="Wizard Progress">
        <Input
          label="Current Step"
          type="number"
          min="1"
          max={String(MAX_STEP)}
          step="1"
          value={form.currentStep}
          onChange={(e) => setField('currentStep', e.target.value)}
          error={errors.currentStep}
          required
        />
        <Input
          label="Last Saved Step"
          type="number"
          min="1"
          max={String(MAX_STEP)}
          step="1"
          value={form.lastSavedStep}
          onChange={(e) => setField('lastSavedStep', e.target.value)}
          error={errors.lastSavedStep}
          hint="Leave blank to clear"
        />
      </FormSection>

      <FormSection title="Category">
        <div className="space-y-3">
          {categoryLevels.map((level, index) => (
            <Select
              key={`category-level-${index}`}
              label={index === 0 ? 'Category' : `Level ${index + 1}`}
              value={level.value}
              onChange={(e) => handleCategoryChange(index, e.target.value)}
              options={[
                { value: '', label: index === 0 ? 'No category' : 'None' },
                ...level.options,
              ]}
            />
          ))}
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" icon={RotateCcw} onClick={handleClearCategory}>
              Clear category
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {loadingCategories
                ? 'Loading categories…'
                : selectedPath.length
                  ? `Level ${Math.max(0, selectedPath.length - 1)} · ${selectedPath.length} level(s) selected`
                  : 'No category selected'}
            </span>
          </div>
        </div>
      </FormSection>

      <FormSection title="Listing Details">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          maxLength={200}
          hint="Drafts may be incomplete — a blank title is allowed"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          rows={5}
          maxLength={5000}
        />
        <Input
          label="Price"
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(e) => setField('price', e.target.value)}
          error={errors.price}
          hint="Leave blank for no price"
        />
        <Select
          label="Currency"
          value={form.currency}
          onChange={(e) => setField('currency', e.target.value)}
          options={[
            ...CURRENCY_OPTIONS.map((c) => ({ value: c, label: c })),
            ...(CURRENCY_OPTIONS.includes(form.currency)
              ? []
              : [{ value: form.currency, label: form.currency }]),
          ]}
        />
        <Input
          label="Location Address"
          value={form.locationAddress}
          onChange={(e) => setField('locationAddress', e.target.value)}
          maxLength={500}
        />
      </FormSection>

      {isEdit && record ? (
        <FormSection title="Media (read-only)">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {record.media?.imageCount || 0} photo(s)
            {record.media?.hasVideo ? ` · video "${record.media.video?.name || 'unnamed'}"` : ' · no video'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Files live in the seller’s browser (IndexedDB); only metadata is stored server-side. See the
            details page for the full list.
          </p>
        </FormSection>
      ) : null}
    </AdminFormShell>
  )
}

export default ProductDraftFormPage
