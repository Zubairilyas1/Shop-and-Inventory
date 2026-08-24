import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Paginated, Product, Purchase, Supplier } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { FormField } from "@/components/FormField"
import { Pagination } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { Spinner } from "@/components/Spinner"
import { StockBadge } from "@/components/StockBadge"
import { api } from "@/lib/api"
import { formatDate, money } from "@/lib/format"

function ProductPicker({
  value,
  onChange,
}: {
  value: Product | null
  onChange: (product: Product | null) => void
}) {
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(false)

  const resultsQuery = useQuery({
    queryKey: ["purchase-product-search", term],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>("/products", {
          params: { q: term.trim(), page_size: 8 },
        })
      ).data,
    enabled: open && term.trim().length >= 1,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{value.name}</p>
          <p className="text-xs text-slate-500">
            {value.sku_code} · <StockBadge stock={value.current_stock} minAlert={value.min_stock_alert} />
          </p>
        </div>
        <button type="button" className="text-xs font-medium text-red-600" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <SearchInput
        value={term}
        onChange={(v) => { setTerm(v); setOpen(true) }}
        placeholder="Search product to restock…"
        autoFocus
      />
      {open && term.trim().length >= 1 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {resultsQuery.isLoading ? (
            <Spinner />
          ) : !resultsQuery.data || resultsQuery.data.items.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-500">No products found.</p>
          ) : (
            resultsQuery.data.items.map((product) => (
              <button
                key={product.id}
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-sky-50"
                onClick={() => {
                  onChange(product)
                  setOpen(false)
                  setTerm("")
                }}
              >
                <p className="text-sm font-medium text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500">
                  {product.sku_code} · Stock {product.current_stock}
                </p>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function RestockForm() {
  const queryClient = useQueryClient()
  const [product, setProduct] = useState<Product | null>(null)
  const [supplierId, setSupplierId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: async () =>
      (await api.get<Paginated<Supplier>>("/suppliers", { params: { page_size: 100 } })).data,
  })

  const createMutation = useMutation({
    mutationFn: async () =>
      await api.post("/purchases", {
        product_id: product?.id,
        supplier_id: Number(supplierId),
        quantity: Number(quantity),
        unit_buying_price: Number(unitPrice),
        invoice_number: invoiceNumber.trim(),
      }),
    onSuccess: () => {
      toast.success("Purchase recorded — stock updated.")
      void queryClient.invalidateQueries({ queryKey: ["purchases"] })
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setProduct(null)
      setSupplierId("")
      setQuantity("1")
      setUnitPrice("")
      setInvoiceNumber("")
    },
  })

  const submit = () => {
    if (!product || !supplierId || !invoiceNumber.trim() || Number(quantity) < 1) return
    createMutation.mutate()
  }

  return (
    <div className="card space-y-4 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Record Supplier Purchase</h2>

      <FormField label="Product">
        <ProductPicker value={product} onChange={(p) => {
          setProduct(p)
          if (p) setUnitPrice(String(p.buying_price))
        }} />
      </FormField>

      <FormField label="Supplier">
        <select className="input-field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliersQuery.data?.items.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Quantity">
          <input type="number" min="1" className="input-field" value={quantity}
                 onChange={(e) => setQuantity(e.target.value)} disabled={!product} />
        </FormField>
        <FormField label="Unit Buying Price (Rs.)">
          <input type="number" min="0" step="0.01" className="input-field" value={unitPrice}
                 onChange={(e) => setUnitPrice(e.target.value)} disabled={!product} />
        </FormField>
      </div>

      <FormField label="Invoice / Reference #">
        <input className="input-field" placeholder="e.g. INV-2026-081" value={invoiceNumber}
               onChange={(e) => setInvoiceNumber(e.target.value)} disabled={!product} />
      </FormField>

      {product ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Total cost:{" "}
          <span className="font-semibold text-slate-900">
            {money(Number(unitPrice || 0) * Number(quantity || 0))}
          </span>{" "}
          · New stock will be{" "}
          <span className="font-semibold text-slate-900">
            {product.current_stock + Number(quantity || 0)}
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={!product || !supplierId || !invoiceNumber.trim() || createMutation.isPending}
        onClick={submit}
      >
        <Plus className="h-4 w-4" />
        {createMutation.isPending ? "Saving…" : "Add Purchase & Increment Stock"}
      </button>
    </div>
  )
}

function PurchaseHistory() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)

  const purchasesQuery = useQuery({
    queryKey: ["purchases", startDate, endDate, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Purchase>>("/purchases", {
          params: {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            page,
            page_size: 10,
          },
        })
      ).data,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Purchase History</h2>
        <div className="ml-auto flex items-center gap-2">
          <input type="date" className="input-field w-auto" value={startDate}
                 onChange={(e) => { setStartDate(e.target.value); setPage(1) }} />
          <span className="text-sm text-slate-400">to</span>
          <input type="date" className="input-field w-auto" value={endDate}
                 onChange={(e) => { setEndDate(e.target.value); setPage(1) }} />
        </div>
      </div>

      {purchasesQuery.isLoading ? (
        <Spinner />
      ) : purchasesQuery.isError ? (
        <ErrorPanel onRetry={() => purchasesQuery.refetch()} />
      ) : !purchasesQuery.data || purchasesQuery.data.items.length === 0 ? (
        <EmptyState title="No purchases found" subtitle="Restock entries will appear here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Date</th>
                <th className="th">Invoice</th>
                <th className="th">Product</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Unit Cost</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchasesQuery.data.items.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="td whitespace-nowrap text-slate-500">{formatDate(purchase.purchase_date)}</td>
                  <td className="td font-medium text-slate-900">{purchase.invoice_number}</td>
                  <td className="td">{purchase.product?.name ?? `#${purchase.product_id}`}</td>
                  <td className="td">{purchase.supplier?.name ?? `#${purchase.supplier_id}`}</td>
                  <td className="td text-right">{purchase.quantity}</td>
                  <td className="td text-right">{money(purchase.unit_buying_price)}</td>
                  <td className="td text-right font-medium">{money(purchase.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={purchasesQuery.data.page}
            pages={purchasesQuery.data.pages}
            total={purchasesQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  )
}

export function PurchasesPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
      <RestockForm />
      <div className="xl:col-span-2"><PurchaseHistory /></div>
    </div>
  )
}
