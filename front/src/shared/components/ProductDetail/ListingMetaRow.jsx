import { Calendar, CalendarCheck, Gauge, Globe } from 'lucide-react'
import { formatPostedDate, pickDisplay } from './detailHelpers'

function ListingMetaRow({ product }) {
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

  if (!year && !mileage && !specs && !posted) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 sm:gap-x-4">
        {year && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 sm:text-[13px]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {year}
          </span>
        )}
        {mileage && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 sm:text-[13px]">
            <Gauge className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {mileage}
          </span>
        )}
        {specs && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 sm:text-[13px]">
            <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {specs}
          </span>
        )}
      </div>
      {posted && (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 sm:text-[13px]">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          {posted}
        </span>
      )}
    </div>
  )
}

export default ListingMetaRow
