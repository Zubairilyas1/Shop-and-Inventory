import { useMutation, useQuery } from "@tanstack/react-query"
import { Minus, Plus, ScanBarcode, ShoppingCart, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { CheckoutResponse, Paginated, Product } from "@/types/api"

import { EmptyState } from "@/components/EmptyState"
import { Spinner } from "@/components/Spinner"
import { StockBadge } from "@/components/StockBadge"
import { api } from "@/lib/api"
import { downloadBlobResponse } from "@/lib/file"
import { money } from "@/lib/format"
import { cartSubtotal, cartTotalItems, useCartStore } from "@/stores/cartStore"

export function PosPage() {
  const [search, setSearch] = useState("")
  const [customerName, setCustomerName] = useState("")

  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const increment = useCartStore((state) => state.increment)
  const decrement = useCartStore((state) => state.decrement)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clear)

  const resultsQuery = useQuery({
    queryKey: ["pos-search", search],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>("/products", {
          params: { q: search.trim(), include_archived: false, page_size: 20, sort: "name" },
        })
      ).data,
    enabled: search.trim().length >= 1,
    staleTime: 15_000,
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_name: customerName.trim() || null,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      }
      const response = await api.post<CheckoutResponse>("/sales/checkout", payload)
      return response.data
    },
    onSuccess: async (sale) => {
      try {
        const pdf = await api.get<Blob>(`/sales/${sale.id}/pdf`, { responseType: "blob" })
        downloadBlobResponse(
          pdf,
          `Invoice_${(sale.customer_name ?? "Walkin").replace(/\s+/g, "")}_${sale.transaction_code}.pdf`,
        )
      } catch {
        toast.warning(`Sale ${sale.transaction_code} completed but the receipt could not be downloaded.`)
      }
      clearCart()
      setCustomerName("")
      toast.success(`Sale ${sale.transaction_code} completed — ${money(sale.total_revenue)}`)
      void api.get("/analytics/dashboard")
    },
  })

  const handleSearchKeyDown = (key: string) => {
    if (key !== "Enter") return
    const term = search.trim().toLowerCase()
    if (!term) return
    const exact = resultsQuery.data?.items.find((p) => p.sku_code.toLowerCase() === term)
    if (exact) {
      if (exact.current_stock > 0) {
        addItem(exact)
        setSearch("")
      } else {
        toast.error(`"${exact.name}" is out of stock.`)
      }
    } else {
      toast.info("No exact SKU match for scanner input.")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <section className="card flex flex-col p-4 lg:col-span-3">
        <div className="relative mb-4">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name or SKU — or scan a barcode…"
            value={search}
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => handleSearchKeyDown(event.key)}
          />
        </div>

        <div className="max-h-[62vh] overflow-y-auto rounded-lg border border-slate-200">
          {search.trim().length < 1 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Start typing to search products. Barcode scanners are supported.
            </p>
          ) : resultsQuery.isLoading ? (
            <Spinner />
          ) : !resultsQuery.data || resultsQuery.data.items.length === 0 ? (
            <EmptyState title="No products found" subtitle={`No matches for "${search}".`} />
          ) : (
            <ul className="divide-y divide-slate-200">
              {resultsQuery.data.items.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={product.current_stock === 0}
                    onClick={() => addItem(product)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.sku_code} · {product.category?.name ?? "Uncategorized"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {money(product.selling_price)}
                      </span>
                      <StockBadge stock={product.current_stock} minAlert={product.min_stock_alert} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card flex h-fit flex-col p-4 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
          <ShoppingCart className="h-5 w-5 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Current Bill</h2>
          {items.length > 0 ? (
            <button
              type="button"
              className="ml-auto text-xs font-medium text-red-600 hover:text-red-700"
              onClick={clearCart}
            >
              Clear all
            </button>
          ) : null}
        </div>

        <label className="block pb-3">
          <input
            className="input-field"
            placeholder="Customer name (Walk-in Customer)"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
        </label>

        {items.length === 0 ? (
          <EmptyState title="Cart is empty" subtitle="Add products from the search panel." />
        ) : (
          <>
            <div className="max-h-[46vh] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Item</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Total</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.product.id}>
                      <td className="td">
                        <p className="font-medium text-slate-900">{item.product.name}</p>
                        <p className="text-xs text-slate-500">{money(item.product.selling_price)} each</p>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 p-1 hover:bg-slate-100"
                            onClick={() => decrement(item.product.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            className="w-12 rounded-md border border-slate-300 px-1 py-1 text-center text-sm"
                            value={item.quantity}
                            onChange={(event) =>
                              setQuantity(item.product.id, Number(event.target.value.replace(/\D/g, "")) || 0)
                            }
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 p-1 hover:bg-slate-100"
                            onClick={() => increment(item.product.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="td text-right font-semibold text-slate-900">
                        {money(Number(item.product.selling_price) * item.quantity)}
                      </td>
                      <td className="td">
                        <button
                          type="button"
                          className="rounded-md p-1 text-red-500 hover:bg-red-50"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Items</span>
                <span>{cartTotalItems(items)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Subtotal</span>
                <span>{money(cartSubtotal(items))}</span>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          className="btn-primary mt-4 w-full py-3 text-base"
          disabled={items.length === 0 || checkoutMutation.isPending}
          onClick={() => checkoutMutation.mutate()}
        >
          {checkoutMutation.isPending ? "Processing…" : "Complete Sale & Print Bill"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Stock is verified server-side at checkout.
        </p>
      </section>
    </div>
  )
}
