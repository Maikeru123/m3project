"use client"

/* eslint-disable @next/next/no-img-element */

import { Building2, CalendarDays, Camera, ClipboardCheck, MapPin, Pencil, X } from "lucide-react"
import { useEffect, useState } from "react"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatInspectionDate, peso, type Asset } from "@/lib/types/asset"
import type { Inspection } from "@/lib/types/inspection"

export function BuildingDetailsDialog({ asset, onClose, onEdit }: { asset: Asset; onClose: () => void; onEdit?: () => void }) {
  const [visits, setVisits] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const client = createSupabaseBrowserClient()
  const photo = client && asset.photo_path ? client.storage.from("asset-photos").getPublicUrl(asset.photo_path).data.publicUrl : null

  useEffect(() => {
    let active = true
    const loadHistory = async () => {
      const supabase = createSupabaseBrowserClient()
      if (!supabase) {
        if (active) { setHistoryError("Inspection history is unavailable."); setLoading(false) }
        return
      }
      const { data, error } = await supabase.from("inspections")
        .select("id,building_id,condition,condition_as_printed,visit_date,inspector_name,remarks,entry_notes,created_at")
        .eq("building_id", asset.building_id)
        .order("created_at", { ascending: false })
      if (!active) return
      setHistoryError(error ? `Could not load this building's inspections: ${error.message}` : null)
      setVisits(((data ?? []) as Inspection[]).filter((visit) => visit.building_id === asset.building_id)
        .sort((a, b) => (b.visit_date ?? b.created_at.slice(0, 10)).localeCompare(a.visit_date ?? a.created_at.slice(0, 10)) || b.created_at.localeCompare(a.created_at)))
      setLoading(false)
    }
    void loadHistory()
    return () => { active = false }
  }, [asset.building_id])

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={`${asset.building_name} details`}>
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border bg-background shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
        <div className="min-w-0"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Building record · {asset.building_id}</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{asset.building_name}</h2></div>
        <div className="flex shrink-0 gap-1">{onEdit && <Button size="icon" variant="ghost" aria-label="Edit building" onClick={onEdit}><Pencil /></Button>}<Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X /></Button></div>
      </header>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          {photo ? <img src={photo} alt={asset.building_name} className="h-56 w-full object-cover sm:h-64" /> : <div className="grid h-56 place-items-center bg-muted/40 text-sm text-muted-foreground sm:h-64"><span className="flex items-center gap-2"><Camera className="size-5" />No building photo</span></div>}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3"><ConditionBadge condition={asset.condition} /><span className="text-xs text-muted-foreground">{asset.last_inspected_date ? `Last visit ${formatInspectionDate(asset.last_inspected_date)}` : "No dated inspection"}</span></div>
        </section>

        <DetailCard title="Location & agency" icon={<MapPin className="size-4" />} className="lg:col-span-1">
          <Info label="Location" value={asset.location} />
          <Info label="Region" value={asset.region} />
          <Info label="Agency" value={asset.managing_agency} />
          <Info label="Implementing office" value={asset.implementing_office} />
          <Info label="Map position" value={asset.latitude == null || asset.longitude == null ? null : `${asset.latitude}, ${asset.longitude}`} />
        </DetailCard>

        <DetailCard title="Property" icon={<Building2 className="size-4" />} className="lg:col-span-1">
          <Info label="Group" value={asset.building_group} />
          <Info label="Building status" value={asset.building_status} />
          <Info label="Lot status" value={asset.lot_status} />
          <Info label="Ownership document" value={asset.ownership_status} />
          <Info label="Property number" value={asset.property_number} />
          <Info label="Agency inventory" value={asset.include_agency_inventory ? "Included" : "Not included"} />
        </DetailCard>

        <DetailCard title="Structure" icon={<Building2 className="size-4" />} className="lg:col-span-1">
          <Info label="Construction" value={asset.construction_type} />
          <Info label="Storeys" value={asset.number_of_storeys?.toString()} />
          <Info label="Year built" value={asset.year_of_construction?.toString()} />
          <Info label="Lot area" value={asset.lot_area_sqm == null ? null : `${asset.lot_area_sqm} sq.m.`} />
          <Info label="Floor area" value={asset.total_floor_area_sqm == null ? null : `${asset.total_floor_area_sqm} sq.m.`} />
        </DetailCard>

        <DetailCard title="Valuation" icon={<CalendarDays className="size-4" />} className="lg:col-span-1">
          <Info label="Estimated cost" value={money(asset.estimated_cost)} />
          <Info label="Book value" value={money(asset.book_value)} />
          <Info label="Appraised value" value={money(asset.appraised_value)} />
          <Info label="BIR zonal value / sq.m." value={money(asset.bir_zonal_value_per_sqm)} />
        </DetailCard>

        <DetailCard title="Project contacts" icon={<ClipboardCheck className="size-4" />} className="lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-3"><Info label="Company" value={asset.company} /><Info label="Project head" value={asset.project_head} /><Info label="Client info" value={asset.client_info} /></div>
        </DetailCard>

        <section className="rounded-xl border bg-card p-4 sm:p-5 lg:col-span-3" aria-labelledby="building-history-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" /><h3 id="building-history-heading" className="font-semibold">Inspection history</h3></div>{!loading && !historyError && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{visits.length} {visits.length === 1 ? "visit" : "visits"}</span>}</div>
          {loading ? <div className="mt-4 h-16 animate-pulse rounded-lg bg-muted" /> : historyError ? <p role="alert" className="mt-4 text-sm text-destructive">{historyError}</p> : visits.length === 0 ? <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">No inspections recorded for this building.</p> : <ol className="mt-4 space-y-3">{visits.map((visit) => <li key={visit.id} className="rounded-lg border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{visit.visit_date ? formatInspectionDate(visit.visit_date) : "Undated visit"}</p><p className="mt-0.5 text-xs text-muted-foreground">Inspector: {visit.inspector_name}</p></div><ConditionBadge condition={visit.condition} /></div>{visit.condition_as_printed && <p className="mt-3 text-xs text-muted-foreground">Source wording: {visit.condition_as_printed}</p>}{visit.remarks && <p className="mt-3 whitespace-pre-wrap text-sm">{visit.remarks}</p>}{visit.entry_notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{visit.entry_notes}</p>}</li>)}</ol>}
        </section>
      </div>
    </div>
  </div>
}

function DetailCard({ title, icon, className, children }: { title: string; icon: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border bg-card p-4 sm:p-5 ${className ?? ""}`}><div className="mb-4 flex items-center gap-2 text-primary">{icon}<h3 className="text-sm font-semibold text-foreground">{title}</h3></div><dl className="space-y-3">{children}</dl></section>
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><dt className="text-[11px] font-medium text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{value || "—"}</dd></div>
}

function money(value: number | null) { return value == null ? null : peso.format(value) }
