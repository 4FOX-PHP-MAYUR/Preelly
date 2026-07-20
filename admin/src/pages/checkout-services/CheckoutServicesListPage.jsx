import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
} from '../../components/AdminUI'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const LIMIT = 20
const LIST_PATH = '/admin/checkout-services'

const PRICE_TYPE_LABEL = {
  FIXED: 'Fixed',
  STARTING_FROM: 'Starting From',
  FREE: 'Free',
}

function formatPrice(row) {
  if (row.priceType === 'FREE') return 'Free'
  const amount = Number(row.price ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return row.priceType === 'STARTING_FROM' ? `Starts with AED ${amount}` : `AED ${amount}`
}

function CheckoutServicesListPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchServices = async (p = 1, searchTerm = search, status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p, sortBy: 'displayOrder', sortDir: 'asc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getCheckoutServices(params)
      const data = res.data || {}
      setServices(data.checkoutServices || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load checkout services')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchServices(1, search, statusFilter)
  }

  const handleToggleStatus = async (row) => {
    const id = row.id || row._id
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setCheckoutServiceStatus(id, newStatus)
      toast.success(newStatus ? 'Checkout service activated' : 'Checkout service deactivated')
      await fetchServices(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.serviceName}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteCheckoutService(row.id || row._id)
      toast.success('Checkout service deleted')
      await fetchServices(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete checkout service')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'serviceName',
      title: 'Service Name',
      render: (row) => <span className="font-medium">{row.serviceName}</span>,
    },
    {
      key: 'priceType',
      title: 'Price Type',
      render: (row) => PRICE_TYPE_LABEL[row.priceType] || row.priceType,
    },
    {
      key: 'price',
      title: 'Price',
      render: (row) => <span className="font-medium">{formatPrice(row)}</span>,
    },
    {
      key: 'highlights',
      title: 'Highlights',
      render: (row) => (
        <span className="text-slate-500">{(row.highlights || []).length}</span>
      ),
    },
    { key: 'displayOrder', title: 'Order', render: (row) => row.displayOrder ?? 0 },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <button type="button" onClick={() => handleToggleStatus(row)} className="focus:outline-none">
          <StatusBadge status={row.status ? 'active' : 'inactive'} />
        </button>
      ),
    },
  ]

  const hasFilters = search || statusFilter !== 'all'

  return (
    <AdminPage>
      <PageHeader
        title="Checkout Services"
        subtitle="Manage checkout add-ons (Pay Through Preelly, Pick & Drop Service, …)"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Checkout Service
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by service name"
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ]}
        actions={
          hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                fetchServices(1, '', 'all')
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={services}
        loading={loading}
        emptyTitle="No checkout services found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id || row._id}/edit`)}
        onDelete={handleDelete}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchServices(p, search, statusFilter),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default CheckoutServicesListPage
