import { useState, useRef, useCallback, useEffect } from 'react'
import AdminPanel from './AdminPanel.jsx'
import CookieSetup from './CookieSetup.jsx'
import SearchPanel from './SearchPanel.jsx'

// v2.1.0
const API = localStorage.getItem('yt_backend_url') || import.meta.env.VITE_API_URL || '/api'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '406747955382-digauab6tpgo7f9rr7sbl0qoajc01oub.apps.googleusercontent.com'
const REDIRECT_URI = window.location.origin

// ── localtunnel bypass wrapper ─────────────────────────────────────────────
function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'bypass-tunnel-reminder':    'true',
      'ngrok-skip-browser-warning':'true',
      ...options.headers,
    },
  })
}

// ── utils ──────────────────────────────────────────────────────────────────
function formatDuration(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}
function formatSize(b) {
  if (!b) return null
  if (b >= 1073741824) return `${(b/1073741824).toFixed(1)} GB`
  if (b >= 1048576)    return `${(b/1048576).toFixed(0)} MB`
  return `${(b/1024).toFixed(0)} KB`
}
function isValidYT(url) {
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/.test(url)
}

const PHASE = {
  queued:      { label:'Queued',       color:'#f59e0b', icon:'⏳' },
  downloading: { label:'Downloading',  color:'#8b5cf6', icon:'↓'  },
  processing:  { label:'Merging',      color:'#f59e0b', icon:'⚙'  },
  normalizing: { label:'Normalizing',  color:'#3b82f6', icon:'▶'  },
  done:        { label:'Done',         color:'#10b981', icon:'✓'  },
  error:       { label:'Error',        color:'#ef4444', icon:'✗'  },
}

const S = {
  app:  { minHeight:'100vh', background:'#080810', fontFamily:"'Space Grotesk',sans-serif", color:'#e8e8f0' },
  wrap: { maxWidth:920, margin:'0 auto', padding:'0 24px 80px', position:'relative', zIndex:1 },
  card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14 },
  mono: { fontFamily:"'JetBrains Mono',monospace" },
  pill: (color) => ({ fontSize:11, color, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:100, padding:'2px 9px', fontWeight:600 }),
  btn:  (active, color='#8b5cf6') => ({
    border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700,
    padding:'11px 22px', cursor: active?'pointer':'not-allowed', fontFamily:'inherit',
    background: active ? `linear-gradient(135deg,${color},${color}cc)` : '#1c1c2a',
    opacity: active ? 1 : 0.5, transition:'all 0.2s',
  }),
}

// ── Google Login button ────────────────────────────────────────────────────
function GoogleLoginButton({ onLogin }) {
  const handleLogin = () => {
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         'openid email profile https://www.googleapis.com/auth/youtube.readonly',
      access_type:   'offline',
      prompt:        'consent',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }
  return (
    <button onClick={handleLogin} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 20px',
      background:'#fff', border:'none', borderRadius:10, cursor:'pointer',
      fontSize:14, fontWeight:600, color:'#333', fontFamily:'inherit',
      boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Sign in with Google
    </button>
  )
}

// ── User avatar ────────────────────────────────────────────────────────────
function UserAvatar({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'6px 12px 6px 6px',
        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:100, cursor:'pointer', fontFamily:'inherit',
      }}>
        {user.picture
          ? <img src={user.picture} alt="" style={{ width:28, height:28, borderRadius:'50%' }} />
          : <div style={{ width:28, height:28, borderRadius:'50%', background:'#8b5cf6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff' }}>
              {user.name?.[0] || '?'}
            </div>
        }
        <span style={{ fontSize:13, color:'#e8e8f0', fontWeight:500 }}>{user.name || user.email}</span>
        <span style={{ color:'#555', fontSize:11 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0,
          background:'#111', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:10, padding:8, minWidth:180, zIndex:100,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <p style={{ margin:'0 0 4px', fontSize:13, color:'#e8e8f0', padding:'4px 10px' }}>{user.name}</p>
          <p style={{ margin:'0 0 8px', fontSize:11, color:'#555', padding:'0 10px' }}>{user.email}</p>
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'4px 0' }} />
          <button onClick={() => { setOpen(false); onLogout() }} style={{
            width:'100%', padding:'8px 10px', background:'none', border:'none',
            color:'#f87171', fontSize:13, cursor:'pointer', textAlign:'left',
            fontFamily:'inherit', borderRadius:6,
          }}>Sign out</button>
        </div>
      )}
    </div>
  )
}

// ── Mini progress bar ──────────────────────────────────────────────────────
function MiniBar({ pct, color, label, show }) {
  if (!show) return null
  return (
    <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:10, color, fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:10, color:'#444', ...S.mono }}>{pct}%</span>
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:3 }}>
        <div style={{ height:'100%', borderRadius:100, background:color, width:`${pct}%`, transition:'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Quality badge color ────────────────────────────────────────────────────
function qualityColor(label) {
  if (!label) return '#555'
  if (label.includes('4K'))       return '#f59e0b'
  if (label.includes('2K'))       return '#a78bfa'
  if (label.includes('Full HD'))  return '#8b5cf6'
  if (label.includes('HD'))       return '#3b82f6'
  if (label.includes('Best'))     return '#10b981'
  return '#555'
}

// ── Format picker ──────────────────────────────────────────────────────────
function FormatPicker({ info, selected, onSelect }) {
  const [tab, setTab] = useState('video')
  const allFormats = info?.formats || []
  const formats = allFormats.filter(f => tab === 'video' ? f.type === 'video' : f.type === 'audio')
  const videoCount = allFormats.filter(f => f.type === 'video').length
  const audioCount = allFormats.filter(f => f.type === 'audio').length
  return (
    <div style={{ ...S.card, overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        {[{ key:'video', label:`🎬 Video (${videoCount})` }, { key:'audio', label:`🎵 Audio (${audioCount})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:'10px', background: tab===t.key ? 'rgba(139,92,246,0.1)':'none',
            border:'none', borderBottom: tab===t.key ? '2px solid #8b5cf6':'2px solid transparent',
            color: tab===t.key ? '#a78bfa':'#555', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ maxHeight:220, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:4 }}>
        {formats.map(fmt => {
          const sel = selected?.format_id === fmt.format_id
          const qColor = qualityColor(fmt.label)
          const isBest = fmt.format_id === 'bestvideo+bestaudio/best'
          return (
            <div key={fmt.format_id} onClick={() => onSelect(fmt)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8,
              cursor:'pointer',
              background: sel ? 'rgba(139,92,246,0.14)' : isBest ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
              border: sel ? '1px solid rgba(139,92,246,0.4)' : isBest ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
            }}>
              <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0,
                border:`2px solid ${sel?'#8b5cf6':'#444'}`, background:sel?'#8b5cf6':'none' }} />
              <span style={{ flex:1, fontSize:13, fontWeight:sel?600:400, color:sel?'#e8e8f0':'#ccc' }}>{fmt.label}</span>
              <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                {fmt.quality && !isBest && (
                  <span style={{ fontSize:10, fontWeight:700, color:qColor,
                    background:`${qColor}22`, border:`1px solid ${qColor}44`,
                    borderRadius:4, padding:'1px 6px' }}>{fmt.quality}</span>
                )}
                {fmt.filesize && (
                  <span style={{ ...S.mono, fontSize:10, color:'#444',
                    background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:4 }}>
                    {formatSize(fmt.filesize)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {formats.length === 0 && (
          <p style={{ fontSize:12, color:'#444', textAlign:'center', padding:16, margin:0 }}>No {tab} formats</p>
        )}
      </div>
    </div>
  )
}


// ── BackendConfig ─────────────────────────────────────────────────────────
function BackendConfig({ onClose }) {
  const saved      = localStorage.getItem('yt_backend_url') || ''
  const locked     = localStorage.getItem('yt_backend_locked') === 'true'
  const adminToken = localStorage.getItem('yt_admin_token') || ''

  const [authed,    setAuthed]   = useState(false)
  const [gateInput, setGateInput] = useState('')
  const [gateError, setGateError] = useState(null)

  const [url,        setUrl]        = useState(saved || import.meta.env.VITE_API_URL || '')
  const [isLocked,   setIsLocked]   = useState(locked)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState(null)
  const [status,     setStatus]     = useState(null)
  const [testing,    setTesting]    = useState(false)

  // ── Gate screen ────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:28, width:400, boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'rgba(139,92,246,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{adminToken ? '🔒' : '🔑'}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#e8e8f0' }}>Backend URL</div>
              <div style={{ fontSize:11, color:'#666' }}>{adminToken ? 'Enter admin secret to continue' : 'First time — set your admin secret'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#666', fontSize:14, cursor:'pointer' }}>✕</button>
        </div>

        {!adminToken && (
          <div style={{ padding:'8px 12px', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:8, fontSize:11, color:'#a78bfa', marginBottom:12 }}>
            No admin secret set yet. Enter one below to create it — you'll need it every time.
          </div>
        )}

        <input autoFocus value={gateInput} onChange={e => setGateInput(e.target.value)}
          onKeyDown={e => { if (e.key !== 'Enter') return
            if (!adminToken) {
              if (!gateInput.trim()) { setGateError('Enter a secret'); return }
              // Save new token to backend + localStorage
              apiFetch(API + '/admin-token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: gateInput }) }).catch(()=>{})
              localStorage.setItem('yt_admin_token', gateInput)
              setAuthed(true); setGateError(null)
            } else {
              if (gateInput === adminToken) { setAuthed(true); setGateError(null) }
              else setGateError('Invalid admin secret')
            }
          }}
          type="password" placeholder={adminToken ? 'Admin secret...' : 'Create your admin secret...'}
          style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${gateError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius:9, padding:'10px 14px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:'monospace', boxSizing:'border-box', marginBottom:8 }}
        />
        {gateError && <div style={{ fontSize:11, color:'#ef4444', marginBottom:8 }}>⚠ {gateError}</div>}
        <button onClick={() => {
            if (!adminToken) {
              if (!gateInput.trim()) { setGateError('Enter a secret'); return }
              apiFetch(API + '/admin-token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: gateInput }) }).catch(()=>{})
              localStorage.setItem('yt_admin_token', gateInput)
              setAuthed(true); setGateError(null)
            } else {
              if (gateInput === adminToken) { setAuthed(true); setGateError(null) }
              else setGateError('Invalid admin secret')
            }
          }}
          style={{ width:'100%', padding:'10px', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'#8b5cf6', color:'#fff' }}>
          {adminToken ? 'Unlock' : 'Set Secret & Continue'}
        </button>
      </div>
    </div>
  )

  const test = async () => {
    setTesting(true); setStatus(null)
    try {
      const r = await fetch(url + '/health', {
        signal: AbortSignal.timeout(5000),
        headers: { 'ngrok-skip-browser-warning': 'true', 'bypass-tunnel-reminder': 'true' }
      })
      const d = await r.json()
      setStatus({ ok: true, msg: 'Connected ✓  (' + (d.status || 'ok') + ')' })
    } catch(e) { setStatus({ ok: false, msg: 'Failed: ' + e.message }) }
    finally { setTesting(false) }
  }

  const save = () => {
    const clean = url.replace(/\/$/, '')
    localStorage.setItem('yt_backend_url', clean)
    localStorage.setItem('yt_backend_locked', isLocked ? 'true' : 'false')
    onClose()
    window.location.reload() // reload so API const picks up new URL
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:28, width:480, boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'rgba(139,92,246,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🔌</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#e8e8f0' }}>Backend URL</div>
              <div style={{ fontSize:11, color:'#666' }}>ngrok tunnel to your local backend</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#666', fontSize:14, cursor:'pointer' }}>✕</button>
        </div>

        <label style={{ fontSize:11, color:'#666', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Backend URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} disabled={isLocked}
          placeholder="https://basically-praising-paving.ngrok-free.app"
          style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, padding:'10px 14px', fontSize:13, color: isLocked ? '#555' : '#e8e8f0', outline:'none', fontFamily:'monospace', boxSizing:'border-box', marginBottom:10, cursor: isLocked ? 'not-allowed' : 'text' }}
        />

        {status && (
          <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8, fontSize:12, fontFamily:'monospace', background: status.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${status.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: status.ok ? '#10b981' : '#ef4444' }}>
            {status.msg}
          </div>
        )}

        {/* Simple lock toggle — already authenticated via gate */}
        <div onClick={() => setIsLocked(v => !v)}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:9, cursor:'pointer', marginBottom:16, userSelect:'none' }}>
          <div style={{ width:36, height:20, borderRadius:100, background: isLocked ? '#8b5cf6' : 'rgba(255,255,255,0.1)', transition:'background .2s', position:'relative', flexShrink:0 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left: isLocked ? 18 : 2, transition:'left .2s' }} />
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color: isLocked ? '#a78bfa' : '#888' }}>{isLocked ? '🔒 URL Locked' : '🔓 URL Unlocked'}</div>
            <div style={{ fontSize:11, color:'#555' }}>{isLocked ? 'Requires admin secret to edit' : 'Toggle to lock from accidental changes'}</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={test} disabled={testing || !url} style={{ flex:1, padding:'9px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#888' }}>
            {testing ? '⏳ Testing…' : '🔌 Test Connection'}
          </button>
          <button onClick={save} style={{ flex:1, padding:'9px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'#8b5cf6', color:'#fff' }}>
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── URL Row ────────────────────────────────────────────────────────────────
function UrlRow({ item, onChange, onRemove, canRemove }) {
  const { url, info, error, fetchStatus, fetchPct, fetchStart } = item
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (fetchStatus !== 'fetching') { setElapsed(0); return }
    const t = setInterval(() => {
      setElapsed(fetchStart ? ((Date.now() - fetchStart) / 1000).toFixed(1) : 0)
    }, 100)
    return () => clearInterval(t)
  }, [fetchStatus, fetchStart])
  const valid = isValidYT(url)
  const isFetching = fetchStatus === 'fetching'
  const needsLogin = error?.includes('LOGIN_REQUIRED') || error?.includes('sign-in') || error?.includes('Sign in') || error?.includes('🔒') || error?.includes('🔞')
  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{
          ...S.card, display:'flex', alignItems:'center', gap:8, padding:'6px 6px 6px 14px',
          borderColor: error ? 'rgba(239,68,68,0.35)' : info ? 'rgba(16,185,129,0.35)' : valid ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize:15, flexShrink:0 }}>🔗</span>
          <input
            value={url}
            onChange={e => onChange('url', e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'#e8e8f0', fontFamily:'inherit', padding:'8px 0' }}
          />
          {isFetching && <span style={{ ...S.pill('#8b5cf6'), flexShrink:0 }}>fetching…</span>}
          {fetchStatus === 'done' && !error && <span style={{ ...S.pill('#10b981'), flexShrink:0 }}>✓ ready</span>}
          {fetchStatus === 'error' && needsLogin && <span style={{ ...S.pill('#f59e0b'), flexShrink:0 }}>🔒 login required</span>}
          {fetchStatus === 'error' && !needsLogin && <span style={{ ...S.pill('#ef4444'), flexShrink:0 }}>✗ unavailable</span>}
        </div>
        <MiniBar
          pct={fetchPct || 0}
          color={error ? '#ef4444' : '#8b5cf6'}
          label={
            isFetching
              ? `⏳ Fetching video info… ${elapsed}s`
              : fetchStatus === 'done'
                ? `✓ Fetch complete${item.fetchTime ? ` · ${item.fetchTime}s` : ''}`
                : fetchStatus === 'error'
                  ? `${needsLogin ? '🔒 Login required' : '✗ Video unavailable'}${item.fetchTime ? ` · ${item.fetchTime}s` : ''}`
                  : ''
          }
          show={!!fetchStatus}
        />
        {info && (
          <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)' }}>
            <img src={info.thumbnail} alt="" style={{ width:72, height:42, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
            <div style={{ minWidth:0, flex:1 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{info.title}</p>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                <span style={{ fontSize:12, color:'#aaa', fontWeight:500 }}>{info.uploader}</span>
                {info.duration && (
                  <span style={{ fontSize:11, color:'#10b981', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:4, padding:'1px 6px', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>
                    {formatDuration(info.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div style={{
            fontSize:12,
            background: needsLogin ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)',
            border: `1px solid ${needsLogin ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius:8, padding:'10px 12px',
          }}>
            {needsLogin ? (
              <p style={{ margin:0, color:'#f59e0b', fontSize:12 }}>
                {error}
              </p>
            ) : error?.includes('Failed to fetch') || error?.includes('NetworkError') ? (
              <p style={{ margin:0, color:'#f87171', fontSize:12 }}>
                🔌 Backend unreachable. Check if your local server and tunnel are running.
              </p>
            ) : error?.includes('rate limit') || error?.includes('rate-limited') ? (
              <p style={{ margin:0, color:'#f59e0b', fontSize:12 }}>
                ⏱ YouTube rate limited. Please wait 1 hour before retrying.
              </p>
            ) : error?.includes('geo-restricted') || error?.includes('not available') ? (
              <p style={{ margin:0, color:'#f87171', fontSize:12 }}>
                🌍 {error}
              </p>
            ) : (
              <p style={{ margin:0, color:'#f87171', fontSize:12 }}>
                {error}
              </p>
            )}
          </div>
        )}
        {info && <FormatPicker info={info} selected={item.selectedFormat} onSelect={fmt => onChange('selectedFormat', fmt)} />}
      </div>
      {canRemove && (
        <button onClick={onRemove} style={{
          width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)',
          background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:16,
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2,
        }}>×</button>
      )}
    </div>
  )
}

// ── Circular progress ─────────────────────────────────────────────────────
function CircleProgress({ pct, color, size=44, stroke=3, label, done }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={done ? '#10b981' : color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition:'stroke-dashoffset 0.4s ease' }} />
        </svg>
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:10, fontWeight:700,
          color: done ? '#10b981' : color, fontFamily:"'JetBrains Mono',monospace",
        }}>
          {done ? '✓' : `${pct}%`}
        </div>
      </div>
      <span style={{ fontSize:9, color:'#555', fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

// ── Job card ───────────────────────────────────────────────────────────────
function JobCard({ job }) {
  const meta  = PHASE[job.status] || PHASE.queued
  const isQ   = job.status === 'queued'
  const isDl  = job.status === 'downloading' || job.status === 'processing'
  const isNorm = job.status === 'normalizing'
  const isDone = job.status === 'done'
  const isErr  = job.status === 'error'

  const dlPct   = isDl ? job.progress : (isDone || isNorm) ? 100 : 0
  const normPct = isNorm ? job.normProgress : isDone ? 100 : 0

  return (
    <div style={{ ...S.card, padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>

        {/* Status icon */}
        <div style={{ width:32, height:32, borderRadius:'50%', background:`${meta.color}22`,
          border:`1.5px solid ${meta.color}55`, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:14, color:meta.color, flexShrink:0 }}>
          {meta.icon}
        </div>

        {/* Title + url */}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#e8e8f0',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {job.title || job.url || '…'}
          </p>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3 }}>
            <span style={{ fontSize:11, color:'#555', overflow:'hidden', textOverflow:'ellipsis',
              whiteSpace:'nowrap', maxWidth:200, fontFamily:"'JetBrains Mono',monospace" }}>
              {(job.url||'').replace('https://www.youtube.com/watch?v=','yt:')}
            </span>
            <span style={{ fontSize:10, color:meta.color, background:`${meta.color}18`,
              border:`1px solid ${meta.color}33`, borderRadius:100, padding:'1px 7px', fontWeight:600, flexShrink:0 }}>
              {isQ && job.queue_position > 0 ? `#${job.queue_position+1} queued` : meta.label}
            </span>
          </div>
        </div>

        {/* Right side: circles + save button */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {/* Download circle */}
          {!isQ && !isErr && (
            <CircleProgress
              pct={dlPct} color='#8b5cf6' size={44} stroke={3}
              label="DL" done={dlPct === 100} />
          )}
          {/* Normalize circle */}
          {!isQ && !isErr && !isDl && (
            <CircleProgress
              pct={normPct} color='#3b82f6' size={44} stroke={3}
              label="NRM" done={normPct === 100} />
          )}
          {/* Save button */}
          {isDone && job.downloadUrl && (
            <a href={job.downloadUrl} download style={{
              background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)',
              borderRadius:8, color:'#34d399', fontSize:12, fontWeight:700,
              padding:'6px 14px', textDecoration:'none',
            }}>↓ Save</a>
          )}
        </div>
      </div>

      {/* Filename */}
      {isDone && job.outFilename && (
        <div style={{ marginTop:8, fontSize:10, color:'#10b981',
          fontFamily:"'JetBrains Mono',monospace",
          background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)',
          borderRadius:5, padding:'3px 8px', overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          ✓ {job.outFilename}
        </div>
      )}

      {/* Error */}
      {isErr && job.error && (
        <p style={{ margin:'8px 0 0', fontSize:11, color:'#f87171',
          background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:6, padding:'6px 10px' }}>{job.error}</p>
      )}
    </div>
  )
}

// ── Queue badge ────────────────────────────────────────────────────────────
function QueueBadge({ jobs }) {
  const queued  = jobs.filter(j => j.status === 'queued').length
  const active  = jobs.filter(j => !['done','error','queued'].includes(j.status)).length
  const done    = jobs.filter(j => j.status === 'done').length
  const failed  = jobs.filter(j => j.status === 'error').length
  const total   = jobs.length
  if (total === 0) return null
  return (
    <div style={{
      position:'fixed', top:16, right:16, zIndex:100,
      background:'rgba(10,10,20,0.92)', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:14, padding:'10px 16px', backdropFilter:'blur(12px)',
      display:'flex', flexDirection:'column', gap:6, minWidth:160,
      boxShadow:'0 4px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontSize:11, color:'#555', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase' }}>Queue</div>
      {[
        { label:'Active',  val:active,  color:'#8b5cf6' },
        { label:'Waiting', val:queued,  color:'#f59e0b' },
        { label:'Done',    val:done,    color:'#10b981' },
        { label:'Failed',  val:failed,  color:'#ef4444' },
      ].map(r => r.val > 0 && (
        <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#666' }}>{r.label}</span>
          <span style={{ ...S.mono, fontSize:13, fontWeight:700, color:r.color,
            background:`${r.color}18`, border:`1px solid ${r.color}33`,
            borderRadius:6, padding:'1px 8px' }}>{r.val}</span>
        </div>
      ))}
      {total > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:3 }}>
            <div style={{ height:'100%', borderRadius:100, background:'linear-gradient(90deg,#8b5cf6,#10b981)', width:`${Math.round((done/total)*100)}%`, transition:'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize:10, color:'#444', textAlign:'right', marginTop:3, ...S.mono }}>{done}/{total} done</div>
        </div>
      )}
    </div>
  )
}

// ── URL import helpers ────────────────────────────────────────────────────
function parseImportedUrls(text, fileType) {
  try {
    if (fileType === 'json') {
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : Object.values(parsed).flat()
      return arr.map(u => String(u).trim()).filter(u => isValidYT(u))
    }
    // CSV — find url column or just grab all valid YT urls from any column
    const lines = text.split(/\r?\n/).filter(Boolean)
    const urls = []
    lines.forEach(line => {
      const cells = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
      cells.forEach(cell => { if (isValidYT(cell)) urls.push(cell) })
    })
    return [...new Set(urls)]
  } catch {
    return []
  }
}


// ── Completion Popup ───────────────────────────────────────────────────────
function CompletionPopup({ jobs, onClose }) {
  const [copied, setCopied] = useState(false)
  const doneJobs = jobs.filter(j => j.status === 'done' && j.outFilename)

  const allNames = doneJobs.map(j => j.outFilename).join('\n')

  const copyAll = () => {
    navigator.clipboard.writeText(allNames).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyOne = (name) => {
    navigator.clipboard.writeText(name)
  }

  if (!doneJobs.length) return null

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:300,
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background:'#0e0e1a', border:'1px solid rgba(16,185,129,0.3)',
        borderRadius:16, padding:24, width:'100%', maxWidth:600,
        maxHeight:'80vh', display:'flex', flexDirection:'column', gap:16,
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              ✓
            </div>
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#e8e8f0' }}>
                {doneJobs.length} Video{doneJobs.length > 1 ? 's' : ''} Normalized
              </p>
              <p style={{ margin:0, fontSize:12, color:'#555' }}>
                Click any filename to copy it
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
            background:'rgba(255,255,255,0.05)', color:'#888',
            fontSize:16, cursor:'pointer', display:'flex',
            alignItems:'center', justifyContent:'center',
          }}>✕</button>
        </div>

        {/* File list */}
        <div style={{
          overflowY:'auto', display:'flex', flexDirection:'column', gap:6,
          maxHeight:340,
        }}>
          {doneJobs.map((job, i) => (
            <div
              key={job.jobId}
              onClick={() => copyOne(job.outFilename)}
              title="Click to copy"
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', borderRadius:8, cursor:'pointer',
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.06)',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.08)'
                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              <span style={{ fontSize:11, color:'#555', fontFamily:"'JetBrains Mono',monospace",
                flexShrink:0, width:20, textAlign:'right' }}>{i+1}.</span>
              <span style={{ fontSize:12, color:'#10b981',
                fontFamily:"'JetBrains Mono',monospace",
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                {job.outFilename}
              </span>
              <span style={{ fontSize:10, color:'#444', flexShrink:0 }}>📋</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:8, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12 }}>
          <button
            onClick={copyAll}
            style={{
              flex:1, padding:'10px', borderRadius:10, fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
              border: copied ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(139,92,246,0.3)',
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.12)',
              color: copied ? '#34d399' : '#a78bfa',
            }}
          >
            {copied ? '✓ Copied all filenames!' : '📋 Copy All Filenames'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
              border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.04)', color:'#666',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
let _id = 1
const newItem = () => ({ id:_id++, url:'', info:null, selectedFormat:null, error:null, fetchStatus:null, fetchPct:0, fetchTime:null, fetchStart:null })

export default function App() {
  const [items, setItems]           = useState(() => [newItem()])
  const [showAdmin,         setShowAdmin]         = useState(false)
  const [bgUrl,        setBgUrl]        = useState('')
  const [bgBrightness, setBgBrightness] = useState(30)
  const [showBgPanel,  setShowBgPanel]  = useState(false)
  const [bgSaving,     setBgSaving]     = useState(false)
  const bgInputRef = useRef(null)
  const [showBackendConfig, setShowBackendConfig] = useState(false)
  const [backendOk,         setBackendOk]         = useState(null)
  const [showCookieSetup, setShowCookieSetup] = useState(false)
  const [user, setUser]             = useState(null)
  const [serverInfo, setServerInfo] = useState(null)
  const [fetchingAll, setFetchingAll] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [fetchIndex, setFetchIndex]     = useState(0)
  const [fetchTotal, setFetchTotal]     = useState(0)
  const [parallelFetch, setParallelFetch] = useState(false)
  const [showSearch, setShowSearch]     = useState(false)
  const [dlCountdown, setDlCountdown]   = useState(0)
  const [dlIndex, setDlIndex]           = useState(0)
  const [dlTotal, setDlTotal]           = useState(0)
  const [jobs, setJobs]             = useState([])
  const pollRef                     = useRef(null)
  const fileInputRef                = useRef(null)

  const importUrls = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileType = file.name.endsWith('.json') ? 'json' : 'csv'
    const reader = new FileReader()
    reader.onload = (ev) => {
      const urls = parseImportedUrls(ev.target.result, fileType)
      if (!urls.length) { alert('No valid YouTube URLs found in file'); return }
      setItems(prev => {
        const existing = prev.filter(it => it.url.trim())
        const existingUrls = new Set(existing.map(it => it.url.trim()))
        const newItems = urls
          .filter(u => !existingUrls.has(u))
          .map(u => ({ ...newItem(), url: u }))
        const base = prev.some(it => !it.url.trim()) ? existing : prev
        return [...base, ...newItems]
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Handle OAuth callback ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
      console.log('[AUTH] OAuth code received, exchanging...')
      console.log('[AUTH] API URL:', API)
      console.log('[AUTH] Redirect URI:', REDIRECT_URI)
      apiFetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
      }).then(async r => {
        const data = await r.json()
        console.log('[AUTH] Response status:', r.status, data)
        if (data.session_id) {
          const userData = {
            session_id: data.session_id,
            name: data.name,
            email: data.email,
            picture: data.picture
          }
          setUser(userData)
          localStorage.setItem('yt_session', JSON.stringify(userData))
          console.log('[AUTH] Login success:', data.email)
        } else {
          console.error('[AUTH] No session_id in response:', data)
        }
      }).catch(err => {
        console.error('[AUTH] Fetch error:', err)
      })
    }
    const stored = localStorage.getItem('yt_session')
    if (stored && !code) {
      try {
        const parsed = JSON.parse(stored)
        apiFetch(`${API}/auth/session/${parsed.session_id}`)
          .then(r => { if (r.ok) return r.json(); throw new Error('invalid') })
          .then(() => setUser(parsed))
          .catch(() => localStorage.removeItem('yt_session'))
      } catch { localStorage.removeItem('yt_session') }
    }
    apiFetch(`${API}/health`).then(r=>r.json()).then(setServerInfo).catch(()=>{})
  }, [])

  const logout = async () => {
    if (user?.session_id) {
      await apiFetch(`${API}/auth/logout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: user.session_id }),
      }).catch(() => {})
    }
    setUser(null)
    localStorage.removeItem('yt_session')
  }

  const updateItem = (id, key, val) =>
    setItems(prev => prev.map(it => it.id===id ? {...it, [key]:val} : it))
  const addItem    = () => setItems(prev => [...prev, newItem()])
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id!==id))

  const addUrlFromSearch = (video) => {
    // video = { url, video_id, title, thumbnail, duration, channel, views }
    const url = typeof video === 'string' ? video : video.url
    if (items.some(it => it.url.trim() === url.trim())) return

    // Build info object directly from search result — skip fetch entirely
    const info = typeof video === 'object' ? {
      title:     video.title,
      thumbnail: video.thumbnail,
      duration:  video.duration_seconds || null,
      uploader:  video.channel,
      formats: [
        {
          format_id: 'bestvideo+bestaudio/best',
          type:      'video',
          ext:       'mp4',
          resolution:'best',
          filesize:  null,
          height:    9999,
          quality:   'Best Available',
          label:     '⭐ Best Quality (recommended)',
        }
      ],
    } : null

    const defaultFormat = info ? info.formats[0] : null

    setItems(prev => {
      const hasEmpty = prev.some(it => !it.url.trim())
      if (hasEmpty) {
        return prev.map(it => {
          if (!it.url.trim()) {
            return {
              ...it, url,
              info:           info,
              selectedFormat: defaultFormat,
              fetchStatus:    info ? 'done' : null,
              fetchPct:       info ? 100 : 0,
              error:          null,
            }
          }
          return it
        })
      }
      return [...prev, {
        ...newItem(), url,
        info:           info,
        selectedFormat: defaultFormat,
        fetchStatus:    info ? 'done' : null,
        fetchPct:       info ? 100 : 0,
        error:          null,
      }]
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const fetchOne = async (id) => {
    const item = items.find(it => it.id===id)
    if (!item?.url.trim()) return
    const fetchStartTime = Date.now()
    setItems(prev => prev.map(it => it.id===id ? {...it, fetchStatus:'fetching', fetchPct:0, error:null, info:null, fetchTime:null, fetchStart:fetchStartTime} : it))
    let pct = 0
    const ticker = setInterval(() => {
      pct = Math.min(pct + Math.random()*8, 88)
      setItems(prev => prev.map(it => it.id===id ? {...it, fetchPct:Math.round(pct)} : it))
    }, 300)
    try {
      const res = await apiFetch(`${API}/info`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: item.url.trim(), session_id: user?.session_id || null }),
      })
      const data = await res.json()
      clearInterval(ticker)
      if (!res.ok) throw new Error(data.detail || 'Failed')
      const firstFmt = data.formats.find(f=>f.type==='video') || data.formats[0]
      const fetchElapsed = ((Date.now() - fetchStartTime) / 1000).toFixed(1)
      setItems(prev => prev.map(it => it.id===id
        ? { ...it, info:data, selectedFormat:firstFmt, error:null, fetchStatus:'done', fetchPct:100, fetchTime:fetchElapsed }
        : it
      ))
    } catch(e) {
      clearInterval(ticker)
      const fetchElapsed = ((Date.now() - fetchStartTime) / 1000).toFixed(1)
      setItems(prev => prev.map(it => it.id===id
        ? { ...it, error:e.message, fetchStatus:'error', fetchPct:100, fetchTime:fetchElapsed }
        : it
      ))
    }
  }

  // ── fetchAll: sequential or parallel based on parallelFetch flag ────────────
  const fetchAll = async () => {
    const pending = items.filter(it => it.url.trim() && !it.info)
    if (!pending.length) return
    setFetchingAll(true)
    setFetchTotal(pending.length)

    if (parallelFetch) {
      // PARALLEL MODE: send all at once — fast, uses all CPUs
      // Good for high-CPU machines, may trigger rate limiting
      setFetchIndex(pending.length)
      await Promise.allSettled(pending.map(it => fetchOne(it.id)))
    } else {
      // SEQUENTIAL MODE: one at a time — safe, no rate limiting
      // Good for single CPU or when rate limited
      for (let i = 0; i < pending.length; i++) {
        setFetchIndex(i + 1)
        await fetchOne(pending[i].id)
        if (i < pending.length - 1)
          await new Promise(r => setTimeout(r, 1000))
      }
    }

    setFetchingAll(false)
    setFetchIndex(0)
    setFetchTotal(0)
  }

  // ── refreshJobs: manually re-check all job statuses ───────────────────────
  const refreshJobs = async () => {
    if (!jobs.length) return
    const snapshot = [...jobs]
    const results = await Promise.allSettled(
      snapshot.map(j => apiFetch(`${API}/download/status/${j.jobId}`).then(r => r.json()))
    )
    setJobs(prev => {
      let updated = [...prev]
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return
        const d = r.value
        const jobId = snapshot[i].jobId
        updated = updated.map(j => {
          if (j.jobId !== jobId) return j
          if (d.status === 'done') return {
            ...j, status:'done', progress:100, normProgress:100,
            downloadUrl:`${API}/download/file/${jobId}`, outFilename:d.filename,
          }
          if (d.status === 'error') return { ...j, status:'error', error:d.error }
          return {
            ...j, status:d.status,
            progress:d.progress ?? j.progress,
            normProgress:d.normalize_progress ?? j.normProgress,
            title: d.title || j.title,
          }
        })
      })
      return updated
    })
  }

  const allReady = items.every(it => it.info && it.selectedFormat)

  const _dispatchDownload = async (it) => {
    const res = await apiFetch(`${API}/download/batch`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        items: [{
          url:        it.url.trim(),
          format_id:  it.selectedFormat.format_id,
          session_id: user?.session_id || null,
        }]
      }),
    })
    const data = await res.json()
    if (res.ok && data.jobs?.length) {
      const j = data.jobs[0]
      return {
        jobId: j.job_id, url: j.url,
        title: it.info?.title || j.url,
        format: it.selectedFormat?.label || '',
        status:'queued', progress:0, normProgress:0,
        queue_position: j.queue_position,
        downloadUrl:null, outFilename:null, error:null,
      }
    }
    return null
  }

  const startAll = async () => {
    const readyItems = items.filter(it => it.info && it.selectedFormat)
    if (!readyItems.length) return

    setDlTotal(readyItems.length)
    setDlIndex(0)
    setDlCountdown(0)

    try {
      if (parallelFetch) {
        // PARALLEL MODE — send all download requests at once
        // Backend MAX_WORKERS controls how many normalize simultaneously
        setDlIndex(readyItems.length)
        const results = await Promise.allSettled(
          readyItems.map(it => _dispatchDownload(it))
        )
        const newJobs = results
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value)
        if (newJobs.length) {
          setJobs(prev => [...newJobs, ...prev])
          startPolling()
        }
      } else {
        // SEQUENTIAL MODE — send one download at a time with countdown
        const DELAY = 4000
        let allNewJobs = []
        for (let i = 0; i < readyItems.length; i++) {
          setDlIndex(i + 1)
          try {
            const newJob = await _dispatchDownload(readyItems[i])
            if (newJob) {
              allNewJobs = [newJob, ...allNewJobs]
              setJobs(prev => [newJob, ...prev])
              startPolling()
            }
          } catch (err) {
            console.error('Download dispatch failed:', err)
          }
          if (i < readyItems.length - 1) {
            let secs = Math.ceil(DELAY / 1000)
            setDlCountdown(secs)
            const timer = setInterval(() => {
              secs -= 1
              setDlCountdown(secs)
              if (secs <= 0) clearInterval(timer)
            }, 1000)
            await new Promise(r => setTimeout(r, DELAY))
            setDlCountdown(0)
          }
        }
      }
    } finally {
      setDlIndex(0)
      setDlTotal(0)
      setDlCountdown(0)
    }
  }

  const jobsRef = useRef([])
  // Keep jobsRef in sync with jobs state
  useEffect(() => { jobsRef.current = jobs }, [jobs])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      // Use ref to get latest jobs without stale closure
      const allCurrent = jobsRef.current
      const active = allCurrent.filter(j => !['done','error'].includes(j.status))

      // Stop polling when nothing active
      if (!active.length) {
        clearInterval(pollRef.current)
        pollRef.current = null
        return
      }

      // Fetch status for all active jobs
      const results = await Promise.allSettled(
        active.map(j => apiFetch(`${API}/download/status/${j.jobId}`).then(r => r.json()))
      )

      setJobs(prev => {
        let updated = [...prev]
        results.forEach((r, i) => {
          if (r.status !== 'fulfilled') return
          const d = r.value
          const jobId = active[i]?.jobId
          if (!jobId) return
          updated = updated.map(j => {
            if (j.jobId !== jobId) return j
            if (d.status === 'done') return {
              ...j, status:'done', progress:100, normProgress:100,
              downloadUrl:`${API}/download/file/${jobId}`,
              outFilename: d.filename,
            }
            if (d.status === 'error') return {
              ...j, status:'error', error: d.error,
            }
            return {
              ...j,
              status:         d.status,
              progress:       d.progress        ?? j.progress,
              normProgress:   d.normalize_progress ?? j.normProgress,
              queue_position: d.queue_position  ?? j.queue_position,
              title:          d.title           || j.title,
            }
          })
        })
        return updated
      })
    }, 800)
  }, [])

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), [])

  // Load admin token from backend on mount → sync with localStorage
  useEffect(() => {
    apiFetch(API + '/admin-token').then(r => r.json()).then(d => {
      if (d.token) {
        localStorage.setItem('yt_admin_token', d.token)
      } else {
        // Backend has no token — clear localStorage so first-time setup shows
        localStorage.removeItem('yt_admin_token')
      }
    }).catch(() => {})
  }, [])

  // Load BG from backend on mount
  useEffect(() => {
    apiFetch(API + '/bg').then(r => r.json()).then(d => {
      if (d.image) { setBgUrl(d.image); setBgBrightness(d.brightness || 30) }
    }).catch(() => {})
  }, [])

  // Backend health check
  useEffect(() => {
    const check = async () => {
      try {
        const r = await apiFetch(API + '/health', { signal: AbortSignal.timeout(4000) })
        setBackendOk(r.ok)
      } catch { setBackendOk(false) }
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  // Show completion popup only when ALL jobs are done (no queued/downloading/normalizing)
  const popupShownForCount = useRef(0)
  useEffect(() => {
    if (!jobs.length) return
    const active  = jobs.filter(j => !['done','error'].includes(j.status)).length
    const done    = jobs.filter(j => j.status === 'done').length
    const total   = jobs.length
    // Only show when ALL jobs finished AND we haven't shown for this batch yet
    if (active === 0 && done > 0 && total === done + jobs.filter(j=>j.status==='error').length) {
      if (popupShownForCount.current !== total) {
        popupShownForCount.current = total
        setTimeout(() => setShowCompletion(true), 800)
      }
    }
  }, [jobs])

  return (
    <div style={S.app}>
      {/* Background image layer */}
      {bgUrl && <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, backgroundImage:`url(${bgUrl})`, backgroundSize:'cover', backgroundPosition:'center', opacity: bgBrightness/100 }} />}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />

      <QueueBadge jobs={jobs} />

      <div style={S.wrap}>
        {/* Header */}
        <header style={{ textAlign:'center', padding:'60px 0 28px', position:'relative' }}>
          <div style={{ position:'absolute', top:12, right:0, display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={() => setShowBackendConfig(true)} style={{
              background: backendOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${backendOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius:8, color: backendOk ? '#10b981' : '#ef4444', fontSize:12, fontWeight:600,
              padding:'7px 12px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
            }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background: backendOk ? '#10b981' : '#ef4444', display:'inline-block' }} />
              {localStorage.getItem('yt_backend_locked') === 'true' ? '🔒' : '🔌'} Backend
            </button>
            <button onClick={() => setShowBgPanel(v => !v)} style={{
              background: bgUrl ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: bgUrl ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius:8, color: bgUrl ? '#a78bfa' : '#666', fontSize:12, fontWeight:600,
              padding:'7px 12px', cursor:'pointer', fontFamily:'inherit',
            }}>🖼 BG</button>
            <button onClick={() => setShowAdmin(true)} style={{
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8, color:'#666', fontSize:12, fontWeight:600,
              padding:'7px 12px', cursor:'pointer', fontFamily:'inherit',
            }}>🔧 Admin</button>
            {user ? (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <UserAvatar user={user} onLogout={logout} />
              </div>
            ) : (
              <GoogleLoginButton onLogin={() => {}} />
            )}
          </div>
          {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

          {/* BG Image Panel */}
          {showBgPanel && (
            <div style={{ position:'fixed', top:60, right:16, zIndex:300, background:'rgba(15,15,25,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:16, width:280, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#e8e8f0' }}>🖼 Background Image</span>
                <button onClick={() => setShowBgPanel(false)} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:14 }}>✕</button>
              </div>
              <input ref={bgInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                const file = e.target.files?.[0]; if (!file) return
                const reader = new FileReader()
                reader.onload = async ev => {
                  const dataUrl = ev.target.result
                  setBgUrl(dataUrl); setBgSaving(true)
                  try {
                    await apiFetch(API + '/bg', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: dataUrl, brightness: bgBrightness }) })
                  } catch {}
                  setBgSaving(false)
                }
                reader.readAsDataURL(file); e.target.value = ''
              }} />
              <button onClick={() => bgInputRef.current?.click()} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px dashed rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.03)', color:'#888', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:12 }}>
                {bgSaving ? '💾 Saving…' : bgUrl ? '📁 Change image' : '📁 Upload image'}
              </button>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#666' }}>Brightness / Opacity</span>
                  <span style={{ fontSize:11, color:'#a78bfa', fontFamily:'monospace' }}>{bgBrightness}%</span>
                </div>
                <input type="range" min={5} max={100} value={bgBrightness} onChange={e => {
                  const v = Number(e.target.value); setBgBrightness(v)
                  if (bgUrl) apiFetch(API + '/bg', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: bgUrl, brightness: v }) }).catch(()=>{})
                }} style={{ width:'100%', accentColor:'#8b5cf6' }} />
              </div>
              {bgUrl && <button onClick={async () => { setBgUrl(''); setBgBrightness(30); try { await apiFetch(API + '/bg', { method:'DELETE' }) } catch {} }}
                style={{ width:'100%', padding:'6px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                ✕ Remove background
              </button>}
            </div>
          )}
          {showBackendConfig && <BackendConfig onClose={() => setShowBackendConfig(false)} />}

          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>▼</div>
            <span style={{ fontSize:19, fontWeight:700, letterSpacing:'-0.4px' }}>YT Downloader</span>
          </div>

          <h1 style={{ fontSize:32, fontWeight:700, margin:'0 0 8px', letterSpacing:'-1.2px', lineHeight:1.15 }}>
            Batch Download &amp; Normalize<br />
            <span style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              YouTube Videos in Parallel
            </span>
          </h1>

          <p style={{ fontSize:14, color:'#666', margin:'0 0 10px' }}>
            Add URLs → Fetch All → Download simultaneously → ffmpeg normalize
          </p>

          {user ? (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:100, padding:'4px 14px', fontSize:12, color:'#10b981' }}>
                ✓ Signed in as <strong>{user.email}</strong>
              </div>
              <button onClick={() => setShowCookieSetup(v => !v)} style={{
                display:'inline-flex', alignItems:'center', gap:5,
                background: showCookieSetup ? 'rgba(139,92,246,0.2)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${showCookieSetup ? 'rgba(139,92,246,0.4)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius:100, padding:'4px 14px', fontSize:12,
                color: showCookieSetup ? '#a78bfa' : '#f59e0b',
                cursor:'pointer', fontFamily:'inherit', fontWeight:500,
              }}>
                🍪 {showCookieSetup ? 'Hide cookie setup' : 'Setup age-restricted downloads'}
              </button>
            </div>
          ) : (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:100, padding:'4px 14px', fontSize:12, color:'#f59e0b' }}>
              🔒 Sign in with Google to download age-restricted videos
            </div>
          )}

          <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:100, padding:'4px 14px', fontSize:11, color:'#555', ...S.mono }}>
            <span style={{ color:'#8b5cf6' }}>yt-dlp</span> → <span style={{ color:'#3b82f6' }}>libx264 · crf 19 · forced-idr 1</span> → <span style={{ color:'#10b981' }}>_normalize.mp4</span>
          </div>
        </header>

        {/* Cookie setup panel */}
        {user && showCookieSetup && (
          <CookieSetup
            sessionId={user.session_id}
            onDone={() => setShowCookieSetup(false)}
            onClose={() => setShowCookieSetup(false)}
          />
        )}

        {showCompletion && (
          <CompletionPopup
            jobs={jobs}
            onClose={() => setShowCompletion(false)}
          />
        )}

        {/* URL inputs */}
        <div style={{ ...S.card, padding:16, display:'flex', flexDirection:'column', gap:12, marginBottom:12 }}>
          {items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginBottom:12 }} />}
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <span style={{ fontSize:10, color:'#444', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:5, padding:'1px 7px', ...S.mono }}>#{i+1}</span>
              </div>
              <UrlRow
                item={item}
                onChange={(key, val) => updateItem(item.id, key, val)}
                onRemove={() => removeItem(item.id)}
                canRemove={items.length > 1}
              />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10, marginBottom:32, flexWrap:'wrap' }}>
          <input
            ref={fileInputRef} type="file" accept=".json,.csv"
            onChange={importUrls}
            style={{ display:'none' }}
          />
          {showSearch && (
            <SearchPanel
              onAddUrl={addUrlFromSearch}
              onClose={() => setShowSearch(false)}
            />
          )}
          <button onClick={() => setShowSearch(true)} style={{
            flex:'0 0 auto', padding:'11px 18px', borderRadius:10,
            border:'1px solid rgba(139,92,246,0.3)',
            background:'rgba(139,92,246,0.1)', color:'#a78bfa',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>🔎 Search YouTube</button>
          <button onClick={addItem} style={{
            flex:'0 0 auto', padding:'11px 18px', borderRadius:10,
            border:'1px dashed rgba(255,255,255,0.15)',
            background:'rgba(255,255,255,0.02)', color:'#666',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>+ Add URL</button>

          <button onClick={() => fileInputRef.current?.click()} style={{
            flex:'0 0 auto', padding:'11px 18px', borderRadius:10,
            border:'1px dashed rgba(99,102,241,0.3)',
            background:'rgba(99,102,241,0.06)', color:'#818cf8',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:6,
          }}>
            ↑ Import JSON/CSV
          </button>

          {/* Parallel/Sequential toggle */}
          <button
            onClick={() => setParallelFetch(v => !v)}
            title={parallelFetch ? 'Parallel mode — click to switch to Sequential' : 'Sequential mode — click to switch to Parallel'}
            style={{
              flex:'0 0 auto', padding:'11px 14px', borderRadius:10,
              border: parallelFetch
                ? '1px solid rgba(245,158,11,0.4)'
                : '1px solid rgba(99,102,241,0.3)',
              background: parallelFetch
                ? 'rgba(245,158,11,0.08)'
                : 'rgba(99,102,241,0.08)',
              color: parallelFetch ? '#f59e0b' : '#818cf8',
              fontSize:11, fontWeight:700, cursor:'pointer',
              fontFamily:'inherit', whiteSpace:'nowrap',
            }}
          >
            {parallelFetch ? '⚡ Parallel' : '↕ Sequential'}
          </button>

          <button onClick={fetchAll} disabled={fetchingAll || !items.some(it=>it.url.trim()&&!it.info)} style={{
            ...S.btn(!fetchingAll && items.some(it=>it.url.trim()&&!it.info)), flex:1,
          }}>
            {fetchingAll
              ? parallelFetch
                ? `⏳ Fetching all ${fetchTotal} in parallel…`
                : `⏳ Fetching ${fetchIndex}/${fetchTotal}…`
              : `🔍 Fetch All (${items.filter(it=>it.url.trim()&&!it.info).length} pending)`}
          </button>

          <button
            onClick={startAll}
            disabled={dlTotal > 0 || !items.some(it=>it.info && it.selectedFormat)}
            style={{
              ...S.btn((allReady && items.some(it=>it.info) && dlTotal === 0), '#10b981'),
              flex:1, position:'relative', overflow:'hidden',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
          >
            {dlTotal > 0 ? (
              <>
                {/* Animated fill bar */}
                <div style={{
                  position:'absolute', inset:0, zIndex:0,
                  background:'rgba(0,0,0,0.25)',
                  width: dlCountdown > 0
                    ? `${((4 - dlCountdown) / 4) * 100}%`
                    : '100%',
                  transition:'width 1s linear',
                  borderRadius:10,
                }} />
                {parallelFetch ? (
                  <span style={{ position:'relative', zIndex:1, fontSize:13, fontWeight:700 }}>
                    ⚡ Sending all {dlTotal} in parallel…
                  </span>
                ) : dlCountdown > 0 ? (
                  <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:8 }}>
                    <svg width={28} height={28} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
                      <circle cx={14} cy={14} r={11} fill="none"
                        stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
                      <circle cx={14} cy={14} r={11} fill="none"
                        stroke="#fff" strokeWidth={2.5}
                        strokeDasharray={69.1}
                        strokeDashoffset={69.1 - (69.1 * (4 - dlCountdown) / 4)}
                        strokeLinecap="round"
                        style={{ transition:'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <span style={{ fontSize:13, fontWeight:700 }}>
                      Next in {dlCountdown}s · {dlIndex}/{dlTotal}
                    </span>
                  </div>
                ) : (
                  <span style={{ position:'relative', zIndex:1, fontSize:13, fontWeight:700 }}>
                    ↓ Sending {dlIndex}/{dlTotal}…
                  </span>
                )}
              </>
            ) : (
              <>⚡ Download All ({items.filter(it=>it.info&&it.selectedFormat).length})</>
            )}
          </button>

          {jobs.length > 0 && (
            <button onClick={refreshJobs} style={{
              flex:'0 0 auto', padding:'11px 16px', borderRadius:10,
              border:'1px solid rgba(99,102,241,0.3)',
              background:'rgba(99,102,241,0.08)', color:'#818cf8',
              fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              title:'Refresh download statuses',
            }}>↻</button>
          )}
        </div>

        {/* Jobs */}
        {jobs.length > 0 && (
          <div>
            {/* Downloads header with Refresh button */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:12, color:'#444', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase' }}>Downloads</div>
              <button onClick={refreshJobs} style={{
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:6, color:'#aaa', fontSize:11, fontWeight:600,
                padding:'4px 12px', cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', gap:4,
              }}>↻ Refresh</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {jobs.map(job => <JobCard key={job.jobId} job={job} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {jobs.length === 0 && (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { icon:'🔑', color:'#f59e0b', title:'Google SSO',         desc:'Sign in to download age-restricted videos' },
              { icon:'⚡', color:'#8b5cf6', title:'Parallel downloads', desc:'All URLs process simultaneously' },
              { icon:'▶', color:'#3b82f6', title:'ffmpeg normalize',    desc:'libx264 · crf 19 · forced-idr 1' },
              { icon:'🔒', color:'#10b981', title:'Fully local',        desc:'Files saved on your server' },
            ].map(f => (
              <div key={f.title} style={{ flex:'1 1 180px', ...S.card, padding:'14px' }}>
                <div style={{ width:30, height:30, borderRadius:8, background:`${f.color}18`, border:`1px solid ${f.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, marginBottom:8, color:f.color }}>{f.icon}</div>
                <p style={{ margin:'0 0 3px', fontWeight:600, fontSize:13 }}>{f.title}</p>
                <p style={{ margin:0, fontSize:12, color:'#555' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
