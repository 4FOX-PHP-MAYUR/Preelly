import { useEffect, useState } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { interactionService, userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { Link } from 'react-router-dom'

export default function DashboardWishlistPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await userService.getWishlist()
      setItems(res.data.items || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load wishlist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (productId) => {
    try {
      await interactionService.saveProduct(productId) // toggles save
      toast.success('Removed from wishlist')
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to remove')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Buyer</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Saved / Wishlist</div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4 animate-pulse h-64" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-8 text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nothing saved yet</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">Tap the heart icon on products to save them.</div>
          <Link to="/categories" className="mt-5 inline-flex items-center gap-2 btn-primary">
            <Heart className="h-4 w-4" /> Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => {
            const img = p.images?.[0]
            const mediaSrc = img ? getMediaUrl(img) || img : null
            return (
              <div key={p._id} className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 overflow-hidden">
                <Link to={`/products/${p._id}`} className="block h-40 bg-gray-100 dark:bg-gray-900">
                  {mediaSrc ? <img src={mediaSrc} alt={p.title} className="h-full w-full object-cover" /> : null}
                </Link>
                <div className="p-4 space-y-3">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{p.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {p.currency || 'USD'} {Number(p.price || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center justify-between">
                    <Link to={`/products/${p._id}`} className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline">
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(p._id)}
                      className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

