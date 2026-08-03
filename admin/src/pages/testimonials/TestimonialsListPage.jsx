import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
  Input,
} from '../../components/AdminUI'
import { Plus, ImageOff, Eye, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermission } from '../../hooks/usePermission'
import StarRating from './StarRating'

const LIMIT = 20
const LIST_PATH = '/testimonials'

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  customerType: 'all',
  fromDate: '',
  toDate: '',
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'seller', label: 'Seller' },
  { value: 'buyer', label: 'Buyer' },
]

function TestimonialsListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Testimonials')
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchTestimonials = async (p = 1, f = filters) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: 'displayOrder', sortDir: 'asc' }
      if (f.search?.trim()) params.search = f.search.trim()
      if (f.status !== 'all') params.status = f.status
      if (f.customerType !== 'all') params.customerType = f.customerType
      if (f.fromDate) params.fromDate = f.fromDate
      if (f.toDate) params.toDate = f.toDate

      const res = await adminService.getTestimonials(params)
      const data = res.data || {}
      setTestimonials(data.testimonials || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load testimonials')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTestimonials(1)
  }, [])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchTestimonials(1, filters)
  }

  const handleToggleStatus = async (row) => {
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setTestimonialStatus(row.id, newStatus)
      toast.success(newStatus ? 'Testimonial activated' : 'Testimonial deactivated')
      await fetchTestimonials(page, filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete testimonial "${row.testimonialName}"?`)) return
    try {
      setLoading(true)
      await adminService.deleteTestimonial(row.id)
      toast.success('Testimonial deleted')
      await fetchTestimonials(page, filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete testimonial')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filters.search?.trim()) params.search = filters.search.trim()
      if (filters.status !== 'all') params.status = filters.status
      if (filters.customerType !== 'all') params.customerType = filters.customerType
      if (filters.fromDate) params.fromDate = filters.fromDate
      if (filters.toDate) params.toDate = filters.toDate

      const res = await adminService.exportTestimonials(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export testimonials'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'testimonials.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message || 'Failed to export testimonials')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'profileImage',
      title: 'Photo',
      render: (row) =>
        row.profileImage ? (
          <img
            src={getMediaUrl(row.profileImage) || row.profileImage}
            alt={row.testimonialName}
            className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div
            className="h-10 w-10 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400"
            title="No photo"
          >
            <ImageOff className="h-4 w-4" aria-hidden="true" />
          </div>
        ),
    },
    {
      key: 'testimonialName',
      title: 'Name',
      render: (row) => <span className="font-medium">{row.testimonialName}</span>,
    },
    {
      key: 'customerType',
      title: 'Type',
      render: (row) => (row.customerType === 'seller' ? 'Seller' : 'Buyer'),
    },
    {
      key: 'rating',
      title: 'Rating',
      render: (row) => <StarRating value={row.rating} size="sm" />,
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

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <AdminPage>
      <PageHeader
        title="Testimonials"
        subtitle="Manage customer testimonials shown across the platform"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export to Excel
            </Button>
            {canCreate ? (
              <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
                Add Testimonial
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by testimonial name"
        filters={[
          {
            key: 'customerType',
            type: 'select',
            label: 'Customer Type',
            value: filters.customerType,
            onChange: (e) => setFilter('customerType', e.target.value),
            options: CUSTOMER_TYPE_OPTIONS,
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
            key: 'fromDate',
            label: 'From Date',
            render: () => (
              <Input
                label="From Date"
                type="date"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(e) => setFilter('fromDate', e.target.value)}
              />
            ),
          },
          {
            key: 'toDate',
            label: 'To Date',
            render: () => (
              <Input
                label="To Date"
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => setFilter('toDate', e.target.value)}
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
                fetchTestimonials(1, EMPTY_FILTERS)
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={testimonials}
        loading={loading}
        emptyTitle="No testimonials found"
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row.id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        customActions={(row) => (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`${LIST_PATH}/${row.id}`) }}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="View"
            aria-label={`View ${row.testimonialName}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchTestimonials(p, filters),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default TestimonialsListPage
