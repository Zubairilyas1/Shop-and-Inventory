import { useQuery } from "@tanstack/react-query"
import { Printer } from "lucide-react"
import { useState } from "react"

import type { Paginated, Sale, SaleDetail } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { Modal } from "@/components/Modal"
import { Pagination } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"
import { formatDate, money } from "@/lib/format"

function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ["sale", saleId],
    queryFn: async () => (await api.get<SaleDetail>(`/sales/${saleId}`)).data,
  })

  const printMutation = usePrintPdf(saleId)

  return (
    <Modal open title={detailQuery.data ? `Sale ${detailQuery.data.transaction_code}` : "Sale details"} onClose={onClose} wide>
      {detailQuery.isLoading ? (
        <Spinner />
      ) : detailQuery.isError || !detailQuery.data ? (
        <ErrorPanel onRetry={() => detailQuery.refetch()} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
            <p><span className="text-slate-400">Customer:</span> {detailQuery.data.customer_name ?? "Walk-in Customer"}</p>
            <p className="text-right"><span className="text-slate-400">Date:</span> {formatDate(detailQuery.data.sale_date)}</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Item</th>
                  <th className="th">SKU</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Unit Price</th>
                  <th className="th text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="td">{item.product_name ?? `#${item.product_id}`}</td>
                    <td className="td text-slate-500">{item.product_sku ?? "-"}</td>
                    <td className="td text-right">{item.quantity}</td>
                    <td className="td text-right">{money(item.unit_selling_price)}</td>
                    <td className="td text-right font-medium">{money(item.line_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="font-medium text-emerald-700">
              Net Profit: {money(detailQuery.data.total_profit)}
            </span>
            <button type="button" className="btn-secondary" onClick={() => printMutation.mutate()} disabled={printMutation.isPending}>
              <Printer className="h-4 w-4" />
              Print PDF
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function usePrintPdf(saleId: number | null) {
  const [pending, setPending] = useState(false)

  const print = async () => {
    if (saleId === null) return
    setPending(true)
    try {
      const response = await api.get<Blob>(`/sales/${saleId}/pdf`, { responseType: "blob" })
      downloadBlobResponse(response, `Invoice_sale_${saleId}.pdf`)
    } finally {
      setPending(false)
    }
  }

  return { mutate: print, isPending: pending }
}

export function SalesPage() {
  const [q, setQ] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)

  const salesQuery = useQuery({
    queryKey: ["sales", q, startDate, endDate, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Sale>>("/sales", {
          params: {
            q: q.trim() || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            page,
            page_size: 10,
          },
        })
      ).data,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Sales History</h1>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search by transaction code or customer…" />
        </div>
        <input type="date" className="input-field w-auto" value={startDate}
               onChange={(e) => { setStartDate(e.target.value); setPage(1) }} />
        <span className="text-sm text-slate-400">to</span>
        <input type="date" className="input-field w-auto" value={endDate}
               onChange={(e) => { setEndDate(e.target.value); setPage(1) }} />
      </div>

      {salesQuery.isLoading ? (
        <Spinner />
      ) : salesQuery.isError ? (
        <ErrorPanel onRetry={() => salesQuery.refetch()} />
      ) : !salesQuery.data || salesQuery.data.items.length === 0 ? (
        <EmptyState title="No sales found" subtitle="Completed transactions will appear here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Transaction</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th text-right">Revenue</th>
                <th className="th text-right">Profit</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesQuery.data.items.map((sale) => (
                <tr key={sale.id} className="cursor-pointer hover:bg-sky-50" onClick={() => setSelectedSaleId(sale.id)}>
                  <td className="td font-medium text-slate-900">{sale.transaction_code}</td>
                  <td className="td whitespace-nowrap text-slate-500">{formatDate(sale.sale_date)}</td>
                  <td className="td">{sale.customer_name ?? "Walk-in Customer"}</td>
                  <td className="td text-right font-medium">{money(sale.total_revenue)}</td>
                  <td className="td text-right text-emerald-700">{money(sale.total_profit)}</td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                      onClick={(event) => { event.stopPropagation(); setSelectedSaleId(sale.id) }}
                      title="View details"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={salesQuery.data.page}
            pages={salesQuery.data.pages}
            total={salesQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {selectedSaleId !== null ? (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      ) : null}
    </div>
  )
}
