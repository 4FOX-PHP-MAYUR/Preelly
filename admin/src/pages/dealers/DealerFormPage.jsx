import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Textarea from '../../components/AdminUI/Textarea'
import Checkbox from '../../components/AdminUI/Checkbox'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIST_PATH = '/admin/dealers'

const emptyForm = {
  dealer_name: '',
  dealer_email: '',
  dealer_mobile: '',
  dealer_whatsapp: '',
  synopsis: '',
  dealer_image_file: null,
  image_preview: '',
  clear_image: false,
  status: true,
}

function DealerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [existingImage, setExistingImage] = useState('')
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getDealerById(id)
        const row = res.data?.dealer || res.data
        if (!row) throw new Error('Dealer not found')
        if (cancelled) return
        setForm({
          dealer_name: row.dealer_name || '',
          dealer_email: row.dealer_email || '',
          dealer_mobile: row.dealer_mobile || '',
          dealer_whatsapp: row.dealer_whatsapp || '',
          synopsis: row.synopsis || '',
          dealer_image_file: null,
          image_preview: '',
          clear_image: false,
          status: row.status !== false,
        })
        setExistingImage(row.dealer_image || '')
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load dealer')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, dealer_image_file: null, image_preview: '', clear_image: false }))
      return
    }
    setForm((prev) => ({
      ...prev,
      dealer_image_file: file,
      image_preview: URL.createObjectURL(file),
      clear_image: false,
    }))
  }

  const handleSave = async () => {
    if (!form.dealer_name?.trim()) {
      toast.error('Dealer name is required')
      return
    }
    try {
      setLoading(true)
      const payload = {
        dealer_name: form.dealer_name.trim(),
        dealer_email: form.dealer_email.trim(),
        dealer_mobile: form.dealer_mobile.trim(),
        dealer_whatsapp: form.dealer_whatsapp?.trim() || '',
        synopsis: form.synopsis?.trim() || '',
        status: form.status,
      }
      if (form.dealer_image_file) payload.dealer_image = form.dealer_image_file
      if (isEdit) {
        if (form.clear_image) payload.clear_image = 'true'
        await adminService.updateDealer(id, payload)
        toast.success('Dealer updated')
      } else {
        await adminService.createDealer(payload)
        toast.success('Dealer created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save dealer')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Dealer' : 'Add Dealer'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Dealer' : 'Add Dealer'}
      subtitle={isEdit ? 'Update dealer details' : 'Create a new dealer record'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save Changes' : 'Create Dealer'}
    >
      <FormSection title="Basic information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Dealer Name"
            value={form.dealer_name}
            onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
            required
            placeholder="Dealer name"
          />
          <Input
            label="Dealer Email"
            type="email"
            value={form.dealer_email}
            onChange={(e) => setForm({ ...form, dealer_email: e.target.value })}
            placeholder="email@example.com"
          />
          <Input
            label="Dealer Mobile"
            type="tel"
            value={form.dealer_mobile}
            onChange={(e) => setForm({ ...form, dealer_mobile: e.target.value })}
            placeholder="Phone number"
          />
          <Input
            label="Dealer WhatsApp"
            type="tel"
            value={form.dealer_whatsapp}
            onChange={(e) => setForm({ ...form, dealer_whatsapp: e.target.value })}
            placeholder="WhatsApp number"
            hint="Optional"
          />
          <div className="md:col-span-2">
            <Textarea
              label="Synopsis"
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              placeholder="Brief description"
              hint="Optional"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Image & status">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Dealer Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          {(form.image_preview || (existingImage && !form.clear_image)) && (
            <img
              src={form.image_preview || getMediaUrl(existingImage) || existingImage}
              alt="Preview"
              className="mt-3 h-20 w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
          )}
          {isEdit && existingImage && (
            <Checkbox
              label="Remove existing image"
              checked={form.clear_image}
              onChange={(e) => setForm({ ...form, clear_image: e.target.checked })}
              className="mt-3"
            />
          )}
        </div>
        <Checkbox
          label="Active"
          description="Dealer is visible and available"
          checked={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.checked })}
        />
      </FormSection>
    </AdminFormShell>
  )
}

export default DealerFormPage
