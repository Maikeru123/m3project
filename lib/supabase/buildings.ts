import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { ASSET_COLUMNS, type Asset, type Condition } from "@/lib/types/asset"

export async function fetchBuildings(): Promise<{ data: Asset[]; error: string | null; configured: boolean }> {
  const client = createSupabaseBrowserClient()
  if (!client) return { data: [], error: null, configured: false }

  const [buildings, latest] = await Promise.all([
    client.from("assets").select(ASSET_COLUMNS).order("building_id"),
    client.from("latest_building_inspections").select("id,building_id,condition,visit_date"),
  ])
  if (buildings.error || latest.error) return { data: [], error: buildings.error?.message ?? latest.error?.message ?? "Could not load buildings.", configured: true }

  const inspections = new Map((latest.data ?? []).map((inspection) => [inspection.building_id, inspection]))
  const data = (buildings.data ?? []).map((building) => {
    const inspection = inspections.get(building.building_id)
    return {
      ...building,
      condition: (inspection?.condition ?? "Not inspected") as Condition | "Not inspected",
      last_inspected_date: inspection?.visit_date ?? null,
      latest_inspection_id: inspection?.id ?? null,
      estimated_repair_cost: Number(building.estimated_repair_cost ?? 0),
      estimated_cost: building.estimated_cost == null ? null : Number(building.estimated_cost),
    }
  }) as Asset[]
  return { data, error: null, configured: true }
}
