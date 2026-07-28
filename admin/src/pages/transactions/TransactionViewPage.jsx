import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  StatusBadge,
  FormSection,
} from '../../components/AdminUI'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatAmount, formatDateTime, truncateId } from './transactionConstants'

const LIST_PATH = '/transactions'

function Field({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white break-words">
        {children ?? '—'}
      </div>
    </div>
  )
}

function SectionGrid({ children }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

function TransactionViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [txn, setTxn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await adminService.getTransactionById(id)
        if (!cancelled) setTxn(res.data)
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load transaction'
        if (!cancelled) {
          setError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500">Loading transaction…</p>
      </AdminPage>
    )
  }

  if (error || !txn) {
    return (
      <AdminPage>
        <PageHeader
          title="Transaction"
          action={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
          }
        />
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {error || 'Transaction not found'}
          </p>
          <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => navigate(LIST_PATH)}>
            Return to transactions
          </Button>
        </div>
      </AdminPage>
    )
  }

  const gatewayEntries = txn.gatewayResponse
    ? Object.entries(txn.gatewayResponse)
    : []

  return (
    <AdminPage>
      <PageHeader
        title={txn.orderId || 'Transaction'}
        subtitle={
          <>
            <span className="sm:hidden">Txn · {truncateId(txn.transactionId)}</span>
            <span className="hidden sm:inline">Transaction ID · {txn.transactionId}</span>
          </>
        }
        action={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
            Back to list
          </Button>
        }
      />

      <Panel>
        <div className="space-y-6 sm:space-y-8">
          <FormSection title="Payment Summary">
            <SectionGrid>
              <Field label="Transaction ID" className="sm:col-span-2 lg:col-span-1">
                <span className="font-mono text-xs break-all">{txn.transactionId}</span>
              </Field>
              <Field label="Order ID">
                <span className="font-mono break-all">{txn.orderId}</span>
              </Field>
              <Field label="Payment Status">
                <StatusBadge
                  status={txn.paymentStatusBadge || 'pending'}
                  label={txn.paymentStatus}
                />
              </Field>
              <Field label="Order Amount">{formatAmount(txn.amount, txn.currency)}</Field>
              <Field label="Discount">{formatAmount(txn.discountAmount, txn.currency)}</Field>
              <Field label="Currency">{txn.currency || 'AED'}</Field>
              <Field label="Payment Method">{txn.paymentMethod || '—'}</Field>
              <Field label="Order Platform">{txn.orderPlatformLabel || '—'}</Field>
              <Field label="Payment Type">{txn.paymentTypeLabel || '—'}</Field>
              <Field label="Transaction Date">{formatDateTime(txn.transactionDate)}</Field>
              <Field label="Payment Date">{formatDateTime(txn.paymentDate)}</Field>
              <Field label="Created At">{formatDateTime(txn.createdAt)}</Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Customer">
            <SectionGrid>
              <Field label="Customer Name">{txn.customerName || txn.customer?.name || '—'}</Field>
              <Field label="Customer Email" className="sm:col-span-2 lg:col-span-1">
                <span className="break-all">{txn.customerEmail || txn.customer?.email || '—'}</span>
              </Field>
              <Field label="Customer Phone">
                {txn.billing?.mobile || txn.customer?.phone || '—'}
              </Field>
              {txn.buyer && (
                <Field label="Buyer" className="sm:col-span-2 lg:col-span-1">
                  {[txn.buyer.name, txn.buyer.email].filter(Boolean).join(' · ') || txn.buyer.id}
                </Field>
              )}
              {txn.seller && (
                <Field label="Seller" className="sm:col-span-2 lg:col-span-1">
                  {[txn.seller.name, txn.seller.email].filter(Boolean).join(' · ') || txn.seller.id}
                </Field>
              )}
            </SectionGrid>
          </FormSection>

          <FormSection title="Order / Listing">
            <SectionGrid>
              <Field label="Product" className="sm:col-span-2 lg:col-span-1">
                {txn.product?.title || txn.product?.id || '—'}
              </Field>
              <Field label="Package">{txn.package?.packageName || '—'}</Field>
              <Field label="Storage Facility">
                {txn.storageFacility?.facilityWeek != null
                  ? `${txn.storageFacility.facilityWeek} week(s)`
                  : '—'}
              </Field>
              <Field label="Coupon Code">{txn.couponCode || '—'}</Field>
              <Field label="Invoice Number">{txn.invoiceNumber || '—'}</Field>
              <Field label="Email Sent">{txn.emailSent ? 'Yes' : 'No'}</Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Billing Address">
            <SectionGrid>
              <Field label="Name">{txn.billing?.name}</Field>
              <Field label="Email">
                <span className="break-all">{txn.billing?.email || '—'}</span>
              </Field>
              <Field label="Mobile">{txn.billing?.mobile}</Field>
              <Field label="Address" className="sm:col-span-2 lg:col-span-3">
                {txn.billing?.address}
              </Field>
              <Field label="City">{txn.billing?.city}</Field>
              <Field label="State">{txn.billing?.state}</Field>
              <Field label="Country">{txn.billing?.country}</Field>
              <Field label="Pincode">{txn.billing?.pincode}</Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Gateway">
            <SectionGrid>
              <Field label="Gateway">{txn.gatewayName || '—'}</Field>
              <Field label="Gateway Transaction ID" className="sm:col-span-2 lg:col-span-1">
                <span className="font-mono text-xs break-all">{txn.gatewayTransactionId || '—'}</span>
              </Field>
              <Field label="Bank Ref No">
                <span className="font-mono text-xs break-all">{txn.bankRefNo || '—'}</span>
              </Field>
              <Field label="Gateway Order Status">{txn.gatewayOrderStatus || '—'}</Field>
              <Field label="Merchant ID">{txn.merchantId || '—'}</Field>
              <Field label="Verified">{txn.isVerified ? 'Yes' : 'No'}</Field>
            </SectionGrid>
          </FormSection>

          {(txn.failureMessage || txn.orderStatus === 'FAILED' || txn.orderStatus === 'CANCELLED') && (
            <FormSection title="Failure Details">
              <Field label="Failure Reason">
                <span className="break-words whitespace-pre-wrap">{txn.failureMessage || '—'}</span>
              </Field>
            </FormSection>
          )}

          {gatewayEntries.length > 0 && (
            <FormSection title="Gateway Response">
              <SectionGrid>
                {gatewayEntries.map(([key, value]) => (
                  <Field key={key} label={key}>
                    <span className="font-mono text-xs break-all">{String(value)}</span>
                  </Field>
                ))}
              </SectionGrid>
            </FormSection>
          )}

          {txn.metadata && (
            <FormSection title="Checkout Snapshot">
              <pre className="max-w-full overflow-x-auto rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 whitespace-pre">
                {JSON.stringify(txn.metadata, null, 2)}
              </pre>
            </FormSection>
          )}

          {Array.isArray(txn.logs) && txn.logs.length > 0 && (
            <FormSection title="Activity Log">
              <div className="space-y-3">
                {txn.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {log.activity || 'Activity'}
                      </p>
                      <p className="text-xs text-slate-500 shrink-0">{formatDateTime(log.createdAt)}</p>
                    </div>
                    {log.description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 break-words">
                        {log.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-3 text-xs text-slate-500">
                      {log.paymentStatus && <span>Status: {log.paymentStatus}</span>}
                      {log.paymentMethod && <span>Method: {log.paymentMethod}</span>}
                      {log.failureReason && (
                        <span className="break-words">Reason: {log.failureReason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          )}
        </div>
      </Panel>
    </AdminPage>
  )
}

export default TransactionViewPage
