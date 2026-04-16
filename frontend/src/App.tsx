import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Users, Zap, Mic, Bell, BarChart2, Calendar, ChevronRight, Menu, X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SyncStatus } from '@/components/shared/SyncStatus'
import { useSync } from '@/hooks/useSync'
import { useUIStore } from '@/store/uiStore'
import { eventsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

// Pages (lazy would be ideal for prod, keeping simple for hackathon)
import Dashboard from '@/pages/Dashboard'
import AttendeeList from '@/pages/AttendeeList'
import AttendeeProfile from '@/pages/AttendeeProfile'
import LeadCapture from '@/pages/LeadCapture'
import OutreachHub from '@/pages/OutreachHub'
import FollowUpDashboard from '@/pages/FollowUpDashboard'
import Schedule from '@/pages/Schedule'

const NAV = [
  { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
  { to: '/attendees', icon: Users, label: 'Attendees' },
  { to: '/outreach', icon: Zap, label: 'Outreach' },
  { to: '/capture', icon: Mic, label: 'Capture' },
  { to: '/followups', icon: Bell, label: 'Follow-ups' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
]

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { activeEventId, setActiveEventId, currentUser } = useUIStore()
  useSync()

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  })

  // Auto-select first event if none selected
  useEffect(() => {
    if (!activeEventId && events && events.length > 0) {
      setActiveEventId(events[0].id)
    }
  }, [events, activeEventId, setActiveEventId])

  const activeEvent = events?.find(e => e.id === activeEventId)

  return (
    <BrowserRouter>
      <div className="min-h-screen flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-56 bg-brand-900 text-white flex flex-col
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:z-auto
          `}
        >
          {/* Logo */}
          <div className="h-16 flex items-center px-4 border-b border-brand-800">
            <span className="font-bold text-lg tracking-tight">LeadPlatform</span>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Event selector */}
          <div className="px-3 py-3 border-b border-brand-800">
            <p className="text-xs text-brand-300 font-medium uppercase tracking-wide mb-1">Active Event</p>
            <select
              className="w-full bg-brand-800 text-white text-sm rounded-lg px-2 py-1.5 border border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={activeEventId || ''}
              onChange={e => setActiveEventId(Number(e.target.value) || null)}
            >
              <option value="">Select event…</option>
              {events?.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-brand-800">
            <SyncStatus />
            <p className="text-xs text-brand-400 mt-1">Signed in as {currentUser}</p>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar (mobile) */}
          <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 lg:hidden sticky top-0 z-20">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <span className="font-semibold text-gray-800">LeadPlatform</span>
            {activeEvent && (
              <span className="ml-auto text-xs text-gray-500 truncate max-w-[140px]">
                {activeEvent.name}
              </span>
            )}
          </header>

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendees" element={<AttendeeList />} />
              <Route path="/attendees/:id" element={<AttendeeProfile />} />
              <Route path="/capture" element={<LeadCapture />} />
              <Route path="/outreach" element={<OutreachHub />} />
              <Route path="/followups" element={<FollowUpDashboard />} />
              <Route path="/schedule" element={<Schedule />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
