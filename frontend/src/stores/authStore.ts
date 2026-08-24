import { create } from "zustand"

import type { UserBrief } from "@/types/api"

interface AuthState {
  token: string | null
  user: UserBrief | null
  setSession: (token: string, user: UserBrief) => void
  clear: () => void
}

const STORAGE_KEY = "shop.auth.session"

interface StoredSession {
  token: string | null
  user: UserBrief | null
}

function readStored(): StoredSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    return JSON.parse(raw) as StoredSession
  } catch {
    return { token: null, user: null }
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const initial = readStored()
  return {
    token: initial.token,
    user: initial.user,
    setSession: (token, user) => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
      set({ token, user })
    },
    clear: () => {
      sessionStorage.removeItem(STORAGE_KEY)
      set({ token: null, user: null })
    },
  }
})
