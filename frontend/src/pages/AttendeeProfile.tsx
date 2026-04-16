import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prospectsApi, outreachApi, type ProspectStatus, type Priority, type Segment } from '@/lib/api'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import {
  ArrowLeft, Linkedin, Mail, Phone, MessageCircle,
  Edit2, Check, X, Clock, Zap, Target, TrendingUp, Users, Lightbulb
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

  const { data: icpReasoning } = useQuery({
    queryKey: ['icp-reasoning', id],
    queryFn: () => prospectsApi.getICPReasoning(Number(id)),
    enabled: !!id,
  })

  const updateMut = useMutation({
    mutationFn: (data: Record<string, string>) => prospectsApi.update(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospect', id] })
      setEditing(false)
    },
  })

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
              <button onClick={() => updateMut.mutate(editValues)} disabled={updateMut.isPending} className="btn-primary text-xs py-1.5 px-3">
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
      </div>

      {/* Contact Information — prominent green card */}
      <div className="card p-5 mb-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-green-600" />
          Contact Information
          <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">READY FOR OUTREACH</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prospect.email && (
            <a href={`mailto:${prospect.email}`}
              className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-300 hover:border-green-500 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Email</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{prospect.email}</p>
              </div>
            </a>
          )}
          {prospect.phone && (
            <a href={`tel:${prospect.phone}`}
              className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-300 hover:border-green-500 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Phone</p>
                <p className="text-sm font-semibold text-gray-900">{prospect.phone}</p>
              </div>
            </a>
          )}
          {prospect.linkedin_url && (
            <a href={prospect.linkedin_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 bg-white rounded-lg p-4 border border-blue-300 hover:border-blue-500 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Linkedin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-0.5">LinkedIn Profile</p>
                <p className="text-sm font-semibold text-blue-900">View Profile →</p>
              </div>
            </a>
          )}
          {company?.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 bg-white rounded-lg p-4 border border-blue-300 hover:border-blue-500 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Linkedin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Company LinkedIn</p>
                <p className="text-sm font-semibold text-blue-900">View Company →</p>
              </div>
            </a>
          )}
          {!prospect.email && !prospect.phone && !prospect.linkedin_url && (
            <p className="text-sm text-gray-400 col-span-2 text-center py-2">No contact details available.</p>
          )}
        </div>
      </div>

      {/* ICP Analysis */}
      {icpReasoning && (
        <div className="card p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-600" />
            ICP Analysis: Why This Prospect Matters
          </h2>

          {/* ICP Fit Badge */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              icpReasoning.priority_level === 'P0' ? 'bg-red-100 text-red-800' :
              icpReasoning.priority_level === 'P1' ? 'bg-orange-100 text-orange-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {icpReasoning.icp_fit}
            </span>
            <span className="text-sm text-gray-600">{icpReasoning.priority_context?.urgency}</span>
          </div>

          {/* Company Analysis */}
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Company Fit Analysis
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Industry Relevance</p>
                <p className="text-sm text-gray-700">{icpReasoning.company_analysis?.why_icp}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Key Pain Points</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {icpReasoning.company_analysis?.pain_points?.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">HyperVerge Solution</p>
                <p className="text-sm text-gray-700 bg-white rounded p-3 border-l-4 border-brand-500">
                  {icpReasoning.company_analysis?.hyperverge_solution}
                </p>
              </div>
            </div>
          </div>

          {/* Stakeholder Analysis */}
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Users className="w-4 h-4 text-blue-600" />
              Stakeholder Analysis
            </h3>
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Decision Authority</p>
                  <p className="text-sm font-semibold text-blue-900">{icpReasoning.stakeholder_analysis?.decision_authority}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Role Category</p>
                  <p className="text-sm font-semibold text-blue-900">{icpReasoning.stakeholder_analysis?.role_category}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Why Target This Role</p>
                <p className="text-sm text-gray-700">{icpReasoning.stakeholder_analysis?.why_target}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Buying Triggers</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {icpReasoning.stakeholder_analysis?.buying_triggers?.map((trigger: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">✓</span>
                      <span>{trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Messaging Approach</p>
                <p className="text-sm text-gray-700 bg-white rounded p-3">{icpReasoning.stakeholder_analysis?.messaging_approach}</p>
              </div>

              {/* Conversation Starters */}
              {icpReasoning.stakeholder_analysis?.conversation_starters && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    Fun Conversation Starters (Icebreakers)
                  </p>
                  <div className="space-y-2">
                    {icpReasoning.stakeholder_analysis.conversation_starters.map((starter: { starter: string; why: string }, idx: number) => (
                      <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-sm text-gray-800 mb-1">{starter.starter}</p>
                        <p className="text-xs text-gray-600 italic flex items-start gap-1">
                          <span className="text-purple-500">💡</span>
                          {starter.why}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    💬 Use these to warm up the conversation before diving into business!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Approach */}
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-lg p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Recommended Outreach Approach
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{icpReasoning.recommended_approach}</p>
            {prospect.outreach_mode && (
              <div className="mt-3 pt-3 border-t border-white/50">
                <span className="text-xs font-medium text-gray-600">Assigned Mode: </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-brand-700 ml-1">
                  {prospect.outreach_mode}
                </span>
                {prospect.owner && (
                  <>
                    <span className="text-xs font-medium text-gray-600 ml-3">Owner: </span>
                    <span className="text-xs font-semibold text-gray-800 ml-1">{prospect.owner}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Notes — structured parsing */}
      {prospect.notes && !editing && (
        <div className="space-y-4 mb-4">
          {(() => {
            const notes = prospect.notes || ''
            const linkedinSection = notes.match(/📱 RECENT LINKEDIN ACTIVITY:([\s\S]*?)(?=📰 RECENT NEWS|💬 CONVERSATION|📞 CONTACT|$)/)?.[1]
            const newsSection = notes.match(/📰 RECENT NEWS:([\s\S]*?)(?=💬 CONVERSATION|📞 CONTACT|$)/)?.[1]
            const conversationSection = notes.match(/💬 CONVERSATION STARTERS \(Based on LinkedIn Activity\):([\s\S]*?)(?=📞 CONTACT|$)/)?.[1]
            const talkingPointsSection = notes.match(/💡 OUTREACH TALKING POINTS:([\s\S]*?)(?=📞 CONTACT|$)/)?.[1]

            return (
              <>
                {linkedinSection && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Linkedin className="w-5 h-5 text-blue-600" /> Recent LinkedIn Activity
                    </h2>
                    <div className="space-y-4">
                      {linkedinSection.split('  •').filter(Boolean).map((item, idx) => {
                        const lines = item.trim().split('\n').filter(Boolean)
                        if (lines[0]?.startsWith('Post')) {
                          const postText = lines[0].replace(/Post \(\d{4}-\d{2}-\d{2}\):/, '').replace(/"/g, '').trim()
                          const engagement = lines.find(l => l.includes('likes'))?.trim()
                          const url = lines.find(l => l.includes('URL:'))?.replace('URL:', '').trim()
                          return (
                            <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                              <p className="text-sm text-gray-900 mb-2 italic">"{postText}"</p>
                              {engagement && <p className="text-xs text-gray-600">{engagement}</p>}
                              {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">View post →</a>
                              )}
                            </div>
                          )
                        }
                        if (lines[0]?.includes('Interests:')) {
                          return (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-2">💡 Professional Interests:</p>
                              <div className="flex flex-wrap gap-2">
                                {lines.slice(1).map((line, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {line.replace('-', '').trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                )}

                {newsSection && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-600" /> Recent Company News
                    </h2>
                    <div className="space-y-3">
                      {newsSection.split('  • ').filter(Boolean).map((newsItem, idx) => {
                        const lines = newsItem.trim().split('\n').filter(Boolean)
                        const headline = lines[0]
                        const relevance = lines.find(l => l.includes('Relevance:'))?.replace('Relevance:', '').trim()
                        return (
                          <div key={idx} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                            <h3 className="font-medium text-gray-900 text-sm mb-1">{headline}</h3>
                            {relevance && (
                              <div className="flex items-start gap-2 mt-2">
                                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium">Why it matters</span>
                                <p className="text-xs text-gray-700">{relevance}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {conversationSection && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-purple-600" /> Conversation Starters
                    </h2>
                    <div className="space-y-3">
                      {conversationSection.split(/\d+\./).filter(Boolean).map((item, idx) => {
                        const lines = item.trim().split('\n').filter(Boolean)
                        const starter = lines[0]?.trim()
                        const why = lines.find(l => l.includes('💡 Why:'))?.replace('💡 Why:', '').trim()
                        const hook = lines.find(l => l.includes('🎯 Hook:'))?.replace('🎯 Hook:', '').trim()
                        return (
                          <div key={idx} className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
                            <div className="flex items-start gap-3 mb-2">
                              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500 text-white text-sm font-bold flex items-center justify-center">{idx + 1}</span>
                              <p className="text-sm text-gray-900 leading-relaxed flex-1">{starter}</p>
                            </div>
                            {why && <p className="ml-10 text-xs text-gray-700 italic flex items-start gap-1 mb-1"><span className="text-purple-500">💡</span>{why}</p>}
                            {hook && <div className="ml-10"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-purple-700 border border-purple-200">{hook}</span></div>}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-xs text-purple-900 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        <span className="font-medium">Pro tip:</span>
                        These are based on their actual LinkedIn activity. Pick the one that feels most natural!
                      </p>
                    </div>
                  </div>
                )}

                {!conversationSection && talkingPointsSection && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" /> Outreach Talking Points
                    </h2>
                    <div className="space-y-2">
                      {talkingPointsSection.split(/\d+\./).filter(Boolean).map((point, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <p className="text-sm text-gray-700 leading-relaxed">{point.trim()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!linkedinSection && !newsSection && !conversationSection && !talkingPointsSection && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-800 mb-2">Notes</h2>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{prospect.notes}</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Activity timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Outreach Activity
          </h2>
          <Link to="/outreach" className="btn-primary text-xs py-1.5 px-3">
            <Zap className="w-3 h-3" /> Go to Outreach Hub
          </Link>
        </div>
        {activities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-3">No outreach activity yet.</p>
            <Link to="/outreach" className="btn-secondary text-sm">
              <Zap className="w-4 h-4" /> Start Outreach Campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(activities as Array<{
              id: number; channel: string; status: string; subject?: string;
              body?: string; sent_at?: string; created_at: string
            }>).map(a => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                <div>
                  <p className="text-gray-700">
                    <span className="font-medium capitalize">{a.channel}</span>
                    {a.subject && ` · "${a.subject}"`}
                    <span className={`ml-2 badge text-xs ${
                      a.status === 'replied' ? 'bg-green-100 text-green-700' :
                      a.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{a.status}</span>
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
