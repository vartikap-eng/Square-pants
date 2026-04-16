import Dexie, { type Table } from 'dexie'
import type { Priority, Segment } from './api'

export interface OfflineCapture {
  offline_id: string  // primary key, crypto.randomUUID()
  event_id: number
  captured_by?: string
  name: string
  company?: string
  title?: string
  phone?: string
  email?: string
  linkedin?: string
  priority: Priority
  segment: Segment
  notes?: string
  product_interest?: string
  next_step?: string
  commitment_made?: string
  captured_at: string
  synced: boolean
}

class ConferenceLeadDB extends Dexie {
  captures!: Table<OfflineCapture>

  constructor() {
    super('ConferenceLeadPlatform')
    this.version(1).stores({
      captures: 'offline_id, event_id, synced, captured_at',
    })
  }
}

export const db = new ConferenceLeadDB()
