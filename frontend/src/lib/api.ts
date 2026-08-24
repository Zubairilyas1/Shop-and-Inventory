import axios, { type InternalAxiosRequestConfig } from "axios"
import { toast } from "sonner"

import { useAuthStore } from "@/stores/authStore"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { message?: string }[] }
}

function extractMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const envelope = body as ErrorBody
    if (envelope.error?.message) return envelope.error.message
  }
  return null
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const body = error.response?.data

      if (status === 401) {
        useAuthStore.getState().clear()
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
        }
        return Promise.reject(error)
      }

      const message = extractMessage(body)
      if (message) {
        const details = (body as ErrorBody).error?.details ?? []
        const firstDetail = details[0]?.message
        toast.error(firstDetail ? `${message} (${firstDetail})` : message)
      } else if (error.request && !error.response) {
        toast.error("Cannot reach the server. Check your connection.")
      } else {
        toast.error("Unexpected error occurred.")
      }
    }
    return Promise.reject(error)
  },
)

export function errorCode(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ErrorBody | undefined
    return body?.error?.code ?? null
  }
  return null
}
