import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, clearProducts } from '@shared/store/slices/productSlice'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import ListingToolbar from '../components/Listing/ListingToolbar'
import ProductGrid from '../components/Listing/ProductGrid'
import {
  FEATURED_LISTINGS_QUERY,
  FEATURED_LISTINGS_TITLE,
} from '@shared/utils/featuredListings'

const PAGE_SIZE = 12

/**
 * Every featured listing — the "See all" target of the detail page's Featured Listings
 * rail. Same shell, toolbar, grid and Load More as the category listing page
 * (/categories/:id/products); it just drops the category-scoped filter panel, since
 * this set isn't scoped to a category.
 */
function FeaturedListingsPage() {
  const dispatch = useDispatch()
  const { products, loading, hasMore, page } = useSelector((state) => state.products)
  const [sortBy, setSortBy] = useState(FEATURED_LISTINGS_QUERY.sortBy)

  const loadPage = useCallback(
    (nextPage, { append = false } = {}) => {
      if (!append) dispatch(clearProducts())
      dispatch(fetchProducts({ ...FEATURED_LISTINGS_QUERY, sortBy, page: nextPage, limit: PAGE_SIZE }))
    },
    [dispatch, sortBy],
  )

  // Re-runs on sort change; the products slice is shared with other listing pages, so
  // clear it on the way out to avoid showing this set under the next page's heading.
  useEffect(() => {
    loadPage(1)
    return () => {
      dispatch(clearProducts())
    }
  }, [loadPage, dispatch])

  const loadMore = () => {
    if (hasMore && !loading) loadPage(page + 1, { append: true })
  }

  const countLabel =
    loading && products.length === 0
      ? 'Loading listings…'
      : `${products.length} listing${products.length !== 1 ? 's' : ''} found`

  return (
    <CategoryBrowseLayout variant="listing" layoutPreset="marketplace">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FC]">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
                {FEATURED_LISTINGS_TITLE}
              </h1>
              <p className="mt-1 text-sm text-[#64748B]">{countLabel}</p>
            </div>
            <ListingToolbar sortBy={sortBy} onSortChange={setSortBy} showAdvanceFilter={false} />
          </div>

          <ProductGrid
            products={products}
            loading={loading}
            columns={3}
            emptyState={
              <div className="rounded-2xl border border-[#E8EBF2] bg-white p-12 text-center shadow-sm">
                <h3 className="mb-2 text-xl font-bold text-[#0F172A]">No featured listings yet</h3>
                <p className="text-[#64748B]">Featured listings will appear here once they go live.</p>
              </div>
            }
          />

          {hasMore && products.length > 0 ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 hover:shadow-brand/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default FeaturedListingsPage
