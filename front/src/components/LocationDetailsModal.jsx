import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, MapPin, Navigation, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDialog from './ui/ModalDialog'
import ToggleSwitch from './Profile/ToggleSwitch'

const PRESET_LABELS = ['Home', 'Office', 'Home 2']

function StaticMapPreview({ lat, lng }) {
  if (!lat || !lng) return null
  const z = 15
  const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, z))
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z)
  )
  const src = `https://tile.openstreetmap.org/${z}/${tileX}/${tileY}.png`
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={src} alt="Map preview" className="h-full w-full object-cover opacity-90" crossOrigin="anonymous" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-brand shadow-lg">
          <MapPin className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  )
}

const fieldClass =
  'w-full rounded-[12px] border border-transparent bg-[#F3F6FF] px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition duration-200 focus:border-brand/30 focus:ring-2 focus:ring-brand/10'

export default function LocationDetailsModal({ onClose, onSave, initialData }) {
  const isEditing = Boolean(initialData?._id)
  const [city, setCity] = useState(initialData?.city || '')
  const [building, setBuilding] = useState(initialData?.building || '')
  const [apartment, setApartment] = useState(initialData?.apartment || '')
  const [label, setLabel] = useState(initialData?.label || 'Home')
  const [customLabel, setCustomLabel] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(
    Boolean(initialData?.label && !PRESET_LABELS.includes(initialData.label))
  )
  const [isDefault, setIsDefault] = useState(Boolean(initialData?.isDefault))
  const [coords, setCoords] = useState(
    initialData?.coordinates?.coordinates
      ? { lng: initialData.coordinates.coordinates[0], lat: initialData.coordinates.coordinates[1] }
      : null
  )
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const customInputRef = useRef(null)

  useEffect(() => {
    if (showCustomInput) customInputRef.current?.focus()
  }, [showCustomInput])

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: pos }) => {
        const { latitude: lat, longitude: lng } = pos
        setCoords({ lat, lng })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const addr = data.address || {}
          const cityVal =
            addr.city || addr.town || addr.village || addr.county || addr.state || ''
          const countryVal = addr.country ? `, ${addr.country}` : ''
          const buildingVal = addr.road
            ? `${addr.road}${addr.suburb ? `, ${addr.suburb}` : ''}${addr.city_district ? `, ${addr.city_district}` : ''}`
            : data.display_name?.split(',').slice(0, 3).join(',') || ''
          if (cityVal) setCity(`${cityVal}${countryVal}`)
          if (buildingVal) setBuilding(buildingVal)
        } catch {
          /* coordinates still set */
        }
        setLocating(false)
      },
      (err) => {
        toast.error(
          err.code === 1
            ? 'Location permission denied. Please allow location access.'
            : 'Could not determine your location.'
        )
        setLocating(false)
      },
      { timeout: 10000 }
    )
  }

  const handleSave = async () => {
    const nextErrors = {}
    if (!city.trim() && !building.trim()) nextErrors.city = 'Enter an area or building'
    const activeLabel = showCustomInput ? customLabel.trim() || 'Custom' : label || 'Home'
    if (!activeLabel) nextErrors.label = 'Choose a label'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      await onSave({
        label: activeLabel,
        city: city.trim(),
        building: building.trim(),
        apartment: apartment.trim(),
        isDefault,
        ...(coords ? { coordinates: coords } : {}),
      })
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog
      open
      onClose={onClose}
      title="Location Details"
      maxWidthClass="sm:max-w-sm"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : isEditing ? 'Update Location' : 'Add Location'}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[16px] border border-[#E5E7EB]">
          <div className="px-4 pb-1 pt-3">
            <p className="text-sm font-bold text-slate-900">Pinned location</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {coords ? 'Location pinned successfully' : 'Click on the map to select or edit your location'}
            </p>
          </div>
          <div className="relative mt-2 h-44 bg-[#E8E4D4]">
            {coords ? (
              <StaticMapPreview lat={coords.lat} lng={coords.lng} />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#EEE8C8] to-[#D9D0A8]" />
            )}
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locating}
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-brand shadow-lg transition duration-200 hover:bg-brand-50 disabled:opacity-70"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {locating ? 'Detecting…' : coords ? 'Update Map' : 'Show Map'}
            </button>
          </div>
        </div>

        <div>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Business Bay (Dubai)"
            className={fieldClass}
            aria-label="Area"
          />
          {errors.city ? <p className="mt-1 text-xs text-red-500">{errors.city}</p> : null}
        </div>
        <input
          type="text"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
          placeholder="Building name"
          className={fieldClass}
          aria-label="Building name"
        />
        <input
          type="text"
          value={apartment}
          onChange={(e) => setApartment(e.target.value)}
          placeholder="Enter Appartment or Villa Number"
          className={fieldClass}
          aria-label="Apartment or villa number"
        />

        <div>
          <p className="mb-2 text-sm font-bold text-slate-900">
            Choose how you want to label your location <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_LABELS.map((l) => {
              const active = label === l && !showCustomInput
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLabel(l)
                    setShowCustomInput(false)
                    setCustomLabel('')
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition duration-200 ${
                    active
                      ? 'border-brand bg-brand-50 text-brand'
                      : 'border-[#E5E7EB] bg-white text-slate-800 hover:border-brand/40'
                  }`}
                >
                  {l}
                </button>
              )
            })}
            {showCustomInput ? (
              <div className="flex items-center gap-1">
                <input
                  ref={customInputRef}
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = customLabel.trim()
                      if (!val) return
                      setLabel(val)
                      setShowCustomInput(false)
                    }
                  }}
                  placeholder="Custom label"
                  className="w-28 rounded-full border border-brand/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/15"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = customLabel.trim()
                    if (!val) return
                    setLabel(val)
                    setShowCustomInput(false)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"
                  aria-label="Confirm custom label"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(true)
                  setLabel('')
                }}
                className="flex items-center gap-1 rounded-full border border-dashed border-brand px-3 py-1.5 text-sm font-medium text-brand transition duration-200 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
                Add Custom Label
              </button>
            )}
          </div>
          {errors.label ? <p className="mt-1 text-xs text-red-500">{errors.label}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <ToggleSwitch checked={isDefault} onChange={setIsDefault} label="Set as default" />
          <span className="text-sm font-medium text-slate-800">Set as default</span>
        </div>
      </div>
    </ModalDialog>
  )
}
