import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import SubcategoryCard from '../components/Categories/SubcategoryCard'
import CategorySkeleton from '../components/Categories/CategorySkeleton'
import { categoryService } from '../services/api'
import MotorsCategoryCascadingDropdowns from '../components/Filters/MotorsCategoryCascadingDropdowns'

function SubcategoriesPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedHierarchy, setSelectedHierarchy] = useState({
    subcategory: '',
    brand: '',
    model: '',
    trim: '',
  })

  const selectedSubcategoryId = selectedHierarchy.subcategory

  const viewProducts = () => {
    if (!selectedSubcategoryId) return
    navigate(`/categories/${categoryId}/products?subcategoryId=${selectedSubcategoryId}`)
  }

  useEffect(() => {
    if (!categoryId) return
    let cancelled = false

    const run = async () => {
      try {
        setLoading(true)
        const [categoryRes, childrenRes] = await Promise.all([
          categoryService.getCategoryById(categoryId),
          categoryService.getCategoryChildren(categoryId),
        ])
        if (cancelled) return
        setSelectedCategory(categoryRes.data || null)
        setSubcategories(Array.isArray(childrenRes.data) ? childrenRes.data : [])
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setSelectedCategory(null)
        setSubcategories([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [categoryId])

  const handleSubcategoryClick = (subcategoryId) => {
    // Navigate to the products grid with subcategory filter via query param
    navigate(`/categories/${categoryId}/products?subcategoryId=${subcategoryId}`)
  }

  const handleViewAllClick = () => {
    navigate(`/categories/${categoryId}/products`)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <CategorySkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!selectedCategory) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Category not found</h2>
        <button onClick={() => navigate('/categories')} className="btn-primary">
          Back to Categories
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/categories')}
          className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Categories</span>
        </button>
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
          <span>Categories</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">{selectedCategory.name}</span>
        </div>
      </div>

      {/* Category Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">{selectedCategory.emoji || '📦'}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{selectedCategory.name}</h1>
            {selectedCategory.count && (
              <p className="text-gray-600 mt-1">{selectedCategory.count} ads available</p>
            )}
          </div>
        </div>
      </div>

      {/* Category hierarchy dropdown (Subcategory -> Brand -> Model -> Trim) */}
      <div className="mb-6">
        <MotorsCategoryCascadingDropdowns
          rootLabel="Subcategory"
          subcategories={subcategories}
          selectedHierarchy={selectedHierarchy}
          onSubcategoryChange={(id) => {
            setSelectedHierarchy({
              subcategory: id,
              brand: '',
              model: '',
              trim: '',
            })
          }}
          onBrandChange={(id) => {
            setSelectedHierarchy((prev) => ({
              ...prev,
              brand: id,
              model: '',
              trim: '',
            }))
          }}
          onModelChange={(id) => {
            setSelectedHierarchy((prev) => ({
              ...prev,
              model: id,
              trim: '',
            }))
          }}
          onTrimChange={(id) => {
            setSelectedHierarchy((prev) => ({
              ...prev,
              trim: id,
            }))
          }}
          layout="row"
        />

        {selectedSubcategoryId && (
          <div className="mt-4">
            <button
              type="button"
              onClick={viewProducts}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              View Products
            </button>
          </div>
        )}
      </div>

      {/* Subcategories Grid */}
      {subcategories && subcategories.length > 0 ? (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Subcategories</h2>
            <button
              onClick={handleViewAllClick}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              View All Products →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {subcategories.map((subcategory) => (
              <SubcategoryCard
                key={subcategory._id}
                subcategory={subcategory}
                categoryName={selectedCategory.name}
                onClick={() => handleSubcategoryClick(subcategory._id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No subcategories available</p>
          <button onClick={handleViewAllClick} className="btn-primary">
            View All Products
          </button>
        </div>
      )}
    </div>
  )
}

export default SubcategoriesPage

