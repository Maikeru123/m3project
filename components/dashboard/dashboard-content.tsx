"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowRight, Building2, CheckCircle2, CircleDollarSign, ClipboardList, Eye, Plus, ShieldAlert, Sigma, TriangleAlert } from "lucide-react"
import { AssetDetailsDialog, AssetRegistrationDialog } from "@/components/assets/assets-content"
import { ConditionBadge } from "@/components/assets/condition-badge"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { CONDITION_COLORS, CONDITIONS, type Asset, type Condition, peso } from "@/lib/types/asset"

const compactPeso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 })

export function DashboardContent() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Asset | null>(null)

  const loadAssets = useCallback(async () => {
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
    const timer = window.setTimeout(() => { void loadAssets() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAssets])

  const conditionData = useMemo(() => CONDITIONS.map((name) => {
    const conditionAssets = assets.filter((asset) => asset.condition === name)
    const value = conditionAssets.length
    return {
      name,
      value,
      percentage: assets.length ? (value / assets.length) * 100 : 0,
      cost: conditionAssets.reduce((sum, asset) => sum + asset.estimated_repair_cost, 0),
    }
  }), [assets])

  const totalRepairCost = assets.reduce((sum, asset) => sum + asset.estimated_repair_cost, 0)
  const goodCount = conditionData.find((item) => item.name === "Good")?.value ?? 0
  const repairCount = assets.filter((asset) => asset.condition === "Minor Repair" || asset.condition === "Major Repair").length
  const condemnedCount = conditionData.find((item) => item.name === "Condemned")?.value ?? 0
  const averageRepairCost = assets.length ? totalRepairCost / assets.length : 0

  const attentionAssets = useMemo(() => assets
    .filter((asset) => asset.condition === "Condemned" || asset.condition === "Major Repair")
    .sort((a, b) => {
      const conditionOrder = (condition: Condition) => condition === "Condemned" ? 0 : 1
      return conditionOrder(a.condition) - conditionOrder(b.condition) || b.estimated_repair_cost - a.estimated_repair_cost
    }), [assets])

  const stats = [
    { label: "Total Registered Assets", value: assets.length.toLocaleString("en-PH"), helper: "All inventory records", icon: Building2, tone: "bg-blue-50 text-blue-700" },
    { label: "Assets in Good Condition", value: goodCount.toLocaleString("en-PH"), helper: "No repairs indicated", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Assets Requiring Repair", value: repairCount.toLocaleString("en-PH"), helper: "Minor or major repair", icon: TriangleAlert, tone: "bg-amber-50 text-amber-700" },
    { label: "Condemned Assets", value: condemnedCount.toLocaleString("en-PH"), helper: "Restricted from ordinary use", icon: ShieldAlert, tone: "bg-red-100 text-red-900" },
    { label: "Total Estimated Repair Cost", value: peso.format(totalRepairCost), helper: "Across all registered assets", icon: CircleDollarSign, tone: "bg-red-50 text-primary" },
    { label: "Average Estimated Repair Cost", value: peso.format(averageRepairCost), helper: "Per registered asset", icon: Sigma, tone: "bg-violet-50 text-violet-700" },
  ]

  return (
    <AppShell title="NGOBIA Dashboard">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">NGOBIA Dashboard</h2><p className="mt-1 text-sm text-muted-foreground">Overview of government-owned building assets and maintenance conditions.</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setAdding(true)}><Plus />Add Asset</Button><Link href="/assets" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted">Assets Inquiry <ArrowRight className="size-4" /></Link></div>
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

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <DashboardCard title="Asset Condition Distribution" description="Share of registered buildings by current condition">
          {loading ? <ChartSkeleton /> : assets.length === 0 ? <ChartEmpty /> : (
            <div className="grid items-center gap-2 md:grid-cols-[1.1fr_.9fr]">
              <div className="relative h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={conditionData} dataKey="value" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={3}>{conditionData.map((entry) => <Cell key={entry.name} fill={CONDITION_COLORS[entry.name]} />)}</Pie><Tooltip formatter={(value) => [`${Number(value)} asset${Number(value) === 1 ? "" : "s"}`, "Buildings"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-2xl font-bold">{assets.length}</p><p className="text-[11px] text-muted-foreground">Total assets</p></div></div></div>
              <div className="space-y-3">{conditionData.map((item) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[item.name] }} />{item.name}</span><span className="text-muted-foreground"><strong className="text-foreground">{item.value}</strong> · {item.percentage.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: CONDITION_COLORS[item.name] }} /></div></div>)}</div>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Maintenance Cost Overview" description="Estimated repair cost grouped by asset condition">
          {loading ? <ChartSkeleton /> : assets.length === 0 ? <ChartEmpty /> : <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={conditionData} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => compactPeso.format(Number(value))} tick={{ fontSize: 10 }} width={58} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [peso.format(Number(value)), "Estimated cost"]} /><Bar dataKey="cost" radius={[5, 5, 0, 0]}>{conditionData.map((entry) => <Cell key={entry.name} fill={CONDITION_COLORS[entry.name]} />)}</Bar></BarChart></ResponsiveContainer></div>}
        </DashboardCard>
      </section>

      <section className="mt-5"><DataTableCard title="Assets Requiring Attention" description="Condemned assets first, followed by major repairs ranked by estimated cost" actionLabel="View complete inventory" assets={attentionAssets} loading={loading} emptyText="No condemned or major-repair assets require attention." showAction onSelect={setSelected} /></section>
      <section className="mt-5"><DataTableCard title="Assets Overview" description="Registered assets sorted consistently by Building ID" actionLabel="View all assets" assets={assets.slice(0, 8)} loading={loading} emptyText="No assets have been registered yet." onSelect={setSelected} /></section>

      {selected && <AssetDetailsDialog asset={selected} onClose={() => setSelected(null)} />}
      {adding && <AssetRegistrationDialog onClose={() => setAdding(false)} onAdded={loadAssets} />}
    </AppShell>
  )
}

function DashboardCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <article className="soft-shadow min-w-0 rounded-xl border bg-card p-5"><div className="mb-3"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>{children}</article>
}

function DataTableCard({ title, description, actionLabel, assets, loading, emptyText, showAction = false, onSelect }: { title: string; description: string; actionLabel: string; assets: Asset[]; loading: boolean; emptyText: string; showAction?: boolean; onSelect: (asset: Asset) => void }) {
  return <article className="soft-shadow overflow-hidden rounded-xl border bg-card"><div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Link href="/assets" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{actionLabel}<ArrowRight className="size-3.5" /></Link></div>{loading ? <LoadingRows /> : assets.length === 0 ? <div className="flex min-h-36 flex-col items-center justify-center p-5 text-center"><ClipboardList className="mb-2 size-7 text-muted-foreground" /><p className="text-sm font-medium">{emptyText}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/50 text-[11px] tracking-wide text-muted-foreground uppercase"><tr><th className="px-5 py-3 font-medium">Property ID</th><th className="px-5 py-3 font-medium">Building Name</th><th className="px-5 py-3 font-medium">Condition</th><th className="px-5 py-3 text-right font-medium">Estimated Repair Cost</th>{showAction && <th className="px-5 py-3 text-right font-medium">View Details</th>}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.building_id} className="border-t hover:bg-muted/30"><td className="px-5 py-3 font-semibold">{asset.building_id}</td><td className="px-5 py-3">{asset.building_name}</td><td className="px-5 py-3"><ConditionBadge condition={asset.condition} /></td><td className="px-5 py-3 text-right font-medium">{peso.format(asset.estimated_repair_cost)}</td>{showAction && <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onSelect(asset)}><Eye />View</Button></td>}</tr>)}</tbody></table></div>}</article>
}

function LoadingRows() { return <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded bg-muted" />)}</div> }
function ChartSkeleton() { return <div className="mt-5 h-64 animate-pulse rounded-lg bg-muted" /> }
function ChartEmpty() { return <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">No asset information to display yet.</div> }
function SetupNotice() { return <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Supabase is not configured.</strong> Add the public Supabase URL and publishable key to <code>.env.local</code>.</div> }
