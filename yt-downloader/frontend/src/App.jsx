import { useState, useRef, useCallback, useEffect } from 'react'
import AdminPanel from './AdminPanel.jsx'
import CookieSetup from './CookieSetup.jsx'
import SearchPanel from './SearchPanel.jsx'

// v3.0.0
const API = import.meta.env.VITE_API_URL || '/api'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '406747955382-digauab6tpgo7f9rr7sbl0qoajc01oub.apps.googleusercontent.com'
const REDIRECT_URI = window.location.origin

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
  bg: '#08080e',
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
  { id:'custom',   label:'✏️ Custom',       desc:'Your own ffmpeg flags',      flags:'',                                                          pill:'custom' },
]
const OUTPUT_FORMATS = [
  { ext:'same', label:'Same as source' },
  { ext:'mp4',  label:'.mp4' },
  { ext:'ts',   label:'.ts' },
  { ext:'mkv',  label:'.mkv' },
  { ext:'mov',  label:'.mov' },
]

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
function UrlRow({ item, onChange, onRemove, canRemove }) {
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
          <input value={url} onChange={e => onChange('url', e.target.value)} placeholder="https://youtube.com/watch?v=..."
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:15, color:'#f0f0ff', fontFamily:'inherit', padding:'9px 0' }} />
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
function CircleProgress({ pct, color, size=44, stroke=3, label, done }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={done?'#10b981':color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.4s ease' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:done?'#10b981':color, ...T.mono }}>
          {done ? '✓' : `${pct}%`}
        </div>
      </div>
      <span style={{ fontSize:9, color:'#555', fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

// ── JobCard ────────────────────────────────────────────────────────────────
function JobCard({ job }) {
  const meta = PHASE[job.status] || PHASE.queued
  const isQ = job.status==='queued', isDl = job.status==='downloading'||job.status==='processing'
  const isNorm = job.status==='normalizing', isDone = job.status==='done', isErr = job.status==='error'
  const dlPct = isDl ? job.progress : (isDone||isNorm) ? 100 : 0
  const normPct = isNorm ? job.normProgress : isDone ? 100 : 0
  return (
    <div style={{ ...T.card, padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:`${meta.color}22`, border:`1.5px solid ${meta.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:meta.color, flexShrink:0 }}>{meta.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{job.title||job.url||'…'}</p>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3 }}>
            <span style={{ fontSize:11, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200, ...T.mono }}>{(job.url||'').replace('https://www.youtube.com/watch?v=','yt:')}</span>
            <span style={{ fontSize:10, color:meta.color, background:`${meta.color}18`, border:`1px solid ${meta.color}33`, borderRadius:100, padding:'1px 7px', fontWeight:600, flexShrink:0 }}>{isQ&&job.queue_position>0?`#${job.queue_position+1} queued`:meta.label}</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {!isQ&&!isErr && <CircleProgress pct={dlPct} color='#8b5cf6' size={44} stroke={3} label="DL" done={dlPct===100} />}
          {!isQ&&!isErr&&!isDl && <CircleProgress pct={normPct} color='#3b82f6' size={44} stroke={3} label="NRM" done={normPct===100} />}
          {isDone&&job.downloadUrl && <a href={job.downloadUrl} download style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#34d399', fontSize:12, fontWeight:700, padding:'6px 14px', textDecoration:'none' }}>↓ Save</a>}
        </div>
      </div>
      {isDone&&job.outFilename && <div style={{ marginTop:8, fontSize:10, color:'#10b981', ...T.mono, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:5, padding:'3px 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✓ {job.outFilename}</div>}
      {isErr&&job.error && <p style={{ margin:'8px 0 0', fontSize:11, color:'#f87171', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6, padding:'6px 10px' }}>{job.error}</p>}
    </div>
  )
}

// ── QueueBadge ─────────────────────────────────────────────────────────────
function QueueBadge({ jobs }) {
  const queued = jobs.filter(j=>j.status==='queued').length
  const active = jobs.filter(j=>!['done','error','queued'].includes(j.status)).length
  const done   = jobs.filter(j=>j.status==='done').length
  const failed = jobs.filter(j=>j.status==='error').length
  const total  = jobs.length
  if (total === 0) return null
  return (
    <div style={{ position:'fixed', top:16, right:16, zIndex:100, background:'rgba(10,10,20,0.92)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'10px 16px', backdropFilter:'blur(12px)', display:'flex', flexDirection:'column', gap:6, minWidth:160, boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize:11, color:'#555', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase' }}>Queue</div>
      {[{label:'Active',val:active,color:'#8b5cf6'},{label:'Waiting',val:queued,color:'#f59e0b'},{label:'Done',val:done,color:'#10b981'},{label:'Failed',val:failed,color:'#ef4444'}].map(r => r.val > 0 && (
        <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#666' }}>{r.label}</span>
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
function LocalPanel({ open, onClose, isLocalMode, normConfig, apiFetchFn }) {
  const [paths, setPaths]           = useState('')
  const [recursive, setRecursive]   = useState(false)
  const [skipDone, setSkipDone]     = useState(true)
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning]     = useState(false)
  const [localJobs, setLocalJobs]   = useState([])

  async function handleScan() {
    const pathList = paths.split('\n').map(p=>p.trim()).filter(Boolean)
    if (!pathList.length) return
    setScanning(true); setScanResult(null)
    try {
      const res = await apiFetchFn('/normalize/local/scan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:pathList,recursive,skip_already_normalized:skipDone,output_ext:normConfig.outputExt||'same'}) })
      if (res.ok) setScanResult(await res.json())
    } catch(_) {} finally { setScanning(false) }
  }

  async function handleNormalize() {
    const pathList = paths.split('\n').map(p=>p.trim()).filter(Boolean)
    if (!pathList.length) return
    try {
      const res = await apiFetchFn('/normalize/local', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:pathList,norm_flags:normConfig.flags,output_ext:normConfig.outputExt||'same',recursive,skip_already_normalized:skipDone}) })
      if (res.ok) {
        const created = await res.json()
        setLocalJobs(prev => [...created.map(j=>({...j,status:'queued',normalize_progress:0,title:j.source_path.split(/[/\\]/).pop()})),...prev])
        setScanResult(null)
      }
    } catch(_) {}
  }

  const activeJobs = localJobs.filter(j=>j.status!=='done'&&j.status!=='error').length

  const panelStyle = {
    position:'fixed', left:0, top:0, height:'100vh', width:'min(280px,90vw)',
    background:'#0d0c16', borderRight:'1px solid rgba(186,117,23,0.2)',
    transform:open?'translateX(0)':'translateX(-100%)',
    transition:'transform .25s ease', zIndex:160,
    overflowY:'auto', display:'flex', flexDirection:'column',
  }
  const lbl = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, marginBottom:7 }
  const sdiv = { height:1, background:'rgba(186,117,23,0.12)', margin:'12px 0' }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 14px 11px', borderBottom:'1px solid rgba(186,117,23,0.15)', position:'sticky', top:0, background:'#0d0c16', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'#f0f0ff' }}>
          <span style={{ fontSize:18 }}>📁</span> Local Normalizer
          {activeJobs > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'#ef4444', borderRadius:100, padding:'1px 7px' }}>{activeJobs}</span>}
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
              style={{ width:'100%', background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'9px 11px', fontSize:12, ...T.mono, color:'#c8c8d8', outline:'none', resize:'vertical', minHeight:80, boxSizing:'border-box', marginBottom:8 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, color:'#888', marginBottom:8 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}><input type="checkbox" checked={recursive} onChange={e=>setRecursive(e.target.checked)} /> Scan subfolders recursively</label>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}><input type="checkbox" checked={skipDone} onChange={e=>setSkipDone(e.target.checked)} /> Skip already-normalized files</label>
            </div>
            <div style={{ fontSize:10, color:'#333', ...T.mono, lineHeight:1.6, marginBottom:10 }}>Supported: .mp4 .mkv .mov .avi .ts .m4v .wmv .flv .webm .mxf .mts .m2ts .mpg .mpeg .vob .3gp .ogv .rm .rmvb .asf .divx .f4v .dv .gxf .mj2 .qt .r3d</div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <button onClick={handleScan} disabled={scanning||!paths.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'7px 12px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#888', cursor:'pointer', fontFamily:'inherit' }}>🔍 {scanning?'Scanning…':'Preview'}</button>
              <button onClick={handleNormalize} disabled={!paths.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:7, border:'1px solid rgba(29,158,117,0.35)', background:'rgba(29,158,117,0.12)', color:T.te2, cursor:'pointer', fontFamily:'inherit' }}>▶ Normalize</button>
            </div>
            {scanResult && (
              <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'9px 11px', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'#6b6b88', marginBottom:5 }}>Found {scanResult.count} file{scanResult.count!==1?'s':''}</div>
                {scanResult.files.map((f,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, padding:'2px 0' }}>
                    <span style={{ color:'#c0c0d0', ...T.mono, fontWeight:500, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.source.split(/[/\\]/).pop()}</span>
                    <span style={{ color:'#333', fontSize:10 }}>{f.size_mb}MB</span>
                    <span style={{ color:T.pu3 }}>→</span>
                    <span style={{ color:T.te3, ...T.mono, fontSize:11 }}>{f.out.split(/[/\\]/).pop()}</span>
                  </div>
                ))}
              </div>
            )}
            {localJobs.length > 0 && (
              <>
                <div style={sdiv} />
                <div style={lbl}>Jobs</div>
                {localJobs.map(j => (
                  <div key={j.job_id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'7px 10px', marginBottom:5 }}>
                    <span style={{ fontSize:13, color:j.status==='done'?T.te3:j.status==='error'?'#ef4444':'#f59e0b' }}>{j.status==='done'?'✓':j.status==='error'?'✗':'⏳'}</span>
                    <span style={{ flex:1, fontSize:11, color:'#c0c0d0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.title}</span>
                    <span style={{ fontSize:10, color:'#555', ...T.mono }}>{j.status==='done'?'done':j.status==='error'?'err':`${j.normalize_progress||0}%`}</span>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#666' }}>
            🖥️ Not available — backend is in server mode.<br/>
            <span style={{ fontSize:11, color:'#444', marginTop:4, display:'block' }}>Set <code>LOCAL_MODE=true</code> in backend <code>.env</code></span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SettingsPanel (right slide panel) ─────────────────────────────────────
function SettingsPanel({ open, onClose, normConfig, setNormConfig, isLocalMode, apiFetchFn, jobs, onRefreshJobs, onClearJobs }) {
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

          {/* Encoding preset */}
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
                  <button onClick={onClearJobs} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#f87171', cursor:'pointer', fontFamily:'inherit' }}>✕ Clear</button>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {jobs.map(job => <JobCard key={job.jobId} job={job} />)}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
let _id = 1
const newItem = () => ({ id:_id++, url:'', info:null, selectedFormat:null, error:null, fetchStatus:null, fetchPct:0, fetchTime:null, fetchStart:null })

export default function App() {
  const [items, setItems]                   = useState(() => [newItem()])
  const [showAdmin, setShowAdmin]           = useState(false)
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
  const [isLocalMode, setIsLocalMode]       = useState(false)
  const pollRef    = useRef(null)
  const fileInputRef = useRef(null)

  const [normConfig, setNormConfig] = useState({
    presetId: 'hq',
    flags: '-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy',
    outputExt: 'same',
  })

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
      apiFetch(`${API}/auth/google`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code, redirect_uri:REDIRECT_URI}) })
        .then(async r => { const data = await r.json(); if (data.session_id) { const u={session_id:data.session_id,name:data.name,email:data.email,picture:data.picture}; setUser(u); localStorage.setItem('yt_session',JSON.stringify(u)) } }).catch(()=>{})
    }
    const stored = localStorage.getItem('yt_session')
    if (stored && !code) {
      try {
        const parsed = JSON.parse(stored)
        apiFetch(`${API}/auth/session/${parsed.session_id}`).then(r=>{if(r.ok)return r.json();throw new Error()}).then(()=>setUser(parsed)).catch(()=>localStorage.removeItem('yt_session'))
      } catch { localStorage.removeItem('yt_session') }
    }
    apiFetch(`${API}/config`).then(r=>r.ok?r.json():null).then(d=>{if(d)setIsLocalMode(!!d.local_mode)}).catch(()=>{})
  }, [])

  const logout = async () => {
    if (user?.session_id) await apiFetch(`${API}/auth/logout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:user.session_id})}).catch(()=>{})
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
      const res = await apiFetch(`${API}/info`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:item.url.trim(),session_id:user?.session_id||null})})
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
    if (!jobs.length) return
    const snapshot = [...jobs]
    const results = await Promise.allSettled(snapshot.map(j=>apiFetch(`${API}/download/status/${j.jobId}`).then(r=>r.json())))
    setJobs(prev => { let u=[...prev]; results.forEach((r,i)=>{ if(r.status!=='fulfilled')return; const d=r.value,jid=snapshot[i].jobId; u=u.map(j=>{ if(j.jobId!==jid)return j; if(d.status==='done')return{...j,status:'done',progress:100,normProgress:100,downloadUrl:`${API}/download/file/${jid}`,outFilename:d.filename}; if(d.status==='error')return{...j,status:'error',error:d.error}; return{...j,status:d.status,progress:d.progress??j.progress,normProgress:d.normalize_progress??j.normProgress,title:d.title||j.title} }) }); return u })
  }

  const allReady = items.every(it => it.info && it.selectedFormat)

  const _dispatchDownload = async (it) => {
    const res = await apiFetch(`${API}/download/batch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{url:it.url.trim(),format_id:it.selectedFormat.format_id,session_id:user?.session_id||null}],norm_flags:normConfig.flags,output_ext:normConfig.outputExt||'same'})})
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

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const allCurrent = jobsRef.current
      const active = allCurrent.filter(j=>!['done','error'].includes(j.status))
      if (!active.length) { clearInterval(pollRef.current); pollRef.current=null; return }
      const results = await Promise.allSettled(active.map(j=>apiFetch(`${API}/download/status/${j.jobId}`).then(r=>r.json())))
      setJobs(prev => { let u=[...prev]; results.forEach((r,i)=>{ if(r.status!=='fulfilled')return; const d=r.value,jid=active[i]?.jobId; if(!jid)return; u=u.map(j=>{ if(j.jobId!==jid)return j; if(d.status==='done')return{...j,status:'done',progress:100,normProgress:100,downloadUrl:`${API}/download/file/${jid}`,outFilename:d.filename}; if(d.status==='error')return{...j,status:'error',error:d.error}; return{...j,status:d.status,progress:d.progress??j.progress,normProgress:d.normalize_progress??j.normProgress,queue_position:d.queue_position??j.queue_position,title:d.title||j.title} }) }); return u })
    }, 800)
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
    app:     { minHeight:'100vh', background:T.bg, fontFamily:"'Space Grotesk',sans-serif", color:'#e8e8f0', overflowX:'hidden', overflowY:'auto' },
    wrap:    { maxWidth:860, margin:'0 auto', padding:'0 24px 80px' },
  }

  return (
    <div style={st.app}>
      <style>{`html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}`}</style>
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
        apiFetchFn={(path, opts) => apiFetch(`${API}${path}`, opts)}
      />

      {/* ── LEFT TAB ── */}
      {!showLocalPanel && (
        <div onClick={()=>setShowLocalPanel(true)} style={{
          position:'fixed', left:0, top:'50%', transform:'translateY(-50%)', zIndex:140,
          writingMode:'vertical-rl', rotate:'180deg',
          background:'rgba(186,117,23,0.12)', border:'1px solid rgba(186,117,23,0.25)',
          borderLeft:'none', borderRadius:'0 6px 6px 0',
          padding:'10px 6px', fontSize:9, fontWeight:700,
          color:'rgba(186,117,23,0.8)', cursor:'pointer', letterSpacing:'.07em', userSelect:'none',
        }}>
          📁 LOCAL FILES
        </div>
      )}

      {/* ── RIGHT PANEL — Settings ── */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(v => !v)}
        normConfig={normConfig}
        setNormConfig={setNormConfig}
        isLocalMode={isLocalMode}
        apiFetchFn={(path, opts) => apiFetch(`${API}${path}`, opts)}
        jobs={jobs}
        onRefreshJobs={refreshJobs}
        onClearJobs={() => setJobs([])}
      />

      {/* ── RIGHT TAB ── */}
      {!showSettings && (
        <div onClick={()=>setShowSettings(true)} style={{
          position:'fixed', right:0, top:'50%', transform:'translateY(-50%)', zIndex:140,
          display:'flex', flexDirection:'column', alignItems:'center', gap:0, cursor:'pointer', userSelect:'none', position:'fixed',
        }}>
          {jobs.length > 0 && (
            <div style={{
              position:'absolute', top:-8, left:-8, zIndex:2,
              width:18, height:18, borderRadius:'50%',
              background: jobs.some(j=>!['done','error'].includes(j.status)) ? '#ef4444' : '#10b981',
              color:'#fff', fontSize:9, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 0 2px #08080e',
            }}>
              {jobs.filter(j=>!['done','error'].includes(j.status)).length || jobs.filter(j=>j.status==='done').length}
            </div>
          )}
          <div style={{
            writingMode:'vertical-rl', background:'rgba(127,119,221,0.1)', border:'1px solid rgba(127,119,221,0.2)',
            borderRight:'none', borderRadius:'6px 0 0 6px', padding:'8px 5px', fontSize:9, fontWeight:700,
            color:'rgba(127,119,221,0.6)', letterSpacing:'.06em',
          }}>
            {jobs.length > 0 ? '📥 DOWNLOADS' : '⚙ SETTINGS'}
          </div>
        </div>
      )}

      <div style={st.wrap}>
        {/* ── TOPBAR ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 0 10px', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#534AB7,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#fff' }}>▼</div>
            <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.3px' }}>YT Downloader</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>setShowAdmin(true)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 11px', borderRadius:7, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontFamily:'inherit' }}>🔧 Admin</button>
            {user ? <UserAvatar user={user} onLogout={logout} /> : (
              <button onClick={()=>{const p=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:REDIRECT_URI,response_type:'code',scope:'openid email profile https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'consent'});window.location.href=`https://accounts.google.com/o/oauth2/v2/auth?${p}`}} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', background:'#fff', border:'none', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600, color:'#333', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
                <GoogleSVG /> Sign in with Google
              </button>
            )}
          </div>
        </div>
        {showAdmin && <AdminPanel onClose={()=>setShowAdmin(false)} />}

        {/* ── HERO ── */}
        <div style={{ textAlign:'center', padding:'24px 0 20px', position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:500, height:200, background:'radial-gradient(ellipse at 50% 0%,rgba(127,119,221,0.13) 0%,transparent 70%)', pointerEvents:'none' }} />
          <h1 style={{ fontSize:32, fontWeight:700, margin:'0 0 8px', letterSpacing:'-1px', lineHeight:1.15, position:'relative', zIndex:1 }}>
            Batch Download &amp; Normalize<br />
            <span style={{ background:'linear-gradient(90deg,#7F77DD,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>YouTube Videos in Parallel</span>
          </h1>
          <p style={{ fontSize:14, color:'#6b6b80', margin:'0 0 12px', position:'relative', zIndex:1 }}>Add URLs → Fetch All → Download simultaneously → ffmpeg normalize</p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:100, padding:'5px 16px', fontSize:12, ...T.mono, position:'relative', zIndex:1 }}>
            <span style={{ color:T.pu3 }}>yt-dlp</span>
            <span style={{ color:'#222' }}>→</span>
            <span style={{ color:T.pu3 }}>{normPillLabel}</span>
            <span style={{ color:'#222' }}>→</span>
            <span style={{ color:T.te3 }}>_normalize.{extLabel}</span>
          </div>
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
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.14)', borderRadius:10, padding:'.6rem 1rem', marginBottom:'.65rem', fontSize:13, color:'#d97706' }}>
            🔒 Sign in with Google to download age-restricted videos
          </div>
        )}

        {user && showCookieSetup && <CookieSetup sessionId={user.session_id} onDone={()=>setShowCookieSetup(false)} onClose={()=>setShowCookieSetup(false)} />}

        {/* ── OUTPUT FORMAT — always visible ── */}
        <div style={{ background:'rgba(83,74,183,0.1)', border:'1px solid rgba(127,119,221,0.25)', borderRadius:12, padding:'.85rem 1.1rem', marginBottom:'.65rem', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'#c4beff', textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap', flexShrink:0 }}>
            📤 Output format
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', flex:1 }}>
            {OUTPUT_FORMATS.map(f => {
              const active = (normConfig.outputExt||'same') === f.ext
              return (
                <button key={f.ext} onClick={()=>setNormConfig(v=>({...v,outputExt:f.ext}))} style={{
                  fontSize:12, ...T.mono, fontWeight:600, padding:'6px 13px', borderRadius:7, cursor:'pointer', transition:'all .15s',
                  border: active ? (f.ext==='same'?'1px solid rgba(127,119,221,0.4)':'1px solid rgba(29,158,117,0.35)') : '1px solid rgba(255,255,255,0.08)',
                  background: active ? (f.ext==='same'?'rgba(127,119,221,0.18)':'rgba(29,158,117,0.15)') : 'rgba(255,255,255,0.04)',
                  color: active ? (f.ext==='same'?T.pu2:T.te2) : '#555',
                }}>{f.label}</button>
              )
            })}
          </div>
          <button onClick={()=>setShowSettings(true)} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:500, padding:'5px 11px', borderRadius:7, border:'1px solid rgba(127,119,221,0.28)', background:'rgba(127,119,221,0.09)', color:T.pu2, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
            ⚙ Preset &amp; More
          </button>
        </div>

        {/* ── TOP ROW: Local Normalizer top-right ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:12, marginBottom:12, alignItems:'start' }}>

          {/* CENTRE — URL input */}
          <div style={{ ...T.card, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
            {items.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginBottom:12 }} />}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:10, color:'#5555aa', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'1px 7px', ...T.mono }}>#{i+1}</span>
                </div>
                <UrlRow item={item} onChange={(key,val)=>updateItem(item.id,key,val)} onRemove={()=>removeItem(item.id)} canRemove={items.length>1} />
              </div>
            ))}
          </div>

          {/* TOP RIGHT — Local Normalizer */}
          <LocalNormalizerCard
            isLocalMode={isLocalMode}
            normConfig={normConfig}
            apiFetchFn={(path, opts) => apiFetch(`${API}${path}`, opts)}
          />
        </div>

        {/* ── MAIN ACTIONS — full width centre ── */}
        <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <button onClick={()=>setShowSearch(true)} style={{
            flex:1, minWidth:160, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:14, fontWeight:600, padding:'13px 18px', borderRadius:11,
            border:'1px solid rgba(127,119,221,0.35)', background:'rgba(127,119,221,0.14)', color:'#AFA9EC',
            cursor:'pointer', fontFamily:'inherit',
          }}>🔎 Search YouTube</button>
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

        {/* ── SECONDARY ACTIONS ── */}
        <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={importUrls} style={{ display:'none' }} />
          {showSearch && <SearchPanel onAddUrl={addUrlFromSearch} onClose={()=>setShowSearch(false)} />}
          <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, border:'1px dashed rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#999', cursor:'pointer', fontFamily:'inherit' }}>+ Add URL</button>
          <button onClick={()=>fileInputRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, border:'1px dashed rgba(99,102,241,0.28)', background:'rgba(99,102,241,0.05)', color:'#818cf8', cursor:'pointer', fontFamily:'inherit' }}>↑ Import JSON/CSV</button>
          <button onClick={fetchAll} disabled={fetchingAll||!items.some(it=>it.url.trim()&&!it.info)} style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            border:'1px solid rgba(127,119,221,0.3)', background:'rgba(127,119,221,0.09)', color:'#c4beff',
            opacity:(fetchingAll||!items.some(it=>it.url.trim()&&!it.info))?0.5:1,
          }}>
            {fetchingAll ? (parallelFetch?`⏳ Fetching all ${fetchTotal}…`:`⏳ Fetching ${fetchIndex}/${fetchTotal}…`) : `🔍 Fetch All (${items.filter(it=>it.url.trim()&&!it.info).length} pending)`}
          </button>
          <button onClick={()=>setShowSettings(true)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, padding:'8px 13px', borderRadius:8, border:'1px solid rgba(127,119,221,0.25)', background:'rgba(127,119,221,0.08)', color:T.pu2, cursor:'pointer', fontFamily:'inherit' }}>⚙ Settings</button>
        </div>

        {/* ── FEATURE CARDS — 4 columns full width ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:32 }}>
          {[
            { icon:'🔑', bg:'rgba(245,158,11,0.1)',  title:'Google SSO',        desc:'Age-restricted videos' },
            { icon:'⚡', bg:'rgba(127,119,221,0.1)', title:'Parallel downloads', desc:'All URLs simultaneously' },
            { icon:'🎞️', bg:'rgba(29,158,117,0.1)', title:'ffmpeg normalize',   desc:normPillLabel },
            { icon:'🔒', bg:'rgba(186,117,23,0.1)',  title:'Fully local',        desc:'Saved on your machine' },
          ].map(f => (
            <div key={f.title} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginBottom:7 }}>{f.icon}</div>
              <p style={{ margin:'0 0 2px', fontWeight:600, fontSize:13, color:'#f0f0ff' }}>{f.title}</p>
              <p style={{ margin:0, fontSize:12, color:'#6b6b88' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
