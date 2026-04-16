import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachApi, type OutreachActivity, type ActivityStatus } from '@/lib/api'
import { format } from 'date-fns'
import { Mail, Linkedin, MessageCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const CHANNEL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  email:    { icon: Mail,          color: 'text-blue-600 bg-blue-50 border-blue-200',    label: 'Email'    },
  linkedin: { icon: Linkedin,      color: 'text-sky-600 bg-sky-50 border-sky-200',       label: 'LinkedIn' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600 bg-green-50 border-green-200', label: 'WhatsApp' },
  call:     { icon: Phone,         color: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Call'  },
}

const STATUS_STYLES: Record<ActivityStatus, string> = {
  pending:  'bg-gray-100 text-gray-500',
  sent:     'bg-blue-100 text-blue-700',
  opened:   'bg-amber-100 text-amber-700',
  replied:  'bg-green-100 text-green-700',
  bounced:  'bg-red-100 text-red-700',
  skipped:  'bg-gray-100 text-gray-400 line-through',
}

function ActivityItem({ activity }: { activity: OutreachActivity }) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()
  const meta = CHANNEL_META[activity.channel] || CHANNEL_META.email
  const Icon = meta.icon

  const updateStatus = useMutation({
    mutationFn: (status: ActivityStatus) =>
      outreachApi.updateActivityStatus(activity.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities', activity.prospect_id] }),
  })

  const timestamp = activity.sent_at || activity.created_at

  return (
    <div className="relative pl-8">
      {/* Timeline dot + line */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border flex items-center justify-center ${meta.color}`}>
        <Icon className="w-3 h-3" />
      </div>

      <div className="card p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-800">{meta.label}</span>
              {activity.subject && (
                <span className="text-gray-500 truncate max-w-[200px]">"{activity.subject}"</span>
              )}
              <span className={`badge text-xs ${STATUS_STYLES[activity.status]}`}>
                {activity.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(timestamp), 'MMM d, h:mm a')}
              {activity.opened_at && (
                <span className="ml-2 text-amber-600">
                  · opened {format(new Date(activity.opened_at), 'MMM d')}
                </span>
              )}
              {activity.replied_at && (
                <span className="ml-2 text-green-600">
                  · replied {format(new Date(activity.replied_at), 'MMM d')}
                </span>
              )}
            </p>
          </div>

          {/* Status updaters */}
          <div className="flex gap-1 shrink-0">
            {activity.status === 'sent' && (
              <>
                <button
                  onClick={() => updateStatus.mutate('opened')}
                  className="text-xs px-2 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  Opened
                </button>
                <button
                  onClick={() => updateStatus.mutate('replied')}
                  className="text-xs px-2 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50"
                >
                  Replied
                </button>
              </>
            )}
            {activity.body && (
              <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {expanded && activity.body && (
          <div className="mt-2 p-2.5 bg-gray-50 rounded text-xs text-gray-600 whitespace-pre-line border border-gray-200">
            {activity.body}
          </div>
        )}
        {expanded && activity.notes && (
          <p className="mt-1.5 text-xs text-gray-500 italic">{activity.notes}</p>
        )}
      </div>
    </div>
  )
}

interface Props {
  prospectId: number
}

export function ActivityTimeline({ prospectId }: Props) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', prospectId],
    queryFn: () => outreachApi.getActivities(prospectId),
    enabled: !!prospectId,
  })

  if (isLoading) return <div className="text-xs text-gray-400 py-4">Loading activity…</div>

  if (activities.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No outreach activity yet. Use the Compose tab to send the first message.
      </div>
    )
  }

  // Sort chronologically ascending for timeline display
  const sorted = [...activities].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Count by channel for the summary bar
  const byChannel = sorted.reduce<Record<string, number>>((acc, a) => {
    acc[a.channel] = (acc[a.channel] || 0) + 1
    return acc
  }, {})

  const replied = sorted.filter(a => a.status === 'replied').length
  const opened = sorted.filter(a => a.status === 'opened' || a.status === 'replied').length

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex gap-3 flex-wrap text-xs">
        {Object.entries(byChannel).map(([ch, count]) => {
          const meta = CHANNEL_META[ch]
          if (!meta) return null
          const Icon = meta.icon
          return (
            <span key={ch} className={`flex items-center gap-1 px-2 py-1 rounded-full border ${meta.color}`}>
              <Icon className="w-3 h-3" /> {count} {meta.label}
            </span>
          )
        })}
        {opened > 0 && (
          <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {opened} opened
          </span>
        )}
        {replied > 0 && (
          <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            {replied} replied
          </span>
        )}
      </div>

      {/* Timeline items */}
      <div className="space-y-3">
        {sorted.map(a => <ActivityItem key={a.id} activity={a} />)}
      </div>
    </div>
  )
}
