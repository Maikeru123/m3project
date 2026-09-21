"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, FileImage, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { AppShell } from "@/components/layout/app-shell"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { CONDITIONS, MANAGING_AGENCIES, OWNERSHIP_STATUSES, type Asset, type Condition, formatInspectionDate, peso } from "@/lib/types/asset"

const formSchema = z.object({
  building_id: z.string().trim().min(1, "Property ID is required").max(80),
  building_name: z.string().trim().min(1, "Building name is required").max(200),
  agency_choice: z.enum(MANAGING_AGENCIES, { message: "Select a managing agency" }),
  managing_agency_other: z.string().trim().optional(),
  location: z.string().trim().min(1, "Location is required").max(300),
  ownership_status: z.enum(OWNERSHIP_STATUSES, { message: "Select an ownership status" }),
  condition: z.enum(CONDITIONS),
  estimated_repair_cost: z.coerce.number().min(0, "Repair cost cannot be negative"),
  last_inspected_date: z.string().optional(),
  photo: z.any().optional(),
}).superRefine((values, context) => {
  if (values.agency_choice === "Other (Please Specify)" && !values.managing_agency_other?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["managing_agency_other"], message: "Specify the managing agency" })
  }
})

type FormData = z.infer<typeof formSchema>

function Modal({ children, title, onClose, headerAction }: { children: React.ReactNode; title: string; onClose: () => void; headerAction?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button onClick={onClose} aria-label="Close dialog" className="absolute inset-0 bg-slate-950/40" />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1">{headerAction}<Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button></div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AssetDetailsDialog({ asset, onClose, onEdit }: { asset: Asset; onClose: () => void; onEdit?: () => void }) {
  const client = createSupabaseBrowserClient()
  const photoUrl = client && asset.photo_path ? client.storage.from("asset-photos").getPublicUrl(asset.photo_path).data.publicUrl : null

  return (
    <Modal title="Asset Details" onClose={onClose} headerAction={onEdit ? <Button variant="ghost" size="icon" aria-label="Edit asset" title="Edit asset" onClick={onEdit}><Pencil /></Button> : undefined}>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border bg-muted/40">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={`Photograph of ${asset.building_name}`} className="aspect-video w-full object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center text-center text-sm text-muted-foreground"><div><FileImage className="mx-auto mb-2 size-8" />No building photograph available</div></div>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Property ID" value={asset.building_id} />
          <Detail label="Building Name" value={asset.building_name} />
          <Detail label="Managing Agency" value={asset.managing_agency || "—"} />
          <Detail label="Location" value={asset.location || "—"} />
          <Detail label="Ownership Status" value={asset.ownership_status || "—"} />
          <div><dt className="text-muted-foreground">Current Condition</dt><dd className="mt-1"><ConditionBadge condition={asset.condition} /></dd></div>
          <Detail label="Estimated Repair Cost" value={peso.format(asset.estimated_repair_cost)} prominent />
          <Detail label="Last Inspected Date" value={formatInspectionDate(asset.last_inspected_date)} />
        </dl>
      </div>
    </Modal>
  )
}

export function AssetRegistrationDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => Promise<void> }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { condition: "Good", estimated_repair_cost: 0 },
  })
  const agencyChoice = useWatch({ control, name: "agency_choice" })

  const onSubmit = async (values: FormData) => {
    const client = createSupabaseBrowserClient()
    if (!client) { toast.error("Supabase is not configured."); return }

    const file = values.photo?.[0] as File | undefined
    let photoPath: string | null = null
    if (file) {
      const allowed = ["image/jpeg", "image/png", "image/webp"]
      if (!allowed.includes(file.type)) { toast.error("Use a JPEG, PNG, or WebP photograph."); return }
      if (file.size > 5 * 1024 * 1024) { toast.error("Photographs must be 5 MB or smaller."); return }
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      photoPath = `assets/${crypto.randomUUID()}.${extension}`
      const { error } = await client.storage.from("asset-photos").upload(photoPath, file, { contentType: file.type })
      if (error) { toast.error(`Photo upload failed: ${error.message}`); return }
    }

    const { error } = await client.from("assets").insert({
      building_id: values.building_id,
      building_name: values.building_name,
      managing_agency: values.agency_choice === "Other (Please Specify)" ? values.managing_agency_other?.trim() : values.agency_choice,
      location: values.location,
      ownership_status: values.ownership_status,
      condition: values.condition,
      estimated_repair_cost: values.estimated_repair_cost,
      last_inspected_date: values.last_inspected_date || null,
      photo_path: photoPath,
    })

    if (error) {
      toast.error(error.code === "23505" ? "That Building ID already exists." : `Could not register asset: ${error.message}`)
      return
    }

    await onAdded()
    toast.success("Asset registered successfully.")
    onClose()
  }

  return (
    <Modal title="Register Asset" onClose={onClose}>
      <p className="-mt-3 mb-5 text-sm text-muted-foreground">Add a government-owned building to the NGOBIA inventory.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property ID" required error={errors.building_id?.message}><input {...register("building_id")} className="field" placeholder="e.g. GOV-BLDG-004" /></Field>
          <Field label="Building Name" required error={errors.building_name?.message}><input {...register("building_name")} className="field" placeholder="e.g. Municipal Hall Annex" /></Field>
          <Field label="Managing Agency" required error={errors.agency_choice?.message || errors.managing_agency_other?.message}>
            <select {...register("agency_choice")} className="field"><option value="">Select Agency</option>{MANAGING_AGENCIES.map((value) => <option key={value}>{value}</option>)}</select>
            {agencyChoice === "Other (Please Specify)" && <div className="mt-3"><span className="mb-1.5 block text-xs font-medium">Specify Managing Agency <span className="text-primary">*</span></span><input {...register("managing_agency_other")} className="field" placeholder="Enter agency name" /></div>}
          </Field>
          <Field label="Location" required error={errors.location?.message}><input {...register("location")} className="field" placeholder="Barangay, Municipality, Province" /></Field>
          <Field label="Ownership Status" required error={errors.ownership_status?.message}><select {...register("ownership_status")} className="field"><option value="">Select Ownership Status</option>{OWNERSHIP_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Current Condition" required error={errors.condition?.message}><select {...register("condition")} className="field">{CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Estimated Repair Cost (PHP)" required error={errors.estimated_repair_cost?.message}><input {...register("estimated_repair_cost")} min="0" step="0.01" type="number" className="field" /></Field>
          <Field label="Last Inspected Date" error={errors.last_inspected_date?.message}><input {...register("last_inspected_date")} type="date" className="field" /></Field>
        </div>
        <Field label="Building Photograph (optional)" error={errors.photo?.message}>
          <input {...register("photo")} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-md border bg-background text-sm file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium" />
          <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP. Maximum 5 MB.</p>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="animate-spin" />}{isSubmitting ? "Registering..." : "Register asset"}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function AssetEditDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => Promise<void> }) {
  const knownAgency = MANAGING_AGENCIES.find((agency) => agency !== "Other (Please Specify)" && agency === asset.managing_agency)
  const knownOwnership = OWNERSHIP_STATUSES.find((status) => status === asset.ownership_status)
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      building_id: asset.building_id,
      building_name: asset.building_name,
      agency_choice: knownAgency ?? (asset.managing_agency ? "Other (Please Specify)" : undefined),
      managing_agency_other: knownAgency ? "" : asset.managing_agency ?? "",
      location: asset.location ?? "",
      ownership_status: knownOwnership,
      condition: asset.condition,
      estimated_repair_cost: asset.estimated_repair_cost,
      last_inspected_date: asset.last_inspected_date ?? "",
    },
  })
  const agencyChoice = useWatch({ control, name: "agency_choice" })

  const onSubmit = async (values: FormData) => {
    const client = createSupabaseBrowserClient()
    if (!client) { toast.error("Supabase is not configured."); return }

    const file = values.photo?.[0] as File | undefined
    let photoPath = asset.photo_path
    let uploadedPath: string | null = null
    if (file) {
      const allowed = ["image/jpeg", "image/png", "image/webp"]
      if (!allowed.includes(file.type)) { toast.error("Use a JPEG, PNG, or WebP photograph."); return }
      if (file.size > 5 * 1024 * 1024) { toast.error("Photographs must be 5 MB or smaller."); return }
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      uploadedPath = `assets/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await client.storage.from("asset-photos").upload(uploadedPath, file, { contentType: file.type })
      if (uploadError) { toast.error(`Photo upload failed: ${uploadError.message}`); return }
      photoPath = uploadedPath
    }

    const { error: updateError } = await client.from("assets").update({
      building_id: values.building_id,
      building_name: values.building_name,
      managing_agency: values.agency_choice === "Other (Please Specify)" ? values.managing_agency_other?.trim() : values.agency_choice,
      location: values.location,
      ownership_status: values.ownership_status,
      condition: values.condition,
      estimated_repair_cost: values.estimated_repair_cost,
      last_inspected_date: values.last_inspected_date || null,
      photo_path: photoPath,
    }).eq("building_id", asset.building_id)

    if (updateError) {
      if (uploadedPath) await client.storage.from("asset-photos").remove([uploadedPath])
      toast.error(updateError.code === "23505" ? "That Property ID already exists." : `Could not update asset: ${updateError.message}`)
      return
    }

    if (uploadedPath && asset.photo_path) {
      const { error: cleanupError } = await client.storage.from("asset-photos").remove([asset.photo_path])
      if (cleanupError) toast.warning("Asset updated, but the previous photograph could not be removed.")
    }

    await onSaved()
    toast.success("Asset updated successfully.")
    onClose()
  }

  return (
    <Modal title="Edit Asset" onClose={onClose}>
      <p className="-mt-3 mb-5 text-sm text-muted-foreground">Update the building record and save your changes to NGOBIA.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property ID" required error={errors.building_id?.message}><input {...register("building_id")} className="field" /></Field>
          <Field label="Building Name" required error={errors.building_name?.message}><input {...register("building_name")} className="field" /></Field>
          <Field label="Managing Agency" required error={errors.agency_choice?.message || errors.managing_agency_other?.message}>
            <select {...register("agency_choice")} className="field"><option value="">Select Agency</option>{MANAGING_AGENCIES.map((value) => <option key={value}>{value}</option>)}</select>
            {agencyChoice === "Other (Please Specify)" && <div className="mt-3"><span className="mb-1.5 block text-xs font-medium">Specify Managing Agency <span className="text-primary">*</span></span><input {...register("managing_agency_other")} className="field" placeholder="Enter agency name" /></div>}
          </Field>
          <Field label="Location" required error={errors.location?.message}><input {...register("location")} className="field" placeholder="Barangay, Municipality, Province" /></Field>
          <Field label="Ownership Status" required error={errors.ownership_status?.message}><select {...register("ownership_status")} className="field"><option value="">Select Ownership Status</option>{OWNERSHIP_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Current Condition" required error={errors.condition?.message}><select {...register("condition")} className="field">{CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Estimated Repair Cost (PHP)" required error={errors.estimated_repair_cost?.message}><input {...register("estimated_repair_cost")} min="0" step="0.01" type="number" className="field" /></Field>
          <Field label="Last Inspected Date" error={errors.last_inspected_date?.message}><input {...register("last_inspected_date")} type="date" className="field" /></Field>
        </div>
        <Field label="Replace Building Photograph (optional)" error={errors.photo?.message}>
          <input {...register("photo")} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-md border bg-background text-sm file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium" />
          <p className="mt-1 text-xs text-muted-foreground">Leave blank to keep the current photograph. JPEG, PNG, or WebP; maximum 5 MB.</p>
        </Field>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="animate-spin" />}{isSubmitting ? "Saving..." : "Save changes"}</Button></div>
      </form>
    </Modal>
  )
}

function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: unknown; children: React.ReactNode }) {
  return <label className="block text-sm font-medium"><span className="mb-1.5 block">{label}{required && <span className="ml-1 text-primary">*</span>}</span>{children}{typeof error === "string" && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}</label>
}

function Detail({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className={`mt-1 font-semibold ${prominent ? "text-base" : ""}`}>{value}</dd></div>
}

export function AssetsContent() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState<"All" | Condition>("All")
  const [agency, setAgency] = useState("All")
  const [selected, setSelected] = useState<Asset | null>(null)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [configured, setConfigured] = useState(true)

  const load = useCallback(async () => {
    const client = createSupabaseBrowserClient()
    if (!client) { setConfigured(false); setLoading(false); return }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await client.from("assets").select("building_id,building_name,managing_agency,location,ownership_status,condition,estimated_repair_cost,last_inspected_date,photo_path").order("building_id")
    if (queryError) setError(queryError.message)
    else setAssets((data ?? []).map((asset) => ({ ...asset, estimated_repair_cost: Number(asset.estimated_repair_cost) })) as Asset[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const agencyOptions = useMemo(() => Array.from(new Set(assets.map((asset) => asset.managing_agency).filter((value): value is string => Boolean(value)))).sort(), [assets])
  const filtered = useMemo(() => assets.filter((asset) => {
    const searchable = `${asset.building_id} ${asset.building_name} ${asset.managing_agency ?? ""} ${asset.location ?? ""}`.toLowerCase()
    return (condition === "All" || asset.condition === condition) && (agency === "All" || asset.managing_agency === agency) && searchable.includes(search.toLowerCase())
  }), [agency, assets, condition, search])

  const deleteAsset = async () => {
    if (!assetToDelete) return
    const client = createSupabaseBrowserClient()
    if (!client) { toast.error("Supabase is not configured."); return }
    setDeleting(true)

    const { error: deleteError } = await client.from("assets").delete().eq("building_id", assetToDelete.building_id)
    if (deleteError) {
      toast.error(`Could not delete asset: ${deleteError.message}`)
      setDeleting(false)
      return
    }

    if (assetToDelete.photo_path) {
      const { error: photoError } = await client.storage.from("asset-photos").remove([assetToDelete.photo_path])
      if (photoError) toast.warning("Asset deleted, but its photograph could not be removed from Storage.")
    }

    if (selected?.building_id === assetToDelete.building_id) setSelected(null)
    setAssetToDelete(null)
    setDeleting(false)
    await load()
    toast.success("Asset deleted permanently.")
  }

  return (
    <AppShell title="Assets Inquiry">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-2xl font-bold tracking-tight">Government Building Assets</h2><p className="mt-1 text-sm text-muted-foreground">Search, review, and add records in the national building inventory.</p></div>
        <Button onClick={() => setAdding(true)}><Plus />Add Asset</Button>
      </div>
      {!configured && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Supabase is not configured. Add the public URL and publishable key to <code>.env.local</code>.</div>}
      <div className="soft-shadow rounded-xl border bg-card">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(260px,1fr)_210px_210px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-9" placeholder="Search ID, name, agency, or location..." /></div>
          <select value={condition} onChange={(event) => setCondition(event.target.value as "All" | Condition)} className="field"><option value="All">All Conditions</option>{CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={agency} onChange={(event) => setAgency(event.target.value)} className="field"><option value="All">All Managing Agencies</option>{agencyOptions.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        {error ? <p className="p-5 text-sm text-destructive">Couldn&apos;t load assets: {error}</p> : loading ? <LoadingRows /> : filtered.length === 0 ? <EmptyState /> : <AssetResults assets={filtered} onView={setSelected} onDelete={setAssetToDelete} />}
      </div>
      {selected && <AssetDetailsDialog asset={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} />}
      {editing && <AssetEditDialog asset={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {adding && <AssetRegistrationDialog onClose={() => setAdding(false)} onAdded={load} />}
      <AlertDialog open={Boolean(assetToDelete)} onOpenChange={(open) => { if (!open && !deleting) setAssetToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-50 text-destructive"><Trash2 /></AlertDialogMedia>
            <AlertDialogTitle>Delete this asset permanently?</AlertDialogTitle>
            <AlertDialogDescription>This will delete <strong className="text-foreground">{assetToDelete?.building_name}</strong> and its associated photograph. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={(event) => { event.preventDefault(); void deleteAsset() }}>{deleting && <LoaderCircle className="animate-spin" />}{deleting ? "Deleting..." : "Delete permanently"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}

function AssetResults({ assets, onView, onDelete }: { assets: Asset[]; onView: (asset: Asset) => void; onDelete: (asset: Asset) => void }) {
  return <>
    <div className="hidden overflow-hidden xl:block">
      <table className="w-full table-fixed text-left text-[11px] leading-tight">
        <colgroup><col className="w-[9%]" /><col className="w-[16%]" /><col className="w-[9%]" /><col className="w-[18%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[6%]" /></colgroup>
        <thead className="bg-muted/50 text-[9px] tracking-wide text-muted-foreground uppercase"><tr><th className="px-2 py-2.5 font-medium">Property ID</th><th className="px-2 py-2.5 font-medium">Building Name</th><th className="px-2 py-2.5 font-medium">Agency</th><th className="px-2 py-2.5 font-medium">Location</th><th className="px-2 py-2.5 font-medium">Ownership</th><th className="px-2 py-2.5 font-medium">Condition</th><th className="px-2 py-2.5 text-right font-medium">Repair Cost</th><th className="px-2 py-2.5 font-medium">Inspected</th><th className="px-2 py-2.5 text-right font-medium">Actions</th></tr></thead>
        <tbody>{assets.map((asset) => <tr key={asset.building_id} className="border-t hover:bg-muted/30"><CompactCell value={asset.building_id} strong /><CompactCell value={asset.building_name} /><CompactCell value={asset.managing_agency || "—"} /><CompactCell value={asset.location || "—"} /><CompactCell value={asset.ownership_status || "—"} /><td className="px-2 py-2.5"><ConditionBadge condition={asset.condition} /></td><td className="truncate px-2 py-2.5 text-right font-medium" title={peso.format(asset.estimated_repair_cost)}>{peso.format(asset.estimated_repair_cost)}</td><CompactCell value={asset.last_inspected_date ? formatInspectionDate(asset.last_inspected_date) : "—"} /><td className="px-2 py-2.5"><div className="flex justify-end gap-1"><Button size="icon-sm" variant="outline" aria-label={`View ${asset.building_name}`} title="View" onClick={() => onView(asset)}><Eye /></Button><Button size="icon-sm" variant="destructive" aria-label={`Delete ${asset.building_name}`} title="Delete" onClick={() => onDelete(asset)}><Trash2 /></Button></div></td></tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 p-3 xl:hidden">{assets.map((asset) => <article key={asset.building_id} className="rounded-lg border bg-background p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-primary">{asset.building_id}</p><h3 className="mt-1 font-semibold">{asset.building_name}</h3></div><ConditionBadge condition={asset.condition} /></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><CardDetail label="Managing Agency" value={asset.managing_agency || "—"} /><CardDetail label="Location" value={asset.location || "—"} /><CardDetail label="Ownership Status" value={asset.ownership_status || "—"} /><CardDetail label="Repair Cost" value={peso.format(asset.estimated_repair_cost)} /><CardDetail label="Last Inspected" value={asset.last_inspected_date ? formatInspectionDate(asset.last_inspected_date) : "—"} /></dl><div className="mt-4 flex justify-end gap-2 border-t pt-3"><Button size="sm" variant="outline" onClick={() => onView(asset)}><Eye />View</Button><Button size="sm" variant="destructive" onClick={() => onDelete(asset)}><Trash2 />Delete</Button></div></article>)}</div>
  </>
}

function CompactCell({ value, strong = false }: { value: string; strong?: boolean }) { return <td className={`truncate px-2 py-2.5 ${strong ? "font-semibold" : ""}`} title={value}>{value}</td> }
function CardDetail({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div> }

function LoadingRows() { return <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-muted" />)}</div> }
function EmptyState() { return <div className="grid min-h-60 place-items-center p-6 text-center"><div><Search className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No matching assets found</p><p className="mt-1 text-sm text-muted-foreground">Try another search or condition filter.</p></div></div> }
