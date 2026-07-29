import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import ReelsFeed from '../Reels/ReelsFeed'

/**
 * Full-screen Instagram-style reels viewer for a user's profile posts.
 */
export default function ProfileReelsViewer({
  products,
  initialIndex = 0,
  profileUser,
  onClose,
  onProductArchived,
  onProductDeleted,
  onProductUpdated,
  isOwnProfile = false,
}) {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState(products || [])
  const [startIndex, setStartIndex] = useState(initialIndex)
  const displayName = profileUser?.displayName || profileUser?.name || 'User'

  useEffect(() => {
    setItems(products || [])
  }, [products])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  const removeProduct = useCallback(
    (productId, notify) => {
      setItems((prev) => {
        const idx = prev.findIndex((p) => String(p._id) === String(productId))
        const next = prev.filter((p) => String(p._id) !== String(productId))
        if (next.length === 0) {
          setTimeout(handleClose, 120)
        } else if (idx >= 0) {
          setStartIndex(Math.min(idx, next.length - 1))
        }
        return next
      })
      notify?.(productId)
    },
    [handleClose],
  )

  if (!items?.length) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${displayName} posts`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="text-xs text-white/70">Swipe up or down · arrow keys</p>
          </div>
        </div>
      </div>

      <div className="h-[100dvh] w-full">
        <ReelsFeed
          products={items}
          initialIndex={startIndex}
          hasMore={false}
          loading={false}
          onLoadMore={() => {}}
          heightOverride="100%"
          embedded={false}
          onProductArchived={(id) => removeProduct(id, onProductArchived)}
          onProductDeleted={(id) => removeProduct(id, onProductDeleted)}
          onProductUpdated={onProductUpdated}
          forceOwnerMenu={isOwnProfile}
        />
      </div>
    </div>,
    document.body,
  )
}
