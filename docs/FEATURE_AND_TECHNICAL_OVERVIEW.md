# Centralized Shop & Inventory Management System
## Feature & Technical Overview — v3.0 Implementation

---

# PART 1 — FEATURE LIST (Business Capabilities)

## 1. Authentication & User Management
- Secure login with username/password (bcrypt-hashed, work factor 12)
- JWT session tokens valid 8 hours; delivered on login, attached automatically by the web app
- True logout: token is revoked server-side (blocklist) — stolen/copied tokens become useless after logout
- Two roles: **Admin** (full control) and **Manager** (sales + viewing only, no deletes/pricing/user management)
- Admin-only user management screen: create staff, reset passwords, change roles, disable accounts (never deletes sales history)

## 2. Product Catalog Management
- Create / edit / archive / delete products with unique SKU codes
- Buying & selling price with enforced profit-margin rule (selling ≥ buying, validated in UI, API, AND database)
- Minimum-stock alert threshold per product
- Product images via URL embedding
- Archive option when a product has sales/purchase history (history is never orphaned)
- Instant search by product name or SKU; filter by category, supplier, low-stock, archived; sortable; paginated

## 3. Categories & Suppliers
- Full CRUD for categories and suppliers
- Referential-safety: a category in use cannot be deleted; suppliers with purchase history are protected

## 4. Inventory & Restocking
- Supplier purchase entry form: product, supplier, quantity, unit buying cost, invoice reference
- One submission atomically records the purchase **and** increments product stock
- Purchase history ledger with date-range filtering
- Automatic stock alerts: **Low Stock** (≤ minimum) and **Out of Stock** (=0), surfaced as badges plus a persistent sidebar warning counter

## 5. Point of Sale (POS) Billing
- Live keyboard search with instant results and color-coded stock badges
- Native USB/Bluetooth barcode-scanner support (scan → Enter → item added)
- Multi-item cart with quantity steppers clamped to available stock; out-of-stock items unselectable
- Optional customer name ("Walk-in Customer" default)
- Real-time totals while editing quantities
- Single-click "Complete Sale & Print Bill": server verifies stock, records the sale, decrements inventory, and the receipt PDF downloads automatically

## 6. Financial Engine (Zero Manual Accounting)
- Every sale stores line-level buying/selling price snapshots — later price edits never distort historical profits
- Automatic computation of line revenue, COGS, net profit per item and per transaction
- Total inventory valuation = Σ(stock × buying price), always current

## 7. Admin Dashboard & Analytics
- Six live KPI cards: Today's Sales, Today's Net Profit, Items Sold Today, Active Products, Low-Stock Count, Inventory Value
- Sales & Profit trend chart with Daily / Weekly / Monthly toggle
- Top-5 best-selling products chart
- Category revenue contribution donut chart

## 8. Reports & Data Export
- Four report types: **Sales, Inventory, Purchases, Profitability**
- Three formats each: **CSV, Excel (XLSX), PDF**
- Custom date ranges (up to 366 days/request), grand-total rows
- Excel-safe CSV (UTF-8 BOM), styled landscape PDFs with page numbers

## 9. Receipts / Invoices
- Professional A4 PDF receipt auto-generated per sale (shop header, items, totals, cashier, customer)
- Thermal-printer-ready 80 mm layout mode (`?layout=thermal80`)

## 10. Platform Qualities
- Role-permission matrix enforced at API level for every endpoint
- Standardized error responses (machine-readable error codes + human messages)
- Daily automated database backup script (30-day rotation)

---

# PART 2 — TECHNICAL SPECIFICATION

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3 + TypeScript 5.6 (strict), Vite 5, Tailwind CSS 3.4, React Router 6 |
| FE State | TanStack React Query v5 (server cache) + Zustand 5 (auth/cart/UI) |
| Charts / UX | Recharts, sonner toasts, lucide-react icons, Axios interceptors |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async + asyncpg, Pydantic v2, Alembic |
| Database | Neon serverless PostgreSQL (PG 16/17 compatible, requires PG ≥14) |
| Auth | PyJWT (HS256, `jti` claim) + bcrypt(12) + `token_blocklist` table |
| Documents | ReportLab (receipts/reports), openpyxl (XLSX) |

## Database Schema (8 tables + sequence)
`users · token_blocklist · categories · suppliers · products · purchases · sales · sale_items` + `transaction_code_seq`

Integrity design:
- FK policy: categories/products/purchases → `RESTRICT`; sale_items → `CASCADE`; supplier/users refs → `SET NULL`
- CHECK constraints: non-negative prices/stock, `selling_price >= buying_price`, positive quantities
- Money: `DECIMAL(12,2)` end-to-end (Python `Decimal`, never float)
- Performance indexes: GIN trigram on `products.name` & `sales.customer_name` (ILIKE acceleration), partial low-stock index, date indexes on sales/purchases
- Price snapshots in `sale_items` guarantee immutable historical financials

## Concurrency & ACID Checkout (race-condition proof)
1. `SELECT … WHERE id IN (...) ORDER BY id FOR UPDATE` — deterministic row-lock ordering prevents deadlocks
2. Server-side stock verification → `409 INSUFFICIENT_STOCK` with per-product detail on shortage
3. Transaction code generated inside the transaction: `'TRX-' || YYYYMMDD || '-' || LPAD(NEXTVAL(seq),4,'0')` — collision-free under concurrency
4. Master insert + line-item inserts + stock decrement commit atomically; any failure rolls back completely

## API Surface (~26 endpoints, `/api/v1`)
- **Auth**: login · logout (JWT jti blocklist) · me
- **Users** (admin): list/create/update/disable
- **Products/Categories/Suppliers**: full CRUD + search/filter/pagination/sort; delete falls back to archive on `409 PRODUCT_IN_USE`
- **Purchases**: create (atomic stock increment) · filtered history
- **Sales**: checkout (ACID) · history · detail · `/{id}/pdf?layout=a4|thermal80`
- **Analytics**: dashboard KPIs · trends (day/week/month DATE_TRUNC) · top-products · category-revenue
- **Reports**: `export?type=sales|inventory|purchases|profitability&format=csv|xlsx|pdf&start_date&end_date`
- Conventions: Bearer JWT on all but login, paginated envelope `{items,page,total,pages}`, uniform error envelope `{error:{code,message,details}}`, whitelist-validated sort/group params

## Verified Test Results (executed against live Neon DB)
| Test | Result |
|---|---|
| Health check / DB ping | PASS |
| Login → JWT → protected routes | PASS |
| Category/Product creation + validation | PASS |
| Fuzzy search (`q=rice`) | PASS |
| Checkout: TRX-20260824-0001, revenue 6000, profit 2000 | PASS |
| Stock decrement 10→6 | PASS |
| Oversell attempt blocked (`INSUFFICIENT_STOCK`) | PASS |
| Receipt PDF stream (%PDF, 2.4 KB) | PASS |
| Dashboard KPIs & trend buckets correct | PASS |
| XLSX/PDF/CSV exports incl. grand totals | PASS |
| Logout → revoked token rejected 401 | PASS |

## Configuration & Ops
- All secrets via `.env` (DATABASE_URL with `ssl=require`, JWT_SECRET ≥48 hex chars, CORS origins, seed password) — never hard-coded
- Versioned Alembic migrations (initial schema `0001`); forward-only in production
- `scripts/backup.ps1`: nightly `pg_dump -Fc` to local/cloud folder, 30-day retention
- Frontend dev proxy `/api → :8000`; production build outputs static `dist/` deployable to any CDN/host
- Bundle: 779 KB JS (223 KB gzip) — code-splitting ready via route-level dynamic imports

---
*Generated from PRD v3.0 implementation audit — August 2026*
