import { useState, useRef, useCallback, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

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

// ── URL Row ────────────────────────────────────────────────────────────────
function UrlRow({ item, onChange, onRemove, canRemove }) {
  const { url, info, error, fetchStatus, fetchPct } = item
  const valid = isValidYT(url)
  const isFetching = fetchStatus === 'fetching'

  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{
          ...S.card, display:'flex', alignItems:'center', gap:8,
          padding:'6px 6px 6px 14px',
          borderColor: error ? 'rgba(239,68,68,0.35)'
                      : info  ? 'rgba(16,185,129,0.35)'
                      : valid ? 'rgba(139,92,246,0.25)'
                      :         'rgba(255,255,255,0.08)',
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
          {fetchStatus === 'error' && <span style={{ ...S.pill('#ef4444'), flexShrink:0 }}>✗ failed</span>}
        </div>

        {/* Fetch progress bar */}
        <MiniBar
          pct={fetchPct || 0}
          color={error ? '#ef4444' : '#8b5cf6'}
          label={error ? '✗ Fetch failed' : isFetching ? '⏳ Fetching video info…' : fetchStatus === 'done' ? '✓ Fetch complete' : ''}
          show={!!fetchStatus}
        />

        {/* Video preview */}
        {info && (
          <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
            <img src={info.thumbnail} alt="" style={{ width:60, height:36, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{info.title}</p>
              <p style={{ margin:0, fontSize:11, color:'#555' }}>{info.uploader} · {formatDuration(info.duration)}</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ fontSize:11, color:'#f87171', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'6px 10px' }}>
            ✗ {error}
          </div>
        )}

        {/* Format picker */}
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

// ── Format picker ──────────────────────────────────────────────────────────
function FormatPicker({ info, selected, onSelect }) {
  const [tab, setTab] = useState('video')
  const formats = (info?.formats || []).filter(f => tab === 'video' ? f.type === 'video' : f.type === 'audio')
  return (
    <div style={{ ...S.card, overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        {['video','audio'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:'10px', background: tab===t ? 'rgba(139,92,246,0.1)':'none',
            border:'none', borderBottom: tab===t ? '2px solid #8b5cf6':'2px solid transparent',
            color: tab===t ? '#a78bfa':'#555', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>
            {t === 'video' ? '🎬 Video' : '🎵 Audio'}
          </button>
        ))}
      </div>
      <div style={{ maxHeight:180, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:4 }}>
        {formats.map(fmt => {
          const sel = selected?.format_id === fmt.format_id
          return (
            <div key={fmt.format_id} onClick={() => onSelect(fmt)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8,
              cursor:'pointer', background: sel ? 'rgba(139,92,246,0.14)':'rgba(255,255,255,0.02)',
              border: sel ? '1px solid rgba(139,92,246,0.35)':'1px solid transparent',
            }}>
              <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, border:`2px solid ${sel?'#8b5cf6':'#444'}`, background:sel?'#8b5cf6':'none' }} />
              <span style={{ flex:1, fontSize:13, fontWeight:sel?500:400, color:sel?'#e8e8f0':'#aaa' }}>{fmt.label}</span>
              {fmt.filesize && <span style={{ ...S.mono, fontSize:10, color:'#444', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:4 }}>{formatSize(fmt.filesize)}</span>}
            </div>
          )
        })}
        {formats.length === 0 && <p style={{ fontSize:12, color:'#444', textAlign:'center', padding:16, margin:0 }}>No {tab} formats</p>}
      </div>
    </div>
  )
}

// ── Job card with per-video progress ──────────────────────────────────────
function JobCard({ job }) {
  const meta = PHASE[job.status] || PHASE.queued
  const dlDone = !['downloading','processing','queued'].includes(job.status)
  const isNorm = job.status === 'normalizing'
  const isDl   = job.status === 'downloading' || job.status === 'processing'
  const isQ    = job.status === 'queued'

  return (
    <div style={{ ...S.card, padding:'12px 14px' }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:meta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff', fontWeight:700, flexShrink:0 }}>
          {meta.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {job.title || job.url || '…'}
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
            <span style={{ fontSize:11, color:'#444', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:240, ...S.mono }}>
              {(job.url||'').replace('https://www.youtube.com/watch?v=','yt:')}
            </span>
            <span style={S.pill(meta.color)}>
              {isQ && job.queue_position > 0 ? `#${job.queue_position+1} in queue` : meta.label}
            </span>
          </div>
        </div>
        {job.status === 'done' && job.downloadUrl && (
          <a href={job.downloadUrl} download style={{
            background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)',
            borderRadius:8, color:'#34d399', fontSize:12, fontWeight:700,
            padding:'6px 14px', textDecoration:'none', flexShrink:0,
          }}>↓ Save</a>
        )}
      </div>

      {/* Download progress */}
      <MiniBar
        pct={isDl ? job.progress : dlDone && !isQ ? 100 : 0}
        color={isDl ? '#8b5cf6' : '#10b981'}
        label={isDl ? `↓ Downloading ${job.progress}%` : dlDone && !isQ ? '✓ Downloaded' : ''}
        show={!isQ && job.status !== 'error'}
      />

      {/* Normalize progress */}
      <MiniBar
        pct={isNorm ? job.normProgress : job.status === 'done' ? 100 : 0}
        color={isNorm ? '#3b82f6' : '#10b981'}
        label={isNorm ? `▶ Normalizing ${job.normProgress}%` : job.status === 'done' ? '✓ Normalized' : '▶ Normalize pending'}
        show={!isQ && !isDl && job.status !== 'error'}
      />

      {/* Output filename */}
      {job.status === 'done' && job.outFilename && (
        <div style={{ marginTop:6, fontSize:10, color:'#10b981', ...S.mono, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:5, padding:'3px 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          ✓ {job.outFilename}
        </div>
      )}

      {/* Error */}
      {job.status === 'error' && job.error && (
        <p style={{ margin:'6px 0 0', fontSize:11, color:'#f87171' }}>{job.error}</p>
      )}
    </div>
  )
}

// ── Queue badge (top-right) ────────────────────────────────────────────────
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
      {/* Overall progress bar */}
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

// ── Main App ───────────────────────────────────────────────────────────────
let _id = 1
const newItem = () => ({ id:_id++, url:'', info:null, selectedFormat:null, error:null, fetchStatus:null, fetchPct:0 })

export default function App() {
  const [items, setItems]         = useState(() => [newItem()])
  const [serverInfo, setServerInfo] = useState(null)
  const [fetchingAll, setFetchingAll] = useState(false)
  const [jobs, setJobs]           = useState([])
  const pollRef                   = useRef(null)

  useEffect(() => {
    fetch(`${API}/health`).then(r=>r.json()).then(setServerInfo).catch(()=>{})
  }, [])

  const updateItem = (id, key, val) =>
    setItems(prev => prev.map(it => it.id===id ? {...it, [key]:val} : it))

  const addItem    = () => setItems(prev => [...prev, newItem()])
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id!==id))

  const fetchOne = async (id) => {
    const item = items.find(it => it.id===id)
    if (!item?.url.trim()) return

    // Animate fetch progress 0→90% while waiting
    setItems(prev => prev.map(it => it.id===id ? {...it, fetchStatus:'fetching', fetchPct:0, error:null, info:null} : it))
    let pct = 0
    const ticker = setInterval(() => {
      pct = Math.min(pct + Math.random()*8, 88)
      setItems(prev => prev.map(it => it.id===id ? {...it, fetchPct:Math.round(pct)} : it))
    }, 300)

    try {
      const res  = await fetch(`${API}/info`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: item.url.trim() }),
      })
      const data = await res.json()
      clearInterval(ticker)
      if (!res.ok) throw new Error(data.detail || 'Failed')
      const firstFmt = data.formats.find(f=>f.type==='video') || data.formats[0]
      setItems(prev => prev.map(it => it.id===id
        ? { ...it, info:data, selectedFormat:firstFmt, error:null, fetchStatus:'done', fetchPct:100 }
        : it
      ))
    } catch(e) {
      clearInterval(ticker)
      setItems(prev => prev.map(it => it.id===id
        ? { ...it, error:e.message, fetchStatus:'error', fetchPct:100 }
        : it
      ))
    }
  }

  const fetchAll = async () => {
    const pending = items.filter(it => it.url.trim() && !it.info)
    if (!pending.length) return
    setFetchingAll(true)
    await Promise.allSettled(pending.map(it => fetchOne(it.id)))
    setFetchingAll(false)
  }

  const allReady = items.every(it => it.info && it.selectedFormat)

  const startAll = async () => {
    const payload = items.filter(it=>it.info&&it.selectedFormat).map(it=>({
      url: it.url.trim(),
      format_id: it.selectedFormat.format_id,
    }))
    if (!payload.length) return
    const res  = await fetch(`${API}/download/batch`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ items: payload }),
    })
    const data = await res.json()
    if (!res.ok) return

    const newJobs = data.jobs.map((j,i) => ({
      jobId: j.job_id, url: j.url,
      title: items.find(it=>it.url.trim()===j.url)?.info?.title || j.url,
      format: items.find(it=>it.url.trim()===j.url)?.selectedFormat?.label || '',
      status:'queued', progress:0, normProgress:0,
      queue_position: j.queue_position,
      downloadUrl:null, outFilename:null, error:null,
    }))
    setJobs(prev => [...newJobs, ...prev])
    startPolling([...newJobs, ...jobs])
  }

  const startPolling = useCallback((allJobs) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const active = allJobs.filter(j => !['done','error'].includes(j.status))
      if (!active.length) { clearInterval(pollRef.current); return }

      const results = await Promise.allSettled(
        active.map(j => fetch(`${API}/download/status/${j.jobId}`).then(r=>r.json()))
      )

      setJobs(prev => {
        let updated = [...prev]
        results.forEach((r,i) => {
          if (r.status !== 'fulfilled') return
          const data = r.value
          const jobId = active[i].jobId
          updated = updated.map(j => {
            if (j.jobId !== jobId) return j
            if (data.status === 'done') return {
              ...j, status:'done', progress:100, normProgress:100,
              downloadUrl:`${API}/download/file/${jobId}`, outFilename:data.filename,
            }
            if (data.status === 'error') return { ...j, status:'error', error:data.error }
            return { ...j, status:data.status,
              progress:data.progress??j.progress,
              normProgress:data.normalize_progress??j.normProgress,
              queue_position:data.queue_position??j.queue_position,
              title: data.title || j.title,
            }
          })
        })
        allJobs = updated
        return updated
      })
    }, 800)
  }, [])

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), [])

  return (
    <div style={S.app}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />

      {/* Queue badge — top right */}
      <QueueBadge jobs={jobs} />

      <div style={S.wrap}>
        {/* Header */}
        <header style={{ textAlign:'center', padding:'52px 0 32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>▼</div>
            <span style={{ fontSize:19, fontWeight:700, letterSpacing:'-0.4px' }}>YT Downloader</span>
          </div>
          <h1 style={{ fontSize:34, fontWeight:700, margin:'0 0 8px', letterSpacing:'-1.2px', lineHeight:1.15 }}>
            Batch Download &amp; Normalize<br />
            <span style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              YouTube Videos in Parallel
            </span>
          </h1>
          <p style={{ fontSize:14, color:'#666', margin:'0 0 12px' }}>
            Add URLs → Fetch All → Download simultaneously → ffmpeg normalize
          </p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:100, padding:'4px 14px', fontSize:11, color:'#555', ...S.mono }}>
            <span style={{ color:'#8b5cf6' }}>yt-dlp</span> → <span style={{ color:'#3b82f6' }}>libx264 · crf 19 · forced-idr 1</span> → <span style={{ color:'#10b981' }}>_normalize.mp4</span>
          </div>
          {serverInfo && (
            <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:100, padding:'4px 14px', fontSize:11, color:'#555', ...S.mono }}>
              <span>⚙ {serverInfo.max_workers} worker{serverInfo.max_workers>1?'s':''}</span>
              <span style={{ color:'rgba(255,255,255,0.1)' }}>|</span>
              <span>{serverInfo.cpu_count} CPU</span>
            </div>
          )}
        </header>

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
        <div style={{ display:'flex', gap:10, marginBottom:32 }}>
          <button onClick={addItem} style={{
            flex:'0 0 auto', padding:'11px 18px', borderRadius:10,
            border:'1px dashed rgba(255,255,255,0.15)',
            background:'rgba(255,255,255,0.02)', color:'#666',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>+ Add URL</button>

          <button onClick={fetchAll} disabled={fetchingAll || !items.some(it=>it.url.trim()&&!it.info)} style={{
            ...S.btn(!fetchingAll && items.some(it=>it.url.trim()&&!it.info)), flex:1,
          }}>
            {fetchingAll ? '⏳ Fetching…' : `🔍 Fetch All (${items.filter(it=>it.url.trim()&&!it.info).length} pending)`}
          </button>

          <button onClick={startAll} disabled={!allReady || !items.some(it=>it.info)} style={{
            ...S.btn(allReady && items.some(it=>it.info), '#10b981'), flex:1,
          }}>
            ⚡ Download All ({items.filter(it=>it.info&&it.selectedFormat).length})
          </button>
        </div>

        {/* Jobs list */}
        {jobs.length > 0 && (
          <div>
            <div style={{ fontSize:12, color:'#444', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:10 }}>
              Downloads
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
              { icon:'⚡', color:'#8b5cf6', title:'Parallel downloads',  desc:'All URLs process simultaneously' },
              { icon:'▶', color:'#3b82f6', title:'ffmpeg normalize',     desc:'libx264 · crf 19 · forced-idr 1' },
              { icon:'🌍', color:'#f59e0b', title:'Auto proxy',          desc:'Detects geo-block, fetches country proxies' },
              { icon:'🔒', color:'#10b981', title:'Fully local',         desc:'Files saved on your server' },
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
