import { PackageSearch } from "lucide-react"

interface EmptyStateProps {
  title: string
  subtitle?: string
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-12 text-center">
      <PackageSearch className="mb-2 h-8 w-8 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}
