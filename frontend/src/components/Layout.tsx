import { useMutation, useQuery } from "@tanstack/react-query"
import {
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  Tags,
  Truck,
  Users,
} from "lucide-react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import type { LucideIcon } from "lucide-react"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { useUiStore } from "@/stores/uiStore"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { to: "/products", label: "Products", icon: Package },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/purchases", label: "Purchases", icon: ShoppingBag },
  { to: "/sales", label: "Sales", icon: ReceiptText },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings/users", label: "Users", icon: Users, adminOnly: true },
]

export function Layout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clear = useAuthStore((state) => state.clear)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data as { low_stock_count: number },
    staleTime: 60_000,
  })
  const lowStockCount = dashboardQuery.data?.low_stock_count ?? 0

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout")
    },
    onSettled: () => {
      clear()
      toast.success("Logged out.")
      navigate("/login", { replace: true })
    },
  })

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r border-slate-200 bg-white transition-all ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <ShoppingBag className="h-6 w-6 shrink-0 text-sky-600" />
          {!collapsed ? <span className="truncate text-sm font-bold text-slate-900">Shop Manager</span> : null}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
              {item.to === "/products" && lowStockCount > 0 && !collapsed ? (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {lowStockCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <p className="text-sm font-medium text-slate-500">Centralized Shop &amp; Inventory Management</p>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.full_name ?? user?.username}</p>
              <p className="text-xs capitalize text-slate-500">{user?.role}</p>
            </div>
            <button
              type="button"
              className="btn-secondary px-3"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
