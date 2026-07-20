import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import Textarea from '../../components/AdminUI/Textarea'
import Checkbox from '../../components/AdminUI/Checkbox'
import Button from '../../components/AdminUI/Button'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/checkout-services'

const SERVICE_NAME_MIN = 2
const SERVICE_NAME_MAX = 120

const PRICE_TYPE_OPTIONS = [
  { value: 'FIXED', label: 'Fixed' },
  { value: 'STARTING_FROM', label: 'Starting From' },
  { value: 'FREE', label: 'Free' },
]

const EMPTY_FORM = {
  serviceName: '',
  description: '',
  priceType: 'FIXED',
  price: '',
  learnMoreUrl: '',
  buttonText: 'Learn More',
  displayOrder: '0',
  isDefault: false,
  status: true,
  highlights: [''],
}

function validate(form) {
  const errors = {}

  const name = form.serviceName.trim()
  if (!name) {
    errors.serviceName = 'Service name is required'
  } else if (name.length < SERVICE_NAME_MIN) {
    errors.serviceName = `Service name must be at least ${SERVICE_NAME_MIN} characters`
  } else if (name.length > SERVICE_NAME_MAX) {
    errors.serviceName = `Service name cannot exceed ${SERVICE_NAME_MAX} characters`
  }

  if (form.priceType !== 'FREE') {
    const amount = Number(form.price)
    if (form.price === '' || !Number.isFinite(amount)) {
      errors.price = 'Price is required'
    } else if (amount < 0) {
      errors.price = 'Price cannot be negative'
    }
  }

  if (form.displayOrder !== '') {
    const order = Number(form.displayOrder)
    if (!Number.isFinite(order) || order < 0) {
      errors.displayOrder = 'Display order cannot be negative'
    }
  }

  return errors
}

function CheckoutServiceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getCheckoutServiceById(id)
        const row = res.data?.checkoutService || res.data
        if (!row) throw new Error('Checkout service not found')
        if (cancelled) return
        const highlights = (row.highlights || []).map((h) => (typeof h === 'string' ? h : h.highlight))
        setForm({
          ...EMPTY_FORM,
          serviceName: row.serviceName || '',
          description: row.description || '',
          priceType: row.priceType || 'FIXED',
          price: row.price != null ? String(row.price) : '',
          learnMoreUrl: row.learnMoreUrl || '',
          buttonText: row.buttonText || 'Learn More',
          displayOrder: String(row.displayOrder ?? 0),
          isDefault: Boolean(row.isDefault),
          status: row.status !== false,
          highlights: highlights.length ? highlights : [''],
        })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load checkout service')
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

  const setHighlight = (index, value) => {
    setForm((prev) => {
      const highlights = [...prev.highlights]
      highlights[index] = value
      return { ...prev, highlights }
    })
  }

  const addHighlight = () => setForm((prev) => ({ ...prev, highlights: [...prev.highlights, ''] }))

  const removeHighlight = (index) =>
    setForm((prev) => {
      const highlights = prev.highlights.filter((_, i) => i !== index)
      return { ...prev, highlights: highlights.length ? highlights : [''] }
    })

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
        serviceName: form.serviceName.trim(),
        description: form.description.trim(),
        priceType: form.priceType,
        price: form.priceType === 'FREE' ? 0 : Number(form.price),
        learnMoreUrl: form.learnMoreUrl.trim(),
        buttonText: form.buttonText.trim() || 'Learn More',
        displayOrder: form.displayOrder === '' ? 0 : Number(form.displayOrder),
        isDefault: form.isDefault,
        status: form.status,
        highlights: form.highlights.map((h) => h.trim()).filter(Boolean),
      }

      if (isEdit) {
        await adminService.updateCheckoutService(id, payload)
        toast.success('Checkout service updated')
      } else {
        await adminService.createCheckoutService(payload)
        toast.success('Checkout service created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save checkout service')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Checkout Service' : 'Create Checkout Service'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const isFree = form.priceType === 'FREE'

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Checkout Service' : 'Create Checkout Service'}
      subtitle="Define a checkout add-on, its pricing and highlights"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Details">
        <Input
          label="Service Name"
          value={form.serviceName}
          onChange={(e) => setField('serviceName', e.target.value)}
          error={errors.serviceName}
          hint={`Between ${SERVICE_NAME_MIN} and ${SERVICE_NAME_MAX} characters, e.g. "Pick & Drop Service"`}
          maxLength={SERVICE_NAME_MAX}
          required
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          hint="Optional short description of the service"
          rows={3}
        />
      </FormSection>

      <FormSection title="Pricing">
        <Select
          label="Price Type"
          value={form.priceType}
          onChange={(e) => setField('priceType', e.target.value)}
          options={PRICE_TYPE_OPTIONS}
        />
        <Input
          label="Price (AED)"
          type="number"
          min="0"
          step="0.01"
          value={isFree ? '' : form.price}
          onChange={(e) => setField('price', e.target.value)}
          error={errors.price}
          disabled={isFree}
          hint={isFree ? 'Free services carry no price' : 'Amount in AED'}
          required={!isFree}
        />
      </FormSection>

      <FormSection title="Service Highlights">
        <div className="space-y-2">
          {form.highlights.map((highlight, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={highlight}
                onChange={(e) => setHighlight(index, e.target.value)}
                placeholder={`Highlight ${index + 1} (e.g. Packaging included)`}
              />
              <button
                type="button"
                onClick={() => removeHighlight(index)}
                className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                aria-label="Remove highlight"
                title="Remove highlight"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" icon={Plus} onClick={addHighlight}>
            Add Highlight
          </Button>
        </div>
      </FormSection>

      <FormSection title="Call to Action">
        <Input
          label="Learn More URL"
          value={form.learnMoreUrl}
          onChange={(e) => setField('learnMoreUrl', e.target.value)}
          hint="Optional link opened by the button"
          placeholder="https://…"
        />
        <Input
          label="Button Text"
          value={form.buttonText}
          onChange={(e) => setField('buttonText', e.target.value)}
          maxLength={60}
          hint="Defaults to 'Learn More'"
        />
      </FormSection>

      <FormSection title="Visibility">
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
        <Select
          label="Status"
          value={form.status ? 'active' : 'inactive'}
          onChange={(e) => setField('status', e.target.value === 'active')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <Checkbox
          label="Mark as default service"
          checked={form.isDefault}
          onChange={(e) => setField('isDefault', e.target.checked)}
        />
      </FormSection>
    </AdminFormShell>
  )
}

export default CheckoutServiceFormPage
