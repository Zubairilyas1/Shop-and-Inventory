interface ErrorPanelProps {
  message?: string
  onRetry?: () => void
}

export function ErrorPanel({ message = "Something went wrong while loading data.", onRetry }: ErrorPanelProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3 border-red-300 bg-white text-red-700 hover:bg-red-100">
          Retry
        </button>
      ) : null}
    </div>
  )
}
