import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import type { Category, Paginated, Product, Supplier } from "@/types/api"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { FormField } from "@/components/FormField"
import { Modal } from "@/components/Modal"
import { Pagination } from "@/components/Pagination"
import { RoleGate } from "@/components/RoleGate"
import { SearchInput } from "@/components/SearchInput"
import { Spinner } from "@/components/Spinner"
import { StockBadge } from "@/components/StockBadge"
import { api, errorCode } from "@/lib/api"
import { money } from "@/lib/format"
import { useAuthStore } from "@/stores/authStore"

interface ProductForm {
  sku_code: string
  name: string
  category_id: string
  supplier_id: string
  description: string
  image_url: string
  buying_price: string
  selling_price: string
  current_stock: string
  min_stock_alert: string
}

const EMPTY_FORM: ProductForm = {
  sku_code: "",
  name: "",
  category_id: "",
  supplier_id: "",
  description: "",
  image_url: "",
  buying_price: "",
  selling_price: "",
  current_stock: "0",
  min_stock_alert: "5",
}

function toForm(product: Product): ProductForm {
  return {
    sku_code: product.sku_code,
    name: product.name,
    category_id: String(product.category_id),
    supplier_id: product.supplier_id ? String(product.supplier_id) : "",
    description: product.description ?? "",
    image_url: product.image_url ?? "",
    buying_price: String(product.buying_price),
    selling_price: String(product.selling_price),
    current_stock: String(product.current_stock),
    min_stock_alert: String(product.min_stock_alert),
  }
}

function ProductFormModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Product | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ProductForm>(editing ? toForm(editing) : EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () =>
      (await api.get<Paginated<Category>>("/categories", { params: { page_size: 100 } })).data,
  })
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: async () =>
      (await api.get<Paginated<Supplier>>("/suppliers", { params: { page_size: 100 } })).data,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) {
        return (
          await api.post<Product>("/products", {
            sku_code: form.sku_code.trim(),
            name: form.name.trim(),
            category_id: Number(form.category_id),
            supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            buying_price: Number(form.buying_price),
            selling_price: Number(form.selling_price),
            current_stock: Number(form.current_stock || 0),
            min_stock_alert: Number(form.min_stock_alert || 0),
          })
        ).data
      }
      return (
        await api.put<Product>(`/products/${editing.id}`, {
          name: form.name.trim(),
          category_id: Number(form.category_id),
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          description: form.description.trim() || null,
          image_url: form.image_url.trim() || null,
          buying_price: Number(form.buying_price),
          selling_price: Number(form.selling_price),
          current_stock: Number(form.current_stock || 0),
          min_stock_alert: Number(form.min_stock_alert || 0),
        })
      ).data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onClose()
    },
  })

  const set = (field: keyof ProductForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const submit = () => {
    setFormError(null)
    if (!form.sku_code.trim() || !form.name.trim()) {
      setFormError("SKU and Name are required.")
      return
    }
    if (!form.category_id) {
      setFormError("Please choose a category.")
      return
    }
    if (Number(form.selling_price) < Number(form.buying_price)) {
      setFormError("Selling price must be greater than or equal to buying price.")
      return
    }
    saveMutation.mutate()
  }

  return (
    <Modal open={open} title={editing ? `Edit Product — ${editing.sku_code}` : "New Product"} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="SKU Code">
          <input className="input-field" value={form.sku_code} disabled={!!editing} onChange={(e) => set("sku_code")(e.target.value)} />
        </FormField>
        <FormField label="Name">
          <input className="input-field" value={form.name} onChange={(e) => set("name")(e.target.value)} />
        </FormField>
        <FormField label="Category">
          <select className="input-field" value={form.category_id} onChange={(e) => set("category_id")(e.target.value)}>
            <option value="">Select…</option>
            {categoriesQuery.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Supplier">
          <select className="input-field" value={form.supplier_id} onChange={(e) => set("supplier_id")(e.target.value)}>
            <option value="">None</option>
            {suppliersQuery.data?.items.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Buying Price (Rs.)">
          <input type="number" min="0" step="0.01" className="input-field" value={form.buying_price} onChange={(e) => set("buying_price")(e.target.value)} />
        </FormField>
        <FormField label="Selling Price (Rs.)">
          <input type="number" min="0" step="0.01" className="input-field" value={form.selling_price} onChange={(e) => set("selling_price")(e.target.value)} />
        </FormField>
        <FormField label="Current Stock">
          <input type="number" min="0" className="input-field" value={form.current_stock} onChange={(e) => set("current_stock")(e.target.value)} />
        </FormField>
        <FormField label="Min Stock Alert">
          <input type="number" min="0" className="input-field" value={form.min_stock_alert} onChange={(e) => set("min_stock_alert")(e.target.value)} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Image URL" hint="Paste an http(s) link to a product photo.">
            <input className="input-field" placeholder="https://…" value={form.image_url} onChange={(e) => set("image_url")(e.target.value)} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Description">
            <textarea className="input-field h-20 resize-none" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </FormField>
        </div>
      </div>

      {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Product"}
        </button>
      </div>
    </Modal>
  )
}

function ProductsTable() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "admin"
  const queryClient = useQueryClient()

  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [lowStock, setLowStock] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () =>
      (await api.get<Paginated<Category>>("/categories", { params: { page_size: 100 } })).data,
  })

  const productsQuery = useQuery({
    queryKey: ["products", q, categoryId, lowStock, includeArchived, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>("/products", {
          params: {
            q: q.trim() || undefined,
            category_id: categoryId ? Number(categoryId) : undefined,
            low_stock: lowStock || undefined,
            include_archived: includeArchived || undefined,
            page,
            page_size: 10,
          },
        })
      ).data,
  })

  const archiveMutation = useMutation({
    mutationFn: async (product: Product) =>
      await api.put(`/products/${product.id}`, { is_archived: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: ["pos-search"] })
      setArchiveTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => await api.delete(`/products/${productId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (error) => {
      if (errorCode(error) === "PRODUCT_IN_USE") {
        const target = productsQuery.data?.items.find(
          (p) => p.id === deleteMutation.variables,
        )
        if (target) setArchiveTarget(target)
      }
    },
  })

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search by name or SKU…" />
        </div>
        <select className="input-field w-44" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}>
          <option value="">All categories</option>
          {categoriesQuery.data?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1) }} />
          Low stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1) }} />
          Show archived
        </label>
        {isAdmin ? (
          <button
            type="button"
            className="btn-primary ml-auto"
            onClick={() => { setEditing(null); setModalOpen(true) }}
          >
            <Plus className="h-4 w-4" />
            New Product
          </button>
        ) : null}
      </div>

      {productsQuery.isLoading ? (
        <Spinner />
      ) : productsQuery.isError ? (
        <ErrorPanel onRetry={() => productsQuery.refetch()} />
      ) : !productsQuery.data || productsQuery.data.items.length === 0 ? (
        <EmptyState title="No products found" subtitle="Try adjusting the filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Product</th>
                <th className="th">Category</th>
                <th className="th text-right">Buying</th>
                <th className="th text-right">Selling</th>
                <th className="th">Stock</th>
                {isAdmin ? <th className="th text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productsQuery.data.items.map((product) => (
                <tr key={product.id} className={product.is_archived ? "opacity-50" : ""}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-9 w-9 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">{product.category?.name ?? "-"}</td>
                  <td className="td text-right">{money(product.buying_price)}</td>
                  <td className="td text-right font-medium">{money(product.selling_price)}</td>
                  <td className="td"><StockBadge stock={product.current_stock} minAlert={product.min_stock_alert} /></td>
                  {isAdmin ? (
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                          onClick={() => { setEditing(product); setModalOpen(true) }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!product.is_archived ? (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50"
                            onClick={() => setArchiveTarget(product)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : null}
                        {!product.is_archived ? (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(product.id)}
                            disabled={deleteMutation.isPending && deleteMutation.variables === product.id}
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={productsQuery.data.page}
            pages={productsQuery.data.pages}
            total={productsQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {modalOpen ? (
        <ProductFormModal
          key={editing?.id ?? "new"}
          open={modalOpen}
          editing={editing}
          onClose={() => setModalOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive product"
        message={`Archive "${archiveTarget?.name}"? It will be hidden from POS and lists but its sales history is preserved.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}

export function ProductsPage() {
  return (
    <RoleGate>
      <ProductsTable />
    </RoleGate>
  )
}
