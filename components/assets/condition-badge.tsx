import { type Condition } from "@/lib/types/asset"

const styles: Record<Condition, string> = {
  Good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Minor Repair": "border-amber-200 bg-amber-50 text-amber-700",
  "Major Repair": "border-orange-200 bg-orange-50 text-orange-700",
  Condemned: "border-red-300 bg-red-100 text-red-900",
}

export function ConditionBadge({ condition }: { condition: Condition }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[condition]}`}>{condition}</span>
}
