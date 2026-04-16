import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  prospectsApi, type Prospect, type ProspectStatus,
} from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import { ActivityTimeline } from '@/components/outreach/ActivityTimeline'
import { TemplateLibrary } from '@/components/outreach/TemplateLibrary'
import { Zap, Search } from 'lucide-react'

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

// ─── Prospect header strip ────────────────────────────────────────────────────

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
        {/* Quick status chips */}
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
            <ProspectHeader prospect={selected} />

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
