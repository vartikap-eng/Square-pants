import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  prospectsApi, scheduleApi, type Prospect, type ProspectStatus,
} from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import { ActivityTimeline } from '@/components/outreach/ActivityTimeline'
import { TemplateLibrary } from '@/components/outreach/TemplateLibrary'
import { Zap, Search, X, Calendar } from 'lucide-react'

type RightTab = 'timeline' | 'templates'

const STATUS_COLOR: Record<string, string> = {
  new:            'bg-gray-300',
  contacted:      'bg-blue-400',
  replied:        'bg-green-500',
  meeting_booked: 'bg-emerald-500',
  met:            'bg-violet-500',
  followed_up:    'bg-sky-400',
  closed:         'bg-gray-500',
}

// ─── Prospect list sidebar ────────────────────────────────────────────────────

function ProspectSidebar({
  prospects, selected, onSelect,
}: {
  prospects: Prospect[]
  selected: Prospect | null
  onSelect: (p: Prospect) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? prospects.filter(p =>
        `${p.first_name} ${p.last_name} ${p.title}`.toLowerCase().includes(search.toLowerCase())
      )
    : prospects

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="input pl-8 text-xs py-1.5"
            placeholder="Search prospects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 && (
          <p className="p-4 text-xs text-gray-400 text-center">No prospects found.</p>
        )}
        {filtered.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
              selected?.id === p.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[p.status] || 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {p.first_name} {p.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{p.title}</p>
              </div>
              <PriorityBadge priority={p.priority} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Quick meeting modal ──────────────────────────────────────────────────────

function QuickMeetingModal({
  prospect, eventId, onClose,
}: { prospect: Prospect; eventId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { currentUser } = useUIStore()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [gcalUrl, setGcalUrl] = useState('')

  const handleSave = async () => {
    if (!date || !eventId) return
    setSaving(true)
    try {
      const start = `${date}T${startTime}:00`
      const end = `${date}T${endTime}:00`
      await scheduleApi.create({
        event_id: eventId,
        prospect_id: prospect.id,
        owner: currentUser,
        title: `Meeting with ${prospect.first_name} ${prospect.last_name}`,
        start_time: start,
        end_time: end,
        location: location || undefined,
        is_pre_booked: true,
      })
      // Mark prospect as meeting_booked
      await prospectsApi.update(prospect.id, { status: 'meeting_booked' })
      qc.invalidateQueries({ queryKey: ['prospects'] })
      qc.invalidateQueries({ queryKey: ['prospect', String(prospect.id)] })
      qc.invalidateQueries({ queryKey: ['schedule'] })

      // Build Google Calendar link
      const fmt = (iso: string) =>
        new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `Meeting with ${prospect.first_name} ${prospect.last_name}`,
        dates: `${fmt(start)}/${fmt(end)}`,
        location: location,
        details: `Conference meeting — ${prospect.title} at company`,
      })
      setGcalUrl(`https://calendar.google.com/calendar/render?${params.toString()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 text-sm">Schedule Meeting</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            With <span className="font-medium">{prospect.first_name} {prospect.last_name}</span>
            <span className="text-gray-400"> · {prospect.title}</span>
          </p>

          {gcalUrl ? (
            // Post-save: show Google Calendar link
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700 text-center">
                ✓ Meeting saved & prospect marked as <strong>meeting booked</strong>
              </div>
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Add to Google Calendar
              </a>
              <button onClick={onClose} className="btn-secondary w-full text-sm">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="label text-xs">Date</label>
                <input type="date" className="input text-sm"
                  value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Start time</label>
                  <input type="time" className="input text-sm"
                    value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">End time</label>
                  <input type="time" className="input text-sm"
                    value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Location / Booth (optional)</label>
                <input className="input text-sm" placeholder="e.g. Hall 3, Booth 12"
                  value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              {!eventId && (
                <p className="text-xs text-amber-600">Select an event first from the sidebar.</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !date || !eventId}
                  className="btn-primary flex-1 text-sm"
                >
                  {saving ? 'Saving…' : 'Save & Open Google Cal'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Prospect header strip ────────────────────────────────────────────────────

function ProspectHeader({ prospectId }: { prospectId: number }) {
  const qc = useQueryClient()
  const { activeEventId } = useUIStore()
  const [showMeetingModal, setShowMeetingModal] = useState(false)

  // Fetch the live prospect so status refreshes after every mutation
  const { data: prospect } = useQuery({
    queryKey: ['prospect', String(prospectId)],
    queryFn: () => prospectsApi.get(prospectId),
  })

  const updateStatus = useMutation({
    mutationFn: (status: ProspectStatus) => prospectsApi.update(prospectId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospect', String(prospectId)] })
      qc.invalidateQueries({ queryKey: ['prospects'] })
    },
  })

  if (!prospect) return null

  const STATUS_ACTIONS: { status: ProspectStatus; label: string; onClick: () => void }[] = [
    { status: 'contacted',     label: 'contacted',     onClick: () => updateStatus.mutate('contacted') },
    { status: 'replied',       label: 'replied',       onClick: () => updateStatus.mutate('replied') },
    { status: 'meeting_booked',label: 'meeting booked',onClick: () => setShowMeetingModal(true) },
  ]

  return (
    <>
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              {prospect.first_name} {prospect.last_name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{prospect.title}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <PriorityBadge priority={prospect.priority} />
              <SegmentTag segment={prospect.segment} />
              {prospect.status !== 'new' && (
                <span className="badge bg-gray-100 text-gray-600 capitalize text-xs">
                  {prospect.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
          {/* Quick status chips */}
          <div className="flex gap-1.5 flex-wrap shrink-0">
            {STATUS_ACTIONS.map(({ status, label, onClick }) => (
              <button
                key={status}
                onClick={onClick}
                disabled={updateStatus.isPending}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  prospect.status === status
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'border-gray-300 text-gray-500 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {prospect.score_reason && (
          <p className="text-xs text-gray-400 mt-2 italic">{prospect.score_reason}</p>
        )}
      </div>

      {showMeetingModal && (
        <QuickMeetingModal
          prospect={prospect}
          eventId={activeEventId}
          onClose={() => setShowMeetingModal(false)}
        />
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachHub() {
  const { activeEventId } = useUIStore()
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [activeTab, setActiveTab] = useState<RightTab>('timeline')

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['prospects', { event_id: activeEventId }],
    queryFn: () => prospectsApi.list({
      event_id: activeEventId || undefined,
      limit: 300,
    }),
  })

  const allShown = [
    ...prospects.filter(p => p.priority === 'P0' || p.priority === 'P1'),
    ...prospects.filter(p => p.priority === 'P2'),
  ]

  const TABS: { id: RightTab; label: string }[] = [
    { id: 'timeline',  label: 'Timeline'  },
    { id: 'templates', label: 'Templates' },
  ]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden">
      {/* ── Column 1: Prospect list ── */}
      <div className="w-56 lg:w-64 shrink-0 flex flex-col bg-white">
        <div className="px-3 py-3 border-b border-gray-200">
          <h1 className="font-semibold text-gray-900 text-sm">Outreach Console</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {prospects.filter(p => p.priority === 'P0' || p.priority === 'P1').length} P0/P1 ·{' '}
            {prospects.filter(p => p.priority === 'P2').length} P2
          </p>
        </div>
        {isLoading ? (
          <div className="p-4 text-xs text-gray-400">Loading…</div>
        ) : (
          <ProspectSidebar
            prospects={allShown}
            selected={selected}
            onSelect={p => { setSelected(p); setActiveTab('timeline') }}
          />
        )}
      </div>

      {/* ── Column 2: Right panel ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a prospect to start</p>
              <p className="text-xs mt-1 text-gray-300">Timeline · Templates</p>
            </div>
          </div>
        ) : (
          <>
            <ProspectHeader prospectId={selected.id} />

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-white px-5">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'timeline' && (
                <ActivityTimeline prospectId={selected.id} />
              )}
              {activeTab === 'templates' && (
                <TemplateLibrary prospect={selected} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
