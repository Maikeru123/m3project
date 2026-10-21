"use client"

import { Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { peso } from "@/lib/types/asset"

type Counts = {
  total_buildings: number
  good: number
  minor_repair: number
  major_repair: number
  total_rehabilitation: number
  demolished: number
  condemned: number
  not_inspected: number
  total_estimated_cost: number
}
type AgencyRow = Counts & { agency: string; total_book_value: number; total_appraised_value: number }
type YearRow = Counts & { calendar_year: string }

export function ReportsContent() {
  const [agencyRows, setAgencyRows] = useState<AgencyRow[]>([])
  const [yearRows, setYearRows] = useState<YearRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const client = createSupabaseBrowserClient()
      if (!client) { setError("Supabase is not configured."); setLoading(false); return }
      Promise.all([
        client.from("report_by_agency").select("*").order("agency"),
        client.from("report_by_inspection_year").select("*").order("calendar_year", { ascending: false }),
      ]).then(([agency, year]) => {
        if (!active) return
        if (agency.error || year.error) setError(agency.error?.message ?? year.error?.message ?? "Could not load reports.")
        else { setAgencyRows((agency.data ?? []) as AgencyRow[]); setYearRows((year.data ?? []) as YearRow[]) }
        setLoading(false)
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])

  const generated = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date())
  return <AppShell title="Reports">
    <div className="report-screen-only mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Inventory summaries</p><h2 className="mt-1 text-2xl font-bold">Reports</h2><p className="mt-1 text-sm text-muted-foreground">Current building counts use each building&apos;s latest inspection.</p></div><Button onClick={() => window.print()} disabled={loading || Boolean(error)}><Printer />Print reports</Button></div>
    <div className="report-sheet space-y-8 rounded-xl border bg-card p-5 shadow-sm sm:p-7">
      <header className="report-print-header hidden"><p className="text-xs font-bold tracking-wide uppercase">NGOBIA · Building inventory</p><p className="text-xs">Generated {generated}</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="space-y-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded bg-muted" />)}</div> : !error && <>
        <section className="report-section"><div className="mb-4"><p className="text-xs font-semibold tracking-wide text-primary uppercase">DPWH-QMSP-16-25</p><h3 className="mt-1 text-lg font-bold">Buildings by agency</h3><p className="text-xs text-muted-foreground">Includes buildings marked for Agency Inventory. Condition is from the latest inspection.</p></div>
          <div className="overflow-x-auto"><table className="report-table w-full min-w-[1050px] border-collapse text-left text-xs"><thead><tr><Th>Agency</Th><Th>Buildings</Th><Th>Good</Th><Th>Minor</Th><Th>Major</Th><Th>Rehab</Th><Th>Demolished</Th><Th>Condemned</Th><Th>Uninspected</Th><Th>Estimated cost</Th><Th>Book value</Th><Th>Appraised value</Th></tr></thead><tbody>{agencyRows.length ? agencyRows.map((row) => <tr key={row.agency}><Td strong>{row.agency}</Td><CountCells row={row} /><Td money>{peso.format(Number(row.total_estimated_cost))}</Td><Td money>{peso.format(Number(row.total_book_value))}</Td><Td money>{peso.format(Number(row.total_appraised_value))}</Td></tr>) : <tr><td colSpan={12} className="border p-4 text-center text-muted-foreground">No buildings are marked for Agency Inventory yet.</td></tr>}</tbody></table></div>
        </section>
        <section className="report-section"><div className="mb-4"><p className="text-xs font-semibold tracking-wide text-primary uppercase">DPWH-QMSP-16-26</p><h3 className="mt-1 text-lg font-bold">Buildings by latest inspection year</h3><p className="text-xs text-muted-foreground">One row per building, grouped by the date of its latest visit. Missing dates appear as Undated.</p></div>
          <div className="overflow-x-auto"><table className="report-table w-full min-w-[850px] border-collapse text-left text-xs"><thead><tr><Th>Year</Th><Th>Buildings</Th><Th>Good</Th><Th>Minor</Th><Th>Major</Th><Th>Rehab</Th><Th>Demolished</Th><Th>Condemned</Th><Th>Uninspected</Th><Th>Estimated cost</Th></tr></thead><tbody>{yearRows.length ? yearRows.map((row) => <tr key={row.calendar_year}><Td strong>{row.calendar_year}</Td><CountCells row={row} /><Td money>{peso.format(Number(row.total_estimated_cost))}</Td></tr>) : <tr><td colSpan={10} className="border p-4 text-center text-muted-foreground">No buildings to report yet.</td></tr>}</tbody></table></div>
        </section>
      </>}
      <footer className="border-t pt-3 text-xs text-muted-foreground">Academic demonstration · Generated {generated}</footer>
    </div>
  </AppShell>
}

function Th({ children }: { children: React.ReactNode }) { return <th scope="col" className="border bg-muted/60 px-2.5 py-2.5 font-semibold">{children}</th> }
function Td({ children, strong = false, money = false }: { children: React.ReactNode; strong?: boolean; money?: boolean }) { return <td className={`border px-2.5 py-2.5 ${strong ? "font-medium" : ""} ${money ? "whitespace-nowrap text-right" : ""}`}>{children}</td> }
function CountCells({ row }: { row: Counts }) { return <><Td>{row.total_buildings}</Td><Td>{row.good}</Td><Td>{row.minor_repair}</Td><Td>{row.major_repair}</Td><Td>{row.total_rehabilitation}</Td><Td>{row.demolished}</Td><Td>{row.condemned}</Td><Td>{row.not_inspected}</Td></> }
