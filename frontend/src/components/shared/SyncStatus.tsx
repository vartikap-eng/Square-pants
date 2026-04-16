import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useOfflineStore } from '@/store/offlineStore'

export function SyncStatus() {
  const { pendingCount, isSyncing } = useOfflineStore()
  const isOnline = navigator.onLine

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        Syncing…
      </span>
    )
  }

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <CloudOff className="w-3 h-3" />
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
      </span>
    )
  }

  if (pendingCount > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-orange-600">
        <Cloud className="w-3 h-3" />
        {pendingCount} unsynced
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Cloud className="w-3 h-3" />
      Online
    </span>
  )
}
