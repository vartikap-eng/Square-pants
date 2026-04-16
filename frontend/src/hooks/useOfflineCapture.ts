import { useCallback } from 'react'
import { db, type OfflineCapture } from '@/lib/db'
import { captureApi } from '@/lib/api'
import { useOfflineStore } from '@/store/offlineStore'
import { useUIStore } from '@/store/uiStore'

export function useOfflineCapture() {
  const { setPendingCount } = useOfflineStore()
  const { activeEventId, currentUser } = useUIStore()

  const saveCapture = useCallback(
    async (data: Omit<OfflineCapture, 'offline_id' | 'captured_at' | 'synced' | 'event_id'>) => {
      const capture: OfflineCapture = {
        ...data,
        offline_id: crypto.randomUUID(),
        event_id: activeEventId || 1,
        captured_by: data.captured_by || currentUser,
        captured_at: new Date().toISOString(),
        synced: false,
      }

      if (navigator.onLine) {
        // Online: go directly to server, no need to queue
        try {
          await captureApi.create({ ...capture })
          return { capture, synced: true }
        } catch {
          // Fall through to offline queue
        }
      }

      // Offline: save to IndexedDB
      await db.captures.add(capture)
      const count = await db.captures.where('synced').equals(0).count()
      setPendingCount(count)
      return { capture, synced: false }
    },
    [activeEventId, currentUser, setPendingCount]
  )

  return { saveCapture }
}
