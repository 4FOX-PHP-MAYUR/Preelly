import { memo, useEffect, useState } from 'react'
import DualRangeSlider from './DualRangeSlider'
import FilterPanelShell from './FilterPanelShell'

const formatKm = (value) => `${(Number(value) || 0).toLocaleString('en-US')} km`

/**
 * Dedicated Kilometres panel — the mileage range on its own, reachable straight from
 * the toolbar quick filter instead of only from inside the Advanced panel. Bounds
 * come from the listing facets (falling back to 0–500k), same as Advanced uses.
 */
function KilometresFilterPanel({
  className = '',
  showClose = false,
  onClose,
  closing = false,
  min = 0,
  max = 500000,
  valueMin,
  valueMax,
  onApply,
}) {
  const safeMin = Math.min(min, max)
  const safeMax = Math.max(min, max)

  const [localMin, setLocalMin] = useState(valueMin ?? safeMin)
  const [localMax, setLocalMax] = useState(valueMax ?? safeMax)

  useEffect(() => {
    setLocalMin(valueMin ?? safeMin)
    setLocalMax(valueMax ?? safeMax)
  }, [valueMin, valueMax, safeMin, safeMax])

  const isFullRange = localMin <= safeMin && localMax >= safeMax

  const handleChange = (lo, hi) => {
    setLocalMin(lo)
    setLocalMax(hi)
  }

  const handleReset = () => {
    setLocalMin(safeMin)
    setLocalMax(safeMax)
  }

  return (
    <FilterPanelShell
      title="Kilometres"
      className={className}
      showClose={showClose}
      onClose={onClose}
      closing={closing}
      onReset={isFullRange ? undefined : handleReset}
      onApply={() => onApply?.(localMin, localMax)}
    >
      <p className="mb-5 text-sm font-semibold text-[#0F172A]">
        {formatKm(localMin)} – {formatKm(localMax)}
      </p>

      <DualRangeSlider
        min={safeMin}
        max={safeMax}
        valueMin={localMin}
        valueMax={localMax}
        onChange={handleChange}
        prefix=""
      />
    </FilterPanelShell>
  )
}

export default memo(KilometresFilterPanel)
