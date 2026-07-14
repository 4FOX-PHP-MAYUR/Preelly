import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService, packageService, storageFacilityService, categoryService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Textarea from '../../components/AdminUI/Textarea'
import Checkbox from '../../components/AdminUI/Checkbox'
import Button from '../../components/AdminUI/Button'
import { Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DISCOUNT_TYPE_OPTIONS,
  APPLICABLE_TYPE_OPTIONS,
  USER_ELIGIBILITY_OPTIONS,
  COUPON_TYPE_OPTIONS,
  needsApplicableIds,
  applicableSource,
  labelFor,
  formatDate,
  formatDiscount,
  toDateTimeLocal,
} from './couponConstants'

const LIST_PATH = '/admin/coupons'

const EMPTY_FORM = {
  couponName: '',
  couponCode: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  maximumDiscount: '',
  minimumOrderAmount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  usagePerUser: '',
  applicableType: 'all_packages',
  applicableIds: [],
  userEligibility: 'everyone',
  couponType: 'public',
  assignedUsers: [],
  stackable: false,
  terms: '',
  status: true,
}

function validate(form) {
  const errors = {}

  const name = form.couponName.trim()
  if (!name) errors.couponName = 'Coupon name is required'
  else if (name.length > 100) errors.couponName = 'Coupon name cannot exceed 100 characters'

  const code = form.couponCode.trim()
  if (!code) errors.couponCode = 'Coupon code is required'
  else if (code.length > 20) errors.couponCode = 'Coupon code cannot exceed 20 characters'
  else if (!/^[A-Z0-9_-]+$/.test(code)) errors.couponCode = 'No spaces or special characters allowed'

  const value = Number(form.discountValue)
  if (form.discountValue === '' || !Number.isFinite(value)) {
    errors.discountValue = 'Discount value is required'
  } else if (value <= 0) {
    errors.discountValue = 'Discount value must be greater than 0'
  } else if (form.discountType === 'percentage' && value > 100) {
    errors.discountValue = 'Percentage cannot exceed 100'
  }

  if (form.discountType === 'percentage' && form.maximumDiscount !== '') {
    const cap = Number(form.maximumDiscount)
    if (!Number.isFinite(cap) || cap <= 0) errors.maximumDiscount = 'Maximum discount must be greater than 0'
  }

  if (form.minimumOrderAmount !== '') {
    const min = Number(form.minimumOrderAmount)
    if (!Number.isFinite(min) || min < 0) errors.minimumOrderAmount = 'Minimum order cannot be negative'
  }

  if (!form.startDate) errors.startDate = 'Start date is required'
  if (!form.endDate) errors.endDate = 'End date is required'
  if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
    errors.endDate = 'End date cannot be before start date'
  }

  if (form.usageLimit !== '' && Number(form.usageLimit) < 1) errors.usageLimit = 'Usage limit must be at least 1'
  if (form.usagePerUser !== '' && Number(form.usagePerUser) < 1) errors.usagePerUser = 'Usage per user must be at least 1'

  if (needsApplicableIds(form.applicableType) && form.applicableIds.length === 0) {
    errors.applicableIds = 'Select at least one item'
  }

  if (form.couponType === 'private' && form.assignedUsers.length === 0) {
    errors.assignedUsers = 'Assign at least one user to a private coupon'
  }

  return errors
}

/** Simple multi-select built on a native <select multiple> — no new dependency. */
function MultiSelect({ label, options, value, onChange, error, hint, loading }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        <span className="text-red-500 ml-0.5">*</span>
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

function CouponFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [generating, setGenerating] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const [packages, setPackages] = useState([])
  const [facilities, setFacilities] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])

  // Option sources for the "Applicable For" / private-user multi-selects.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [pkgs, facs, cats, usrs] = await Promise.allSettled([
        packageService.listActivePackages(),
        storageFacilityService.listActiveStorageFacilities(),
        categoryService.getCategories(),
        adminService.getUsers({ limit: 200 }),
      ])
      if (cancelled) return
      if (pkgs.status === 'fulfilled') setPackages(pkgs.value.data?.data || [])
      if (facs.status === 'fulfilled') setFacilities(facs.value.data?.data || [])
      if (cats.status === 'fulfilled') {
        const raw = cats.value.data
        setCategories(Array.isArray(raw) ? raw : raw?.categories || raw?.data || [])
      }
      if (usrs.status === 'fulfilled') {
        const raw = usrs.value.data
        setUsers(Array.isArray(raw) ? raw : raw?.users || [])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getCouponById(id)
        const c = res.data
        if (cancelled) return
        setIsExpired(Boolean(c.isExpired))
        setForm({
          couponName: c.couponName || '',
          couponCode: c.couponCode || '',
          description: c.description || '',
          discountType: c.discountType || 'percentage',
          discountValue: c.discountValue != null ? String(c.discountValue) : '',
          maximumDiscount: c.maximumDiscount != null ? String(c.maximumDiscount) : '',
          minimumOrderAmount: c.minimumOrderAmount != null ? String(c.minimumOrderAmount) : '',
          startDate: toDateTimeLocal(c.startDate),
          endDate: toDateTimeLocal(c.endDate),
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
          usagePerUser: c.usagePerUser != null ? String(c.usagePerUser) : '',
          applicableType: c.applicableType || 'all_packages',
          applicableIds: c.applicableIds || [],
          userEligibility: c.userEligibility || 'everyone',
          couponType: c.couponType || 'public',
          assignedUsers: (c.assignedUsers || []).map((u) => u.id),
          stackable: Boolean(c.stackable),
          terms: c.terms || '',
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

  // Coupon codes are always uppercase and space-free.
  const handleCodeChange = (raw) =>
    setField('couponCode', raw.toUpperCase().replace(/\s+/g, ''))

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      const res = await adminService.generateCouponCode()
      setField('couponCode', res.data?.data?.couponCode || '')
      toast.success('Coupon code generated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate code')
    } finally {
      setGenerating(false)
    }
  }

  const applicableOptions = useMemo(() => {
    const source = applicableSource(form.applicableType)
    if (source === 'packages') return packages.map((p) => ({ value: p.id, label: p.packageName }))
    if (source === 'storageFacilities') return facilities.map((f) => ({ value: f.id, label: `${f.facilityWeek} — ${f.facilityAmount}` }))
    if (source === 'categories') {
      return categories.map((c) => ({ value: String(c._id || c.id), label: c.name }))
    }
    return []
  }, [form.applicableType, packages, facilities, categories])

  const handleSave = async () => {
    const nextErrors = validate(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields')
      return
    }

    try {
      setLoading(true)
      // An expired coupon may only have its status changed — send just that.
      const payload = isEdit && isExpired
        ? { status: form.status }
        : {
            couponName: form.couponName.trim(),
            couponCode: form.couponCode.trim(),
            description: form.description.trim() || null,
            discountType: form.discountType,
            discountValue: Number(form.discountValue),
            maximumDiscount:
              form.discountType === 'percentage' && form.maximumDiscount !== ''
                ? Number(form.maximumDiscount)
                : null,
            minimumOrderAmount: form.minimumOrderAmount !== '' ? Number(form.minimumOrderAmount) : null,
            startDate: new Date(form.startDate).toISOString(),
            endDate: new Date(form.endDate).toISOString(),
            usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
            usagePerUser: form.usagePerUser !== '' ? Number(form.usagePerUser) : null,
            applicableType: form.applicableType,
            applicableIds: needsApplicableIds(form.applicableType) ? form.applicableIds : [],
            userEligibility: form.userEligibility,
            couponType: form.couponType,
            assignedUsers: form.couponType === 'private' ? form.assignedUsers : [],
            stackable: form.stackable,
            terms: form.terms.trim() || null,
            status: form.status,
          }

      if (isEdit) {
        await adminService.updateCoupon(id, payload)
        toast.success('Coupon updated')
      } else {
        await adminService.createCoupon(payload)
        toast.success('Coupon created')
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
      <AdminFormShell title="Edit Coupon" backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const isPercentage = form.discountType === 'percentage'

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Coupon' : 'Create Coupon'}
      subtitle={
        isExpired
          ? 'This coupon has expired — only its status can be changed.'
          : 'Set the discount, validity, usage limits and who it applies to'
      }
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Basic Information">
        <Input
          label="Coupon Name"
          value={form.couponName}
          onChange={(e) => setField('couponName', e.target.value)}
          error={errors.couponName}
          maxLength={100}
          disabled={isExpired}
          required
        />

        <div className="flex items-end gap-2">
          <Input
            className="flex-1"
            label="Coupon Code"
            value={form.couponCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            error={errors.couponCode}
            hint="Uppercase, no spaces, max 20 characters — e.g. SAVE20, WELCOME100"
            maxLength={20}
            disabled={isExpired}
            required
          />
          <Button
            type="button"
            variant="secondary"
            icon={Wand2}
            onClick={handleGenerate}
            loading={generating}
            disabled={isExpired}
          >
            Generate
          </Button>
        </div>

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          hint="Optional"
          disabled={isExpired}
        />
      </FormSection>

      <FormSection title="Discount">
        <Select
          label="Discount Type"
          value={form.discountType}
          onChange={(e) => setField('discountType', e.target.value)}
          options={DISCOUNT_TYPE_OPTIONS}
          disabled={isExpired}
          required
        />
        <Input
          label={isPercentage ? 'Discount Value (%)' : 'Discount Value (AED)'}
          type="number"
          min="0"
          step="0.01"
          value={form.discountValue}
          onChange={(e) => setField('discountValue', e.target.value)}
          error={errors.discountValue}
          hint={isPercentage ? 'Maximum 100' : 'Must be greater than 0'}
          disabled={isExpired}
          required
        />
        {isPercentage && (
          <Input
            label="Maximum Discount Amount"
            type="number"
            min="0"
            step="0.01"
            value={form.maximumDiscount}
            onChange={(e) => setField('maximumDiscount', e.target.value)}
            error={errors.maximumDiscount}
            hint="Optional cap — e.g. 20% up to 500"
            disabled={isExpired}
          />
        )}
        <Input
          label="Minimum Order Amount"
          type="number"
          min="0"
          step="0.01"
          value={form.minimumOrderAmount}
          onChange={(e) => setField('minimumOrderAmount', e.target.value)}
          error={errors.minimumOrderAmount}
          hint="Optional — e.g. 500"
          disabled={isExpired}
        />
      </FormSection>

      <FormSection title="Coupon Validity">
        <Input
          label="Start Date & Time"
          type="datetime-local"
          value={form.startDate}
          onChange={(e) => setField('startDate', e.target.value)}
          error={errors.startDate}
          disabled={isExpired}
          required
        />
        <Input
          label="End Date & Time"
          type="datetime-local"
          value={form.endDate}
          onChange={(e) => setField('endDate', e.target.value)}
          error={errors.endDate}
          disabled={isExpired}
          required
        />
      </FormSection>

      <FormSection title="Usage Settings">
        <Input
          label="Total Usage Limit"
          type="number"
          min="1"
          step="1"
          value={form.usageLimit}
          onChange={(e) => setField('usageLimit', e.target.value)}
          error={errors.usageLimit}
          hint="Leave empty for unlimited. Once reached, the coupon stops working."
          disabled={isExpired}
        />
        <Input
          label="Usage Per User"
          type="number"
          min="1"
          step="1"
          value={form.usagePerUser}
          onChange={(e) => setField('usagePerUser', e.target.value)}
          error={errors.usagePerUser}
          hint="Leave empty for unlimited"
          disabled={isExpired}
        />
      </FormSection>

      <FormSection title="Applicable For">
        <Select
          label="Applicable For"
          value={form.applicableType}
          onChange={(e) => {
            setField('applicableType', e.target.value)
            setField('applicableIds', [])
          }}
          options={APPLICABLE_TYPE_OPTIONS}
          disabled={isExpired}
          required
        />
        {needsApplicableIds(form.applicableType) && (
          <MultiSelect
            label={labelFor(APPLICABLE_TYPE_OPTIONS, form.applicableType)}
            options={applicableOptions}
            value={form.applicableIds}
            onChange={(v) => setField('applicableIds', v)}
            error={errors.applicableIds}
            hint="Hold Cmd/Ctrl to select more than one"
            loading={isExpired}
          />
        )}
      </FormSection>

      <FormSection title="Eligibility & Type">
        <Select
          label="User Eligibility"
          value={form.userEligibility}
          onChange={(e) => setField('userEligibility', e.target.value)}
          options={USER_ELIGIBILITY_OPTIONS}
          disabled={isExpired}
        />
        <Select
          label="Coupon Type"
          value={form.couponType}
          onChange={(e) => {
            setField('couponType', e.target.value)
            setField('assignedUsers', [])
          }}
          options={COUPON_TYPE_OPTIONS}
          disabled={isExpired}
        />
        {form.couponType === 'private' && (
          <MultiSelect
            label="Assigned Users"
            options={users.map((u) => ({
              value: String(u._id || u.id),
              label: u.email ? `${u.name || 'User'} — ${u.email}` : u.name || String(u._id),
            }))}
            value={form.assignedUsers}
            onChange={(v) => setField('assignedUsers', v)}
            error={errors.assignedUsers}
            hint="Only these users can redeem this coupon"
            loading={isExpired}
          />
        )}
        <Checkbox
          label="Stackable"
          description="Can be combined with another coupon on the same order"
          checked={form.stackable}
          onChange={(e) => setField('stackable', e.target.checked)}
          disabled={isExpired}
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

      <FormSection title="Terms & Conditions" description="Optional">
        <Textarea
          label="Terms"
          value={form.terms}
          onChange={(e) => setField('terms', e.target.value)}
          rows={5}
          disabled={isExpired}
        />
      </FormSection>

      <FormSection title="Coupon Preview" description="How this coupon will behave">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Coupon Code</span>
            <span className="font-mono font-semibold">{form.couponCode || '—'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Discount</span>
            <span className="font-medium">
              {formatDiscount({
                discountType: form.discountType,
                discountValue: form.discountValue || 0,
                maximumDiscount: form.maximumDiscount || null,
              })}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Validity</span>
            <span className="font-medium text-right">
              {form.startDate ? formatDate(form.startDate) : '—'} → {form.endDate ? formatDate(form.endDate) : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Applicable For</span>
            <span className="font-medium">{labelFor(APPLICABLE_TYPE_OPTIONS, form.applicableType)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Usage</span>
            <span className="font-medium">
              {form.usageLimit === '' ? 'Unlimited' : `${form.usageLimit} total`}
              {form.usagePerUser !== '' && `, ${form.usagePerUser} per user`}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Status</span>
            <span className="font-medium">{form.status ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </FormSection>
    </AdminFormShell>
  )
}

export default CouponFormPage
