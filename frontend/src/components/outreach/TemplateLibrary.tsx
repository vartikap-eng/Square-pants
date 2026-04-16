import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachApi, prospectsApi, type OutreachTemplate, type Prospect, type MergeField } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import {
  Mail, Linkedin, MessageCircle, Phone, Plus, Trash2, Lock,
  Copy, Check, ChevronDown, ChevronUp, Tag, Send, Loader2, Zap,
} from 'lucide-react'

const CHANNEL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  email:    { icon: Mail,          color: 'text-blue-600',   label: 'Email'    },
  linkedin: { icon: Linkedin,      color: 'text-sky-600',    label: 'LinkedIn' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600',  label: 'WhatsApp' },
  call:     { icon: Phone,         color: 'text-violet-600', label: 'Call'     },
}

const CHANNELS = ['all', 'email', 'linkedin', 'whatsapp', 'call']
const SEGMENTS = ['all', 'cold', 'pipeline', 'existing_client']

// ─── Full merge field resolution using prospect + ICP data ───────────────────

function buildMergeMap(
  prospect: Prospect,
  companyName: string,
  icp: Record<string, unknown> | null,
  currentUser: string,
): Record<string, string> {
  const companyAnalysis = icp?.company_analysis as Record<string, unknown> | undefined
  const stakeholder = icp?.stakeholder_analysis as Record<string, unknown> | undefined
  const priorityCtx = icp?.priority_context as Record<string, unknown> | undefined
  const starters = stakeholder?.conversation_starters as Array<{ starter: string }> | undefined

  // Pick the cleanest conversation starter as the {{hook}}
  const hook = starters?.[0]?.starter
    ?.replace(/^💬\s*"?/, '')
    ?.replace(/"$/, '')
    ?.trim() || ''

  return {
    '{{first_name}}':       prospect.first_name,
    '{{last_name}}':        prospect.last_name,
    '{{title}}':            prospect.title,
    '{{company}}':          companyName,
    '{{company_type}}':     String(companyAnalysis?.industry || ''),
    '{{event_name}}':       'the conference',
    '{{event_date}}':       'this week',
    '{{sender_name}}':      currentUser,
    '{{sender_company}}':   'HyperVerge',
    '{{hook}}':             hook,
    '{{recent_funding}}':   prospect.recent_funding || '',
    '{{job_change}}':       prospect.recent_job_change || '',
    '{{mutual_connection}}': '',
    '{{company_news}}':     '',
    '{{product_area}}':     String(companyAnalysis?.hyperverge_solution || '').split('.')[0] || 'our solution',
    '{{pain_points}}':      (companyAnalysis?.pain_points as string[] | undefined)?.[0] || '',
    '{{messaging_approach}}': String(stakeholder?.messaging_approach || ''),
    '{{urgency}}':          String(priorityCtx?.urgency || ''),
    '{{decision_authority}}': String(stakeholder?.decision_authority || ''),
  }
}

function resolveBody(template: string, map: Record<string, string>): string {
  return Object.entries(map).reduce((t, [k, v]) => t.replaceAll(k, v), template)
}

// ─── Inline draft panel shown after "Use" is clicked ─────────────────────────

function InlineDraft({
  template,
  prospect,
  companyName,
  icp,
  onClose,
}: {
  template: OutreachTemplate
  prospect: Prospect
  companyName: string
  icp: Record<string, unknown> | null
  onClose: () => void
}) {
  const { currentUser } = useUIStore()
  const qc = useQueryClient()

  const mergeMap = buildMergeMap(prospect, companyName, icp, currentUser)
  const [subject, setSubject] = useState(() =>
    template.subject ? resolveBody(template.subject, mergeMap) : ''
  )
  const [body, setBody] = useState(() => resolveBody(template.body, mergeMap))
  const [isSending, setIsSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const logSent = async () => {
    setIsSending(true)
    try {
      await outreachApi.logActivity({
        prospect_id: prospect.id,
        channel: template.channel,
        subject: subject || undefined,
        body,
      })
      await prospectsApi.update(prospect.id, { status: 'contacted' })
      qc.invalidateQueries({ queryKey: ['activities', prospect.id] })
      qc.invalidateQueries({ queryKey: ['prospects'] })
      onClose()
    } finally {
      setIsSending(false)
    }
  }

  // Highlight any unresolved merge fields still in the text
  const hasUnresolved = /\{\{[^}]+\}\}/.test(body)

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Draft for {prospect.first_name} {prospect.last_name}
        </p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
      </div>

      {/* ICP context strip */}
      {icp && (
        <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200 text-xs text-amber-800 space-y-0.5">
          <p><span className="font-medium">ICP fit:</span> {String((icp as Record<string, unknown>).icp_fit || '')}</p>
          <p><span className="font-medium">Messaging:</span> {String(((icp as Record<string, unknown>).stakeholder_analysis as Record<string, unknown> | undefined)?.messaging_approach || '').slice(0, 100)}{String(((icp as Record<string, unknown>).stakeholder_analysis as Record<string, unknown> | undefined)?.messaging_approach || '').length > 100 ? '…' : ''}</p>
        </div>
      )}

      {template.channel === 'email' && (
        <div>
          <label className="label text-xs">Subject</label>
          <input className="input text-sm" value={subject}
            onChange={e => setSubject(e.target.value)} />
        </div>
      )}

      <div>
        <label className="label text-xs">Message</label>
        <textarea
          className={`input text-sm font-sans leading-relaxed ${hasUnresolved ? 'border-amber-400' : ''}`}
          rows={template.channel === 'call' ? 10 : 8}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        {hasUnresolved && (
          <p className="text-xs text-amber-600 mt-1">⚠ Some merge fields couldn't be resolved — fill them in manually.</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{body.length} chars</p>
      </div>

      <div className="flex gap-2">
        <button onClick={copy} className="btn-secondary text-xs flex-1">
          {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
        <button onClick={logSent} disabled={isSending || !body.trim()} className="btn-primary text-xs flex-1">
          {isSending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Logging…</>
            : <><Send className="w-3.5 h-3.5" /> Mark as Sent</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template, prospect, onDelete,
}: {
  template: OutreachTemplate
  prospect: Prospect | null
  onDelete?: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDraft, setShowDraft] = useState(false)

  const meta = CHANNEL_META[template.channel] || CHANNEL_META.email
  const Icon = meta.icon

  // Fetch company name + ICP when draft is requested
  const { data: company } = useQuery({
    queryKey: ['company', prospect?.id],
    queryFn: () => prospectsApi.getCompany(prospect!.id),
    enabled: showDraft && !!prospect?.company_id,
  })

  const { data: icp } = useQuery({
    queryKey: ['icp-reasoning', prospect?.id],
    queryFn: () => prospectsApi.getICPReasoning(prospect!.id),
    enabled: showDraft && !!prospect?.id,
  })

  const companyName = (company as { name?: string } | null)?.name
    || (icp as Record<string, unknown> | null)?.company_analysis
      ? String((icp as Record<string, unknown> | undefined)?.company_analysis
          ? ((icp as Record<string, unknown>).company_analysis as Record<string, unknown>).company_name || ''
          : '')
      : `Company #${prospect?.company_id}`

  const handleUse = () => {
    if (!prospect) return
    setShowDraft(true)
    setExpanded(true)
  }

  const previewBody = prospect
    ? (() => {
        const map: Record<string, string> = {
          '{{first_name}}': prospect.first_name,
          '{{last_name}}': prospect.last_name,
          '{{title}}': prospect.title,
          '{{company}}': companyName || String(prospect.company_id || ''),
        }
        return Object.entries(map).reduce((b, [k, v]) => b.replaceAll(k, v), template.body)
      })()
    : template.body

  return (
    <div className={`card overflow-hidden transition-shadow ${showDraft ? 'shadow-md ring-1 ring-brand-200' : ''}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-gray-900 truncate">{template.name}</p>
            {template.is_default && (
              <span className="badge bg-gray-100 text-gray-500 text-xs flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> default
              </span>
            )}
            <span className="badge bg-purple-50 text-purple-700 text-xs capitalize">
              {template.segment === 'all' ? 'all segments' : template.segment.replace('_', ' ')}
            </span>
          </div>
          {template.subject && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">Subject: {template.subject}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Preview"
          >
            {expanded && !showDraft ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {!template.is_default && onDelete && (
            <button onClick={() => onDelete(template.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleUse}
            disabled={!prospect}
            className="btn-primary text-xs py-1 px-2.5"
            title={!prospect ? 'Select a prospect first' : ''}
          >
            Use
          </button>
        </div>
      </div>

      {/* Preview (raw template with basic fields resolved) */}
      {expanded && !showDraft && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            Preview {prospect ? `(for ${prospect.first_name})` : '(select a prospect to personalize)'}
          </p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200 font-sans leading-relaxed">
            {previewBody}
          </pre>
          {template.tags && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              <Tag className="w-3 h-3 text-gray-400" />
              {template.tags.split(',').map(tag => (
                <span key={tag} className="badge bg-gray-100 text-gray-500 text-xs">{tag.trim()}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline draft (fully resolved with ICP + prospect data) */}
      {showDraft && prospect && (
        <div className="px-4 pb-4">
          {(!icp) ? (
            <div className="pt-4 text-xs text-gray-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading prospect details…
            </div>
          ) : (
            <InlineDraft
              template={template}
              prospect={prospect}
              companyName={companyName}
              icp={icp as Record<string, unknown>}
              onClose={() => { setShowDraft(false); setExpanded(false) }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── New template form ────────────────────────────────────────────────────────

function NewTemplateForm({ onSave, onCancel, mergeFields }: {
  onSave: (data: Omit<OutreachTemplate, 'id' | 'is_default' | 'created_at'>) => void
  onCancel: () => void
  mergeFields: MergeField[]
}) {
  const [form, setForm] = useState({ name: '', channel: 'email', segment: 'cold', subject: '', body: '', tags: '' })
  const [bodyRef, setBodyRef] = useState<HTMLTextAreaElement | null>(null)

  const insertMergeField = (field: string) => {
    if (!bodyRef) return
    const start = bodyRef.selectionStart
    const end = bodyRef.selectionEnd
    const newBody = form.body.substring(0, start) + field + form.body.substring(end)
    setForm(f => ({ ...f, body: newBody }))
    setTimeout(() => {
      bodyRef.focus()
      bodyRef.setSelectionRange(start + field.length, start + field.length)
    }, 0)
  }

  return (
    <div className="card p-4 space-y-3 border-brand-300 border-2">
      <p className="font-medium text-sm text-gray-800">New Template</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label text-xs">Name</label>
          <input className="input text-sm" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label text-xs">Channel</label>
          <select className="input text-sm" value={form.channel}
            onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            {['email', 'linkedin', 'whatsapp', 'call'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Segment</label>
          <select className="input text-sm" value={form.segment}
            onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}>
            {['all', 'cold', 'pipeline', 'existing_client'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      {form.channel === 'email' && (
        <div>
          <label className="label text-xs">Subject</label>
          <input className="input text-sm" placeholder="Subject line with {{merge_fields}}"
            value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        </div>
      )}
      <div>
        <label className="label text-xs">Body</label>
        <div className="mb-1.5 flex gap-1 flex-wrap">
          {mergeFields.map(mf => (
            <button
              key={mf.field}
              onClick={() => insertMergeField(mf.field)}
              title={mf.description}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs border border-brand-200 hover:bg-brand-100 font-mono"
            >
              {mf.field}
            </button>
          ))}
        </div>
        <textarea
          ref={el => setBodyRef(el)}
          className="input text-sm font-mono"
          rows={6}
          placeholder="Template body — click merge fields above to insert"
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        />
      </div>
      <div>
        <label className="label text-xs">Tags (comma-separated)</label>
        <input className="input text-sm" placeholder="conference, cold, email"
          value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
        <button
          onClick={() => onSave({ ...form, subject: form.subject || undefined, tags: form.tags || undefined } as never)}
          disabled={!form.name || !form.body}
          className="btn-primary flex-1 text-sm"
        >
          Save Template
        </button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  prospect: Prospect | null
  onSelectTemplate?: (template: OutreachTemplate) => void  // kept for compatibility, no longer needed
}

export function TemplateLibrary({ prospect }: Props) {
  const qc = useQueryClient()
  const [channelFilter, setChannelFilter] = useState('all')
  const [segmentFilter, setSegmentFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', channelFilter, segmentFilter],
    queryFn: () => outreachApi.listTemplates({
      channel: channelFilter !== 'all' ? channelFilter : undefined,
      segment: segmentFilter !== 'all' ? segmentFilter : undefined,
    }),
  })

  const { data: mergeFields = [] } = useQuery({
    queryKey: ['merge-fields'],
    queryFn: () => outreachApi.getMergeFields(),
    staleTime: Infinity,
  })

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof outreachApi.createTemplate>[0]) =>
      outreachApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setShowNew(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => outreachApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  return (
    <div className="space-y-4">
      {/* Info banner when no prospect selected */}
      {!prospect && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-xs text-blue-700">
          Select a prospect from the left panel to enable personalised drafts.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {CHANNELS.map(ch => {
            const meta = CHANNEL_META[ch]
            const Icon = meta?.icon
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  channelFilter === ch
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {ch === 'all' ? 'All channels' : ch}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SEGMENTS.map(s => (
            <button
              key={s}
              onClick={() => setSegmentFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                segmentFilter === s
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All segments' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Merge field reference */}
      <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Available merge fields (auto-resolved from prospect)</p>
        <div className="flex gap-1.5 flex-wrap">
          {mergeFields.map(mf => (
            <span key={mf.field} title={mf.description}
              className="px-2 py-0.5 rounded-md bg-white text-brand-700 text-xs border border-brand-200 font-mono cursor-default">
              {mf.field}
            </span>
          ))}
        </div>
      </div>

      {/* New template form */}
      {showNew ? (
        <NewTemplateForm
          mergeFields={mergeFields}
          onCancel={() => setShowNew(false)}
          onSave={data => createMut.mutate(data)}
        />
      ) : (
        <button onClick={() => setShowNew(true)} className="btn-secondary w-full text-sm">
          <Plus className="w-4 h-4" /> Create Custom Template
        </button>
      )}

      {/* Template list */}
      <div className="space-y-2">
        {templates.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">No templates match this filter.</p>
        )}
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            prospect={prospect}
            onDelete={!t.is_default ? deleteMut.mutate : undefined}
          />
        ))}
      </div>
    </div>
  )
}
