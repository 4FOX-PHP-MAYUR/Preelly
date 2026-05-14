import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProductById, fetchRelatedProducts, clearCurrentProduct } from '../store/slices/productSlice'
import ProductDetail from '../components/ProductDetail/ProductDetail'
import RelatedProducts from '../components/ProductDetail/RelatedProducts'
import Comments from '../components/ProductDetail/Comments'
import ProductDetailSkeleton from '../components/ProductDetail/ProductDetailSkeleton'

function ProductDetailPage() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const { currentProduct, relatedProducts, loading } = useSelector((state) => state.products)

  useEffect(() => {
    if (id) {
      dispatch(fetchProductById(id))
    }
    return () => {
      dispatch(clearCurrentProduct())
    }
  }, [id, dispatch])

  useEffect(() => {
    if (currentProduct) {
      dispatch(
        fetchRelatedProducts({
          productId: currentProduct._id,
          categoryId: currentProduct.category?._id,
          location: currentProduct.location,
        })
      )
    }
  }, [currentProduct, dispatch])

  if (loading && !currentProduct) {
    return <ProductDetailSkeleton />
  }

  if (!currentProduct) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h2>
        <p className="text-gray-600">The product you're looking for doesn't exist.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProductDetail product={currentProduct} />
      <Comments productId={currentProduct._id} />
      {relatedProducts.length > 0 && (
        <RelatedProducts products={relatedProducts} />
      )}
    </div>
  )
}

export default ProductDetailPage

