import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentService } from '@shared/services/api'

function money(value, currency = 'AED') {
  return `${currency} ${Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}

/** Success and Failure pages share this component; `variant` selects which. */
function PaymentResultPage({ variant }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId') || ''
  const errorParam = searchParams.get('error') || ''

  const [txn, setTxn] = useState(null)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [downloading, setDownloading] = useState(false)

  const handleDownloadInvoice = async () => {
    if (!orderId) return
    try {
      setDownloading(true)
      // Fetch via the transaction's BASE_URL-based invoiceUrl when available.
      const res = await paymentService.downloadInvoice(orderId, txn?.invoiceUrl)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${txn?.invoiceNumber || orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not download invoice')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      try {
        const res = await paymentService.getTransaction(orderId)
        if (!cancelled) setTxn(res.data?.data || null)
      } catch {
        /* fall through to the minimal view built from query params */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orderId])

  // The gateway's decrypted status is authoritative; the route is just the entry point.
  const isSuccess = useMemo(() => {
    if (txn) return txn.orderStatus === 'SUCCESS'
    return variant === 'success'
  }, [txn, variant])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Confirming your payment…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <div className="flex flex-col items-center text-center">
        {isSuccess ? (
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        ) : (
          <XCircle className="h-16 w-16 text-red-500" />
        )}
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isSuccess ? 'Payment Successful' : 'Payment Failed'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isSuccess
            ? 'Thank you! Your package is now active and your listing will go live after review.'
            : txn?.failureMessage || errorParam || 'Your payment could not be completed.'}
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 p-5">
        {isSuccess && <Row label="Invoice Number" value={txn?.invoiceNumber} />}
        <Row label="Order ID" value={txn?.orderId || orderId || '—'} />
        <Row label="Transaction ID" value={txn?.trackingId} />
        {!isSuccess && <Row label="Failure Reason" value={txn?.failureMessage || errorParam} />}
        <Row label="Product" value={txn?.product?.title} />
        <Row label="Package" value={txn?.package?.packageName} />
        <Row label="Storage Facility" value={txn?.storageFacility?.facilityWeek} />
        {isSuccess && (
          <>
            <Row label="Amount Paid" value={txn ? money(txn.amount, txn.currency) : null} />
            <Row label="Payment Mode" value={txn?.paymentMode} />
            <Row label="Payment Date" value={txn ? formatDate(txn.paymentDate) : null} />
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {isSuccess ? (
          <>
            {txn?.hasInvoice && (
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={downloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1414e6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1010c4] disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Preparing…' : 'Download Invoice'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/dashboard/listings')}
              className="flex-1 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View My Ads
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                navigate(
                  txn?.product?.id && txn?.package?.id
                    ? `/post-ad/storage?productId=${txn.product.id}&packageId=${txn.package.id}`
                    : '/dashboard'
                )
              }
              className="flex-1 rounded-full bg-[#1414e6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1010c4]"
            >
              Retry Payment
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  txn?.product?.id && txn?.package?.id
                    ? `/post-ad/storage?productId=${txn.product.id}&packageId=${txn.package.id}`
                    : '/dashboard'
                )
              }
              className="flex-1 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Storage Page
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentResultPage
