import { useCallback, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { interactionService } from '@shared/services/api'
import { selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { isValidObjectId } from '@shared/utils/helpers'

const WATCH_THRESHOLD = 0.5

/**
 * Records a product video view when a logged-in user watches >= 50% of the video.
 * Fires at most once per product per mount.
 */
export function useProductVideoViewTracking({
  productId,
  enabled = true,
  onViewsUpdated,
}) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const hasRecordedRef = useRef(false)
  const recordingRef = useRef(false)
  const productIdRef = useRef(productId)

  useEffect(() => {
    if (String(productIdRef.current) !== String(productId)) {
      hasRecordedRef.current = false
      recordingRef.current = false
      productIdRef.current = productId
    }
  }, [productId])

  const handleVideoTimeUpdate = useCallback(
    (event) => {
      if (!enabled || !isValidObjectId(productId)) return
      if (hasRecordedRef.current || recordingRef.current) return

      const video = event?.target
      if (!video) return

      const duration = video.duration
      if (!duration || !Number.isFinite(duration) || duration <= 0) return

      const progress = video.currentTime / duration
      if (progress < WATCH_THRESHOLD) return

      recordingRef.current = true

      const recordView = isAuthenticated
        ? interactionService.recordVideoView(productId)
        : interactionService.incrementView(productId)

      recordView
        .then((res) => {
          hasRecordedRef.current = true
          if (typeof res?.data?.views === 'number') {
            onViewsUpdated?.(res.data.views)
          }
        })
        .catch(() => {
          recordingRef.current = false
        })
        .finally(() => {
          recordingRef.current = false
        })
    },
    [enabled, isAuthenticated, productId, onViewsUpdated]
  )

  return { handleVideoTimeUpdate }
}

export default useProductVideoViewTracking
