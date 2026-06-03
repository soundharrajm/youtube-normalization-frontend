import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'bypass-tunnel-reminder': 'true', ...options.headers },
  })
}

const STEPS = [
  {
    icon: '🧩',
    title: 'Install Extension',
    desc: 'Add "Get cookies.txt LOCALLY" to Chrome',
    link: 'https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc',
    linkText: 'Install from Chrome Web Store →',
  },
  {
    icon: '🔑',
    title: 'Open YouTube',
    desc: 'Go to youtube.com while logged in to your Google account',
    link: 'https://youtube.com',
    linkText: 'Open YouTube →',
  },
  {
    icon: '📋',
    title: 'Export Cookies',
    desc: 'Click the extension icon in your toolbar → click Export for youtube.com',
    img: null,
  },
  {
    icon: '📂',
    title: 'Open the file',
    desc: 'Open the downloaded cookies.txt file in Notepad/TextEdit → Select All → Copy',
  },
  {
    icon: '⬆️',
    title: 'Paste & Upload',
    desc: 'Paste the contents below and click Upload',
  },
]

export default function CookieSetup({ sessionId, onDone, onClose }) {
  const [step, setStep]           = useState(0)
  const [cookies, setCookies]     = useState('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus]       = useState(null)  // null | 'success' | 'error'
  const [errMsg, setErrMsg]       = useState('')
  const [cookieStatus, setCookieStatus] = useState(null)

  useEffect(() => {
    // Check if cookies already uploaded
    apiFetch(`${API}/admin/cookies/status?secret=check&session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => setCookieStatus(d))
      .catch(() => {})
  }, [])

  const upload = async () => {
    if (!cookies.trim()) return
    setUploading(true)
    setErrMsg('')
    try {
      const res = await apiFetch(`${API}/admin/cookies/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies,
          secret: 'user-upload',
          session_id: sessionId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setStatus('success')
      setTimeout(() => onDone?.(), 1500)
    } catch(e) {
      setStatus('error')
      setErrMsg(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{
      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:16, padding:20, marginTop:12,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#e8e8f0' }}>
            🍪 Enable Age-Restricted Downloads
          </p>
          <p style={{ margin:'2px 0 0', fontSize:12, color:'#555' }}>
            One-time setup · takes 2 minutes
          </p>
        </div>
        <button onClick={onClose} style={{
          background:'none', border:'none', color:'#555',
          fontSize:18, cursor:'pointer', padding:'2px 6px',
        }}>×</button>
      </div>

      {/* Already active */}
      {cookieStatus?.status === 'active' && status !== 'success' && (
        <div style={{
          background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)',
          borderRadius:10, padding:'10px 14px', marginBottom:14,
          display:'flex', alignItems:'center', gap:8,
        }}>
          <span style={{ fontSize:16 }}>✓</span>
          <div>
            <p style={{ margin:0, fontSize:13, color:'#10b981', fontWeight:600 }}>Cookies active</p>
            <p style={{ margin:0, fontSize:11, color:'#555' }}>
              {cookieStatus.cookie_count} cookies · {cookieStatus.uploaded_age}
            </p>
          </div>
          <button onClick={() => setCookieStatus(null)} style={{
            marginLeft:'auto', background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:6,
            color:'#888', fontSize:11, padding:'4px 10px', cursor:'pointer',
            fontFamily:'inherit',
          }}>Refresh</button>
        </div>
      )}

      {/* Step indicators */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {STEPS.map((s, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            style={{
              flex:1, height:3, borderRadius:100, cursor:'pointer',
              background: i <= step ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
              transition:'background 0.2s',
            }}
          />
        ))}
      </div>

      {/* Current step */}
      <div style={{
        background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:12, padding:'16px',
      }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, flexShrink:0,
          }}>
            {STEPS[step].icon}
          </div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#e8e8f0' }}>
              Step {step + 1} of {STEPS.length}: {STEPS[step].title}
            </p>
            <p style={{ margin:'4px 0 0', fontSize:12, color:'#888', lineHeight:1.5 }}>
              {STEPS[step].desc}
            </p>
          </div>
        </div>

        {/* External link */}
        {STEPS[step].link && (
          <a href={STEPS[step].link} target="_blank" rel="noreferrer" style={{
            display:'inline-flex', alignItems:'center', gap:6,
            fontSize:12, color:'#8b5cf6', textDecoration:'none',
            background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)',
            borderRadius:8, padding:'6px 12px', marginBottom:10,
          }}>
            {STEPS[step].linkText}
          </a>
        )}

        {/* Paste area on last step */}
        {step === STEPS.length - 1 && (
          <div style={{ marginTop:8 }}>
            <textarea
              value={cookies}
              onChange={e => setCookies(e.target.value)}
              placeholder={'# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t...'}
              rows={6}
              style={{
                width:'100%', background:'rgba(0,0,0,0.3)',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:8,
                padding:'10px 12px', fontSize:11, color:'#e8e8f0',
                fontFamily:"'JetBrains Mono',monospace", outline:'none',
                resize:'vertical', boxSizing:'border-box',
              }}
            />

            {status === 'success' && (
              <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, fontSize:13, color:'#10b981' }}>
                ✓ Cookies uploaded! Age-restricted videos are now enabled.
              </div>
            )}
            {status === 'error' && (
              <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:12, color:'#f87171' }}>
                ✗ {errMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex:1, padding:'9px', borderRadius:8,
            border:'1px solid rgba(255,255,255,0.1)',
            background:'rgba(255,255,255,0.03)', color:'#888',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>← Back</button>
        )}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} style={{
            flex:2, padding:'9px', borderRadius:8, border:'none',
            background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',
            color:'#fff', fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>Next →</button>
        ) : (
          <button
            onClick={upload}
            disabled={uploading || !cookies.trim() || status === 'success'}
            style={{
              flex:2, padding:'9px', borderRadius:8, border:'none',
              background: cookies.trim() && status !== 'success'
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : '#1c1c2a',
              color: cookies.trim() && status !== 'success' ? '#fff' : '#444',
              fontSize:13, fontWeight:600,
              cursor: cookies.trim() ? 'pointer' : 'not-allowed',
              fontFamily:'inherit',
            }}
          >
            {uploading ? '⏳ Uploading…' : status === 'success' ? '✓ Done!' : '⬆ Upload Cookies'}
          </button>
        )}
      </div>
    </div>
  )
}
