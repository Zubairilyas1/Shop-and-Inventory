import { useMutation } from "@tanstack/react-query"
import { FileDown } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { FormField } from "@/components/FormField"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"

const REPORT_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "inventory", label: "Inventory" },
  { value: "purchases", label: "Purchases" },
  { value: "profitability", label: "Profitability" },
]

const FORMATS = ["csv", "xlsx", "pdf"] as const
type Format = (typeof FORMATS)[number]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

export function ReportsPage() {
  const [type, setType] = useState("sales")
  const [format, setFormat] = useState<Format>("csv")
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate] = useState(today())

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get<Blob>("/reports/export", {
        params: { type, format, start_date: startDate, end_date: endDate },
        responseType: "blob",
      })
      return response
    },
    onSuccess: (response) => {
      downloadBlobResponse(response, `${type}_report_${startDate}_${endDate}.${format}`)
      toast.success("Report generated and downloaded.")
    },
  })

  const rangeError =
    startDate && endDate && startDate > endDate ? "Start date must be on or before end date." : null

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">Reports &amp; Exports</h1>

      <div className="card space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Report Type">
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Format">
            <select className="input-field capitalize" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {FORMATS.map((f) => (
                <option key={f} value={f} className="capitalize">{f.toUpperCase()}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Start Date">
            <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="End Date">
            <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
        </div>

        {rangeError ? <p className="text-sm text-red-600">{rangeError}</p> : null}

        <button
          type="button"
          className="btn-primary w-full"
          disabled={!!rangeError || exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          <FileDown className="h-4 w-4" />
          {exportMutation.isPending ? "Generating…" : "Generate & Download"}
        </button>

        <p className="text-center text-xs text-slate-400">
          Date ranges are capped at 366 days. PDF reports are landscape A4 with page numbers.
        </p>
      </div>
    </div>
  )
}
