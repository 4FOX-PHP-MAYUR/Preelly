import { memo } from 'react'
import ProductCard from './ProductCard'

function ProductGridSkeleton({ count = 6, columns = 2 }) {
  const colClass =
    columns >= 3
      ? 'sm:grid-cols-2 xl:grid-cols-3'
      : 'sm:grid-cols-2'

  return (
    <div className={`grid grid-cols-1 gap-4 ${colClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 animate-pulse">
          <div className="aspect-[4/5] bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

function ProductGrid({
  products = [],
  loading = false,
  columns = 2,
  emptyState = null,
  onToggleSave,
  savedIds,
}) {
  const colClass =
    columns >= 3
      ? 'sm:grid-cols-2 xl:grid-cols-3'
      : 'sm:grid-cols-2'

  if (loading && products.length === 0) {
    return <ProductGridSkeleton columns={columns} />
  }

  if (!products.length) {
    return emptyState
  }

  return (
    <div className={`grid grid-cols-1 gap-4 ${colClass}`}>
      {products.map((product, index) => (
        <ProductCard
          key={product._id}
          product={product}
          index={index}
          onToggleSave={onToggleSave}
          isSaved={savedIds?.has?.(String(product._id))}
        />
      ))}
    </div>
  )
}

export default memo(ProductGrid)
