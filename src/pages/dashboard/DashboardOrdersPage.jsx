import { useEffect, useState } from 'react'
import { CreditCard, Package, ShoppingCart } from 'lucide-react'
import { userService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'

function Pill({ children, tone = 'gray' }) {
  const cls =
    tone === 'green'
      ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
      : tone === 'red'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
      : tone === 'yellow'
      ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{children}</span>
}

export default function DashboardOrdersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (p = 1) => {
    setLoading(true)
    setError(null)
    try {
      const res = await userService.getOrders({ page: p, limit: 10 })
      setItems(res.data.items || [])
      setPage(res.data.page || p)
      setTotalPages(res.data.totalPages || 1)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Buyer</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Orders</div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4 animate-pulse h-64" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-8 text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">No orders yet</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">When you purchase items, they’ll show up here.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const product = o.product
            const img = product?.images?.[0]
            const mediaSrc = img ? getMediaUrl(img) || img : null
            const orderTone =
              o.orderStatus === 'delivered'
                ? 'green'
                : o.orderStatus === 'cancelled' || o.orderStatus === 'refunded'
                ? 'red'
                : o.orderStatus === 'shipped' || o.orderStatus === 'confirmed'
                ? 'yellow'
                : 'gray'
            const payTone =
              o.paymentStatus === 'paid' ? 'green' : o.paymentStatus === 'failed' ? 'red' : o.paymentStatus === 'refunded' ? 'yellow' : 'gray'

            return (
              <div key={o._id} className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="h-20 w-20 rounded-xl bg-gray-100 dark:bg-gray-900 overflow-hidden flex-shrink-0">
                    {mediaSrc ? <img src={mediaSrc} alt={product?.title || 'Product'} className="h-full w-full object-cover" /> : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{product?.title || 'Product'}</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {o.currency || product?.currency || 'USD'} {Number(o.totals?.total ?? o.unitPrice ?? product?.price ?? 0).toLocaleString()}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Seller: {o.seller?.name || 'Unknown'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Pill tone={orderTone}>
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" /> {o.orderStatus}
                          </span>
                        </Pill>
                        <Pill tone={payTone}>
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" /> {o.paymentStatus}
                          </span>
                        </Pill>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-900 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-900 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <ShoppingCart className="h-4 w-4" /> Mock-friendly
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          If you don’t have orders yet, this section stays empty until you add checkout/order creation.
        </div>
      </div>
    </div>
  )
}

