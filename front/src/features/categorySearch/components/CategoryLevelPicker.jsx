import { ChevronRight, Loader2, Pencil } from 'lucide-react'
import CategoryPickerCard from '@shared/components/CategoryPickerCard'

/**
 * One level of the hierarchical category selection.
 *
 * Level 0 is the Post Ad step-1 card grid; deeper levels use the same list UI
 * as the Post Ad subcategory screen. Unlike Post Ad — which replaces the screen
 * at every level — the search flow keeps every completed level visible above,
 * collapsed to its selection so the full path stays on screen.
 */
function CategoryLevelPicker({
  level,
  levelLabel,
  options,
  selectedId,
  selectedName,
  loading,
  onSelect,
  onEdit,
}) {
  const collapsed = Boolean(selectedId) && Boolean(onEdit)

  if (collapsed) {
    return (
      <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E8EBF2] bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
            {levelLabel || (level === 0 ? 'Category' : `Level ${level + 1}`)}
          </p>
          <p className="truncate text-base font-semibold text-[#0F172A]">{selectedName}</p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(level)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E4E7EF] px-3 py-1.5 text-sm font-medium text-[#64748B] transition hover:border-brand/30 hover:text-brand"
        >
          <Pencil className="h-3.5 w-3.5" />
          Change
        </button>
      </div>
    )
  }

  if (loading && !options.length) {
    return (
      <div className="flex w-full justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!options.length) return null

  if (level === 0) {
    return (
      <div className="grid w-full grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
        {options.map((cat) => (
          <CategoryPickerCard
            key={cat._id}
            category={cat}
            selected={String(selectedId) === String(cat._id)}
            onSelect={(id) => onSelect(level, id)}
          />
        ))}
      </div>
    )
  }

  return (
    <ul className="w-full divide-y divide-gray-200 border-t border-gray-200">
      {options.map((cat) => {
        const isSelected = String(selectedId) === String(cat._id)
        return (
          <li key={cat._id}>
            <button
              type="button"
              onClick={() => onSelect(level, cat._id)}
              className={`flex w-full items-center justify-between py-4 text-left transition ${
                isSelected ? 'text-primary-700 font-semibold' : 'text-gray-900 hover:text-primary-700'
              }`}
            >
              <span className="pr-2 text-base sm:text-[17px] md:text-lg">{cat.name}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default CategoryLevelPicker
