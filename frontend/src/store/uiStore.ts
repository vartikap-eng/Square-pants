import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  activeEventId: number | null
  currentUser: string
  setActiveEventId: (id: number | null) => void
  setCurrentUser: (name: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeEventId: null,
      currentUser: 'You',
      setActiveEventId: (id) => set({ activeEventId: id }),
      setCurrentUser: (name) => set({ currentUser: name }),
    }),
    { name: 'ui-store' }
  )
)
