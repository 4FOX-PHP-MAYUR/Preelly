import { useState } from 'react'
import { Calendar, CalendarCheck, Gauge, Globe } from 'lucide-react'
import { getMediaUrl } from '../../utils/helpers'
import { formatPostedDate, mapDetailQuickViewRows, pickDisplay } from './detailHelpers'

const CHIP_CLASS = 'inline-flex items-center gap-1 text-xs text-slate-500 sm:text-[13px]'
const ICON_CLASS = 'h-3.5 w-3.5 shrink-0 text-slate-400'

/**
 * Lucide fallbacks for the fields this row has always shown, used when the admin
 * hasn't uploaded a fieldIcon for them. Keeps the familiar calendar/gauge/globe look
 * on car listings; any other field simply renders without an icon.
 */
const FALLBACK_ICONS = {
  year: Calendar,
  yearid: Calendar,
  kilometers: Gauge,
  mileage: Gauge,
  regionalspecs: Globe,
  regionalspecsid: Globe,
  targetmarket: Globe,
}

function DynamicChip({ row }) {
  // An icon uploaded on one environment isn't on disk everywhere, so a 404 falls back
  // to the lucide icon (or to no icon) rather than leaving a broken-image glyph.
  const [iconFailed, setIconFailed] = useState(false)
  const iconUrl = row.iconPath && !iconFailed ? getMediaUrl(row.iconPath) : null
  const FallbackIcon = iconUrl ? null : FALLBACK_ICONS[row.key.toLowerCase()]

  // Value only — the icon carries the meaning, matching the original year/km/specs row.
  // fieldTitle still rides along in the payload and is used as the icon's alt text.
  return (
    <span className={CHIP_CLASS}>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={row.label}
          title={row.label || undefined}
          className="h-3.5 w-3.5 shrink-0 object-contain"
          onError={() => setIconFailed(true)}
        />
      ) : FallbackIcon ? (
        <FallbackIcon className={ICON_CLASS} aria-hidden />
      ) : null}
      <span>{row.value}</span>
    </span>
  )
}

function ListingMetaRow({ product }) {
  // Feed APIs drive this row from the admin's `showOnQuickView` form fields. Elsewhere
  // (product detail, older payloads) `detailquickView` is absent and the original
  // year / mileage / regional-specs line below is used unchanged.
  const dynamicRows = mapDetailQuickViewRows(product?.detailquickView)

  const year = pickDisplay(product?.year, product?.carOverview?.year, product?.yearIdValue)
  const mileageRaw = product?.mileage ?? product?.kilometers ?? product?.carOverview?.kilometers
  const mileage =
    mileageRaw != null && mileageRaw !== ''
      ? Number.isFinite(Number(mileageRaw))
        ? `${Number(mileageRaw).toLocaleString()} km`
        : String(mileageRaw)
      : null
  const specs = pickDisplay(
    product?.regionalSpecs,
    product?.carOverview?.regionalSpecs,
    product?.regionalSpecsIdValue,
    product?.targetMarket
  )
  const posted = formatPostedDate(product?.createdAt)

  if (!dynamicRows.length && !year && !mileage && !specs && !posted) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 sm:gap-x-4">
        {dynamicRows.length ? (
          dynamicRows.map((row, index) => <DynamicChip key={`${row.key}-${index}`} row={row} />)
        ) : (
          <>
            {year && (
              <span className={CHIP_CLASS}>
                <Calendar className={ICON_CLASS} aria-hidden />
                {year}
              </span>
            )}
            {mileage && (
              <span className={CHIP_CLASS}>
                <Gauge className={ICON_CLASS} aria-hidden />
                {mileage}
              </span>
            )}
            {specs && (
              <span className={CHIP_CLASS}>
                <Globe className={ICON_CLASS} aria-hidden />
                {specs}
              </span>
            )}
          </>
        )}
      </div>
      {posted && (
        <span className={CHIP_CLASS}>
          <CalendarCheck className={ICON_CLASS} aria-hidden />
          {posted}
        </span>
      )}
    </div>
  )
}

export default ListingMetaRow
