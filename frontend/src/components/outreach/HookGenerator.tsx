import { useState } from 'react'
import { aiApi, type Prospect } from '@/lib/api'
import { Zap, Copy, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  prospect: Prospect
}

export function HookGenerator({ prospect }: Props) {
  const [linkedinBio, setLinkedinBio] = useState(prospect.linkedin_bio || '')
  const [recentPosts, setRecentPosts] = useState(prospect.linkedin_recent_posts || '')
  const [recentFunding, setRecentFunding] = useState(prospect.recent_funding || '')
  const [jobChange, setJobChange] = useState(prospect.recent_job_change || '')
  const [hooks, setHooks] = useState<string[]>([])
  const [selectedHook, setSelectedHook] = useState('')
  const [channel, setChannel] = useState('email')
  const [draftMessage, setDraftMessage] = useState('')
  const [isLoadingHooks, setIsLoadingHooks] = useState(false)
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showInputs, setShowInputs] = useState(true)

  const generateHooks = async () => {
    if (!linkedinBio && !recentPosts && !recentFunding && !jobChange) {
      alert('Please provide at least one LinkedIn data field.')
      return
    }
    setIsLoadingHooks(true)
    setHooks([])
    setSelectedHook('')
    setDraftMessage('')
    try {
      const res = await aiApi.getHooks({
        linkedin_bio: linkedinBio,
        recent_posts: recentPosts,
        recent_funding: recentFunding,
        job_change: jobChange,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        company: String(prospect.company_id || ''),
      })
      setHooks(res.hooks)
      setShowInputs(false)
    } catch {
      alert('Failed to generate hooks. Check your OpenAI API key.')
    } finally {
      setIsLoadingHooks(false)
    }
  }

  const generateDraft = async (hook: string) => {
    setSelectedHook(hook)
    setIsLoadingDraft(true)
    try {
      const res = await aiApi.draftMessage({
        hook,
        channel,
        template: '',
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        company: String(prospect.company_id || ''),
        title: prospect.title,
        segment: prospect.segment,
      })
      setDraftMessage(res.message)
    } catch {
      alert('Failed to draft message.')
    } finally {
      setIsLoadingDraft(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(draftMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 text-sm">
      {/* LinkedIn data inputs */}
      <button
        onClick={() => setShowInputs(!showInputs)}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        LinkedIn Data {showInputs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showInputs && (
        <div className="space-y-2">
          <div>
            <label className="label text-xs">Bio / About section</label>
            <textarea
              className="input text-xs"
              rows={3}
              placeholder="Paste LinkedIn bio…"
              value={linkedinBio}
              onChange={e => setLinkedinBio(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Recent Posts / Activity</label>
            <textarea
              className="input text-xs"
              rows={2}
              placeholder="Recent posts, likes, comments…"
              value={recentPosts}
              onChange={e => setRecentPosts(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Recent Funding / News</label>
              <input className="input text-xs" placeholder="e.g. Series B $20M"
                value={recentFunding} onChange={e => setRecentFunding(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Job Change</label>
              <input className="input text-xs" placeholder="e.g. Joined 6 months ago"
                value={jobChange} onChange={e => setJobChange(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={generateHooks}
        disabled={isLoadingHooks}
        className="btn-primary w-full text-xs"
      >
        {isLoadingHooks ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Generating hooks…</>
        ) : (
          <><Zap className="w-3 h-3" /> Generate 3 Hooks with GPT-4o</>
        )}
      </button>

      {/* Generated hooks */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Pick a hook to draft a message:
          </p>
          {hooks.map((hook, i) => (
            <button
              key={i}
              onClick={() => generateDraft(hook)}
              className={`w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition-colors ${
                selectedHook === hook
                  ? 'border-brand-500 bg-brand-50 text-brand-800'
                  : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="font-medium text-gray-400 mr-1">#{i + 1}</span>
              {hook}
            </button>
          ))}

          {/* Channel selector */}
          <div>
            <label className="label text-xs">Channel for draft</label>
            <div className="flex gap-2">
              {['email', 'linkedin', 'whatsapp'].map(c => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                    channel === c ? 'bg-brand-700 text-white border-brand-700' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Draft message */}
      {isLoadingDraft && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Drafting message…
        </div>
      )}

      {draftMessage && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Draft Message</p>
            <button onClick={copyToClipboard} className="btn-secondary text-xs py-1 px-2.5">
              {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <textarea
            className="input text-xs leading-relaxed"
            rows={6}
            value={draftMessage}
            onChange={e => setDraftMessage(e.target.value)}
          />
          <p className="text-xs text-gray-400">Edit before sending. Click "Copy" to paste into your email/LinkedIn/WhatsApp.</p>
        </div>
      )}
    </div>
  )
}
