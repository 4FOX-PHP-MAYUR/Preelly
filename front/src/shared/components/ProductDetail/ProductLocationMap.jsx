import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { ExternalLink, MapPin } from 'lucide-react'
import { buildLocationAddress } from './detailHelpers'
import DetailCard from './DetailCard'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_LIBRARIES = ['places']
const MAP_CONTAINER_STYLE = { width: '100%', height: '220px', borderRadius: '0.75rem' }

function ProductLocationMap({ product }) {
  const { isLoaded } = useJsApiLoader({
    id: 'preelly-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })

  const lat = typeof product?.latitude === 'number' ? product.latitude : null
  const lng = typeof product?.longitude === 'number' ? product.longitude : null
  const hasPosition = lat !== null && lng !== null
  const address = buildLocationAddress(product)

  if (!address && !hasPosition) return null

  const mapsUrl =
    hasPosition
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null

  return (
    <DetailCard
      title="Location"
      headerAction={
        mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-700`}
          >
            Open Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null
      }
    >
      {address && <p className="mb-3 text-sm text-slate-600">{address}</p>}

      {GOOGLE_MAPS_API_KEY && hasPosition ? (
        isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={{ lat, lng }}
            zoom={15}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              zoomControl: true,
              draggable: false,
              keyboardShortcuts: false,
            }}
          >
            <MarkerF position={{ lat, lng }} />
          </GoogleMap>
        ) : (
          <div className="animate-pulse rounded-xl bg-slate-100" style={{ height: 240 }} />
        )
      ) : address ? (
        <div className="flex h-[180px] items-center justify-center rounded-xl bg-slate-100">
          <div className="text-center text-slate-400">
            <MapPin className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm">{address}</p>
          </div>
        </div>
      ) : null}
    </DetailCard>
  )
}

export default ProductLocationMap
