import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProductById, clearCurrentProduct } from '@shared/store/slices/productSlice'
import { productService } from '@shared/services/api'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import ProductDetail from '@shared/components/ProductDetail/ProductDetail'
import ProductDetailSkeleton from '@shared/components/ProductDetail/ProductDetailSkeleton'
import { DETAIL_PAGE_PADDING, DETAIL_SECTION_GAP } from '@shared/components/ProductDetail/detailStyles'
import { isApprovedListing } from '@shared/components/ProductDetail/detailHelpers'

async function loadSimilarProducts(product) {
  const productId = product?._id
  const categoryId = product?.category?._id || product?.category
  if (!productId || !categoryId) return []

  try {
    const res = await productService.getProducts({
      categoryId,
      limit: 11,
      sortBy: 'newest',
    })
    return (res.data?.products || [])
      .filter((item) => String(item._id) !== String(productId))
      .filter(isApprovedListing)
      .slice(0, 10)
  } catch {
    return []
  }
}

function ProductDetailPage() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const { currentProduct, loading } = useSelector((state) => state.products)
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [similarProducts, setSimilarProducts] = useState([])

  useEffect(() => {
    if (id) {
      dispatch(fetchProductById(id))
    }
    return () => {
      dispatch(clearCurrentProduct())
    }
  }, [id, dispatch])

  useEffect(() => {
    if (!currentProduct?._id) {
      setSimilarProducts([])
      return undefined
    }

    let cancelled = false
    loadSimilarProducts(currentProduct).then((items) => {
      if (!cancelled) setSimilarProducts(items)
    })

    return () => {
      cancelled = true
    }
  }, [currentProduct])

  useEffect(() => {
    productService
      .getProducts({ limit: 6, sortBy: 'newest' })
      .then((res) => setFeaturedProducts(res.data?.products || []))
      .catch(() => {})
  }, [])

  if (loading && !currentProduct) {
    return <ProductDetailSkeleton />
  }

  if (!currentProduct) {
    return (
      <CategoryBrowseLayout variant="listing" layoutPreset="detail" showMobileAppPromo showTrending={false} showMessages={false}>
        <div className="flex flex-1 items-center justify-center px-4 py-16 text-center">
          <div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Product not found</h2>
            <p className="text-slate-600">The product you&apos;re looking for doesn&apos;t exist.</p>
          </div>
        </div>
      </CategoryBrowseLayout>
    )
  }

  return (
    <CategoryBrowseLayout
      variant="listing"
      layoutPreset="detail"
      activeCategoryId={currentProduct.category?._id}
      featuredProducts={featuredProducts}
      showMobileAppPromo
      showTrending={false}
      showMessages={false}
    >
      <div className={`flex-1 overflow-y-auto bg-[#F7F8FC] ${DETAIL_PAGE_PADDING}`}>
        <div className={`w-full ${DETAIL_SECTION_GAP}`}>
          <ProductDetail product={currentProduct} relatedProducts={similarProducts} />
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default ProductDetailPage
