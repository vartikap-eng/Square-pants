import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { prospectsApi, type Priority, type Segment, type ProspectStatus } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { SegmentTag } from '@/components/shared/SegmentTag'
import { ImportModal } from '@/components/attendees/ImportModal'
import { Upload, Search, ChevronRight, RefreshCw, UserCheck } from 'lucide-react'

export default function AttendeeList() {
  const { activeEventId } = useUIStore()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [segment, setSegment] = useState<Segment | ''>('')
  const [status, setStatus] = useState<ProspectStatus | ''>('')
  const [showImport, setShowImport] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

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

  const handleAutoAssign = async () => {
    setIsAssigning(true)
    try {
      const result = await prospectsApi.autoAssignOwners(activeEventId || undefined)
      alert(`Auto-assigned ${result.updated} prospects with owners and outreach modes.`)
      qc.invalidateQueries({ queryKey: ['prospects'] })
    } catch {
      alert('Auto-assign failed.')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
          <button
            onClick={handleAutoAssign}
            disabled={isAssigning || !activeEventId}
            className="btn-secondary"
          >
            <UserCheck className="w-4 h-4" />
            {isAssigning ? 'Assigning…' : 'Auto-assign'}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stakeholder</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Segment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Outreach Mode</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prospects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {/* company_id is shown as placeholder until profile loads */}
                      {p.company_id ? `Company #${p.company_id}` : '—'}
                    </div>
                  </td>
                  {/* Stakeholder */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {p.first_name} {p.last_name}
                        </div>
                        {p.email && (
                          <div className="text-xs text-gray-400">{p.email}</div>
                        )}
                      </div>
                      {p.linkedin_url && (
                        <a
                          href={p.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                          onClick={e => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  {/* Title */}
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {p.title}
                  </td>
                  {/* Priority + score reason */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <PriorityBadge priority={p.priority} />
                      {p.score_reason && (
                        <div className="text-xs text-gray-500 truncate max-w-[150px]" title={p.score_reason}>
                          {p.score_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Segment */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SegmentTag segment={p.segment} />
                  </td>
                  {/* Owner */}
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs font-medium text-gray-700">{p.owner || '—'}</span>
                  </td>
                  {/* Outreach Mode */}
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {p.outreach_mode ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {p.outreach_mode}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not set</span>
                    )}
                  </td>
                  {/* Action */}
                  <td className="px-4 py-3">
                    <Link to={`/attendees/${p.id}`} className="text-brand-600 hover:text-brand-800">
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
