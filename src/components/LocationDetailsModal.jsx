import { useState, useEffect, useRef } from 'react'
import { X, MapPin, Loader2, Navigation, Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const PRESET_LABELS = ['Home', 'Office', 'Home 2']

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function StaticMapPreview({ lat, lng }) {
  if (!lat || !lng) return null
  // Tile-based static map using OpenStreetMap
  const z = 15
  const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, z))
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z)
  )
  const src = `https://tile.openstreetmap.org/${z}/${tileX}/${tileY}.png`
  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={src}
        alt="Map preview"
        className="w-full h-full object-cover opacity-80"
        crossOrigin="anonymous"
      />
      {/* Pin marker centered */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 rounded-full bg-indigo-600 border-4 border-white shadow-lg flex items-center justify-center">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="w-0.5 h-3 bg-indigo-600 mt-0.5" />
        </div>
      </div>
    </div>
  )
}

export default function LocationDetailsModal({ onClose, onSave, initialData }) {
  const isEditing = Boolean(initialData?._id)

  const [city, setCity] = useState(initialData?.city || '')
  const [building, setBuilding] = useState(initialData?.building || '')
  const [apartment, setApartment] = useState(initialData?.apartment || '')
  const [label, setLabel] = useState(initialData?.label || 'Home')
  const [customLabel, setCustomLabel] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(
    initialData?.label && !PRESET_LABELS.includes(initialData.label)
  )
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false)
  const [coords, setCoords] = useState(
    initialData?.coordinates?.coordinates
      ? { lng: initialData.coordinates.coordinates[0], lat: initialData.coordinates.coordinates[1] }
      : null
  )
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const customInputRef = useRef(null)

  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus()
    }
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
          const buildingVal =
            addr.road
              ? `${addr.road}${addr.suburb ? `, ${addr.suburb}` : ''}${addr.city_district ? `, ${addr.city_district}` : ''}`
              : data.display_name?.split(',').slice(0, 3).join(',') || ''
          if (cityVal && !city) setCity(`${cityVal}${countryVal}`)
          if (buildingVal && !building) setBuilding(buildingVal)
        } catch {
          // ignore geocoding failure — coordinates are still set
        }
        setLocating(false)
      },
      (err) => {
        const msg =
          err.code === 1
            ? 'Location permission denied. Please allow location access.'
            : 'Could not determine your location.'
        toast.error(msg)
        setLocating(false)
      },
      { timeout: 10000 }
    )
  }

  const handleLabelSelect = (l) => {
    setLabel(l)
    setShowCustomInput(false)
    setCustomLabel('')
  }

  const handleAddCustomLabel = () => {
    setShowCustomInput(true)
    setLabel('')
  }

  const handleCustomLabelConfirm = () => {
    const val = customLabel.trim()
    if (!val) return
    setLabel(val)
    setShowCustomInput(false)
  }

  const handleSave = async () => {
    if (!city.trim() && !building.trim()) {
      toast.error('Please enter at least a city or address')
      return
    }
    const activeLabel = showCustomInput ? customLabel.trim() || 'Custom' : label || 'Home'
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
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Location Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Map preview section */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-bold text-gray-800">Pinned location</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {coords ? 'Location pinned successfully' : 'Click on the map to select or edit your location'}
              </p>
            </div>
            {/* Map area */}
            <div className="relative h-44 bg-[#e8e0c8] mt-2">
              {coords ? (
                <StaticMapPreview lat={coords.lat} lng={coords.lng} />
              ) : (
                /* Placeholder map background */
                <div className="absolute inset-0 bg-gradient-to-br from-[#eee8c8] to-[#d9d0a8]">
                  {/* Fake road lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 400 180">
                    <path d="M0 90 Q100 60 200 90 T400 90" stroke="#bba" strokeWidth="8" fill="none" />
                    <path d="M0 120 Q150 100 300 130 T400 110" stroke="#bba" strokeWidth="5" fill="none" />
                    <path d="M120 0 L100 180" stroke="#bba" strokeWidth="6" fill="none" />
                    <path d="M280 0 Q290 90 270 180" stroke="#bba" strokeWidth="4" fill="none" />
                  </svg>
                </div>
              )}
              {/* Show Map / Detect button overlay */}
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locating}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-white rounded-full px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <Navigation className="h-3 w-3 text-white" />
                  </div>
                )}
                {locating ? 'Detecting…' : coords ? 'Re-detect Location' : 'Show Map'}
              </button>
            </div>
          </div>

          {/* Address fields */}
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City / Area (e.g. Business Bay, Dubai)"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />
          <input
            type="text"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Building / Street name"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="Enter Appartment or Villa Number"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />

          {/* Label selector */}
          <div>
            <p className="text-sm font-bold text-gray-900 mb-2">
              Choose how you want to label<br />your location{' '}
              <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleLabelSelect(l)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                    label === l && !showCustomInput
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {l}
                </button>
              ))}
              {/* Custom label input or button */}
              {showCustomInput ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={customInputRef}
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomLabelConfirm()}
                    placeholder="Custom label"
                    className="w-28 rounded-full border border-indigo-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleCustomLabelConfirm}
                    className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCustomLabel}
                  className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Label
                </button>
              )}
            </div>
          </div>

          {/* Set as default */}
          <div className="flex items-center gap-3">
            <Toggle checked={isDefault} onChange={setIsDefault} />
            <span className="text-sm font-medium text-gray-700">Set as default</span>
          </div>
        </div>

        {/* Footer button */}
        <div className="px-5 pb-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-60 transition shadow-md"
          >
            {saving ? 'Saving…' : isEditing ? 'Update Location' : 'Add Location'}
          </button>
        </div>
      </div>
    </div>
  )
}
