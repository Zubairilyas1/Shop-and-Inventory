import type { ReactNode } from "react"

interface FormFieldProps {
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
}

export function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
}
