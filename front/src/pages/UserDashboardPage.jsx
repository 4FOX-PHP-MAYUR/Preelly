import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { fetchProducts } from '@shared/store/slices/productSlice'
import { userService, productService } from '@shared/services/api'
import { Package, Plus, Eye, Edit, Trash2, Bookmark, Users, UserPlus, User } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

function UserDashboardPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSelector((state) => state.auth)
  const { products, loading } = useSelector((state) => state.products)
  const [savedProducts, setSavedProducts] = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [activeTab, setActiveTab] = useState('my-products')
  const [deletingId, setDeletingId] = useState(null)
  const [loadingFollowers, setLoadingFollowers] = useState(false)
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  useEffect(() => {
    // Fetch user's products (including all statuses: active, pending, sold, inactive, rejected)
    if (user?._id) {
      console.log('Fetching products for user:', user._id)
      dispatch(fetchProducts({ userId: user._id, limit: 100 }))
        .then((result) => {
          console.log('Fetched products:', result.payload?.products?.length || 0)
          console.log('Product statuses:', result.payload?.products?.map(p => ({ id: p._id, status: p.status })))
        })
        .catch((error) => {
          console.error('Error fetching products:', error)
        })
      // Fetch saved products
      userService
        .getSavedProducts()
        .then((res) => setSavedProducts(res.data))
        .catch(() => {})
      
      // Fetch followers and following
      setLoadingFollowers(true)
      userService
        .getFollowers(user._id)
        .then((res) => setFollowers(res.data.followers || []))
        .catch(() => setFollowers([]))
        .finally(() => setLoadingFollowers(false))
      
      setLoadingFollowing(true)
      userService
        .getFollowing(user._id)
        .then((res) => setFollowing(res.data.following || []))
        .catch(() => setFollowing([]))
        .finally(() => setLoadingFollowing(false))
    }
  }, [dispatch, user, location.pathname]) // Refresh when location changes (user navigates back)
 
  // If the URL includes ?saved=1 open the saved tab automatically
  useEffect(() => {
    if (location.search && location.search.includes('saved')) {
      setActiveTab('saved')
    }
  }, [location.search])

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleEdit = (productId) => {
    // Navigate to edit page (you can create an edit page or use post-ad page with product data)
    navigate(`/post-ad?edit=${productId}`)
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return
    }

    try {
      setDeletingId(productId)
      await productService.deleteProduct(productId)
      toast.success('Product deleted successfully')
      // Refresh products list
      if (user?._id) {
        dispatch(fetchProducts({ userId: user._id }))
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, {user?.name || 'User'}!
        </h1>
        <p className="text-gray-600">Manage your products and account</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Products</p>
              <p className="text-3xl font-bold text-gray-900">{products.length}</p>
            </div>
            <Package className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Listings</p>
              <p className="text-3xl font-bold text-gray-900">
                {products.filter((p) => p.status === 'active').length}
              </p>
            </div>
            <Eye className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sold</p>
              <p className="text-3xl font-bold text-gray-900">
                {products.filter((p) => p.status === 'sold').length}
              </p>
            </div>
            <Package className="h-12 w-12 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Views</p>
              <p className="text-3xl font-bold text-gray-900">
                {products.reduce((sum, p) => sum + (p.views || 0), 0)}
              </p>
            </div>
            <Eye className="h-12 w-12 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <Link
          to="/post-ad"
          className="btn-primary inline-flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Post New Ad</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('my-products')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'my-products'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'saved'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bookmark className="inline h-4 w-4 mr-2" />
            Saved Products ({savedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'followers'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="inline h-4 w-4 mr-2" />
            Followers ({followers.length})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'following'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserPlus className="inline h-4 w-4 mr-2" />
            Following ({following.length})
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {activeTab === 'my-products' && 'My Products'}
            {activeTab === 'saved' && 'Saved Products'}
            {activeTab === 'followers' && 'Followers'}
            {activeTab === 'following' && 'Following'}
          </h2>
        </div>
        {activeTab === 'followers' || activeTab === 'following' ? (
          // Followers/Following List
          <>
            {activeTab === 'followers' && loadingFollowers ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : activeTab === 'following' && loadingFollowing ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (activeTab === 'followers' ? followers : following).length === 0 ? (
              <div className="p-12 text-center">
                {activeTab === 'followers' ? (
                  <>
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No followers yet</h3>
                    <p className="text-gray-600">Start posting products to get followers!</p>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Not following anyone</h3>
                    <p className="text-gray-600">Follow users to see their products!</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {(activeTab === 'followers' ? followers : following).map((user) => (
                  <div
                    key={user._id}
                    className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/user/${user._id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {user.avatar ? (
                          <img
                            src={getMediaUrl(user.avatar) || user.avatar}
                            alt={user.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {user.name}
                        </h3>
                        {user.email && (
                          <p className="text-sm text-gray-600 truncate">{user.email}</p>
                        )}
                        {user.rating > 0 && (
                          <p className="text-sm text-yellow-600 mt-1">
                            ⭐ {user.rating.toFixed(1)}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/user/${user._id}`)
                          }}
                          className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (activeTab === 'my-products' ? products : savedProducts).length === 0 ? (
          <div className="p-12 text-center">
            {activeTab === 'my-products' ? (
              <>
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
                <p className="text-gray-600 mb-4">Start selling by posting your first ad!</p>
                <Link to="/post-ad" className="btn-primary inline-flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Post Your First Ad</span>
                </Link>
              </>
            ) : (
              <>
                <Bookmark className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved products</h3>
                <p className="text-gray-600 mb-4">Save products you like to view them later!</p>
                <Link to="/categories" className="btn-primary inline-flex items-center space-x-2">
                  <span>Browse Products</span>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {(activeTab === 'my-products' ? products : savedProducts).map((product) => (
              <div
                key={product._id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-24 h-24 bg-gray-200 rounded-lg overflow-hidden">
                    {product.video ? (
                      <video
                        src={getMediaUrl(product.video)}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${product._id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-primary-600 mb-1 block"
                    >
                      {product.title}
                    </Link>
                    <p className="text-primary-600 font-bold text-lg mb-2">
                      {formatPrice(product.price)}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{product.location}</span>
                      <span>•</span>
                      <span>{product.views || 0} views</span>
                      <span>•</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : product.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : product.status === 'sold'
                            ? 'bg-purple-100 text-purple-800'
                            : product.status === 'inactive'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.status === 'pending' && '⏳ Pending Review'}
                        {product.status === 'active' && '✅ Approved'}
                        {product.status === 'rejected' && '❌ Rejected'}
                        {product.status === 'sold' && '💰 Sold'}
                        {product.status === 'inactive' && '⏸️ Inactive'}
                        {!['pending', 'active', 'rejected', 'sold', 'inactive'].includes(product.status) && 
                          product.status?.charAt(0).toUpperCase() + product.status?.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/products/${product._id}`}
                      className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                      title="View"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => handleEdit(product._id)}
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      disabled={deletingId === product._id}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === product._id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserDashboardPage

