import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import FormSection from '../../components/AdminUI/FormSection'
import Input from '../../components/AdminUI/Input'
import Textarea from '../../components/AdminUI/Textarea'
import RichTextEditor from '../../components/AdminUI/RichTextEditor'
import Select from '../../components/AdminUI/Select'
import Checkbox from '../../components/AdminUI/Checkbox'
import toast from 'react-hot-toast'

const LIST_PATH = '/pages'

const TITLE_MIN = 2
const TITLE_MAX = 150
const HEADING_MAX = 200
const META_TITLE_MAX = 70
const META_DESCRIPTION_MAX = 160
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EMPTY_FORM = {
  pageTitle: '',
  pageSlug: '',
  slugTouched: false,
  heading: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  displayOrder: '0',
  pageBannerImageFile: null,
  imagePreview: '',
  clearPageBannerImage: false,
  status: true,
}

function validate(form) {
  const errors = {}

  const title = form.pageTitle.trim()
  if (!title) {
    errors.pageTitle = 'Page title is required'
  } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.pageTitle = `Page title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`
  }

  if (form.pageSlug.trim() && !SLUG_PATTERN.test(form.pageSlug.trim())) {
    errors.pageSlug = 'Slug may only contain lowercase letters, numbers and hyphens'
  }

  const heading = form.heading.trim()
  if (!heading) {
    errors.heading = 'Heading is required'
  } else if (heading.length > HEADING_MAX) {
    errors.heading = `Heading cannot exceed ${HEADING_MAX} characters`
  }

  const plainDescription = form.description.replace(/<[^>]*>/g, '').trim()
  if (!plainDescription) {
    errors.description = 'Description is required'
  }

  if (form.metaTitle.length > META_TITLE_MAX) {
    errors.metaTitle = `Meta title should not exceed ${META_TITLE_MAX} characters`
  }

  if (form.metaDescription.length > META_DESCRIPTION_MAX) {
    errors.metaDescription = `Meta description should not exceed ${META_DESCRIPTION_MAX} characters`
  }

  if (form.displayOrder !== '') {
    const order = Number(form.displayOrder)
    if (!Number.isFinite(order) || order < 0) {
      errors.displayOrder = 'Display order cannot be negative'
    }
  }

  return errors
}

function PageFormPage() {
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
        const res = await adminService.getPageById(id)
        const row = res.data
        if (!row) throw new Error('Page not found')
        if (cancelled) return
        setForm({
          ...EMPTY_FORM,
          pageTitle: row.pageTitle || '',
          pageSlug: row.pageSlug || '',
          slugTouched: true,
          heading: row.heading || '',
          description: row.description || '',
          metaTitle: row.metaTitle || '',
          metaDescription: row.metaDescription || '',
          metaKeywords: row.metaKeywords || '',
          displayOrder: String(row.displayOrder ?? 0),
          status: row.status !== false,
        })
        setExistingImage(row.pageBannerImage || '')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load page')
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

  const handleTitleChange = (value) => {
    setForm((prev) => ({
      ...prev,
      pageTitle: value,
      // Auto-derive the slug from the title until the admin edits it manually.
      pageSlug: prev.slugTouched ? prev.pageSlug : slugify(value),
    }))
    setErrors((prev) => (prev.pageTitle ? { ...prev, pageTitle: undefined } : prev))
  }

  const handleSlugChange = (value) => {
    setForm((prev) => ({ ...prev, pageSlug: value, slugTouched: true }))
    setErrors((prev) => (prev.pageSlug ? { ...prev, pageSlug: undefined } : prev))
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, pageBannerImageFile: null, imagePreview: '', clearPageBannerImage: false }))
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG or WEBP images are allowed')
      e.target.value = ''
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error('Banner image must be 5MB or smaller')
      e.target.value = ''
      return
    }
    setForm((prev) => ({
      ...prev,
      pageBannerImageFile: file,
      imagePreview: URL.createObjectURL(file),
      clearPageBannerImage: false,
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
        pageTitle: form.pageTitle.trim(),
        heading: form.heading.trim(),
        description: form.description,
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
        metaKeywords: form.metaKeywords.trim(),
        displayOrder: form.displayOrder === '' ? 0 : Number(form.displayOrder),
        status: form.status,
      }
      if (form.slugTouched && form.pageSlug.trim()) payload.pageSlug = form.pageSlug.trim()
      if (form.pageBannerImageFile) payload.pageBannerImage = form.pageBannerImageFile

      if (isEdit) {
        if (!form.pageBannerImageFile && form.clearPageBannerImage) payload.clearPageBannerImage = 'true'
        await adminService.updatePage(id, payload)
        toast.success('Page updated')
      } else {
        await adminService.createPage(payload)
        toast.success('Page created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save page')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell
        title={isEdit ? 'Edit Page' : 'Add Page'}
        backTo={LIST_PATH}
        onSubmit={() => {}}
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const showPreview = form.imagePreview || (existingImage && !form.clearPageBannerImage)

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Page' : 'Add Page'}
      subtitle="Create static content pages published on the storefront (e.g. /about-us, /privacy-policy)"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <FormSection title="Page Details">
        <Input
          label="Page Title"
          value={form.pageTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          error={errors.pageTitle}
          maxLength={TITLE_MAX}
          required
        />
        <Input
          label="Page Slug"
          value={form.pageSlug}
          onChange={(e) => handleSlugChange(e.target.value)}
          error={errors.pageSlug}
          hint="Auto-generated from the page title — edit to customize the URL, e.g. /about-us"
        />
        <Input
          label="Heading"
          value={form.heading}
          onChange={(e) => setField('heading', e.target.value)}
          error={errors.heading}
          maxLength={HEADING_MAX}
          required
        />
        <RichTextEditor
          label="Description"
          value={form.description}
          onChange={(value) => setField('description', value)}
          error={errors.description}
          hint="Full page content — supports formatting, lists, links, images and tables"
          required
        />
      </FormSection>

      <FormSection title="Page Banner Image">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Banner Image
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, JPEG, PNG or WEBP, up to 5MB</p>
          {showPreview && (
            <img
              src={form.imagePreview || getMediaUrl(existingImage) || existingImage}
              alt="Banner preview"
              className="mt-3 h-32 w-full max-w-md rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
          )}
          {isEdit && existingImage && !form.pageBannerImageFile && (
            <Checkbox
              label="Remove existing banner image"
              checked={form.clearPageBannerImage}
              onChange={(e) => setField('clearPageBannerImage', e.target.checked)}
              className="mt-3"
            />
          )}
        </div>
      </FormSection>

      <FormSection title="SEO Metadata">
        <Input
          label="Meta Title"
          value={form.metaTitle}
          onChange={(e) => setField('metaTitle', e.target.value)}
          error={errors.metaTitle}
          maxLength={META_TITLE_MAX}
          hint={`${form.metaTitle.length}/${META_TITLE_MAX} characters recommended`}
        />
        <Textarea
          label="Meta Description"
          value={form.metaDescription}
          onChange={(e) => setField('metaDescription', e.target.value)}
          error={errors.metaDescription}
          maxLength={META_DESCRIPTION_MAX}
          rows={3}
          hint={`${form.metaDescription.length}/${META_DESCRIPTION_MAX} characters recommended`}
        />
        <Input
          label="Meta Keywords"
          value={form.metaKeywords}
          onChange={(e) => setField('metaKeywords', e.target.value)}
          hint="Comma-separated keywords (optional)"
        />
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

export default PageFormPage
