import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/emirates'

function EmirateFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState({ name: '', slug: '', status: true })

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getEmirateById(id)
        const row = res.data?.emirate || res.data
        if (!row) throw new Error('Emirate not found')
        if (cancelled) return
        setForm({
          name: row.name || '',
          slug: row.slug || '',
          status: row.status !== false,
        })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load emirate')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      setLoading(true)
      const payload = {
        name: form.name.trim(),
        slug: form.slug?.trim() || undefined,
        status: form.status,
      }
      if (isEdit) {
        await adminService.updateEmirate(id, payload)
        toast.success('Emirate updated')
      } else {
        await adminService.createEmirate(payload)
        toast.success('Emirate created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save emirate')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Emirate' : 'Create Emirate'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Emirate' : 'Create Emirate'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
    >
      <Input
        label="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <Input
        label="Slug"
        value={form.slug}
        onChange={(e) => setForm({ ...form, slug: e.target.value })}
        hint="Auto-generated from name if empty"
      />
      <Select
        label="Status"
        value={form.status ? 'active' : 'inactive'}
        onChange={(e) => setForm({ ...form, status: e.target.value === 'active' })}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />
    </AdminFormShell>
  )
}

export default EmirateFormPage
