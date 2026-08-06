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
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatAmount, formatDateTime, truncateId } from './cartConstants'

const LIST_PATH = '/cart'

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
  return <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function CartViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await adminService.getCartItemById(id)
        if (!cancelled) setItem(res.data)
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load cart item'
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
        <p className="text-sm text-slate-500">Loading cart item…</p>
      </AdminPage>
    )
  }

  if (error || !item) {
    return (
      <AdminPage>
        <PageHeader
          title="Cart Item"
          action={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
          }
        />
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {error || 'Cart item not found'}
          </p>
          <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => navigate(LIST_PATH)}>
            Return to cart
          </Button>
        </div>
      </AdminPage>
    )
  }

  return (
    <AdminPage>
      <PageHeader
        title={item.productTitle || 'Cart Item'}
        subtitle={
          <>
            <span className="sm:hidden">Cart · {truncateId(item.cartId)}</span>
            <span className="hidden sm:inline">Cart ID · {item.cartId}</span>
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
          <FormSection title="Product Details">
            <SectionGrid>
              <Field label="Product" className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3">
                  {item.product?.image ? (
                    <img
                      src={item.product.image}
                      alt={item.productTitle || 'Product'}
                      className="h-12 w-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <span>{item.productTitle || '—'}</span>
                </div>
              </Field>
              <Field label="Category">{item.product?.category || '—'}</Field>
              <Field label="Subcategory">{item.product?.subcategory || '—'}</Field>
              <Field label="Cart Status">
                <StatusBadge status={item.cartStatusBadge} label={item.cartStatusLabel} />
              </Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Buyer Information">
            <SectionGrid>
              <Field label="Buyer Name">{item.buyerName || '—'}</Field>
              <Field label="Buyer Email" className="sm:col-span-2 lg:col-span-1">
                <span className="break-all">{item.buyerEmail || '—'}</span>
              </Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Seller Information">
            <SectionGrid>
              <Field label="Seller Name">{item.sellerName || '—'}</Field>
              <Field label="Seller Email" className="sm:col-span-2 lg:col-span-1">
                <span className="break-all">{item.sellerEmail || '—'}</span>
              </Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Pricing">
            <SectionGrid>
              <Field label="Quantity">{item.quantity}</Field>
              <Field label="Unit Price">{formatAmount(item.unitPrice, item.currency)}</Field>
              <Field label="Subtotal">{formatAmount(item.subtotal, item.currency)}</Field>
              <Field label="Discount">{formatAmount(item.discount, item.currency)}</Field>
              <Field label="Coupon Code">{item.couponCode || '—'}</Field>
              <Field label="Coupon Discount">{formatAmount(item.couponDiscount, item.currency)}</Field>
              <Field label="Tax">{formatAmount(item.tax, item.currency)}</Field>
              <Field label="Total Amount">
                <span className="font-semibold">{formatAmount(item.totalAmount, item.currency)}</span>
              </Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Dates">
            <SectionGrid>
              <Field label="Added Date">{formatDateTime(item.createdAt)}</Field>
              <Field label="Updated Date">{formatDateTime(item.updatedAt)}</Field>
              <Field label="Purchase Date">{item.purchaseDate ? formatDateTime(item.purchaseDate) : '—'}</Field>
              <Field label="Expires At">{item.expiresAt ? formatDateTime(item.expiresAt) : '—'}</Field>
              <Field label="Order/Transaction Reference">{item.orderReference || '—'}</Field>
            </SectionGrid>
          </FormSection>

          {item.package || item.storageFacility ? (
            <FormSection title="Add-ons">
              <SectionGrid>
                <Field label="Package">{item.package?.packageName || '—'}</Field>
                <Field label="Storage Facility">
                  {item.storageFacility?.facilityWeek != null
                    ? `${item.storageFacility.facilityWeek} week(s)`
                    : '—'}
                </Field>
              </SectionGrid>
            </FormSection>
          ) : null}

          {item.preellyInspection ? (
            <FormSection title="Preelly Pay Inspection">
              <SectionGrid>
                <Field label="Approved">{item.preellyInspection.approved ? 'Yes' : 'No'}</Field>
                <Field label="Not Interested">{item.preellyInspection.notInterested ? 'Yes' : 'No'}</Field>
                <Field label="Conditions" className="sm:col-span-2 lg:col-span-3">
                  {item.preellyInspection.conditions?.length
                    ? item.preellyInspection.conditions.join(', ')
                    : '—'}
                </Field>
                <Field label="Comment" className="sm:col-span-2 lg:col-span-3">
                  {item.preellyInspection.comment || '—'}
                </Field>
              </SectionGrid>
            </FormSection>
          ) : null}

          {item.notes ? (
            <FormSection title="Notes">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                {item.notes}
              </p>
            </FormSection>
          ) : null}
        </div>
      </Panel>
    </AdminPage>
  )
}

export default CartViewPage
