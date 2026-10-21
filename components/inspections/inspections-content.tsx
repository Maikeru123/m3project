"use client"

/* eslint-disable @next/next/no-img-element */

import { Camera, ClipboardCheck, MapPin, Plus, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { InspectionDialog } from "@/components/inspections/inspection-dialog"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { fetchBuildings } from "@/lib/supabase/buildings"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatInspectionDate, type Asset } from "@/lib/types/asset"
import { PHOTO_VIEWS, type Inspection, type InspectionPhoto } from "@/lib/types/inspection"

export function InspectionsContent() {
  const [buildings, setBuildings] = useState<Asset[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [photos, setPhotos] = useState<InspectionPhoto[]>([])
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Inspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const client = createSupabaseBrowserClient()
    if (!client) { setError("Supabase is not configured."); setLoading(false); return }
    const [buildingResult, inspectionResult, photoResult] = await Promise.all([
      fetchBuildings(),
      client.from("inspections").select("id,building_id,condition,condition_as_printed,visit_date,inspector_name,remarks,entry_notes,created_at"),
      client.from("inspection_photos").select("id,inspection_id,view_key,storage_path,latitude,longitude"),
    ])
    const nextError = buildingResult.error ?? inspectionResult.error?.message ?? photoResult.error?.message ?? null
    if (nextError) setError(nextError)
    else {
      setError(null)
      setBuildings(buildingResult.data)
      setInspections((inspectionResult.data ?? []) as Inspection[])
      setPhotos((photoResult.data ?? []) as InspectionPhoto[])
    }
    setLoading(false)
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const buildingNames = useMemo(() => new Map(buildings.map((building) => [building.building_id, building.building_name])), [buildings])
  const filtered = useMemo(() => inspections.filter((inspection) => `${inspection.building_id} ${buildingNames.get(inspection.building_id) ?? ""} ${inspection.inspector_name} ${inspection.condition}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (b.visit_date ?? b.created_at.slice(0, 10)).localeCompare(a.visit_date ?? a.created_at.slice(0, 10)) || b.created_at.localeCompare(a.created_at)), [inspections, buildingNames, search])

  return <AppShell title="Inspections">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Building history</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Site inspections</h2><p className="mt-1 text-sm text-muted-foreground">Record each visit against a registered building.</p></div><Button onClick={() => setAdding(true)}><Plus />New inspection</Button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary label="Buildings" value={buildings.length} /><Summary label="Recorded visits" value={inspections.length} /><Summary label="Buildings inspected" value={new Set(inspections.map((inspection) => inspection.building_id)).size} /></div>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold">Visit history</h3><p className="text-xs text-muted-foreground">Newest visits first</p></div><label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search inspections</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-9" placeholder="Building, inspector, condition" /></label></div>
      {error ? <p role="alert" className="p-5 text-sm text-destructive">{error}</p> : loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded bg-muted" />)}</div> : filtered.length === 0 ? <div className="grid min-h-52 place-items-center p-8 text-center"><div><ClipboardCheck className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">{search ? "No matching visits" : "No inspections yet"}</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try another search." : "Select New inspection to record the first visit."}</p></div></div> : <div className="divide-y">{filtered.map((inspection) => <button key={inspection.id} onClick={() => setSelected(inspection)} className="flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{buildingNames.get(inspection.building_id) ?? inspection.building_id}</span><span className="mt-0.5 block text-xs text-muted-foreground">{inspection.building_id} · {inspection.inspector_name} · {inspection.visit_date ? formatInspectionDate(inspection.visit_date) : "Date not recorded"}</span></span><span className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{photos.filter((photo) => photo.inspection_id === inspection.id).length} photos</span><ConditionBadge condition={inspection.condition} /></span></button>)}</div>}
    </section>
    {adding && <InspectionDialog buildings={buildings} onClose={() => setAdding(false)} onSaved={load} />}
    {selected && <InspectionDetails inspection={selected} buildingName={buildingNames.get(selected.building_id) ?? selected.building_id} photos={photos.filter((photo) => photo.inspection_id === selected.id)} onClose={() => setSelected(null)} />}
  </AppShell>
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div> }

function InspectionDetails({ inspection, buildingName, photos, onClose }: { inspection: Inspection; buildingName: string; photos: InspectionPhoto[]; onClose: () => void }) {
  const client = createSupabaseBrowserClient()
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Inspection details"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-background p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-primary uppercase">Inspection record</p><h2 className="mt-1 text-xl font-bold">{buildingName}</h2><p className="text-xs text-muted-foreground">{inspection.building_id}</p></div><Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button></div><dl className="grid gap-4 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2"><Info label="Condition" value={inspection.condition} /><Info label="Visit date" value={inspection.visit_date ? formatInspectionDate(inspection.visit_date) : "Date not recorded"} /><Info label="Inspector" value={inspection.inspector_name} /><Info label="Original wording" value={inspection.condition_as_printed || "—"} /></dl><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Remarks" value={inspection.remarks || "—"} /><Info label="Entry notes" value={inspection.entry_notes || "—"} /></div><h3 className="mt-6 mb-3 font-semibold">Photographs</h3><div className="grid gap-3 sm:grid-cols-2">{PHOTO_VIEWS.map((view) => { const photo = photos.find((item) => item.view_key === view); const url = photo && client ? client.storage.from("inspection-photos").getPublicUrl(photo.storage_path).data.publicUrl : null; return <div key={view} className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase"><span>{view} view</span>{photo && <Camera className="size-4 text-muted-foreground" />}</div>{url ? <><img src={url} alt={`${view} view of ${buildingName}`} className="aspect-video w-full object-cover" />{photo?.latitude != null && <p className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground"><MapPin className="size-3" />{photo.latitude}, {photo.longitude}</p>}</> : <div className="grid aspect-video place-items-center text-xs text-muted-foreground">No photo</div>}</div> })}</div></div></div>
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd></div> }
