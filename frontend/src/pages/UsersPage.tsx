import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, UserX } from "lucide-react"
import { useState } from "react"

import type { Paginated, Role, UserFull } from "@/types/api"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { EmptyState } from "@/components/EmptyState"
import { ErrorPanel } from "@/components/ErrorPanel"
import { FormField } from "@/components/FormField"
import { Modal } from "@/components/Modal"
import { Pagination } from "@/components/Pagination"
import { RoleGate } from "@/components/RoleGate"
import { Spinner } from "@/components/Spinner"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useAuthStore } from "@/stores/authStore"

interface UserFormState {
  username: string
  password: string
  full_name: string
  role: Role
}

function UserModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: UserFull | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<UserFormState>({
    username: editing?.username ?? "",
    password: "",
    full_name: editing?.full_name ?? "",
    role: editing?.role ?? "manager",
  })
  const [formError, setFormError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const payload: Record<string, unknown> = {
          full_name: form.full_name.trim() || null,
          role: form.role,
        }
        if (form.password) payload.password = form.password
        return await api.put(`/users/${editing.id}`, payload)
      }
      return await api.post("/users", {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
        role: form.role,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      onClose()
    },
  })

  const submit = () => {
    setFormError(null)
    if (!editing && (form.password.length < 8 || !/\d/.test(form.password))) {
      setFormError("Password must be at least 8 characters and include a digit.")
      return
    }
    saveMutation.mutate()
  }

  return (
    <Modal open={open} title={editing ? `Edit User — ${editing.username}` : "New User"} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Username">
          <input className="input-field" value={form.username} disabled={!!editing}
                 onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
        </FormField>
        <FormField label="Full Name">
          <input className="input-field" value={form.full_name}
                 onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
        </FormField>
        <FormField label="Role">
          <select className="input-field capitalize" value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}>
            <option value="admin" className="capitalize">Admin</option>
            <option value="manager" className="capitalize">Manager</option>
          </select>
        </FormField>
        <FormField
          label={editing ? "New Password (leave blank to keep)" : "Password"}
          hint="Min 8 chars with letters and digits."
        >
          <input type="password" className="input-field" value={form.password} autoComplete="new-password"
                 onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        </FormField>
      </div>

      {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  )
}

function UsersTable() {
  const currentUser = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserFull | null>(null)
  const [disabling, setDisabling] = useState<UserFull | null>(null)

  const usersQuery = useQuery({
    queryKey: ["users", page],
    queryFn: async () =>
      (await api.get<Paginated<UserFull>>("/users", { params: { page, page_size: 10 } })).data,
  })

  const disableMutation = useMutation({
    mutationFn: async (id: number) => await api.delete(`/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      setDisabling(null)
    },
    onError: () => setDisabling(null),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">User Management</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setEditing(null); setModalOpen(true) }}
        >
          <Plus className="h-4 w-4" />
          New User
        </button>
      </div>

      {usersQuery.isLoading ? (
        <Spinner />
      ) : usersQuery.isError ? (
        <ErrorPanel onRetry={() => usersQuery.refetch()} />
      ) : !usersQuery.data || usersQuery.data.items.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Username</th>
                <th className="th">Full Name</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQuery.data.items.map((user) => (
                <tr key={user.id}>
                  <td className="td font-medium text-slate-900">{user.username}</td>
                  <td className="td">{user.full_name ?? "-"}</td>
                  <td className="td capitalize">{user.role}</td>
                  <td className="td">
                    {user.is_active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Disabled</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-slate-500">{formatDate(user.created_at)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        onClick={() => { setEditing(user); setModalOpen(true) }}
                        disabled={!user.is_active}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {user.is_active && user.id !== currentUser?.id ? (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          onClick={() => setDisabling(user)}
                          title="Disable account"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={usersQuery.data.page}
            pages={usersQuery.data.pages}
            total={usersQuery.data.total}
            onChange={setPage}
          />
        </div>
      )}

      {modalOpen ? (
        <UserModal key={editing?.id ?? "new"} open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={disabling !== null}
        title="Disable user"
        message={`Disable "${disabling?.username}"? They will no longer be able to log in.`}
        confirmLabel="Disable"
        danger
        busy={disableMutation.isPending}
        onConfirm={() => disabling && disableMutation.mutate(disabling.id)}
        onCancel={() => setDisabling(null)}
      />
    </div>
  )
}

export function UsersPage() {
  return (
    <RoleGate>
      <UsersTable />
    </RoleGate>
  )
}
