import { useState } from 'react'
import { Building2, Car, LayoutGrid, Newspaper, Shirt, Smartphone, Sofa } from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'

const CATEGORY_CARD_THEMES = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i, bg: '#FFF8E6', ring: 'ring-amber-300', iconClass: 'text-amber-500', Icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, bg: '#EBF6FF', ring: 'ring-sky-300', iconClass: 'text-sky-500', Icon: Building2 },
  { pattern: /\b(fashion|clothing|accessories)\b/i, bg: '#FFF0F6', ring: 'ring-pink-300', iconClass: 'text-pink-500', Icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i, bg: '#EDFAF3', ring: 'ring-emerald-300', iconClass: 'text-emerald-600', Icon: Sofa },
  { pattern: /\b(classified|general|other)\b/i, bg: '#FFF3EB', ring: 'ring-orange-300', iconClass: 'text-orange-500', Icon: Newspaper },
  { pattern: /\b(mobile|tablet)\b/i, bg: '#EEF2FF', ring: 'ring-indigo-300', iconClass: 'text-indigo-500', Icon: Smartphone },
  { pattern: /\b(electronics|phone|laptop|gaming|computer)\b/i, bg: '#F0F1FA', ring: 'ring-violet-300', iconClass: 'text-violet-500', Icon: Smartphone },
]

export function getCategoryCardTheme(name) {
  const match = CATEGORY_CARD_THEMES.find((item) => item.pattern.test(name || ''))
  return match || { bg: '#F4F6F8', ring: 'ring-slate-300', iconClass: 'text-slate-500', Icon: LayoutGrid }
}

export function getCategoryCardImageUrl(category) {
  const path = category?.categoryImage
  if (!path || typeof path !== 'string') return null
  return getMediaUrl(path) || path
}

/**
 * Post-ad style category card (also used by the hierarchical search flow).
 * Card background is the admin-configured `category.colorCode`; the hardcoded
 * theme only fills in for categories that don't have one set yet.
 */
function CategoryPickerCard({ category, selected, onSelect }) {
  const theme = getCategoryCardTheme(category?.name)
  const Icon = theme.Icon
  const imageSrc = getCategoryCardImageUrl(category)
  const [imageFailed, setImageFailed] = useState(false)
  const bgColor = /^#[0-9A-Fa-f]{3,8}$/.test(category?.colorCode || '') ? category.colorCode : theme.bg

  return (
    <button
      type="button"
      onClick={() => onSelect(category._id)}
      style={{ backgroundColor: bgColor }}
      className={`group relative flex aspect-square w-full min-w-0 flex-col justify-between rounded-2xl p-4 text-left transition-all sm:p-5 ${
        selected ? 'shadow-md scale-[1.02] ring-2 ring-black/10' : 'hover:shadow-md hover:scale-[1.01]'
      }`}
    >
      <div className="flex items-start justify-start">
        {imageSrc && !imageFailed ? (
          <img
            src={imageSrc}
            alt=""
            className="h-10 w-10 object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon className={`h-10 w-10 ${theme.iconClass}`} strokeWidth={2} />
        )}
      </div>
      <span className="text-base font-medium text-gray-800 leading-snug">
        {category.name}
      </span>
    </button>
  )
}

export default CategoryPickerCard
