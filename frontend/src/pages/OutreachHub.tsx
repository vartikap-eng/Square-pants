import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  prospectsApi, outreachApi, aiApi,
  type Prospect, type OutreachChannel, type ProspectStatus, type OutreachTemplate,
} from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import { ActivityTimeline } from '@/components/outreach/ActivityTimeline'
import { HookGenerator } from '@/components/outreach/HookGenerator'
import { TemplateLibrary } from '@/components/outreach/TemplateLibrary'
import {
  Zap, Send, Loader2, Search, Mail, Linkedin,
  MessageCircle, Phone, Clock, ChevronRight,
} from 'lucide-react'

type RightTab = 'timeline' | 'compose' | 'hooks' | 'templates'

const CHANNEL_META: Record<OutreachChannel, { icon: React.ElementType; label: string }> = {
  email:    { icon: Mail,          label: 'Email'    },
  linkedin: { icon: Linkedin,      label: 'LinkedIn' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp' },
  call:     { icon: Phone,         label: 'Call'     },
}

const STATUS_COLOR: Record<string, string> = {
  new:           'bg-gray-300',
  contacted:     'bg-blue-400',
  replied:       'bg-green-500',
  meeting_booked:'bg-emerald-500',
  met:           'bg-violet-500',
  followed_up:   'bg-sky-400',
  closed:        'bg-gray-500',
}

// ─── Prospect list sidebar ────────────────────────────────────────────────────

function ProspectSidebar({
  prospects,
  selected,
  onSelect,
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

// ─── Compose panel ────────────────────────────────────────────────────────────

function ComposePanel({
  prospect,
  selectedHook,
  prefilledTemplate,
  onSent,
}: {
  prospect: Prospect
  selectedHook: string
  prefilledTemplate: OutreachTemplate | null
  onSent: () => void
}) {
  const qc = useQueryClient()
  const [channel, setChannel] = useState<OutreachChannel>(
    (prefilledTemplate?.channel as OutreachChannel) || 'email'
  )
  const [subject, setSubject] = useState(prefilledTemplate?.subject || '')
  const [body, setBody] = useState(prefilledTemplate?.body || '')
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // When template changes, update channel+subject+body
  const applyTemplate = (t: OutreachTemplate) => {
    setChannel((t.channel as OutreachChannel) || 'email')
    setSubject(t.subject || '')
    // Resolve basic merge fields
    let b = t.body
    b = b.replaceAll('{{first_name}}', prospect.first_name)
    b = b.replaceAll('{{last_name}}', prospect.last_name)
    b = b.replaceAll('{{title}}', prospect.title)
    if (selectedHook) b = b.replaceAll('{{hook}}', selectedHook)
    setBody(b)
  }

  // When hook is updated externally, patch it into body if it contains {{hook}}
  const patchHook = (hook: string) => {
    setBody(prev => prev.replaceAll('{{hook}}', hook))
  }

  const draftWithAI = async () => {
    if (!selectedHook) {
      alert('Pick a hook from the Hooks tab first.')
      return
    }
    setIsDrafting(true)
    try {
      const res = await aiApi.draftMessage({
        hook: selectedHook,
        channel,
        template_body: body || '',
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        company: String(prospect.company_id || ''),
        title: prospect.title,
        segment: prospect.segment,
      })
      setBody(res.message)
    } catch {
      alert('Draft failed — check your OpenAI API key.')
    } finally {
      setIsDrafting(false)
    }
  }

  const send = async () => {
    if (!body.trim()) return
    setIsSending(true)
    try {
      await outreachApi.logActivity({
        prospect_id: prospect.id,
        channel,
        subject: subject || undefined,
        body,
      })
      // Update prospect status to contacted
      await prospectsApi.update(prospect.id, { status: 'contacted' as ProspectStatus })
      qc.invalidateQueries({ queryKey: ['activities', prospect.id] })
      qc.invalidateQueries({ queryKey: ['prospects'] })
      setBody('')
      setSubject('')
      onSent()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Channel tabs */}
      <div className="flex gap-1.5">
        {(Object.entries(CHANNEL_META) as [OutreachChannel, typeof CHANNEL_META[OutreachChannel]][]).map(([ch, meta]) => {
          const Icon = meta.icon
          return (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                channel === ch
                  ? 'bg-brand-700 text-white border-brand-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {meta.label}
            </button>
          )
        })}
      </div>

      {/* Prospect context + selected hook */}
      {selectedHook && (
        <div className="p-2.5 bg-brand-50 rounded-lg border border-brand-200 text-xs text-brand-800">
          <span className="font-medium">Hook:</span> {selectedHook}
        </div>
      )}

      {/* Subject (email only) */}
      {channel === 'email' && (
        <div>
          <label className="label text-xs">Subject</label>
          <input
            className="input text-sm"
            placeholder="Subject line…"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>
      )}

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0 text-xs">Message</label>
          <button
            onClick={draftWithAI}
            disabled={isDrafting}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            {isDrafting
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Drafting…</>
              : <><Zap className="w-3 h-3" /> AI Draft</>
            }
          </button>
        </div>
        <textarea
          className="input text-sm font-sans leading-relaxed"
          rows={channel === 'call' ? 8 : 7}
          placeholder={
            channel === 'call'
              ? 'Talk track / call script…'
              : 'Write your message, or use AI Draft to generate from the selected hook…'
          }
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">{body.length} chars · {body.trim().split(/\s+/).filter(Boolean).length} words</p>
      </div>

      <button
        onClick={send}
        disabled={isSending || !body.trim()}
        className="btn-primary w-full"
      >
        {isSending
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Send className="w-4 h-4" />
        }
        {channel === 'call' ? 'Log Call' : `Mark as Sent via ${CHANNEL_META[channel].label}`}
      </button>
    </div>
  )
}

// ─── Prospect header ──────────────────────────────────────────────────────────

function ProspectHeader({ prospect }: { prospect: Prospect }) {
  const qc = useQueryClient()

  const updateStatus = useMutation({
    mutationFn: (status: ProspectStatus) => prospectsApi.update(prospect.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })

  return (
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
          </div>
        </div>
        {/* Quick status updater */}
        <div className="flex gap-1.5 flex-wrap shrink-0">
          {(['contacted', 'replied', 'meeting_booked'] as ProspectStatus[]).map(s => (
            <button
              key={s}
              onClick={() => updateStatus.mutate(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                prospect.status === s
                  ? 'bg-brand-700 text-white border-brand-700'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      {prospect.score_reason && (
        <p className="text-xs text-gray-400 mt-2 italic">{prospect.score_reason}</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachHub() {
  const { activeEventId } = useUIStore()
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [activeTab, setActiveTab] = useState<RightTab>('timeline')
  const [selectedHook, setSelectedHook] = useState('')
  const [prefilledTemplate, setPrefilledTemplate] = useState<OutreachTemplate | null>(null)

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['prospects', { event_id: activeEventId }],
    queryFn: () => prospectsApi.list({
      event_id: activeEventId || undefined,
      limit: 300,
    }),
  })

  const targeted = prospects.filter(p => p.priority === 'P0' || p.priority === 'P1')
  const others = prospects.filter(p => p.priority === 'P2')
  const allShown = [...targeted, ...others]

  const handleSelectProspect = (p: Prospect) => {
    setSelected(p)
    setActiveTab('timeline')
    setSelectedHook('')
    setPrefilledTemplate(null)
  }

  const handleTemplateSelected = (t: OutreachTemplate) => {
    setPrefilledTemplate(t)
    setActiveTab('compose')
  }

  const handleHookSelected = (hook: string) => {
    setSelectedHook(hook)
    // Auto-switch to compose so rep can immediately draft
  }

  const TABS: { id: RightTab; label: string; hint?: string }[] = [
    { id: 'timeline',  label: 'Timeline' },
    { id: 'compose',   label: 'Compose', hint: selectedHook ? '●' : undefined },
    { id: 'hooks',     label: 'AI Hooks' },
    { id: 'templates', label: 'Templates' },
  ]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden">
      {/* ── Column 1: Prospect list (fixed width) ── */}
      <div className="w-56 lg:w-64 shrink-0 flex flex-col bg-white">
        <div className="px-3 py-3 border-b border-gray-200">
          <h1 className="font-semibold text-gray-900 text-sm">Outreach Console</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {targeted.length} P0/P1 · {others.length} P2
          </p>
        </div>
        {isLoading ? (
          <div className="p-4 text-xs text-gray-400">Loading…</div>
        ) : (
          <ProspectSidebar
            prospects={allShown}
            selected={selected}
            onSelect={handleSelectProspect}
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
              <p className="text-xs mt-1 text-gray-300">Timeline · Compose · AI Hooks · Templates</p>
            </div>
          </div>
        ) : (
          <>
            {/* Prospect header */}
            <ProspectHeader prospect={selected} />

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-white px-5">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.hint && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 ml-0.5" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'timeline' && (
                <ActivityTimeline prospectId={selected.id} />
              )}

              {activeTab === 'compose' && (
                <ComposePanel
                  prospect={selected}
                  selectedHook={selectedHook}
                  prefilledTemplate={prefilledTemplate}
                  onSent={() => setActiveTab('timeline')}
                />
              )}

              {activeTab === 'hooks' && (
                <HookGenerator
                  prospect={selected}
                  onHookSelected={(hook) => {
                    handleHookSelected(hook)
                    setActiveTab('compose')
                  }}
                />
              )}

              {activeTab === 'templates' && (
                <TemplateLibrary
                  prospect={selected}
                  onSelectTemplate={handleTemplateSelected}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
