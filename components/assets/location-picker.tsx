"use client"

import { useEffect, useRef, useState } from "react"
import type * as Leaflet from "leaflet"
import type { Coordinates } from "@/lib/types/coordinates"

export function LocationPicker({ value, onChange, coordinates, onCoordinatesChange }: {
  value: string
  onChange: (value: string) => void
  coordinates: Coordinates | null
  onCoordinatesChange: (value: Coordinates | null) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const pin = useRef<Leaflet.CircleMarker | null>(null)
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const callback = useRef(onCoordinatesChange)

  useEffect(() => { callback.current = onCoordinatesChange }, [onCoordinatesChange])

  useEffect(() => {
    if (!container.current) return
    let active = true
    import("leaflet").then((L) => {
      if (!active || !container.current) return
      const instance = L.map(container.current).setView(
        coordinates ? [coordinates.latitude, coordinates.longitude] : [12.5, 122.5],
        coordinates ? 14 : 5,
      )
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(instance)
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
        const selected = { latitude: Number(event.latlng.lat.toFixed(6)), longitude: Number(event.latlng.lng.toFixed(6)) }
        callback.current(selected)
      })
      map.current = instance
      setLeaflet(L)
      window.setTimeout(() => instance.invalidateSize(), 0)
    }).catch(() => { if (active) setMapError("The location map could not load. Enter coordinates below.") })
    return () => { active = false; map.current?.remove(); map.current = null; pin.current = null }
    // The map is created once; coordinate changes update its pin in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map.current || !leaflet) return
    pin.current?.remove()
    pin.current = null
    if (!coordinates) return
    pin.current = leaflet.circleMarker([coordinates.latitude, coordinates.longitude], {
      radius: 8, color: "#fff", weight: 3, fillColor: "#b4232c", fillOpacity: 1,
    }).addTo(map.current)
    map.current.setView([coordinates.latitude, coordinates.longitude], Math.max(map.current.getZoom(), 12))
  }, [leaflet, coordinates])

  return <div className="space-y-2">
    <input className="field" aria-label="Location" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Barangay, city / municipality" />
    <div ref={container} className="relative z-0 h-56 overflow-hidden rounded-md border bg-muted" aria-label="Click map to place building pin" />
    {mapError && <p className="text-xs text-destructive">{mapError}</p>}
    <p className="text-xs text-muted-foreground">Click the map to place a pin, or enter latitude and longitude in Geotagged location below.</p>
  </div>
}
