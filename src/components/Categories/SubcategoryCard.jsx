import { ChevronRight } from 'lucide-react'

function SubcategoryCard({ subcategory, categoryName, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="mb-1 font-semibold text-slate-900 transition group-hover:text-primary-700">
            {subcategory.name}
          </h3>
          <p className="text-xs text-slate-500">{categoryName}</p>
        </div>
        <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-primary-600" />
      </div>
    </button>
  )
}

export default SubcategoryCard

