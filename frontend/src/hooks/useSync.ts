import { useEffect, useCallback } from 'react'
import { db } from '@/lib/db'
import { captureApi } from '@/lib/api'
import { useOfflineStore } from '@/store/offlineStore'

export function useSync() {
  const { setIsSyncing, setPendingCount, setLastSyncAt } = useOfflineStore()

  const updatePendingCount = useCallback(async () => {
    const count = await db.captures.where('synced').equals(0).count()
    setPendingCount(count)
  }, [setPendingCount])

  const sync = useCallback(async () => {
    const pending = await db.captures.where('synced').equals(0).toArray()
    if (pending.length === 0) return

    setIsSyncing(true)
    try {
      await captureApi.sync(pending.map(c => ({ ...c, synced: undefined })))
      const ids = pending.map(c => c.offline_id)
      await db.captures.where('offline_id').anyOf(ids).modify({ synced: 1 })
      setLastSyncAt(new Date().toISOString())
      await updatePendingCount()
    } catch {
      // Sync failed (still offline) — will retry on next reconnect
    } finally {
      setIsSyncing(false)
    }
  }, [setIsSyncing, setLastSyncAt, updatePendingCount])

  useEffect(() => {
    updatePendingCount()

    const handleOnline = () => sync()
    window.addEventListener('online', handleOnline)

    // Also sync on mount if online
    if (navigator.onLine) sync()

    return () => window.removeEventListener('online', handleOnline)
  }, [sync, updatePendingCount])

  return { sync, updatePendingCount }
}
