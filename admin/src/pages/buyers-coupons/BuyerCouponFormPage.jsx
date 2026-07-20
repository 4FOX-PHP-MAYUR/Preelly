import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Textarea from '../../components/AdminUI/Textarea'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/buyers-coupons'

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
]

const EMPTY_FORM = {
  couponName: '',
  couponCode: '',
  description: '',
  checkoutServiceIds: [],
  discountType: 'percentage',
  discountValue: '',
  minimumOrderAmount: '',
  maximumDiscountAmount: '',
  usageLimit: '',
  usageLimitPerBuyer: '1',
  validFrom: '',
  validTill: '',
  status: true,
}

const toDateTimeLocal = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function validate(form) {
  const errors = {}
  if (!form.couponName.trim()) errors.couponName = 'Coupon name is required'
  if (!form.couponCode.trim()) {
    errors.couponCode = 'Coupon code is required'
  } else if (!/^[A-Z0-9_-]+$/.test(form.couponCode.trim())) {
    errors.couponCode = 'Only letters, numbers, - and _ allowed'
  }
  if (!form.checkoutServiceIds.length) errors.checkoutServiceIds = 'Select at least one checkout service'

  const value = Number(form.discountValue)
  if (form.discountValue === '' || !Number.isFinite(value) || value <= 0) {
    errors.discountValue = 'Discount value must be greater than 0'
  } else if (form.discountType === 'percentage' && value > 100) {
    errors.discountValue = 'Percentage cannot exceed 100%'
  }

  if (form.discountType === 'percentage') {
    const max = Number(form.maximumDiscountAmount)
    if (form.maximumDiscountAmount === '' || !Number.isFinite(max) || max <= 0) {
      errors.maximumDiscountAmount = 'Maximum discount is required for percentage coupons'
    }
  }

  if (!form.validFrom) errors.validFrom = 'Valid from is required'
  if (!form.validTill) errors.validTill = 'Valid till is required'
  if (form.validFrom && form.validTill && new Date(form.validTill) < new Date(form.validFrom)) {
    errors.validTill = 'Valid till cannot be before valid from'
  }

  return errors
}

/** Simple multi-select on a native <select multiple> — no new dependency. */
function MultiSelect({ label, options, value, onChange, error, hint, loading, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        multiple
        size={Math.min(Math.max(options.length, 4), 8)}
        value={value}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
        className={`admin-input w-full ${error ? 'border-red-300 dark:border-red-700' : ''}`}
        disabled={loading}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function BuyerCouponFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)

  // Checkout services for the multi-select.
  useEffect(() => {
    let cancelled = false
    adminService
      .getCheckoutServices({ limit: 500, status: 'active', sortBy: 'displayOrder', sortDir: 'asc' })
      .then((res) => {
        if (cancelled) return
        setServices(res.data?.checkoutServices || [])
      })
      .catch(() => toast.error('Failed to load checkout services'))
      .finally(() => { if (!cancelled) setLoadingServices(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getBuyerCouponById(id)
        const c = res.data || {}
        if (cancelled) return
        setForm({
          ...EMPTY_FORM,
          couponName: c.couponName || '',
          couponCode: c.couponCode || '',
          description: c.description || '',
          checkoutServiceIds: (c.checkoutServiceIds || []).map(String),
          discountType: c.discountType || 'percentage',
          discountValue: c.discountValue != null ? String(c.discountValue) : '',
          minimumOrderAmount: c.minimumOrderAmount != null ? String(c.minimumOrderAmount) : '',
          maximumDiscountAmount: c.maximumDiscountAmount != null ? String(c.maximumDiscountAmount) : '',
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
          usageLimitPerBuyer: c.usageLimitPerBuyer != null ? String(c.usageLimitPerBuyer) : '1',
          validFrom: toDateTimeLocal(c.validFrom),
          validTill: toDateTimeLocal(c.validTill),
          status: c.status !== false,
        })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load coupon')
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
        couponName: form.couponName.trim(),
        couponCode: form.couponCode.trim().toUpperCase(),
        description: form.description.trim() || null,
        checkoutServiceIds: form.checkoutServiceIds,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minimumOrderAmount: form.minimumOrderAmount === '' ? null : Number(form.minimumOrderAmount),
        maximumDiscountAmount:
          form.discountType === 'percentage' && form.maximumDiscountAmount !== ''
            ? Number(form.maximumDiscountAmount)
            : null,
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        usageLimitPerBuyer: form.usageLimitPerBuyer === '' ? 1 : Number(form.usageLimitPerBuyer),
        validFrom: new Date(form.validFrom).toISOString(),
        validTill: new Date(form.validTill).toISOString(),
        status: form.status,
      }

      if (isEdit) {
        await adminService.updateBuyerCoupon(id, payload)
        toast.success('Buyer coupon updated')
      } else {
        await adminService.createBuyerCoupon(payload)
        toast.success('Buyer coupon created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save coupon')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Buyer Coupon' : 'Create Buyer Coupon'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const isPercentage = form.discountType === 'percentage'
  const serviceOptions = services.map((s) => ({ value: String(s.id || s._id), label: s.serviceName }))

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Buyer Coupon' : 'Create Buyer Coupon'}
      subtitle="Coupons applicable only to checkout services"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Details">
        <Input
          label="Coupon Name"
          value={form.couponName}
          onChange={(e) => setField('couponName', e.target.value)}
          error={errors.couponName}
          maxLength={100}
          required
        />
        <Input
          label="Coupon Code"
          value={form.couponCode}
          onChange={(e) => setField('couponCode', e.target.value.toUpperCase())}
          error={errors.couponCode}
          hint="Auto uppercase. Letters, numbers, - and _ only. Must be unique."
          maxLength={20}
          required
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          rows={3}
        />
      </FormSection>

      <FormSection title="Applicable Checkout Services">
        <MultiSelect
          label="Checkout Services"
          options={serviceOptions}
          value={form.checkoutServiceIds}
          onChange={(vals) => setField('checkoutServiceIds', vals)}
          error={errors.checkoutServiceIds}
          hint="Hold Ctrl/Cmd to select multiple. The coupon applies only to these services."
          loading={loadingServices}
          required
        />
      </FormSection>

      <FormSection title="Discount">
        <Select
          label="Discount Type"
          value={form.discountType}
          onChange={(e) => setField('discountType', e.target.value)}
          options={DISCOUNT_TYPE_OPTIONS}
        />
        <Input
          label={isPercentage ? 'Discount Value (%)' : 'Discount Value (AED)'}
          type="number"
          min="0"
          step="0.01"
          value={form.discountValue}
          onChange={(e) => setField('discountValue', e.target.value)}
          error={errors.discountValue}
          required
        />
        {isPercentage && (
          <Input
            label="Maximum Discount Amount (AED)"
            type="number"
            min="0"
            step="0.01"
            value={form.maximumDiscountAmount}
            onChange={(e) => setField('maximumDiscountAmount', e.target.value)}
            error={errors.maximumDiscountAmount}
            hint="Caps the percentage discount"
            required
          />
        )}
        <Input
          label="Minimum Order Amount (AED)"
          type="number"
          min="0"
          step="0.01"
          value={form.minimumOrderAmount}
          onChange={(e) => setField('minimumOrderAmount', e.target.value)}
          hint="Optional — minimum eligible checkout charge required"
        />
      </FormSection>

      <FormSection title="Usage & Validity">
        <Input
          label="Usage Limit (Total)"
          type="number"
          min="1"
          step="1"
          value={form.usageLimit}
          onChange={(e) => setField('usageLimit', e.target.value)}
          hint="Leave blank for unlimited"
        />
        <Input
          label="Usage Limit Per Buyer"
          type="number"
          min="1"
          step="1"
          value={form.usageLimitPerBuyer}
          onChange={(e) => setField('usageLimitPerBuyer', e.target.value)}
          hint="Default 1"
        />
        <Input
          label="Valid From"
          type="datetime-local"
          value={form.validFrom}
          onChange={(e) => setField('validFrom', e.target.value)}
          error={errors.validFrom}
          required
        />
        <Input
          label="Valid Till"
          type="datetime-local"
          value={form.validTill}
          onChange={(e) => setField('validTill', e.target.value)}
          error={errors.validTill}
          required
        />
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

export default BuyerCouponFormPage
