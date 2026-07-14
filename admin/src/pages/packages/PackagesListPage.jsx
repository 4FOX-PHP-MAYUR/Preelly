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
import { Plus, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const LIMIT = 20
const LIST_PATH = '/admin/packages'

function formatAmount(value) {
  const num = Number(value ?? 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PackagesListPage() {
  const navigate = useNavigate()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [recommendedFilter, setRecommendedFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPackages = async (
    p = 1,
    searchTerm = search,
    status = statusFilter,
    isRecomended = recommendedFilter
  ) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p, sortBy: 'displayOrder', sortDir: 'asc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      if (isRecomended && isRecomended !== 'all') params.isRecomended = isRecomended
      const res = await adminService.getPackages(params)
      const data = res.data || {}
      setPackages(data.packages || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchPackages(1, search, statusFilter, recommendedFilter)
  }

  const handleToggleStatus = async (row) => {
    const id = row.id || row._id
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setPackageStatus(id, newStatus)
      toast.success(newStatus ? 'Package activated' : 'Package deactivated')
      await fetchPackages(page, search, statusFilter, recommendedFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.packageName}"?`)) return
    try {
      setLoading(true)
      await adminService.deletePackage(row.id || row._id)
      toast.success('Package deleted')
      await fetchPackages(page, search, statusFilter, recommendedFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete package')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'packageName',
      title: 'Package',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.packageName}</span>
          {row.isRecomended && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              title="Recommended package"
            >
              <Star className="h-3 w-3" aria-hidden="true" />
              Recommended
            </span>
          )}
        </div>
      ),
    },
    { key: 'displayOrder', title: 'Order', render: (row) => row.displayOrder ?? 0 },
    {
      key: 'packageAmount',
      title: 'Amount',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatAmount(row.packageAmount)}</span>
          {row.isVatApplicable && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              +{row.vatAmount}% VAT ({formatAmount(row.vatValue)}) = {formatAmount(row.totalAmount)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'validityDays',
      title: 'Validity',
      render: (row) => (row.validityDays ? `${row.validityDays} days` : '—'),
    },
    {
      key: 'packageFeatures',
      title: 'Features',
      render: (row) => {
        const count = row.packageFeatures?.length ?? 0
        return count ? `${count} feature${count > 1 ? 's' : ''}` : '—'
      },
    },
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

  const hasFilters = search || statusFilter !== 'all' || recommendedFilter !== 'all'

  return (
    <AdminPage>
      <PageHeader
        title="Packages"
        subtitle="Manage subscription packages, pricing, VAT and validity"
        action={<Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>Add Package</Button>}
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by package name"
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
          {
            key: 'isRecomended',
            type: 'select',
            label: 'Recommended',
            value: recommendedFilter,
            onChange: (e) => setRecommendedFilter(e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Recommended' },
              { value: 'no', label: 'Not recommended' },
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
                setRecommendedFilter('all')
                fetchPackages(1, '', 'all', 'all')
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={packages}
        loading={loading}
        emptyTitle="No packages found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id || row._id}/edit`)}
        onDelete={handleDelete}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchPackages(p, search, statusFilter, recommendedFilter),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default PackagesListPage
