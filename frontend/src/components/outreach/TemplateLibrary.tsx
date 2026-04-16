import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachApi, type OutreachTemplate, type Prospect, type MergeField } from '@/lib/api'
import { Mail, Linkedin, MessageCircle, Phone, Plus, Trash2, Lock, Copy, Check, ChevronDown, ChevronUp, Tag } from 'lucide-react'

const CHANNEL_META: Record<string, { icon: React.ElementType; color: string }> = {
  email:    { icon: Mail,          color: 'text-blue-600' },
  linkedin: { icon: Linkedin,      color: 'text-sky-600' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600' },
  call:     { icon: Phone,         color: 'text-violet-600' },
}

const CHANNELS = ['all', 'email', 'linkedin', 'whatsapp', 'call']
const SEGMENTS = ['all', 'cold', 'pipeline', 'existing_client']

// Resolve merge fields from a prospect for live preview
function resolveMergeFields(body: string, prospect: Prospect | null): string {
  if (!prospect) return body
  const map: Record<string, string> = {
    '{{first_name}}': prospect.first_name,
    '{{last_name}}': prospect.last_name,
    '{{title}}': prospect.title,
    '{{company}}': String(prospect.company_id || 'their company'),
  }
  return Object.entries(map).reduce((b, [k, v]) => b.replaceAll(k, v), body)
}

function MergeFieldChip({ field, description, onClick }: MergeField & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={description}
      className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs border border-brand-200 hover:bg-brand-100 font-mono"
    >
      {field}
    </button>
  )
}

function TemplateCard({
  template, prospect, onSelect, onDelete,
}: {
  template: OutreachTemplate
  prospect: Prospect | null
  onSelect: (t: OutreachTemplate) => void
  onDelete?: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const meta = CHANNEL_META[template.channel] || CHANNEL_META.email
  const Icon = meta.icon
  const preview = resolveMergeFields(template.body, prospect)

  const copyBody = () => {
    navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card overflow-hidden">
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
          <button onClick={copyBody} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Copy body">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onSelect(template)} className="btn-primary text-xs py-1 px-2.5">
            Use
          </button>
          {!template.is_default && onDelete && (
            <button onClick={() => onDelete(template.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Preview {prospect ? `(resolved for ${prospect.first_name})` : '(merge fields shown)'}</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200 font-sans leading-relaxed">
            {preview}
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
    </div>
  )
}

function NewTemplateForm({ onSave, onCancel, mergeFields }: {
  onSave: (data: Omit<OutreachTemplate, 'id' | 'is_default' | 'created_at'>) => void
  onCancel: () => void
  mergeFields: MergeField[]
}) {
  const [form, setForm] = useState({
    name: '', channel: 'email', segment: 'cold',
    subject: '', body: '', tags: '',
  })
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
            {['email', 'linkedin', 'whatsapp', 'call'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Segment</label>
          <select className="input text-sm" value={form.segment}
            onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}>
            {['all', 'cold', 'pipeline', 'existing_client'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
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
            <MergeFieldChip key={mf.field} {...mf} onClick={() => insertMergeField(mf.field)} />
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

interface Props {
  prospect: Prospect | null
  onSelectTemplate: (template: OutreachTemplate) => void
}

export function TemplateLibrary({ prospect, onSelectTemplate }: Props) {
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

      {/* Merge field reference strip */}
      <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Available merge fields</p>
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
            onSelect={onSelectTemplate}
            onDelete={!t.is_default ? deleteMut.mutate : undefined}
          />
        ))}
      </div>
    </div>
  )
}
