import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MapPin, Phone, MessageCircle, Flag, Heart, Share2, Edit, Trash2, BarChart3 } from 'lucide-react'
import ReactPlayer from 'react-player'
import toast from 'react-hot-toast'
import SellerInfo from './SellerInfo'
import { interactionService, productService } from '../../services/api'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { getMediaUrl } from '../../utils/helpers'
import { useChat } from '../Chat/ChatContext'
import CarOverview from './CarOverview'
import ProductFeatures from './ProductFeatures'

function ProductDetail({ product }) {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const [selectedImage, setSelectedImage] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPhoneNumber, setShowPhoneNumber] = useState(false)
  const { createOrGetThread } = useChat()
  const currentUserId = user?._id || user?.id
  const sellerId = product?.seller?._id || product?.seller?.id || product?.seller
  const isOwner = Boolean(currentUserId && sellerId && String(currentUserId) === String(sellerId))

  useEffect(() => {
    if (isAuthenticated && product._id) {
      interactionService
        .checkLiked(product._id)
        .then((res) => setIsLiked(res.data.liked))
        .catch(() => {})
      interactionService
        .checkSaved(product._id)
        .then((res) => setIsSaved(res.data.saved))
        .catch(() => {})
    }
  }, [isAuthenticated, product._id])

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency || 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const allMedia = product.video
    ? [{ type: 'video', url: getMediaUrl(product.video) }, ...(product.images || []).map((img) => ({ type: 'image', url: getMediaUrl(img) }))]
    : (product.images || []).map((img) => ({ type: 'image', url: getMediaUrl(img) }))

  const handleChat = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to chat with sellers')
      navigate('/login')
      return
    }
    if (isOwner) {
      toast.error('You cannot chat with yourself for your own product')
      return
    }

    try {
      const thread = await createOrGetThread({
        product: {
          id: product._id,
          title: product.title,
          image: allMedia?.[0]?.url || '',
        },
        buyer: {
          id: user?._id,
          name: user?.name || user?.email || 'You',
        },
        seller: {
          id: product.seller?._id || product.seller?.id || 'seller',
          name: product.seller?.name || product.seller?.email || 'Seller',
        },
      })

      if (thread) {
        navigate(`/chat/${thread.id}`)
      } else {
        toast.error('Unable to start chat right now')
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to start chat. Please try again.')
    }
  }

  const handleEditProduct = () => {
    navigate(`/post-ad?edit=${product._id}`)
  }

  const handleDeleteProduct = async () => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return
    }

    try {
      setIsDeleting(true)
      await productService.deleteProduct(product._id)
      toast.success('Product deleted successfully')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete product')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewAnalytics = () => {
    navigate('/dashboard')
  }

  const getSellerPhone = () => {
    return product?.contactPhone || product?.seller?.phone || null
  }

  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return null
    // Keep digits only (WhatsApp "wa.me" requirement).
    const digitsOnly = String(phone).replace(/[^\d]/g, '')
    return digitsOnly || null
  }

  const phone = getSellerPhone()
  const whatsappPhone = formatPhoneForWhatsApp(phone)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Media */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Main Media Display */}
          <div className="aspect-video bg-black relative">
            {allMedia[selectedImage]?.type === 'video' ? (
              <ReactPlayer
                url={allMedia[selectedImage].url}
                playing
                loop
                muted
                width="100%"
                height="100%"
                controls
                className="object-cover"
              />
            ) : (
              <img
                src={allMedia[selectedImage]?.url || '/placeholder.jpg'}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Thumbnail Gallery */}
          {allMedia.length > 1 && (
            <div className="p-4 bg-gray-50">
              <div className="flex space-x-2 overflow-x-auto">
                {allMedia.map((media, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index
                        ? 'border-primary-600'
                        : 'border-transparent'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <div className="w-full h-full bg-black relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                            <span className="text-xs">▶</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt={`${product.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Car Overview */}
        <CarOverview product={product} />

        {/* Features — before description */}
        <ProductFeatures product={product} />

        {/* Product Description */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-line">{product.description || 'No description provided.'}</p>
          
          {product.brand && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">Brand: </span>
              <span className="font-semibold">{product.brand}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Product Info & Seller */}
      <div className="space-y-6">
        {/* Product Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              <div className="flex items-center space-x-2 text-gray-600 mb-4">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{product.location}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {formatPrice(product.price)}
            </div>
            {product.condition && (
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {product.condition}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isOwner ? (
              <>
                <button
                  onClick={handleEditProduct}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Edit className="h-5 w-5" />
                  <span>Edit Product</span>
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={isDeleting}
                  className="w-full btn-secondary flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete Product'}</span>
                </button>
                <button
                  onClick={handleViewAnalytics}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <BarChart3 className="h-5 w-5" />
                  <span>View Analytics</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                  onClick={() => setShowPhoneNumber((v) => !v)}
                  disabled={!phone}
                  title={!phone ? 'Phone number not available for this listing' : undefined}
                >
                  <Phone className="h-5 w-5" />
                  <span>{showPhoneNumber ? 'Hide Phone Number' : 'Show Phone Number'}</span>
                </button>
                {showPhoneNumber && phone && (
                  <div className="text-center bg-gray-50 border border-gray-200 rounded-lg py-3">
                    <div className="text-xs text-gray-500 mb-1">Seller Phone</div>
                    <div className="text-lg font-semibold text-gray-900">{phone}</div>
                  </div>
                )}
                <a
                  className="w-full btn-secondary flex items-center justify-center space-x-2 text-center no-underline"
                  href={whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!whatsappPhone}
                  onClick={(e) => {
                    if (!whatsappPhone) {
                      e.preventDefault()
                    }
                  }}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>WhatsApp</span>
                </a>
                <button
                  onClick={handleChat}
                  className="w-full btn-secondary flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Chat with Seller</span>
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={async () => {
                      if (!isAuthenticated) {
                        toast.error('Please login to save products')
                        navigate('/login')
                        return
                      }
                      const previousSaved = isSaved
                      setIsSaved(!isSaved)
                      try {
                        const res = await interactionService.saveProduct(product._id)
                        setIsSaved(res.data.saved)
                        toast.success(res.data.saved ? 'Saved to collection' : 'Removed from saved')
                      } catch (error) {
                        setIsSaved(previousSaved)
                        toast.error('Failed to save product')
                      }
                    }}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      isSaved
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: product.title,
                          text: `Check out ${product.title} - ${formatPrice(product.price)}`,
                          url: window.location.href,
                        }).catch(() => {
                          navigator.clipboard.writeText(window.location.href)
                          toast.success('Link copied to clipboard!')
                        })
                      } else {
                        navigator.clipboard.writeText(window.location.href)
                        toast.success('Link copied to clipboard!')
                      }
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Share2 className="h-5 w-5" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!isAuthenticated) {
                        toast.error('Please login to report products')
                        navigate('/login')
                        return
                      }
                      const reason = prompt('Please provide a reason for reporting this product:')
                      if (reason && reason.trim()) {
                        try {
                          await interactionService.reportProduct(product._id, {
                            reason: reason.trim(),
                            description: reason.trim(),
                          })
                          toast.success('Product reported successfully')
                        } catch (error) {
                          toast.error('Failed to report product')
                        }
                      }
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Flag className="h-5 w-5" />
                    <span>Report</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Category Info */}
          {product.category && (
            <div className="mt-6 pt-6 border-t">
              <div className="text-sm text-gray-500 mb-1">Category</div>
              <div className="font-semibold text-gray-900">{product.category.name}</div>
            </div>
          )}
        </div>

        {/* Seller Info Card */}
        {product.seller && <SellerInfo seller={product.seller} />}

        {/* Location Map Placeholder */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Location</h3>
          <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">Map integration</p>
              <p className="text-xs">{product.location}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail

