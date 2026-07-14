import { useMemo } from 'react'
import {
  buildOverviewItems,
  getOverviewTitle,
  mapQuickViewRows,
} from './detailHelpers'
import DetailCard from './DetailCard'

const OVERVIEW_COLUMNS = 3

function chunkIntoRows(items, columns = OVERVIEW_COLUMNS) {
  const rows = []
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns))
  }
  return rows
}

function OverviewCard({ product, title, flat = false }) {
  const items = useMemo(() => {
    const built = buildOverviewItems(product)
    if (built.length) return built
    return mapQuickViewRows(product?.quickViewData)
  }, [product])

  const overviewTitle =
    title || getOverviewTitle(product?.category?.name || product?.categoryName || '')

  if (!items.length) return null

  const rows = chunkIntoRows(items, OVERVIEW_COLUMNS)

  return (
    <DetailCard title={overviewTitle} flat={flat}>
      <div className="divide-y divide-[#E8EBF2]">
        {rows.map((row, rowIdx) => (
          <div
            key={`overview-row-${rowIdx}`}
            className="grid grid-cols-3 gap-x-4 py-4 first:pt-0 last:pb-0"
          >
            {row.map((item, idx) => (
              <div key={`${item.label}-${idx}`} className="min-w-0">
                <div className="text-xs text-slate-400">{item.label}</div>
                <div className="mt-0.5 break-words text-sm font-semibold text-slate-900">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DetailCard>
  )
}

export default OverviewCard
