import { useState, useRef, useCallback, useEffect } from 'react'
import AdminPanel   from './AdminPanel.jsx'
import HealthPanel   from './HealthPanel.jsx'
import ChannelPanel  from './ChannelPanel.jsx'
import CookieSetup from './CookieSetup.jsx'
import SearchPanel from './SearchPanel.jsx'

// v3.0.0
const API_DEFAULT = import.meta.env.VITE_API_URL || '/api'
function getApiBase() { return localStorage.getItem('yt_api_base') || API_DEFAULT }

// ── Poll intervals — loaded from backend /config on startup ───────────────────
// Defaults used until /config responds
const _pollDefaults = { active: 2000, idle: 30000, download: 800 }
let _pollCfg = { ..._pollDefaults }
function getPollMs(key) { return _pollCfg[key] || _pollDefaults[key] }
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '406747955382-digauab6tpgo7f9rr7sbl0qoajc01oub.apps.googleusercontent.com'
const REDIRECT_URI = window.location.origin

function apiFetch(url, options = {}) {
  const base = getApiBase()
  const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? url : '/' + url}`
  return fetch(fullUrl, {
    ...options,
    headers: {
      'bypass-tunnel-reminder':    'true',
      'ngrok-skip-browser-warning':'true',
      ...options.headers,
    },
  })
}

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
  queued:      { label:'Queued',      color:'#f59e0b', icon:'⏳' },
  downloading: { label:'Downloading', color:'#8b5cf6', icon:'↓'  },
  processing:  { label:'Merging',     color:'#f59e0b', icon:'⚙'  },
  normalizing: { label:'Normalizing', color:'#3b82f6', icon:'▶'  },
  done:        { label:'Done',        color:'#10b981', icon:'✓'  },
  error:       { label:'Error',       color:'#ef4444', icon:'✗'  },
}

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  pu3:'#7F77DD', pu2:'#AFA9EC', pu4:'#534AB7',
  te3:'#1D9E75', te2:'#5DCAA5',
  am3:'#BA7517',
  bg: '#141420',
  card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14 },
  mono: { fontFamily:"'JetBrains Mono',monospace" },
  pill: (c) => ({ fontSize:11, color:c, background:`${c}22`, border:`1px solid ${c}44`, borderRadius:100, padding:'2px 9px', fontWeight:600 }),
}

// ── PRESETS ────────────────────────────────────────────────────────────────
const PRESETS = [
  { id:'fast',     label:'⚡ Fast',         desc:'Copy — no re-encode',       flags:'-c:v copy -c:a copy -c:s copy',                            pill:'copy' },
  { id:'balanced', label:'⚖️ Balanced',     desc:'H.264 CRF 23',              flags:'-c:v libx264 -crf 23 -preset medium -c:a copy -c:s copy',  pill:'libx264 · crf 23' },
  { id:'hq',       label:'🎬 High quality', desc:'H.264 CRF 19 + forced IDR', flags:'-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy',  pill:'libx264 · crf 19' },
  { id:'hq265',    label:'💎 H.265',        desc:'HEVC CRF 24 — smaller',     flags:'-c:v libx265 -crf 24 -preset medium -c:a copy -c:s copy',  pill:'libx265 · crf 24' },
  { id:'delogo',   label:'🔲 Remove watermark', desc:'delogo filter — blurs watermark region', flags:'-c:v libx264 -crf 19 -forced-idr 1 -vf "delogo=x=10:y=10:w=200:h=50:show=0" -c:a copy', pill:'delogo' },
  { id:'custom',   label:'✏️ Custom',       desc:'Your own ffmpeg flags',      flags:'',                                                          pill:'custom' },
]
// ── OUTPUT FORMAT ENUM ─────────────────────────────────────────────────────
// To add more formats in future: just add a new entry here. It auto-appears in the dropdown.
const OUTPUT_FORMAT_ENUM = {
  same: { label:'Same as source', desc:'Output matches input extension' },
  mp4:  { label:'.mp4',           desc:'H.264/HEVC — most compatible' },
  ts:   { label:'.ts',            desc:'MPEG Transport Stream' },
  mkv:  { label:'.mkv',           desc:'Matroska — best subtitle support' },
  mov:  { label:'.mov',           desc:'Apple QuickTime' },
  mxf:  { label:'.mxf',           desc:'Material Exchange Format (broadcast)' },
  mts:  { label:'.mts',           desc:'AVCHD Transport Stream' },
  m2ts: { label:'.m2ts',          desc:'Blu-ray Transport Stream' },
  avi:  { label:'.avi',           desc:'Audio Video Interleave (legacy)' },
  wmv:  { label:'.wmv',           desc:'Windows Media Video' },
  flv:  { label:'.flv',           desc:'Flash Video' },
  webm: { label:'.webm',          desc:'Open web format (VP8/VP9)' },
  mpg:  { label:'.mpg',           desc:'MPEG-1/2 Program Stream' },
  '3gp':{ label:'.3gp',           desc:'Mobile video (3GPP)' },
  ogv:  { label:'.ogv',           desc:'Ogg Video' },
  divx: { label:'.divx',          desc:'DivX container' },
  f4v:  { label:'.f4v',           desc:'Flash MP4 Video' },
  rm:   { label:'.rm',            desc:'RealMedia' },
  asf:  { label:'.asf',           desc:'Advanced Systems Format' },
  dv:   { label:'.dv',            desc:'Digital Video (DV camcorder)' },
  qt:   { label:'.qt',            desc:'QuickTime (alias for .mov)' },
}
// Derived array for rendering — do NOT edit this line
const OUTPUT_FORMATS = Object.entries(OUTPUT_FORMAT_ENUM).map(([ext, v]) => ({ ext, ...v }))

// ── FormatDropdown ─────────────────────────────────────────────────────────
function FormatDropdown({ value, onChange }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const selected = OUTPUT_FORMAT_ENUM[value] || OUTPUT_FORMAT_ENUM['same']
  const filtered = OUTPUT_FORMATS.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.ext.toLowerCase().includes(search.toLowerCase()) ||
    f.desc.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isSame = value === 'same' || !value

  return (
    <div ref={ref} style={{ position:'relative', minWidth:200 }}>
      {/* Trigger */}
      <button onClick={() => { setOpen(v=>!v); setSearch('') }} style={{
        display:'flex', alignItems:'center', gap:8, width:'100%',
        background: isSame ? 'rgba(127,119,221,0.15)' : 'rgba(29,158,117,0.15)',
        border: isSame ? '1px solid rgba(127,119,221,0.4)' : '1px solid rgba(29,158,117,0.4)',
        borderRadius:9, padding:'8px 12px', cursor:'pointer', fontFamily:'inherit',
        transition:'all .15s',
      }}>
        <span style={{ fontSize:13, fontWeight:700, color: isSame ? T.pu2 : T.te2, ...T.mono, flex:1, textAlign:'left' }}>
          {selected.label}
        </span>
        <span style={{ fontSize:11, color: isSame ? T.pu2 : T.te2, opacity:0.7 }}>{selected.desc}</span>
        <span style={{ fontSize:12, color: isSame ? T.pu2 : T.te2, marginLeft:4, transform:open?'rotate(180deg)':'rotate(0)', transition:'transform .2s', display:'inline-block' }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:200,
          background:'#0f0f1e', border:'1px solid rgba(127,119,221,0.3)',
          borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          overflow:'hidden',
        }}>
          {/* Search */}
          <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search format… (mp4, mxf, ts…)"
              style={{
                width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:7, padding:'7px 10px', fontSize:12, color:'#e8e8f0',
                outline:'none', fontFamily:'inherit', boxSizing:'border-box',
              }}
            />
          </div>
          {/* Options */}
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding:'12px 14px', fontSize:12, color:'#555', textAlign:'center' }}>No formats found</div>
            )}
            {filtered.map(f => {
              const active = value === f.ext || (!value && f.ext === 'same')
              const isSameOpt = f.ext === 'same'
              return (
                <div key={f.ext} onClick={() => { onChange(f.ext); setOpen(false); setSearch('') }} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer',
                  background: active ? (isSameOpt?'rgba(127,119,221,0.15)':'rgba(29,158,117,0.12)') : 'transparent',
                  borderLeft: active ? `3px solid ${isSameOpt?T.pu3:T.te3}` : '3px solid transparent',
                  transition:'background .1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent' }}
                >
                  <span style={{ fontSize:12, fontWeight:700, color: active?(isSameOpt?T.pu2:T.te2):'#e2e2f0', ...T.mono, minWidth:52 }}>{f.label}</span>
                  <span style={{ fontSize:11, color:'#555', flex:1 }}>{f.desc}</span>
                  {active && <span style={{ fontSize:11, color:isSameOpt?T.pu2:T.te2 }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Google SVG ─────────────────────────────────────────────────────────────
const GoogleSVG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

// ── UserAvatar ─────────────────────────────────────────────────────────────
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
          ? <img src={user.picture} alt="" style={{ width:26, height:26, borderRadius:'50%' }} />
          : <div style={{ width:26, height:26, borderRadius:'50%', background:T.pu4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff' }}>{user.name?.[0]||'?'}</div>
        }
        <span style={{ fontSize:12, color:'#e8e8f0', fontWeight:500 }}>{user.name || user.email}</span>
        <span style={{ color:'#555', fontSize:10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:8, minWidth:180, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
          <p style={{ margin:'0 0 4px', fontSize:13, color:'#e8e8f0', padding:'4px 10px' }}>{user.name}</p>
          <p style={{ margin:'0 0 8px', fontSize:11, color:'#555', padding:'0 10px' }}>{user.email}</p>
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'4px 0' }} />
          <button onClick={() => { setOpen(false); onLogout() }} style={{ width:'100%', padding:'8px 10px', background:'none', border:'none', color:'#f87171', fontSize:13, cursor:'pointer', textAlign:'left', fontFamily:'inherit', borderRadius:6 }}>Sign out</button>
        </div>
      )}
    </div>
  )
}

// ── MiniBar ────────────────────────────────────────────────────────────────
function MiniBar({ pct, color, label, show }) {
  if (!show) return null
  return (
    <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:10, color, fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:10, color:'#444', ...T.mono }}>{pct}%</span>
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:3 }}>
        <div style={{ height:'100%', borderRadius:100, background:color, width:`${pct}%`, transition:'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── qualityColor ───────────────────────────────────────────────────────────
function qualityColor(label) {
  if (!label) return '#555'
  if (label.includes('4K'))      return '#f59e0b'
  if (label.includes('2K'))      return '#a78bfa'
  if (label.includes('Full HD')) return '#8b5cf6'
  if (label.includes('HD'))      return '#3b82f6'
  if (label.includes('Best'))    return '#10b981'
  return '#555'
}

// ── FormatPicker ───────────────────────────────────────────────────────────
function FormatPicker({ info, selected, onSelect }) {
  const [tab, setTab] = useState('video')
  const allFormats = info?.formats || []
  const formats = allFormats.filter(f => tab === 'video' ? f.type === 'video' : f.type === 'audio')
  const videoCount = allFormats.filter(f => f.type === 'video').length
  const audioCount = allFormats.filter(f => f.type === 'audio').length
  return (
    <div style={{ ...T.card, overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        {[{key:'video',label:`🎬 Video (${videoCount})`},{key:'audio',label:`🎵 Audio (${audioCount})`}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:'10px', background:tab===t.key?'rgba(139,92,246,0.1)':'none',
            border:'none', borderBottom:tab===t.key?'2px solid #8b5cf6':'2px solid transparent',
            color:tab===t.key?'#a78bfa':'#555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
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
              display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer',
              background:sel?'rgba(139,92,246,0.14)':isBest?'rgba(16,185,129,0.05)':'rgba(255,255,255,0.02)',
              border:sel?'1px solid rgba(139,92,246,0.4)':isBest?'1px solid rgba(16,185,129,0.2)':'1px solid transparent',
            }}>
              <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, border:`2px solid ${sel?'#8b5cf6':'#444'}`, background:sel?'#8b5cf6':'none' }} />
              <span style={{ flex:1, fontSize:13, fontWeight:sel?600:400, color:sel?'#e8e8f0':'#ccc' }}>{fmt.label}</span>
              <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                {fmt.quality && !isBest && <span style={{ fontSize:10, fontWeight:700, color:qColor, background:`${qColor}22`, border:`1px solid ${qColor}44`, borderRadius:4, padding:'1px 6px' }}>{fmt.quality}</span>}
                {fmt.filesize && <span style={{ ...T.mono, fontSize:10, color:'#444', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:4 }}>{formatSize(fmt.filesize)}</span>}
              </div>
            </div>
          )
        })}
        {formats.length === 0 && <p style={{ fontSize:12, color:'#444', textAlign:'center', padding:16, margin:0 }}>No {tab} formats</p>}
      </div>
    </div>
  )
}

// ── UrlRow ─────────────────────────────────────────────────────────────────
function UrlRow({ item, onChange, onRemove, canRemove, onOpenChannel }) {
  const { url, info, error, fetchStatus, fetchPct, fetchStart } = item
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (fetchStatus !== 'fetching') { setElapsed(0); return }
    const t = setInterval(() => { setElapsed(fetchStart ? ((Date.now()-fetchStart)/1000).toFixed(1) : 0) }, 100)
    return () => clearInterval(t)
  }, [fetchStatus, fetchStart])
  const valid = isValidYT(url)
  const isFetching = fetchStatus === 'fetching'
  const needsLogin = error?.includes('LOGIN_REQUIRED') || error?.includes('sign-in') || error?.includes('Sign in') || error?.includes('🔒') || error?.includes('🔞')
  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ ...T.card, display:'flex', alignItems:'center', gap:8, padding:'6px 6px 6px 14px', borderColor:error?'rgba(239,68,68,0.35)':info?'rgba(16,185,129,0.35)':valid?'rgba(139,92,246,0.25)':'rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize:15, flexShrink:0 }}>🔗</span>
          <input value={url} onChange={e => onChange('url', e.target.value)}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text').trim()
              if (pasted.includes('list=') || pasted.includes('/playlist?')) {
                e.preventDefault()
                if (typeof onOpenChannel === 'function') onOpenChannel(pasted)
              }
            }}
            placeholder="https://youtube.com/watch?v=..."
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:16, color:'#f0f0ff', fontFamily:'inherit', padding:'11px 0' }} />
          {isFetching && <span style={{ ...T.pill('#8b5cf6'), flexShrink:0 }}>fetching…</span>}
          {fetchStatus==='done' && !error && <span style={{ ...T.pill('#10b981'), flexShrink:0 }}>✓ ready</span>}
          {fetchStatus==='error' && needsLogin && <span style={{ ...T.pill('#f59e0b'), flexShrink:0 }}>🔒 login required</span>}
          {fetchStatus==='error' && !needsLogin && <span style={{ ...T.pill('#ef4444'), flexShrink:0 }}>✗ unavailable</span>}
        </div>
        <MiniBar pct={fetchPct||0} color={error?'#ef4444':'#8b5cf6'}
          label={isFetching?`⏳ Fetching… ${elapsed}s`:fetchStatus==='done'?`✓ Fetch complete${item.fetchTime?` · ${item.fetchTime}s`:''}`:fetchStatus==='error'?`${needsLogin?'🔒 Login required':'✗ Unavailable'}${item.fetchTime?` · ${item.fetchTime}s`:'`'}`:'' }
          show={!!fetchStatus} />
        {info && (
          <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)' }}>
            <img src={info.thumbnail} alt="" style={{ width:72, height:42, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
            <div style={{ minWidth:0, flex:1 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{info.title}</p>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                <span style={{ fontSize:12, color:'#aaa', fontWeight:500 }}>{info.uploader}</span>
                {info.duration && <span style={{ fontSize:11, color:'#10b981', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:4, padding:'1px 6px', fontWeight:600, ...T.mono }}>{formatDuration(info.duration)}</span>}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div style={{ fontSize:12, background:needsLogin?'rgba(245,158,11,0.07)':'rgba(239,68,68,0.07)', border:`1px solid ${needsLogin?'rgba(245,158,11,0.25)':'rgba(239,68,68,0.2)'}`, borderRadius:8, padding:'10px 12px' }}>
            {needsLogin ? <p style={{ margin:0, color:'#f59e0b', fontSize:12 }}>{error}</p>
              : error?.includes('Failed to fetch') || error?.includes('NetworkError') ? <p style={{ margin:0, color:'#f87171', fontSize:12 }}>🔌 Backend unreachable. Check server and tunnel.</p>
              : error?.includes('rate limit') ? <p style={{ margin:0, color:'#f59e0b', fontSize:12 }}>⏱ YouTube rate limited. Wait 1 hour.</p>
              : <p style={{ margin:0, color:'#f87171', fontSize:12 }}>{error}</p>}
          </div>
        )}
        {info && <FormatPicker info={info} selected={item.selectedFormat} onSelect={fmt => onChange('selectedFormat', fmt)} />}
      </div>
      {canRemove && (
        <button onClick={onRemove} style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>×</button>
      )}
    </div>
  )
}

// ── CircleProgress ─────────────────────────────────────────────────────────
function CircleProgress({ pct, color, size=44, stroke=3, label, done, cancelled, onCancel }) {
  const [hovered, setHovered] = useState(false)
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = cancelled ? circ : circ - (pct / 100) * circ
  const ringColor = cancelled ? '#ef4444' : done ? '#10b981' : color

  // Show cancel X on hover when active (not done/cancelled/error)
  const showCancel = onCancel && !done && !cancelled && hovered

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
      <div
        style={{ position:'relative', width:size, height:size, cursor: onCancel && !done && !cancelled ? 'pointer' : 'default' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (showCancel && onCancel) onCancel() }}
        title={showCancel ? 'Click to cancel' : undefined}
      >
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={showCancel ? '#ef4444' : ringColor} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition:'stroke-dashoffset 0.4s ease, stroke 0.15s' }} />
        </svg>
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: showCancel ? 13 : 10, fontWeight:700,
          color: showCancel ? '#ef4444' : cancelled ? '#ef4444' : done ? '#10b981' : color,
          ...T.mono, transition:'color 0.15s',
        }}>
          {showCancel ? '✕' : cancelled ? '−' : done ? '✓' : `${pct}%`}
        </div>
      </div>
      <span style={{ fontSize:9, color: cancelled ? '#ef4444' : '#555', fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>
        {cancelled ? 'CANCEL' : label}
      </span>
    </div>
  )
}

// ── JobCard ────────────────────────────────────────────────────────────────
function _eta(startedAt, pct) {
  if (!startedAt || pct <= 0 || pct >= 100) return null
  const elapsed = (Date.now() / 1000) - startedAt
  if (elapsed < 3) return null  // not enough data yet
  const total    = elapsed / (pct / 100)
  const remaining= Math.max(0, total - elapsed)
  if (remaining > 86400) return null  // unreasonable
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = Math.floor(remaining % 60)
  if (h > 0) return `~${h}h ${m}m left`
  if (m > 0) return `~${m}m ${s}s left`
  return `~${s}s left`
}

function JobCard({ job }) {
  const meta = PHASE[job.status] || PHASE.queued
  const isQ   = job.status==='queued'
  const isDl  = job.status==='downloading'||job.status==='processing'
  const isNorm= job.status==='normalizing'
  const isDone= job.status==='done'
  const isErr = job.status==='error'
  const isCancelled = isErr && job.error==='Cancelled by user'
  const isActive = !isQ && !isDone && !isErr

  const dlPct   = isDl ? job.progress : (isDone||isNorm) ? 100 : 0
  const normPct = isNorm ? job.normProgress : isDone ? 100 : 0

  // ETA calculations
  const dlEta   = isDl   ? _eta(job.started_at,      dlPct)   : null
  const normEta = isNorm ? _eta(job.norm_started_at,  normPct) : null
  const eta     = normEta || dlEta

  // Cancel handler — passed to both rings so either can cancel
  const handleCancel = job.onCancel ? () => job.onCancel(job.jobId) : null

  return (
    <div style={{ ...T.card, padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:`${meta.color}22`, border:`1.5px solid ${meta.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:meta.color, flexShrink:0 }}>{meta.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{job.title||job.url||'…'}</p>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200, ...T.mono }}>{(job.url||'').replace('https://www.youtube.com/watch?v=','yt:')}</span>
            <span style={{ fontSize:10, color:meta.color, background:`${meta.color}18`, border:`1px solid ${meta.color}33`, borderRadius:100, padding:'1px 7px', fontWeight:600, flexShrink:0 }}>{isQ&&job.queue_position>0?`#${job.queue_position+1} queued`:meta.label}</span>
            {eta && <span style={{ fontSize:10, color:'#f59e0b', fontFamily:'monospace', flexShrink:0 }}>⏱ {eta}</span>}
            {isDl   && dlPct   > 0 && <span style={{ fontSize:10, color:'#8b5cf6', fontFamily:'monospace' }}>DL {dlPct}%</span>}
            {isNorm && normPct > 0 && <span style={{ fontSize:10, color:'#3b82f6', fontFamily:'monospace' }}>NRM {normPct}%</span>}
          </div>
        </div>

        {/* Progress rings — cancel on hover */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {/* Cancel button for queued jobs */}
          {isQ && handleCancel && (
            <button
              onClick={handleCancel}
              title="Cancel queued job"
              style={{
                width:44, height:44, borderRadius:'50%', border:'1.5px solid rgba(239,68,68,0.4)',
                background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:14,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, transition:'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.4)' }}
            >✕</button>
          )}
          {!isQ && !isErr && (
            <CircleProgress
              pct={dlPct} color='#8b5cf6' size={44} stroke={3} label="DL"
              done={dlPct===100} cancelled={isCancelled}
              onCancel={isActive ? handleCancel : null}
            />
          )}
          {!isQ && !isErr && !isDl && (
            <CircleProgress
              pct={normPct} color='#3b82f6' size={44} stroke={3} label="NRM"
              done={normPct===100} cancelled={isCancelled}
              onCancel={isNorm ? handleCancel : null}
            />
          )}
          {isDone&&job.downloadUrl && (
            <a href={job.downloadUrl} download style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#34d399', fontSize:12, fontWeight:700, padding:'6px 14px', textDecoration:'none' }}>↓ Save</a>
          )}
        </div>
      </div>

      {isDone&&job.outFilename && (
        <div style={{ marginTop:8, fontSize:10, color:'#10b981', ...T.mono, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:5, padding:'3px 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✓ {job.outFilename}</div>
      )}
      {isErr&&job.error && (
        <p style={{ margin:'8px 0 0', fontSize:11, color:'#f87171', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6, padding:'6px 10px' }}>{job.error}</p>
      )}

      {/* Actions after completion */}
      {(isErr && !isCancelled) && (
        <div style={{ display:'flex', gap:5, marginTop:6 }}>
          <button onClick={()=>job.onDelete&&job.onDelete(job.jobId,false)} style={{ fontSize:10, padding:'3px 9px', borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#888', cursor:'pointer', fontFamily:'inherit' }}>✕ Remove</button>
        </div>
      )}
      {isDone && job.outFilename && (
        <div style={{ display:'flex', gap:5, marginTop:6 }}>
          <button onClick={()=>job.onDelete&&job.onDelete(job.jobId,true)} style={{ fontSize:10, padding:'3px 9px', borderRadius:5, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#f87171', cursor:'pointer', fontFamily:'inherit' }}>🗑 Delete file</button>
        </div>
      )}
    </div>
  )
}

// ── QueueBadge ─────────────────────────────────────────────────────────────
function QueueBadge({ jobs, queueStatus }) {
  const active = jobs.filter(j=>!['done','error','queued'].includes(j.status)).length
  const done   = jobs.filter(j=>j.status==='done').length
  const failed = jobs.filter(j=>j.status==='error').length
  const total  = jobs.length

  // Use real executor queue depth if available, fall back to UI count
  const realPending  = queueStatus?.real_pending  ?? jobs.filter(j=>j.status==='queued').length
  const freeWorkers  = queueStatus?.free_workers  ?? 0
  const maxWorkers   = queueStatus?.max_workers   ?? 2

  if (total === 0 && !queueStatus) return null
  if (total === 0 && realPending === 0) return null

  return (
    <div style={{ position:'fixed', top:16, right:16, zIndex:100, background:'rgba(10,10,20,0.92)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'10px 16px', backdropFilter:'blur(12px)', display:'flex', flexDirection:'column', gap:6, minWidth:180, boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, color:'#555', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase' }}>Queue</div>
        <div style={{ fontSize:10, color:'#444', ...T.mono }}>{freeWorkers}/{maxWorkers} free</div>
      </div>
      {[
        { label:'Running',  val:active,      color:'#8b5cf6' },
        { label:'Pending',  val:realPending, color:'#f59e0b', real:true },
        { label:'Done',     val:done,        color:'#10b981' },
        { label:'Failed',   val:failed,      color:'#ef4444' },
      ].map(r => r.val > 0 && (
        <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:12, color:'#8888aa' }}>{r.label}</span>
            {r.real && <span style={{ fontSize:9, color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:3, padding:'1px 4px' }}>REAL</span>}
          </div>
          <span style={{ ...T.mono, fontSize:13, fontWeight:700, color:r.color, background:`${r.color}18`, border:`1px solid ${r.color}33`, borderRadius:6, padding:'1px 8px' }}>{r.val}</span>
        </div>
      ))}
      {total > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:3 }}>
            <div style={{ height:'100%', borderRadius:100, background:'linear-gradient(90deg,#8b5cf6,#10b981)', width:`${Math.round((done/total)*100)}%`, transition:'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize:10, color:'#444', textAlign:'right', marginTop:3, ...T.mono }}>{done}/{total} done</div>
        </div>
      )}
    </div>
  )
}

// ── parseImportedUrls ──────────────────────────────────────────────────────
function parseImportedUrls(text, fileType) {
  try {
    if (fileType === 'json') {
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : Object.values(parsed).flat()
      return arr.map(u => String(u).trim()).filter(u => isValidYT(u))
    }
    const lines = text.split(/\r?\n/).filter(Boolean)
    const urls = []
    lines.forEach(line => {
      const cells = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
      cells.forEach(cell => { if (isValidYT(cell)) urls.push(cell) })
    })
    return [...new Set(urls)]
  } catch { return [] }
}

// ── CompletionPopup ────────────────────────────────────────────────────────
function CompletionPopup({ jobs, onClose }) {
  const [copied, setCopied] = useState(false)
  const doneJobs = jobs.filter(j => j.status==='done' && j.outFilename)
  if (!doneJobs.length) return null
  const copyAll = () => { navigator.clipboard.writeText(doneJobs.map(j=>j.outFilename).join('\n')).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000) }) }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#0e0e1a', border:'1px solid rgba(16,185,129,0.3)', borderRadius:16, padding:24, width:'100%', maxWidth:600, maxHeight:'80vh', display:'flex', flexDirection:'column', gap:16, boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✓</div>
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#e8e8f0' }}>{doneJobs.length} Video{doneJobs.length>1?'s':''} Normalized</p>
              <p style={{ margin:0, fontSize:12, color:'#555' }}>Click any filename to copy it</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#888', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6, maxHeight:340 }}>
          {doneJobs.map((job,i) => (
            <div key={job.jobId} onClick={()=>navigator.clipboard.writeText(job.outFilename)} title="Click to copy"
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, cursor:'pointer', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(16,185,129,0.08)';e.currentTarget.style.borderColor='rgba(16,185,129,0.2)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}}>
              <span style={{ fontSize:11, color:'#555', ...T.mono, flexShrink:0, width:20, textAlign:'right' }}>{i+1}.</span>
              <span style={{ fontSize:12, color:'#10b981', ...T.mono, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{job.outFilename}</span>
              <span style={{ fontSize:10, color:'#444', flexShrink:0 }}>📋</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12 }}>
          <button onClick={copyAll} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:copied?'1px solid rgba(16,185,129,0.5)':'1px solid rgba(139,92,246,0.3)', background:copied?'rgba(16,185,129,0.15)':'rgba(139,92,246,0.12)', color:copied?'#34d399':'#a78bfa' }}>{copied?'✓ Copied!':'📋 Copy All Filenames'}</button>
          <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#666' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── LocalPanel (left slide panel) ─────────────────────────────────────────
function LocalPanel({ open, onClose, isLocalMode, normConfig, apiFetchFn, onSetSubtitleMode, targetCodec, targetRes, doNormalize }) {
  const [paths, setPaths]           = useState('')
  const [recursive, setRecursive]   = useState(false)
  const [skipDone, setSkipDone]     = useState(true)
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning]     = useState(false)
  const [localJobs, setLocalJobs]         = useState([])
  const [localJobsExpanded, setLocalJobsExpanded] = useState(false)
  const [showPopup, setShowPopup]   = useState(false)
  const [copied, setCopied]         = useState(false)
  const localPollRef = useRef(null)
  const prevDoneRef  = useRef(0)

  // Auto-show popup when all active jobs complete
  useEffect(() => {
    const doneCount   = localJobs.filter(j => j.status === 'done').length
    const activeCount = localJobs.filter(j => j.status === 'queued' || j.status === 'normalizing').length
    if (doneCount > 0 && activeCount === 0 && doneCount > prevDoneRef.current) setShowPopup(true)
    prevDoneRef.current = doneCount
  }, [localJobs])

  const localJobsRef = useRef([])
  useEffect(() => { localJobsRef.current = localJobs }, [localJobs])
  // Manual + auto refresh
  const refreshLocalJobs = async () => {
    const active = localJobsRef.current.filter(j=>j.status!=='done'&&j.status!=='error')
    if (!active.length) return
    const ids = active.map(j=>j.job_id)
    try {
      // Use batch endpoint — 1 request for all jobs instead of N individual requests
      const res = await apiFetchFn('/download/status/batch', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(ids)
      })
      if (!res.ok) return
      const data = await res.json()
      setLocalJobs(prev => prev.map(j => {
        if (j.status==='done'||j.status==='error') return j
        const d = data[j.job_id]
        if (!d) return j
        if (d.status==='done')  return {...j,status:'done',normalize_progress:100}
        if (d.status==='error') return {...j,status:'error',error:d.error}
        return {...j,status:d.status,
          normalize_progress:Math.max(j.normalize_progress||0, d.normalize_progress||0),
          started_at:      d.started_at      ?? j.started_at,
          norm_started_at: d.norm_started_at ?? j.norm_started_at,
        }
      }))
    } catch(_) {}
  }

  // Start/stop polling based on whether there are active jobs
  const startLocalPolling = useCallback(() => {
    if (localPollRef.current) return  // already running
    localPollRef.current = setInterval(() => {
      const active = localJobsRef.current.filter(j => j.status !== 'done' && j.status !== 'error')
      if (active.length > 0) {
        refreshLocalJobs()
      } else {
        // No active jobs — stop polling entirely
        clearInterval(localPollRef.current)
        localPollRef.current = null
      }
    }, getPollMs('active'))
  }, [])

  useEffect(() => () => { if (localPollRef.current) clearInterval(localPollRef.current) }, [])

  async function handleScan() {
    const pathList = paths.split('\n').map(p=>p.trim().replace(/^["']+|["']+$/g,'')).filter(Boolean)
    if (!pathList.length) return
    setScanning(true); setScanResult(null)
    try {
      const res = await apiFetchFn('/normalize/local/scan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:pathList,recursive,skip_already_normalized:skipDone}) })
      if (res.ok) setScanResult(await res.json())
      else console.error('[Scan] failed:', res.status, await res.json().catch(()=>({})))
    } catch(e) { console.error('[Scan] error:', e) }
    finally { setScanning(false) }
  }

  async function handleNormalize() {
    const pathList = paths.split('\n').map(p=>p.trim().replace(/^["']+|["']+$/g,'')).filter(Boolean)
    if (!pathList.length) return
    prevDoneRef.current = 0
    // Build flags with subtitle mode inline — only when normalize is on
    const subFlag = normConfig?.subtitleMode === 'drop' ? '-sn'
                  : normConfig?.subtitleMode === 'copy' ? '-c:s copy'
                  : '-c:s mov_text'
    const baseFlags = (normConfig?.flags || '-c:v libx264 -crf 19 -forced-idr 1 -c:a copy').replace(/-c:s\s+\S+|-sn/g, '').trim()
    const finalFlags = doNormalize ? `${baseFlags} ${subFlag}`.trim() : null
    try {
      const res = await apiFetchFn('/normalize/local', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:pathList, norm_flags:finalFlags, recursive, skip_already_normalized:skipDone, codec:targetCodec||'h264', resolution:targetRes||'1920x1080'}) })
      if (res.ok) {
        const created = await res.json()
        setLocalJobs(prev => [...created.map(j=>({...j,status:'queued',normalize_progress:0,title:j.source_path.split(/[/\\]/).pop()})),...prev])
        setScanResult(null)
        startLocalPolling()  // start polling now that we have active jobs
      } else {
        const d = await res.json().catch(()=>({}))
        console.error('[Normalize] failed:', res.status, d)
      }
    } catch(e) { console.error('[Normalize] error:', e) }
  }

  const doneJobs    = localJobs.filter(j => j.status === 'done')
  const activeCount = localJobs.filter(j => j.status === 'queued' || j.status === 'normalizing').length
  const doneCount   = doneJobs.length
  const totalJobs   = localJobs.length
  const errorCount  = localJobs.filter(j => j.status === 'error').length
  const runningCount= localJobs.filter(j => j.status === 'normalizing').length
  const queuedCount = localJobs.filter(j => j.status === 'queued').length
  const pct         = totalJobs > 0 ? Math.round(doneCount / totalJobs * 100) : 0

  const copyDoneNames = () => {
    const names = doneJobs.map(j => j.out_path?.split(/[/\\]/).pop() || j.title).join('\n')
    navigator.clipboard.writeText(names)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const panelStyle = {
    position:'fixed', left:0, top:0, height:'100vh', width:'min(300px,90vw)',
    background:'#13121f', borderRight:'1px solid rgba(186,117,23,0.35)',
    transform:open?'translateX(0)':'translateX(-100%)',
    transition:'transform .25s ease', zIndex:160,
    overflowY:'auto', display:'flex', flexDirection:'column',
  }
  const lbl  = { fontSize:10, color:'#8888aa', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:7 }
  const sdiv = { height:1, background:'rgba(186,117,23,0.12)', margin:'12px 0' }

  return (
    <div style={panelStyle}>
      {/* Completion popup */}
      {showPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if (e.target===e.currentTarget) setShowPopup(false) }}>
          <div style={{ background:'#16161f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, width:500, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#e2e2f0' }}>Normalization Complete</div>
                  <div style={{ fontSize:11, color:'#555' }}>{doneJobs.length} file{doneJobs.length!==1?'s':''} normalized</div>
                </div>
              </div>
              <button onClick={()=>setShowPopup(false)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#555', fontSize:14, width:28, height:28, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'10px 18px' }}>
              {doneJobs.map((j,i) => (
                <div key={j.job_id||i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color:'#22c55e', fontSize:12, flexShrink:0 }}>✓</span>
                  <span style={{ flex:1, fontSize:11, color:'#6ee7b7', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {j.out_path?.split(/[/\\]/).pop() || j.title}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 18px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { copyDoneNames(); }} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(59,130,246,0.4)', background:'rgba(59,130,246,0.08)', color:'#93c5fd', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {copied ? '✓ Copied!' : '📋 Copy All Names'}
              </button>
              <button onClick={()=>setShowPopup(false)} style={{ padding:'7px 14px', borderRadius:7, border:'none', background:'rgba(127,119,221,0.8)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 14px 11px', borderBottom:'1px solid rgba(186,117,23,0.3)', position:'sticky', top:0, background:'#13121f', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'#ffffff' }}>
          <span style={{ fontSize:18 }}>📁</span> Local Normalizer
          {activeCount > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'#ef4444', borderRadius:100, padding:'1px 7px' }}>{activeCount}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:9, color:T.am3, background:'rgba(186,117,23,0.13)', border:'1px solid rgba(186,117,23,0.22)', borderRadius:100, padding:'2px 7px', fontWeight:700 }}>LOCAL</span>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.05)', color:'#777', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:'13px 14px', flex:1 }}>
        {isLocalMode ? (
          <>
            <div style={lbl}>File or folder paths</div>
            <textarea value={paths} onChange={e=>setPaths(e.target.value)}
              placeholder={'C:\\Videos\\movie.mp4\nC:\\Shows\\Season1\\'}
              style={{ width:'100%', background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:8, padding:'9px 11px', fontSize:12, ...T.mono, color:'#e0e0f0', outline:'none', resize:'vertical', minHeight:80, boxSizing:'border-box', marginBottom:8 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, color:'#b0b0c8', marginBottom:8 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}><input type="checkbox" checked={recursive} onChange={e=>setRecursive(e.target.checked)} /> Scan subfolders recursively</label>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}><input type="checkbox" checked={skipDone} onChange={e=>setSkipDone(e.target.checked)} /> Skip already-normalized files</label>
            </div>
            <div style={{ fontSize:10, color:'#9090b8', ...T.mono, lineHeight:1.6, marginBottom:10 }}>Supported: .mp4 .mkv .mov .avi .ts .m4v .wmv .flv .webm .mxf .mts .m2ts .mpg .mpeg .vob .3gp .ogv .rm .rmvb .asf .divx .f4v .dv .gxf .mj2 .qt .r3d</div>

            {/* Subtitle mode */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:'#8888aa', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:6 }}>Subtitles</div>
              <div style={{ display:'flex', gap:5 }}>
                {[
                  { id:'convert', label:'Convert', desc:'SRT→mov_text (safe)', color:'#22c55e' },
                  { id:'copy',    label:'Copy',    desc:'Fast, may fail mp4', color:'#3b82f6' },
                  { id:'drop',    label:'Drop',    desc:'Remove all subs',    color:'#f59e0b' },
                ].map(m => {
                  const active = (normConfig?.subtitleMode || 'convert') === m.id
                  return (
                    <button key={m.id} title={m.desc}
                      onClick={() => {
                        // Update normConfig subtitleMode via setter passed from App
                        if (typeof onSetSubtitleMode === 'function') onSetSubtitleMode(m.id)
                      }}
                      style={{ flex:1, padding:'5px 4px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'center',
                        border: active ? `1.5px solid ${m.color}` : '1px solid rgba(255,255,255,0.12)',
                        background: active ? `rgba(${m.id==='convert'?'34,197,94':m.id==='copy'?'59,130,246':'245,158,11'},0.12)` : 'rgba(255,255,255,0.04)',
                        color: active ? m.color : '#777',
                      }}>
                      {m.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize:9, color:'#505070', marginTop:4, ...T.mono }}>
                {normConfig?.subtitleMode === 'drop' ? '⚠ -sn — all subtitles removed' :
                 normConfig?.subtitleMode === 'copy' ? '⚡ -c:s copy — fast, may fail on mp4+SRT' :
                 '✓ -c:s mov_text — converts SRT to mp4 format'}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <button onClick={handleScan} disabled={scanning||!paths.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'7px 12px', borderRadius:7, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.07)', color:'#c0c0e0', cursor:'pointer', fontFamily:'inherit' }}>🔍 {scanning?'Scanning…':'Preview'}</button>
              <button onClick={handleNormalize} disabled={!paths.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:7, border:'1px solid rgba(29,158,117,0.35)', background:'rgba(29,158,117,0.12)', color:T.te2, cursor:'pointer', fontFamily:'inherit' }}>▶ {doNormalize ? 'Normalize' : 'Copy (raw)'}</button>
            </div>
            <div style={{ fontSize:10, color:'#555', marginBottom:10, lineHeight:1.5 }}>
              {doNormalize
                ? `⚡ ffmpeg · ${targetCodec?.toUpperCase()||'H.264'} · ${targetRes==='source'?'source res':targetRes?.replace('x','×')||'1920×1080'} — set in ⚙ Settings`
                : '⬇️ Download only mode — ffmpeg skipped — set in ⚙ Settings'}
            </div>

            {/* Scan result */}
            {scanResult && (
              <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'9px 11px', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'#9090b8', marginBottom:5 }}>Found {scanResult.count} file{scanResult.count!==1?'s':''}</div>
                {scanResult.files.map((f,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, padding:'2px 0' }}>
                    <span style={{ color:'#e0e0f0', ...T.mono, fontWeight:500, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.source.split(/[/\\]/).pop()}</span>
                    <span style={{ color:'#6666aa', fontSize:10 }}>{f.size_mb}MB</span>
                    <span style={{ color:T.pu3 }}>→</span>
                    <span style={{ color:T.te3, ...T.mono, fontSize:11 }}>{f.out.split(/[/\\]/).pop()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Jobs section */}
            {localJobs.length > 0 && (
              <>
                <div style={sdiv} />

                {/* Jobs header with action buttons */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:5 }}>
                  <div style={{ ...lbl, marginBottom:0 }}>Jobs <span style={{ color:'#3b82f6' }}>({totalJobs})</span></div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {doneCount > 0 && (
                      <button onClick={copyDoneNames} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, border: copied?'1px solid rgba(34,197,94,0.4)':'1px solid rgba(59,130,246,0.3)', background: copied?'rgba(34,197,94,0.07)':'rgba(59,130,246,0.07)', color: copied?'#22c55e':'#93c5fd', cursor:'pointer', fontFamily:'inherit' }}>
                        {copied?'✓ Copied!':'📋 Copy Names'}
                      </button>
                    )}
                    {doneCount > 0 && (
                      <button onClick={()=>setShowPopup(true)} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, border:'1px solid rgba(34,197,94,0.3)', background:'rgba(34,197,94,0.07)', color:'#22c55e', cursor:'pointer', fontFamily:'inherit' }}>
                        ✅ View Done
                      </button>
                    )}
                    {doneCount > 0 && (
                      <button onClick={()=>setLocalJobs(prev=>prev.filter(j=>j.status!=='done'&&j.status!=='error'))} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontFamily:'inherit' }}>
                        Clear Done
                      </button>
                    )}
                    <button onClick={()=>{setLocalJobs([]);prevDoneRef.current=0}} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.06)', color:'#f87171', cursor:'pointer', fontFamily:'inherit' }}>
                      ✕ Clear All
                    </button>
                  </div>
                </div>

                {/* Queue status bar */}
                <div style={{ marginBottom:8, padding:'7px 10px', borderRadius:7, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <button onClick={refreshLocalJobs}
                      style={{ fontSize:9, color:'#3b82f6', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                      ↻ Status
                    </button>
                    <div style={{ display:'flex', gap:8, fontSize:9, ...T.mono }}>
                      {runningCount > 0 && <span style={{ color:'#3b82f6' }}>↻ {runningCount} running</span>}
                      {queuedCount  > 0 && <span style={{ color:'#f59e0b' }}>⏳ {queuedCount} waiting</span>}
                      {doneCount    > 0 && <span style={{ color:'#22c55e' }}>✓ {doneCount} done</span>}
                      {errorCount   > 0 && <span style={{ color:'#ef4444' }}>✕ {errorCount} error</span>}
                    </div>
                    <span style={{ fontSize:9, color:'#3b82f6', fontWeight:700, ...T.mono }}>{pct}%</span>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:3 }}>
                    <div style={{ height:'100%', borderRadius:100, background: pct===100?'#22c55e':'linear-gradient(90deg,#3b82f6,#6366f1)', width:`${pct}%`, transition:'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Job rows with ETA + show more */}
                {(() => {
                  const [showAll, setShowAll] = [localJobsExpanded, setLocalJobsExpanded]
                  const visible = showAll ? localJobs : localJobs.slice(0, 5)
                  return <>
                    {visible.map(j => {
                      const isNorm = j.status === 'normalizing'
                      const isDl   = j.status === 'downloading'
                      const eta    = isNorm ? _eta(j.norm_started_at, j.normalize_progress||0)
                                   : isDl   ? _eta(j.started_at,      j.normalize_progress||0)
                                   : null
                      return (
                        <div key={j.job_id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, padding:'7px 10px', marginBottom:5 }}>
                          <span style={{ fontSize:13, color:j.status==='done'?'#22c55e':j.status==='error'?'#ef4444':j.status==='normalizing'?'#3b82f6':'#f59e0b' }}>
                            {j.status==='done'?'✓':j.status==='error'?'✗':j.status==='normalizing'?'↻':'⏳'}
                          </span>
                          <span style={{ flex:1, fontSize:11, color:'#e0e0f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.title}</span>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:1, flexShrink:0 }}>
                            <span style={{ fontSize:10, color:'#9090b8', ...T.mono }}>
                              {j.status==='done'?'done':j.status==='error'?'err':`${j.normalize_progress||0}%`}
                            </span>
                            {eta && <span style={{ fontSize:9, color:'#f59e0b', ...T.mono }}>{eta}</span>}
                          </div>
                        </div>
                      )
                    })}
                    {localJobs.length > 5 && (
                      <button onClick={()=>setLocalJobsExpanded(v=>!v)}
                        style={{ width:'100%', padding:'5px', borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.03)', color:'#777', fontSize:10, cursor:'pointer', fontFamily:'inherit', marginTop:2 }}>
                        {showAll ? `▲ Show less` : `▼ Show all ${localJobs.length} jobs`}
                      </button>
                    )}
                  </>
                })()}
              </>
            )}
          </>
        ) : (
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#8888aa' }}>
            🖥️ Not available — backend is in server mode.<br/>
            <span style={{ fontSize:11, color:'#444', marginTop:4, display:'block' }}>Set <code>LOCAL_MODE=true</code> in backend <code>.env</code></span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CodecAdvisory ──────────────────────────────────────────────────────────
const CODEC_ADVISORY = [
  {
    container:'.mp4 / .m4v',
    videoCodec:'libx264, libx265, av1',
    audioCodec:'aac, mp3, opus',
    note:'✅ Most compatible container. Recommended default.',
    recommended:'Use libx264 -crf 19 for best quality/size balance.',
    disadvantage:'None — this is the safest choice for any workflow.',
  },
  {
    container:'.mkv',
    videoCodec:'any codec',
    audioCodec:'any codec',
    note:'✅ Matroska — supports virtually any codec + multiple subtitle tracks.',
    recommended:'Ideal when preserving original codec or embedding subtitles.',
    disadvantage:'Not natively supported on some older devices/players.',
  },
  {
    container:'.mov',
    videoCodec:'libx264, prores, hevc',
    audioCodec:'aac, pcm',
    note:'✅ Apple QuickTime. Best for macOS / Final Cut Pro workflows.',
    recommended:'Use ProRes for lossless editing. Use H.264 for delivery.',
    disadvantage:'Large file size with ProRes. Poor support on Windows without QuickTime.',
  },
  {
    container:'.ts / .mts / .m2ts',
    videoCodec:'libx264, libx265',
    audioCodec:'aac, ac3, mp2',
    note:'⚠️ Auto-strips subtitles. Auto-adds -f mpegts. No -forced-idr.',
    recommended:'Use for broadcast ingest or IPTV delivery pipelines.',
    disadvantage:'Forced: subtitles are dropped. -forced-idr removed — some players may have seek issues.',
  },
  {
    container:'.mxf',
    videoCodec:'libx264, libx265',
    audioCodec:'⚠️ pcm_s16le (forced)',
    note:'🔴 MXF requires PCM audio. AAC/copy auto-replaced with pcm_s16le.',
    recommended:'Use for broadcast ingest (Avid, Adobe Premiere, Harmonic).',
    disadvantage:'Forced: audio re-encoded to PCM — larger file size (~10× audio track). Quality unchanged but processing time increases.',
  },
  {
    container:'.gxf / .lxf',
    videoCodec:'libx264, libx265',
    audioCodec:'⚠️ pcm_s16le (forced)',
    note:'🔴 Grass Valley/Harris broadcast formats require PCM audio.',
    recommended:'Use only for Grass Valley/Harris playout systems.',
    disadvantage:'Forced: audio re-encoded to PCM. Same file size penalty as MXF.',
  },
  {
    container:'.webm',
    videoCodec:'⚠️ libvpx-vp9 (forced)',
    audioCodec:'⚠️ libopus (forced)',
    note:'🔴 WebM only accepts VP8/VP9/AV1 + Opus. Codecs auto-replaced.',
    recommended:'Use for web streaming (YouTube, HTML5 video).',
    disadvantage:'Forced: full video re-encode to VP9 — very slow (5-10× slower than H.264). Quality slightly lower at same bitrate.',
  },
  {
    container:'.ogv',
    videoCodec:'⚠️ libtheora (forced)',
    audioCodec:'⚠️ libvorbis (forced)',
    note:'🔴 OGV only accepts Theora + Vorbis. Auto-converts both streams.',
    recommended:'Use only for open-source/Linux platforms requiring OGG.',
    disadvantage:'Forced: Theora quality is noticeably lower than H.264 at same bitrate. Avoid for professional delivery.',
  },
  {
    container:'.vob',
    videoCodec:'⚠️ mpeg2video (forced)',
    audioCodec:'⚠️ ac3 (forced)',
    note:'🔴 DVD format — requires MPEG-2 + AC3. H.264 is invalid here.',
    recommended:'Use only for DVD authoring workflows.',
    disadvantage:'Forced: MPEG-2 quality is lower than H.264 at same bitrate. File sizes ~3× larger than equivalent H.264.',
  },
  {
    container:'.mpg / .mpeg',
    videoCodec:'⚠️ mpeg2video (forced)',
    audioCodec:'⚠️ mp2 (forced)',
    note:'🔴 MPEG-PS requires MPEG-1/2 video. H.264 is not valid.',
    recommended:'Use only for legacy broadcast or DVD-compatible output.',
    disadvantage:'Forced: MPEG-2 + MP2 gives noticeably lower quality than modern codecs. Avoid unless required by downstream system.',
  },
  {
    container:'.wmv / .asf',
    videoCodec:'⚠️ wmv2 (forced)',
    audioCodec:'⚠️ wmav2 (forced)',
    note:'🔴 Windows Media requires WMV2 + WMA. Auto-converts both streams.',
    recommended:'Use only for Windows Media Player compatibility.',
    disadvantage:'Forced: WMV2 quality is poor compared to H.264. Avoid for any modern delivery.',
  },
  {
    container:'.flv',
    videoCodec:'libx264',
    audioCodec:'aac, mp3',
    note:'⚠️ Flash legacy format. Auto-strips subtitle streams.',
    recommended:'Avoid if possible — Flash is deprecated. Use .mp4 instead.',
    disadvantage:'Subtitles dropped. No modern platform supports FLV natively.',
  },
  {
    container:'.avi',
    videoCodec:'libx264, mpeg4',
    audioCodec:'mp3, pcm, aac',
    note:'⚠️ Legacy container. Auto-strips subtitle streams.',
    recommended:'Use only when target player requires AVI (legacy hardware).',
    disadvantage:'Subtitles dropped. No B-frames support in some players. Worse seeking than MP4/MKV.',
  },
  {
    container:'.3gp / .3g2',
    videoCodec:'libx264 (Baseline)',
    audioCodec:'aac, amr',
    note:'⚠️ Mobile legacy format. Auto-strips subtitles.',
    recommended:'Use only for very old mobile devices (pre-2012).',
    disadvantage:'Subtitles dropped. Low resolution/bitrate support. Obsolete — use .mp4 for modern mobile.',
  },
  {
    container:'.dv',
    videoCodec:'⚠️ dvvideo (forced)',
    audioCodec:'⚠️ pcm_s16le (forced)',
    note:'🔴 DV camcorder format — fixed codec, PCM audio, resolution locked to 720x576.',
    recommended:'Use only for DV tape capture/edit workflows.',
    disadvantage:'Forced: resolution locked to 720x576 — any HD input is downscaled. Very large file size (13GB/hour). Avoid for modern content.',
  },
  {
    container:'.rm / .rmvb',
    videoCodec:'libx264',
    audioCodec:'aac',
    note:'⚠️ RealMedia legacy format.',
    recommended:'Avoid — use .mp4. RealMedia is obsolete.',
    disadvantage:'Very limited modern player support. RealPlayer required on most systems.',
  },
]

function CodecAdvisory({ open, onClose }) {
  if (!open) return null
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300,
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div style={{
        background:'#0f0f1e', border:'1px solid rgba(59,130,246,0.3)',
        borderRadius:14, width:'100%', maxWidth:1100, maxHeight:'85vh',
        display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>📋</span>
            <span style={{ fontSize:14, fontWeight:600, color:'#93c5fd' }}>Codec Advisory</span>
            <span style={{ fontSize:11, color:'#555' }}>— container compatibility reference</span>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#888', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ overflow:'auto', flex:1, background:'rgba(59,130,246,0.04)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ background:'rgba(59,130,246,0.1)', borderBottom:'1px solid rgba(59,130,246,0.2)' }}>
                {['Container','Video codec','Audio codec','Status / Notes','Recommended use','If forced: disadvantage'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#93c5fd', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CODEC_ADVISORY.map((row, i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding:'7px 12px', color:'#6ee7b7', fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' }}>{row.container}</td>
                  <td style={{ padding:'7px 12px', color:'#c4beff', fontFamily:'monospace', fontSize:10 }}>{row.videoCodec}</td>
                  <td style={{ padding:'7px 12px', color:'#fbbf24', fontFamily:'monospace', fontSize:10 }}>{row.audioCodec}</td>
                  <td style={{ padding:'7px 12px', color:'#aaa', lineHeight:1.5, minWidth:200 }}>{row.note}</td>
                  <td style={{ padding:'7px 12px', color:'#6ee7b7', lineHeight:1.5, minWidth:180, fontSize:10 }}>{row.recommended}</td>
                  <td style={{ padding:'7px 12px', color:'#f87171', lineHeight:1.5, minWidth:220, fontSize:10 }}>{row.disadvantage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── SettingsPanel (right slide panel) ─────────────────────────────────────
// ── DownloadHistory — persisted across sessions ───────────────────────────────
function DownloadHistory({ apiFetchFn, jobs, onClearAll }) {
  const [hist, setHist] = useState(() => { try { return JSON.parse(localStorage.getItem('yt_dl_history')||'[]') } catch { return [] } })
  const [open, setOpen] = useState(true)

  // Seed history from current done jobs that aren't already in history
  useEffect(() => {
    if (!jobs?.length) return
    const doneJobs = jobs.filter(j => j.status === 'done' && j.outFilename && j.downloadUrl)
    if (!doneJobs.length) return
    setHist(prev => {
      let updated = [...prev]
      doneJobs.forEach(j => {
        if (!updated.find(h => h.jobId === j.jobId)) {
          updated.unshift({ jobId: j.jobId, filename: j.outFilename, downloadUrl: j.downloadUrl, doneAt: new Date().toLocaleString() })
        }
      })
      updated = updated.slice(0, 50)
      localStorage.setItem('yt_dl_history', JSON.stringify(updated))
      return updated
    })
  }, [jobs])

  const remove = (jobId) => {
    const updated = hist.filter(h => h.jobId !== jobId)
    setHist(updated)
    localStorage.setItem('yt_dl_history', JSON.stringify(updated))
  }

  const clearAll = () => {
    setHist([])
    localStorage.removeItem('yt_dl_history')
    onClearAll?.()
  }

  const [copied, setCopied] = useState(false)

  const allEntries = hist

  if (!allEntries.length) return null

  return (
    <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12, marginTop:8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: open ? 10 : 0 }}>
        <button onClick={() => setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <span style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>📂 Download History</span>
          <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'#3b82f6', borderRadius:100, padding:'1px 7px' }}>{allEntries.length}</span>
          <span style={{ fontSize:10, color:'#555' }}>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div style={{ display:'flex', gap:5 }}>
            <button onClick={() => {
              const names = allEntries.map(h => h.filename).join('\n')
              navigator.clipboard.writeText(names)
              setCopied(true); setTimeout(() => setCopied(false), 2000)
            }} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border: copied ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(59,130,246,0.3)', background: copied ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.07)', color: copied ? '#34d399' : '#93c5fd', cursor:'pointer', fontFamily:'inherit' }}>{copied ? '✓ Copied!' : '📋 Copy All Names'}</button>
            <button onClick={clearAll} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#f87171', cursor:'pointer', fontFamily:'inherit' }}>✕ Clear</button>
          </div>
        )}
      </div>

      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:260, overflowY:'auto' }}>
          {allEntries.map(h => (
            <div key={h.jobId} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'8px 10px' }}>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:12, color:'#10b981', ...T.mono, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.filename}</div>
                <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{h.doneAt}</div>
              </div>
              <a href={h.downloadUrl} download={h.filename}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', color:'#34d399', textDecoration:'none', fontWeight:700, flexShrink:0 }}>
                ↓ Save
              </a>
              <button onClick={() => remove(h.jobId)}
                style={{ width:20, height:20, border:'none', background:'none', color:'#555', fontSize:12, cursor:'pointer', flexShrink:0 }}
                onMouseEnter={e => e.currentTarget.style.color='#f87171'}
                onMouseLeave={e => e.currentTarget.style.color='#555'}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsPanel({ open, onClose, normConfig, setNormConfig, isLocalMode, apiFetchFn, jobs, onRefreshJobs, onClearJobs, onClearQueued, onRemoveJob, bgImage, bgBrightness, setBgBrightness, targetCodec, setTargetCodec, targetRes, setTargetRes, doNormalize, setDoNormalize }) {
  const activePreset = PRESETS.find(p => p.id === normConfig.presetId) || PRESETS[2]
  const [customFlags, setCustomFlags] = useState(normConfig.presetId==='custom' ? normConfig.flags : '')
  const [parallelFetch, setParallelFetch] = useState(false)

  function selectPreset(preset) {
    if (preset.id === 'custom') setNormConfig(v => ({...v, presetId:'custom', flags:customFlags}))
    else setNormConfig(v => ({...v, presetId:preset.id, flags:preset.flags}))
  }

  return (
    <>
      {/* Settings Panel */}
      <div style={{
        position:'fixed', right:0, top:0, height:'100vh', width:'min(300px, 90vw)',
        background:'#0d0d1c', borderLeft:'1px solid rgba(127,119,221,0.18)',
        transform:open?'translateX(0)':'translateX(100%)',
        transition:'transform .25s ease', zIndex:160,
        overflowY:'auto', display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.9rem 1.1rem .75rem', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'sticky', top:0, background:'#0d0d1c', zIndex:2 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:500 }}>
            <span style={{ fontSize:17, color:T.pu3 }}>⚙</span> Settings
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.05)', color:'#666', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:'.9rem 1.1rem', flex:1 }}>

          {/* Background brightness slider — only when bg image is set */}
          {bgImage && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:8 }}>Background brightness</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="range" min={5} max={80} value={bgBrightness}
                  onChange={e=>{ const v=Number(e.target.value); setBgBrightness(v); localStorage.setItem('yt_bg_brightness',v) }}
                  style={{ flex:1, accentColor:'#7F77DD' }} />
                <span style={{ fontSize:12, color:T.pu2, ...T.mono, minWidth:32 }}>{bgBrightness}%</span>
              </div>
            </div>
          )}

          {/* ── NORMALIZE TOGGLE ── */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:'.55rem' }}>Normalize</div>
            <div onClick={() => setDoNormalize(v => !v)} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', borderRadius:9, cursor:'pointer',
              border: doNormalize ? '1px solid rgba(124,106,247,0.35)' : '1px solid rgba(255,255,255,0.07)',
              background: doNormalize ? 'rgba(124,106,247,0.1)' : 'rgba(255,255,255,0.03)',
              transition:'all .2s', userSelect:'none',
            }}>
              {/* pill toggle */}
              <div style={{ width:36, height:20, borderRadius:10, background:doNormalize?'#7c6af7':'rgba(255,255,255,0.1)', position:'relative', flexShrink:0, transition:'background .2s' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:doNormalize?19:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:doNormalize?'#a78bfa':'#64748b' }}>
                  {doNormalize ? '⚡ Normalize after download' : '⬇️ Download only (skip ffmpeg)'}
                </div>
                <div style={{ fontSize:10, color:'#444', marginTop:2 }}>
                  {doNormalize
                    ? `applies to YouTube + local files`
                    : 'raw file saved with video title as filename'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'.75rem 0' }} />

          {/* Sequential toggle */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:'.55rem' }}>Download mode</div>
            <button onClick={() => setParallelFetch(v => !v)} style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontSize:12, fontWeight:600, padding:'8px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              border: parallelFetch ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(99,102,241,0.3)',
              background: parallelFetch ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)',
              color: parallelFetch ? '#f59e0b' : '#818cf8',
            }}>
              {parallelFetch ? '⚡ Parallel mode' : '↕ Sequential mode'}
            </button>
          </div>

          <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'.75rem 0' }} />

          {/* ── CODEC TOGGLE ── */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:'.55rem' }}>Video codec</div>
            <div style={{ display:'flex', gap:6 }}>
              {[{val:'h264',label:'H.264',color:'#3b82f6'},{val:'h265',label:'H.265',color:'#7c3aed'}].map(opt => {
                const active = targetCodec === opt.val
                return (
                  <button key={opt.val} onClick={() => setTargetCodec(opt.val)} style={{
                    flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    fontSize:12, fontWeight:700,
                    border: active ? `1px solid ${opt.color}66` : '1px solid rgba(255,255,255,0.08)',
                    background: active ? `${opt.color}22` : 'rgba(255,255,255,0.03)',
                    color: active ? opt.color : '#555',
                    transition:'all .15s',
                  }}>
                    {opt.label}
                    {active && <span style={{ fontSize:9, marginLeft:5, opacity:0.7 }}>✓</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize:10, color:'#444', marginTop:5, lineHeight:1.5 }}>
              {targetCodec === 'h265'
                ? '💎 H.265 — ~40% smaller files, slower encode. If source is already H.265, stream copied instantly.'
                : '⚡ H.264 — fastest, widest compatibility. If source is already H.264, stream copied instantly.'}
            </div>
          </div>

          {/* ── RESOLUTION TOGGLE ── */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:'.55rem' }}>Resolution</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {[
                {val:'source', label:'Source', desc:'Keep original'},
                {val:'1280x720',  label:'720p',   desc:'1280×720'},
                {val:'1920x1080', label:'1080p',  desc:'1920×1080'},
                {val:'3840x2160', label:'4K',     desc:'3840×2160'},
              ].map(opt => {
                const active = targetRes === opt.val
                return (
                  <button key={opt.val} onClick={() => setTargetRes(opt.val)} style={{
                    flex:1, minWidth:'calc(50% - 3px)', padding:'7px 4px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    fontSize:11, fontWeight:700, textAlign:'center',
                    border: active ? '1px solid rgba(29,158,117,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#5DCAA5' : '#555',
                    transition:'all .15s',
                  }}>
                    {opt.label}
                    <div style={{ fontSize:9, fontWeight:400, color: active ? '#3a8a6a' : '#3a3a50', marginTop:1 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize:10, color:'#444', marginTop:5, lineHeight:1.5 }}>
              {targetRes === 'source'
                ? '↔ Keep source resolution — no scaling applied.'
                : `⇄ Scale to ${targetRes.replace('x','×')} — if source already matches, no scaling needed.`}
            </div>
          </div>

          <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'.75rem 0' }} />
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:'.55rem' }}>Encoding preset</div>
            {PRESETS.map(preset => {
              const active = activePreset.id === preset.id
              return (
                <div key={preset.id} onClick={() => selectPreset(preset)} style={{
                  background:active?'rgba(127,119,221,0.12)':'rgba(255,255,255,0.03)',
                  border:`1px solid ${active?'rgba(127,119,221,0.32)':'rgba(255,255,255,0.07)'}`,
                  borderRadius:8, padding:'.65rem .85rem', cursor:'pointer', marginBottom:5, transition:'all .15s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:1 }}>
                    <span style={{ fontSize:15 }}>{preset.label.split(' ')[0]}</span>
                    <span style={{ fontSize:12, fontWeight:500, color:'#e2e2f0' }}>{preset.label.split(' ').slice(1).join(' ')}</span>
                  </div>
                  <div style={{ fontSize:10, color:'#404055', marginLeft:22 }}>{preset.desc}</div>
                </div>
              )
            })}
            {activePreset.id === 'custom' && (
              <input value={customFlags} onChange={e=>{setCustomFlags(e.target.value);setNormConfig(v=>({...v,flags:e.target.value}))}}
                placeholder="-c:v libx264 -crf 18 -c:a aac"
                style={{ width:'100%', background:'rgba(0,0,0,0.25)', border:'1px solid rgba(127,119,221,0.3)', borderRadius:7, padding:'8px 10px', fontSize:11, ...T.mono, color:T.pu2, outline:'none', boxSizing:'border-box', marginTop:6 }} />
            )}

            {/* Delogo coordinate editor */}
            {activePreset.id === 'delogo' && (() => {
              // Parse current delogo coords from flags
              const m = normConfig.flags.match(/delogo=x=(\d+):y=(\d+):w=(\d+):h=(\d+)/)
              const dx = m?.[1]||'10', dy = m?.[2]||'10', dw = m?.[3]||'200', dh = m?.[4]||'50'
              const update = (k,v) => {
                const nx = k==='x'?v:dx, ny = k==='y'?v:dy, nw = k==='w'?v:dw, nh = k==='h'?v:dh
                setNormConfig(prev => ({...prev, flags:`-c:v libx264 -crf 19 -forced-idr 1 -vf "delogo=x=${nx}:y=${ny}:w=${nw}:h=${nh}:show=0" -c:a copy`}))
              }
              return (
                <div style={{ marginTop:8, background:'rgba(0,0,0,0.25)', border:'1px solid rgba(127,119,221,0.2)', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Watermark position</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {[['x','Left edge',dx],['y','Top edge',dy],['w','Width',dw],['h','Height',dh]].map(([k,label,val]) => (
                      <div key={k}>
                        <div style={{ fontSize:10, color:'#555', marginBottom:3 }}>{label}</div>
                        <input type="number" value={val} onChange={e=>update(k,e.target.value)}
                          style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(127,119,221,0.25)', borderRadius:6, padding:'5px 8px', fontSize:12, color:T.pu2, outline:'none', boxSizing:'border-box', ...T.mono }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:10, color:'#444', marginTop:8, lineHeight:1.5 }}>
                    x/y = top-left corner of watermark in pixels<br/>
                    w/h = width and height of watermark region
                  </div>
                </div>
              )
            })()}
          </div>



          {/* ── DOWNLOADS ── */}
          {jobs && jobs.length > 0 && (
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12, marginTop:4 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>Downloads</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'#fff',
                    background: jobs.some(j=>!['done','error'].includes(j.status)) ? '#ef4444' : '#10b981',
                    borderRadius:100, padding:'1px 7px' }}>
                    {jobs.filter(j=>!['done','error'].includes(j.status)).length || jobs.filter(j=>j.status==='done').length}
                  </span>
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={onRefreshJobs} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontFamily:'inherit' }}>↻</button>
                  <button onClick={async () => {
                    try { await apiFetchFn('/queue/clear', { method:'POST' }) } catch(_) {}
                    onClearQueued()
                  }} title="Cancel all queued jobs" style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(245,158,11,0.25)', background:'rgba(245,158,11,0.07)', color:'#f59e0b', cursor:'pointer', fontFamily:'inherit' }}>⏳ Clear Queue</button>
                  <button onClick={onClearJobs} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#f87171', cursor:'pointer', fontFamily:'inherit' }}>✕ Clear All</button>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {jobs.map(job => <JobCard key={job.jobId} job={{
                  ...job,
                  onCancel: async (id) => {
                    try {
                      await apiFetchFn('/job/cancel', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job_id:id})})
                    } catch(_) {}
                    onRemoveJob(id)
                  },
                  onDelete: async (id, deleteFile) => {
                    try {
                      await apiFetchFn('/job/delete', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job_id:id,delete_file:deleteFile})})
                      onClearJobs()
                      onRefreshJobs()
                    } catch(_) {}
                  },
                }} />)}
              </div>
            </div>
          )}

          {/* ── DOWNLOAD HISTORY ── */}
          <DownloadHistory apiFetchFn={apiFetchFn} jobs={jobs} onClearAll={onClearJobs} />

        </div>
      </div>
    </>
  )
}

// ── BgButton ───────────────────────────────────────────────────────────────
function BgButton({ bgImage, bgBrightness, onUpload, onRemove, onBrightness }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(v=>!v)} style={{
        display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px',
        borderRadius:7, cursor:'pointer', fontFamily:'inherit',
        border: bgImage ? '1px solid rgba(127,119,221,0.4)' : '1px solid rgba(255,255,255,0.09)',
        background: bgImage ? 'rgba(127,119,221,0.14)' : 'rgba(255,255,255,0.04)',
        color: bgImage ? '#c4beff' : '#999',
      }}>
        🖼 {bgImage ? 'BG ●' : 'BG'}
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300,
          background:'#0f0f1e', border:'1px solid rgba(127,119,221,0.25)',
          borderRadius:12, padding:14, width:220,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {/* Preview */}
          {bgImage && (
            <div style={{ marginBottom:10, borderRadius:8, overflow:'hidden', height:80, position:'relative' }}>
              <img src={bgImage} alt="bg" style={{ width:'100%', height:'100%', objectFit:'cover', filter:`brightness(${bgBrightness/100})` }} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', opacity:0, transition:'opacity .2s' }}
                onMouseEnter={e=>e.currentTarget.style.opacity=1}
                onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                <span style={{ fontSize:11, color:'#fff' }}>current background</span>
              </div>
            </div>
          )}

          {/* Upload */}
          <button onClick={()=>{ onUpload(); setOpen(false) }} style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            fontSize:12, fontWeight:600, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            border:'1px solid rgba(127,119,221,0.3)', background:'rgba(127,119,221,0.1)', color:'#c4beff', marginBottom:6,
          }}>
            ↑ {bgImage ? 'Change image' : 'Upload image'}
          </button>

          {/* Brightness slider */}
          {bgImage && (
            <div style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:700 }}>Brightness</span>
                <span style={{ fontSize:10, color:'#c4beff', ...T.mono }}>{bgBrightness}%</span>
              </div>
              <input type="range" min={5} max={80} value={bgBrightness}
                onChange={e=>onBrightness(Number(e.target.value))}
                style={{ width:'100%', accentColor:'#7F77DD' }} />
            </div>
          )}

          {/* Remove */}
          {bgImage && (
            <button onClick={()=>{ onRemove(); setOpen(false) }} style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontSize:12, padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#f87171',
            }}>
              ✕ Remove background
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
let _id = 1
const newItem = () => ({ id:_id++, url:'', info:null, selectedFormat:null, error:null, fetchStatus:null, fetchPct:0, fetchTime:null, fetchStart:null })

// ── BackendModal — admin-gated backend URL config ─────────────────────────────
function BackendModal({ onClose }) {
  const ADMIN_SECRET_KEY = 'yt_admin_verified'
  const [step,      setStep]    = useState(() => (sessionStorage.getItem(ADMIN_SECRET_KEY) || localStorage.getItem('yt_admin_token')) ? 'url' : 'auth')
  const [secret,    setSecret]  = useState('')
  const [secretErr, setSecretErr] = useState('')
  const [urlInput,  setUrlInput] = useState(localStorage.getItem('yt_api_base') || '')
  const [saved,     setSaved]   = useState(false)

  const verifySecret = async () => {
    if (!secret.trim()) { setSecretErr('Enter admin secret'); return }
    try {
      const res = await apiFetch('/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secret.trim() }),
      })
      if (res.ok) {
        localStorage.setItem('yt_admin_token', secret.trim())
        sessionStorage.setItem(ADMIN_SECRET_KEY, '1')
        setStep('url'); setSecretErr('')
      } else {
        setSecretErr('Wrong secret')
      }
    } catch {
      // Backend unreachable — this is exactly when BE URL needs changing
      // Accept any input so admin can fix the URL
      localStorage.setItem('yt_admin_token', secret.trim())
      sessionStorage.setItem(ADMIN_SECRET_KEY, '1')
      setStep('url'); setSecretErr('')
    }
  }

  const saveUrl = () => {
    const v = urlInput.trim().replace(/\/$/, '')
    if (v) { localStorage.setItem('yt_api_base', v) }
    else   { localStorage.removeItem('yt_api_base') }
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose(); window.location.reload() }, 900)
  }

  const reset = () => {
    localStorage.removeItem('yt_api_base')
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose(); window.location.reload() }, 900)
  }

  const overlay = { position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }
  const modal   = { background:'#16161f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, width:440, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', fontFamily:"'Inter','Segoe UI',sans-serif" }

  return (
    <div style={overlay} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🖥️</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#e2e2f0' }}>Backend URL</div>
              <div style={{ fontSize:11, color:'#555' }}>Override the API server address</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#555', fontSize:14, width:28, height:28, cursor:'pointer' }}>✕</button>
        </div>

        {step === 'auth' ? (
          <>
            <div style={{ fontSize:12, color:'#7878a0', marginBottom:10 }}>🔒 Admin secret required to change backend URL</div>
            <input
              autoFocus type="password" value={secret}
              onChange={e => { setSecret(e.target.value); setSecretErr('') }}
              onKeyDown={e => e.key==='Enter' && verifySecret()}
              placeholder="Admin secret…"
              style={{ width:'100%', background:'#0d0d18', border:`1.5px solid ${secretErr ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, padding:'10px 14px', color:'#e2e2f0', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:6 }}
            />
            {secretErr && <div style={{ fontSize:11, color:'#f87171', marginBottom:8 }}>{secretErr}</div>}
            <button onClick={verifySecret} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', background:'rgba(127,119,221,0.8)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>
              Verify →
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize:11, color:'#7878a0', marginBottom:6 }}>Current backend</div>
            <div style={{ fontSize:12, color:'#6ee7b7', background:'#0d0d18', borderRadius:6, padding:'7px 12px', marginBottom:14, fontFamily:'monospace', wordBreak:'break-all' }}>
              {getApiBase()}
            </div>
            <div style={{ fontSize:11, color:'#7878a0', marginBottom:6 }}>New URL <span style={{ color:'#444' }}>(leave empty to reset to default)</span></div>
            <input
              autoFocus value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && saveUrl()}
              placeholder={`e.g. https://basically-praising-paving.ngrok-free.app`}
              style={{ width:'100%', background:'#0d0d18', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px', color:'#e2e2f0', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'monospace', marginBottom:14 }}
            />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={reset} style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.07)', color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Reset to default
              </button>
              <button onClick={saveUrl} style={{ flex:2, padding:'9px', borderRadius:8, border:'none', background: saved ? 'rgba(16,185,129,0.8)' : 'rgba(127,119,221,0.8)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .2s' }}>
                {saved ? '✓ Saved — reloading…' : 'Save & Reload'}
              </button>
            </div>
            {localStorage.getItem('yt_api_base') && (
              <div style={{ marginTop:10, fontSize:11, color:'#7878a0', textAlign:'center' }}>
                🟣 Custom URL active — <span style={{ color:'#f59e0b' }}>default: {API_DEFAULT}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [items, setItems]                   = useState(() => [newItem()])
  const [showAdmin, setShowAdmin]           = useState(false)
  const [showBE,    setShowBE]              = useState(false)
  const [showCookieSetup, setShowCookieSetup] = useState(false)
  const [user, setUser]                     = useState(null)
  const [fetchingAll, setFetchingAll]       = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [fetchIndex, setFetchIndex]         = useState(0)
  const [fetchTotal, setFetchTotal]         = useState(0)
  const [parallelFetch, setParallelFetch]   = useState(false)
  const [showSearch, setShowSearch]         = useState(false)
  const [dlCountdown, setDlCountdown]       = useState(0)
  const [dlIndex, setDlIndex]               = useState(0)
  const [dlTotal, setDlTotal]               = useState(0)
  const [jobs, setJobs]                     = useState([])
  const [showSettings, setShowSettings]     = useState(false)
  const [showLocalPanel, setShowLocalPanel] = useState(false)
  const [showAdvisory, setShowAdvisory]     = useState(false)
  const [showHealth,   setShowHealth]       = useState(false)
  const [showChannel,   setShowChannel]    = useState(false)
  const [channelInitUrl,setChannelInitUrl] = useState('')
  const [queueStatus, setQueueStatus]       = useState(null)
  const [bgImage, setBgImage]               = useState(() => localStorage.getItem('yt_bg_image') || null)
  const [bgBrightness, setBgBrightness]     = useState(() => Number(localStorage.getItem('yt_bg_brightness') || 30))
  const [bgDark, setBgDark]                 = useState(true)  // true = bg is dark → use light text
  const bgFileRef = useRef(null)

  // Detect bg brightness to auto-switch text color
  useEffect(() => {
    if (!bgImage) { setBgDark(true); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 50; canvas.height = 50
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 50, 50)
      const d = ctx.getImageData(0, 0, 50, 50).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]
      const luma = sum / (d.length / 4)
      // Apply brightness factor from slider
      const effective = luma * (bgBrightness / 100)
      setBgDark(effective < 128)
    }
    img.src = bgImage
  }, [bgImage, bgBrightness])

  // Dynamic text color based on bg
  const tx = bgImage ? (bgDark ? '#ffffff' : '#111111') : '#e8e8f0'
  const txMid = bgImage ? (bgDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)') : '#6b6b80'
  const txDim = bgImage ? (bgDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)') : '#3a3a50'
  const cardBg = bgImage ? (bgDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.03)'
  const cardBorder = bgImage ? (bgDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') : 'rgba(255,255,255,0.08)'
  const [isLocalMode, setIsLocalMode] = useState(() => localStorage.getItem('yt_local_mode') === 'true')
  const pollRef    = useRef(null)
  const fileInputRef = useRef(null)

  const [normConfig, setNormConfig] = useState({
    presetId: 'hq',
    flags: '-c:v libx264 -crf 19 -forced-idr 1 -c:a copy',
    outputExt: 'same',
    subtitleMode: 'convert',
  })
  const [doNormalize, setDoNormalize] = useState(true)
  const [targetCodec, setTargetCodec] = useState(() => localStorage.getItem('yt_target_codec') || 'h264')
  const [targetRes,   setTargetRes]   = useState(() => localStorage.getItem('yt_target_res')   || '1920x1080')

  // Build final flags with subtitle mode injected
  const effectiveFlags = (cfg = normConfig) => {
    const subFlag = cfg.subtitleMode === 'drop' ? '-sn'
                  : cfg.subtitleMode === 'copy' ? '-c:s copy'
                  : '-c:s mov_text'
    // Strip any existing subtitle flags then append chosen one
    const base = (cfg.flags || '').replace(/-c:s\s+\S+|-sn/g, '').trim()
    return `${base} ${subFlag}`.trim()
  }

  const importUrls = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const fileType = file.name.endsWith('.json') ? 'json' : 'csv'
    const reader = new FileReader()
    reader.onload = (ev) => {
      const urls = parseImportedUrls(ev.target.result, fileType)
      if (!urls.length) { alert('No valid YouTube URLs found in file'); return }
      setItems(prev => {
        const existing = prev.filter(it => it.url.trim())
        const existingUrls = new Set(existing.map(it => it.url.trim()))
        const newItems = urls.filter(u => !existingUrls.has(u)).map(u => ({...newItem(), url:u}))
        const base = prev.some(it => !it.url.trim()) ? existing : prev
        return [...base, ...newItems]
      })
    }
    reader.readAsText(file); e.target.value = ''
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
      apiFetch(`${getApiBase()}/auth/google`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code, redirect_uri:REDIRECT_URI}) })
        .then(async r => { const data = await r.json(); if (data.session_id) { const u={session_id:data.session_id,name:data.name,email:data.email,picture:data.picture}; setUser(u); localStorage.setItem('yt_session',JSON.stringify(u)) } }).catch(()=>{})
    }
    const stored = localStorage.getItem('yt_session')
    if (stored && !code) {
      try {
        const parsed = JSON.parse(stored)
        apiFetch(`${getApiBase()}/auth/session/${parsed.session_id}`).then(r=>{if(r.ok)return r.json();throw new Error()}).then(()=>setUser(parsed)).catch(()=>localStorage.removeItem('yt_session'))
      } catch { localStorage.removeItem('yt_session') }
    }
    apiFetch(`${getApiBase()}/config`).then(r=>r.ok?r.json():null).then(d=>{
      if(d){
        const lm=!!d.local_mode; setIsLocalMode(lm); localStorage.setItem('yt_local_mode', lm)
        // Apply poll intervals from backend
        if(d.poll_active_ms)   _pollCfg.active   = d.poll_active_ms
        if(d.poll_idle_ms)     _pollCfg.idle      = d.poll_idle_ms
        if(d.poll_download_ms) _pollCfg.download  = d.poll_download_ms
        console.log(`[POLL] active=${_pollCfg.active}ms idle=${_pollCfg.idle}ms download=${_pollCfg.download}ms`)
      }
    }).catch(()=>{})
  }, [])

  // ── Restore active jobs on page load/refresh ──────────────────────────────
  useEffect(() => {
    apiFetch(`${getApiBase()}/jobs`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data) || !data.length) return
        // Only restore non-done, non-error jobs + recently done jobs
        const restored = data
          .filter(j => j.status && j.url && j.job_id)
          .map(j => ({
            jobId       : j.job_id,
            url         : j.url,
            title       : j.title || j.url,
            status      : j.status,
            progress    : j.progress || 0,
            normProgress: j.normalize_progress || 0,
            error       : j.error || null,
            downloadUrl : j.status === 'done' ? `${getApiBase()}/download/file/${j.job_id}` : null,
            outFilename : j.filename || null,
            queue_position: j.queue_position || 0,
          }))
        if (restored.length) {
          setJobs(restored)
          // Start polling if any jobs are still active
          const hasActive = restored.some(j => !['done','error'].includes(j.status))
          if (hasActive) startPolling()
        }
      })
      .catch(() => {})
  }, [])

  const logout = async () => {
    if (user?.session_id) await apiFetch(`${getApiBase()}/auth/logout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:user.session_id})}).catch(()=>{})
    setUser(null); localStorage.removeItem('yt_session')
  }

  const updateItem = (id, key, val) => setItems(prev => prev.map(it => it.id===id ? {...it,[key]:val} : it))
  const addItem    = () => setItems(prev => [...prev, newItem()])
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id!==id))

  const addUrlFromSearch = (video) => {
    const url = typeof video === 'string' ? video : video.url
    if (items.some(it => it.url.trim() === url.trim())) return
    const info = typeof video === 'object' ? { title:video.title, thumbnail:video.thumbnail, duration:video.duration_seconds||null, uploader:video.channel, formats:[{format_id:'bestvideo+bestaudio/best',type:'video',ext:'mp4',resolution:'best',filesize:null,height:9999,quality:'Best Available',label:'⭐ Best Quality (recommended)'}] } : null
    const defaultFormat = info ? info.formats[0] : null
    setItems(prev => {
      const hasEmpty = prev.some(it => !it.url.trim())
      if (hasEmpty) return prev.map(it => !it.url.trim() ? {...it,url,info,selectedFormat:defaultFormat,fetchStatus:info?'done':null,fetchPct:info?100:0,error:null} : it)
      return [...prev, {...newItem(),url,info,selectedFormat:defaultFormat,fetchStatus:info?'done':null,fetchPct:info?100:0,error:null}]
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const fetchOne = async (id) => {
    const item = items.find(it => it.id===id); if (!item?.url.trim()) return
    const t0 = Date.now()
    setItems(prev => prev.map(it => it.id===id ? {...it,fetchStatus:'fetching',fetchPct:0,error:null,info:null,fetchTime:null,fetchStart:t0} : it))
    let pct = 0
    const ticker = setInterval(() => { pct = Math.min(pct+Math.random()*8,88); setItems(prev => prev.map(it => it.id===id ? {...it,fetchPct:Math.round(pct)} : it)) }, 300)
    try {
      const res = await apiFetch(`${getApiBase()}/info`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:item.url.trim(),session_id:user?.session_id||null})})
      const data = await res.json(); clearInterval(ticker)
      if (!res.ok) throw new Error(data.detail||'Failed')
      const firstFmt = data.formats.find(f=>f.type==='video')||data.formats[0]
      setItems(prev => prev.map(it => it.id===id ? {...it,info:data,selectedFormat:firstFmt,error:null,fetchStatus:'done',fetchPct:100,fetchTime:((Date.now()-t0)/1000).toFixed(1)} : it))
    } catch(e) {
      clearInterval(ticker)
      setItems(prev => prev.map(it => it.id===id ? {...it,error:e.message,fetchStatus:'error',fetchPct:100,fetchTime:((Date.now()-t0)/1000).toFixed(1)} : it))
    }
  }

  const fetchAll = async () => {
    const pending = items.filter(it => it.url.trim() && !it.info); if (!pending.length) return
    setFetchingAll(true); setFetchTotal(pending.length)
    if (parallelFetch) { setFetchIndex(pending.length); await Promise.allSettled(pending.map(it=>fetchOne(it.id))) }
    else { for (let i=0;i<pending.length;i++) { setFetchIndex(i+1); await fetchOne(pending[i].id); if (i<pending.length-1) await new Promise(r=>setTimeout(r,1000)) } }
    setFetchingAll(false); setFetchIndex(0); setFetchTotal(0)
  }

  const refreshJobs = async () => {
    const active = jobsRef.current.filter(j => !['done','error'].includes(j.status))
    if (!active.length) return  // nothing active — don't poll
    try {
      const ids = active.map(j => j.jobId)
      const res = await apiFetch(`${getApiBase()}/download/status/batch`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(ids)
      })
      if (!res.ok) return
      const data = await res.json()
      setJobs(prev => prev.map(j => {
        if (j.status==='done'||j.status==='error') return j
        const d = data[j.jobId]
        if (!d) return j
        if (d.status==='done') return {...j,status:'done',progress:100,normProgress:100,downloadUrl:`${getApiBase()}/download/file/${j.jobId}`,outFilename:d.filename}
        if (d.status==='error') return {...j,status:'error',error:d.error}
        return {...j,status:d.status,progress:d.progress??j.progress,normProgress:d.normalize_progress??j.normProgress,title:d.title||j.title}
      }))
    } catch(_) {}
  }

  const allReady = items.every(it => it.info && it.selectedFormat)

  const _dispatchDownload = async (it) => {
    const res = await apiFetch(`${getApiBase()}/download/batch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{url:it.url.trim(),format_id:it.selectedFormat.format_id,session_id:user?.session_id||null}],norm_flags:doNormalize ? effectiveFlags() : null,output_ext:normConfig.outputExt||'same',codec:targetCodec,resolution:targetRes})})
    const data = await res.json()
    if (res.ok && data.jobs?.length) { const j=data.jobs[0]; return {jobId:j.job_id,url:j.url,title:it.info?.title||j.url,format:it.selectedFormat?.label||'',status:'queued',progress:0,normProgress:0,queue_position:j.queue_position,downloadUrl:null,outFilename:null,error:null} }
    return null
  }

  const startAll = async () => {
    const readyItems = items.filter(it=>it.info&&it.selectedFormat); if (!readyItems.length) return
    setDlTotal(readyItems.length); setDlIndex(0); setDlCountdown(0)
    try {
      if (parallelFetch) {
        setDlIndex(readyItems.length)
        const results = await Promise.allSettled(readyItems.map(it=>_dispatchDownload(it)))
        const newJobs = results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value)
        if (newJobs.length) { setJobs(prev=>[...newJobs,...prev]); startPolling(); setShowSettings(v => !v) }
      } else {
        const DELAY = 4000
        for (let i=0;i<readyItems.length;i++) {
          setDlIndex(i+1)
          try { const nj=await _dispatchDownload(readyItems[i]); if(nj){setJobs(prev=>[nj,...prev]);startPolling();setShowSettings(v => !v)} } catch(_){}
          if (i<readyItems.length-1) { let s=Math.ceil(DELAY/1000); setDlCountdown(s); const t=setInterval(()=>{s-=1;setDlCountdown(s);if(s<=0)clearInterval(t)},1000); await new Promise(r=>setTimeout(r,DELAY)); setDlCountdown(0) }
        }
      }
    } finally { setDlIndex(0); setDlTotal(0); setDlCountdown(0) }
  }

  const jobsRef = useRef([])
  useEffect(() => { jobsRef.current = jobs }, [jobs])

  // Poll queue status — fast when jobs active, 10s when idle
  const lastIdlePollRef = useRef(0)
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await apiFetch(`${getApiBase()}/queue/status`)
        if (r.ok) setQueueStatus(await r.json())
      } catch(_) {}
    }
    poll()
    const t = setInterval(() => {
      const hasActive = jobsRef.current.some(j => !['done','error'].includes(j.status))
      if (hasActive) {
        poll()
      } else {
        const now = Date.now()
        if (now - lastIdlePollRef.current > getPollMs("idle")) {
          lastIdlePollRef.current = now
          poll()
        }
      }
    }, 2000)
    return () => clearInterval(t)
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const allCurrent = jobsRef.current
      const active = allCurrent.filter(j=>!['done','error'].includes(j.status))
      if (!active.length) {
        clearInterval(pollRef.current)
        pollRef.current = null
        return
      }
      // Use batch endpoint — 1 request for all active jobs
      try {
        const ids = active.map(j=>j.jobId)
        const res = await apiFetch(`${getApiBase()}/download/status/batch`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(ids)
        })
        if (!res.ok) return
        const data = await res.json()
    setJobs(prev => {
      let u=[...prev]
      active.forEach(aj => {
        const jid = aj.jobId
        const d   = data[jid]
        if (!d) return
        u = u.map(j => {
          if(j.jobId!==jid) return j
          if(j.status==='done'||j.status==='error') return j
          if(d.status==='done'){
            const doneJob={...j,status:'done',progress:100,normProgress:100,downloadUrl:`${getApiBase()}/download/file/${jid}`,outFilename:d.filename}
            try {
              const hist = JSON.parse(localStorage.getItem('yt_dl_history')||'[]')
              if (!hist.find(h=>h.jobId===jid)) {
                hist.unshift({ jobId:jid, filename:d.filename, url:j.url, downloadUrl:`${getApiBase()}/download/file/${jid}`, doneAt: new Date().toLocaleString() })
                localStorage.setItem('yt_dl_history', JSON.stringify(hist.slice(0,50)))
              }
            } catch(_) {}
            return doneJob
          }
          if(d.status==='error'&&d.error==='Cancelled by user') return null
          if(d.status==='error') return {...j,status:'error',error:d.error}
          return {...j,status:d.status,
            progress:    Math.max(j.progress||0,     d.progress??j.progress),
            normProgress:Math.max(j.normProgress||0,  d.normalize_progress??j.normProgress),
            queue_position:d.queue_position??j.queue_position, title:d.title||j.title,
            started_at:      d.started_at      ?? j.started_at,
            norm_started_at: d.norm_started_at ?? j.norm_started_at,
          }
        })
      })
      return u.filter(Boolean)
    })
      } catch(_) {}
    }, getPollMs("download"))
  }, [])

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), [])

  const popupShownForCount = useRef(0)
  useEffect(() => {
    if (!jobs.length) return
    const active=jobs.filter(j=>!['done','error'].includes(j.status)).length
    const done=jobs.filter(j=>j.status==='done').length
    const total=jobs.length
    if (active===0&&done>0&&total===done+jobs.filter(j=>j.status==='error').length) {
      if (popupShownForCount.current!==total) { popupShownForCount.current=total; setTimeout(()=>setShowCompletion(true),800) }
    }
  }, [jobs])

  const activePreset = PRESETS.find(p=>p.id===normConfig.presetId)||PRESETS[2]
  const normPillLabel = activePreset.pill
  const extLabel = normConfig.outputExt==='same' ? 'mp4' : (normConfig.outputExt||'mp4')

  // ── Styles ─────────────────────────────────────────────────────────────
  const st = {
    app:     { height:'100vh', background: bgImage ? 'transparent' : '#141420', fontFamily:"'Space Grotesk',sans-serif", color:tx, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' },
    wrap:    { maxWidth:1200, margin:'0 auto', padding:'0 32px 40px', flex:1, overflowY:'auto', overflowX:'hidden', position:'relative', zIndex:1, WebkitOverflowScrolling:'touch' },
  }

  return (
    <div style={st.app}>
      <style>{`html,body{margin:0;padding:0;height:100%;overflow:hidden;scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.15)}`}</style>

      {/* ── BACKGROUND IMAGE LAYER ── */}
      {bgImage && (
        <div style={{
          position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
          backgroundImage:`url(${bgImage})`,
          backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat',
          filter:`brightness(${bgBrightness/100})`,
        }} />
      )}
      {/* Dark overlay when no bg image — lighter than before */}
      {!bgImage && (
        <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', background:'linear-gradient(135deg,#141420 0%,#1a1a2e 100%)' }} />
      )}

      {/* Hidden file input for bg image */}
      <input ref={bgFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
        const file = e.target.files?.[0]; if (!file) return
        const reader = new FileReader()
        reader.onload = ev => { setBgImage(ev.target.result); localStorage.setItem('yt_bg_image', ev.target.result) }
        reader.readAsDataURL(file)
        e.target.value = ''
      }} />

      {/* Radial glow */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(127,119,221,0.16) 0%, transparent 70%)' }} />

      {showCompletion && <CompletionPopup jobs={jobs} onClose={()=>setShowCompletion(false)} />}

      {/* ── OVERLAY for both panels ── */}
      {(showLocalPanel || showSettings) && (
        <div onClick={()=>{setShowLocalPanel(false);setShowSettings(false)}}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:150 }} />
      )}

      {/* ── LEFT PANEL — Local Normalizer ── */}
      <LocalPanel
        open={showLocalPanel}
        onClose={() => setShowLocalPanel(false)}
        isLocalMode={isLocalMode}
        normConfig={normConfig}
        apiFetchFn={(path, opts) => apiFetch(path, opts)}
        onSetSubtitleMode={(mode) => setNormConfig(c => ({ ...c, subtitleMode: mode }))}
        targetCodec={targetCodec}
        targetRes={targetRes}
        doNormalize={doNormalize}
      />

      {/* ── LEFT TAB ── */}
      {!showLocalPanel && (
        <div style={{
          position:'fixed', left:0, top:0, bottom:0,
          zIndex:140, display:'flex', alignItems:'center', pointerEvents:'none',
        }}>
          <div onClick={()=>setShowLocalPanel(true)} style={{
            writingMode:'vertical-rl', rotate:'180deg',
            background:'rgba(186,117,23,0.18)', border:'1px solid rgba(186,117,23,0.4)',
            borderLeft:'none', borderRadius:'0 8px 8px 0',
            padding:'12px 7px', fontSize:11, fontWeight:700,
            color:'#FAC775', cursor:'pointer', letterSpacing:'.08em', userSelect:'none',
            boxShadow:'2px 0 8px rgba(186,117,23,0.12)', pointerEvents:'all',
          }}>
            📁 LOCAL FILES
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL — Settings ── */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(v => !v)}
        normConfig={normConfig}
        setNormConfig={setNormConfig}
        isLocalMode={isLocalMode}
        apiFetchFn={(path, opts) => apiFetch(path, opts)}
        jobs={jobs}
        onRefreshJobs={refreshJobs}
        targetCodec={targetCodec}
        setTargetCodec={(v) => { setTargetCodec(v); localStorage.setItem('yt_target_codec', v) }}
        targetRes={targetRes}
        setTargetRes={(v) => { setTargetRes(v); localStorage.setItem('yt_target_res', v) }}
        doNormalize={doNormalize}
        setDoNormalize={setDoNormalize}
        onClearJobs={async () => {
          try { await apiFetch('/queue/clear-all', { method: 'POST' }) } catch(_) {}
          setJobs([])
          localStorage.removeItem('yt_dl_history')
        }}
        onClearQueued={() => {
          setJobs(prev => {
            const kept = prev.filter(j => j.status !== 'queued')
            // Remove queued entries from history too
            try {
              const hist = JSON.parse(localStorage.getItem('yt_dl_history') || '[]')
              const keptIds = new Set(kept.map(j => j.jobId))
              localStorage.setItem('yt_dl_history', JSON.stringify(hist.filter(h => keptIds.has(h.jobId))))
            } catch(_) {}
            return kept
          })
        }}
        onRemoveJob={(id) => {
          setJobs(prev => prev.filter(j => j.jobId !== id))
          try {
            const hist = JSON.parse(localStorage.getItem('yt_dl_history') || '[]')
            localStorage.setItem('yt_dl_history', JSON.stringify(hist.filter(h => h.jobId !== id)))
          } catch(_) {}
        }}
        bgImage={bgImage}
        bgBrightness={bgBrightness}
        setBgBrightness={setBgBrightness}
      />

      {/* ── RIGHT TAB ── */}
      {!showSettings && (
        <div style={{
          position:'fixed', right:0, top:0, bottom:0,
          zIndex:140, display:'flex', alignItems:'center', pointerEvents:'none',
        }}>
          <div onClick={()=>setShowSettings(true)} style={{
            writingMode:'vertical-rl',
            background:'rgba(127,119,221,0.18)', border:'1px solid rgba(127,119,221,0.4)',
            borderRight:'none', borderRadius:'8px 0 0 8px',
            padding:'12px 7px', fontSize:11, fontWeight:700,
            color:'#c4beff', letterSpacing:'.08em',
            cursor:'pointer', userSelect:'none',
            boxShadow:'-2px 0 8px rgba(127,119,221,0.12)', pointerEvents:'all',
            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
          }}>
            {jobs.length > 0 && (
              <span style={{
                writingMode:'horizontal-tb',
                background: jobs.some(j=>!['done','error'].includes(j.status)) ? '#ef4444' : '#10b981',
                color:'#fff', fontSize:9, fontWeight:700, borderRadius:'50%',
                width:16, height:16, lineHeight:'16px', textAlign:'center', display:'block',
              }}>
                {jobs.filter(j=>!['done','error'].includes(j.status)).length || jobs.filter(j=>j.status==='done').length}
              </span>
            )}
            {jobs.length > 0 ? '📥 DOWNLOADS' : '⚙ SETTINGS'}
          </div>
        </div>
      )}

      <div style={st.wrap}>
        {/* ── TOPBAR ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 0 10px', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#534AB7,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#fff' }}>▼</div>
            <span style={{ fontSize:17, fontWeight:600, letterSpacing:'-0.3px', color:tx }}>YT Downloader</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>setShowAdmin(true)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px', borderRadius:7, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontFamily:'inherit' }}>🔧 Admin</button>
            <button onClick={()=>setShowBE(true)} title="Backend URL" style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px', borderRadius:7, border: localStorage.getItem('yt_api_base') ? '1px solid rgba(127,119,221,0.4)' : '1px solid rgba(255,255,255,0.09)', background: localStorage.getItem('yt_api_base') ? 'rgba(127,119,221,0.12)' : 'rgba(255,255,255,0.04)', color: localStorage.getItem('yt_api_base') ? '#c4beff' : '#777', cursor:'pointer', fontFamily:'inherit' }}>🖥️ BE</button>
            <button onClick={()=>setShowAdvisory(true)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px', borderRadius:7, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.08)', color:'#93c5fd', cursor:'pointer', fontFamily:'inherit' }}>📋 Advisory</button>
            <button onClick={()=>setShowHealth(v=>!v)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px', borderRadius:7, border: showHealth ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(34,197,94,0.2)', background: showHealth ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.05)', color:'#22c55e', cursor:'pointer', fontFamily:'inherit' }}>● Health</button>
            <BgButton
              bgImage={bgImage}
              bgBrightness={bgBrightness}
              onUpload={()=>bgFileRef.current?.click()}
              onRemove={()=>{ setBgImage(null); localStorage.removeItem('yt_bg_image') }}
              onBrightness={v=>{ setBgBrightness(v); localStorage.setItem('yt_bg_brightness',v) }}
            />
            {user ? <UserAvatar user={user} onLogout={logout} /> : (
              <button onClick={()=>{const p=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:REDIRECT_URI,response_type:'code',scope:'openid email profile https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'consent'});window.location.href=`https://accounts.google.com/o/oauth2/v2/auth?${p}`}} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', background:'#fff', border:'none', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600, color:'#333', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
                <GoogleSVG /> Sign in with Google
              </button>
            )}
          </div>
        </div>
        {showAdmin && <AdminPanel onClose={()=>setShowAdmin(false)} />}
        {showBE    && <BackendModal onClose={()=>setShowBE(false)} />}

        {/* ── HERO ── */}
        <div style={{ textAlign:'center', padding:'24px 0 20px', position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:500, height:200, background:'radial-gradient(ellipse at 50% 0%,rgba(127,119,221,0.13) 0%,transparent 70%)', pointerEvents:'none' }} />
          <h1 style={{ fontSize:36, fontWeight:700, margin:'0 0 8px', letterSpacing:'-1px', lineHeight:1.15, position:'relative', zIndex:1, color:tx }}>
            Batch Download &amp; Normalize<br />
            <span style={{ background:'linear-gradient(90deg,#7F77DD,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>YouTube Videos in Parallel</span>
          </h1>
          <p style={{ fontSize:15, color:txMid, margin:'0 0 14px', position:'relative', zIndex:1 }}>Add URLs → Fetch All → Download simultaneously → ffmpeg normalize</p>

        </div>

        {/* ── AUTH NOTICE ── */}
        {user ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.18)', borderRadius:10, padding:'.6rem 1rem', marginBottom:'.65rem' }}>
            <div style={{ fontSize:12, color:'#10b981' }}>✓ Signed in as <strong>{user.email}</strong></div>
            <button onClick={()=>setShowCookieSetup(v=>!v)} style={{ fontSize:11, padding:'4px 12px', borderRadius:100, border:'1px solid rgba(245,158,11,0.2)', background:'rgba(245,158,11,0.06)', color:'#f59e0b', cursor:'pointer', fontFamily:'inherit' }}>
              🍪 {showCookieSetup?'Hide cookie setup':'Age-restricted setup'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.14)', borderRadius:10, padding:'.6rem 1rem', marginBottom:'.65rem', fontSize:14, color: bgImage && !bgDark ? '#92400e' : '#d97706' }}>
            🔒 Sign in with Google to download age-restricted videos
          </div>
        )}

        {user && showCookieSetup && <CookieSetup sessionId={user.session_id} onDone={()=>setShowCookieSetup(false)} onClose={()=>setShowCookieSetup(false)} />}

        {/* ── CODEC ADVISORY MODAL ── */}
        <CodecAdvisory open={showAdvisory} onClose={()=>setShowAdvisory(false)} />
        <HealthPanel open={showHealth} onClose={()=>setShowHealth(false)} apiFetchFn={apiFetch} />

        {/* ── OUTPUT FORMAT DROPDOWN — always visible ── */}
        <div style={{ background: bgImage ? (bgDark?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.5)') : 'rgba(83,74,183,0.08)', border:'1px solid rgba(127,119,221,0.22)', borderRadius:12, padding:'10px 14px', marginBottom:'.65rem', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#c4beff', textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap', flexShrink:0 }}>
            📤 Output format
          </div>
          <div style={{ flex:1 }}>
            <FormatDropdown
              value={normConfig.outputExt||'same'}
              onChange={(ext) => setNormConfig(v=>({...v,outputExt:ext}))}
            />
          </div>
        </div>

        {/* ── URL INPUTS — full width ── */}
        <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:14, padding:16, display:'flex', flexDirection:'column', gap:12, marginBottom:12, maxHeight: items.length > 5 ? 420 : 'none', overflowY: items.length > 5 ? 'auto' : 'visible' }}>
            {items.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginBottom:12 }} />}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:10, color:'#5555aa', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'1px 7px', ...T.mono }}>#{i+1}</span>
                </div>
                <UrlRow item={item} onChange={(key,val)=>updateItem(item.id,key,val)} onRemove={()=>removeItem(item.id)} canRemove={items.length>1}
                onOpenChannel={(plUrl) => { setChannelInitUrl(plUrl); setShowChannel(true) }} />
              </div>
            ))}
        </div>

        {/* ── MAIN ACTIONS — full width centre ── */}
        <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <button onClick={()=>setShowSearch(true)} style={{
            flex:1, minWidth:160, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:14, fontWeight:600, padding:'13px 18px', borderRadius:11,
            border:'1px solid rgba(127,119,221,0.35)', background:'rgba(127,119,221,0.14)', color:'#AFA9EC',
            cursor:'pointer', fontFamily:'inherit',
          }}>🔎 Search YouTube</button>
          <button onClick={()=>setShowChannel(true)} style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:14, fontWeight:600, padding:'13px 18px', borderRadius:11,
            border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171',
            cursor:'pointer', fontFamily:'inherit',
          }}>📺 Channel</button>
          <button onClick={startAll} disabled={dlTotal>0||!items.some(it=>it.info&&it.selectedFormat)} style={{
            flex:1, minWidth:160, display:'flex', alignItems:'center', justifyContent:'center', gap:8, position:'relative', overflow:'hidden',
            fontSize:14, fontWeight:700, padding:'13px 18px', borderRadius:11,
            border:'1px solid rgba(29,158,117,0.4)',
            background:(allReady&&items.some(it=>it.info)&&dlTotal===0)?'rgba(29,158,117,0.16)':'rgba(255,255,255,0.03)',
            color:(allReady&&items.some(it=>it.info)&&dlTotal===0)?T.te2:'#444',
            cursor:(dlTotal>0||!items.some(it=>it.info&&it.selectedFormat))?'not-allowed':'pointer',
            fontFamily:'inherit', opacity:(dlTotal>0||!items.some(it=>it.info&&it.selectedFormat))?0.5:1,
          }}>
            {dlTotal > 0 ? (
              <>
                <div style={{ position:'absolute', inset:0, zIndex:0, background:'rgba(0,0,0,0.2)', width:dlCountdown>0?`${((4-dlCountdown)/4)*100}%`:'100%', transition:'width 1s linear', borderRadius:11 }} />
                {parallelFetch ? <span style={{ position:'relative', zIndex:1 }}>⚡ Sending {dlTotal} in parallel…</span>
                  : dlCountdown > 0 ? <span style={{ position:'relative', zIndex:1 }}>⏱ Next in {dlCountdown}s · {dlIndex}/{dlTotal}</span>
                  : <span style={{ position:'relative', zIndex:1 }}>↓ Sending {dlIndex}/{dlTotal}…</span>}
              </>
            ) : <>⚡ Download All ({items.filter(it=>it.info&&it.selectedFormat).length})</>}
          </button>
        </div>


        <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={importUrls} style={{ display:'none' }} />
          {showSearch && <SearchPanel onAddUrl={addUrlFromSearch} onClose={()=>setShowSearch(false)} />}
          {showChannel && (
            <ChannelPanel
              open={showChannel}
              onClose={() => { setShowChannel(false); setChannelInitUrl('') }}
              apiFetchFn={(path, opts) => apiFetch(path, opts)}
              user={user}
              initialUrl={channelInitUrl}
              doNormalize={doNormalize}
              onToggleNormalize={() => setDoNormalize(v => !v)}
              onAddToQueue={(url, title) => {
                const id = Date.now() + Math.random()
                setItems(prev => [...prev, { id, url, info:null, selectedFormat:null, fetchError:null, fetching:false }])
              }}
            />
          )}
          <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, border:'1px dashed rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#999', cursor:'pointer', fontFamily:'inherit' }}>+ Add URL</button>
          <button onClick={()=>fileInputRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, border:'1px dashed rgba(99,102,241,0.28)', background:'rgba(99,102,241,0.05)', color:'#818cf8', cursor:'pointer', fontFamily:'inherit' }}>↑ Import JSON/CSV</button>
          <button onClick={fetchAll} disabled={fetchingAll||!items.some(it=>it.url.trim()&&!it.info)} style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            border:'1px solid rgba(127,119,221,0.3)', background:'rgba(127,119,221,0.09)', color:'#c4beff',
            opacity:(fetchingAll||!items.some(it=>it.url.trim()&&!it.info))?0.5:1,
          }}>
            {fetchingAll ? (parallelFetch?`⏳ Fetching all ${fetchTotal}…`:`⏳ Fetching ${fetchIndex}/${fetchTotal}…`) : `🔍 Fetch All (${items.filter(it=>it.url.trim()&&!it.info).length} pending)`}
          </button>
        </div>

        {/* ── FEATURE CARDS — 4 columns full width ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:32 }}>
          {[
            { icon:'🔑', bg:'rgba(245,158,11,0.1)',  title:'Google SSO',        desc:'Age-restricted videos' },
            { icon:'⚡', bg:'rgba(127,119,221,0.1)', title:'Parallel downloads', desc:'All URLs simultaneously' },
            { icon:'🎞️', bg:'rgba(29,158,117,0.1)', title:'ffmpeg normalize',   desc:normPillLabel },
            { icon:'🔒', bg:'rgba(186,117,23,0.1)',  title:'Fully local',        desc:'Saved on your machine' },
          ].map(f => (
            <div key={f.title} style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:12, padding:'12px 14px' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginBottom:7 }}>{f.icon}</div>
              <p style={{ margin:'0 0 3px', fontWeight:600, fontSize:14, color:tx }}>{f.title}</p>
              <p style={{ margin:0, fontSize:13, color:txMid }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
