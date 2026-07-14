import { Calendar, Clock, Eye, Fuel, Gauge, Hash, MapPin, Settings, Tag } from 'lucide-react'
import { buildMetaChips } from './detailHelpers'

const ICON_MAP = {
  calendar: Calendar,
  gauge: Gauge,
  fuel: Fuel,
  cog: Settings,
  mapPin: MapPin,
  clock: Clock,
  eye: Eye,
  hash: Hash,
  tag: Tag,
}

function MetaInfoChips({ product, variant = 'default', className = '' }) {
  const chips = buildMetaChips(product)
  if (!chips.length) return null

  const isOverlay = variant === 'overlay'

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {chips.map((chip, idx) => {
        const Icon = ICON_MAP[chip.icon]
        return (
          <span
            key={`${chip.icon}-${idx}`}
            className={`inline-flex items-center gap-1.5 text-sm ${
              isOverlay ? 'text-white/90' : 'text-slate-500'
            }`}
          >
            {Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${isOverlay ? 'text-white/80' : ''}`} /> : null}
            <span>{chip.label}</span>
          </span>
        )
      })}
    </div>
  )
}

export default MetaInfoChips
