"use client"

import { Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { peso } from "@/lib/types/asset"

const STORAGE_KEY = "ngobia-report-draft-v1"
const countKeys = ["total_buildings", "good", "minor_repair", "major_repair", "total_rehabilitation", "demolished", "condemned", "not_inspected"] as const
type CountKey = (typeof countKeys)[number]
type CountValues = Record<CountKey, string> & { total_estimated_cost: string }
type AgencyRow = CountValues & { id: string; agency: string; total_book_value: string; total_appraised_value: string }
type YearRow = CountValues & { id: string; calendar_year: string }
type ReportDraft = { agencyRows: AgencyRow[]; yearRows: YearRow[]; note: string }
type Column<T> = { key: keyof T; label: string; kind?: "money" | "text" }

const countColumns: Column<CountValues>[] = countKeys.map((key, index) => ({ key, label: ["Buildings", "Good", "Minor", "Major", "Rehab", "Demolished", "Condemned", "Uninspected"][index] }))
const agencyColumns: Column<AgencyRow>[] = [
  { key: "agency", label: "Agency", kind: "text" },
  ...countColumns,
  { key: "total_estimated_cost", label: "Estimated cost", kind: "money" },
  { key: "total_book_value", label: "Book value", kind: "money" },
  { key: "total_appraised_value", label: "Appraised value", kind: "money" },
]
const yearColumns: Column<YearRow>[] = [
  { key: "calendar_year", label: "Year", kind: "text" },
  ...countColumns,
  { key: "total_estimated_cost", label: "Estimated cost", kind: "money" },
]

function countValues(row: Record<string, unknown>): CountValues {
  return {
    total_buildings: String(row.total_buildings ?? 0), good: String(row.good ?? 0),
    minor_repair: String(row.minor_repair ?? 0), major_repair: String(row.major_repair ?? 0),
    total_rehabilitation: String(row.total_rehabilitation ?? 0), demolished: String(row.demolished ?? 0),
    condemned: String(row.condemned ?? 0), not_inspected: String(row.not_inspected ?? 0),
    total_estimated_cost: String(row.total_estimated_cost ?? 0),
  }
}

function emptyCounts(): CountValues { return countValues({}) }
function formatValue(value: string, money: boolean) { return money && value !== "" ? peso.format(Number(value)) : value || "—" }

export function ReportsContent() {
  const [draft, setDraft] = useState<ReportDraft | null>(null)
  const [live, setLive] = useState<ReportDraft | null>(null)
  const [hasManualDraft, setHasManualDraft] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      let saved: ReportDraft | null = null
      try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
        if (parsed && Array.isArray(parsed.agencyRows) && Array.isArray(parsed.yearRows) && typeof parsed.note === "string") saved = parsed
      } catch { /* Ignore a damaged browser draft. */ }
      const client = createSupabaseBrowserClient()
      if (!client) {
        if (active) { setDraft(saved); setHasManualDraft(Boolean(saved)); setError("Supabase is not configured."); setLoading(false) }
        return
      }
      const [agency, year] = await Promise.all([
        client.from("report_by_agency").select("*").order("agency"),
        client.from("report_by_inspection_year").select("*").order("calendar_year", { ascending: false }),
      ])
      if (!active) return
      if (agency.error || year.error) {
        setError(agency.error?.message ?? year.error?.message ?? "Could not load reports.")
        setDraft(saved)
      } else {
        const source: ReportDraft = {
          agencyRows: (agency.data ?? []).map((row, index) => ({ ...countValues(row), id: `agency-${index}`, agency: String(row.agency ?? ""), total_book_value: String(row.total_book_value ?? 0), total_appraised_value: String(row.total_appraised_value ?? 0) })),
          yearRows: (year.data ?? []).map((row, index) => ({ ...countValues(row), id: `year-${index}`, calendar_year: String(row.calendar_year ?? "") })),
          note: "",
        }
        setLive(source)
        setDraft(saved ?? source)
      }
      setHasManualDraft(Boolean(saved))
      setLoading(false)
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (draft && hasManualDraft) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)) } catch { /* Editing and printing still work without storage. */ }
    }
  }, [draft, hasManualDraft])

  function changeDraft(update: (current: ReportDraft) => ReportDraft) {
    setDraft((current) => current ? update(current) : current)
    setHasManualDraft(true)
  }

  function changeCell(section: "agencyRows" | "yearRows", id: string, key: string, value: string) {
    changeDraft((current) => ({
      ...current,
      [section]: current[section].map((row) => row.id === id ? { ...row, [key]: value } : row),
    }))
  }

  function addRow(section: "agencyRows" | "yearRows") {
    const id = window.crypto.randomUUID()
    changeDraft((current) => section === "agencyRows"
      ? { ...current, agencyRows: [...current.agencyRows, { ...emptyCounts(), id, agency: "", total_book_value: "0", total_appraised_value: "0" }] }
      : { ...current, yearRows: [...current.yearRows, { ...emptyCounts(), id, calendar_year: "" }] })
  }

  function removeRow(section: "agencyRows" | "yearRows", id: string) {
    changeDraft((current) => ({ ...current, [section]: current[section].filter((row) => row.id !== id) }))
  }

  function restoreLive() {
    if (!live) return
    setDraft(live)
    setHasManualDraft(false)
    setEditing(false)
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* Ignore unavailable storage. */ }
  }

  const generated = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date())
  return <AppShell title="Reports">
    <div className="report-screen-only mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Inventory summaries</p><h2 className="mt-1 text-2xl font-bold">Reports</h2><p className="mt-1 text-sm text-muted-foreground">Edit the report figures and print the version shown below.</p></div>
      <div className="flex flex-wrap gap-2">
        {hasManualDraft && live && <Button variant="outline" onClick={restoreLive}><RotateCcw />Restore live data</Button>}
        <Button variant="outline" onClick={() => setEditing((value) => !value)} disabled={!draft}><Pencil />{editing ? "Done editing" : "Edit report"}</Button>
        <Button onClick={() => window.print()} disabled={!draft}><Printer />Print report</Button>
      </div>
    </div>
    {hasManualDraft && <p className="report-screen-only mb-4 text-sm text-muted-foreground">Manual changes are saved in this browser and appear in the printed report. They do not change building or inspection records.</p>}
    {error && <p role="alert" className="report-screen-only mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{draft ? " Showing your saved report draft." : ""}</p>}
    <div className="report-sheet space-y-8 rounded-xl border bg-card p-5 shadow-sm sm:p-7">
      <header className="report-print-header hidden"><p className="text-xs font-bold tracking-wide uppercase">Database Management Project Module 3 · Building inventory</p><p className="text-xs">Generated {generated}</p></header>
      {loading ? <div className="space-y-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded bg-muted" />)}</div> : draft ? <>
        <ReportSection title="Buildings by agency" code="DPWH-QMSP-16-25" description="Includes buildings marked for Agency Inventory. Condition is from the latest inspection." columns={agencyColumns} rows={draft.agencyRows} editing={editing} emptyText="No buildings are marked for Agency Inventory yet." onCellChange={(id, key, value) => changeCell("agencyRows", id, String(key), value)} onAdd={() => addRow("agencyRows")} onRemove={(id) => removeRow("agencyRows", id)} />
        <ReportSection title="Buildings by latest inspection year" code="DPWH-QMSP-16-26" description="One row per building, grouped by the date of its latest visit. Missing dates appear as Undated." columns={yearColumns} rows={draft.yearRows} editing={editing} emptyText="No buildings to report yet." onCellChange={(id, key, value) => changeCell("yearRows", id, String(key), value)} onAdd={() => addRow("yearRows")} onRemove={(id) => removeRow("yearRows", id)} />
        {(editing || draft.note) && <section className="report-note"><h3 className="mb-2 text-sm font-semibold">Report notes</h3>{editing ? <><textarea className="report-edit-input field min-h-24 resize-y py-2" aria-label="Report notes" value={draft.note} onChange={(event) => changeDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add notes for this report" /><p className="report-print-value hidden whitespace-pre-wrap text-sm">{draft.note}</p></> : <p className="whitespace-pre-wrap text-sm">{draft.note}</p>}</section>}
      </> : !error && <p className="text-sm text-muted-foreground">No report data is available.</p>}
      <footer className="border-t pt-3 text-xs text-muted-foreground">Academic demonstration · Generated {generated}</footer>
    </div>
  </AppShell>
}

function ReportSection<T extends { id: string }>({ title, code, description, columns, rows, editing, emptyText, onCellChange, onAdd, onRemove }: {
  title: string; code: string; description: string; columns: Column<T>[]; rows: T[]; editing: boolean; emptyText: string;
  onCellChange: (id: string, key: keyof T, value: string) => void; onAdd: () => void; onRemove: (id: string) => void
}) {
  return <section className="report-section">
    <div className="mb-4"><p className="text-xs font-semibold tracking-wide text-primary uppercase">{code}</p><h3 className="mt-1 text-lg font-bold">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
    <div className="overflow-x-auto"><table className="report-table w-full min-w-[1050px] border-collapse text-left text-xs"><thead><tr>{columns.map((column) => <th key={String(column.key)} scope="col" className="border bg-muted/60 px-2.5 py-2.5 font-semibold">{column.label}</th>)}{editing && <th className="report-screen-only border bg-muted/60 px-2.5 py-2.5" scope="col">Actions</th>}</tr></thead><tbody>
      {rows.length ? rows.map((row) => <tr key={row.id}>{columns.map((column) => {
        const value = String(row[column.key] ?? "")
        const money = column.kind === "money"
        return <td key={String(column.key)} className={`border px-2.5 py-2.5 ${money ? "whitespace-nowrap text-right" : ""} ${column.kind === "text" ? "font-medium" : ""}`}>
          {editing ? <><input className="report-edit-input field h-8 min-w-16 px-2 text-xs" aria-label={`${column.label} for ${title} row`} type="text" inputMode={column.kind === "text" ? "text" : money ? "decimal" : "numeric"} value={value} onChange={(event) => { const next = event.target.value; if (column.kind === "text" || (money ? /^\d*(\.\d{0,2})?$/.test(next) : /^\d*$/.test(next))) onCellChange(row.id, column.key, next) }} /><span className="report-print-value hidden">{formatValue(value, money)}</span></> : formatValue(value, money)}
        </td>
      })}{editing && <td className="report-screen-only border px-2.5 py-2.5"><button type="button" className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label={`Remove ${title} row`} onClick={() => onRemove(row.id)}><Trash2 className="size-4" /></button></td>}</tr>) : <tr><td colSpan={columns.length + (editing ? 1 : 0)} className="border p-4 text-center text-muted-foreground">{emptyText}</td></tr>}
    </tbody></table></div>
    {editing && <Button className="report-screen-only mt-3" variant="outline" size="sm" onClick={onAdd}><Plus />Add row</Button>}
  </section>
}
