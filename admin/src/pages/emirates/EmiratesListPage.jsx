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
const LIST_PATH = '/admin/emirates'

function EmiratesListPage() {
  const navigate = useNavigate()
  const [emirates, setEmirates] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchEmirates = async (p = 1, searchTerm = '', status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p, sortBy: 'name', sortDir: 'asc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getEmirates(params)
      const data = res.data || {}
      setEmirates(data.emirates || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load emirates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmirates(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchEmirates(1, search, statusFilter)
  }

  const handleToggleStatus = async (row) => {
    const id = row.id || row._id
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setEmirateStatus(id, newStatus)
      toast.success(newStatus ? 'Emirate set to active' : 'Emirate set to inactive')
      await fetchEmirates(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteEmirate(row.id || row._id)
      toast.success('Emirate deleted')
      await fetchEmirates(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete emirate')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'name', title: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'slug', title: 'Slug', render: (row) => row.slug },
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

  return (
    <AdminPage>
      <PageHeader
        title="Emirates (Cities)"
        subtitle="Manage emirates used as form-field option sources and location master data"
        action={<Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>Add Emirate</Button>}
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by name"
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
          (search || statusFilter !== 'all') ? (
            <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); fetchEmirates(1, '', 'all') }}>
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={emirates}
        loading={loading}
        emptyTitle="No emirates found"
        onEdit={(row) => navigate(`${LIST_PATH}/${row.id || row._id}/edit`)}
        onDelete={handleDelete}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchEmirates(p, search, statusFilter),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default EmiratesListPage
