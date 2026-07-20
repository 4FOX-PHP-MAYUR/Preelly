import { useState } from 'react'
import { Briefcase, Building2, Car, LayoutGrid, Newspaper, Shirt, Smartphone, Sofa } from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'

const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i, icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i, icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i, icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i, icon: Sofa },
  { pattern: /\b(classified|general|other)\b/i, icon: Newspaper },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming|appliance)\b/i, icon: Smartphone },
]

function getFallbackCategoryIcon(name) {
  const match = categoryIconMap.find((item) => item.pattern.test(name || ''))
  return match?.icon || LayoutGrid
}

function formatCompactCount(value) {
  if (!value || Number(value) <= 0) return '0'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatCategoryCount(value) {
  const count = Number(value || 0)
  if (!count) return null
  return count.toLocaleString('en-US')
}

const CATEGORY_ICON_SIZE_CLASS = 'h-[1.15425rem] w-[1.15425rem]'

export function SidebarCategoryBadge({ category }) {
  const Icon = getFallbackCategoryIcon(category?.name)
  const [imageFailed, setImageFailed] = useState(false)
  const iconPath = category?.icon
  const imageSrc = iconPath && typeof iconPath === 'string' ? getMediaUrl(iconPath) || iconPath : null

  if (imageSrc && !imageFailed) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${CATEGORY_ICON_SIZE_CLASS}`}>
        <img
          src={imageSrc}
          alt=""
          className={`${CATEGORY_ICON_SIZE_CLASS} object-contain`}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return <Icon className={`${CATEGORY_ICON_SIZE_CLASS} shrink-0 text-slate-600`} strokeWidth={1.75} />
}

function SidebarCategoryList({ categories = [], activeId = '', onSelect, collapsed = false }) {
  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const isActive = String(category._id) === String(activeId)
        return (
          <button
            key={category._id}
            type="button"
            title={category.name}
            onClick={() => onSelect?.(category)}
            className={`flex w-full items-center gap-4 rounded-xl px-1 py-3 text-left transition ${
              isActive ? 'bg-brand-50 text-brand' : 'hover:bg-slate-50'
            }`}
          >
            <SidebarCategoryBadge category={category} />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-snug ${isActive ? 'text-brand' : 'text-slate-700'}`}>
                    {category.name}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-slate-400 tabular-nums">
                  {formatCategoryCount(category.count) || formatCompactCount(category.count)}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default SidebarCategoryList
