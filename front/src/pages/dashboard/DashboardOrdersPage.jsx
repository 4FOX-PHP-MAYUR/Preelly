import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  MoreVertical,
  Receipt,
} from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import { paymentService } from '@shared/services/api'
import { formatPrice, getMediaUrl } from '@shared/utils/helpers'

const PAGE_SIZE = 10

/** Filter chips over paymentTransaction.orderStatus. */
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'SUCCESS', label: 'Paid' },
  { value: 'INITIATED', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_TONES = {
  SUCCESS: 'bg-[#EAF8EA] text-[#3F7F3F]',
  INITIATED: 'bg-[#FFF6DF] text-[#96731A]',
  PENDING: 'bg-[#FFF6DF] text-[#96731A]',
  FAILED: 'bg-[#FFEBEB] text-[#B23B3B]',
  CANCELLED: 'bg-slate-100 text-slate-600',
}

const STATUS_LABELS = {
  SUCCESS: 'Paid',
  INITIATED: 'Pending',
  PENDING: 'Pending',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

/** paymentType 1 = seller's ad payment, 2 = buyer's product checkout. */
function orderKindLabel(txn) {
  if (Number(txn?.paymentType) === 2) return 'Product purchase'
  if (txn?.package?.packageName) return `Ad package · ${txn.package.packageName}`
  return 'Ad payment'
}

function orderDate(txn) {
  const raw = txn?.paymentDate || txn?.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function OrderCard({ txn, onDownloadInvoice }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const image = txn.product?.image
  const thumb = image ? getMediaUrl(image) || image : null
  const status = String(txn.orderStatus || '').toUpperCase()
  const date = orderDate(txn)

  const menuItems = [
    txn.product?.title
      ? { label: 'View Listing', icon: ExternalLink, to: `/products/${txn.product.id}` }
      : null,
    txn.hasInvoice
      ? { label: 'Download Invoice', icon: Download, onClick: () => onDownloadInvoice(txn) }
      : null,
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4">
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-[12px] bg-slate-100 sm:h-24 sm:w-32">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Receipt className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 sm:text-base">
            {txn.product?.title || 'Payment'}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_TONES[status] || STATUS_TONES.CANCELLED
            }`}
          >
            {STATUS_LABELS[status] || status || 'Unknown'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{orderKindLabel(txn)}</p>
        <p className="mt-1 text-sm font-bold text-slate-900">
          {formatPrice(Number(txn.amount || 0), txn.currency || 'AED')}
          {txn.discountAmount > 0 ? (
            <span className="ml-2 text-[11px] font-medium text-[#3F7F3F]">
              −{formatPrice(Number(txn.discountAmount), txn.currency || 'AED')} off
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          Order {txn.orderId}
          {date ? ` · ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          {txn.paymentMode ? ` · ${txn.paymentMode}` : ''}
        </p>
        {status === 'FAILED' && txn.failureMessage ? (
          <p className="mt-1 truncate text-[11px] text-[#B23B3B]">{txn.failureMessage}</p>
        ) : null}
      </div>

      {menuItems.length ? (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="Order options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white py-1 shadow-lg">
              {menuItems.map((item) => {
                const Icon = item.icon
                const className =
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 transition duration-150 hover:bg-slate-50'
                return item.to ? (
                  <Link key={item.label} to={item.to} className={className} onClick={() => setMenuOpen(false)}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      item.onClick?.()
                    }}
                    className={className}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardOrdersPage() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    paymentService
      .listTransactions({ page, limit: PAGE_SIZE, orderStatus: status || undefined })
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data || {}
        setItems(Array.isArray(data.items) ? data.items : [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
      })
      .catch((e) => {
        if (cancelled) return
        setItems([])
        setError(e?.response?.data?.message || 'Failed to load orders')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, status])

  const handleStatusChange = (next) => {
    setStatus(next)
    setPage(1)
  }

  const handleDownloadInvoice = async (txn) => {
    try {
      const res = await paymentService.downloadInvoice(txn.orderId, txn.invoiceUrl)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${txn.invoiceNumber || txn.orderId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to download invoice')
    }
  }

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your payment history…'
    if (!total) return 'Your payments and purchases appear here'
    return `${total} payment${total === 1 ? '' : 's'} on your account`
  }, [loading, total])

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Orders</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => handleStatusChange(f.value)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition duration-200 ${
                status === f.value
                  ? 'bg-brand text-white shadow-sm shadow-brand/25'
                  : 'bg-white text-slate-600 ring-1 ring-[#E5E7EB] hover:text-brand hover:ring-brand/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-slate-100" />
            ))
          ) : items.length ? (
            items.map((txn) => (
              <OrderCard key={txn.id || txn.orderId} txn={txn} onDownloadInvoice={handleDownloadInvoice} />
            ))
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {status ? 'No orders match this filter' : 'No orders yet'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {status
                  ? 'Try another status to see more of your payment history.'
                  : 'Payments for your ads and purchases will show up here.'}
              </p>
            </div>
          )}
        </div>

        {!loading && totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[#E5E7EB] transition duration-200 hover:text-brand hover:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[#E5E7EB] transition duration-200 hover:text-brand hover:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsPageShell>
  )
}
