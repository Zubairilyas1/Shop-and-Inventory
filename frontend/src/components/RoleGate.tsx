import type { ReactNode } from "react"
import { ShieldAlert } from "lucide-react"

import { useAuthStore } from "@/stores/authStore"

interface RoleGateProps {
  children: ReactNode
}

export function RoleGate({ children }: RoleGateProps) {
  const user = useAuthStore((state) => state.user)

  if (user?.role !== "admin") {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-slate-700">Admin access required</p>
        <p className="text-xs text-slate-500">
          Your account does not have permission to view this section.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
