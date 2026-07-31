// Address autocomplete for free-text location fields.
//
// Mirrors the provider strategy LocationMapPicker already uses for reverse
// geocoding: prefer Google (when the Maps JS API is loaded and the key actually
// permits Places), otherwise fall back to OpenStreetMap's keyless Nominatim.
// Both paths return the same normalized shape so callers never branch on provider.
//
// @typedef {{ id: string, label: string, lat: number|null, lng: number|null, provider: 'google'|'osm' }} AddressSuggestion

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
export const MIN_QUERY_LENGTH = 3
const MAX_SUGGESTIONS = 6

function googlePlaces() {
  const places = window.google?.maps?.places
  return places?.AutocompleteService ? places : null
}

/** Google predictions carry no coordinates — resolve them on selection instead. */
function fetchGoogleSuggestions(query) {
  const places = googlePlaces()
  if (!places) return Promise.resolve(null)

  return new Promise((resolve) => {
    new places.AutocompleteService().getPlacePredictions({ input: query }, (predictions, status) => {
      if (status !== places.PlacesServiceStatus.OK || !predictions?.length) return resolve(null)
      resolve(
        predictions.slice(0, MAX_SUGGESTIONS).map((p) => ({
          id: p.place_id,
          label: p.description,
          lat: null,
          lng: null,
          provider: 'google',
        })),
      )
    })
  })
}

async function fetchOsmSuggestions(query, { signal } = {}) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'en',
    limit: String(MAX_SUGGESTIONS),
    q: query,
  })
  const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data
    .filter((row) => row?.display_name)
    .map((row) => ({
      id: String(row.place_id ?? `${row.lat},${row.lon}`),
      label: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
      provider: 'osm',
    }))
}

/**
 * Suggestions for a partial address. Never throws: returns [] on any failure so a
 * flaky/denied geocoder degrades to a plain text field instead of breaking the form.
 * @returns {Promise<AddressSuggestion[]>}
 */
export async function fetchAddressSuggestions(query, { signal } = {}) {
  const trimmed = String(query || '').trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  try {
    const fromGoogle = await fetchGoogleSuggestions(trimmed)
    if (fromGoogle?.length) return fromGoogle
  } catch {
    /* fall through to OSM */
  }

  try {
    return await fetchOsmSuggestions(trimmed, { signal })
  } catch {
    return []
  }
}

/**
 * Coordinates for a suggestion. OSM rows already carry them; Google place_ids need a
 * geocode lookup. Resolves to null when unavailable — callers keep the address text
 * and simply leave the map pin where it was.
 * @returns {Promise<{ lat: number, lng: number }|null>}
 */
export async function resolveSuggestionCoordinates(suggestion) {
  if (!suggestion) return null
  if (typeof suggestion.lat === 'number' && typeof suggestion.lng === 'number') {
    return { lat: suggestion.lat, lng: suggestion.lng }
  }

  const geocoderCtor = window.google?.maps?.Geocoder
  if (!geocoderCtor || !suggestion.id) return null

  return new Promise((resolve) => {
    new geocoderCtor().geocode({ placeId: suggestion.id }, (results, status) => {
      const location = status === 'OK' ? results?.[0]?.geometry?.location : null
      resolve(location ? { lat: location.lat(), lng: location.lng() } : null)
    })
  })
}
