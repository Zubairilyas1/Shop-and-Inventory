interface PaginationProps {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pages, total, onChange }: PaginationProps) {
  if (pages <= 1) {
    return <p className="py-2 text-center text-xs text-slate-500">{total} record(s)</p>
  }

  const windowStart = Math.max(1, Math.min(page - 2, pages - 4))
  const windowEnd = Math.min(pages, windowStart + 4)
  const pageNumbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i)

  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-xs text-slate-500">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-secondary px-2 py-1" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Prev
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            className={
              n === page
                ? "rounded-lg bg-slate-900 px-3 py-1 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
            }
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="btn-secondary px-2 py-1"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
