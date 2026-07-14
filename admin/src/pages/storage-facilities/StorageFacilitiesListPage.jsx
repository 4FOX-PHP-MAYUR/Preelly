import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
} from '../../components/AdminUI'
import { Plus, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'

const LIMIT = 20
const LIST_PATH = '/admin/storage-facilities'

function formatAmount(value) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function StorageFacilitiesListPage() {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchFacilities = async (p = 1, searchTerm = search, status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p, sortBy: 'displayOrder', sortDir: 'asc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getStorageFacilities(params)
      const data = res.data || {}
      setFacilities(data.storageFacilities || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load storage facilities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFacilities(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchFacilities(1, search, statusFilter)
  }

  const handleToggleStatus = async (row) => {
    const id = row.id || row._id
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setStorageFacilityStatus(id, newStatus)
      toast.success(newStatus ? 'Storage facility activated' : 'Storage facility deactivated')
      await fetchFacilities(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.facilityWeek}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteStorageFacility(row.id || row._id)
      toast.success('Storage facility deleted')
      await fetchFacilities(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete storage facility')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'imageIcon',
      title: 'Icon',
      render: (row) =>
        row.imageIcon ? (
          <img
            src={getMediaUrl(row.imageIcon) || row.imageIcon}
            alt={row.facilityWeek}
            className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div
            className="h-10 w-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400"
            title="No icon"
          >
            <ImageOff className="h-4 w-4" aria-hidden="true" />
          </div>
        ),
    },
    {
      key: 'facilityWeek',
      title: 'Facility Week',
      render: (row) => <span className="font-medium">{row.facilityWeek}</span>,
    },
    {
      key: 'facilityAmount',
      title: 'Amount',
      render: (row) => <span className="font-medium">{formatAmount(row.facilityAmount)}</span>,
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
        title="Storage Facilities"
        subtitle="Manage storage facility durations, pricing and icons"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Storage Facility
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by facility week"
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
                fetchFacilities(1, '', 'all')
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={facilities}
        loading={loading}
        emptyTitle="No storage facilities found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id || row._id}/edit`)}
        onDelete={handleDelete}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchFacilities(p, search, statusFilter),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default StorageFacilitiesListPage
