import React, { useCallback, useEffect, useState } from 'react'
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
  Modal,
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import { Eye, FileSpreadsheet, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatAmount, formatDateTime, truncateId } from './cartConstants'

const LIMIT = 20

const SCOPE_CONFIG = {
  all: {
    listPath: '/cart',
    title: 'All Cart Items',
    subtitle: 'All items currently in buyer carts, across every status',
    fetch: (params) => adminService.getCartItems(params),
  },
  pending: {
    listPath: '/cart/pending',
    title: 'Pending Cart Items',
    subtitle: 'Cart items that have not been purchased yet',
    fetch: (params) => adminService.getPendingCartItems(params),
  },
  purchased: {
    listPath: '/cart/purchased',
    title: 'Purchased Cart Items',
    subtitle: 'Cart items that have completed checkout',
    fetch: (params) => adminService.getPurchasedCartItems(params),
  },
}

const EMPTY_FILTERS = {
  search: '',
  category: '',
  status: 'all',
  fromDate: '',
  toDate: '',
}

function CartMobileCard({ row, actions }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          {row.productImage ? (
            <img
              src={row.productImage}
              alt={row.productTitle || 'Product'}
              className="h-10 w-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
              {row.productTitle || '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
              {truncateId(row.cartId)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={row.cartStatusBadge} label={row.cartStatusLabel} />
          {actions}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Buyer</p>
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.buyerName || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Seller</p>
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{row.sellerName || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Quantity</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{row.quantity}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Total Amount</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatAmount(row.totalAmount, row.currency)}
          </p>
        </div>
        <div className="min-w-0 col-span-2">
          <p className="text-slate-500 dark:text-slate-400">Added</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{formatDateTime(row.createdAt)}</p>
        </div>
      </div>
    </div>
  )
}

function CartListPage({ scope = 'all' }) {
  const navigate = useNavigate()
  usePermission('Cart')
  const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.all

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [categoryOptions, setCategoryOptions] = useState([])

  const [exporting, setExporting] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')

  const buildParams = (p, f) => {
    const params = { page: p, limit: LIMIT }
    if (f.search?.trim()) params.search = f.search.trim()
    if (f.category) params.category = f.category
    if (scope === 'all' && f.status !== 'all') params.status = f.status
    if (f.fromDate) params.fromDate = f.fromDate
    if (f.toDate) params.toDate = f.toDate
    return params
  }

  const fetchCartItems = useCallback(async (p = 1, f = filters) => {
    try {
      setLoading(true)
      setError(null)
      const res = await config.fetch(buildParams(p, f))
      const data = res.data || {}
      setItems(data.cartItems || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      const message = err.response?.data?.message || 'Failed to load cart items'
      setError(message)
      toast.error(message)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const fetchCategoryOptions = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryNestedForFilters()
      const roots = res.data?.categories || []
      const flat = []
      const walk = (nodes, depth) => {
        nodes.forEach((n) => {
          flat.push({ value: n.id || n._id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${n.name}` })
          const kids = n.subcategories || n.children || []
          if (kids.length) walk(kids, depth + 1)
        })
      }
      walk(roots, 0)
      setCategoryOptions(flat)
    } catch {
      setCategoryOptions([])
    }
  }, [])

  useEffect(() => {
    setFilters(EMPTY_FILTERS)
    fetchCartItems(1, EMPTY_FILTERS)
    fetchCategoryOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCartItems(1, filters)
  }

  const handleClear = () => {
    setFilters(EMPTY_FILTERS)
    fetchCartItems(1, EMPTY_FILTERS)
  }

  const openExportModal = () => {
    setExportFromDate('')
    setExportToDate('')
    setExportModalOpen(true)
  }

  const closeExportModal = () => {
    if (exporting) return
    setExportModalOpen(false)
  }

  const handleExportExcel = async () => {
    if (!exportFromDate || !exportToDate) {
      toast.error('Please select From Date and To Date')
      return
    }
    if (exportFromDate > exportToDate) {
      toast.error('From Date cannot be after To Date')
      return
    }

    try {
      setExporting(true)
      const params = { ...buildParams(1, filters), fromDate: exportFromDate, toDate: exportToDate }
      delete params.page
      delete params.limit

      const res = await adminService.exportCartItems(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export cart items'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `cart-${exportFromDate}_${exportToDate}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const truncated = String(res.headers?.['x-export-truncated'] || '') === '1'
      toast.success(truncated ? 'Excel exported (first 10,000 matching rows)' : 'Excel exported successfully')
      setExportModalOpen(false)
    } catch (err) {
      console.error(err)
      let message = 'Failed to export Excel'
      const data = err.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
      } else {
        message = err.message || err.response?.data?.message || message
      }
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'productImage',
      title: 'Product Image',
      render: (row) =>
        row.productImage ? (
          <img src={row.productImage} alt={row.productTitle || 'Product'} className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-slate-400" />
          </div>
        ),
    },
    {
      key: 'productTitle',
      title: 'Product Name',
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-white">{row.productTitle || '—'}</span>
      ),
    },
    { key: 'category', title: 'Category', render: (row) => row.category || '—' },
    { key: 'buyerName', title: 'Buyer Name', render: (row) => row.buyerName || '—' },
    {
      key: 'buyerEmail',
      title: 'Buyer Email',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.buyerEmail || '—'}</span>,
    },
    { key: 'sellerName', title: 'Seller Name', render: (row) => row.sellerName || '—' },
    {
      key: 'unitPrice',
      title: 'Product Price',
      render: (row) => <span className="tabular-nums">{formatAmount(row.unitPrice, row.currency)}</span>,
    },
    {
      key: 'totalAmount',
      title: 'Total Amount',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatAmount(row.totalAmount, row.currency)}</span>
      ),
    },
    {
      key: 'cartStatus',
      title: 'Cart Status',
      render: (row) => <StatusBadge status={row.cartStatusBadge} label={row.cartStatusLabel} />,
    },
    { key: 'createdAt', title: 'Added Date', render: (row) => formatDateTime(row.createdAt) },
    { key: 'updatedAt', title: 'Updated Date', render: (row) => formatDateTime(row.updatedAt) },
  ]

  const filterFields = [
    {
      key: 'category',
      type: 'select',
      label: 'Category',
      value: filters.category,
      onChange: (e) => setFilter('category', e.target.value),
      options: [{ value: '', label: 'All categories' }, ...categoryOptions],
    },
    {
      key: 'fromDate',
      render: () => (
        <div className="space-y-1.5">
          <label htmlFor="cart-from-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            From Date
          </label>
          <input
            id="cart-from-date"
            type="date"
            value={filters.fromDate}
            max={filters.toDate || undefined}
            onChange={(e) => setFilter('fromDate', e.target.value)}
            className="admin-input w-full"
          />
        </div>
      ),
    },
    {
      key: 'toDate',
      render: () => (
        <div className="space-y-1.5">
          <label htmlFor="cart-to-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            To Date
          </label>
          <input
            id="cart-to-date"
            type="date"
            value={filters.toDate}
            min={filters.fromDate || undefined}
            onChange={(e) => setFilter('toDate', e.target.value)}
            className="admin-input w-full"
          />
        </div>
      ),
    },
  ]

  if (scope === 'all') {
    filterFields.splice(1, 0, {
      key: 'status',
      type: 'select',
      label: 'Status',
      value: filters.status,
      onChange: (e) => setFilter('status', e.target.value),
      options: [{ value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'purchased', label: 'Purchased' }, { value: 'abandoned', label: 'Abandoned' }],
    })
  }

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <AdminPage>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={
          <Button variant="secondary" icon={FileSpreadsheet} onClick={openExportModal}>
            Export Excel
          </Button>
        }
      />

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by product, buyer or seller"
        filters={filterFields}
        actions={
          hasFilters ? (
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          ) : null
        }
      />

      {error && !loading && items.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => fetchCartItems(page, filters)}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="No cart items found"
          emptyDescription="Try adjusting filters or search terms"
          onRowClick={(row) => navigate(`/cart/${row.id}`)}
          mobileCardRender={(row, { actions }) => <CartMobileCard row={row} actions={actions} />}
          customActions={(row) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/cart/${row.id}`)
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="View details"
              aria-label={`View cart item ${row.cartId}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          showSearch={false}
          pagination={{ page, limit: LIMIT, total, onPageChange: (p) => fetchCartItems(p, filters) }}
          serverSide
        />
      )}

      <Modal
        open={exportModalOpen}
        onClose={closeExportModal}
        title="Export Excel"
        size="sm"
        footer={
          <Modal.Footer
            onCancel={closeExportModal}
            onConfirm={handleExportExcel}
            cancelLabel="Cancel"
            confirmLabel="Export"
            loading={exporting}
          />
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Choose the date range for the cart items you want to export.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="From Date"
            type="date"
            value={exportFromDate}
            onChange={(e) => setExportFromDate(e.target.value)}
            max={exportToDate || undefined}
            required
          />
          <Input
            label="To Date"
            type="date"
            value={exportToDate}
            onChange={(e) => setExportToDate(e.target.value)}
            min={exportFromDate || undefined}
            required
          />
        </div>
      </Modal>
    </AdminPage>
  )
}

export default CartListPage
