import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi, prospectsApi, type Meeting, type MeetingStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { Calendar, Plus, Clock, MapPin, X, CheckCircle2, UserX, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Build a Google Calendar "Add to Calendar" URL
function buildGCalUrl(meeting: Meeting, title: string): string {
  const fmt = (iso: string) =>
    iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z')

  const start = fmt(new Date(meeting.start_time).toISOString())
  const end   = fmt(new Date(meeting.end_time).toISOString())

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     title,
    dates:    `${start}/${end}`,
    location: meeting.location || '',
    details:  meeting.notes || `Conference meeting — ${title}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function MeetingCard({ meeting, onStatusChange, onDelete }: {
  meeting: Meeting
  onStatusChange: (status: MeetingStatus) => void
  onDelete: () => void
}) {
  const { data: prospect } = useQuery({
    queryKey: ['prospect', meeting.prospect_id],
    queryFn: () => prospectsApi.get(meeting.prospect_id!),
    enabled: !!meeting.prospect_id,
  })

  const statusColor: Record<MeetingStatus, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    no_show:   'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const meetingTitle = meeting.title
    || (prospect ? `Meeting with ${prospect.first_name} ${prospect.last_name}` : 'Conference Meeting')

  const gcalUrl = buildGCalUrl(meeting, meetingTitle)

  return (
    <div className={`card p-4 ${meeting.is_pre_booked ? 'border-l-4 border-l-brand-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">{meetingTitle}</p>
            {meeting.is_pre_booked && (
              <span className="badge bg-brand-100 text-brand-700 text-xs">Pre-booked</span>
            )}
            <span className={`badge text-xs ${statusColor[meeting.status]}`}>
              {meeting.status.replace('_', ' ')}
            </span>
          </div>

          {prospect && (
            <p className="text-xs text-gray-500 mt-0.5">{prospect.title}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(meeting.start_time), 'MMM d, h:mm a')} – {format(parseISO(meeting.end_time), 'h:mm a')}
            </span>
            {meeting.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {meeting.location}
              </span>
            )}
            {meeting.owner && <span className="text-gray-400">{meeting.owner}</span>}
          </div>

          {meeting.notes && (
            <p className="text-xs text-gray-500 mt-2 italic">{meeting.notes}</p>
          )}

          {/* Google Calendar link */}
          {meeting.status === 'scheduled' && (
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-2.5 py-1 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
              Add to Google Calendar
            </a>
          )}
        </div>

        {meeting.status === 'scheduled' && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onStatusChange('completed')}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Mark completed">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button onClick={() => onStatusChange('no_show')}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Mark no-show">
              <UserX className="w-4 h-4" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddMeetingModal({ eventId, onClose, onSuccess }: {
  eventId: number; onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState({
    title: '', prospect_id: '', start_time: '', end_time: '',
    location: '', owner: '', notes: '', is_pre_booked: false
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!form.start_time || !form.end_time) return
    setIsSaving(true)
    try {
      await scheduleApi.create({
        event_id: eventId,
        title: form.title || undefined,
        prospect_id: form.prospect_id ? Number(form.prospect_id) : undefined,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location || undefined,
        owner: form.owner || undefined,
        notes: form.notes || undefined,
        is_pre_booked: form.is_pre_booked,
      })
      onSuccess()
    } catch {
      alert('Failed to save meeting.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold">Add Meeting</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="label">Title (optional)</label>
            <input className="input" placeholder="e.g. HDFC Credit Team"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input className="input" type="datetime-local"
                value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input className="input" type="datetime-local"
                value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Location / Booth</label>
            <input className="input" placeholder="e.g. Hall 3, Booth 42"
              value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="label">Owner (team member)</label>
            <input className="input" placeholder="Your name"
              value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_pre_booked}
              onChange={e => setForm(f => ({ ...f, is_pre_booked: e.target.checked }))} />
            Pre-booked meeting (P0 priority)
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1">
              {isSaving ? 'Saving…' : 'Add Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Schedule() {
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string>('')

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['schedule', activeEventId, selectedDay],
    queryFn: () => scheduleApi.list({
      event_id: activeEventId || undefined,
      day: selectedDay || undefined,
    }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: MeetingStatus }) =>
      scheduleApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => scheduleApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  // Group by day
  const grouped: Record<string, Meeting[]> = {}
  for (const m of meetings) {
    const day = format(parseISO(m.start_time), 'yyyy-MM-dd')
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(m)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meetings.length} meetings</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date" className="input text-sm py-1.5"
            value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
          />
          <button
            onClick={() => setShowAdd(true)}
            disabled={!activeEventId}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading…</div>
      ) : meetings.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No meetings scheduled.</p>
          <p className="text-xs mt-1">Add pre-booked meetings here to build your conference agenda.</p>
          <button onClick={() => setShowAdd(true)} disabled={!activeEventId}
            className="btn-primary mt-4">
            <Plus className="w-4 h-4" /> Add Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, dayMeetings]) => (
              <section key={day}>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">
                  {format(parseISO(day), 'EEEE, MMMM d')}
                  <span className="ml-2 text-gray-400 font-normal">({dayMeetings.length} meetings)</span>
                </h2>
                <div className="space-y-2">
                  {dayMeetings
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map(m => (
                      <MeetingCard
                        key={m.id} meeting={m}
                        onStatusChange={(status) => updateMut.mutate({ id: m.id, status })}
                        onDelete={() => deleteMut.mutate(m.id)}
                      />
                    ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {showAdd && activeEventId && (
        <AddMeetingModal
          eventId={activeEventId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            qc.invalidateQueries({ queryKey: ['schedule'] })
          }}
        />
      )}
    </div>
  )
}
