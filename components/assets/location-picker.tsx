"use client"

import { MapPin, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { mapboxToken, searchPlaces, type Coordinates, type PlaceResult } from "@/lib/mapbox"

export function LocationPicker({ value, onChange, coordinates, onCoordinatesChange, showCoordinates = true }: {
  value: string
  onChange: (value: string) => void
  coordinates: Coordinates | null
  onCoordinatesChange: (value: Coordinates | null) => void
  showCoordinates?: boolean
}) {
  const [results, setResults] = useState<PlaceResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(true)
  const [latitudeText, setLatitudeText] = useState(coordinates?.latitude?.toString() ?? "")
  const [longitudeText, setLongitudeText] = useState(coordinates?.longitude?.toString() ?? "")

  useEffect(() => {
    if (selected || value.trim().length < 3 || !mapboxToken) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setResults(await searchPlaces(value.trim(), controller.signal, true))
        setError(null)
      } catch (cause) {
        if (!controller.signal.aborted) { setResults([]); setError(cause instanceof Error ? cause.message : "Place search failed.") }
      }
    }, 450)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [value, selected])

  const updateCoordinate = (axis: keyof Coordinates, text: string) => {
    const latitude = axis === "latitude" ? text : latitudeText
    const longitude = axis === "longitude" ? text : longitudeText
    if (axis === "latitude") setLatitudeText(text)
    else setLongitudeText(text)
    const lat = Number(latitude)
    const lon = Number(longitude)
    onCoordinatesChange(latitude.trim() && longitude.trim() && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : null)
  }

  return <div className="space-y-2">
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input className="field pl-9" aria-label="Location" value={value} onChange={(event) => { onChange(event.target.value); onCoordinatesChange(null); setLatitudeText(""); setLongitudeText(""); setSelected(false); setResults([]) }} placeholder="Search a place or type an address" autoComplete="off" />
    </div>
    {results.length > 0 && <div className="max-h-44 overflow-y-auto rounded-md border bg-background shadow-sm" role="listbox" aria-label="Place suggestions">
      {results.map((result) => <button type="button" key={`${result.longitude}-${result.latitude}-${result.label}`} className="flex w-full items-start gap-2 border-b px-3 py-2 text-left text-xs last:border-0 hover:bg-muted" onClick={() => { onChange(result.label); onCoordinatesChange({ latitude: result.latitude, longitude: result.longitude }); setLatitudeText(String(result.latitude)); setLongitudeText(String(result.longitude)); setSelected(true); setResults([]); setError(null) }}><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />{result.label}</button>)}
    </div>}
    {error && <p className="text-xs text-destructive">{error} You can enter coordinates manually.</p>}
    {!mapboxToken && <p className="text-xs text-muted-foreground">Add a Mapbox public token to enable place search.</p>}
    {showCoordinates && <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-muted-foreground">Latitude<input type="number" min="-90" max="90" step="any" className="field mt-1" value={latitudeText} onChange={(event) => updateCoordinate("latitude", event.target.value)} placeholder="e.g. 7.0731" /></label>
      <label className="text-xs text-muted-foreground">Longitude<input type="number" min="-180" max="180" step="any" className="field mt-1" value={longitudeText} onChange={(event) => updateCoordinate("longitude", event.target.value)} placeholder="e.g. 125.6128" /></label>
    </div>}
    {showCoordinates && <p className="text-xs text-muted-foreground">Choose a search result to place the pin, or type both coordinates manually.</p>}
  </div>
}
