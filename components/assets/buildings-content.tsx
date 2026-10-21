"use client"

import { Building2, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AssetEditDialog, AssetRegistrationDialog } from "@/components/assets/building-registration-dialog"
import { BuildingDetailsDialog } from "@/components/assets/building-details-dialog"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { AppShell } from "@/components/layout/app-shell"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { fetchBuildings } from "@/lib/supabase/buildings"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { DISPLAY_CONDITIONS, type Asset, type BuildingCondition } from "@/lib/types/asset"

export function BuildingsContent() {
  const [buildings, setBuildings] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState<"All" | BuildingCondition>("All")
  const [agency, setAgency] = useState("All")
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Asset | null>(null)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState<Asset | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchBuildings()
    setConfigured(result.configured)
    setError(result.error)
    if (!result.error) setBuildings(result.data)
    setLoading(false)
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const agencies = useMemo(() => [...new Set(buildings.map((building) => building.managing_agency).filter((value): value is string => Boolean(value)))].sort(), [buildings])
  const filtered = useMemo(() => buildings.filter((building) => {
    const text = `${building.building_id} ${building.building_name} ${building.managing_agency ?? ""} ${building.location ?? ""}`.toLowerCase()
    return text.includes(search.toLowerCase()) && (condition === "All" || building.condition === condition) && (agency === "All" || building.managing_agency === agency)
  }), [buildings, search, condition, agency])

  const removeBuilding = async () => {
    if (!deleting) return
    const client = createSupabaseBrowserClient()
    if (!client) { toast.error("Supabase is not configured."); return }
    setBusy(true)
    const { data: visits } = await client.from("inspections").select("id").eq("building_id", deleting.building_id)
    const visitIds = (visits ?? []).map((visit) => visit.id)
    const { data: photos } = visitIds.length ? await client.from("inspection_photos").select("storage_path").in("inspection_id", visitIds) : { data: [] }
    const { error: deleteError } = await client.from("assets").delete().eq("building_id", deleting.building_id)
    if (deleteError) { toast.error(`Could not delete building: ${deleteError.message}`); setBusy(false); return }
    const photoPaths = (photos ?? []).map((photo) => photo.storage_path)
    if (photoPaths.length) await client.storage.from("inspection-photos").remove(photoPaths)
    if (deleting.photo_path) await client.storage.from("asset-photos").remove([deleting.photo_path])
    setDeleting(null)
    setSelected(null)
    setBusy(false)
    await load()
    toast.success(`${deleting.building_name} and its inspections were deleted.`)
  }

  return <AppShell title="Buildings">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Registry</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Buildings</h2><p className="mt-1 text-sm text-muted-foreground">Register a building once; record future visits in Inspections.</p></div><Button onClick={() => setAdding(true)}><Plus />Add building</Button></div>
    {!configured && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Supabase is not configured.</p>}
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search buildings</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-9" placeholder="Search ID, name, agency, location" /></label><label><span className="sr-only">Condition filter</span><select value={condition} onChange={(event) => setCondition(event.target.value as "All" | BuildingCondition)} className="field"><option value="All">All conditions</option>{DISPLAY_CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="sr-only">Agency filter</span><select value={agency} onChange={(event) => setAgency(event.target.value)} className="field"><option value="All">All agencies</option>{agencies.map((value) => <option key={value}>{value}</option>)}</select></label></div>
      {error ? <p role="alert" className="p-5 text-sm text-destructive">{error}</p> : loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded bg-muted" />)}</div> : filtered.length === 0 ? <div className="grid min-h-52 place-items-center p-8 text-center"><div><Building2 className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">{buildings.length ? "No matching buildings" : "No buildings yet"}</p><p className="mt-1 text-sm text-muted-foreground">{buildings.length ? "Try another search or filter." : "Add the first building to begin its history."}</p></div></div> : <div className="divide-y">{filtered.map((building) => <div key={building.building_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold text-primary">{building.building_id}</p><h3 className="truncate font-semibold">{building.building_name}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{building.managing_agency || "Unassigned"} · {building.location || "No location"}</p></div><div className="flex flex-wrap items-center gap-2"><ConditionBadge condition={building.condition} /><Button size="sm" variant="outline" onClick={() => setSelected(building)}><Eye />View</Button><Button size="sm" variant="outline" onClick={() => setEditing(building)}><Pencil />Edit</Button><Button size="icon-sm" variant="destructive" aria-label={`Delete ${building.building_name}`} onClick={() => setDeleting(building)}><Trash2 /></Button></div></div>)}</div>}
    </section>
    {adding && <AssetRegistrationDialog onClose={() => setAdding(false)} onAdded={load} />}
    {editing && <AssetEditDialog asset={editing} onClose={() => setEditing(null)} onSaved={load} />}
    {selected && <BuildingDetailsDialog asset={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} />}
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this building?</AlertDialogTitle><AlertDialogDescription>This also deletes every inspection and its photos for {deleting?.building_name}. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void removeBuilding() }}>{busy ? "Deleting..." : "Delete building"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AppShell>
}
