import { memo, useEffect, useState } from 'react'
import { KMS_FILTER_RANGE } from '@shared/utils/constants'
import DualRangeSlider from './DualRangeSlider'
import FilterPanelShell from './FilterPanelShell'

const formatKm = (value) => `${(Number(value) || 0).toLocaleString('en-US')} km`

/** Same box as the Price panel's, with the unit after the number instead of before. */
function KmInput({ value, onChange, placeholder }) {
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-full border border-[#E4E7EF] bg-white px-4 py-3">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value.replace(/[^\d]/g, ''))}
        className="min-w-0 flex-1 border-0 bg-transparent text-right text-sm font-semibold text-[#0F172A] outline-none"
      />
      <span className="shrink-0 pl-2 text-sm font-medium text-[#94A3B8]">km</span>
    </div>
  )
}

function parseInput(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Dedicated Kilometres panel — the mileage range on its own, reachable straight from
 * the toolbar quick filter instead of only from inside the Advanced panel. Bounds
 * default to the shared 0 – 7 lakh km scale, the same one Advanced and advance
 * search use.
 *
 * The two boxes mirror the Price panel: the slider and the inputs stay in step, and
 * Apply validates what was typed rather than trusting it, so a value outside the
 * scale or a reversed pair is reported instead of silently filtering to nothing.
 */
function KilometresFilterPanel({
  className = '',
  showClose = false,
  onClose,
  closing = false,
  min = KMS_FILTER_RANGE.min,
  max = KMS_FILTER_RANGE.max,
  valueMin,
  valueMax,
  onApply,
}) {
  const safeMin = Math.min(min, max)
  const safeMax = Math.max(min, max)
  const initialMin = valueMin ?? safeMin
  const initialMax = valueMax ?? safeMax

  const [localMin, setLocalMin] = useState(initialMin)
  const [localMax, setLocalMax] = useState(initialMax)
  const [minInput, setMinInput] = useState(String(initialMin))
  const [maxInput, setMaxInput] = useState(String(initialMax))
  const [error, setError] = useState('')

  useEffect(() => {
    const nextMin = valueMin ?? safeMin
    const nextMax = valueMax ?? safeMax
    setLocalMin(nextMin)
    setLocalMax(nextMax)
    setMinInput(String(nextMin))
    setMaxInput(String(nextMax))
    setError('')
  }, [valueMin, valueMax, safeMin, safeMax])

  const isFullRange = localMin <= safeMin && localMax >= safeMax

  const handleChange = (lo, hi) => {
    setLocalMin(lo)
    setLocalMax(hi)
    setMinInput(String(lo))
    setMaxInput(String(hi))
    setError('')
  }

  const handleReset = () => {
    handleChange(safeMin, safeMax)
  }

  const handleApply = () => {
    const parsedMin = parseInput(minInput)
    const parsedMax = parseInput(maxInput)

    if (parsedMin == null || parsedMax == null) {
      setError('Please enter a value in both fields.')
      return
    }
    if (parsedMin < safeMin || parsedMax > safeMax) {
      setError(`Values must be between ${formatKm(safeMin)} and ${formatKm(safeMax)}.`)
      return
    }
    if (parsedMin > parsedMax) {
      setError('Minimum kilometres cannot be greater than maximum.')
      return
    }

    setLocalMin(parsedMin)
    setLocalMax(parsedMax)
    setError('')
    onApply?.(parsedMin, parsedMax)
  }

  // Header follows what is typed, so it updates before Apply — same as Price.
  const headerMin = parseInput(minInput) ?? localMin
  const headerMax = parseInput(maxInput) ?? localMax

  return (
    <FilterPanelShell
      title="Kilometres"
      className={className}
      showClose={showClose}
      onClose={onClose}
      closing={closing}
      onReset={isFullRange ? undefined : handleReset}
      onApply={handleApply}
    >
      <p className="mb-5 text-sm font-semibold text-[#0F172A]">
        {formatKm(headerMin)} – {formatKm(headerMax)}
      </p>

      <DualRangeSlider
        min={safeMin}
        max={safeMax}
        valueMin={localMin}
        valueMax={localMax}
        onChange={handleChange}
        prefix=""
      />

      <div className="mt-8">
        <p className="mb-4 text-base font-bold text-[#0F172A]">Enter Kilometre Range</p>
        <div className="flex gap-3">
          <KmInput value={minInput} onChange={setMinInput} placeholder={String(safeMin)} />
          <KmInput value={maxInput} onChange={setMaxInput} placeholder={String(safeMax)} />
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </FilterPanelShell>
  )
}

export default memo(KilometresFilterPanel)
