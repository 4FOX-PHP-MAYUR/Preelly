import { useState } from 'react'
import {
  Briefcase,
  Building2,
  Car,
  LayoutGrid,
  Shirt,
  Smartphone,
  Sofa,
} from 'lucide-react'
import { formatPrice, getCategoryImageUrl, getMediaUrl } from '@shared/utils/helpers'
import { productHasVideo } from '@shared/utils/videoHelpers'
import ListingVideoPreview from '@shared/components/Video/ListingVideoPreview'

export const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i, icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i, icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i, icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i, icon: Sofa },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming)\b/i, icon: Smartphone },
]

export function getCategoryIcon(name) {
  return categoryIconMap.find(({ pattern }) => pattern.test(name || ''))?.icon ?? LayoutGrid
}

export function formatCompactCount(value) {
  if (!value || Number(value) <= 0) return '0'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatCategoryCount(value) {
  const n = Number(value || 0)
  return n ? n.toLocaleString('en-US') : null
}

export function formatListingPrice(product) {
  const amount = Number(product?.price || 0)
  const currency =
    typeof product?.currency === 'string' && product.currency.length === 3
      ? product.currency.toUpperCase()
      : 'AED'
  try {
    return formatPrice(amount, currency)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function formatTimeAgo(value) {
  if (!value) return ''
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

export function isVehicleCategoryName(name) {
  return /\b(motors?|vehicles?|cars?|auto)\b/i.test(name || '')
}

export function CategoryBadge({ category, compact = false }) {
  const Icon = getCategoryIcon(category?.name)
  const sizeClass = compact ? 'h-4 w-4' : 'h-5 w-5'
  const shellClass = compact ? 'h-7 w-7 rounded-full' : 'h-10 w-10 rounded-2xl'
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(category)

  if (imageSrc && !imageFailed) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-primary-50 ${shellClass}`}>
        <img
          src={imageSrc}
          alt={category.name}
          className={`${compact ? 'h-7 w-7' : 'h-10 w-10'} w-full object-cover`}
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  if (category?.emoji) {
    return (
      <div className={`flex items-center justify-center bg-primary-50 ${shellClass} ${compact ? 'text-sm' : 'text-lg'}`}>
        {category.emoji}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center bg-primary-50 text-primary-700 ${shellClass}`}>
      <Icon className={sizeClass} />
    </div>
  )
}

export function ListingMedia({ product, className }) {
  if (productHasVideo(product)) {
    return <ListingVideoPreview product={product} className={className} alt={product?.title || 'Listing'} />
  }

  const imageSrc = product?.images?.[0] ? getMediaUrl(product.images[0]) || product.images[0] : null

  if (imageSrc) {
    return <img src={imageSrc} alt={product?.title || 'Listing'} className={className} />
  }

  return <div className={`${className} bg-gradient-to-br from-primary-100 to-slate-100`} />
}

export function readAdditionalField(product, key) {
  const af = product?.additionalFields
  if (!af) return null
  try {
    if (typeof af?.get === 'function') return af.get(key)
  } catch {}
  return af[key]
}

export function buildVehicleLine(product) {
  const make = String(product?.make || product?.brand || '').trim()
  const model = String(product?.model || '').trim()
  const variant = String(
    readAdditionalField(product, 'trim') ||
      readAdditionalField(product, 'variant') ||
      readAdditionalField(product, 'version') ||
      readAdditionalField(product, 'subModel') ||
      '',
  ).trim()
  return [make, model, variant].filter(Boolean).join(' · ')
}

export function buildSpecsLine(product) {
  const year = product?.year != null ? String(product.year) : ''
  const mileage = product?.mileage != null ? `${Number(product.mileage).toLocaleString()} km` : ''
  const specs = String(
    readAdditionalField(product, 'specs') ||
      readAdditionalField(product, 'gccSpecs') ||
      readAdditionalField(product, 'market') ||
      product?.specifications ||
      '',
  ).trim()
  return [year, mileage, specs].filter(Boolean).join(' · ')
}

export function matchesListingChip(product, chip) {
  if (!chip || chip === 'all') return true
  const title = `${product?.title || ''} ${product?.description || ''}`.toLowerCase()
  const purpose = String(readAdditionalField(product, 'purpose') || readAdditionalField(product, 'listingType') || '').toLowerCase()

  if (chip === 'buy') {
    return purpose.includes('sale') || purpose.includes('buy') || (!purpose.includes('rent') && !title.includes('rent'))
  }
  if (chip === 'rent') {
    return purpose.includes('rent') || title.includes('rent') || title.includes('lease')
  }
  if (chip === 'verified') {
    return Boolean(product?.seller?.isVerified)
  }
  if (chip === 'featured') {
    return product?.adType === 'premium'
  }
  return true
}
