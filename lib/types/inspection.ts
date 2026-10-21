import type { Condition } from "@/lib/types/asset"

export const PHOTO_VIEWS = ["front", "right", "left", "rear"] as const
export type PhotoView = (typeof PHOTO_VIEWS)[number]

export type Inspection = {
  id: string
  building_id: string
  condition: Condition
  condition_as_printed: string | null
  visit_date: string | null
  inspector_name: string
  remarks: string | null
  entry_notes: string | null
  created_at: string
}

export type InspectionPhoto = {
  id: string
  inspection_id: string
  view_key: PhotoView
  storage_path: string
  latitude: number | null
  longitude: number | null
}
