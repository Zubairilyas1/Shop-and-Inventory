import type { AxiosResponse } from "axios"

export function downloadBlobResponse(response: AxiosResponse<Blob>, fallbackName: string): void {
  const disposition = String(response.headers["content-disposition"] ?? "")
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackName

  const url = URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
