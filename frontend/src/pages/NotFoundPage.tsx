import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-4 text-center">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <p className="text-sm font-medium text-slate-700">This page does not exist.</p>
      <Link to="/dashboard" className="btn-primary mt-2">
        Back to Dashboard
      </Link>
    </div>
  )
}
