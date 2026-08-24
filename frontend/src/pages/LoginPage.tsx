import { useMutation } from "@tanstack/react-query"
import { ShoppingBag } from "lucide-react"
import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"

import type { AuthResponse } from "@/types/api"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { toast } from "sonner"

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.token)
  const setSession = useAuthStore((state) => state.setSession)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse>("/auth/login", { username, password })
      return response.data
    },
    onSuccess: (data) => {
      setSession(data.access_token, data.user)
      toast.success(`Welcome back, ${data.user.full_name ?? data.user.username}!`)
      navigate(searchParams.get("next") ?? "/dashboard", { replace: true })
    },
  })

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100">
            <ShoppingBag className="h-6 w-6 text-sky-700" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Shop Manager</h1>
          <p className="text-sm text-slate-500">Sign in to your account to continue</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            loginMutation.mutate()
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Username
            </span>
            <input
              className="input-field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Password
            </span>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
