import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachApi, type OutreachActivity, type ActivityStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { format } from 'date-fns'
import {
  Mail, Linkedin, MessageCircle, Phone,
  ChevronDown, ChevronUp, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react'

const CHANNEL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  email:    { icon: Mail,          color: 'text-blue-600 bg-blue-50 border-blue-200',       label: 'Email'    },
  linkedin: { icon: Linkedin,      color: 'text-sky-600 bg-sky-50 border-sky-200',          label: 'LinkedIn' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600 bg-green-50 border-green-200',    label: 'WhatsApp' },
  call:     { icon: Phone,         color: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Call'     },
}

const STATUS_STYLES: Record<ActivityStatus, string> = {
  pending: 'bg-gray-100 text-gray-500',
  sent:    'bg-blue-100 text-blue-700',
  opened:  'bg-amber-100 text-amber-700',
  replied: 'bg-green-100 text-green-700',
  bounced: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
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
      {/* Channel icon */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border flex items-center justify-center ${meta.color}`}>
        <Icon className="w-3 h-3" />
      </div>

      <div className={`card p-3 text-sm ${activity.status === 'replied' ? 'border-green-200 bg-green-50/30' : ''}`}>
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
              {/* Show delivery confirmation for real emails */}
              {activity.channel === 'email' && activity.recipient_email && activity.status !== 'pending' && (
                <span className="flex items-center gap-0.5 text-xs text-gray-400">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  {activity.recipient_email}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(timestamp), 'MMM d, h:mm a')}
              {activity.opened_at && (
                <span className="ml-2 text-amber-600">
                  · opened {format(new Date(activity.opened_at), 'MMM d')}
                </span>
              )}
              {activity.replied_at && (
                <span className="ml-2 text-green-600 font-medium">
                  · replied {format(new Date(activity.replied_at), 'MMM d, h:mm a')}
                </span>
              )}
            </p>

            {/* Email warning (e.g. no email on file) */}
            {activity.email_warning && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" /> {activity.email_warning}
              </p>
            )}
          </div>

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
          <div className="mt-2 p-2.5 bg-white rounded text-xs text-gray-600 whitespace-pre-line border border-gray-200">
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
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckResult, setLastCheckResult] = useState<{ new_replies: number; checked: number } | null>(null)

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', prospectId],
    queryFn: () => outreachApi.getActivities(prospectId),
    enabled: !!prospectId,
  })

  const handleCheckReplies = async () => {
    setIsChecking(true)
    try {
      const result = await outreachApi.checkReplies(activeEventId || undefined)
      setLastCheckResult(result)
      qc.invalidateQueries({ queryKey: ['activities', prospectId] })
      qc.invalidateQueries({ queryKey: ['prospects'] })
    } catch {
      // IMAP not configured or failed — silently ignore
    } finally {
      setIsChecking(false)
    }
  }

  if (isLoading) return <div className="text-xs text-gray-400 py-4">Loading activity…</div>

  if (activities.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No outreach activity yet. Use the Templates tab to send the first message.
      </div>
    )
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const emailActivities = sorted.filter(a => a.channel === 'email' && a.message_id)
  const byChannel = sorted.reduce<Record<string, number>>((acc, a) => {
    acc[a.channel] = (acc[a.channel] || 0) + 1
    return acc
  }, {})
  const replied = sorted.filter(a => a.status === 'replied').length
  const opened  = sorted.filter(a => a.status === 'opened' || a.status === 'replied').length

  return (
    <div className="space-y-4">
      {/* Summary + check replies */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap text-xs">
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

        {/* Check replies button — only shown if there are sent emails with message IDs */}
        {emailActivities.length > 0 && (
          <button
            onClick={handleCheckReplies}
            disabled={isChecking}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking inbox…' : 'Check Replies'}
          </button>
        )}
      </div>

      {/* Reply check result toast */}
      {lastCheckResult !== null && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${
          lastCheckResult.new_replies > 0
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          {lastCheckResult.new_replies > 0
            ? `🎉 ${lastCheckResult.new_replies} new repl${lastCheckResult.new_replies === 1 ? 'y' : 'ies'} detected!`
            : `No new replies found (checked ${lastCheckResult.checked} sent emails).`
          }
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {sorted.map(a => <ActivityItem key={a.id} activity={a} />)}
      </div>
    </div>
  )
}
