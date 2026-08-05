import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
  Input,
} from '../../components/AdminUI'
import { Plus, Eye, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermission } from '../../hooks/usePermission'

const LIMIT = 20
const LIST_PATH = '/pages'

const EMPTY_FILTERS = {
  search: '',
  slug: '',
  status: 'all',
  fromDate: '',
  toDate: '',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function PagesListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Pages')
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPages = async (p = 1, f = filters) => {
    try {
      setLoading(true)
      const params = { page: p, limit: LIMIT, sortBy: 'displayOrder', sortDir: 'asc' }
      if (f.search?.trim()) params.search = f.search.trim()
      if (f.slug?.trim()) params.slug = f.slug.trim()
      if (f.status !== 'all') params.status = f.status
      if (f.fromDate) params.fromDate = f.fromDate
      if (f.toDate) params.toDate = f.toDate

      const res = await adminService.getPages(params)
      const data = res.data || {}
      setPages(data.pages || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load pages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPages(1)
  }, [])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchPages(1, filters)
  }

  const handleToggleStatus = async (row) => {
    const newStatus = !row.status
    try {
      setLoading(true)
      await adminService.setPageStatus(row.id, newStatus)
      toast.success(newStatus ? 'Page activated' : 'Page deactivated')
      await fetchPages(page, filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete page "${row.pageTitle}"?`)) return
    try {
      setLoading(true)
      await adminService.deletePage(row.id)
      toast.success('Page deleted')
      await fetchPages(page, filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete page')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filters.search?.trim()) params.search = filters.search.trim()
      if (filters.slug?.trim()) params.slug = filters.slug.trim()
      if (filters.status !== 'all') params.status = filters.status
      if (filters.fromDate) params.fromDate = filters.fromDate
      if (filters.toDate) params.toDate = filters.toDate

      const res = await adminService.exportPages(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export pages'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'pages.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message || 'Failed to export pages')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'pageTitle',
      title: 'Page Title',
      render: (row) => <span className="font-medium">{row.pageTitle}</span>,
    },
    {
      key: 'pageSlug',
      title: 'Slug',
      render: (row) => <code className="text-xs text-slate-500 dark:text-slate-400">/{row.pageSlug}</code>,
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
    { key: 'createdAt', title: 'Created Date', render: (row) => formatDate(row.createdAt) },
    { key: 'updatedAt', title: 'Updated Date', render: (row) => formatDate(row.updatedAt) },
  ]

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <AdminPage>
      <PageHeader
        title="Pages"
        subtitle="Manage static content pages published on the storefront (About Us, Privacy Policy, …)"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export to Excel
            </Button>
            {canCreate ? (
              <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
                Add Page
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by page title"
        filters={[
          {
            key: 'slug',
            label: 'Slug',
            render: () => (
              <Input
                label="Slug"
                value={filters.slug}
                onChange={(e) => setFilter('slug', e.target.value)}
                placeholder="e.g. about-us"
              />
            ),
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
                fetchPages(1, EMPTY_FILTERS)
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={pages}
        loading={loading}
        emptyTitle="No pages found"
        emptyDescription="Create your first static content page to get started."
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row.id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        customActions={(row) => (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`${LIST_PATH}/${row.id}`) }}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="View"
            aria-label={`View ${row.pageTitle}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchPages(p, filters),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default PagesListPage
