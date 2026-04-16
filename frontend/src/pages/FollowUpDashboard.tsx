import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { followupApi, prospectsApi, type FollowUp, type FollowUpStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { Bell, CheckCircle2, Clock, Loader2, Zap } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'

const CHANNEL_ICONS: Record<string, string> = {
  email: '✉️', linkedin: '💼', whatsapp: '💬', call: '📞'
}

function DueDateBadge({ due_at, status }: { due_at: string; status: FollowUpStatus }) {
  if (status === 'completed') return (
    <span className="badge bg-green-100 text-green-700">Done</span>
  )
  if (status === 'snoozed') return (
    <span className="badge bg-gray-100 text-gray-500">Snoozed</span>
  )
  const d = new Date(due_at)
  if (isPast(d) && !isToday(d)) return (
    <span className="badge bg-red-100 text-red-700">Overdue · {format(d, 'MMM d')}</span>
  )
  if (isToday(d)) return (
    <span className="badge bg-amber-100 text-amber-700">Today</span>
  )
  return (
    <span className="badge bg-blue-100 text-blue-700">{format(d, 'MMM d')}</span>
  )
}

function FollowUpCard({ fu, onComplete, onSnooze, onGetDraft }: {
  fu: FollowUp
  onComplete: () => void
  onSnooze: () => void
  onGetDraft: () => void
}) {
  const { data: prospect } = useQuery({
    queryKey: ['prospect', fu.prospect_id],
    queryFn: () => prospectsApi.get(fu.prospect_id),
  })
  const [showDraft, setShowDraft] = useState(false)

  return (
    <div className={`card p-4 ${fu.status === 'completed' ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{CHANNEL_ICONS[fu.channel]}</span>
            <p className="font-medium text-gray-900 text-sm">
              {prospect ? `${prospect.first_name} ${prospect.last_name}` : `Prospect #${fu.prospect_id}`}
            </p>
            {prospect && (
              <span className="text-xs text-gray-400 truncate">{prospect.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DueDateBadge due_at={fu.due_at} status={fu.status} />
            <span className="text-xs text-gray-400">Step {fu.sequence_step}</span>
            {fu.owner && <span className="text-xs text-gray-400">· {fu.owner}</span>}
          </div>
        </div>

        {fu.status === 'pending' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onGetDraft}
              className="btn-secondary text-xs py-1 px-2"
              title="Generate AI draft"
            >
              <Zap className="w-3 h-3" />
            </button>
            <button
              onClick={onSnooze}
              className="btn-secondary text-xs py-1 px-2"
              title="Snooze 2 days"
            >
              <Clock className="w-3 h-3" />
            </button>
            <button
              onClick={onComplete}
              className="btn-primary text-xs py-1 px-2"
            >
              <CheckCircle2 className="w-3 h-3" />
              Done
            </button>
          </div>
        )}
      </div>

      {/* AI Draft */}
      {fu.ai_draft && (
        <div className="mt-3">
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-xs text-brand-600 font-medium"
          >
            {showDraft ? 'Hide' : 'Show'} AI draft
          </button>
          {showDraft && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-line border border-gray-200">
              {fu.ai_draft}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FollowUpDashboard() {
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [isTriggeringSeq, setIsTriggeringSeq] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState<number | null>(null)

  const params: Record<string, unknown> = {}
  if (activeEventId) params.event_id = activeEventId
  if (tab === 'pending') params.status = 'pending'

  const { data: followups = [], isLoading, refetch } = useQuery({
    queryKey: ['followups', params],
    queryFn: () => followupApi.list(params),
    refetchInterval: 60_000,
  })

  const completeMut = useMutation({
    mutationFn: (id: number) => followupApi.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  })

  const snoozeMut = useMutation({
    mutationFn: (id: number) => followupApi.snooze(id, 2),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  })

  const getDraft = async (id: number) => {
    setLoadingDraft(id)
    try {
      const { draft } = await followupApi.getDraft(id)
      await followupApi.update(id, { ai_draft: draft })
      qc.invalidateQueries({ queryKey: ['followups'] })
    } catch {
      alert('Failed to generate draft. Check OpenAI API key.')
    } finally {
      setLoadingDraft(null)
    }
  }

  const triggerSequence = async () => {
    if (!activeEventId) return alert('Select an event first.')
    setIsTriggeringSeq(true)
    try {
      const result = await followupApi.trigger(activeEventId)
      alert(`Created ${result.followups_created} follow-up tasks for ${result.prospects_processed} prospects.`)
      refetch()
    } catch {
      alert('Failed to trigger sequence.')
    } finally {
      setIsTriggeringSeq(false)
    }
  }

  const overdue = followups.filter(f => f.status === 'pending' && isPast(new Date(f.due_at)))
  const dueToday = followups.filter(f => f.status === 'pending' && isToday(new Date(f.due_at)))
  const upcoming = followups.filter(
    f => f.status === 'pending' && !isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at))
  )
  const done = followups.filter(f => f.status === 'completed' || f.status === 'snoozed')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {followups.filter(f => f.status === 'pending').length} pending
            {overdue.length > 0 && (
              <span className="ml-1.5 text-red-600 font-medium">· {overdue.length} overdue</span>
            )}
          </p>
        </div>
        <button
          onClick={triggerSequence}
          disabled={isTriggeringSeq || !activeEventId}
          className="btn-primary text-sm"
        >
          {isTriggeringSeq ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Generate Sequences
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tab === t ? 'bg-brand-700 text-white border-brand-700' : 'border-gray-300 text-gray-600'
            }`}
          >
            {t === 'pending' ? 'Pending' : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : followups.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No follow-ups yet.</p>
          <p className="text-xs mt-1">Click "Generate Sequences" after your event to auto-create follow-up tasks.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                Overdue ({overdue.length})
              </h2>
              <div className="space-y-2">
                {overdue.map(fu => (
                  <FollowUpCard
                    key={fu.id} fu={fu}
                    onComplete={() => completeMut.mutate(fu.id)}
                    onSnooze={() => snoozeMut.mutate(fu.id)}
                    onGetDraft={() => getDraft(fu.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {dueToday.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                Due Today ({dueToday.length})
              </h2>
              <div className="space-y-2">
                {dueToday.map(fu => (
                  <FollowUpCard
                    key={fu.id} fu={fu}
                    onComplete={() => completeMut.mutate(fu.id)}
                    onSnooze={() => snoozeMut.mutate(fu.id)}
                    onGetDraft={() => getDraft(fu.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map(fu => (
                  <FollowUpCard
                    key={fu.id} fu={fu}
                    onComplete={() => completeMut.mutate(fu.id)}
                    onSnooze={() => snoozeMut.mutate(fu.id)}
                    onGetDraft={() => getDraft(fu.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === 'all' && done.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Completed / Snoozed ({done.length})
              </h2>
              <div className="space-y-2">
                {done.map(fu => (
                  <FollowUpCard
                    key={fu.id} fu={fu}
                    onComplete={() => completeMut.mutate(fu.id)}
                    onSnooze={() => snoozeMut.mutate(fu.id)}
                    onGetDraft={() => getDraft(fu.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
