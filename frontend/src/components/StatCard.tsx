import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: "default" | "warning" | "success"
}

const toneClasses = {
  default: "bg-sky-100 text-sky-700",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
}

export function StatCard({ label, value, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
