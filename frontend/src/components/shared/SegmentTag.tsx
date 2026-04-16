import type { Segment } from '@/lib/api'

const LABELS: Record<Segment, string> = {
  existing_client: 'Existing Client',
  pipeline: 'Pipeline',
  cold: 'Cold Lead',
}

const STYLES: Record<Segment, string> = {
  existing_client: 'bg-green-100 text-green-800',
  pipeline: 'bg-blue-100 text-blue-800',
  cold: 'bg-purple-100 text-purple-800',
}

export function SegmentTag({ segment }: { segment: Segment }) {
  return (
    <span className={`badge ${STYLES[segment]}`}>
      {LABELS[segment]}
    </span>
  )
}
