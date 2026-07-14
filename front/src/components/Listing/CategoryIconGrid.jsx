import { memo, useState } from 'react'
import { Check } from 'lucide-react'
import { getCategoryImageUrl } from '@shared/utils/helpers'
import { getCategoryIcon } from '../Categories/categoryBrowseShared'

function CategoryCard({ item, active, onSelect }) {
  const [imgFailed, setImgFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(item)
  const Icon = getCategoryIcon(item.name)
  const bg = item.colorCode || '#F1F5F9'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item._id, item)}
      style={{ backgroundColor: bg }}
      className={`relative flex min-h-[104px] flex-col justify-between rounded-2xl p-3 text-left transition ${
        active ? 'ring-2 ring-brand' : 'ring-1 ring-transparent hover:ring-brand/30'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden">
          {imageSrc && !imgFailed ? (
            <img
              src={imageSrc}
              alt={item.name}
              className="h-7 w-7 object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : item.emoji ? (
            <span className="text-xl leading-none">{item.emoji}</span>
          ) : (
            <Icon className="h-5 w-5 text-slate-600" />
          )}
        </span>
        {active ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <span className="mt-2 text-[0.7875rem] font-semibold leading-tight text-[#0F172A]">{item.name}</span>
    </button>
  )
}

function CategoryIconGrid({ items = [], selectedId = '', onSelect }) {
  if (!items.length) return null

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <CategoryCard
          key={item._id}
          item={item}
          active={String(selectedId) === String(item._id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export default memo(CategoryIconGrid)
