import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30_000,
})

// ─── Types matching backend models ───────────────────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2' | 'Irrelevant'
export type Segment = 'existing_client' | 'pipeline' | 'cold'
export type ProspectStatus = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'met' | 'followed_up' | 'closed'
export type CompanyType = 'banking' | 'fintech' | 'financial_services' | 'nbfc' | 'insurance' | 'other'
export type FollowUpStatus = 'pending' | 'sent' | 'snoozed' | 'skipped' | 'completed'
export type OutreachChannel = 'email' | 'linkedin' | 'whatsapp' | 'call'
export type MeetingStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled'

export interface Event {
  id: number
  name: string
  date_start: string
  date_end: string
  location: string
  description?: string
  created_at: string
}

export interface Company {
  id: number
  name: string
  type: CompanyType
  size_band?: string
  funding_stage?: string
  hq_country?: string
  linkedin_url?: string
}

export interface Prospect {
  id: number
  event_id: number
  company_id?: number
  first_name: string
  last_name: string
  title: string
  email?: string
  phone?: string
  linkedin_url?: string
  segment: Segment
  priority: Priority
  score_reason?: string
  source?: string
  attended_previous: boolean
  status: ProspectStatus
  owner?: string
  linkedin_bio?: string
  linkedin_recent_posts?: string
  recent_funding?: string
  recent_job_change?: string
  notes?: string
  outreach_mode?: string
  created_at: string
  updated_at: string
}

export interface LeadCapture {
  id: number
  event_id: number
  prospect_id?: number
  captured_by?: string
  name: string
  company?: string
  title?: string
  phone?: string
  email?: string
  linkedin?: string
  priority: Priority
  segment: Segment
  notes?: string
  product_interest?: string
  next_step?: string
  commitment_made?: string
  offline_id?: string
  captured_at: string
  synced_at?: string
}

export interface FollowUp {
  id: number
  prospect_id: number
  event_id: number
  sequence_step: number
  due_at: string
  completed_at?: string
  channel: OutreachChannel
  status: FollowUpStatus
  owner?: string
  ai_draft?: string
  created_at: string
}

export interface Meeting {
  id: number
  event_id: number
  prospect_id?: number
  owner?: string
  title?: string
  start_time: string
  end_time: string
  location?: string
  status: MeetingStatus
  is_pre_booked: boolean
  notes?: string
  created_at: string
}

export type ActivityStatus = 'pending' | 'sent' | 'opened' | 'replied' | 'bounced' | 'skipped'

export interface OutreachActivity {
  id: number
  prospect_id: number
  sequence_id?: number
  channel: OutreachChannel
  step_number: number
  subject?: string
  body?: string
  status: ActivityStatus
  sent_at?: string
  opened_at?: string
  replied_at?: string
  notes?: string
  message_id?: string
  recipient_email?: string
  email_warning?: string   // set if email send failed but activity was still logged
  created_at: string
}

export interface OutreachTemplate {
  id: number
  name: string
  channel: OutreachChannel | 'call'
  segment: string
  subject?: string
  body: string
  tags?: string
  is_default: boolean
  created_at: string
}

export interface MergeField {
  field: string
  description: string
}

export interface ProspectResearch {
  id: number
  prospect_id: number
  linkedin_bio?: string
  recent_posts?: string
  recent_funding?: string
  job_change?: string
  mutual_connections?: string
  company_news?: string
  ai_summary?: string
  hooks: string[]
  updated_at: string
}

export interface HookResult {
  summary: string
  hooks: string[]
}

export interface AnalyticsSummary {
  total_prospects: number
  priority_breakdown: Record<string, number>
  segment_breakdown: Record<string, number>
  status_breakdown: Record<string, number>
  total_captures: number
  meetings_booked: number
  outreach: { total_sent: number; replied: number; reply_rate_pct: number }
  followups: {
    total: number; completed: number; pending: number;
    overdue: number; completion_rate_pct: number
  }
  funnel: Array<{ stage: string; count: number }>
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export const eventsApi = {
  list: () => api.get<Event[]>('/events').then(r => r.data),
  create: (data: Omit<Event, 'id' | 'created_at'>) => api.post<Event>('/events', data).then(r => r.data),
  get: (id: number) => api.get<Event>(`/events/${id}`).then(r => r.data),
}

export const prospectsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Prospect[]>('/prospects', { params }).then(r => r.data),
  get: (id: number) => api.get<Prospect>(`/prospects/${id}`).then(r => r.data),
  update: (id: number, data: Partial<Prospect>) =>
    api.patch<Prospect>(`/prospects/${id}`, data).then(r => r.data),
  import: (eventId: number, file: File) => {
    const fd = new FormData()
    fd.append('event_id', String(eventId))
    fd.append('file', file)
    return api.post('/prospects/import', fd).then(r => r.data)
  },
  rescore: (id: number) => api.post<Prospect>(`/prospects/${id}/rescore`).then(r => r.data),
  getCompany: (id: number) => api.get<Company>(`/prospects/${id}/company`).then(r => r.data),
  getICPReasoning: (id: number) => api.get(`/prospects/${id}/icp-reasoning`).then(r => r.data),
  autoAssignOwners: (eventId?: number) =>
    api.post('/prospects/auto-assign-owners', null, { params: eventId ? { event_id: eventId } : {} }).then(r => r.data),
}

export const outreachApi = {
  // Templates
  listTemplates: (params?: { channel?: string; segment?: string }) =>
    api.get<OutreachTemplate[]>('/outreach/templates', { params }).then(r => r.data),
  createTemplate: (data: Omit<OutreachTemplate, 'id' | 'is_default' | 'created_at'>) =>
    api.post<OutreachTemplate>('/outreach/templates', data).then(r => r.data),
  updateTemplate: (id: number, data: Partial<OutreachTemplate>) =>
    api.patch<OutreachTemplate>(`/outreach/templates/${id}`, data).then(r => r.data),
  deleteTemplate: (id: number) =>
    api.delete(`/outreach/templates/${id}`).then(r => r.data),
  previewTemplate: (id: number, mergeValues: Record<string, string>) =>
    api.post<{ subject?: string; body: string; channel: string }>(
      `/outreach/templates/${id}/preview`, mergeValues
    ).then(r => r.data),
  getMergeFields: () => api.get<MergeField[]>('/outreach/merge-fields').then(r => r.data),
  // Research
  getResearch: (prospectId: number) =>
    api.get<ProspectResearch>(`/outreach/research/${prospectId}`).then(r => r.data),
  upsertResearch: (prospectId: number, data: Partial<ProspectResearch>) =>
    api.put<ProspectResearch>(`/outreach/research/${prospectId}`, data).then(r => r.data),
  cacheHooks: (prospectId: number, summary: string, hooks: string[]) =>
    api.post(`/outreach/research/${prospectId}/cache-hooks`, { summary, hooks }).then(r => r.data),
  // Activities
  getActivities: (prospectId: number) =>
    api.get<OutreachActivity[]>(`/outreach/activities/${prospectId}`).then(r => r.data),
  updateActivityStatus: (activityId: number, status: ActivityStatus) =>
    api.patch(`/outreach/activities/${activityId}/status`, null, { params: { status } }).then(r => r.data),
  logActivity: (data: unknown) => api.post('/outreach/send', data).then(r => r.data),
  checkReplies: (eventId?: number) =>
    api.post<{ checked: number; new_replies: number }>(
      '/outreach/check-replies',
      null,
      { params: eventId ? { event_id: eventId } : {} }
    ).then(r => r.data),
  // Sequences (kept for other modules)
  listSequences: () => api.get('/outreach/sequences').then(r => r.data),
  createSequence: (data: unknown) => api.post('/outreach/sequences', data).then(r => r.data),
}

export const captureApi = {
  sync: (captures: unknown[]) => api.post('/capture/sync', { captures }).then(r => r.data),
  create: (data: unknown) => api.post<LeadCapture>('/capture', data).then(r => r.data),
  list: (params?: Record<string, unknown>) =>
    api.get<LeadCapture[]>('/capture', { params }).then(r => r.data),
  uploadImage: (captureId: number, file: File, imageType: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('image_type', imageType)
    return api.post(`/capture/${captureId}/images`, fd).then(r => r.data)
  },
}

export const followupApi = {
  trigger: (eventId: number) => api.post(`/followups/trigger/${eventId}`).then(r => r.data),
  list: (params?: Record<string, unknown>) =>
    api.get<FollowUp[]>('/followups', { params }).then(r => r.data),
  complete: (id: number) => api.post<FollowUp>(`/followups/${id}/complete`).then(r => r.data),
  snooze: (id: number, days: number) =>
    api.post<FollowUp>(`/followups/${id}/snooze?days=${days}`).then(r => r.data),
  getDraft: (id: number) => api.get<{ draft: string }>(`/followups/${id}/draft`).then(r => r.data),
  update: (id: number, data: unknown) =>
    api.patch<FollowUp>(`/followups/${id}`, data).then(r => r.data),
}

export const scheduleApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Meeting[]>('/schedule', { params }).then(r => r.data),
  create: (data: unknown) => api.post<Meeting>('/schedule', data).then(r => r.data),
  update: (id: number, params: Record<string, unknown>) =>
    api.patch<Meeting>(`/schedule/${id}`, null, { params }).then(r => r.data),
  delete: (id: number) => api.delete(`/schedule/${id}`).then(r => r.data),
}

export const aiApi = {
  getHooks: (data: unknown) => api.post<HookResult>('/ai/hooks', data).then(r => r.data),
  draftMessage: (data: unknown) =>
    api.post<{ message: string }>('/ai/draft-message', data).then(r => r.data),
  transcribe: (blob: Blob, filename: string) => {
    const fd = new FormData()
    fd.append('file', blob, filename)
    return api.post<{ transcript: string }>('/ai/transcribe', fd).then(r => r.data)
  },
  scanCard: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ai/scan-card', fd).then(r => r.data)
  },
  classifyImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ image_type: string }>('/ai/classify-image', fd).then(r => r.data)
  },
}

export const analyticsApi = {
  summary: (eventId?: number) =>
    api.get<AnalyticsSummary>('/analytics/summary', { params: eventId ? { event_id: eventId } : {} })
      .then(r => r.data),
}

export const linkedinApi = {
  scrapeProfile: (profileUrl: string) =>
    api.post<{
      success: boolean
      data: {
        linkedin_bio: string
        recent_posts: string
        job_change: string
        recent_funding: string
        company_news: string
        mutual_connections: string
        _metadata?: {
          full_name?: string
          headline?: string
          location?: string
          current_company?: string
          connections?: number
          education?: string
          skills?: string[]
          profile_url?: string
          scraped_at?: string
        }
      }
    }>('/linkedin/scrape-profile', { profile_url: profileUrl }, { timeout: 180000 }).then(r => r.data),
  sendMessage: (profileUrl: string, message: string) =>
    api.post<{ success: boolean; message: string; sent_at?: string }>(
      '/linkedin/send-message',
      { profile_url: profileUrl, message },
      { timeout: 180000 }
    ).then(r => r.data),
  checkStatus: () =>
    api.get<{
      configured: boolean
      has_api_key: boolean
      has_linkedin_cookie: boolean
      features: Record<string, boolean>
      daily_limits: Record<string, string>
    }>('/linkedin/status').then(r => r.data),
}
