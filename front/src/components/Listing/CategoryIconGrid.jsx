import { memo } from 'react'
import { getCategoryIcon } from '../Categories/categoryBrowseShared'

function CategoryIconGrid({ items = [], selectedId = '', onSelect }) {
  if (!items.length) return null

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const active = String(selectedId) === String(item._id)
        const Icon = getCategoryIcon(item.name)
        return (
          <button
            key={item._id}
            type="button"
            onClick={() => onSelect?.(item._id, item)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition ${
              active
                ? 'border-brand bg-brand/5 text-brand shadow-sm shadow-brand/10'
                : 'border-[#E4E7EF] bg-white text-[#64748B] hover:border-brand/30 hover:text-brand'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-lg">
              {item.emoji ? (
                <span className="text-base leading-none">{item.emoji}</span>
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">{item.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export default memo(CategoryIconGrid)
