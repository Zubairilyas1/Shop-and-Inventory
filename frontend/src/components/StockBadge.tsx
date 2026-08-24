interface StockBadgeProps {
  stock: number
  minAlert: number
}

export function StockBadge({ stock, minAlert }: StockBadgeProps) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Out of Stock
      </span>
    )
  }
  if (stock <= minAlert) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Low · {stock}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      In Stock · {stock}
    </span>
  )
}
