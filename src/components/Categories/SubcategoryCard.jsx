import { ChevronRight } from 'lucide-react'

function SubcategoryCard({ subcategory, categoryName, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all text-left group border border-gray-200 hover:border-primary-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-1">
            {subcategory.name}
          </h3>
          <p className="text-xs text-gray-500">{categoryName}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0 ml-2" />
      </div>
    </button>
  )
}

export default SubcategoryCard

