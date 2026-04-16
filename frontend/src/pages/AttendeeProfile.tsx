import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prospectsApi, outreachApi, type ProspectStatus, type Priority, type Segment } from '@/lib/api'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import {
  ArrowLeft, Linkedin, Mail, Phone, MessageCircle,
  Edit2, Check, X, Clock, Zap
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'

export default function AttendeeProfile() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const { data: prospect, isLoading } = useQuery({
    queryKey: ['prospect', id],
    queryFn: () => prospectsApi.get(Number(id)),
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', id],
    queryFn: () => outreachApi.getActivities(Number(id)),
    enabled: !!id,
  })

  const { data: company } = useQuery({
    queryKey: ['company', prospect?.company_id],
    queryFn: () => prospectsApi.getCompany(Number(id)),
    enabled: !!prospect?.company_id,
  })

  const updateMut = useMutation({
    mutationFn: (data: Record<string, string>) => prospectsApi.update(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospect', id] })
      setEditing(false)
    },
  })

  const handleSave = () => {
    updateMut.mutate(editValues)
  }

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!prospect) return <div className="p-8 text-gray-500">Prospect not found.</div>

  const startEdit = () => {
    setEditValues({
      status: prospect.status,
      owner: prospect.owner || '',
      priority: prospect.priority,
      segment: prospect.segment,
      notes: prospect.notes || '',
    })
    setEditing(true)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link to="/attendees" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Attendees
      </Link>

      {/* Header card */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {prospect.first_name} {prospect.last_name}
            </h1>
            <p className="text-gray-500 mt-0.5">{prospect.title}</p>
            {company && (
              <p className="text-sm text-gray-600 mt-1">
                {company.name}
                <span className="ml-2 text-xs text-gray-400 capitalize">
                  · {company.type.replace('_', ' ')}
                </span>
              </p>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <PriorityBadge priority={prospect.priority} />
              <SegmentTag segment={prospect.segment} />
              <span className="badge bg-gray-100 text-gray-600 capitalize">
                {prospect.status.replace('_', ' ')}
              </span>
              {prospect.attended_previous && (
                <span className="badge bg-indigo-100 text-indigo-700">Returning</span>
              )}
            </div>

            {prospect.score_reason && (
              <p className="text-xs text-gray-400 mt-2 italic">{prospect.score_reason}</p>
            )}
          </div>

          {!editing ? (
            <button onClick={startEdit} className="btn-secondary text-xs">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={updateMut.isPending} className="btn-primary text-xs py-1.5 px-3">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1.5 px-3">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Editable fields */}
        {editing && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={editValues.priority}
                onChange={e => setEditValues(v => ({ ...v, priority: e.target.value }))}>
                {(['P0', 'P1', 'P2', 'Irrelevant'] as Priority[]).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Segment</label>
              <select className="input" value={editValues.segment}
                onChange={e => setEditValues(v => ({ ...v, segment: e.target.value }))}>
                {(['existing_client', 'pipeline', 'cold'] as Segment[]).map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={editValues.status}
                onChange={e => setEditValues(v => ({ ...v, status: e.target.value }))}>
                {(['new', 'contacted', 'replied', 'meeting_booked', 'met', 'followed_up', 'closed'] as ProspectStatus[]).map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Owner</label>
              <input className="input" value={editValues.owner}
                onChange={e => setEditValues(v => ({ ...v, owner: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={editValues.notes}
                onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} />
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="mt-4 flex gap-3 flex-wrap">
          {prospect.email && (
            <a href={`mailto:${prospect.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-700">
              <Mail className="w-3.5 h-3.5" /> {prospect.email}
            </a>
          )}
          {prospect.phone && (
            <a href={`tel:${prospect.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-700">
              <Phone className="w-3.5 h-3.5" /> {prospect.phone}
            </a>
          )}
          {prospect.linkedin_url && (
            <a href={prospect.linkedin_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* LinkedIn research */}
      {(prospect.linkedin_bio || prospect.recent_funding || prospect.recent_job_change) && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-blue-600" /> LinkedIn Research
          </h2>
          {prospect.linkedin_bio && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Bio</p>
              <p className="text-sm text-gray-700">{prospect.linkedin_bio}</p>
            </div>
          )}
          {prospect.recent_funding && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Recent Funding</p>
              <p className="text-sm text-gray-700">{prospect.recent_funding}</p>
            </div>
          )}
          {prospect.recent_job_change && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Job Change</p>
              <p className="text-sm text-gray-700">{prospect.recent_job_change}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {prospect.notes && !editing && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{prospect.notes}</p>
        </div>
      )}

      {/* Activity timeline */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Outreach Activity
        </h2>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400">No outreach activity yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a: {
              id: number; channel: string; status: string; subject?: string;
              body?: string; sent_at?: string; created_at: string
            }) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                <div>
                  <p className="text-gray-700">
                    <span className="font-medium capitalize">{a.channel}</span>
                    {a.subject && ` · "${a.subject}"`}
                    <span className={`ml-2 badge text-xs ${
                      a.status === 'replied' ? 'bg-green-100 text-green-700' :
                      a.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {a.status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(a.sent_at || a.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
