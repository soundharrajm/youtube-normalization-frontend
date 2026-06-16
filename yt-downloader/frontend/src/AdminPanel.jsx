import { useState, useEffect } from 'react'

const API = localStorage.getItem('yt_backend_url') || import.meta.env.VITE_API_URL || '/api'

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'bypass-tunnel-reminder': 'true', 'ngrok-skip-browser-warning': 'true', ...options.headers },
  })
}

const S = {
  card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14 },
  mono: { fontFamily:"'JetBrains Mono',monospace" },
}

export default function AdminPanel({ onClose }) {
  const [secret,    setSecret]    = useState('')
  const [authed,    setAuthed]    = useState(false)
  const [firstTime, setFirstTime] = useState(false) // no token in backend yet
  const [status,    setStatus]    = useState(null)
  const [cookies,   setCookies]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg,       setMsg]       = useState(null)

  // On mount: check if token exists in backend
  useEffect(() => {
    apiFetch(`${API}/admin-token`).then(r => r.json()).then(d => {
      if (!d.token) {
        setFirstTime(true) // no token set yet — allow setting one
      }
    }).catch(() => {})
  }, [])

  const checkStatus = async (s) => {
    try {
      const res = await apiFetch(`${API}/admin/cookies/status?secret=${encodeURIComponent(s)}`)
      if (res.status === 403) return false
      const data = await res.json()
      setStatus(data)
      return true
    } catch { return false }
  }

  const login = async () => {
    if (firstTime) {
      // First time — save token to backend then proceed
      if (!secret.trim()) { setMsg({ type:'error', text:'Enter a secret' }); return }
      await apiFetch(`${API}/admin-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: secret })
      })
      localStorage.setItem('yt_admin_token', secret)
      setFirstTime(false)
      setAuthed(true)
      await checkStatus(secret)
      return
    }
    const ok = await checkStatus(secret)
    if (ok) {
      localStorage.setItem('yt_admin_token', secret)
      setAuthed(true)
    } else setMsg({ type:'error', text:'Invalid admin secret' })
  }

  const upload = async () => {
    if (!cookies.trim()) return
    setUploading(true)
    setMsg(null)
    try {
      const res = await apiFetch(`${API}/admin/cookies/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies, secret }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMsg({ type:'success', text: data.message })
      setCookies('')
      await checkStatus(secret)
    } catch(e) {
      setMsg({ type:'error', text: e.message })
    } finally {
      setUploading(false)
    }
  }

  const clear = async () => {
    if (!confirm('Clear service cookies? Age-restricted downloads will fail until new cookies are uploaded.')) return
    const res = await apiFetch(`${API}/admin/cookies/clear?secret=${encodeURIComponent(secret)}`, { method:'DELETE' })
    const data = await res.json()
    setMsg({ type:'success', text: data.message })
    await checkStatus(secret)
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.8)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:200, backdropFilter:'blur(4px)', padding:24,
    }}>
      <div style={{ ...S.card, width:'100%', maxWidth:600, padding:28, position:'relative' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>🔧 Admin Panel</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#555' }}>Manage YouTube service cookies</p>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:8, color:'#aaa', fontSize:18, width:34, height:34,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>

        {!authed ? (
          /* Login */
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {firstTime ? (
              <div style={{ padding:'10px 14px', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:8, fontSize:13, color:'#a78bfa' }}>
                🔑 First time setup — create your admin secret below. You'll need it every time.
              </div>
            ) : (
              <p style={{ margin:0, fontSize:14, color:'#888' }}>Enter admin secret to continue</p>
            )}
            {msg && (
              <div style={{ padding:'8px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:13, color:'#f87171' }}>
                ✗ {msg.text}
              </div>
            )}
            <input
              autoFocus
              type="password"
              value={secret}
              onChange={e => { setSecret(e.target.value); setMsg(null) }}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder={firstTime ? 'Create your admin secret...' : 'Admin secret...'}
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px', fontSize:14, color:'#e8e8f0', fontFamily:'inherit', outline:'none' }}
            />
            <button onClick={login} style={{
              background:'linear-gradient(135deg,#8b5cf6,#7c3aed)', border:'none',
              borderRadius:8, color:'#fff', fontSize:14, fontWeight:600,
              padding:'10px', cursor:'pointer', fontFamily:'inherit',
            }}>{firstTime ? 'Set Secret & Continue' : 'Unlock'}</button>
          </div>
        ) : (
          /* Admin content */
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Status */}
            {status && (
              <div style={{
                background: status.status === 'active' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${status.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                borderRadius:10, padding:'12px 16px',
              }}>
                <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:600, color: status.status === 'active' ? '#10b981' : '#f59e0b' }}>
                  {status.message}
                </p>
                {status.has_uploaded && (
                  <p style={{ margin:0, fontSize:12, color:'#555', ...S.mono }}>
                    {status.cookie_count} cookies · uploaded {status.uploaded_age}
                  </p>
                )}
                {status.has_secret_file && (
                  <p style={{ margin:'2px 0 0', fontSize:12, color:'#555' }}>
                    ✓ Render Secret File (cookies.txt) also present
                  </p>
                )}
              </div>
            )}

            {/* Instructions */}
            <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:10, padding:'14px 16px' }}>
              <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:600, color:'#60a5fa' }}>
                How to get YouTube cookies
              </p>
              <ol style={{ margin:0, paddingLeft:18, fontSize:12, color:'#888', lineHeight:1.8 }}>
                <li>Install Chrome extension: <strong style={{color:'#e8e8f0'}}>"Get cookies.txt LOCALLY"</strong></li>
                <li>Open <strong style={{color:'#e8e8f0'}}>youtube.com</strong> in Chrome while logged in</li>
                <li>Click the extension icon → select <strong style={{color:'#e8e8f0'}}>Export</strong></li>
                <li>Open the downloaded file → copy all contents</li>
                <li>Paste below and click Upload</li>
              </ol>
              <p style={{ margin:'8px 0 0', fontSize:11, color:'#555' }}>
                ⏱ Cookies expire every ~2 weeks. Re-upload when age-restricted videos start failing.
              </p>
            </div>

            {/* Cookie upload */}
            <div>
              <label style={{ fontSize:13, color:'#888', fontWeight:500, display:'block', marginBottom:6 }}>
                Paste cookies.txt content:
              </label>
              <textarea
                value={cookies}
                onChange={e => setCookies(e.target.value)}
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
                rows={8}
                style={{
                  width:'100%', background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:8,
                  padding:'10px 12px', fontSize:11, color:'#e8e8f0',
                  fontFamily:"'JetBrains Mono',monospace", outline:'none',
                  resize:'vertical', boxSizing:'border-box',
                }}
              />
            </div>

            {/* Message */}
            {msg && (
              <div style={{
                background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius:8, padding:'8px 12px', fontSize:13,
                color: msg.type === 'success' ? '#10b981' : '#f87171',
              }}>
                {msg.type === 'success' ? '✓' : '✗'} {msg.text}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={upload} disabled={uploading || !cookies.trim()} style={{
                flex:2, padding:'11px', borderRadius:9, border:'none',
                background: cookies.trim() ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#1c1c2a',
                color: cookies.trim() ? '#fff' : '#444', fontSize:14, fontWeight:600,
                cursor: cookies.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit',
              }}>
                {uploading ? '⏳ Uploading…' : '↑ Upload Cookies'}
              </button>
              {status?.has_uploaded && (
                <button onClick={clear} style={{
                  flex:1, padding:'11px', borderRadius:9,
                  border:'1px solid rgba(239,68,68,0.3)',
                  background:'rgba(239,68,68,0.08)', color:'#f87171',
                  fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                }}>
                  🗑 Clear
                </button>
              )}
              <button onClick={() => checkStatus(secret)} style={{
                flex:1, padding:'11px', borderRadius:9,
                border:'1px solid rgba(255,255,255,0.1)',
                background:'rgba(255,255,255,0.04)', color:'#888',
                fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              }}>
                ↻ Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
