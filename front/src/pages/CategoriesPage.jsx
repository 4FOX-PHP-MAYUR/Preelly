import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import CategorySkeleton from '../components/Categories/CategorySkeleton'
import { CategoryBadge, formatCategoryCount, isVehicleCategoryName } from '../components/Categories/categoryBrowseShared'
import { getCategoryImageUrl } from '@shared/utils/helpers'

function BrowseCategoryTile({ category, onClick }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(category)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-primary-50 transition group-hover:bg-primary-100">
          {imageSrc && !imageFailed ? (
            <img
              src={imageSrc}
              alt={category.name}
              className="h-20 w-20 object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : category.emoji ? (
            <span className="text-4xl">{category.emoji}</span>
          ) : (
            <CategoryBadge category={category} />
          )}
        </div>
      </div>
      <h3 className="text-center text-sm font-semibold text-slate-900 transition group-hover:text-primary-700">
        {category.name}
      </h3>
      <p className="mt-1 text-center text-xs text-slate-500">
        {formatCategoryCount(category.count) || '0'} ads
      </p>
    </button>
  )
}

function CategoriesPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { rootCategories, rootLoading: loading } = useSelector((state) => state.categories)

  useEffect(() => {
    if (rootCategories.length === 0 && !loading) {
      dispatch(fetchRootCategories())
    }
  }, [dispatch, rootCategories.length, loading])

  const handleCategoryClick = (category) => {
    if (isVehicleCategoryName(category.name)) {
      navigate(`/categories/${category._id}/products`)
      return
    }
    navigate(`/categories/${category._id}`)
  }

  return (
    <CategoryBrowseLayout showMessages={false}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-5 sm:px-5">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Browse Categories</h1>
          <p className="mt-1 text-sm text-slate-500">Select a category to explore listings</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(12)].map((_, i) => (
                <CategorySkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {rootCategories.map((category) => (
                <BrowseCategoryTile
                  key={category._id}
                  category={category}
                  onClick={() => handleCategoryClick(category)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default CategoriesPage
