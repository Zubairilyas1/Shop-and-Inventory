import { toast } from "sonner"
import { create } from "zustand"

import type { Product } from "@/types/api"

export interface CartItem {
  product: Product
  quantity: number
}

interface CartState {
  items: CartItem[]
  addItem: (product: Product) => void
  increment: (productId: number) => void
  decrement: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clear: () => void
}

const STORAGE_KEY = "shop.pos.cart"

function persist(items: CartItem[]): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function load(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CartItem[]
  } catch {
    return []
  }
}

export const useCartStore = create<CartState>()((set) => ({
  items: load(),

  addItem: (product) => {
    if (product.current_stock === 0) {
      toast.error(`"${product.name}" is out of stock.`)
      return
    }
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id)
      let items: CartItem[]
      if (existing) {
        if (existing.quantity + 1 > product.current_stock) {
          toast.warning(`Only ${product.current_stock} units of "${product.name}" available.`)
          return state
        }
        items = state.items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      } else {
        items = [...state.items, { product, quantity: 1 }]
      }
      persist(items)
      return { items }
    })
  },

  increment: (productId) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.product.id === productId && item.quantity < item.product.current_stock
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      )
      persist(items)
      return { items }
    })
  },

  decrement: (productId) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.product.id === productId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item,
      )
      persist(items)
      return { items }
    })
  },

  setQuantity: (productId, quantity) => {
    set((state) => {
      const items = state.items.map((item) => {
        if (item.product.id !== productId) return item
        const clamped = Math.max(1, Math.min(quantity, item.product.current_stock))
        return { ...item, quantity: clamped }
      })
      persist(items)
      return { items }
    })
  },

  removeItem: (productId) => {
    set((state) => {
      const items = state.items.filter((item) => item.product.id !== productId)
      persist(items)
      return { items }
    })
  },

  clear: () => {
    sessionStorage.removeItem(STORAGE_KEY)
    set({ items: [] })
  },
}))

export function cartTotalItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + Number(item.product.selling_price) * item.quantity,
    0,
  )
}
