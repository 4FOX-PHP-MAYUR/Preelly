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
  Card,
  Input,
  Modal,
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import {
  Eye,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock3,
  Banknote,
  FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PAYMENT_STATUS_OPTIONS,
  ORDER_PLATFORM_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SORT_OPTIONS,
  formatAmount,
  formatDateTime,
  truncateId,
} from './transactionConstants'

const LIMIT = 10
const LIST_PATH = '/transactions'

const EMPTY_FILTERS = {
  search: '',
  paymentStatus: 'all',
  orderPlatform: 'all',
  paymentMethod: 'all',
  sort: 'latest',
}

const EMPTY_STATS = {
  totalTransactions: 0,
  successfulTransactions: 0,
  failedTransactions: 0,
  pendingTransactions: 0,
  totalTransactionAmount: 0,
  currency: 'AED',
}

function TransactionMobileCard({ row, actions }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
            {row.orderId || '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono truncate" title={row.transactionId}>
            {truncateId(row.transactionId)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge
            status={row.paymentStatusBadge || 'pending'}
            label={row.paymentStatus}
          />
          {actions}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Customer</p>
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.customerName || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Amount</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatAmount(row.amount, row.currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Method</p>
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{row.paymentMethod || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Platform</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {row.orderPlatformLabel || row.orderPlatform || '—'}
          </p>
        </div>
        <div className="min-w-0 col-span-2">
          <p className="text-slate-500 dark:text-slate-400">Email</p>
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{row.customerEmail || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Gateway Txn</p>
          <p className="font-mono text-slate-800 dark:text-slate-200 truncate" title={row.gatewayTransactionId || ''}>
            {row.gatewayTransactionId ? truncateId(row.gatewayTransactionId, 10, 4) : '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Date</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {formatDateTime(row.transactionDate)}
          </p>
        </div>
      </div>
    </div>
  )
}

function TransactionsListPage() {
  const navigate = useNavigate()
  usePermission('Transactions')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [exporting, setExporting] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')

  const buildParams = (p, f) => {
    const params = { page: p, limit: LIMIT, sort: f.sort || 'latest' }
    if (f.search?.trim()) params.search = f.search.trim()
    if (f.paymentStatus !== 'all') params.paymentStatus = f.paymentStatus
    if (f.orderPlatform !== 'all') params.orderPlatform = f.orderPlatform
    if (f.paymentMethod !== 'all') params.paymentMethod = f.paymentMethod
    return params
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
      const params = {
        ...buildParams(1, filters),
        fromDate: exportFromDate,
        toDate: exportToDate,
      }
      delete params.page
      delete params.limit

      const res = await adminService.exportTransactions(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export transactions'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `transactions-${exportFromDate}_${exportToDate}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const truncated = String(res.headers?.['x-export-truncated'] || '') === '1'
      toast.success(truncated
        ? 'Excel exported (first 10,000 matching rows)'
        : 'Excel exported successfully')
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

  const fetchStats = useCallback(async (f = filters) => {
    try {
      setStatsLoading(true)
      const params = {}
      if (f.orderPlatform !== 'all') params.orderPlatform = f.orderPlatform
      if (f.paymentMethod !== 'all') params.paymentMethod = f.paymentMethod
      const res = await adminService.getTransactionStats(params)
      setStats(res.data || EMPTY_STATS)
    } catch (err) {
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }, [filters])

  const fetchTransactions = useCallback(async (p = 1, f = filters) => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminService.getTransactions(buildParams(p, f))
      const data = res.data || {}
      setTransactions(data.transactions || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      const message = err.response?.data?.message || 'Failed to load transactions'
      setError(message)
      toast.error(message)
      setTransactions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchTransactions(1)
    fetchStats(EMPTY_FILTERS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchTransactions(1, filters)
    fetchStats(filters)
  }

  const handleClear = () => {
    setFilters(EMPTY_FILTERS)
    fetchTransactions(1, EMPTY_FILTERS)
    fetchStats(EMPTY_FILTERS)
  }

  const columns = [
    {
      key: 'transactionId',
      title: 'Transaction ID',
      render: (row) => (
        <span className="font-mono text-xs text-slate-800 dark:text-slate-200" title={row.transactionId}>
          {truncateId(row.transactionId)}
        </span>
      ),
    },
    {
      key: 'orderId',
      title: 'Order ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
          {row.orderId || '—'}
        </span>
      ),
    },
    {
      key: 'customerName',
      title: 'Customer Name',
      render: (row) => row.customerName || '—',
    },
    {
      key: 'customerEmail',
      title: 'Customer Email',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-300">{row.customerEmail || '—'}</span>
      ),
    },
    {
      key: 'amount',
      title: 'Order Amount',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatAmount(row.amount, row.currency)}</span>
      ),
    },
    {
      key: 'paymentStatus',
      title: 'Payment Status',
      render: (row) => (
        <StatusBadge
          status={row.paymentStatusBadge || 'pending'}
          label={row.paymentStatus}
        />
      ),
    },
    {
      key: 'paymentMethod',
      title: 'Payment Method',
      render: (row) => row.paymentMethod || '—',
    },
    {
      key: 'orderPlatform',
      title: 'Order Platform',
      render: (row) => row.orderPlatformLabel || row.orderPlatform || '—',
    },
    {
      key: 'gatewayTransactionId',
      title: 'Gateway Txn ID',
      render: (row) => (
        <span className="font-mono text-xs" title={row.gatewayTransactionId || ''}>
          {row.gatewayTransactionId ? truncateId(row.gatewayTransactionId, 10, 4) : '—'}
        </span>
      ),
    },
    {
      key: 'transactionDate',
      title: 'Date & Time',
      render: (row) => formatDateTime(row.transactionDate),
    },
  ]

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)
  const currency = stats.currency || 'AED'

  return (
    <AdminPage>
      <PageHeader
        title="Transactions"
        subtitle="Monitor payment transactions across web and mobile platforms"
        action={
          <Button
            variant="secondary"
            icon={FileSpreadsheet}
            onClick={openExportModal}
          >
            Export Excel
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card
          title="Total Transactions"
          value={statsLoading ? '…' : stats.totalTransactions}
          icon={Receipt}
          accent="default"
        />
        <Card
          title="Successful"
          value={statsLoading ? '…' : stats.successfulTransactions}
          icon={CheckCircle2}
          accent="green"
        />
        <Card
          title="Failed"
          value={statsLoading ? '…' : stats.failedTransactions}
          icon={XCircle}
          accent="red"
        />
        <Card
          title="Pending"
          value={statsLoading ? '…' : stats.pendingTransactions}
          icon={Clock3}
          accent="yellow"
        />
        <Card
          title="Total Amount"
          value={statsLoading ? '…' : formatAmount(stats.totalTransactionAmount, currency)}
          icon={Banknote}
          accent="purple"
          className="col-span-2 lg:col-span-1 xl:col-span-1"
        />
      </div>

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search Order ID, Txn ID, name, email"
        filters={[
          {
            key: 'paymentStatus',
            type: 'select',
            label: 'Payment Status',
            value: filters.paymentStatus,
            onChange: (e) => setFilter('paymentStatus', e.target.value),
            options: [{ value: 'all', label: 'All Statuses' }, ...PAYMENT_STATUS_OPTIONS],
          },
          {
            key: 'orderPlatform',
            type: 'select',
            label: 'Order Platform',
            value: filters.orderPlatform,
            onChange: (e) => setFilter('orderPlatform', e.target.value),
            options: [{ value: 'all', label: 'All Platforms' }, ...ORDER_PLATFORM_OPTIONS],
          },
          {
            key: 'paymentMethod',
            type: 'select',
            label: 'Payment Method',
            value: filters.paymentMethod,
            onChange: (e) => setFilter('paymentMethod', e.target.value),
            options: [{ value: 'all', label: 'All Methods' }, ...PAYMENT_METHOD_OPTIONS],
          },
          {
            key: 'sort',
            type: 'select',
            label: 'Sort By',
            value: filters.sort,
            onChange: (e) => setFilter('sort', e.target.value),
            options: SORT_OPTIONS,
          },
        ]}
        actions={
          hasFilters ? (
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          ) : null
        }
      />

      {error && !loading && transactions.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full sm:w-auto"
            onClick={() => {
              fetchTransactions(page, filters)
              fetchStats(filters)
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={transactions}
          loading={loading}
          emptyTitle="No transactions found"
          emptyDescription="Try adjusting filters or search terms"
          onRowClick={(row) => navigate(`${LIST_PATH}/${row.id}`)}
          mobileCardRender={(row, { actions }) => (
            <TransactionMobileCard row={row} actions={actions} />
          )}
          customActions={(row) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`${LIST_PATH}/${row.id}`)
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="View details"
              aria-label={`View transaction ${row.orderId}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          showSearch={false}
          pagination={{
            page,
            limit: LIMIT,
            total,
            onPageChange: (p) => fetchTransactions(p, filters),
          }}
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
          Choose the date range for the transactions you want to export.
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

export default TransactionsListPage
