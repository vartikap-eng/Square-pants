import type { Priority } from '@/lib/api'

const STYLES: Record<Priority, string> = {
  P0: 'bg-red-100 text-red-800',
  P1: 'bg-orange-100 text-orange-800',
  P2: 'bg-yellow-100 text-yellow-800',
  Irrelevant: 'bg-gray-100 text-gray-500',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge ${STYLES[priority]}`}>
      {priority}
    </span>
  )
}
