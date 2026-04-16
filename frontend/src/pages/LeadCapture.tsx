import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prospectsApi, aiApi, captureApi, type Priority, type Prospect } from '@/lib/api'
import { useOfflineCapture } from '@/hooks/useOfflineCapture'
import { useUIStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import {
  Mic, MicOff, Camera, FileText, CheckCircle2, Loader2,
  Search, X, Plus, Calendar, AlertCircle, ImagePlus,
  WifiOff, Cloud, CloudOff, Table2,
} from 'lucide-react'
import { syncToSheets, type SheetsPayload } from '@/lib/sheetsSync'

const PRIORITIES: { value: Priority; label: string; color: string; activeColor: string }[] = [
  { value: 'P0',        label: 'Hot',  color: 'border-red-200 text-red-700 bg-red-50',     activeColor: 'border-red-500 bg-red-500 text-white ring-2 ring-red-200'   },
  { value: 'P1',        label: 'Warm', color: 'border-amber-200 text-amber-700 bg-amber-50', activeColor: 'border-amber-500 bg-amber-500 text-white ring-2 ring-amber-200' },
  { value: 'P2',        label: 'Cold', color: 'border-blue-200 text-blue-700 bg-blue-50',  activeColor: 'border-blue-500 bg-blue-500 text-white ring-2 ring-blue-200' },
  { value: 'Irrelevant',label: 'Skip', color: 'border-gray-200 text-gray-500 bg-gray-50',  activeColor: 'border-gray-400 bg-gray-400 text-white ring-2 ring-gray-200' },
]

const PRIORITY_BADGE: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  Irrelevant: 'bg-gray-100 text-gray-500',
}

const NEXT_STEP_MAX = 200

type CapturedImage = {
  id: string
  file: File
  previewUrl: string
  imageType: 'business_card' | 'photo' | 'classifying'
  scannedFields?: Record<string, string> | null
}

export default function LeadCapture() {
  const { activeEventId, currentUser } = useUIStore()
  const { pendingCount, isSyncing } = useOfflineStore()
  const { saveCapture } = useOfflineCapture()

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [manualName, setManualName] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [nextStep, setNextStep] = useState('')
  const [nextStepDate, setNextStepDate] = useState('')
  const [activeInput, setActiveInput] = useState<'text' | 'voice' | 'scan' | null>(null)

  const [images, setImages] = useState<CapturedImage[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedFields, setScannedFields] = useState<Record<string, string> | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [sheetStatus, setSheetStatus] = useState<'idle' | 'synced' | 'queued'>('idle')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptAccum = useRef('')
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedCaptureId = useRef<number | null>(null)

  const { data: prospects = [] } = useQuery({
    queryKey: ['prospect-search', searchQuery, activeEventId],
    queryFn: () => prospectsApi.list({
      search: searchQuery,
      event_id: activeEventId || undefined,
      limit: 10,
    }),
    enabled: searchQuery.length >= 1,
  })

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  // Online/offline tracking
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const contactName = selectedProspect
    ? `${selectedProspect.first_name} ${selectedProspect.last_name}`
    : manualName

  const handleSelectProspect = (p: Prospect) => {
    setSelectedProspect(p)
    setSearchQuery('')
    setShowDropdown(false)
  }

  const clearSelection = () => {
    setSelectedProspect(null)
    setManualName('')
    setSearchQuery('')
  }

  // ── Image handling ────────────────────────────────────────────────────────

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setActiveInput('scan')
    setScanError(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      const newImage: CapturedImage = { id, file, previewUrl, imageType: 'classifying' }
      setImages(prev => [...prev, newImage])
      processImage(id, file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processImage = async (id: string, file: File) => {
    try {
      const { image_type } = await aiApi.classifyImage(file)
      const isCard = image_type === 'business_card'

      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, imageType: isCard ? 'business_card' : 'photo' } : img
      ))

      if (isCard) {
        try {
          const result = await aiApi.scanCard(file)
          if (result.name && !selectedProspect) setManualName(result.name)

          const fields: Record<string, string> = {}
          if (result.title)    fields['Title']    = result.title
          if (result.company)  fields['Company']  = result.company
          if (result.email)    fields['Email']    = result.email
          if (result.phone)    fields['Phone']    = result.phone
          if (result.linkedin) fields['LinkedIn'] = result.linkedin
          if (result.website)  fields['Website']  = result.website

          const extractedFields = Object.keys(fields).length > 0 ? fields : null
          setImages(prev => prev.map(img =>
            img.id === id ? { ...img, scannedFields: extractedFields } : img
          ))
          if (extractedFields) setScannedFields(extractedFields)
        } catch {
          setScanError('Could not extract card details. You can enter them manually.')
        }
      }
    } catch {
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, imageType: 'photo' } : img
      ))
    }
  }

  const removeImage = (id: string) => {
    setImages(prev => {
      const removing = prev.find(img => img.id === id)
      if (removing) URL.revokeObjectURL(removing.previewUrl)
      return prev.filter(img => img.id !== id)
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!contactName.trim()) return
    setIsSaving(true)
    try {
      const commitment = nextStepDate ? `by ${nextStepDate}` : ''
      const result = await saveCapture({
        name: contactName,
        company: scannedFields?.Company || undefined,
        title: selectedProspect?.title || scannedFields?.Title || undefined,
        phone: selectedProspect?.phone || scannedFields?.Phone || undefined,
        email: selectedProspect?.email || scannedFields?.Email || undefined,
        linkedin: selectedProspect?.linkedin_url || scannedFields?.LinkedIn || undefined,
        priority: priority || 'P2',
        segment: selectedProspect?.segment || 'cold',
        notes: notes || undefined,
        next_step: nextStep || undefined,
        commitment_made: commitment || undefined,
        captured_by: currentUser,
        prospect_id: selectedProspect?.id,
      })

      // Upload images if online and capture was saved with an ID
      if (result.synced && images.length > 0) {
        try {
          const captureId = (result as { capture: { id?: number } }).capture?.id
          if (captureId) {
            savedCaptureId.current = captureId
            await Promise.all(
              images.map(img =>
                captureApi.uploadImage(
                  captureId,
                  img.file,
                  img.imageType === 'classifying' ? 'photo' : img.imageType
                )
              )
            )
          }
        } catch { /* image upload is non-blocking */ }
      }

      // Sync to Google Sheets (if webhook configured)
      const captureMethod = images.some(i => i.imageType === 'business_card')
        ? 'card_scan'
        : savedAudioUrl
        ? 'voice_note'
        : 'manual'

      const sheetsPayload: SheetsPayload = {
        name: contactName,
        company:  scannedFields?.Company || '',
        title:    selectedProspect?.title || scannedFields?.Title || '',
        email:    selectedProspect?.email || scannedFields?.Email || '',
        phone:    selectedProspect?.phone || scannedFields?.Phone || '',
        linkedin: selectedProspect?.linkedin_url || scannedFields?.LinkedIn || '',
        priority: priority || 'P2',
        notes:    notes || '',
        nextSteps:   nextStep || '',
        followUpDate: nextStepDate || '',
        captureMethod,
        timestamp: new Date().toISOString(),
        imageCount: images.length,
      }

      const status = await syncToSheets(sheetsPayload)
      setSheetStatus(status)

      setSaved(true)
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl))
    setSelectedProspect(null)
    setManualName('')
    setNotes('')
    setPriority(null)
    setNextStep('')
    setNextStepDate('')
    setActiveInput(null)
    setImages([])
    setScannedFields(null)
    setScanError(null)
    setSavedAudioUrl(null)
    setMicError(null)
    setSaved(false)
    setSheetStatus('idle')
    savedCaptureId.current = null
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
    const w = window as unknown as Record<string, unknown>
    return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognition) | null
  }

  const startRecording = async () => {
    setMicError(null)
    setSavedAudioUrl(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow access in your browser settings.'
        : 'Could not access microphone. Check your device.'
      setMicError(msg)
      return
    }

    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setSavedAudioUrl(URL.createObjectURL(blob))
    }
    mr.start()
    mediaRef.current = mr

    // Real-time transcription via Web Speech API (no backend call)
    transcriptAccum.current = ''
    const SpeechRec = getSpeechRecognition()
    if (SpeechRec) {
      const recognition = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = ''
        let interimText = ''
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i]
          if (r.isFinal) finalText += r[0].transcript
          else interimText += r[0].transcript
        }
        transcriptAccum.current = finalText
        setNotes(finalText + (interimText || ''))
      }
      recognition.onerror = () => {}
      recognition.start()
      recognitionRef.current = recognition
    }

    setIsRecording(true)
    setActiveInput('voice')
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    mediaRef.current = null
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec && !transcriptAccum.current) {
      setMicError('Live transcription not supported in this browser — audio saved.')
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const isClassifying = images.some(img => img.imageType === 'classifying')

  // ── Success screen ────────────────────────────────────────────────────────

  if (saved) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Lead Captured!</h2>
          <p className="text-gray-500 mt-1 text-sm">
            <span className="font-medium text-gray-700">{contactName}</span>
          </p>

          {!isOnline ? (
            <div className="mt-3 mx-auto max-w-xs px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-center gap-2">
                <CloudOff className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Saved offline</span>
              </div>
              <p className="text-xs text-amber-600 mt-0.5">Will sync automatically when you reconnect</p>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-600">
              <Cloud className="w-4 h-4" />
              Synced to server
            </div>
          )}

          {sheetStatus !== 'idle' && (
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              sheetStatus === 'synced'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {sheetStatus === 'synced' ? (
                <><Table2 className="w-3 h-3" /> Synced to Google Sheets</>
              ) : (
                <><CloudOff className="w-3 h-3" /> Queued for Sheets — will sync on reconnect</>
              )}
            </div>
          )}

          {images.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">{images.length} image{images.length > 1 ? 's' : ''} attached</p>
          )}

          <button onClick={resetForm} className="btn-primary mt-6 px-8">
            <Plus className="w-4 h-4" />
            Capture Another
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Capture Lead</h1>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">You're offline</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Captures save locally and sync when you reconnect.
              {pendingCount > 0 && <span className="font-semibold"> {pendingCount} queued.</span>}
            </p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
          {isSyncing
            ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            : <Cloud className="w-4 h-4 text-blue-600" />
          }
          <span className="text-sm text-blue-800">
            {isSyncing ? 'Syncing...' : `${pendingCount} capture${pendingCount > 1 ? 's' : ''} waiting to sync`}
          </span>
        </div>
      )}

      {/* ── Section 1: Who are you meeting? ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">Who are you meeting?</p>

        {selectedProspect ? (
          <div className="card p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0">
              {selectedProspect.first_name[0]}{selectedProspect.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {selectedProspect.first_name} {selectedProspect.last_name}
                </p>
                <span className={`badge text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[selectedProspect.priority] || PRIORITY_BADGE.P2}`}>
                  {selectedProspect.priority}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{selectedProspect.title}</p>
            </div>
            <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9 pr-9"
                placeholder="Search attendee or type a name..."
                value={showDropdown ? searchQuery : manualName}
                onChange={e => {
                  const v = e.target.value
                  setManualName(v)
                  setSearchQuery(v)
                  if (v.length >= 1) setShowDropdown(true)
                }}
                onFocus={() => {
                  if (searchQuery.length >= 1 || manualName.length >= 1) setShowDropdown(true)
                }}
              />
              {manualName && (
                <button
                  onClick={() => { setManualName(''); setSearchQuery(''); setShowDropdown(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showDropdown && searchQuery.length >= 1 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {prospects.length > 0 ? (
                  prospects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProspect(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-xs shrink-0">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                          <span className={`badge text-[10px] px-1.5 py-0 shrink-0 ${PRIORITY_BADGE[p.priority] || PRIORITY_BADGE.P2}`}>
                            {p.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{p.title}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-gray-500">
                    No attendees found — name will be saved as typed
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: Add information ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">Add information</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Photo / card scan */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isClassifying}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              activeInput === 'scan' ? 'border-brand-500 bg-brand-50' : ''
            }`}
          >
            {isClassifying
              ? <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
              : <Camera className="w-5 h-5 text-brand-600" />
            }
            <span className="text-xs font-medium text-gray-700">
              {isClassifying ? 'Processing...' : 'Add Photo'}
            </span>
          </button>

          {/* Text note */}
          <button
            onClick={() => setActiveInput('text')}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              activeInput === 'text' ? 'border-brand-500 bg-brand-50' : ''
            }`}
          >
            <FileText className="w-5 h-5 text-brand-600" />
            <span className="text-xs font-medium text-gray-700">Add Text</span>
          </button>

          {/* Voice note */}
          <button
            onClick={() => isRecording ? stopRecording() : startRecording()}
            className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-brand-300 ${
              isRecording
                ? 'border-red-500 bg-red-50'
                : activeInput === 'voice'
                ? 'border-brand-500 bg-brand-50'
                : ''
            }`}
          >
            {isRecording
              ? <MicOff className="w-5 h-5 text-red-600" />
              : <Mic className="w-5 h-5 text-brand-600" />
            }
            <span className="text-xs font-medium text-gray-700">
              {isRecording ? `Stop ${formatTime(recordingSeconds)}` : 'Voice Note'}
            </span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-700 font-medium">Recording... {formatTime(recordingSeconds)}</span>
            <button onClick={stopRecording} className="ml-auto text-xs font-medium text-red-600 hover:text-red-800">Stop</button>
          </div>
        )}

        {/* Mic error */}
        {micError && (
          <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-sm text-amber-800">{micError}</span>
            <button onClick={() => setMicError(null)} className="ml-auto text-amber-500 hover:text-amber-700 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved audio playback */}
        {savedAudioUrl && !isRecording && (
          <div className="mb-3 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
            <audio controls src={savedAudioUrl} className="w-full h-8" />
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{scanError}</span>
            <button onClick={() => setScanError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.map(img => (
              <div key={img.id} className="relative card overflow-hidden">
                <img src={img.previewUrl} alt="" className="w-full h-20 object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                >
                  <X className="w-3 h-3" />
                </button>
                {img.imageType === 'classifying' && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  </div>
                )}
                <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-semibold text-center ${
                  img.imageType === 'business_card'
                    ? 'bg-green-600/90 text-white'
                    : img.imageType === 'classifying'
                    ? 'bg-gray-400/90 text-white'
                    : 'bg-gray-600/90 text-white'
                }`}>
                  {img.imageType === 'business_card' ? 'Business Card' : img.imageType === 'classifying' ? 'Analyzing...' : 'Photo'}
                </div>
                {img.imageType === 'business_card' && img.scannedFields && (
                  <div className="px-1.5 py-1 border-t border-gray-100 space-y-0.5">
                    {Object.entries(img.scannedFields).slice(0, 3).map(([key, val]) => (
                      <div key={key} className="text-[10px] text-gray-600 truncate">
                        <span className="text-gray-400">{key}: </span>{val}
                      </div>
                    ))}
                    {Object.keys(img.scannedFields).length > 3 && (
                      <div className="text-[10px] text-gray-400">+{Object.keys(img.scannedFields).length - 3} more</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="card h-20 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-brand-600 hover:border-brand-300 transition-colors"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-[10px] font-medium">Add more</span>
            </button>
          </div>
        )}

        {/* Notes textarea */}
        {(activeInput || notes) && (
          <textarea
            className="input"
            rows={4}
            placeholder="Notes from your conversation..."
            value={notes}
            onChange={e => { setNotes(e.target.value); if (!activeInput) setActiveInput('text') }}
            autoFocus={activeInput === 'text'}
          />
        )}
      </section>

      {/* ── Section 3: Priority ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">How important is this?</p>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => setPriority(p.value)}
              className={`py-2.5 px-2 rounded-lg border text-sm font-semibold text-center transition-all ${
                priority === p.value ? p.activeColor : p.color
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {priority === null && (
          <p className="text-xs text-gray-400 mt-1.5">Select a priority level</p>
        )}
      </section>

      {/* ── Section 4: Next steps ── */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2">Next steps</p>
        <div className="space-y-2">
          <div>
            <input
              className="input"
              placeholder="What needs to happen? e.g. Send proposal, Schedule demo..."
              value={nextStep}
              onChange={e => { if (e.target.value.length <= NEXT_STEP_MAX) setNextStep(e.target.value) }}
              maxLength={NEXT_STEP_MAX}
            />
            <div className="flex justify-end mt-0.5">
              <span className={`text-[11px] ${
                nextStep.length >= NEXT_STEP_MAX
                  ? 'text-red-500 font-semibold'
                  : nextStep.length >= NEXT_STEP_MAX * 0.8
                  ? 'text-amber-500'
                  : 'text-gray-300'
              }`}>
                {nextStep.length}/{NEXT_STEP_MAX}
              </span>
            </div>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              className="input pl-9"
              value={nextStepDate}
              onChange={e => setNextStepDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </section>

      {/* ── Save button (sticky on mobile) ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 lg:static lg:border-0 lg:bg-transparent lg:mt-2 lg:backdrop-blur-none">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || !contactName.trim() || priority === null}
            className="btn-primary w-full py-3 text-base"
          >
            {isSaving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> {isOnline ? 'Save Lead' : 'Save Offline'}</>
            )}
          </button>
          {!isOnline && (
            <p className="text-center text-xs text-amber-600 mt-1.5">Will sync when back online</p>
          )}
        </div>
      </div>
    </div>
  )
}
