import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { aiApi, outreachApi, type Prospect, type HookResult } from '@/lib/api'
import { Zap, Copy, Check, Loader2, ChevronDown, ChevronUp, BookOpen, RefreshCw } from 'lucide-react'

interface ResearchForm {
  linkedin_bio: string
  recent_posts: string
  recent_funding: string
  job_change: string
  mutual_connections: string
  company_news: string
}

const EMPTY_RESEARCH: ResearchForm = {
  linkedin_bio: '', recent_posts: '', recent_funding: '',
  job_change: '', mutual_connections: '', company_news: '',
}

interface Props {
  prospect: Prospect
  onHookSelected?: (hook: string) => void  // callback when rep picks a hook
}

export function HookGenerator({ prospect, onHookSelected }: Props) {
  const [research, setResearch] = useState<ResearchForm>(EMPTY_RESEARCH)
  const [result, setResult] = useState<HookResult | null>(null)
  const [selectedHook, setSelectedHook] = useState('')
  const [showInputs, setShowInputs] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Load cached research if it exists
  const { data: cached, isSuccess: hasCached } = useQuery({
    queryKey: ['research', prospect.id],
    queryFn: () => outreachApi.getResearch(prospect.id),
    retry: false,           // 404 = no research yet, not an error
    throwOnError: false,
  })

  useEffect(() => {
    if (hasCached && cached) {
      setResearch({
        linkedin_bio: cached.linkedin_bio || '',
        recent_posts: cached.recent_posts || '',
        recent_funding: cached.recent_funding || '',
        job_change: cached.job_change || '',
        mutual_connections: cached.mutual_connections || '',
        company_news: cached.company_news || '',
      })
      if (cached.hooks.length > 0) {
        setResult({ summary: cached.ai_summary || '', hooks: cached.hooks })
        setShowInputs(false)
      }
    } else {
      // Pre-fill from prospect fields as a starting point
      setResearch(r => ({
        ...r,
        linkedin_bio: prospect.linkedin_bio || '',
        recent_funding: prospect.recent_funding || '',
        job_change: prospect.recent_job_change || '',
      }))
    }
  }, [hasCached, cached, prospect])

  const saveResearchMut = useMutation({
    mutationFn: (data: ResearchForm) => outreachApi.upsertResearch(prospect.id, data),
  })

  const [isGenerating, setIsGenerating] = useState(false)

  const generate = async () => {
    const hasData = Object.values(research).some(v => v.trim().length > 0)
    if (!hasData) return

    setIsGenerating(true)
    setResult(null)
    setSelectedHook('')

    try {
      // Save research to backend first
      await saveResearchMut.mutateAsync(research)

      const res = await aiApi.getHooks({
        ...research,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        company: String(prospect.company_id || ''),
        title: prospect.title,
      })

      setResult(res)
      setShowInputs(false)

      // Cache the hooks back
      await outreachApi.cacheHooks(prospect.id, res.summary, res.hooks)
    } catch {
      alert('Failed to generate hooks. Check your OpenAI API key.')
    } finally {
      setIsGenerating(false)
    }
  }

  const selectHook = (hook: string, index: number) => {
    setSelectedHook(hook)
    onHookSelected?.(hook)
    setCopiedIndex(null)
  }

  const copyHook = (hook: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(hook)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const set = (field: keyof ResearchForm, value: string) =>
    setResearch(r => ({ ...r, [field]: value }))

  return (
    <div className="space-y-4 text-sm">
      {/* Research inputs */}
      <div>
        <button
          onClick={() => setShowInputs(!showInputs)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          <BookOpen className="w-3.5 h-3.5" />
          LinkedIn &amp; Company Research
          {showInputs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {(hasCached && cached) && (
            <span className="ml-1 badge bg-green-100 text-green-700 text-xs">saved</span>
          )}
        </button>

        {showInputs && (
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="label text-xs">LinkedIn Bio / About</label>
              <textarea className="input text-xs" rows={3}
                placeholder="Paste their LinkedIn About section…"
                value={research.linkedin_bio} onChange={e => set('linkedin_bio', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Recent Posts &amp; Activity</label>
              <textarea className="input text-xs" rows={2}
                placeholder="Recent posts, topics they engage with, comments…"
                value={research.recent_posts} onChange={e => set('recent_posts', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Recent Funding / News</label>
                <input className="input text-xs" placeholder="e.g. Series B $30M, Oct 2024"
                  value={research.recent_funding} onChange={e => set('recent_funding', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Job Change</label>
                <input className="input text-xs" placeholder="e.g. Joined HDFC 8 months ago"
                  value={research.job_change} onChange={e => set('job_change', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Mutual Connections</label>
                <input className="input text-xs" placeholder="e.g. Rahul Mehta (IIM Bangalore)"
                  value={research.mutual_connections} onChange={e => set('mutual_connections', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Company News</label>
                <input className="input text-xs" placeholder="e.g. Launched co-lending product Q3"
                  value={research.company_news} onChange={e => set('company_news', e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={isGenerating}
        className="btn-primary w-full text-xs"
      >
        {isGenerating ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing with GPT-4o…</>
        ) : result ? (
          <><RefreshCw className="w-3.5 h-3.5" /> Regenerate Hooks</>
        ) : (
          <><Zap className="w-3.5 h-3.5" /> Generate Hooks &amp; Summary</>
        )}
      </button>

      {/* AI output */}
      {result && (
        <div className="space-y-3">
          {/* Summary */}
          {result.summary && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Sales Intel Summary
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Hooks */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Pick an opening line →
            </p>
            <div className="space-y-2">
              {result.hooks.map((hook, i) => (
                <div
                  key={i}
                  onClick={() => selectHook(hook, i)}
                  className={`relative p-3 rounded-lg border text-xs leading-relaxed cursor-pointer transition-all ${
                    selectedHook === hook
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400 text-brand-900'
                      : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-semibold text-gray-400 mr-1.5">#{i + 1}</span>
                  {hook}
                  <button
                    onClick={e => copyHook(hook, i, e)}
                    className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white"
                  >
                    {copiedIndex === i
                      ? <Check className="w-3 h-3 text-green-500" />
                      : <Copy className="w-3 h-3" />
                    }
                  </button>
                </div>
              ))}
            </div>
            {selectedHook && (
              <p className="text-xs text-brand-600 mt-1.5 font-medium">
                ✓ Hook selected — switch to Compose tab to draft the full message
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
