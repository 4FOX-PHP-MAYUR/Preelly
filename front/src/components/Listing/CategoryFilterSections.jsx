import { Search } from 'lucide-react'
import DualRangeSlider from './DualRangeSlider'
import { PanelSection, ChipRow } from '@shared/components/FilterPanelSection'

/**
 * Filter sections extracted verbatim from `AdvancedFilterPanel` so the listing
 * page's filter sidebar and the hierarchical search page (/search) render the
 * exact same fields, in the exact same order, from one source of JSX instead
 * of two copies drifting apart.
 */

const CONDITION_OPTIONS = [
  { value: 'Brand New', label: 'Brand New' },
  { value: 'Like New', label: 'Like New' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
]

const TRANSMISSION_OPTIONS = [
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'Semi-Automatic', label: 'Semi-Automatic' },
  { value: 'CVT', label: 'CVT' },
  { value: 'Dual Clutch', label: 'Dual Clutch' },
]

const FUEL_OPTIONS = [
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'LPG', label: 'LPG' },
  { value: 'CNG', label: 'CNG' },
]

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5+']

export function CityFilterSection({ cityId = '', cities = [], citiesLoading = false, citiesError = '', onCityChange }) {
  if (citiesLoading) {
    return (
      <PanelSection title="City">
        <p className="text-sm text-[#64748B]">Loading cities…</p>
      </PanelSection>
    )
  }

  if (citiesError) {
    return (
      <PanelSection title="City">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {citiesError}
        </p>
      </PanelSection>
    )
  }

  if (!cities.length) return null

  return (
    <PanelSection title="City">
      <ChipRow options={cities} value={cityId} onChange={onCityChange} anyLabel="All Cities" />
    </PanelSection>
  )
}

export function VehiclePropertyFilterSections({
  showVehicleExtras = false,
  isPropertyCategory = false,
  isClassifiedsCategory = false,
  keywords = '',
  onKeywordsChange,
  makeModel = '',
  onMakeModelChange,
  trim = '',
  onTrimChange,
  trimOptions = [],
  priceRange,
  priceMin,
  priceMax,
  onPriceRangeChange,
  kmsRange,
  kmsMin,
  kmsMax,
  onKmsRangeChange,
  condition = '',
  onConditionChange,
  transmission = '',
  onTransmissionChange,
  fuelType = '',
  onFuelTypeChange,
  bedrooms = '',
  onBedroomsChange,
}) {
  return (
    <>
      {/* Search */}
      <PanelSection title="Search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={keywords}
            onChange={(e) => onKeywordsChange?.(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-[#E4E7EF] bg-white py-2.5 pl-10 pr-4 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
      </PanelSection>

      {/* Make & Model */}
      {showVehicleExtras ? (
        <PanelSection title="Make & Model">
          <input
            type="search"
            value={makeModel}
            onChange={(e) => onMakeModelChange?.(e.target.value)}
            placeholder="Search eg: Toyota Land Cruiser 70"
            className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3.5 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </PanelSection>
      ) : null}

      {/* Trim */}
      {showVehicleExtras ? (
        <PanelSection title="Trim">
          <select
            value={trim}
            onChange={(e) => onTrimChange?.(e.target.value)}
            className="w-full rounded-xl border border-[#E4E7EF] bg-white px-3.5 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            <option value="">Select Trim</option>
            {(trimOptions || []).map((opt) => {
              const v = typeof opt === 'string' ? opt : opt.value
              const label = typeof opt === 'string' ? opt : opt.label
              return (
                <option key={String(v)} value={v}>
                  {label}
                </option>
              )
            })}
          </select>
        </PanelSection>
      ) : null}

      {/* Price Range */}
      <PanelSection title="Price Range">
        <DualRangeSlider
          min={priceRange?.min ?? 0}
          max={priceRange?.max ?? 100000}
          valueMin={priceMin}
          valueMax={priceMax}
          onChange={onPriceRangeChange}
        />
      </PanelSection>

      {/* Kilometres */}
      {showVehicleExtras && kmsRange ? (
        <PanelSection title="Kilometres">
          <DualRangeSlider
            min={kmsRange?.min ?? 0}
            max={kmsRange?.max ?? 500000}
            valueMin={kmsMin}
            valueMax={kmsMax}
            onChange={onKmsRangeChange}
            prefix=""
          />
        </PanelSection>
      ) : null}

      {/* Vehicle chip filters */}
      {showVehicleExtras ? (
        <>
          <PanelSection title="Transmission Type">
            <ChipRow options={TRANSMISSION_OPTIONS} value={transmission} onChange={onTransmissionChange} />
          </PanelSection>
          <PanelSection title="Fuel Type">
            <ChipRow options={FUEL_OPTIONS} value={fuelType} onChange={onFuelTypeChange} />
          </PanelSection>
          <PanelSection title="Condition">
            <ChipRow options={CONDITION_OPTIONS} value={condition} onChange={onConditionChange} />
          </PanelSection>
        </>
      ) : null}

      {/* Bedrooms (property / classifieds) */}
      {isPropertyCategory || isClassifiedsCategory ? (
        <PanelSection title="Number of Bedrooms">
          <ChipRow
            options={BEDROOM_OPTIONS.map((b) => ({ value: b, label: b }))}
            value={bedrooms}
            onChange={onBedroomsChange}
          />
        </PanelSection>
      ) : null}
    </>
  )
}
