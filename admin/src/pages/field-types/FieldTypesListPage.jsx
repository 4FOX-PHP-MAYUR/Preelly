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

const LIMIT = 20
const LIST_PATH = '/admin/field-types'

function FieldTypesListPage() {
  const navigate = useNavigate()
  const [fieldTypes, setFieldTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchFieldTypes = async (p = 1, searchTerm = '', status = statusFilter) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: 'sortOrder', sortDir: 'asc' }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getFieldTypes(params)
      const data = res.data || {}
      setFieldTypes(data.fieldTypes || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load field types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFieldTypes(1)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchFieldTypes(1, search, statusFilter)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    fetchFieldTypes(1, '', 'all')
  }

  const handleToggleStatus = async (row) => {
    try {
      setLoading(true)
      await adminService.updateFieldType(row._id, { isActive: !row.isActive })
      toast.success(row.isActive ? 'Set inactive' : 'Set active')
      await fetchFieldTypes(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.fieldValue}"? This action cannot be undone.`)) return
    try {
      setLoading(true)
      await adminService.deleteFieldType(row._id)
      toast.success('Field type deleted')
      await fetchFieldTypes(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete field type')
    } finally {
      setLoading(false)
    }
  }

  const hasActiveFilters = search || statusFilter !== 'all'

  return (
    <AdminPage>
      <PageHeader
        title="Field Types"
        subtitle="Manage field type values used across the platform"
        action={
          <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
            Add Field Type
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search field types…"
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
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{fieldTypes.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> field types
      </p>

      <DataTable
        columns={[
          {
            key: 'fieldValue',
            title: 'Field Value',
            render: (r) => <span className="font-medium text-gray-900">{r.fieldValue}</span>,
          },
          {
            key: 'sortOrder',
            title: 'Sort Order',
            render: (r) => <span className="text-gray-700">{r.sortOrder}</span>,
          },
          {
            key: 'isActive',
            title: 'Status',
            render: (r) => {
              const isActive = r.isActive !== false
              return (
                <button type="button" onClick={() => handleToggleStatus(r)} className="focus:outline-none">
                  <StatusBadge status={isActive ? 'active' : 'inactive'} />
                </button>
              )
            },
          },
        ]}
        data={fieldTypes}
        loading={loading}
        emptyTitle="No field types found"
        emptyDescription={search ? `No results for "${search}"` : 'Click "Add Field Type" to create your first one.'}
        showSearch={false}
        serverSide
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchFieldTypes(p, search, statusFilter),
        }}
        onEdit={(row) => navigate(`${LIST_PATH}/${row._id}/edit`)}
        onDelete={handleDelete}
      />
    </AdminPage>
  )
}

export default FieldTypesListPage
