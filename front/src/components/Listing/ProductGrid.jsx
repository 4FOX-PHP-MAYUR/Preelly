import { memo } from 'react'
import ProductCard from './ProductCard'

function ProductGridSkeleton({ count = 4, columns = 2 }) {
  const colClass = columns >= 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div className={`grid grid-cols-1 gap-2 ${colClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse overflow-hidden bg-slate-200" />
      ))}
    </div>
  )
}

function ProductGrid({ products = [], loading = false, columns = 2, emptyState = null }) {
  const colClass = columns >= 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'

  if (loading && products.length === 0) {
    return <ProductGridSkeleton columns={columns} />
  }

  if (!products.length) return emptyState

  return (
    <div className={`grid grid-cols-1 gap-2 ${colClass}`}>
      {products.map((product, index) => (
        <ProductCard key={product._id} product={product} index={index} />
      ))}
    </div>
  )
}

export default memo(ProductGrid)
