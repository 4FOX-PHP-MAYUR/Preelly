import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Textarea from '../../components/AdminUI/Textarea'
import Select from '../../components/AdminUI/Select'
import Checkbox from '../../components/AdminUI/Checkbox'
import toast from 'react-hot-toast'
import StarRating from './StarRating'

const LIST_PATH = '/testimonials'

const NAME_MIN = 2
const NAME_MAX = 100
const TESTIMONIAL_MIN = 10
const TESTIMONIAL_MAX = 2000
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const EMPTY_FORM = {
  testimonialName: '',
  customerType: 'buyer',
  testimonial: '',
  rating: 5,
  displayOrder: '0',
  profileImageFile: null,
  imagePreview: '',
  clearProfileImage: false,
  status: true,
}

function validate(form) {
  const errors = {}

  const name = form.testimonialName.trim()
  if (!name) {
    errors.testimonialName = 'Testimonial name is required'
  } else if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.testimonialName = `Testimonial name must be between ${NAME_MIN} and ${NAME_MAX} characters`
  }

  if (!['seller', 'buyer'].includes(form.customerType)) {
    errors.customerType = 'Customer type is required'
  }

  const testimonial = form.testimonial.trim()
  if (!testimonial) {
    errors.testimonial = 'Testimonial is required'
  } else if (testimonial.length < TESTIMONIAL_MIN || testimonial.length > TESTIMONIAL_MAX) {
    errors.testimonial = `Testimonial must be between ${TESTIMONIAL_MIN} and ${TESTIMONIAL_MAX} characters`
  }

  const rating = Number(form.rating)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Rating must be between 1 and 5'
  }

  if (form.displayOrder !== '') {
    const order = Number(form.displayOrder)
    if (!Number.isFinite(order) || order < 0) {
      errors.displayOrder = 'Display order cannot be negative'
    }
  }

  return errors
}

function TestimonialFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(EMPTY_FORM)
  const [existingImage, setExistingImage] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getTestimonialById(id)
        const row = res.data
        if (!row) throw new Error('Testimonial not found')
        if (cancelled) return
        setForm({
          ...EMPTY_FORM,
          testimonialName: row.testimonialName || '',
          customerType: row.customerType || 'buyer',
          testimonial: row.testimonial || '',
          rating: row.rating ?? 5,
          displayOrder: String(row.displayOrder ?? 0),
          status: row.status !== false,
        })
        setExistingImage(row.profileImage || '')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load testimonial')
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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, profileImageFile: null, imagePreview: '', clearProfileImage: false }))
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or GIF images are allowed')
      e.target.value = ''
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error('Profile image must be 5MB or smaller')
      e.target.value = ''
      return
    }
    setForm((prev) => ({
      ...prev,
      profileImageFile: file,
      imagePreview: URL.createObjectURL(file),
      clearProfileImage: false,
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
        testimonialName: form.testimonialName.trim(),
        customerType: form.customerType,
        testimonial: form.testimonial.trim(),
        rating: Number(form.rating),
        displayOrder: form.displayOrder === '' ? 0 : Number(form.displayOrder),
        status: form.status,
      }
      if (form.profileImageFile) payload.profileImage = form.profileImageFile

      if (isEdit) {
        if (!form.profileImageFile && form.clearProfileImage) payload.clearProfileImage = 'true'
        await adminService.updateTestimonial(id, payload)
        toast.success('Testimonial updated')
      } else {
        await adminService.createTestimonial(payload)
        toast.success('Testimonial created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save testimonial')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Testimonial' : 'Add Testimonial'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const showPreview = form.imagePreview || (existingImage && !form.clearProfileImage)

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Testimonial' : 'Add Testimonial'}
      subtitle="Add a customer testimonial with rating and profile photo"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Testimonial Details">
        <Input
          label="Testimonial Name"
          value={form.testimonialName}
          onChange={(e) => setField('testimonialName', e.target.value)}
          error={errors.testimonialName}
          maxLength={NAME_MAX}
          required
        />
        <Select
          label="Customer Type"
          value={form.customerType}
          onChange={(e) => setField('customerType', e.target.value)}
          error={errors.customerType}
          options={[
            { value: 'buyer', label: 'Buyer' },
            { value: 'seller', label: 'Seller' },
          ]}
          required
        />
        <Textarea
          label="Testimonial"
          value={form.testimonial}
          onChange={(e) => setField('testimonial', e.target.value)}
          error={errors.testimonial}
          hint={`Between ${TESTIMONIAL_MIN} and ${TESTIMONIAL_MAX} characters`}
          maxLength={TESTIMONIAL_MAX}
          rows={5}
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Rating<span className="text-red-500 ml-0.5">*</span>
          </label>
          <StarRating value={Number(form.rating)} onChange={(v) => setField('rating', v)} />
          {errors.rating && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.rating}</p>}
        </div>
      </FormSection>

      <FormSection title="Additional Information">
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

      <FormSection title="Profile Image">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Profile Image
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, WebP or GIF, up to 5MB</p>
          {showPreview && (
            <img
              src={form.imagePreview || getMediaUrl(existingImage) || existingImage}
              alt="Profile preview"
              className="mt-3 h-20 w-20 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          )}
          {isEdit && existingImage && !form.profileImageFile && (
            <Checkbox
              label="Remove existing image"
              checked={form.clearProfileImage}
              onChange={(e) => setField('clearProfileImage', e.target.checked)}
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

export default TestimonialFormPage
