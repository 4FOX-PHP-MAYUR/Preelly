import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchRootCategories } from '../store/slices/categorySlice'
import CategoryCard from '../components/Categories/CategoryCard'
import CategorySkeleton from '../components/Categories/CategorySkeleton'

function CategoriesPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { rootCategories, loading } = useSelector((state) => state.categories)

  useEffect(() => {
    // Only fetch if root categories are not already loaded
    if (rootCategories.length === 0 && !loading) {
      dispatch(fetchRootCategories())
    }
  }, [dispatch, rootCategories.length, loading])

  const isVehicleCategory = (name) =>
    (name || '').toLowerCase().match(/\b(motors?|vehicles?|cars?|auto)\b/)

  const handleCategoryClick = (category) => {
    // Vehicles/Motors: go directly to filters + listings page
    if (isVehicleCategory(category.name)) {
      navigate(`/categories/${category._id}/products`)
      return
    }
    // For all other categories, always open the subcategory view.
    // It will fetch children based on the normalized category tree.
    navigate(`/categories/${category._id}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Categories</h1>
        <p className="text-gray-600">Select a category to view products</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <CategorySkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {rootCategories.map((category) => (
            <CategoryCard
              key={category._id}
              category={category}
              onClick={() => handleCategoryClick(category)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CategoriesPage

