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
const LIST_PATH = '/admin/buyers-coupons'

function formatDiscount(row) {
  if (row.discountType === 'percentage') {
    const cap = row.maximumDiscountAmount ? ` up to AED ${row.maximumDiscountAmount}` : ''
    return `${row.discountValue}%${cap}`
  }
  return `AED ${Number(row.discountValue ?? 0).toLocaleString()}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function BuyersCouponsListPage() {
  const navigate = useNavigate()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchCoupons = async (p = 1, searchTerm = search, status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p, sortBy: 'createdAt', sortDir: 'desc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getBuyerCoupons(params)
      const data = res.data || {}
      setCoupons(data.buyerCoupons || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load buyer coupons')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCoupons(1, search, statusFilter)
  }

  const handleToggleStatus = async (row) => {
    const id = row.id || row._id
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setBuyerCouponStatus(id, newStatus)
      toast.success(newStatus ? 'Coupon activated' : 'Coupon deactivated')
      await fetchCoupons(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.couponName}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteBuyerCoupon(row.id || row._id)
      toast.success('Coupon deleted')
      await fetchCoupons(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete coupon')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'couponName',
      title: 'Coupon Name',
      render: (row) => <span className="font-medium">{row.couponName}</span>,
    },
    {
      key: 'couponCode',
      title: 'Code',
      render: (row) => (
        <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
          {row.couponCode}
        </span>
      ),
    },
    { key: 'discount', title: 'Discount', render: formatDiscount },
    { key: 'validTill', title: 'Valid Till', render: (row) => formatDate(row.validTill) },
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
        title="Buyer Coupons"
        subtitle="Coupons that discount checkout service charges only (never product prices)"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Buyer Coupon
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by code or name"
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
                fetchCoupons(1, '', 'all')
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={coupons}
        loading={loading}
        emptyTitle="No buyer coupons found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id || row._id}/edit`)}
        onDelete={handleDelete}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchCoupons(p, search, statusFilter),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default BuyersCouponsListPage
