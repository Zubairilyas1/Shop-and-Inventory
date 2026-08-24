export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  )
}
