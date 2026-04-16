import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prospectsApi, outreachApi, aiApi, type Prospect, type OutreachChannel, type ProspectStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { HookGenerator } from '@/components/outreach/HookGenerator'
import { Zap, Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

export default function OutreachHub() {
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [showHookGen, setShowHookGen] = useState(false)

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['prospects', { event_id: activeEventId, priority_filter: 'outreach' }],
    queryFn: () => prospectsApi.list({
      event_id: activeEventId || undefined,
      limit: 200,
    }),
  })

  // Only show P0 and P1 by default
  const targeted = prospects.filter(p => p.priority === 'P0' || p.priority === 'P1')
  const others = prospects.filter(p => p.priority === 'P2')

  const logActivity = useMutation({
    mutationFn: (data: {
      prospect_id: number; channel: OutreachChannel; subject?: string; body?: string
    }) => outreachApi.logActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProspectStatus }) =>
      prospectsApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outreach Hub</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {targeted.length} high-priority prospects ready for outreach
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: prospect list */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            P0 + P1 Prospects
          </p>
          {isLoading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : targeted.length === 0 ? (
            <div className="card p-6 text-center text-gray-400 text-sm">
              No P0/P1 prospects yet. Import attendees first.
            </div>
          ) : (
            targeted.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProspect(p); setShowHookGen(false) }}
                className={`w-full text-left card p-3 hover:border-brand-300 transition-colors ${
                  selectedProspect?.id === p.id ? 'border-brand-500 ring-1 ring-brand-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{p.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <PriorityBadge priority={p.priority} />
                    <StatusDot status={p.status} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: action panel */}
        <div className="lg:col-span-3">
          {!selectedProspect ? (
            <div className="card p-8 text-center text-gray-400">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>Select a prospect to start outreach</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Prospect header */}
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedProspect.first_name} {selectedProspect.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{selectedProspect.title}</p>
                  </div>
                  <PriorityBadge priority={selectedProspect.priority} />
                </div>
                {selectedProspect.score_reason && (
                  <p className="text-xs text-gray-400 mt-2 italic">{selectedProspect.score_reason}</p>
                )}

                {/* Quick status update */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  {(['contacted', 'replied', 'meeting_booked'] as ProspectStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus.mutate({ id: selectedProspect.id, status: s })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedProspect.status === s
                          ? 'bg-brand-700 text-white border-brand-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Hook Generator */}
              <div className="card overflow-hidden">
                <button
                  onClick={() => setShowHookGen(!showHookGen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-700 to-violet-600 text-white text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" /> AI Personalization & Message Draft
                  </span>
                  {showHookGen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showHookGen && (
                  <div className="p-4">
                    <HookGenerator prospect={selectedProspect} />
                  </div>
                )}
              </div>

              {/* Quick log outreach */}
              <QuickLogPanel
                prospect={selectedProspect}
                onLog={(channel, subject, body) => {
                  logActivity.mutate({
                    prospect_id: selectedProspect.id,
                    channel,
                    subject,
                    body,
                  })
                  updateStatus.mutate({ id: selectedProspect.id, status: 'contacted' as ProspectStatus })
                }}
                isLogging={logActivity.isPending}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-gray-300',
    contacted: 'bg-blue-400',
    replied: 'bg-green-400',
    meeting_booked: 'bg-emerald-500',
    met: 'bg-violet-500',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-300'}`} />
}

function QuickLogPanel({
  prospect, onLog, isLogging
}: {
  prospect: Prospect
  onLog: (channel: OutreachChannel, subject?: string, body?: string) => void
  isLogging: boolean
}) {
  const [channel, setChannel] = useState<OutreachChannel>('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">Log Outreach Activity</p>
      <div className="flex gap-2">
        {(['email', 'linkedin', 'whatsapp', 'call'] as OutreachChannel[]).map(c => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              channel === c ? 'bg-brand-700 text-white border-brand-700' : 'border-gray-300 text-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {channel === 'email' && (
        <input
          className="input"
          placeholder="Subject line"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      )}
      <textarea
        className="input"
        rows={4}
        placeholder="Message body (paste drafted message here)…"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <button
        onClick={() => onLog(channel, subject || undefined, body || undefined)}
        disabled={isLogging}
        className="btn-primary w-full"
      >
        {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Log as Sent
      </button>
    </div>
  )
}
