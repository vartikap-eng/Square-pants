import { create } from 'zustand'

interface OfflineState {
  pendingCount: number
  isSyncing: boolean
  lastSyncAt: string | null
  setPendingCount: (n: number) => void
  setIsSyncing: (v: boolean) => void
  setLastSyncAt: (t: string) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  setPendingCount: (n) => set({ pendingCount: n }),
  setIsSyncing: (v) => set({ isSyncing: v }),
  setLastSyncAt: (t) => set({ lastSyncAt: t }),
}))
