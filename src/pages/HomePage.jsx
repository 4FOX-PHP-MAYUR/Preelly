import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowRight, Video, Play, Search, TrendingUp, Users, Zap, Shield, Heart, Star, Grid3x3, ShoppingBag } from 'lucide-react'
import { fetchCategories } from '../store/slices/categorySlice'
import CategorySkeleton from '../components/Categories/CategorySkeleton'

function HomePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { categories, loading } = useSelector((state) => state.categories)

  useEffect(() => {
    // Avoid duplicate category fetches on initial load / dev StrictMode.
    if (!categories || categories.length === 0) dispatch(fetchCategories())
  }, [dispatch, categories])

  const isVehicleCategory = (name) =>
    (name || '').toLowerCase().match(/\b(motors?|vehicles?|cars?|auto)\b/)

  const handleCategoryClick = (category) => {
    // Vehicles/Motors: go directly to filters + listings page
    if (isVehicleCategory(category.name)) {
      navigate(`/categories/${category._id}/products`)
      return
    }
    // For all other categories, open the subcategory view.
    // The subcategory page fetches children from the normalized hierarchy.
    navigate(`/categories/${category._id}`)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top-left logo */}
      <div className="absolute top-4 left-4 z-50">
        <Link to="/" className="flex items-center gap-2">
          <ShoppingBag className="h-8 w-8 text-primary-600" />
          <span className="text-lg font-bold text-primary-600">Preelly</span>
        </Link>
      </div>
      {/* TikTok-style Hero Section */}
      <section className="relative min-h-screen flex items-start justify-center overflow-hidden pt-20 pb-16">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(147,51,234,0.1),transparent_50%)]" />
        </div>
        
        {/* Floating Particles Effect */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-primary-500/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10 py-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 border border-primary-500/30 rounded-full mb-6 animate-fade-in">
            <TrendingUp className="h-4 w-4 text-primary-400" />
            <span className="text-primary-300 text-sm font-medium">TikTok-Style Shopping Experience</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Discover{' '}
            </span>
            <span className="bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 bg-clip-text text-transparent">
              Products
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-base md:text-lg mb-2 text-gray-300 max-w-2xl mx-auto">
            Swipe through video reels of products
          </p>
          <p className="text-sm md:text-base mb-10 text-gray-400 max-w-xl mx-auto">
            Just like TikTok, but for shopping
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
            <Link
              to="/reels"
              className="group bg-white text-black px-8 py-3 rounded-full font-semibold text-base hover:bg-gray-100 transition-all transform hover:scale-105 inline-flex items-center justify-center shadow-2xl shadow-primary-500/20"
            >
              <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Watch Reels
            </Link>
            <Link
              to="/post-ad"
              className="group bg-primary-600 text-white px-8 py-3 rounded-full font-semibold text-base hover:bg-primary-700 transition-all transform hover:scale-105 inline-flex items-center justify-center shadow-2xl shadow-primary-500/30"
            >
              <Video className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Post Your Ad
            </Link>
          </div>

          {/* Categories in Hero Section */}
          {categories.length > 0 && (
            <div className="mt-10 w-full max-w-6xl mx-auto">
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm font-medium mb-4 whitespace-nowrap">Browse by Category</p>
              </div>
              {loading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="bg-gray-800/30 rounded-lg p-3 animate-pulse">
                      <div className="w-10 h-10 bg-gray-700 rounded-full mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded mx-auto w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {categories.slice(0, 12).map((category) => (
                      <button
                        key={category._id}
                        onClick={() => handleCategoryClick(category)}
                        className="group relative bg-gray-800/30 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4 hover:border-primary-500/50 hover:bg-gray-800/50 transition-all hover:transform hover:scale-105 text-center"
                      >
                        <div className="flex justify-center mb-2">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            {category.icon ? (
                              <img src={category.icon} alt={category.name} className="w-10 h-10" />
                            ) : (
                              <span className="text-3xl">{category.emoji || '📦'}</span>
                            )}
                          </div>
                        </div>
                        {/* Visible Label */}
                        <h3 className="font-medium text-white text-xs group-hover:text-primary-400 transition-colors line-clamp-1">
                          {category.name}
                        </h3>
                        {/* Label on Hover (Tooltip) */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                          {category.name}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {categories.length > 12 && (
                    <div className="text-center mt-6">
                      <Link
                        to="/categories"
                        className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                      >
                        View All Categories
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 text-center">
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="h-5 w-5 text-primary-400" />
              <span className="text-sm md:text-base">10K+ Users</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Video className="h-5 w-5 text-primary-400" />
              <span className="text-sm md:text-base">5K+ Products</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Heart className="h-5 w-5 text-primary-400" />
              <span className="text-sm md:text-base">50K+ Likes</span>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Why Choose <span className="text-primary-400">Preelly</span>?
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Experience shopping like never before with our innovative video-first marketplace
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Video className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Video Reels</h3>
              <p className="text-gray-400 leading-relaxed">
                Browse products through engaging video reels, just like TikTok. See products in action before you buy.
              </p>
            </div>

            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Search className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Smart Search</h3>
              <p className="text-gray-400 leading-relaxed">
                Find what you're looking for instantly with TikTok-style search and advanced filters.
              </p>
            </div>

            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">All Products</h3>
              <p className="text-gray-400 leading-relaxed">
                See all products in one feed - no category browsing needed. Discover everything effortlessly.
              </p>
            </div>

            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Safe & Secure</h3>
              <p className="text-gray-400 leading-relaxed">
                Buy and sell with confidence. All products are verified and transactions are secure.
              </p>
            </div>

            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Star className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Top Quality</h3>
              <p className="text-gray-400 leading-relaxed">
                Browse only the best products. Quality verified by our community and moderation team.
              </p>
            </div>

            <div className="group p-6 bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-primary-500/50 transition-all hover:transform hover:scale-105">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Heart className="h-7 w-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Community Driven</h3>
              <p className="text-gray-400 leading-relaxed">
                Join thousands of users buying and selling. Like, comment, and share your favorite finds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-black relative overflow-hidden pb-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-transparent to-primary-600/10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pb-24">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 border border-primary-500/30 rounded-full mb-6">
            <Zap className="h-4 w-4 text-primary-400" />
            <span className="text-primary-300 text-sm font-medium">Get Started Now</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Ready to <span className="text-primary-400">explore</span>?
          </h2>
          <p className="text-gray-400 mb-10 text-lg md:text-xl max-w-2xl mx-auto">
            Start browsing products in our TikTok-style reels feed. Discover amazing deals and connect with sellers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/reels"
              className="group bg-primary-600 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-primary-700 transition-all transform hover:scale-105 inline-flex items-center justify-center shadow-2xl shadow-primary-500/30"
            >
              <Play className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform" />
              Start Watching Reels
            </Link>
          <Link
              to="/post-ad"
              className="group bg-white/10 backdrop-blur-sm text-white border border-white/20 px-10 py-5 rounded-full font-bold text-lg hover:bg-white/20 transition-all transform hover:scale-105 inline-flex items-center justify-center"
          >
              <Video className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform" />
              Post Your Ad
          </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage

