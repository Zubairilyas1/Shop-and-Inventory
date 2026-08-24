export type Role = "admin" | "manager"

export interface UserBrief {
  id: number
  username: string
  full_name: string | null
  role: Role
  is_active: boolean
}

export interface UserFull extends UserBrief {
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_at: string
  user: UserBrief
}

export interface Category {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  contact_info: string | null
  address: string | null
  created_at: string
}

export interface ProductCategoryBrief {
  id: number
  name: string
}

export interface ProductSupplierBrief {
  id: number
  name: string
}

export interface Product {
  id: number
  sku_code: string
  name: string
  category_id: number
  supplier_id: number | null
  description: string | null
  image_url: string | null
  buying_price: number | string
  selling_price: number | string
  current_stock: number
  min_stock_alert: number
  is_archived: boolean
  created_at: string
  updated_at: string
  category?: ProductCategoryBrief | null
  supplier?: ProductSupplierBrief | null
}

export interface PurchaseProductBrief {
  id: number
  sku_code: string
  name: string
}

export interface Purchase {
  id: number
  product_id: number
  supplier_id: number
  quantity: number
  unit_buying_price: number | string
  total_cost: number | string
  invoice_number: string
  purchase_date: string
  product?: PurchaseProductBrief | null
  supplier?: ProductSupplierBrief | null
}

export interface SaleItem {
  id: number
  product_id: number
  quantity: number
  unit_buying_price: number | string
  unit_selling_price: number | string
  line_revenue: number | string
  line_profit: number | string
  product_name?: string | null
  product_sku?: string | null
}

export interface Sale {
  id: number
  transaction_code: string
  customer_name: string | null
  total_revenue: number | string
  total_cost: number | string
  total_profit: number | string
  sale_date: string
}

export interface SaleDetail extends Sale {
  items: SaleItem[]
}

export type CheckoutResponse = SaleDetail

export interface Paginated<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  pages: number
}

export interface DashboardStats {
  today_sales: number
  today_profit: number
  items_sold_today: number
  total_products: number
  low_stock_count: number
  inventory_value: number
}

export interface TrendPoint {
  bucket: string
  revenue: number
  cost: number
  profit: number
  transactions: number
}

export interface TopProduct {
  id: number
  sku_code: string
  name: string
  units_sold: number
  revenue: number
  profit: number
}

export interface CategoryRevenue {
  id: number
  name: string
  revenue: number
  share_pct: number
}
