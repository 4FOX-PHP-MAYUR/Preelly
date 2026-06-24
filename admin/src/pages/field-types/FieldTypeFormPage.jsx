import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/field-types'

const emptyForm = {
  fieldValue: '',
  sortOrder: '',
  isActive: true,
}

function FieldTypeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getFieldTypeById(id)
        const row = res.data?.fieldType || res.data
        if (!row) throw new Error('Field type not found')
        if (cancelled) return
        setForm({
          fieldValue: row.fieldValue || '',
          sortOrder: typeof row.sortOrder === 'number' ? String(row.sortOrder) : '',
          isActive: row.isActive !== false,
        })
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load field type')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleSave = async () => {
    if (!form.fieldValue?.trim()) {
      toast.error('Field value is required')
      return
    }
    if (form.sortOrder === '' || form.sortOrder === null || form.sortOrder === undefined) {
      toast.error('Sort order is required')
      return
    }
    if (Number.isNaN(Number(form.sortOrder))) {
      toast.error('Sort order must be a number')
      return
    }
    try {
      setLoading(true)
      const payload = {
        fieldValue: form.fieldValue.trim(),
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
      }
      if (isEdit) {
        await adminService.updateFieldType(id, payload)
        toast.success('Field type updated')
      } else {
        await adminService.createFieldType(payload)
        toast.success('Field type created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save field type')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Field Type' : 'Add Field Type'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Field Type' : 'Add Field Type'}
      subtitle={isEdit ? 'Update field type details' : 'Create a new field type value'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save Changes' : 'Create Field Type'}
    >
      <FormSection title="Field type details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Field Value"
            value={form.fieldValue}
            onChange={(e) => setForm({ ...form, fieldValue: e.target.value })}
            required
            placeholder="e.g. Text, Number, Date…"
          />
          <Input
            label="Sort Order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            required
            placeholder="0"
            min={0}
          />
          <Select
            label="Status"
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </FormSection>
    </AdminFormShell>
  )
}

export default FieldTypeFormPage
