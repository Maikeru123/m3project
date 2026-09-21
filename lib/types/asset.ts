export const CONDITIONS = ["Good", "Minor Repair", "Major Repair", "Condemned"] as const

export const MANAGING_AGENCIES = ["DPWH", "DepEd", "DOH", "DILG", "DA", "DSWD", "PNP", "BFP", "COMELEC", "LGU", "Other (Please Specify)"] as const

export const OWNERSHIP_STATUSES = ["Deed of Donation", "Usufruct", "MOA", "Tax Declaration"] as const

export const CONDITION_COLORS: Record<Condition, string> = {
  Good: "var(--condition-good)",
  "Minor Repair": "var(--condition-minor)",
  "Major Repair": "var(--condition-major)",
  Condemned: "var(--condition-condemned)",
}

export type Condition = (typeof CONDITIONS)[number]

export type Asset = {
  building_id: string
  building_name: string
  condition: Condition
  estimated_repair_cost: number
  photo_path: string | null
  managing_agency: string | null
  ownership_status: string | null
  location: string | null
  last_inspected_date: string | null
}

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
