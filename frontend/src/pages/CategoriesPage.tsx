import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import type { Category, Paginated } from "@/types/api"

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

interface CategoryForm {
  name: string
  description: string
}

function CategoryModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Category | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CategoryForm>({
    name: editing?.name ?? "",
    description: editing?.description ?? "",
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      }
      if (editing) return await api.put(`/categories/${editing.id}`, payload)
      return await api.post("/categories", payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] })
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      onClose()
    },
  })

  return (
    <Modal open={open} title={editing ? "Edit Category" : "New Category"} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Name">
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoFocus
          />
        </FormField>
        <FormField label="Description">
          <textarea
            className="input-field h-20 resize-none"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
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

function CategoriesTable() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ["categories", q, page],
    queryFn: async () =>
      (
        await api.get<Paginated<Category>>("/categories", {
          params: { q: q.trim() || undefined, page, page_size: 10 },
        })
      ).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => await api.delete(`/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] })
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      setDeleting(null)
    },
    onError: () => setDeleting(null),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Categories</h1>
        <div className="ml-auto flex w-full max-w-xs items-center gap-2">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search categories…" />
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => { setEditing(null); setModalOpen(true) }}
        >
          <Plus className="h-4 w-4" />
          New Category
        </button>
      </div>

      {categoriesQuery.isLoading ? (
        <Spinner />
      ) : categoriesQuery.isError ? (
        <ErrorPanel onRetry={() => categoriesQuery.refetch()} />
      ) : !categoriesQuery.data || categoriesQuery.data.items.length === 0 ? (
        <EmptyState title="No categories" subtitle="Create your first category." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Description</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoriesQuery.data.items.map((category) => (
                <tr key={category.id}>
                  <td className="td font-medium text-slate-900">{category.name}</td>
                  <td className="td text-slate-500">{category.description ?? "-"}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        onClick={() => { setEditing(category); setModalOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => setDeleting(category)}
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
            page={categoriesQuery.data.page}
            pages={categoriesQuery.data.pages}
            total={categoriesQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {modalOpen ? (
        <CategoryModal key={editing?.id ?? "new"} open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category"
        message={`Delete "${deleting?.name}"? This fails if products are still assigned to it.`}
        confirmLabel="Delete"
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

export function CategoriesPage() {
  return (
    <RoleGate>
      <CategoriesTable />
    </RoleGate>
  )
}
