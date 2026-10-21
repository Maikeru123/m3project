"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, X } from "lucide-react"
import { cloneElement, isValidElement, useId } from "react"
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { LocationPicker } from "@/components/assets/location-picker"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { MANAGING_AGENCIES, OWNERSHIP_STATUSES, type Asset } from "@/lib/types/asset"

const GROUPS = ["Government Office", "Education", "Health", "Public Safety", "Residential", "Other"] as const
const BUILDING_STATUSES = ["Existing", "New", "Under Construction", "For Repair", "Condemned"] as const
const CONSTRUCTION_TYPES = ["Concrete", "Steel", "Wood", "Mixed", "Other"] as const

const optionalNumber = z.string().refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), "Enter a valid nonnegative number")
const schema = z.object({
  building_id: z.string().trim().min(1, "Building ID is required").max(80),
  region: z.string().trim().max(120),
  implementing_office: z.string().trim().max(200),
  agency_choice: z.enum(MANAGING_AGENCIES, { message: "Select an agency" }),
  managing_agency_other: z.string().trim().optional(),
  building_name: z.string().trim().min(1, "Building name is required").max(200),
  location: z.string().trim().min(1, "Location is required").max(300),
  building_group: z.union([z.enum(GROUPS), z.literal("")]),
  lot_status: z.string().trim().max(120),
  building_status: z.union([z.enum(BUILDING_STATUSES), z.literal("")]),
  lot_area_sqm: optionalNumber,
  total_floor_area_sqm: optionalNumber,
  bir_zonal_value_per_sqm: optionalNumber,
  number_of_storeys: optionalNumber.refine((value) => value === "" || Number.isInteger(Number(value)), "Enter a whole number"),
  construction_type: z.union([z.enum(CONSTRUCTION_TYPES), z.literal("")]),
  year_of_construction: optionalNumber.refine((value) => value === "" || (Number.isInteger(Number(value)) && Number(value) >= 1800 && Number(value) <= 2200), "Enter a valid year"),
  book_value: optionalNumber,
  appraised_value: optionalNumber,
  estimated_cost: optionalNumber,
  latitude: z.string(),
  longitude: z.string(),
  include_agency_inventory: z.boolean(),
  property_number: z.string().trim().max(120),
  company: z.string().trim().max(200),
  project_head: z.string().trim().max(200),
  client_info: z.string().trim().max(300),
  ownership_status: z.string(),
  photo: z.any().optional(),
}).superRefine((values, context) => {
  if (values.agency_choice === "Other (Please Specify)" && !values.managing_agency_other?.trim()) {
    context.addIssue({ code: "custom", path: ["managing_agency_other"], message: "Specify the agency" })
  }
  const hasLatitude = values.latitude.trim() !== ""
  const hasLongitude = values.longitude.trim() !== ""
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: "custom", path: [hasLatitude ? "longitude" : "latitude"], message: "Enter both coordinates" })
  }
  if (hasLatitude && (!Number.isFinite(Number(values.latitude)) || Math.abs(Number(values.latitude)) > 90)) {
    context.addIssue({ code: "custom", path: ["latitude"], message: "Latitude must be between -90 and 90" })
  }
  if (hasLongitude && (!Number.isFinite(Number(values.longitude)) || Math.abs(Number(values.longitude)) > 180)) {
    context.addIssue({ code: "custom", path: ["longitude"], message: "Longitude must be between -180 and 180" })
  }
})

type FormData = z.infer<typeof schema>

const defaults: DefaultValues<FormData> = {
  building_id: "", region: "", implementing_office: "", managing_agency_other: "", building_name: "", location: "",
  building_group: "", lot_status: "", building_status: "", lot_area_sqm: "", total_floor_area_sqm: "",
  bir_zonal_value_per_sqm: "", number_of_storeys: "", construction_type: "",
  year_of_construction: "", book_value: "", appraised_value: "", estimated_cost: "", latitude: "", longitude: "",
  include_agency_inventory: false, property_number: "", company: "", project_head: "", client_info: "",
  ownership_status: "", photo: undefined,
}

const numberOrNull = (value: string) => value.trim() === "" ? null : Number(value)

export function AssetRegistrationDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => Promise<void> }) {
  return <BuildingFormDialog onClose={onClose} onSaved={onAdded} />
}

export function AssetEditDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => Promise<void> }) {
  return <BuildingFormDialog asset={asset} onClose={onClose} onSaved={onSaved} />
}

function BuildingFormDialog({ asset, onClose, onSaved }: { asset?: Asset; onClose: () => void; onSaved: () => Promise<void> }) {
  const knownAgency = MANAGING_AGENCIES.find((agency) => agency === asset?.managing_agency)
  const { register, control, setValue, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: asset ? {
      building_id: asset.building_id,
      region: asset.region ?? "",
      implementing_office: asset.implementing_office ?? "",
      agency_choice: knownAgency ?? (asset.managing_agency ? "Other (Please Specify)" : undefined),
      managing_agency_other: knownAgency ? "" : asset.managing_agency ?? "",
      building_name: asset.building_name,
      location: asset.location ?? "",
      building_group: (GROUPS.find((group) => group === asset.building_group)) ?? "",
      lot_status: asset.lot_status ?? "",
      building_status: BUILDING_STATUSES.find((status) => status === asset.building_status) ?? "",
      lot_area_sqm: asset.lot_area_sqm?.toString() ?? "",
      total_floor_area_sqm: asset.total_floor_area_sqm?.toString() ?? "",
      bir_zonal_value_per_sqm: asset.bir_zonal_value_per_sqm?.toString() ?? "",
      number_of_storeys: asset.number_of_storeys?.toString() ?? "",
      construction_type: CONSTRUCTION_TYPES.find((type) => type === asset.construction_type) ?? "",
      year_of_construction: asset.year_of_construction?.toString() ?? "",
      book_value: asset.book_value?.toString() ?? "",
      appraised_value: asset.appraised_value?.toString() ?? "",
      estimated_cost: asset.estimated_cost?.toString() ?? "",
      latitude: asset.latitude?.toString() ?? "",
      longitude: asset.longitude?.toString() ?? "",
      include_agency_inventory: asset.include_agency_inventory,
      property_number: asset.property_number ?? "",
      company: asset.company ?? "",
      project_head: asset.project_head ?? "",
      client_info: asset.client_info ?? "",
      ownership_status: asset.ownership_status ?? "",
    } : defaults,
  })
  const agencyChoice = useWatch({ control, name: "agency_choice" })
  const latitude = useWatch({ control, name: "latitude" }) ?? ""
  const longitude = useWatch({ control, name: "longitude" }) ?? ""
  const coordinates = latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? { latitude: Number(latitude), longitude: Number(longitude) } : null

  const onSubmit = async (values: FormData) => {
    const client = createSupabaseBrowserClient()
    if (!client) { toast.error("Supabase is not configured."); return }

    const file = values.photo?.[0] as File | undefined
    let photoPath: string | null = asset?.photo_path ?? null
    let uploadedPath: string | null = null
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        toast.error("Use a JPEG, PNG, or WebP photograph up to 5 MB.")
        return
      }
      uploadedPath = `assets/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`
      const { error: uploadError } = await client.storage.from("asset-photos").upload(uploadedPath, file, { contentType: file.type })
      if (uploadError) { toast.error(`Photo upload failed: ${uploadError.message}`); return }
      photoPath = uploadedPath
    }

    const payload = {
      building_id: values.building_id,
      region: values.region || null,
      implementing_office: values.implementing_office || null,
      managing_agency: values.agency_choice === "Other (Please Specify)" ? values.managing_agency_other?.trim() : values.agency_choice,
      building_name: values.building_name,
      location: values.location,
      building_group: values.building_group || null,
      lot_status: values.lot_status || null,
      building_status: values.building_status || null,
      lot_area_sqm: numberOrNull(values.lot_area_sqm),
      total_floor_area_sqm: numberOrNull(values.total_floor_area_sqm),
      bir_zonal_value_per_sqm: numberOrNull(values.bir_zonal_value_per_sqm),
      number_of_storeys: numberOrNull(values.number_of_storeys),
      construction_type: values.construction_type || null,
      year_of_construction: numberOrNull(values.year_of_construction),
      book_value: numberOrNull(values.book_value),
      appraised_value: numberOrNull(values.appraised_value),
      estimated_cost: numberOrNull(values.estimated_cost),
      latitude: numberOrNull(values.latitude),
      longitude: numberOrNull(values.longitude),
      include_agency_inventory: values.include_agency_inventory,
      property_number: values.property_number || null,
      company: values.company || null,
      project_head: values.project_head || null,
      client_info: values.client_info || null,
      ownership_status: values.ownership_status || null,
      photo_path: photoPath,
    }
    const { error } = asset
      ? await client.from("assets").update(payload).eq("building_id", asset.building_id)
      : await client.from("assets").insert({ ...payload, condition: null, estimated_repair_cost: 0, last_inspected_date: null })
    if (error) {
      if (uploadedPath) await client.storage.from("asset-photos").remove([uploadedPath])
      toast.error(error.code === "23505" ? "That Building ID already exists." : `Could not save building: ${error.message}`)
      return
    }
    if (uploadedPath && asset?.photo_path) await client.storage.from("asset-photos").remove([asset.photo_path])

    reset(defaults)
    await onSaved()
    toast.success(asset ? `${values.building_name} was updated.` : `${values.building_name} was added to Buildings.`)
    onClose()
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={asset ? "Edit building" : "Add building"}>
    <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7">
        <div><h2 className="text-xl font-bold">{asset ? "Edit building" : "Add building"}</h2><p className="mt-1 text-xs text-muted-foreground">Building details are saved once. Record each site visit under Inspections.</p></div>
        <Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={onClose} disabled={isSubmitting}><X /></Button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
        <Section title="Building"><div className="form-grid">
          <Field label="Building ID" required error={errors.building_id?.message} hint="e.g. SITE-09"><input {...register("building_id")} className="field" placeholder="SITE-09" /></Field>
          <Field label="Region" error={errors.region?.message} hint="e.g. Davao Region"><input {...register("region")} className="field" placeholder="Davao Region" /></Field>
          <Field label="Implementing office" hint="e.g. City Engineer’s Office"><input {...register("implementing_office")} className="field" /></Field>
          <Field label="Agency" required error={errors.agency_choice?.message || errors.managing_agency_other?.message}>
            <select {...register("agency_choice")} aria-label="Agency" className="field"><option value="">— Select agency —</option>{MANAGING_AGENCIES.map((agency) => <option key={agency}>{agency}</option>)}</select>
            {agencyChoice === "Other (Please Specify)" && <input {...register("managing_agency_other")} aria-label="Specify agency" className="field mt-2" placeholder="Specify agency" />}
          </Field>
          <Field label="Name of building" required error={errors.building_name?.message}><input {...register("building_name")} className="field" /></Field>
          <Field label="Location" required error={errors.location?.message} hint="Barangay, city / municipality. Search and select a result to fill coordinates.">
            <Controller name="location" control={control} render={({ field }) => <LocationPicker value={field.value ?? ""} onChange={field.onChange} coordinates={coordinates} onCoordinatesChange={(value) => { setValue("latitude", value ? String(value.latitude) : ""); setValue("longitude", value ? String(value.longitude) : "") }} showCoordinates={false} />} />
          </Field>
          <Field label="Group" error={errors.building_group?.message}><select {...register("building_group")} className="field"><option value="">— Optional —</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></Field>
        </div></Section>

        <Section title="Property status"><div className="form-grid">
          <Field label="Lot status" hint="e.g. Gov’t-owned, Private"><input {...register("lot_status")} className="field" /></Field>
          <Field label="Building status" error={errors.building_status?.message}><select {...register("building_status")} className="field"><option value="">— Optional —</option>{BUILDING_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Lot area (sq.m.)" error={errors.lot_area_sqm?.message}><input {...register("lot_area_sqm")} type="number" min="0" step="0.01" className="field" /></Field>
          <Field label="Total floor area (sq.m.)" error={errors.total_floor_area_sqm?.message}><input {...register("total_floor_area_sqm")} type="number" min="0" step="0.01" className="field" /></Field>
          <Field label="BIR zonal value (₱ per sq.m.)" error={errors.bir_zonal_value_per_sqm?.message}><input {...register("bir_zonal_value_per_sqm")} type="number" min="0" step="0.01" className="field" /></Field>
        </div></Section>

        <Section title="Description of building"><div className="form-grid">
          <Field label="No. of storeys" error={errors.number_of_storeys?.message}><input {...register("number_of_storeys")} type="number" min="0" step="1" className="field" /></Field>
          <Field label="Type of construction" error={errors.construction_type?.message}><select {...register("construction_type")} className="field"><option value="">— Optional —</option>{CONSTRUCTION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Year of construction" error={errors.year_of_construction?.message}><input {...register("year_of_construction")} type="number" min="1800" max="2200" step="1" className="field" /></Field>
          <Field label="Book value (₱)" error={errors.book_value?.message}><input {...register("book_value")} type="number" min="0" step="0.01" className="field" /></Field>
          <Field label="Appraised value (₱)" error={errors.appraised_value?.message}><input {...register("appraised_value")} type="number" min="0" step="0.01" className="field" /></Field>
        </div></Section>

        <Section title="Valuation"><div className="form-grid">
          <Field label="Estimated cost (₱)" error={errors.estimated_cost?.message}><input {...register("estimated_cost")} type="number" min="0" step="0.01" className="field" /></Field>
        </div></Section>

        <Section title="Geotagged location"><div className="form-grid">
          <Field label="Latitude" error={errors.latitude?.message} hint="e.g. 7.060083"><input {...register("latitude")} type="number" min="-90" max="90" step="any" className="field" /></Field>
          <Field label="Longitude" error={errors.longitude?.message} hint="e.g. 125.529996"><input {...register("longitude")} type="number" min="-180" max="180" step="any" className="field" /></Field>
        </div></Section>

        <Section title="Form 16-25">
          <label className="flex items-center gap-3 text-sm"><input {...register("include_agency_inventory")} type="checkbox" className="size-4 accent-primary" />Also save this building&apos;s Agency Inventory entry</label>
          <p className="mt-2 text-xs text-muted-foreground">Region, agency, name, location, areas, and description are taken from the fields above.</p>
        </Section>

        <Section title="Form 16-26"><div className="form-grid"><Field label="Property number" error={errors.property_number?.message} hint="e.g. CEO-0001-000-288-2026. Leave blank if unassigned."><input {...register("property_number")} className="field" /></Field></div></Section>

        <Section title="Not on the forms"><div className="form-grid">
          <Field label="Company" error={errors.company?.message}><input {...register("company")} className="field" /></Field>
          <Field label="Project head (Engineer)" error={errors.project_head?.message}><input {...register("project_head")} className="field" /></Field>
          <Field label="Client info" error={errors.client_info?.message}><input {...register("client_info")} className="field" /></Field>
        </div></Section>

        <Section title="Additional asset details"><div className="form-grid">
          <Field label="Ownership document"><select {...register("ownership_status")} className="field"><option value="">— Optional —</option>{OWNERSHIP_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Building photograph" hint="JPEG, PNG, or WebP. Maximum 5 MB."><input {...register("photo")} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-md border bg-background text-sm file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2" /></Field>
        </div></Section>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="animate-spin" />}{isSubmitting ? "Saving..." : asset ? "Save changes" : "Save building"}</Button>
        </div>
      </form>
    </div>
  </div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="rounded-lg border bg-card px-4 pb-4 pt-2 sm:px-5"><legend className="px-1 text-sm font-semibold">{title}</legend>{children}</fieldset>
}

function Field({ label, children, required = false, hint, error }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; error?: string }) {
  const id = useId()
  const control = isValidElement(children) && typeof children.type === "string" ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children
  return <div className="min-w-0 text-sm"><label htmlFor={id} className="mb-1.5 block font-medium">{label}{required && <span className="ml-1 text-primary">*</span>}</label>{control}{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}{error && <p role="alert" className="mt-1 text-xs font-medium text-destructive">{error}</p>}</div>
}
