import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prospectsApi, aiApi, type Priority, type Segment } from '@/lib/api'
import { useOfflineCapture } from '@/hooks/useOfflineCapture'
import { useUIStore } from '@/store/uiStore'
import { SyncStatus } from '@/components/shared/SyncStatus'
import { Mic, MicOff, Camera, Search, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react'

type FormData = {
  name: string; company: string; title: string; phone: string; email: string; linkedin: string
  priority: Priority; segment: Segment; notes: string; product_interest: string
  next_step: string; commitment_made: string
}

const EMPTY: FormData = {
  name: '', company: '', title: '', phone: '', email: '', linkedin: '',
  priority: 'P2', segment: 'cold', notes: '', product_interest: '', next_step: '', commitment_made: ''
}

export default function LeadCapture() {
  const { activeEventId, currentUser } = useUIStore()
  const { saveCapture } = useOfflineCapture()

  const [form, setForm] = useState<FormData>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isScanningCard, setIsScanningCard] = useState(false)
  const [prospectSearch, setProspectSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prospect search for quick-fill
  const { data: searchResults = [] } = useQuery({
    queryKey: ['prospect-search', prospectSearch, activeEventId],
    queryFn: () => prospectsApi.list({
      search: prospectSearch,
      event_id: activeEventId || undefined,
      limit: 8,
    }),
    enabled: prospectSearch.length >= 2,
  })

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const fillFromProspect = (p: { first_name: string; last_name: string; title: string; email?: string; phone?: string; linkedin_url?: string; priority: Priority; segment: Segment }) => {
    setForm(f => ({
      ...f,
      name: `${p.first_name} ${p.last_name}`,
      title: p.title || '',
      email: p.email || '',
      phone: p.phone || '',
      linkedin: p.linkedin_url || '',
      priority: p.priority,
      segment: p.segment,
    }))
    setProspectSearch('')
    setShowSearch(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setIsSaving(true)
    try {
      await saveCapture({
        name: form.name, company: form.company || undefined, title: form.title || undefined,
        phone: form.phone || undefined, email: form.email || undefined, linkedin: form.linkedin || undefined,
        priority: form.priority, segment: form.segment,
        notes: form.notes || undefined, product_interest: form.product_interest || undefined,
        next_step: form.next_step || undefined, commitment_made: form.commitment_made || undefined,
        captured_by: currentUser,
      })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setForm(EMPTY)
      }, 2000)
    } finally {
      setIsSaving(false)
    }
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        try {
          const { transcript } = await aiApi.transcribe(blob, 'note.webm')
          set('notes', form.notes ? `${form.notes}\n${transcript}` : transcript)
        } catch {
          alert('Transcription failed. Check your OpenAI API key.')
        } finally {
          setIsTranscribing(false)
        }
      }
      mr.start()
      mediaRef.current = mr
      setIsRecording(true)
    } catch {
      alert('Microphone permission denied.')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  // Business card scan
  const handleCardScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsScanningCard(true)
    try {
      const result = await aiApi.scanCard(file)
      setForm(f => ({
        ...f,
        name: result.name || f.name,
        company: result.company || f.company,
        title: result.title || f.title,
        email: result.email || f.email,
        phone: result.phone || f.phone,
        linkedin: result.linkedin || f.linkedin,
      }))
    } catch {
      alert('Card scan failed.')
    } finally {
      setIsScanningCard(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Lead Captured!</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {navigator.onLine ? 'Synced to server.' : 'Saved offline — will sync when connected.'}
          </p>
          <div className="mt-2"><SyncStatus /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Capture Lead</h1>
          <SyncStatus />
        </div>
        <div className="flex gap-2">
          {/* Business card scan */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningCard}
            className="btn-secondary text-xs py-1.5"
          >
            {isScanningCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {isScanningCard ? 'Scanning…' : 'Scan Card'}
          </button>
          <input
            ref={fileInputRef} type="file" accept="image/*"
            capture="environment" className="hidden"
            onChange={handleCardScan}
          />
        </div>
      </div>

      {/* Quick-fill from attendee list */}
      <div className="mb-4">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-xs text-brand-600 font-medium"
        >
          {showSearch ? '× Close' : '+ Pre-fill from attendee list'}
        </button>
        {showSearch && (
          <div className="mt-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search by name…"
                value={prospectSearch}
                onChange={e => setProspectSearch(e.target.value)}
                autoFocus
              />
            </div>
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => fillFromProspect(p)}
                className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
              >
                <span className="font-medium">{p.first_name} {p.last_name}</span>
                <span className="text-gray-500 ml-1.5 text-xs">· {p.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <label className="label">Name *</label>
          <input className="input" placeholder="Full name" value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Company</label>
            <input className="input" placeholder="Company" value={form.company}
              onChange={e => set('company', e.target.value)} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Job title" value={form.title}
              onChange={e => set('title', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" placeholder="+91 98xxx" value={form.phone}
              onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="email@co.com" value={form.email}
              onChange={e => set('email', e.target.value)} />
          </div>
        </div>

        {/* Priority + Segment */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority}
              onChange={e => set('priority', e.target.value as Priority)}>
              <option value="P0">P0 — Hot</option>
              <option value="P1">P1 — Warm</option>
              <option value="P2">P2 — Cold</option>
              <option value="Irrelevant">Irrelevant</option>
            </select>
          </div>
          <div>
            <label className="label">Segment</label>
            <select className="input" value={form.segment}
              onChange={e => set('segment', e.target.value as Segment)}>
              <option value="existing_client">Existing Client</option>
              <option value="pipeline">Pipeline</option>
              <option value="cold">Cold Lead</option>
            </select>
          </div>
        </div>

        {/* Notes with voice */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Notes</label>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                isRecording
                  ? 'bg-red-500 text-white border-red-500 animate-pulse'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {isTranscribing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing…</>
              ) : isRecording ? (
                <><MicOff className="w-3 h-3" /> Stop</>
              ) : (
                <><Mic className="w-3 h-3" /> Voice Note</>
              )}
            </button>
          </div>
          <textarea
            className="input"
            rows={4}
            placeholder="Meeting notes, pain points, interests… or use voice note"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Product Interest</label>
          <input className="input" placeholder="e.g. Credit scoring, Collections automation"
            value={form.product_interest} onChange={e => set('product_interest', e.target.value)} />
        </div>
        <div>
          <label className="label">Next Step / Commitment</label>
          <input className="input" placeholder="e.g. Send demo link, Schedule call next week"
            value={form.next_step} onChange={e => set('next_step', e.target.value)} />
        </div>
      </div>

      {/* Save button — sticky on mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 lg:static lg:border-0 lg:bg-transparent lg:mt-4">
        <button
          onClick={handleSave}
          disabled={isSaving || !form.name.trim()}
          className="btn-primary w-full py-3 text-base"
        >
          {isSaving
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <CheckCircle2 className="w-5 h-5" />
          }
          {isSaving ? 'Saving…' : navigator.onLine ? 'Save Lead' : 'Save Offline'}
        </button>
      </div>
    </div>
  )
}
