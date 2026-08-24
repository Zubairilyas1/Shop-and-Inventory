import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Boxes,
  Coins,
  Package,
  Receipt,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { CategoryRevenue, DashboardStats, TopProduct, TrendPoint } from "@/types/api"

import { ErrorPanel } from "@/components/ErrorPanel"
import { Spinner } from "@/components/Spinner"
import { StatCard } from "@/components/StatCard"
import { api } from "@/lib/api"
import { formatDate, money } from "@/lib/format"

const GROUPS = ["day", "week", "month"] as const
type Group = (typeof GROUPS)[number]

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"]

export function DashboardPage() {
  const [group, setGroup] = useState<Group>("day")

  const statsQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/analytics/dashboard")).data,
  })

  const trendsQuery = useQuery({
    queryKey: ["trends", group],
    queryFn: async () =>
      (await api.get<TrendPoint[]>("/analytics/trends", { params: { group_by: group } })).data,
  })

  const topProductsQuery = useQuery({
    queryKey: ["top-products"],
    queryFn: async () =>
      (await api.get<TopProduct[]>("/analytics/top-products", { params: { limit: 5 } })).data,
  })

  const categoryRevenueQuery = useQuery({
    queryKey: ["category-revenue"],
    queryFn: async () => (await api.get<CategoryRevenue[]>("/analytics/category-revenue")).data,
  })

  if (statsQuery.isLoading) return <Spinner label="Loading dashboard…" />
  if (statsQuery.isError || !statsQuery.data) {
    return <ErrorPanel onRetry={() => statsQuery.refetch()} />
  }
  const stats = statsQuery.data

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Today's Sales" value={money(stats.today_sales)} icon={Receipt} />
        <StatCard
          label="Today's Net Profit"
          value={money(stats.today_profit)}
          icon={TrendingUp}
          tone={stats.today_profit >= 0 ? "success" : "warning"}
        />
        <StatCard label="Items Sold Today" value={String(stats.items_sold_today)} icon={Boxes} />
        <StatCard label="Total Active Products" value={String(stats.total_products)} icon={Package} />
        <StatCard
          label="Low Stock Warnings"
          value={String(stats.low_stock_count)}
          icon={AlertTriangle}
          tone={stats.low_stock_count > 0 ? "warning" : "default"}
        />
        <StatCard label="Inventory Value" value={money(stats.inventory_value)} icon={Coins} />
      </div>

      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Sales &amp; Profit Trend</h2>
          <div className="flex gap-1">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={
                  g === group
                    ? "rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white capitalize"
                    : "rounded-lg px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 capitalize"
                }
              >
                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        {trendsQuery.isLoading ? (
          <Spinner />
        ) : trendsQuery.data && trendsQuery.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendsQuery.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [money(value), name]}
                labelFormatter={(label: string) => formatDate(label)}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">No sales in the selected range.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Top 5 Best-Selling Products</h2>
          {topProductsQuery.isLoading ? (
            <Spinner />
          ) : topProductsQuery.data && topProductsQuery.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProductsQuery.data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number, name: string) => [name === "units_sold" ? `${value} units` : money(value), name === "units_sold" ? "Units sold" : name]} />
                <Bar dataKey="units_sold" name="Units sold" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No sales data yet.</p>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Category Revenue Contribution</h2>
          {categoryRevenueQuery.isLoading ? (
            <Spinner />
          ) : categoryRevenueQuery.data && categoryRevenueQuery.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryRevenueQuery.data}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {categoryRevenueQuery.data.map((entry, index) => (
                    <Cell key={entry.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => money(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No category revenue yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
