"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, Check, LoaderCircle, MapPin, RotateCcw, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { CONDITIONS, type Asset, peso } from "@/lib/types/asset"
import { PHOTO_VIEWS, type Inspection, type InspectionPhoto, type PhotoView } from "@/lib/types/inspection"

const schema = z.object({
  building_id: z.string().min(1, "Choose a building"),
  condition: z.enum(CONDITIONS, { message: "Choose a condition" }),
  condition_as_printed: z.string().trim().max(200),
  visit_date: z.string(),
  inspector_name: z.string().trim().min(1, "Inspector name is required").max(200),
  remarks: z.string().trim().max(5000),
  entry_notes: z.string().trim().max(5000),
})
type Values = z.infer<typeof schema>
type PhotoDraft = { file: File | null; latitude: string; longitude: string; error: string | null; gpsFound: boolean; removeExisting: boolean }
const emptyPhoto = (): PhotoDraft => ({ file: null, latitude: "", longitude: "", error: null, gpsFound: false, removeExisting: false })
const emptyPhotos = (): Record<PhotoView, PhotoDraft> => ({ front: emptyPhoto(), right: emptyPhoto(), left: emptyPhoto(), rear: emptyPhoto() })

export function InspectionDialog({ buildings, initialBuildingId = "", inspection, existingPhotos = [], onClose, onSaved }: {
  buildings: Asset[]
  initialBuildingId?: string
  inspection?: Inspection
  existingPhotos?: InspectionPhoto[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [photos, setPhotos] = useState<Record<PhotoView, PhotoDraft>>(emptyPhotos)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      building_id: inspection?.building_id ?? initialBuildingId,
      condition: inspection?.condition,
      condition_as_printed: inspection?.condition_as_printed ?? "",
      visit_date: inspection?.visit_date ?? "",
      inspector_name: inspection?.inspector_name ?? "",
      remarks: inspection?.remarks ?? "",
      entry_notes: inspection?.entry_notes ?? "",
    },
  })
  const selectedId = useWatch({ control, name: "building_id" })
  const selectedBuilding = buildings.find((building) => building.building_id === selectedId)

  const setPhoto = (view: PhotoView, patch: Partial<PhotoDraft>) => setPhotos((current) => ({ ...current, [view]: { ...current[view], ...patch } }))
  const choosePhoto = async (view: PhotoView, file: File | undefined) => {
    if (!file) { setPhotos((current) => ({ ...current, [view]: emptyPhoto() })); return }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotos((current) => ({ ...current, [view]: { ...emptyPhoto(), error: "Use JPEG, PNG, or WebP up to 5 MB." } }))
      return
    }
    setPhotos((current) => ({ ...current, [view]: { ...emptyPhoto(), file } }))
    try {
      const { gps } = await import("exifr")
      const location = await gps(file)
      if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        setPhoto(view, { latitude: String(location.latitude), longitude: String(location.longitude), gpsFound: true })
      }
    } catch { /* The photo can still be saved without GPS metadata. */ }
  }

  const onSubmit = async (values: Values) => {
    setSaveError(null)
    const client = createSupabaseBrowserClient()
    if (!client) { setSaveError("Supabase is not configured."); return }

    const inspectionId = inspection?.id ?? crypto.randomUUID()
    const uploaded: string[] = []
    const photoRows: { inspection_id: string; view_key: PhotoView; storage_path: string; latitude: number | null; longitude: number | null }[] = []
    for (const view of PHOTO_VIEWS) {
      const photo = photos[view]
      if (!photo.file) continue
      const extension = photo.file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `inspections/${inspectionId}/${view}-${crypto.randomUUID()}.${extension}`
      const { error } = await client.storage.from("inspection-photos").upload(path, photo.file, { contentType: photo.file.type })
      if (error) {
        if (uploaded.length) await client.storage.from("inspection-photos").remove(uploaded)
        setSaveError(`Could not upload ${view} photo: ${error.message}`)
        return
      }
      uploaded.push(path)
      photoRows.push({ inspection_id: inspectionId, view_key: view, storage_path: path, latitude: photo.latitude.trim() ? Number(photo.latitude) : null, longitude: photo.longitude.trim() ? Number(photo.longitude) : null })
    }

    const payload = {
      building_id: values.building_id,
      condition: values.condition,
      condition_as_printed: values.condition_as_printed || null,
      visit_date: values.visit_date || null,
      inspector_name: values.inspector_name,
      remarks: values.remarks || null,
      entry_notes: values.entry_notes || null,
    }
    const saveResult = inspection
      ? await client.from("inspections").update(payload).eq("id", inspectionId)
      : await client.from("inspections").insert({ id: inspectionId, ...payload })
    if (saveResult.error) {
      if (uploaded.length) await client.storage.from("inspection-photos").remove(uploaded)
      setSaveError(`Could not ${inspection ? "update" : "save"} inspection: ${saveResult.error.message}`)
      return
    }

    const replacedOrRemovedViews = inspection ? PHOTO_VIEWS.filter((view) => {
      const existing = existingPhotos.some((photo) => photo.view_key === view)
      return existing && (Boolean(photos[view].file) || photos[view].removeExisting)
    }) : []
    const oldPhotos = existingPhotos.filter((photo) => replacedOrRemovedViews.includes(photo.view_key))
    const rollbackInspection = async () => {
      if (!inspection) return
      await client.from("inspections").update({
        building_id: inspection.building_id,
        condition: inspection.condition,
        condition_as_printed: inspection.condition_as_printed,
        visit_date: inspection.visit_date,
        inspector_name: inspection.inspector_name,
        remarks: inspection.remarks,
        entry_notes: inspection.entry_notes,
      }).eq("id", inspection.id)
    }
    if (replacedOrRemovedViews.length) {
      const { error: removeRowsError } = await client.from("inspection_photos").delete().eq("inspection_id", inspectionId).in("view_key", replacedOrRemovedViews)
      if (removeRowsError) {
        await rollbackInspection()
        if (uploaded.length) await client.storage.from("inspection-photos").remove(uploaded)
        setSaveError(`Could not update photo details: ${removeRowsError.message}`)
        return
      }
    }
    if (photoRows.length) {
      const { error: photoError } = await client.from("inspection_photos").insert(photoRows)
      if (photoError) {
        if (inspection && oldPhotos.length) await client.from("inspection_photos").insert(oldPhotos.map(({ inspection_id, view_key, storage_path, latitude, longitude }) => ({ inspection_id, view_key, storage_path, latitude, longitude })))
        if (inspection) await rollbackInspection()
        else await client.from("inspections").delete().eq("id", inspectionId)
        await client.storage.from("inspection-photos").remove(uploaded)
        setSaveError(`Could not save photo details: ${photoError.message}`)
        return
      }
    }

    const oldPaths = oldPhotos.map((photo) => photo.storage_path)
    const storageResult = oldPaths.length ? await client.storage.from("inspection-photos").remove(oldPaths) : { error: null }

    reset()
    setPhotos(emptyPhotos())
    await onSaved()
    if (storageResult.error) toast.warning(`Inspection updated, but replaced photo files could not be removed: ${storageResult.error.message}`)
    else toast.success(`Inspection ${inspection ? "updated" : "recorded"} for ${selectedBuilding?.building_name ?? values.building_id}.`)
    onClose()
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={inspection ? "Edit site inspection" : "New site inspection"}>
    <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7">
        <div><div className="mb-1 text-xs font-semibold tracking-wide text-primary uppercase">Site visit</div><h2 className="text-xl font-bold">{inspection ? "Edit inspection" : "New inspection"}</h2><p className="mt-1 text-xs text-muted-foreground">{inspection ? "Update this visit and its photographs." : "A new record is added to the selected building. Earlier visits stay in its history."}</p></div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose} disabled={isSubmitting}><X /></Button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
        <fieldset className="rounded-xl border bg-card p-4 sm:p-5"><legend className="px-1 text-sm font-semibold">Building</legend>
          <label className="block text-sm font-medium">Building <Required /><select {...register("building_id")} className="field mt-1.5"><option value="">Choose a building</option>{buildings.map((building) => <option key={building.building_id} value={building.building_id}>{building.building_id} · {building.building_name}</option>)}</select>{errors.building_id && <ErrorText>{errors.building_id.message}</ErrorText>}</label>
          {selectedBuilding && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs"><span><strong>{selectedBuilding.building_name}</strong></span><span>{selectedBuilding.location}</span><span>Estimated cost: {selectedBuilding.estimated_cost == null ? "—" : peso.format(selectedBuilding.estimated_cost)}</span></div>}
          {buildings.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Register a building before recording an inspection.</p>}
        </fieldset>

        <fieldset className="rounded-xl border bg-card p-4 sm:p-5"><legend className="px-1 text-sm font-semibold">Assessment</legend>
          <div className="form-grid">
            <label className="text-sm font-medium">Condition <Required /><select {...register("condition")} className="field mt-1.5"><option value="">Choose a condition</option>{CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}</select>{errors.condition && <ErrorText>{errors.condition.message}</ErrorText>}</label>
            <label className="text-sm font-medium">Condition on source form<input {...register("condition_as_printed")} className="field mt-1.5" placeholder="Optional original wording" />{errors.condition_as_printed && <ErrorText>{errors.condition_as_printed.message}</ErrorText>}</label>
            <label className="text-sm font-medium">Visit date<input {...register("visit_date")} type="date" className="field mt-1.5" /></label>
            <label className="text-sm font-medium">Inspector <Required /><input {...register("inspector_name")} className="field mt-1.5" autoComplete="name" />{errors.inspector_name && <ErrorText>{errors.inspector_name.message}</ErrorText>}</label>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border bg-card p-4 sm:p-5"><legend className="px-1 text-sm font-semibold">Observations</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Remarks<textarea {...register("remarks")} rows={4} className="mt-1.5 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Observed condition and recommended work" />{errors.remarks && <ErrorText>{errors.remarks.message}</ErrorText>}</label>
            <label className="text-sm font-medium">Entry notes<textarea {...register("entry_notes")} rows={4} className="mt-1.5 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Source details or transcription notes" />{errors.entry_notes && <ErrorText>{errors.entry_notes.message}</ErrorText>}</label>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border bg-card p-4 sm:p-5"><legend className="px-1 text-sm font-semibold">Photographs</legend>
          <p className="mb-4 text-xs text-muted-foreground">Add or replace available views. Location is read from a photo when GPS data is present.</p>
          <div className="grid gap-3 sm:grid-cols-2">{PHOTO_VIEWS.map((view) => {
            const photo = photos[view]
            const existing = existingPhotos.find((item) => item.view_key === view)
            const hasVisiblePhoto = Boolean(photo.file || (existing && !photo.removeExisting))
            return <div key={view} className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold tracking-wide uppercase">{view} view</span><div className="flex gap-1"><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Camera className="size-3.5" />{hasVisiblePhoto ? "Replace" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void choosePhoto(view, event.target.files?.[0])} /></label>{hasVisiblePhoto && <Button type="button" size="icon-xs" variant="destructive" aria-label={`Remove ${view} photo`} onClick={() => setPhotos((current) => ({ ...current, [view]: { ...emptyPhoto(), removeExisting: Boolean(existing) } }))}><Trash2 /></Button>}{photo.removeExisting && existing && <Button type="button" size="icon-xs" variant="outline" aria-label={`Keep ${view} photo`} onClick={() => setPhoto(view, { removeExisting: false })}><RotateCcw /></Button>}</div></div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{photo.file ? photo.file.name : photo.removeExisting ? "Photo will be removed" : existing ? "Current photo retained" : "No photo added"}</p>
              {photo.gpsFound && <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><MapPin className="size-3" />GPS found in photo</p>}
              {photo.error && <ErrorText>{photo.error}</ErrorText>}
            </div>
          })}</div>
        </fieldset>
        {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}
        <div className="flex items-center justify-between gap-3 border-t pt-4"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3.5" />{inspection ? "Changes update this visit" : "Saved visits remain in history"}</span><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting || buildings.length === 0}>{isSubmitting && <LoaderCircle className="animate-spin" />}{isSubmitting ? "Saving..." : inspection ? "Save changes" : "Save inspection"}</Button></div></div>
      </form>
    </div>
  </div>
}

function Required() { return <span className="text-primary" aria-label="required">*</span> }
function ErrorText({ children }: { children: React.ReactNode }) { return <p role="alert" className="mt-1 text-xs font-medium text-destructive">{children}</p> }
