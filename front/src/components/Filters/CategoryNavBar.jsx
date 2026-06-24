import { useNavigate, useParams } from 'react-router-dom'

/**
 * Horizontal category nav like dubizzle: Motors [NEW], Property, Jobs, etc.
 * Uses categories from Redux; Motors/vehicle-like category gets a red NEW badge.
 */
export default function CategoryNavBar({ categories = [], showNewBadgeForMotors = true }) {
  const navigate = useNavigate()
  const { categoryId } = useParams()

  if (!categories.length) return null

  return (
    <nav
      className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-2 -mx-1 scrollbar-thin scrollbar-thumb-gray-300"
      aria-label="Category navigation"
    >
      {categories.map((cat) => {
        const isMotors = (cat.name || '')
          .toLowerCase()
          .match(/\b(motors?|vehicles?|cars?|auto)\b/)
        const isActive = cat._id === categoryId

        return (
          <button
            key={cat._id}
            type="button"
            onClick={() => navigate(`/categories/${cat._id}/products`)}
            className={`
              flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors
              ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}
            `}
          >
            <span>{cat.name}</span>
            {showNewBadgeForMotors && isMotors && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wide">
                NEW
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
