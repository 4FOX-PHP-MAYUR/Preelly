import { useCallback, useEffect, useState } from 'react'

function formatValue(value, prefix = '') {
  const n = Number(value) || 0
  if (n >= 1000000) return `${prefix}${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${prefix}${Math.round(n / 1000)}k`
  return `${prefix}${n.toLocaleString()}`
}

function DualRangeSlider({
  min = 0,
  max = 100000,
  valueMin,
  valueMax,
  onChange,
  prefix = 'AED ',
  step,
}) {
  const safeMin = Math.min(min, max)
  const safeMax = Math.max(min, max)
  const range = safeMax - safeMin || 1
  const resolvedStep = step ?? Math.max(1, Math.round(range / 100))

  const [localMin, setLocalMin] = useState(valueMin ?? safeMin)
  const [localMax, setLocalMax] = useState(valueMax ?? safeMax)

  useEffect(() => {
    setLocalMin(valueMin ?? safeMin)
    setLocalMax(valueMax ?? safeMax)
  }, [valueMin, valueMax, safeMin, safeMax])

  const emit = useCallback(
    (nextMin, nextMax) => {
      const lo = Math.max(safeMin, Math.min(nextMin, nextMax - resolvedStep))
      const hi = Math.min(safeMax, Math.max(nextMax, lo + resolvedStep))
      setLocalMin(lo)
      setLocalMax(hi)
      onChange?.(lo, hi)
    },
    [onChange, safeMin, safeMax, resolvedStep],
  )

  const minPercent = ((localMin - safeMin) / range) * 100
  const maxPercent = ((localMax - safeMin) / range) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{formatValue(localMin, prefix)}</span>
        <span>{formatValue(localMax, prefix)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute h-2 rounded-full bg-brand"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={resolvedStep}
          value={localMin}
          onChange={(e) => emit(Number(e.target.value), localMax)}
          className="pointer-events-none absolute inset-0 h-2 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow"
          aria-label="Minimum value"
        />
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={resolvedStep}
          value={localMax}
          onChange={(e) => emit(localMin, Number(e.target.value))}
          className="pointer-events-none absolute inset-0 h-2 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow"
          aria-label="Maximum value"
        />
      </div>
    </div>
  )
}

export default DualRangeSlider
