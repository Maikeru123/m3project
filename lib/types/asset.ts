export const CONDITIONS = ["Good", "Minor Repair", "Major Repair", "Total Rehabilitation", "Demolished", "Condemned"] as const
export const DISPLAY_CONDITIONS = [...CONDITIONS, "Not inspected"] as const

export const MANAGING_AGENCIES = ["DPWH", "DepEd", "DOH", "DILG", "DA", "DSWD", "PNP", "BFP", "COMELEC", "LGU", "Other (Please Specify)"] as const

export const OWNERSHIP_STATUSES = ["Deed of Donation", "Usufruct", "MOA", "Tax Declaration"] as const

export const CONDITION_COLORS: Record<BuildingCondition, string> = {
  Good: "var(--condition-good)",
  "Minor Repair": "var(--condition-minor)",
  "Major Repair": "var(--condition-major)",
  Condemned: "var(--condition-condemned)",
  "Total Rehabilitation": "#dc2626",
  Demolished: "#7c3aed",
  "Not inspected": "#64748b",
}

export type Condition = (typeof CONDITIONS)[number]
export type BuildingCondition = Condition | "Not inspected"

export type Asset = {
  building_id: string
  building_name: string
  condition: BuildingCondition
  latest_inspection_id: string | null
  estimated_repair_cost: number
  photo_path: string | null
  managing_agency: string | null
  ownership_status: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  last_inspected_date: string | null
  region: string | null
  implementing_office: string | null
  building_group: string | null
  lot_status: string | null
  building_status: string | null
  lot_area_sqm: number | null
  total_floor_area_sqm: number | null
  bir_zonal_value_per_sqm: number | null
  number_of_storeys: number | null
  construction_type: string | null
  year_of_construction: number | null
  book_value: number | null
  appraised_value: number | null
  estimated_cost: number | null
  include_agency_inventory: boolean
  property_number: string | null
  company: string | null
  project_head: string | null
  client_info: string | null
}

export const ASSET_COLUMNS = "building_id,building_name,managing_agency,location,latitude,longitude,ownership_status,condition,estimated_repair_cost,last_inspected_date,photo_path,region,implementing_office,building_group,lot_status,building_status,lot_area_sqm,total_floor_area_sqm,bir_zonal_value_per_sqm,number_of_storeys,construction_type,year_of_construction,book_value,appraised_value,estimated_cost,include_agency_inventory,property_number,company,project_head,client_info"

export const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
})

export function formatInspectionDate(value: string | null | undefined) {
  if (!value) return "Not yet inspected"
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return "Not yet inspected"
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)))
}
