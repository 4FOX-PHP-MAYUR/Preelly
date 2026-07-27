import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { Info } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_LIBRARIES = ['places']
// Dubai, UAE — reasonable default center for this marketplace when geolocation isn't available.
const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 }

// Build a "Building & Street Name" line from Google's structured address components.
function streetLineFromGoogleComponents(components = []) {
  const pick = (type) => components.find((c) => c.types?.includes(type))?.long_name
  const building = pick('premise') || pick('subpremise')
  const streetLine = [pick('street_number'), pick('route')].filter(Boolean).join(' ')
  return [building, streetLine].filter(Boolean).join(', ') || null
}

// Same, from OpenStreetMap Nominatim's `address` object (fallback provider).
function streetLineFromNominatim(addr = {}) {
  const building = addr.building || addr.house_name
  const streetLine = [addr.house_number, addr.road || addr.pedestrian || addr.footway].filter(Boolean).join(' ')
  return [building, streetLine].filter(Boolean).join(', ') || null
}

/**
 * Draggable-pin location picker for the "Additional Details" step. Self-contained:
 * stores the picked coordinates + reverse-geocoded address into its own RHF fields
 * (latitude/longitude/locationAddress) rather than trying to match a specific
 * admin-configured field by name.
 *
 * `readOnly` renders a smaller, non-draggable preview sourced from the already-saved
 * latitude/longitude (used by the review screen) instead of prompting for a fresh pick.
 */
export function LocationMapPicker({ setValue, watch, onAddressChange, readOnly = false }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'preelly-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })

  const geocoderRef = useRef(null)
  const savedLat = watch ? watch('latitude') : null
  const savedLng = watch ? watch('longitude') : null
  const hasSavedPosition = typeof savedLat === 'number' && typeof savedLng === 'number'
  const [position, setPosition] = useState(
    readOnly && hasSavedPosition ? { lat: savedLat, lng: savedLng } : DEFAULT_CENTER,
  )
  const [address, setAddress] = useState(readOnly ? watch?.('locationAddress') || '' : '')

  useEffect(() => {
    if (readOnly || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000 },
    )
  }, [readOnly])

  // Reverse geocode via Google; if that fails (e.g. the Geocoding API isn't
  // enabled on the key), fall back to OpenStreetMap's free Nominatim service.
  const geocodeGoogle = useCallback(
    (next) =>
      new Promise((resolve) => {
        if (!geocoderRef.current) return resolve(null)
        geocoderRef.current.geocode({ location: next }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            resolve({
              formatted: results[0].formatted_address,
              street: streetLineFromGoogleComponents(results[0].address_components),
            })
          } else {
            resolve(null)
          }
        })
      }),
    [],
  )

  const applyPosition = useCallback(
    async (next) => {
      setPosition(next)
      setValue('latitude', next.lat, { shouldDirty: true })
      setValue('longitude', next.lng, { shouldDirty: true })

      let formatted = null
      let street = null
      const g = await geocodeGoogle(next)
      if (g?.formatted) {
        formatted = g.formatted
        street = g.street
      }
      if (!formatted) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${next.lat}&lon=${next.lng}`,
            { headers: { Accept: 'application/json' } },
          )
          const data = await res.json()
          if (data?.display_name) {
            formatted = data.display_name
            street = streetLineFromNominatim(data.address)
          }
        } catch {
          /* ignore — leave address unset */
        }
      }

      if (formatted) {
        setAddress(formatted)
        setValue('locationAddress', formatted, { shouldDirty: true })
        // Fill the visible location textboxes (dynamic form fields) from the pin.
        onAddressChange?.({ formatted, street })
      }
    },
    [setValue, geocodeGoogle, onAddressChange],
  )

  const onMapLoad = useCallback(() => {
    geocoderRef.current = new window.google.maps.Geocoder()
    if (!readOnly) {
      // Resolve an initial address for wherever the pin starts.
      applyPosition(position)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full">
        <p className="text-sm text-yellow-800">
          Map picker unavailable: set VITE_GOOGLE_MAPS_API_KEY in front/.env to enable it.
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full">
        <p className="text-sm text-yellow-800">Failed to load Google Maps.</p>
      </div>
    )
  }

  const mapHeight = readOnly ? 160 : 260
  const mapContainerStyle = { width: '100%', height: `${mapHeight}px`, borderRadius: '0.75rem' }

  if (readOnly && !hasSavedPosition) {
    return (
      <div className="w-full h-[160px] rounded-xl bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-400">No location picked yet.</p>
      </div>
    )
  }

  return (
    <div className={readOnly ? 'w-full' : 'w-full rounded-xl border border-gray-200 p-4'}>
      {!readOnly && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Is the pin in the right location?</p>
            <p className="text-xs text-gray-600 mt-1">
              Click and drag the pin to the exact spot. Users are more likely to respond to ads that are correctly
              shown on the map.
            </p>
          </div>
          <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        </div>
      )}

      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={position}
          zoom={15}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: !readOnly,
            draggable: !readOnly,
            keyboardShortcuts: !readOnly,
          }}
        >
          <MarkerF
            position={position}
            draggable={!readOnly}
            onDragEnd={readOnly ? undefined : (e) => applyPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
        </GoogleMap>
      ) : (
        <div className="rounded-xl bg-gray-100 animate-pulse" style={{ height: mapHeight }} />
      )}

      {!readOnly && address && <p className="text-xs text-gray-500 mt-2">{address}</p>}
    </div>
  )
}
