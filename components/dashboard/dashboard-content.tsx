"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowRight, Building2, CheckCircle2, CircleDollarSign, ClipboardList, Eye, Plus, ShieldAlert, TriangleAlert } from "lucide-react"
import { AssetRegistrationDialog } from "@/components/assets/building-registration-dialog"
import { BuildingDetailsDialog } from "@/components/assets/building-details-dialog"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { AppShell } from "@/components/layout/app-shell"
import { AssetMap } from "@/components/dashboard/asset-map"
import { Button } from "@/components/ui/button"
import { fetchBuildings } from "@/lib/supabase/buildings"
import { CONDITION_COLORS, DISPLAY_CONDITIONS, type Asset, type BuildingCondition, peso } from "@/lib/types/asset"

const compactPeso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 })

export function DashboardContent() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Asset | null>(null)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchBuildings()
    setConfigured(result.configured)
    if (result.error) setError(result.error)
    else setAssets(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAssets() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAssets])

  const conditionData = useMemo(() => DISPLAY_CONDITIONS.map((name) => {
    const conditionAssets = assets.filter((asset) => asset.condition === name)
    const value = conditionAssets.length
    return {
      name,
      value,
      percentage: assets.length ? (value / assets.length) * 100 : 0,
      cost: conditionAssets.reduce((sum, asset) => sum + (asset.estimated_cost ?? 0), 0),
    }
  }), [assets])

  const totalEstimatedCost = assets.reduce((sum, asset) => sum + (asset.estimated_cost ?? 0), 0)
  const goodCount = conditionData.find((item) => item.name === "Good")?.value ?? 0
  const repairCount = assets.filter((asset) => ["Minor Repair", "Major Repair", "Total Rehabilitation"].includes(asset.condition)).length
  const restrictedCount = assets.filter((asset) => asset.condition === "Condemned" || asset.condition === "Demolished").length
  const uninspectedCount = conditionData.find((item) => item.name === "Not inspected")?.value ?? 0

  const attentionAssets = useMemo(() => assets
    .filter((asset) => ["Condemned", "Demolished", "Total Rehabilitation", "Major Repair"].includes(asset.condition))
    .sort((a, b) => {
      const conditionOrder = (condition: BuildingCondition) => condition === "Condemned" || condition === "Demolished" ? 0 : condition === "Total Rehabilitation" ? 1 : 2
      return conditionOrder(a.condition) - conditionOrder(b.condition) || (b.estimated_cost ?? 0) - (a.estimated_cost ?? 0)
    }), [assets])

  const stats = [
    { label: "Registered buildings", value: assets.length.toLocaleString("en-PH"), helper: "One record per building", icon: Building2, tone: "bg-blue-50 text-blue-700" },
    { label: "Good condition", value: goodCount.toLocaleString("en-PH"), helper: "Latest inspection", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Repair or rehabilitation", value: repairCount.toLocaleString("en-PH"), helper: "Latest inspection", icon: TriangleAlert, tone: "bg-amber-50 text-amber-700" },
    { label: "Restricted or demolished", value: restrictedCount.toLocaleString("en-PH"), helper: "Latest inspection", icon: ShieldAlert, tone: "bg-red-100 text-red-900" },
    { label: "Not inspected", value: uninspectedCount.toLocaleString("en-PH"), helper: "Awaiting first visit", icon: ClipboardList, tone: "bg-slate-100 text-slate-700" },
    { label: "Total estimated cost", value: peso.format(totalEstimatedCost), helper: "Building records", icon: CircleDollarSign, tone: "bg-red-50 text-primary" },
  ]

  return (
    <AppShell title="NGOBIA Dashboard">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">NGOBIA Dashboard</h2><p className="mt-1 text-sm text-muted-foreground">Buildings and the findings from their latest site visits.</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setAdding(true)}><Plus />Add building</Button><Link href="/inspections" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted">New inspection <ArrowRight className="size-4" /></Link></div>
      </div>

      {!configured && <SetupNotice />}
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Couldn&apos;t load assets: {error}. Check the Supabase setup and policies, then refresh.</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, helper, icon: Icon, tone }) => (
          <article key={label} className="soft-shadow rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1.5 truncate text-xl font-bold tracking-tight sm:text-2xl">{loading ? "—" : value}</p><p className="mt-1 text-[11px] text-muted-foreground">{helper}</p></div><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-4.5" /></span></div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AssetMap assets={assets} loading={loading} />
        <DashboardCard title="Asset Condition Distribution" description="Share of registered buildings by current condition">
          {loading ? <ChartSkeleton /> : assets.length === 0 ? <ChartEmpty /> : (
            <div className="grid items-center gap-2">
              <div className="relative h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={conditionData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={3}>{conditionData.map((entry) => <Cell key={entry.name} fill={CONDITION_COLORS[entry.name]} />)}</Pie><Tooltip formatter={(value) => [`${Number(value)} asset${Number(value) === 1 ? "" : "s"}`, "Buildings"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-2xl font-bold">{assets.length}</p><p className="text-[11px] text-muted-foreground">Total assets</p></div></div></div>
              <div className="space-y-3">{conditionData.map((item) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[item.name] }} />{item.name}</span><span className="text-muted-foreground"><strong className="text-foreground">{item.value}</strong> · {item.percentage.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: CONDITION_COLORS[item.name] }} /></div></div>)}</div>
            </div>
          )}
        </DashboardCard>
      </section>
      <section className="mt-5">
        <DashboardCard title="Estimated building cost" description="Cost grouped by latest inspection condition">
          {loading ? <ChartSkeleton /> : assets.length === 0 ? <ChartEmpty /> : <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={conditionData} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" tickFormatter={(value) => compactPeso.format(Number(value))} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={132} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [peso.format(Number(value)), "Estimated cost"]} /><Bar dataKey="cost" radius={[0, 5, 5, 0]}>{conditionData.map((entry) => <Cell key={entry.name} fill={CONDITION_COLORS[entry.name]} />)}</Bar></BarChart></ResponsiveContainer></div>}
        </DashboardCard>
      </section>

      <section className="mt-5"><DataTableCard title="Buildings needing attention" description="Latest inspection findings" actionLabel="View buildings" assets={attentionAssets} loading={loading} emptyText="No buildings currently need urgent attention." showAction onSelect={setSelected} /></section>
      <section className="mt-5"><DataTableCard title="Buildings overview" description="Registered buildings by ID" actionLabel="View all buildings" assets={assets.slice(0, 8)} loading={loading} emptyText="No buildings registered yet." onSelect={setSelected} /></section>

      {selected && <BuildingDetailsDialog asset={selected} onClose={() => setSelected(null)} />}
      {adding && <AssetRegistrationDialog onClose={() => setAdding(false)} onAdded={loadAssets} />}
    </AppShell>
  )
}

function DashboardCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <article className="soft-shadow min-w-0 rounded-xl border bg-card p-5"><div className="mb-3"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>{children}</article>
}

function DataTableCard({ title, description, actionLabel, assets, loading, emptyText, showAction = false, onSelect }: { title: string; description: string; actionLabel: string; assets: Asset[]; loading: boolean; emptyText: string; showAction?: boolean; onSelect: (asset: Asset) => void }) {
  return <article className="soft-shadow overflow-hidden rounded-xl border bg-card"><div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Link href="/assets" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{actionLabel}<ArrowRight className="size-3.5" /></Link></div>{loading ? <LoadingRows /> : assets.length === 0 ? <div className="flex min-h-36 flex-col items-center justify-center p-5 text-center"><ClipboardList className="mb-2 size-7 text-muted-foreground" /><p className="text-sm font-medium">{emptyText}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/50 text-[11px] tracking-wide text-muted-foreground uppercase"><tr><th className="px-5 py-3 font-medium">Property ID</th><th className="px-5 py-3 font-medium">Building Name</th><th className="px-5 py-3 font-medium">Condition</th><th className="px-5 py-3 text-right font-medium">Estimated Cost</th>{showAction && <th className="px-5 py-3 text-right font-medium">View Details</th>}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.building_id} className="border-t hover:bg-muted/30"><td className="px-5 py-3 font-semibold">{asset.building_id}</td><td className="px-5 py-3">{asset.building_name}</td><td className="px-5 py-3"><ConditionBadge condition={asset.condition} /></td><td className="px-5 py-3 text-right font-medium">{asset.estimated_cost == null ? "—" : peso.format(asset.estimated_cost)}</td>{showAction && <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onSelect(asset)}><Eye />View</Button></td>}</tr>)}</tbody></table></div>}</article>
}

function LoadingRows() { return <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded bg-muted" />)}</div> }
function ChartSkeleton() { return <div className="mt-5 h-64 animate-pulse rounded-lg bg-muted" /> }
function ChartEmpty() { return <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">No asset information to display yet.</div> }
function SetupNotice() { return <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Supabase is not configured.</strong> Add the public Supabase URL and publishable key to <code>.env.local</code>.</div> }
