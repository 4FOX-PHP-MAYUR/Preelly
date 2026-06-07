import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SubcategoryCard from '../components/Categories/SubcategoryCard'
import CategorySkeleton from '../components/Categories/CategorySkeleton'
import CategoryBrowseLayout from '../components/Categories/CategoryBrowseLayout'
import { categoryService } from '../services/api'
import MotorsCategoryCascadingDropdowns from '../components/Filters/MotorsCategoryCascadingDropdowns'
import { CategoryBadge } from '../components/Categories/categoryBrowseShared'

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
    navigate(`/categories/${categoryId}/products?subcategoryId=${subcategoryId}`)
  }

  const handleViewAllClick = () => {
    navigate(`/categories/${categoryId}/products`)
  }

  if (loading) {
    return (
      <CategoryBrowseLayout activeCategoryId={categoryId}>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <CategorySkeleton key={i} />
            ))}
          </div>
        </div>
      </CategoryBrowseLayout>
    )
  }

  if (!selectedCategory) {
    return (
      <CategoryBrowseLayout activeCategoryId={categoryId}>
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Category not found</h2>
            <button
              type="button"
              onClick={() => navigate('/categories')}
              className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Back to Categories
            </button>
          </div>
        </div>
      </CategoryBrowseLayout>
    )
  }

  return (
    <CategoryBrowseLayout activeCategoryId={categoryId}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-5 sm:px-5">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="text-xs font-medium text-slate-400 transition hover:text-primary-700"
          >
            ← Categories
          </button>
          <div className="mt-2 flex items-center gap-3">
            <CategoryBadge category={selectedCategory} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{selectedCategory.name}</h1>
              {selectedCategory.count ? (
                <p className="text-sm text-slate-500">{selectedCategory.count} ads available</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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

            {selectedSubcategoryId ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={viewProducts}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  View Products
                </button>
              </div>
            ) : null}
          </div>

          {subcategories && subcategories.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Subcategories</h2>
                <button
                  type="button"
                  onClick={handleViewAllClick}
                  className="text-sm font-semibold text-primary-700 transition hover:text-primary-800"
                >
                  View all products →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="text-slate-600 mb-4">No subcategories available</p>
              <button
                type="button"
                onClick={handleViewAllClick}
                className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                View All Products
              </button>
            </div>
          )}
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default SubcategoriesPage
