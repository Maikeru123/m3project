"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type * as Leaflet from "leaflet"
import { CONDITION_COLORS, DISPLAY_CONDITIONS, type Asset } from "@/lib/types/asset"
import type { Coordinates } from "@/lib/types/coordinates"

type MappedAsset = { asset: Asset; coordinates: Coordinates }

export function AssetMap({ assets, loading }: { assets: Asset[]; loading: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const markers = useRef<Leaflet.LayerGroup | null>(null)
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const mapped = useMemo(() => assets.flatMap((asset): MappedAsset[] => {
    const latitude = Number(asset.latitude)
    const longitude = Number(asset.longitude)
    return asset.latitude !== null && asset.longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ asset, coordinates: { latitude, longitude } }]
      : []
  }), [assets])
  const lookupCount = assets.length - mapped.length

  useEffect(() => {
    if (!container.current) return
    let active = true
    import("leaflet").then((L) => {
      if (!active || !container.current) return
      const instance = L.map(container.current).setView([12.5, 122.5], 5)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(instance)
      markers.current = L.layerGroup().addTo(instance)
      map.current = instance
      setLeaflet(L)
    }).catch(() => { if (active) setMapError("The map could not load in this browser.") })
    return () => { active = false; map.current?.remove(); map.current = null; markers.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !leaflet || !markers.current) return
    markers.current.clearLayers()
    mapped.forEach(({ asset, coordinates }) => {
      const dot = document.createElement("div")
      dot.className = "asset-map-marker"
      dot.style.backgroundColor = CONDITION_COLORS[asset.condition]
      const popup = document.createElement("div")
      const name = document.createElement("strong")
      name.textContent = asset.building_name
      const description = document.createElement("p")
      description.textContent = `${asset.condition} · ${asset.location ?? "Location not provided"}`
      popup.append(name, description)
      leaflet.marker([coordinates.latitude, coordinates.longitude], {
        icon: leaflet.divIcon({ html: dot, className: "asset-map-icon", iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: `${asset.building_name}: ${asset.condition}`,
      }).bindPopup(popup).addTo(markers.current!)
    })
    if (mapped.length === 1) map.current.setView([mapped[0].coordinates.latitude, mapped[0].coordinates.longitude], 12)
    else if (mapped.length > 1) map.current.fitBounds(mapped.map(({ coordinates }) => [coordinates.latitude, coordinates.longitude]), { padding: [55, 55], maxZoom: 12 })
  }, [leaflet, mapped])

  return <article className="soft-shadow min-w-0 rounded-xl border bg-card p-5">
    <div className="mb-3"><h3 className="font-semibold">Building map</h3><p className="mt-1 text-xs text-muted-foreground">Pins show each building&apos;s latest inspection status</p></div>
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      <div ref={container} className="h-[380px] w-full sm:h-[440px]" aria-label="Map of buildings" />
      {!loading && mapped.length === 0 && assets.length > 0 && <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] rounded-md bg-background/95 p-3 text-sm shadow sm:right-auto">No pins yet. Edit a building and place its pin on the map or enter coordinates.</div>}
      {mapError && <div className="absolute bottom-3 left-3 right-3 z-[500] rounded-md bg-background p-3 text-sm text-destructive shadow">{mapError}</div>}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Map condition legend">
      {DISPLAY_CONDITIONS.map((condition) => <span key={condition} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[condition] }} />{condition}</span>)}
    </div>
    {!loading && <p className="mt-2 text-xs text-muted-foreground">{mapped.length} of {assets.length} buildings mapped{lookupCount > 0 ? ` · ${lookupCount} need coordinates; edit these buildings to place their pins` : ""}</p>}
  </article>
}
