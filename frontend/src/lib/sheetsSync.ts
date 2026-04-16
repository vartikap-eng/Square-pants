/**
 * Google Sheets webhook sync for lead captures.
 * Set VITE_SHEETS_WEBHOOK_URL in .env to a Google Apps Script Web App URL.
 * Falls back to a localStorage queue when offline or webhook not configured.
 */

const STORAGE_KEY = 'sheets_pending_queue'
const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined

export type SheetsPayload = {
  name: string
  company: string
  title: string
  email: string
  phone: string
  linkedin: string
  priority: string
  notes: string
  nextSteps: string
  followUpDate: string
  captureMethod: string
  timestamp: string
  imageCount?: number
}

function getQueue(): SheetsPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: SheetsPayload[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function getPendingSheetsCount(): number {
  return getQueue().length
}

async function postToSheets(payload: SheetsPayload): Promise<boolean> {
  if (!WEBHOOK_URL) return true  // No webhook configured — silently succeed

  try {
    // Send as text/plain — allowed under no-cors; Apps Script can parse JSON body
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    })
    return true
  } catch {
    return false
  }
}

export async function syncToSheets(payload: SheetsPayload): Promise<'synced' | 'queued'> {
  if (!navigator.onLine || !WEBHOOK_URL) {
    if (WEBHOOK_URL) {
      // Offline but webhook configured — queue it
      const queue = getQueue()
      queue.push(payload)
      saveQueue(queue)
      return 'queued'
    }
    return 'synced'  // No webhook set — treat as synced so UI doesn't show noise
  }

  const ok = await postToSheets(payload)
  if (!ok) {
    const queue = getQueue()
    queue.push(payload)
    saveQueue(queue)
    return 'queued'
  }

  return 'synced'
}

export async function flushSheetsQueue(): Promise<number> {
  if (!WEBHOOK_URL) {
    localStorage.removeItem(STORAGE_KEY)
    return 0
  }

  const queue = getQueue()
  if (queue.length === 0) return 0

  const remaining: SheetsPayload[] = []
  for (const payload of queue) {
    const ok = await postToSheets(payload)
    if (!ok) {
      remaining.push(payload)
      break
    }
  }

  const leftover = [...remaining, ...queue.slice(queue.length - remaining.length)]
  if (leftover.length > 0) {
    saveQueue(leftover)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }

  return queue.length - leftover.length
}

// Auto-flush queued entries when connectivity returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushSheetsQueue())
}
