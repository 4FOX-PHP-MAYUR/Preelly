import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Checkbox from '../../components/AdminUI/Checkbox'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/storage-facilities'

const FACILITY_WEEK_MIN = 3
const FACILITY_WEEK_MAX = 100

const EMPTY_FORM = {
  facilityWeek: '',
  facilityAmount: '',
  displayOrder: '0',
  imageIconFile: null,
  imagePreview: '',
  clearImageIcon: false,
  status: true,
}

function validate(form) {
  const errors = {}

  const week = form.facilityWeek.trim()
  if (!week) {
    errors.facilityWeek = 'Facility week is required'
  } else if (week.length < FACILITY_WEEK_MIN) {
    errors.facilityWeek = `Facility week must be at least ${FACILITY_WEEK_MIN} characters`
  } else if (week.length > FACILITY_WEEK_MAX) {
    errors.facilityWeek = `Facility week cannot exceed ${FACILITY_WEEK_MAX} characters`
  }

  const amount = Number(form.facilityAmount)
  if (form.facilityAmount === '' || !Number.isFinite(amount)) {
    errors.facilityAmount = 'Facility amount is required'
  } else if (amount <= 0) {
    errors.facilityAmount = 'Facility amount must be greater than 0'
  }

  if (form.displayOrder !== '') {
    const order = Number(form.displayOrder)
    if (!Number.isFinite(order) || order < 0) {
      errors.displayOrder = 'Display order cannot be negative'
    }
  }

  return errors
}

function StorageFacilityFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(EMPTY_FORM)
  const [existingIcon, setExistingIcon] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getStorageFacilityById(id)
        const row = res.data?.storageFacility || res.data
        if (!row) throw new Error('Storage facility not found')
        if (cancelled) return
        setForm({
          ...EMPTY_FORM,
          facilityWeek: row.facilityWeek || '',
          facilityAmount: row.facilityAmount != null ? String(row.facilityAmount) : '',
          displayOrder: String(row.displayOrder ?? 0),
          status: row.status !== false,
        })
        setExistingIcon(row.imageIcon || '')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load storage facility')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const handleIconChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, imageIconFile: null, imagePreview: '', clearImageIcon: false }))
      return
    }
    setForm((prev) => ({
      ...prev,
      imageIconFile: file,
      imagePreview: URL.createObjectURL(file),
      clearImageIcon: false,
    }))
  }

  const handleSave = async () => {
    const nextErrors = validate(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields')
      return
    }

    try {
      setLoading(true)
      const payload = {
        facilityWeek: form.facilityWeek.trim(),
        facilityAmount: Number(form.facilityAmount),
        displayOrder: form.displayOrder === '' ? 0 : Number(form.displayOrder),
        status: form.status,
      }
      if (form.imageIconFile) payload.imageIcon = form.imageIconFile

      if (isEdit) {
        if (!form.imageIconFile && form.clearImageIcon) payload.clearImageIcon = 'true'
        await adminService.updateStorageFacility(id, payload)
        toast.success('Storage facility updated')
      } else {
        await adminService.createStorageFacility(payload)
        toast.success('Storage facility created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save storage facility')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Storage Facility' : 'Create Storage Facility'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const showPreview = form.imagePreview || (existingIcon && !form.clearImageIcon)

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Storage Facility' : 'Create Storage Facility'}
      subtitle="Define the storage duration, its price and the icon shown to users"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Details">
        <Input
          label="Facility Week"
          value={form.facilityWeek}
          onChange={(e) => setField('facilityWeek', e.target.value)}
          error={errors.facilityWeek}
          hint={`Between ${FACILITY_WEEK_MIN} and ${FACILITY_WEEK_MAX} characters, e.g. "2 Weeks"`}
          maxLength={FACILITY_WEEK_MAX}
          required
        />
        <Input
          label="Facility Amount"
          type="number"
          min="0"
          step="0.01"
          value={form.facilityAmount}
          onChange={(e) => setField('facilityAmount', e.target.value)}
          error={errors.facilityAmount}
          required
        />
        <Input
          label="Display Order"
          type="number"
          min="0"
          step="1"
          value={form.displayOrder}
          onChange={(e) => setField('displayOrder', e.target.value)}
          error={errors.displayOrder}
          hint="Lower numbers appear first"
        />
      </FormSection>

      <FormSection title="Icon">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Image Icon
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleIconChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          {showPreview && (
            <img
              src={form.imagePreview || getMediaUrl(existingIcon) || existingIcon}
              alt="Icon preview"
              className="mt-3 h-20 w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
          )}
          {isEdit && existingIcon && !form.imageIconFile && (
            <Checkbox
              label="Remove existing icon"
              checked={form.clearImageIcon}
              onChange={(e) => setField('clearImageIcon', e.target.checked)}
              className="mt-3"
            />
          )}
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <Select
          label="Status"
          value={form.status ? 'active' : 'inactive'}
          onChange={(e) => setField('status', e.target.value === 'active')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FormSection>
    </AdminFormShell>
  )
}

export default StorageFacilityFormPage
