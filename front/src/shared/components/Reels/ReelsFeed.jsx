import { useEffect, useRef, useState, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import ProductReelCard from './ProductReelCard'

function ReelsFeed({
  products,
  onLoadMore,
  hasMore,
  loading,
  hasCategoryHeader = false,
  onVisibleIndexChange,
  initialIndex,
  isCategoryFeed = false,
  onExploreCategories,
  heightOverride = null,
  embedded = false,
  onOpenComments = null,
}) {
  const containerBgClass = embedded ? 'bg-transparent' : 'bg-black'
  const itemBgClass = embedded ? 'bg-transparent' : 'bg-black'

  const containerRef = useRef(null)
  const hasRestoredRef = useRef(false)
  const lastLoadMoreAtRef = useRef(0)
  const [visibleIndex, setVisibleIndex] = useState(0)
  // Use visualViewport when available (better for mobile/keyboard); fallback to innerHeight
  // Subtract header offset so fixed header doesn't overlap reels
  const HEADER_OFFSET = 64
  const measureContainerHeight = useCallback(() => {
    if (typeof heightOverride === 'number') {
      return Math.max(200, heightOverride)
    }
    if (heightOverride === '100%') {
      const parent = containerRef.current?.parentElement
      if (parent) {
        const parentH = parent.clientHeight
        if (parentH > 0) return Math.max(200, parentH)
      }
    }
    if (containerRef.current?.clientHeight > 0) {
      return Math.max(200, containerRef.current.clientHeight)
    }
    const vh =
      typeof window !== 'undefined' && window.visualViewport?.height
        ? window.visualViewport.height
        : typeof window !== 'undefined'
          ? window.innerHeight
          : 600
    return Math.max(200, Math.floor(vh - HEADER_OFFSET))
  }, [heightOverride])

  const [containerHeight, setContainerHeight] = useState(() => measureContainerHeight())
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)
  const isScrolling = useRef(false)
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  })

  useEffect(() => {
    onVisibleIndexChange?.(visibleIndex)
  }, [visibleIndex, onVisibleIndexChange])

  useEffect(() => {
    const updateHeight = () => {
      setContainerHeight(measureContainerHeight())
    }

    updateHeight()
    const raf = requestAnimationFrame(updateHeight)

    const parent = containerRef.current?.parentElement
    let resizeObserver
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight)
      resizeObserver.observe(parent)
    }

    window.addEventListener('resize', updateHeight)
    const vv = window.visualViewport
    if (vv) vv.addEventListener('resize', updateHeight)
    return () => {
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateHeight)
      if (vv) vv.removeEventListener('resize', updateHeight)
    }
  }, [measureContainerHeight, products.length])

  useEffect(() => {
    if (inView && hasMore && !loading) {
      const now = Date.now()
      if (now - lastLoadMoreAtRef.current < 600) return
      lastLoadMoreAtRef.current = now
      onLoadMore()
    }
  }, [inView, hasMore, loading, onLoadMore])

  // Restore scroll position from saved index (e.g. on reload) – set visible reel immediately, then scroll when container has height
  useEffect(() => {
    if (hasRestoredRef.current || products.length === 0) return
    const idx = typeof initialIndex === 'number' && initialIndex >= 0 ? Math.min(initialIndex, products.length - 1) : null
    if (idx == null || idx === 0) return
    hasRestoredRef.current = true
    setVisibleIndex(idx)
    const el = containerRef.current
    if (!el) return

    const applyScroll = () => {
      const h = el.clientHeight
      if (h <= 0) return false
      el.scrollTop = idx * h
      return true
    }

    const tryRestore = (attempt = 0) => {
      const maxAttempts = 30
      if (applyScroll()) return
      if (attempt >= maxAttempts) return
      requestAnimationFrame(() => tryRestore(attempt + 1))
    }
    requestAnimationFrame(() => tryRestore(0))
  }, [initialIndex, products.length])

  // Initialize visible index on mount when not restoring from saved position
  useEffect(() => {
    if (typeof initialIndex === 'number' && initialIndex > 0) return
    if (containerRef.current && !hasRestoredRef.current) {
      const scrollTop = containerRef.current.scrollTop
      const itemHeight = containerRef.current.clientHeight
      const idx = Math.floor(scrollTop / itemHeight)
      setVisibleIndex(idx >= 0 ? idx : 0)
    }
  }, [])

  // Navigate to next/previous reel
  const navigateToIndex = useCallback((targetIndex, direction = null) => {
    if (!containerRef.current || isScrolling.current) return
    
    const maxIndex = products.length - 1
    const clampedIndex = Math.max(0, Math.min(targetIndex, maxIndex))
    
    if (clampedIndex === visibleIndex && direction === 'down' && hasMore && !loading) {
      // If at the end and scrolling down, trigger load more
      onLoadMore()
      return
    }
    
    if (clampedIndex === visibleIndex) return
    
    isScrolling.current = true
    setVisibleIndex(clampedIndex)
    
    const targetScroll = clampedIndex * containerHeight
    containerRef.current.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    })
    
    // Reset scrolling flag after animation
    setTimeout(() => {
      isScrolling.current = false
    }, 500)
  }, [visibleIndex, containerHeight, products.length, hasMore, loading, onLoadMore])

  // Navigate to next reel
  const navigateNext = useCallback(() => {
    navigateToIndex(visibleIndex + 1, 'down')
  }, [visibleIndex, navigateToIndex])

  // Navigate to previous reel
  const navigatePrevious = useCallback(() => {
    navigateToIndex(visibleIndex - 1, 'up')
  }, [visibleIndex, navigateToIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if user is typing in an input/textarea
      const isInputFocused = 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      
      if (isInputFocused) return
      
      // Handle arrow keys (down = next reel, up = previous reel, matching scroll direction)
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        navigateNext()
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        navigatePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateNext, navigatePrevious])

  // Touch/swipe gestures for mobile
  const handleTouchStart = useCallback((e) => {
    if (!isScrolling.current) {
      touchStartY.current = e.touches[0].clientY
      touchEndY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current !== 0) {
      touchEndY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartY.current || !touchEndY.current || isScrolling.current) {
      touchStartY.current = 0
      touchEndY.current = 0
      return
    }
    
    const diff = touchStartY.current - touchEndY.current
    const threshold = 80 // Minimum swipe distance (px)
    
    // Only navigate on significant swipes (swipe up = next reel, swipe down = previous - standard reels behavior)
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped up - next reel
        navigateNext()
      } else {
        // Swiped down - previous reel
        navigatePrevious()
      }
    }
    
    // Reset touch positions
    touchStartY.current = 0
    touchEndY.current = 0
  }, [navigateNext, navigatePrevious])

  // Mouse wheel navigation (alternative to scroll)
  const handleWheel = useCallback((e) => {
    // Only handle if not already scrolling programmatically
    if (isScrolling.current) {
      e.preventDefault()
      return
    }
    
    // Allow natural scrolling, but we'll update visibleIndex on scroll event
    // This maintains the snap behavior while allowing smooth navigation
  }, [])

  const handleScroll = (e) => {
    const container = e.target
    const scrollTop = container.scrollTop
    const itemHeight = container.clientHeight
    
    // Calculate which video is currently in view (clamp to reels only so end card doesn't steal focus)
    const maxReelIndex = products.length - 1
    let newIndex = Math.round(scrollTop / itemHeight)
    if (newIndex > maxReelIndex) newIndex = maxReelIndex
    if (newIndex < 0) newIndex = 0
    
    if (newIndex !== visibleIndex && newIndex >= 0 && newIndex <= maxReelIndex) {
      setVisibleIndex(newIndex)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`reels-container overflow-y-auto snap-y snap-mandatory scroll-smooth w-full ${containerBgClass}`}
      tabIndex={0}
      style={{
        outline: 'none',
        scrollSnapType: 'y mandatory',
        height:
          heightOverride === '100%'
            ? `${containerHeight}px`
            : heightOverride || `calc(100vh - ${HEADER_OFFSET}px)`,
      }}
    >
      {products.map((product, index) => {
        const isLastReel = index === products.length - 1
        const showEndOverlay = isLastReel && !hasMore && products.length > 0
        return (
          <div
            key={product._id}
            className={`snap-start snap-always relative w-full flex items-center justify-center ${itemBgClass}`}
            style={{ height: `${containerHeight}px`, minHeight: `${containerHeight}px` }}
          >
            <div className="w-full h-full min-h-0 flex items-center justify-center">
              <ProductReelCard
                product={product}
                isVisible={index === visibleIndex}
                embedded={embedded}
                onOpenComments={onOpenComments}
              />
            </div>
            {/* End-of-feed overlay on last reel so reels always stay visible when data is finished */}
            {showEndOverlay && (
              <div className="absolute inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center justify-end min-h-[140px] z-50">
                <div className="text-white text-center">
                  {isCategoryFeed && onExploreCategories ? (
                    <>
                      <p className="text-sm font-semibold">You've seen everything here</p>
                      <p className="text-gray-300 text-xs mt-1">Discover more in other categories</p>
                      <button
                        type="button"
                        onClick={onExploreCategories}
                        className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full text-sm font-medium transition-colors"
                        aria-label="Explore other categories"
                      >
                        Explore Other Categories
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">You're all caught up!</p>
                      <p className="text-gray-300 text-xs mt-1">No more reels to show</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      
      {/* Load more trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className={`snap-start snap-always flex items-center justify-center ${itemBgClass}`}
          style={{ height: `${containerHeight}px`, minHeight: `${containerHeight}px` }}
        >
          {loading && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          )}
        </div>
      )}
      
    </div>
  )
}

export default ReelsFeed


