import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { Info } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_LIBRARIES = ['places']
// Dubai, UAE — reasonable default center for this marketplace when geolocation isn't available.
const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 }

/**
 * Draggable-pin location picker for the "Additional Details" step. Self-contained:
 * stores the picked coordinates + reverse-geocoded address into its own RHF fields
 * (latitude/longitude/locationAddress) rather than trying to match a specific
 * admin-configured field by name.
 *
 * `readOnly` renders a smaller, non-draggable preview sourced from the already-saved
 * latitude/longitude (used by the review screen) instead of prompting for a fresh pick.
 */
export function LocationMapPicker({ setValue, watch, readOnly = false }) {
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

  const applyPosition = useCallback(
    (next) => {
      setPosition(next)
      setValue('latitude', next.lat, { shouldDirty: true })
      setValue('longitude', next.lng, { shouldDirty: true })

      if (!geocoderRef.current) return
      geocoderRef.current.geocode({ location: next }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const formatted = results[0].formatted_address
          setAddress(formatted)
          setValue('locationAddress', formatted, { shouldDirty: true })
        }
      })
    },
    [setValue],
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
