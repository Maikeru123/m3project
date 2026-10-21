"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type mapboxgl from "mapbox-gl"
import { CONDITION_COLORS, DISPLAY_CONDITIONS, type Asset } from "@/lib/types/asset"
import { mapboxToken, type Coordinates } from "@/lib/mapbox"

type MappedAsset = { asset: Asset; coordinates: Coordinates }

export function AssetMap({ assets, loading }: { assets: Asset[]; loading: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const [mapbox, setMapbox] = useState<typeof mapboxgl | null>(null)
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
    if (!mapboxToken || !container.current) return
    let active = true
    import("mapbox-gl").then(({ default: gl }) => {
      if (!active || !container.current) return
      const instance = new gl.Map({
        container: container.current,
        accessToken: mapboxToken,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [122.5, 12.5],
        zoom: 4.8,
      })
      instance.addControl(new gl.NavigationControl({ showCompass: false }), "top-right")
      instance.on("error", () => setMapError("The map could not load. Check the Mapbox token and its allowed URLs."))
      map.current = instance
      setMapbox(gl)
    }).catch(() => setMapError("The map could not load in this browser."))
    return () => { active = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !mapbox) return
    markers.current.forEach((marker) => marker.remove())
    markers.current = mapped.map(({ asset, coordinates }) => {
      const dot = document.createElement("div")
      dot.className = "asset-map-marker"
      dot.style.backgroundColor = CONDITION_COLORS[asset.condition]
      dot.setAttribute("aria-label", `${asset.building_name}: ${asset.condition}`)
      const popup = document.createElement("div")
      const name = document.createElement("strong")
      name.textContent = asset.building_name
      const description = document.createElement("p")
      description.textContent = `${asset.condition} · ${asset.location ?? "Location not provided"}`
      popup.append(name, description)
      return new mapbox.Marker({ element: dot })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .setPopup(new mapbox.Popup({ offset: 16 }).setDOMContent(popup))
        .addTo(map.current!)
    })
    if (mapped.length === 1) map.current.flyTo({ center: [mapped[0].coordinates.longitude, mapped[0].coordinates.latitude], zoom: 12 })
    else if (mapped.length > 1) {
      const bounds = new mapbox.LngLatBounds()
      mapped.forEach(({ coordinates }) => bounds.extend([coordinates.longitude, coordinates.latitude]))
      map.current.fitBounds(bounds, { padding: 55, maxZoom: 12, duration: 0 })
    }
  }, [mapbox, mapped])

  return <article className="soft-shadow min-w-0 rounded-xl border bg-card p-5">
    <div className="mb-3"><h3 className="font-semibold">Building map</h3><p className="mt-1 text-xs text-muted-foreground">Pins show each building&apos;s latest inspection status</p></div>
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      <div ref={container} className="h-[380px] w-full sm:h-[440px]" aria-label="Map of buildings" />
      {mapboxToken && !loading && mapped.length === 0 && assets.length > 0 && <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-md bg-background/95 p-3 text-sm shadow sm:right-auto">No pins yet. Edit an asset and choose a place or enter its coordinates.</div>}
      {!mapboxToken && <div className="absolute inset-0 grid place-items-center bg-muted/95 p-6 text-center text-sm text-muted-foreground">Add NEXT_PUBLIC_MAPBOX_TOKEN to show the asset map.</div>}
      {mapError && <div className="absolute bottom-3 left-3 right-3 rounded-md bg-background p-3 text-sm text-destructive shadow">{mapError}</div>}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Map condition legend">
      {DISPLAY_CONDITIONS.map((condition) => <span key={condition} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[condition] }} />{condition}</span>)}
    </div>
    {!loading && <p className="mt-2 text-xs text-muted-foreground">{mapped.length} of {assets.length} buildings mapped{lookupCount > 0 ? ` · ${lookupCount} need coordinates; edit these buildings to place their pins` : ""}</p>}
  </article>
}
