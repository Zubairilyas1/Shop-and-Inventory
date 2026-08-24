import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchInput({ value, onChange, placeholder = "Search…", autoFocus }: SearchInputProps) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className="input-field pl-9"
        placeholder={placeholder}
        value={local}
        autoFocus={autoFocus}
        onChange={(event) => {
          setLocal(event.target.value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(event.target.value), 250)
        }}
      />
    </div>
  )
}
