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
  Input,
} from '../../components/AdminUI'
import { Plus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DISCOUNT_TYPE_OPTIONS,
  APPLICABLE_TYPE_OPTIONS,
  labelFor,
  formatDate,
  formatDiscount,
} from './couponConstants'

const LIMIT = 10
const LIST_PATH = '/admin/coupons'

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  discountType: 'all',
  applicableType: 'all',
  startDate: '',
  endDate: '',
}

function CouponsListPage() {
  const navigate = useNavigate()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchCoupons = async (p = 1, f = filters) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: 'createdAt', sortDir: 'desc' }
      if (f.search?.trim()) params.search = f.search.trim()
      if (f.status !== 'all') params.status = f.status
      if (f.discountType !== 'all') params.discountType = f.discountType
      if (f.applicableType !== 'all') params.applicableType = f.applicableType
      if (f.startDate) params.startDate = new Date(f.startDate).toISOString()
      if (f.endDate) params.endDate = new Date(f.endDate).toISOString()

      const res = await adminService.getCoupons(params)
      const data = res.data || {}
      setCoupons(data.coupons || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load coupons')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons(1)
  }, [])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCoupons(1, filters)
  }

  const handleToggleStatus = async (row) => {
    const next = !row.status
    try {
      setLoading(true)
      await adminService.setCouponStatus(row.id, next)
      toast.success(next ? 'Coupon activated' : 'Coupon deactivated')
      await fetchCoupons(page, filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete coupon "${row.couponCode}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteCoupon(row.id)
      toast.success('Coupon deleted')
      await fetchCoupons(page, filters)
    } catch (err) {
      // A used coupon can't be deleted — surface the server's reason.
      toast.error(err.response?.data?.message || 'Failed to delete coupon')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'srNo',
      title: 'Sr No',
      // DataTable's render() only receives the row, so derive the running number
      // from its position in the current page.
      render: (row) => (page - 1) * LIMIT + coupons.findIndex((c) => c.id === row.id) + 1,
    },
    {
      key: 'couponCode',
      title: 'Coupon Code',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white">{row.couponCode}</span>
      ),
    },
    { key: 'couponName', title: 'Coupon Name', render: (row) => row.couponName },
    {
      key: 'discountType',
      title: 'Discount Type',
      render: (row) => labelFor(DISCOUNT_TYPE_OPTIONS, row.discountType),
    },
    { key: 'discountValue', title: 'Discount Value', render: (row) => formatDiscount(row) },
    {
      key: 'applicableType',
      title: 'Applicable For',
      render: (row) => labelFor(APPLICABLE_TYPE_OPTIONS, row.applicableType),
    },
    {
      key: 'usageLimit',
      title: 'Usage Limit',
      render: (row) => (row.usageLimit == null ? 'Unlimited' : row.usageLimit),
    },
    { key: 'usedCount', title: 'Used Count', render: (row) => row.usedCount ?? 0 },
    { key: 'startDate', title: 'Start Date', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', title: 'End Date', render: (row) => formatDate(row.endDate) },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <button type="button" onClick={() => handleToggleStatus(row)} className="focus:outline-none">
          <StatusBadge status={row.status ? 'active' : row.isExpired ? 'expired' : 'inactive'} />
        </button>
      ),
    },
    { key: 'createdAt', title: 'Created Date', render: (row) => formatDate(row.createdAt) },
  ]

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <AdminPage>
      <PageHeader
        title="Coupons"
        subtitle="Create and manage promotional coupon codes"
        action={<Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>Add Coupon</Button>}
      />

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by coupon code or name"
        filters={[
          {
            key: 'discountType',
            type: 'select',
            label: 'Discount Type',
            value: filters.discountType,
            onChange: (e) => setFilter('discountType', e.target.value),
            options: [{ value: 'all', label: 'All' }, ...DISCOUNT_TYPE_OPTIONS],
          },
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: filters.status,
            onChange: (e) => setFilter('status', e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            key: 'applicableType',
            type: 'select',
            label: 'Applicable For',
            value: filters.applicableType,
            onChange: (e) => setFilter('applicableType', e.target.value),
            options: [{ value: 'all', label: 'All' }, ...APPLICABLE_TYPE_OPTIONS],
          },
          {
            key: 'startDate',
            label: 'Start Date',
            render: () => (
              <Input
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilter('startDate', e.target.value)}
              />
            ),
          },
          {
            key: 'endDate',
            label: 'End Date',
            render: () => (
              <Input
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilter('endDate', e.target.value)}
              />
            ),
          },
        ]}
        actions={
          hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                fetchCoupons(1, EMPTY_FILTERS)
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
        emptyTitle="No coupons found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id}/edit`)}
        onDelete={handleDelete}
        customActions={(row) => (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`${LIST_PATH}/${row.id}`) }}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="View"
            aria-label={`View ${row.couponCode}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchCoupons(p, filters),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default CouponsListPage
