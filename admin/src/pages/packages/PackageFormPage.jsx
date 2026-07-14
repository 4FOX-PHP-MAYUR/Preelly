import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Checkbox from '../../components/AdminUI/Checkbox'
import Button from '../../components/AdminUI/Button'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/packages'

const PACKAGE_NAME_MIN = 3
const PACKAGE_NAME_MAX = 100

const EMPTY_FORM = {
  packageName: '',
  displayOrder: '0',
  packageAmount: '',
  isVatApplicable: false,
  vatAmount: '0',
  validityDays: '',
  isRecomended: false,
  packageFeatures: [''],
  status: true,
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function formatAmount(value) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Shows the admin what the VAT rate works out to before they save. */
function getVatPreview(form) {
  if (!form.isVatApplicable) return null
  const amount = Number(form.packageAmount)
  const rate = Number(form.vatAmount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null
  const vatValue = round2((amount * rate) / 100)
  return { vatValue, totalAmount: round2(amount + vatValue) }
}

function validate(form) {
  const errors = {}

  const name = form.packageName.trim()
  if (!name) {
    errors.packageName = 'Package name is required'
  } else if (name.length < PACKAGE_NAME_MIN) {
    errors.packageName = `Package name must be at least ${PACKAGE_NAME_MIN} characters`
  } else if (name.length > PACKAGE_NAME_MAX) {
    errors.packageName = `Package name cannot exceed ${PACKAGE_NAME_MAX} characters`
  }

  const amount = Number(form.packageAmount)
  if (form.packageAmount === '' || !Number.isFinite(amount)) {
    errors.packageAmount = 'Package amount is required'
  } else if (amount <= 0) {
    errors.packageAmount = 'Package amount must be greater than 0'
  }

  if (form.displayOrder !== '') {
    const order = Number(form.displayOrder)
    if (!Number.isFinite(order) || order < 0) {
      errors.displayOrder = 'Display order cannot be negative'
    }
  }

  if (form.isVatApplicable) {
    const vat = Number(form.vatAmount)
    if (form.vatAmount === '' || !Number.isFinite(vat) || vat < 0) {
      errors.vatAmount = 'VAT percentage cannot be negative'
    } else if (vat > 100) {
      errors.vatAmount = 'VAT percentage cannot exceed 100'
    }
  }

  if (form.validityDays !== '') {
    const days = Number(form.validityDays)
    if (!Number.isFinite(days) || days < 1) {
      errors.validityDays = 'Validity must be at least 1 day'
    }
  }

  return errors
}

function PackageFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const vatPreview = getVatPreview(form)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getPackageById(id)
        const row = res.data?.package || res.data
        if (!row) throw new Error('Package not found')
        if (cancelled) return
        setForm({
          packageName: row.packageName || '',
          displayOrder: String(row.displayOrder ?? 0),
          packageAmount: row.packageAmount != null ? String(row.packageAmount) : '',
          isVatApplicable: Boolean(row.isVatApplicable),
          vatAmount: String(row.vatAmount ?? 0),
          validityDays: row.validityDays != null ? String(row.validityDays) : '',
          isRecomended: Boolean(row.isRecomended),
          packageFeatures: row.packageFeatures?.length ? row.packageFeatures : [''],
          status: row.status !== false,
        })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load package')
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

  const handleFeatureChange = (index, value) => {
    setForm((prev) => {
      const packageFeatures = [...prev.packageFeatures]
      packageFeatures[index] = value
      return { ...prev, packageFeatures }
    })
  }

  const handleAddFeature = () => {
    setForm((prev) => ({ ...prev, packageFeatures: [...prev.packageFeatures, ''] }))
  }

  const handleRemoveFeature = (index) => {
    setForm((prev) => {
      const packageFeatures = prev.packageFeatures.filter((_, i) => i !== index)
      return { ...prev, packageFeatures: packageFeatures.length ? packageFeatures : [''] }
    })
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
        packageName: form.packageName.trim(),
        displayOrder: form.displayOrder === '' ? 0 : Number(form.displayOrder),
        packageAmount: Number(form.packageAmount),
        isVatApplicable: form.isVatApplicable,
        vatAmount: form.isVatApplicable ? Number(form.vatAmount || 0) : 0,
        validityDays: form.validityDays === '' ? null : Number(form.validityDays),
        isRecomended: form.isRecomended,
        packageFeatures: form.packageFeatures.map((f) => f.trim()).filter(Boolean),
        status: form.status,
      }

      if (isEdit) {
        await adminService.updatePackage(id, payload)
        toast.success('Package updated')
      } else {
        await adminService.createPackage(payload)
        toast.success('Package created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save package')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Package' : 'Create Package'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Package' : 'Create Package'}
      subtitle="Define pricing, validity and the features included in this package"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Details">
        <Input
          label="Package Name"
          value={form.packageName}
          onChange={(e) => setField('packageName', e.target.value)}
          error={errors.packageName}
          hint={`Between ${PACKAGE_NAME_MIN} and ${PACKAGE_NAME_MAX} characters`}
          maxLength={PACKAGE_NAME_MAX}
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
        <Input
          label="Validity (days)"
          type="number"
          min="1"
          step="1"
          value={form.validityDays}
          onChange={(e) => setField('validityDays', e.target.value)}
          error={errors.validityDays}
          hint="Leave empty for a package that does not expire"
        />
      </FormSection>

      <FormSection title="Pricing">
        <Input
          label="Package Amount"
          type="number"
          min="0"
          step="0.01"
          value={form.packageAmount}
          onChange={(e) => setField('packageAmount', e.target.value)}
          error={errors.packageAmount}
          required
        />
        <Checkbox
          label="VAT applicable"
          description="Enable to charge VAT on top of the package amount"
          checked={form.isVatApplicable}
          onChange={(e) => setField('isVatApplicable', e.target.checked)}
        />
        {form.isVatApplicable && (
          <>
            <Input
              label="VAT (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.vatAmount}
              onChange={(e) => setField('vatAmount', e.target.value)}
              error={errors.vatAmount}
              hint="Percentage of the package amount, e.g. 5 for 5%"
            />
            {vatPreview && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                VAT {formatAmount(vatPreview.vatValue)} · Total payable{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatAmount(vatPreview.totalAmount)}
                </span>
              </p>
            )}
          </>
        )}
      </FormSection>

      <FormSection
        title="Package Features"
        description="Add each feature as a separate line. Empty rows are ignored."
      >
        <div className="space-y-3">
          {form.packageFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                className="flex-1"
                value={feature}
                onChange={(e) => handleFeatureChange(index, e.target.value)}
                placeholder={`Feature ${index + 1}`}
                aria-label={`Feature ${index + 1}`}
              />
              <Button
                variant="ghost"
                icon={Trash2}
                onClick={() => handleRemoveFeature(index)}
                disabled={form.packageFeatures.length === 1 && !feature.trim()}
                aria-label={`Remove feature ${index + 1}`}
              />
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={Plus} onClick={handleAddFeature}>
          Add more
        </Button>
      </FormSection>

      <FormSection title="Visibility">
        <Checkbox
          label="Mark as recommended"
          description="Highlights this package to users as the suggested choice"
          checked={form.isRecomended}
          onChange={(e) => setField('isRecomended', e.target.checked)}
        />
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

export default PackageFormPage
