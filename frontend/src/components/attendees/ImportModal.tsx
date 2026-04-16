import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { prospectsApi } from '@/lib/api'
import { useUIStore } from '@/store/uiStore'
import { Upload, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'preview' | 'result'

interface ImportResult {
  total_rows: number
  created: number
  skipped_duplicate: number
  skipped_error: number
  priority_breakdown: Record<string, number>
}

export function ImportModal({ onClose, onSuccess }: Props) {
  const { activeEventId } = useUIStore()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setStep('preview')
      setError('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const handleImport = async () => {
    if (!file || !activeEventId) return
    setIsImporting(true)
    setError('')
    try {
      const res = await prospectsApi.import(activeEventId, file)
      setResult(res)
      setStep('result')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail || 'Import failed. Check your CSV format.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Import Attendees</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!activeEventId && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Please select an active event from the sidebar first.
            </div>
          )}

          {/* Upload step */}
          {step === 'upload' && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                {isDragActive ? 'Drop CSV here' : 'Drag & drop a CSV, or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Required columns: first_name, last_name, title
              </p>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && file && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="w-5 h-5 text-brand-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => { setFile(null); setStep('upload') }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">What happens on import:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                  <li>Duplicates (same name + company) are automatically skipped</li>
                  <li>P0/P1/P2 scores assigned based on role + company type</li>
                  <li>Company types auto-detected from company name</li>
                </ul>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setFile(null); setStep('upload') }} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !activeEventId}
                  className="btn-primary flex-1"
                >
                  {isImporting ? 'Importing…' : 'Import Now'}
                </button>
              </div>
            </div>
          )}

          {/* Result step */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-semibold text-gray-900">Import Complete</p>
                  <p className="text-sm text-gray-500">{result.total_rows} rows processed</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{result.skipped_duplicate}</p>
                  <p className="text-xs text-gray-500">Duplicates skipped</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Priority Breakdown</p>
                <div className="flex gap-2">
                  {Object.entries(result.priority_breakdown).map(([p, count]) => (
                    count > 0 && (
                      <div key={p} className="flex-1 text-center bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-500">{p}</p>
                      </div>
                    )
                  ))}
                </div>
              </div>

              <button onClick={onSuccess} className="btn-primary w-full">
                View Attendees
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
