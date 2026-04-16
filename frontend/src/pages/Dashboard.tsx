import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  FunnelChart, Funnel, LabelList, ResponsiveContainer, Cell
} from 'recharts'
import { Users, Bell, Zap, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'

function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ef4444', P1: '#f97316', P2: '#eab308', Irrelevant: '#d1d5db'
}

export default function Dashboard() {
  const { activeEventId } = useUIStore()
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', activeEventId],
    queryFn: () => analyticsApi.summary(activeEventId || undefined),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-400">
        Loading dashboard…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No data yet. Select an event and import attendees to get started.</p>
      </div>
    )
  }

  const priorityChartData = Object.entries(data.priority_breakdown).map(([k, v]) => ({
    name: k, count: v, fill: PRIORITY_COLORS[k] || '#6b7280'
  }))

  const funnelData = data.funnel.map((d, i) => ({
    ...d,
    fill: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'][i] || '#bfdbfe'
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Conference pipeline overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="Total Prospects"
          value={data.total_prospects}
          sub={`${data.priority_breakdown.P0 + data.priority_breakdown.P1} prioritized`}
          icon={Users}
          color="bg-brand-700"
        />
        <KPICard
          label="Leads Captured"
          value={data.total_captures}
          sub="on-site captures"
          icon={TrendingUp}
          color="bg-emerald-600"
        />
        <KPICard
          label="Meetings Booked"
          value={data.meetings_booked}
          sub="from outreach"
          icon={CheckCircle2}
          color="bg-violet-600"
        />
        <KPICard
          label="Outreach Sent"
          value={data.outreach.total_sent}
          sub={`${data.outreach.reply_rate_pct}% reply rate`}
          icon={Zap}
          color="bg-amber-500"
        />
        <KPICard
          label="Follow-ups Due"
          value={data.followups.pending}
          sub={data.followups.overdue > 0 ? `${data.followups.overdue} overdue` : 'none overdue'}
          icon={Bell}
          color={data.followups.overdue > 0 ? 'bg-red-500' : 'bg-gray-500'}
        />
        <KPICard
          label="Follow-up Rate"
          value={`${data.followups.completion_rate_pct}%`}
          sub={`${data.followups.completed} of ${data.followups.total} completed`}
          icon={AlertCircle}
          color={data.followups.completion_rate_pct < 50 ? 'bg-red-500' : 'bg-green-600'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Priority Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {priorityChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Pipeline Funnel</h2>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="count" data={funnelData} isAnimationActive>
                <LabelList
                  position="right"
                  fill="#374151"
                  fontSize={12}
                  dataKey="stage"
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment breakdown */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Segment Breakdown</h2>
        <div className="flex gap-6">
          {Object.entries(data.segment_breakdown).map(([seg, count]) => (
            <div key={seg} className="text-center">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{seg.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
