import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import type { Paginated, Supplier } from "@/types/api"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { FormField } from "@/components/FormField"
import { Modal } from "@/components/Modal"
import { Pagination } from "@/components/Pagination"
import { RoleGate } from "@/components/RoleGate"
import { SearchInput } from "@/components/SearchInput"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"

interface SupplierForm {
  name: string
  contact_info: string
  address: string
}

function SupplierModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Supplier | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SupplierForm>({
    name: editing?.name ?? "",
    contact_info: editing?.contact_info ?? "",
    address: editing?.address ?? "",
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        contact_info: form.contact_info.trim() || null,
        address: form.address.trim() || null,
      }
      if (editing) return await api.put(`/suppliers/${editing.id}`, payload)
      return await api.post("/suppliers", payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] })
      onClose()
    },
  })

  const set = (field: keyof SupplierForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <Modal open={open} title={editing ? "Edit Supplier" : "New Supplier"} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Name">
          <input className="input-field" value={form.name} onChange={(e) => set("name")(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Contact Info" hint="Phone, email or WhatsApp.">
          <input className="input-field" value={form.contact_info} onChange={(e) => set("contact_info")(e.target.value)} />
        </FormField>
        <FormField label="Address">
          <textarea className="input-field h-20 resize-none" value={form.address} onChange={(e) => set("address")(e.target.value)} />
        </FormField>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={saveMutation.isPending || !form.name.trim()}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  )
}

function SuppliersTable() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", q, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Supplier>>("/suppliers", {
          params: { q: q.trim() || undefined, page, page_size: 10 },
        })
      ).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => await api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] })
      setDeleting(null)
    },
    onError: () => setDeleting(null),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Suppliers</h1>
        <div className="ml-auto w-full max-w-xs">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search suppliers…" />
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => { setEditing(null); setModalOpen(true) }}
        >
          <Plus className="h-4 w-4" />
          New Supplier
        </button>
      </div>

      {suppliersQuery.isLoading ? (
        <Spinner />
      ) : suppliersQuery.isError ? (
        <ErrorPanel onRetry={() => suppliersQuery.refetch()} />
      ) : !suppliersQuery.data || suppliersQuery.data.items.length === 0 ? (
        <EmptyState title="No suppliers" subtitle="Add your first supplier." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Contact</th>
                <th className="th">Address</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliersQuery.data.items.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="td font-medium text-slate-900">{supplier.name}</td>
                  <td className="td text-slate-500">{supplier.contact_info ?? "-"}</td>
                  <td className="td max-w-[240px] truncate text-slate-500">{supplier.address ?? "-"}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        onClick={() => { setEditing(supplier); setModalOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => setDeleting(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={suppliersQuery.data.page}
            pages={suppliersQuery.data.pages}
            total={suppliersQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {modalOpen ? (
        <SupplierModal key={editing?.id ?? "new"} open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete supplier"
        message={`Delete "${deleting?.name}"? This fails if purchases reference this supplier.`}
        confirmLabel="Delete"
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

export function SuppliersPage() {
  return (
    <RoleGate>
      <SuppliersTable />
    </RoleGate>
  )
}
