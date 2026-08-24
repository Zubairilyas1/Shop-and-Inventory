import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "@/stores/authStore"

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <Outlet />
}
