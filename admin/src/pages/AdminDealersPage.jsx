import React, { useEffect, useState } from 'react'
import { adminService } from '@shared/services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import AdminPage from '../components/AdminUI/AdminPage'
import DataTable from '../components/AdminUI/DataTable'
import Button from '../components/AdminUI/Button'
import Drawer from '../components/AdminUI/Drawer'
import Input from '../components/AdminUI/Input'
import Textarea from '../components/AdminUI/Textarea'
import Checkbox from '../components/AdminUI/Checkbox'
import FilterBar from '../components/AdminUI/FilterBar'
import StatusBadge from '../components/AdminUI/StatusBadge'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIMIT = 20

function AdminDealersPage() {
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    dealer_name: '',
    dealer_email: '',
    dealer_mobile: '',
    dealer_whatsapp: '',
    synopsis: '',
    dealer_image_file: null,
    image_preview: '',
    clear_image: false,
    status: true,
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchDealers = async (p = 1, searchTerm = '') => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim()
      const res = await adminService.getDealers(params)
      const data = res.data || {}
      const items = data.dealers || []
      setDealers(items)
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dealers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDealers(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchDealers(1, search)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      dealer_name: '',
      dealer_email: '',
      dealer_mobile: '',
      dealer_whatsapp: '',
      synopsis: '',
      dealer_image_file: null,
      image_preview: '',
      clear_image: false,
      status: true,
    })
    setShowForm(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, dealer_image_file: null, image_preview: '', clear_image: false }))
      return
    }
    const preview = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, dealer_image_file: file, image_preview: preview, clear_image: false }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
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
      if (form.dealer_image_file) {
        payload.dealer_image = form.dealer_image_file
      }
      if (editing) {
        if (form.clear_image) payload.clear_image = 'true'
        await adminService.updateDealer(editing._id, payload)
        toast.success('Dealer updated')
      } else {
        await adminService.createDealer(payload)
        toast.success('Dealer created')
      }
      setShowForm(false)
      setEditing(null)
      setForm({
        dealer_name: '',
        dealer_email: '',
        dealer_mobile: '',
        dealer_whatsapp: '',
        synopsis: '',
        dealer_image_file: null,
        image_preview: '',
        clear_image: false,
        status: true,
      })
      await fetchDealers(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save dealer')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row) => {
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setDealerStatus(row._id, newStatus)
      toast.success(newStatus ? 'Dealer set to active' : 'Dealer set to inactive')
      await fetchDealers(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete this dealer?')) return
    try {
      setLoading(true)
      await adminService.deleteDealer(row._id)
      toast.success('Dealer deleted')
      setShowForm(false)
      setEditing(null)
      await fetchDealers(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (row) => {
    setEditing(row)
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
    setShowForm(true)
  }

  return (
    <AdminPage>
      <PageHeader
        title="Dealers"
        subtitle="Manage dealer information and contact details"
        action={
          <Button onClick={openAdd} icon={Plus}>
            Add Dealer
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by dealer name or email..."
        actions={
          search ? (
            <Button variant="secondary" onClick={() => { setSearch(''); fetchDealers(1, '') }}>
              Clear
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{dealers.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> dealers
      </p>

      <Drawer
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Edit Dealer' : 'Add Dealer'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditing(null) }}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={loading}>
              {editing ? 'Save Changes' : 'Create Dealer'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Dealer Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
            />
            {(form.image_preview || editing?.dealer_image) && (
              <img
                src={form.image_preview || getMediaUrl(editing?.dealer_image) || editing?.dealer_image}
                alt="Preview"
                className="mt-3 h-20 w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
            )}
            {editing && (
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
        </form>
      </Drawer>

      <DataTable
        columns={[
          {
            key: 'dealer_image',
            title: 'Image',
            render: (r) => {
              const src = r.dealer_image
                ? getMediaUrl(r.dealer_image) || r.dealer_image
                : null
              if (!src) return <span className="text-gray-400 text-xs">—</span>
              return (
                <img
                  src={src}
                  alt={r.dealer_name}
                  className="h-10 w-10 rounded object-cover border border-gray-200"
                />
              )
            },
          },
          { key: 'dealer_name', title: 'Dealer Name', render: (r) => <span className="font-medium text-gray-900">{r.dealer_name}</span> },
          { key: 'dealer_email', title: 'Email', render: (r) => <span className="text-gray-700">{r.dealer_email}</span> },
          { key: 'dealer_mobile', title: 'Mobile', render: (r) => <span className="text-gray-700">{r.dealer_mobile}</span> },
          { key: 'dealer_whatsapp', title: 'WhatsApp', render: (r) => <span className="text-gray-700">{r.dealer_whatsapp || '—'}</span> },
          {
            key: 'status',
            title: 'Status',
            render: (r) => {
              const isActive = r.status !== false
              return (
                <button type="button" onClick={() => handleToggleStatus(r)} className="focus:outline-none">
                  <StatusBadge status={isActive ? 'active' : 'inactive'} />
                </button>
              )
            },
          },
        ]}
        data={dealers}
        loading={loading}
        serverSide
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchDealers(p, search),
        }}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </AdminPage>
  )
}

export default AdminDealersPage
