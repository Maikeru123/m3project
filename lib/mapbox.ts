export type Coordinates = { latitude: number; longitude: number }

type GeocodingFeature = {
  geometry?: { coordinates?: number[] }
  properties?: { full_address?: string; name?: string; place_formatted?: string }
}

export type PlaceResult = Coordinates & { label: string }

export const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export async function searchPlaces(query: string, signal: AbortSignal, permanent: boolean): Promise<PlaceResult[]> {
  if (!mapboxToken) return []
  const params = new URLSearchParams({
    q: query,
    access_token: mapboxToken,
    country: "ph",
    limit: "5",
    autocomplete: permanent ? "true" : "false",
    permanent: String(permanent),
  })
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal })
  if (!response.ok) throw new Error(permanent ? "Place search is unavailable. Check that permanent geocoding is enabled for this Mapbox account." : "Location lookup failed.")
  const payload = await response.json() as { features?: GeocodingFeature[] }
  return (payload.features ?? []).flatMap((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates ?? []
    const label = feature.properties?.full_address ?? [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(", ")
    return Number.isFinite(latitude) && Number.isFinite(longitude) && label ? [{ latitude, longitude, label }] : []
  })
}
