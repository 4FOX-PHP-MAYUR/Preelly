import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { getMediaUrl } from '../../utils/helpers'
import VideoPreview from '../Video/VideoPreview'

function RelatedProducts({ products }) {
  const navigate = useNavigate()

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Products</h2>
      <div className="overflow-x-auto">
        <div className="flex space-x-4 pb-4">
          {products.map((product) => (
            <div
              key={product._id}
              onClick={() => navigate(`/products/${product._id}`)}
              className="flex-shrink-0 w-64 bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="aspect-video bg-gray-200 relative">
                {product.video || product.videoStream?.hlsUrl ? (
                  <VideoPreview product={product} className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {product.title}
                </h3>
                <div className="text-lg font-bold text-primary-600 mb-2">
                  {formatPrice(product.price)}
                </div>
                {product.location && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{product.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RelatedProducts

