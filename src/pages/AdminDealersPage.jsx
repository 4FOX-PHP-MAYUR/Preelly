import React, { useEffect, useState } from 'react'
import { adminService } from '../services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import DataTable from '../components/AdminUI/DataTable'
import toast from 'react-hot-toast'
import { getMediaUrl } from '../utils/helpers'

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
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Dealers"
        subtitle="Manage dealer information"
        action={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Add Dealer
          </button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by dealer name or email..."
            className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                fetchDealers(1, '')
              }}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </form>
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{dealers.length}</span> of{' '}
          <span className="font-medium">{total}</span> dealers
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Dealer' : 'Add Dealer'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer Name *</label>
              <input
                type="text"
                value={form.dealer_name}
                onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
                required
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Dealer name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer Email *</label>
              <input
                type="email"
                value={form.dealer_email}
                onChange={(e) => setForm({ ...form, dealer_email: e.target.value })}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer Mobile *</label>
              <input
                type="tel"
                value={form.dealer_mobile}
                onChange={(e) => setForm({ ...form, dealer_mobile: e.target.value })}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer WhatsApp (optional)</label>
              <input
                type="tel"
                value={form.dealer_whatsapp}
                onChange={(e) => setForm({ ...form, dealer_whatsapp: e.target.value })}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="WhatsApp number"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Synopsis (optional)</label>
              <textarea
                value={form.synopsis}
                onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                rows={3}
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer Image (optional)</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-xs"
                />
                {(form.image_preview || (editing?.dealer_image && !form.clear_image)) && (
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        form.image_preview ||
                        getMediaUrl(editing?.dealer_image) ||
                        editing?.dealer_image
                      }
                      alt="Dealer"
                      className="h-12 w-12 rounded object-cover border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          dealer_image_file: null,
                          image_preview: '',
                          clear_image: true,
                        }))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
              >
                {editing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                <button
                  type="button"
                  onClick={() => handleToggleStatus(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
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
    </div>
  )
}

export default AdminDealersPage
