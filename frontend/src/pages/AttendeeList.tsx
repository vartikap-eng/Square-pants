import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { prospectsApi, eventsApi, type Priority, type Segment, type ProspectStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import { ImportModal } from '@/components/attendees/ImportModal'
import { Upload, Search, Filter, ChevronRight, RefreshCw, Plus } from 'lucide-react'

const PRIORITY_OPTIONS: Array<Priority | ''> = ['', 'P0', 'P1', 'P2', 'Irrelevant']
const SEGMENT_OPTIONS: Array<Segment | ''> = ['', 'existing_client', 'pipeline', 'cold']
const STATUS_OPTIONS: Array<ProspectStatus | ''> = [
  '', 'new', 'contacted', 'replied', 'meeting_booked', 'met', 'followed_up', 'closed'
]

export default function AttendeeList() {
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [segment, setSegment] = useState<Segment | ''>('')
  const [status, setStatus] = useState<ProspectStatus | ''>('')
  const [showImport, setShowImport] = useState(false)

  const params: Record<string, unknown> = {}
  if (activeEventId) params.event_id = activeEventId
  if (priority) params.priority = priority
  if (segment) params.segment = segment
  if (status) params.status = status
  if (search) params.search = search

  const { data: prospects = [], isLoading, refetch } = useQuery({
    queryKey: ['prospects', params],
    queryFn: () => prospectsApi.list(params),
  })

  const counts = {
    P0: prospects.filter(p => p.priority === 'P0').length,
    P1: prospects.filter(p => p.priority === 'P1').length,
    P2: prospects.filter(p => p.priority === 'P2').length,
    Irrelevant: prospects.filter(p => p.priority === 'Irrelevant').length,
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {prospects.length} prospects{activeEventId ? ' for this event' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowImport(true)} className="btn-primary">
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Priority quick-filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'P0', 'P1', 'P2', 'Irrelevant'] as Array<Priority | ''>).map(p => (
          <button
            key={p || 'all'}
            onClick={() => setPriority(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              priority === p
                ? 'bg-brand-700 text-white border-brand-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p || 'All'} {p ? `(${counts[p as Priority] ?? 0})` : `(${prospects.length})`}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search name, title, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={segment}
          onChange={e => setSegment(e.target.value as Segment | '')}
        >
          <option value="">All segments</option>
          <option value="existing_client">Existing Client</option>
          <option value="pipeline">Pipeline</option>
          <option value="cold">Cold Lead</option>
        </select>
        <select
          className="input w-auto"
          value={status}
          onChange={e => setStatus(e.target.value as ProspectStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="meeting_booked">Meeting Booked</option>
          <option value="met">Met</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card p-8 text-center text-gray-400">Loading prospects…</div>
      ) : prospects.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No prospects yet.</p>
          <button onClick={() => setShowImport(true)} className="btn-primary mt-4">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Segment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Owner</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prospects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {p.first_name} {p.last_name}
                    </div>
                    {p.email && (
                      <div className="text-xs text-gray-400">{p.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {p.title}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={p.priority} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SegmentTag segment={p.segment} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500 capitalize">{p.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{p.owner || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/attendees/${p.id}`}
                      className="text-brand-600 hover:text-brand-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['prospects'] })
            qc.invalidateQueries({ queryKey: ['analytics'] })
          }}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
