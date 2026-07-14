import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductGallery from './ProductGallery'
import OverviewCard from './OverviewCard'
import DescriptionCard from './DescriptionCard'
import ProductFeatures from './ProductFeatures'
import ProductLocationMap from './ProductLocationMap'
import SellerInfo from './SellerInfo'
import RelatedProducts from './RelatedProducts'
import { DETAIL_SECTION_GAP } from './detailStyles'

function ProductDetail({ product, relatedProducts = [] }) {
  const [viewCount, setViewCount] = useState(product?.views ?? 0)

  useEffect(() => {
    setViewCount(product?.views ?? 0)
  }, [product?._id, product?.views])

  const handleViewCountChange = useCallback((nextViews) => {
    if (typeof nextViews === 'number' && Number.isFinite(nextViews)) {
      setViewCount(nextViews)
    }
  }, [])

  const productWithViews = useMemo(
    () => ({ ...product, views: viewCount }),
    [product, viewCount]
  )

  return (
    <div className={`min-w-0 ${DETAIL_SECTION_GAP}`}>
      <ProductGallery
        product={product}
        viewCount={viewCount}
        onViewCountChange={handleViewCountChange}
      />
      <OverviewCard product={productWithViews} />
      <DescriptionCard product={productWithViews} />
      <ProductFeatures product={productWithViews} />
      <ProductLocationMap product={productWithViews} />
      <SellerInfo product={productWithViews} />
      {relatedProducts.length > 0 && (
        <RelatedProducts products={relatedProducts} referenceProduct={productWithViews} />
      )}
    </div>
  )
}

export default ProductDetail
