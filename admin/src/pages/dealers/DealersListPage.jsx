import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import PageHeader from '../../components/AdminUI/PageHeader'
import AdminPage from '../../components/AdminUI/AdminPage'
import DataTable from '../../components/AdminUI/DataTable'
import Button from '../../components/AdminUI/Button'
import FilterBar from '../../components/AdminUI/FilterBar'
import StatusBadge from '../../components/AdminUI/StatusBadge'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIMIT = 20
const LIST_PATH = '/admin/dealers'

function DealersListPage() {
  const navigate = useNavigate()
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchDealers = async (p = 1, searchTerm = '', status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getDealers(params)
      const data = res.data || {}
      setDealers(data.dealers || [])
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
    fetchDealers(1, search, statusFilter)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    fetchDealers(1, '', 'all')
  }

  const handleToggleStatus = async (row) => {
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setDealerStatus(row._id, newStatus)
      toast.success(newStatus ? 'Dealer set to active' : 'Dealer set to inactive')
      await fetchDealers(page, search, statusFilter)
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
      await fetchDealers(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const hasActiveFilters = search || statusFilter !== 'all'

  return (
    <AdminPage>
      <PageHeader
        title="Dealers"
        subtitle="Manage dealer information and contact details"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Dealer
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by dealer name or email..."
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ]}
        actions={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{dealers.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> dealers
      </p>

      <DataTable
        columns={[
          {
            key: 'dealer_image',
            title: 'Image',
            render: (r) => {
              const src = r.dealer_image ? getMediaUrl(r.dealer_image) || r.dealer_image : null
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
          onPageChange: (p) => fetchDealers(p, search, statusFilter),
        }}
        onEdit={(row) => navigate(`${LIST_PATH}/${row._id}/edit`)}
        onDelete={handleDelete}
      />
    </AdminPage>
  )
}

export default DealersListPage
