import { useState, useRef, useCallback, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

// ── utils ──────────────────────────────────────────────────────────────────
function formatDuration(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}
function formatViews(n) {
  if (!n) return ''
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M views`
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K views`
  return `${n} views`
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
  queued:      { label: 'Waiting in queue', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '⏳' },
  downloading: { label: 'Downloading',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: '↓' },
  processing:  { label: 'Merging',      color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: '⚙' },
  normalizing: { label: 'Normalizing',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: '▶' },
  done:        { label: 'Done',         color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: '✓' },
  error:       { label: 'Error',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '✗' },
}

// ── styles ─────────────────────────────────────────────────────────────────
const S = {
  app:   { minHeight:'100vh', background:'#080810', fontFamily:"'Space Grotesk',sans-serif", color:'#e8e8f0' },
  wrap:  { maxWidth:920, margin:'0 auto', padding:'0 24px 80px', position:'relative', zIndex:1 },
  card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14 },
  mono:  { fontFamily:"'JetBrains Mono',monospace" },
  pill:  (color) => ({ fontSize:11, color, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:100, padding:'2px 9px', fontWeight:600 }),
  btn:   (active) => ({
    border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700,
    padding:'11px 22px', cursor: active ? 'pointer':'not-allowed', fontFamily:'inherit',
    background: active ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#1c1c2a',
    opacity: active ? 1 : 0.5, transition:'opacity 0.2s',
  }),
}

// ── URL input row ──────────────────────────────────────────────────────────
function UrlRow({ value, onChange, onRemove, onFetch, fetching, info, canRemove }) {
  const valid = isValidYT(value)
  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{
          ...S.card, display:'flex', alignItems:'center', gap:8,
          padding:'6px 6px 6px 14px',
          borderColor: info ? 'rgba(16,185,129,0.3)' : valid ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize:16, flexShrink:0 }}>🔗</span>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key==='Enter' && onFetch()}
            placeholder="https://youtube.com/watch?v=..."
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'#e8e8f0', fontFamily:'inherit', padding:'8px 0' }}
          />
          {info && <span style={S.pill('#10b981')}>✓ Ready</span>}
          <button onClick={onFetch} disabled={fetching || !value.trim()} style={{
            background: fetching ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
            border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:600,
            padding:'8px 16px', cursor: fetching?'not-allowed':'pointer', fontFamily:'inherit', flexShrink:0,
          }}>
            {fetching ? '…' : 'Fetch'}
          </button>
        </div>
        {/* Mini video preview */}
        {info && (
          <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
            <img src={info.thumbnail} alt="" style={{ width:60, height:36, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{info.title}</p>
              <p style={{ margin:0, fontSize:11, color:'#555' }}>{info.uploader} · {formatDuration(info.duration)}</p>
            </div>
          </div>
        )}
      </div>
      {canRemove && (
        <button onClick={onRemove} style={{
          width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)',
          background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:16, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2,
        }}>×</button>
      )}
    </div>
  )
}

// ── Format picker ─────────────────────────────────────────────────────────
function FormatPicker({ info, selected, onSelect }) {
  const [tab, setTab] = useState('video')
  const formats = (info?.formats || []).filter(f => tab==='video' ? f.type==='video' : f.type==='audio')
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
            {t==='video' ? '🎬 Video' : '🎵 Audio'}
          </button>
        ))}
      </div>
      <div style={{ maxHeight:200, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:4 }}>
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
        {formats.length===0 && <p style={{ fontSize:12, color:'#444', textAlign:'center', padding:16, margin:0 }}>No {tab} formats</p>}
      </div>
    </div>
  )
}

// ── Dual progress ─────────────────────────────────────────────────────────
function DualProgress({ status, progress, normProgress }) {
  if (status==='done' || status==='error' || status==='queued') return null
  const dlDone = !['downloading','processing'].includes(status)
  const isNorm = status==='normalizing'
  return (
    <div style={{ marginTop:8 }}>
      {[
        { label: dlDone ? '✓ Downloaded' : `↓ Downloading`, color: dlDone ? '#10b981':'#8b5cf6', pct: dlDone ? 100 : progress, active: !dlDone },
        { label: isNorm ? '▶ Normalizing (libx264 · crf 19 · forced-idr 1)' : '▶ Normalize (pending)', color: isNorm ? '#3b82f6':'#333', pct: isNorm ? normProgress : 0, active: isNorm },
      ].map((bar, i) => (
        <div key={i} style={{ marginBottom:i===0?6:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
            <span style={{ fontSize:10, color:bar.color, fontWeight:600 }}>{bar.label}</span>
            <span style={{ ...S.mono, fontSize:10, color:'#444' }}>{bar.active || dlDone && i===0 ? `${bar.pct}%` : '—'}</span>
          </div>
          <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:100, height:3 }}>
            <div style={{ height:'100%', borderRadius:100, background:bar.color, width:`${bar.pct}%`, transition:'width 0.4s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────
function JobCard({ job }) {
  const meta = PHASE[job.status] || PHASE.queued
  const queueLabel = job.status === 'queued'
    ? (job.queue_position > 0 ? `#${job.queue_position + 1} in queue` : 'Starting soon…')
    : meta.label
  return (
    <div style={{ ...S.card, padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:meta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff', fontWeight:700, flexShrink:0 }}>
          {meta.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {job.title || job.url || 'Fetching…'}
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
            <span style={{ fontSize:11, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260, ...S.mono }}>
              {(job.url||'').replace('https://www.youtube.com/watch?v=','yt:')}
            </span>
            <span style={S.pill(meta.color)}>{queueLabel}</span>
          </div>
        </div>
        {job.status==='done' && job.downloadUrl && (
          <a href={job.downloadUrl} download style={{
            background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)',
            borderRadius:8, color:'#34d399', fontSize:12, fontWeight:700,
            padding:'6px 12px', textDecoration:'none', flexShrink:0,
          }}>↓ Save</a>
        )}
        {job.status==='error' && <span style={{ fontSize:11, color:'#f87171', flexShrink:0 }}>Failed</span>}
      </div>
      <DualProgress status={job.status} progress={job.progress} normProgress={job.normProgress} />
      {job.status==='done' && job.outFilename && (
        <div style={{ marginTop:6, fontSize:10, color:'#10b981', ...S.mono, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:5, padding:'3px 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          ✓ {job.outFilename}
        </div>
      )}
      {job.status==='error' && job.error && (
        <p style={{ margin:'6px 0 0', fontSize:11, color:'#f87171' }}>{job.error}</p>
      )}
    </div>
  )
}

// ── Batch queue panel ─────────────────────────────────────────────────────
function QueuePanel({ items, onItemChange, onAddItem, onRemoveItem, onFetchInfo, fetchingIdx, allReady, onStartAll }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {items.map((item, i) => (
        <div key={item.id} style={{ ...S.card, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ ...S.mono, fontSize:11, color:'#555', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'2px 8px', flexShrink:0 }}>
              #{i+1}
            </span>
            {item.info && <span style={S.pill('#10b981')}>✓ ready</span>}
            {item.error && <span style={S.pill('#ef4444')}>✗ {item.error}</span>}
          </div>
          <UrlRow
            value={item.url}
            onChange={v => onItemChange(item.id, 'url', v)}
            onRemove={() => onRemoveItem(item.id)}
            onFetch={() => onFetchInfo(item.id)}
            fetching={fetchingIdx === item.id}
            info={item.info}
            canRemove={items.length > 1}
          />
          {item.info && (
            <div style={{ marginTop:10 }}>
              <FormatPicker
                info={item.info}
                selected={item.selectedFormat}
                onSelect={fmt => onItemChange(item.id, 'selectedFormat', fmt)}
              />
            </div>
          )}
        </div>
      ))}

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onAddItem} style={{
          flex:1, padding:'11px', borderRadius:10, border:'1px dashed rgba(255,255,255,0.15)',
          background:'rgba(255,255,255,0.02)', color:'#666', fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
        }}>
          + Add URL
        </button>
        <button onClick={onStartAll} disabled={!allReady} style={{ ...S.btn(allReady), flex:2 }}>
          {allReady
            ? `⚡ Download & Normalize All (${items.filter(x=>x.info&&x.selectedFormat).length})`
            : 'Fetch all URLs first'}
        </button>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────
let idCounter = 1
const newItem = () => ({ id: idCounter++, url:'', info:null, selectedFormat:null, error:null })

export default function App() {
  const [serverInfo, setServerInfo] = useState(null)

  useEffect(() => {
    fetch(`${API}/health`).then(r=>r.json()).then(d => setServerInfo(d)).catch(()=>{})
  }, [])
  const [fetchingId, setFetchingId] = useState(null)
  const [jobs, setJobs] = useState([])            // active/done jobs
  const pollRef = useRef(null)

  // ── item helpers ──────────────────────────────────────────────────────
  const updateItem = (id, key, val) =>
    setItems(prev => prev.map(it => it.id===id ? {...it, [key]:val} : it))

  const addItem = () => setItems(prev => [...prev, newItem()])

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id!==id))

  const fetchInfo = async (id) => {
    const item = items.find(it => it.id===id)
    if (!item || !item.url.trim()) return
    setFetchingId(id)
    updateItem(id, 'error', null)
    try {
      const res = await fetch(`${API}/info`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: item.url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      const firstFmt = data.formats.find(f=>f.type==='video') || data.formats[0]
      setItems(prev => prev.map(it => it.id===id
        ? { ...it, info:data, selectedFormat:firstFmt, error:null }
        : it
      ))
    } catch(e) {
      updateItem(id, 'error', e.message)
    } finally {
      setFetchingId(null)
    }
  }

  const allReady = items.every(it => it.info && it.selectedFormat)

  // ── start all downloads in one batch call ─────────────────────────────
  const startAll = async () => {
    const payload = items.map(it => ({
      url: it.url.trim(),
      format_id: it.selectedFormat.format_id,
    }))
    const res = await fetch(`${API}/download/batch`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ items: payload }),
    })
    const data = await res.json()
    if (!res.ok) { console.error(data); return }

    const newJobs = data.jobs.map((j, i) => ({
      jobId: j.job_id,
      url: j.url,
      title: items[i]?.info?.title || j.url,
      format: items[i]?.selectedFormat?.label || '',
      status: 'queued',
      progress: 0,
      normProgress: 0,
      downloadUrl: null,
      outFilename: null,
      error: null,
    }))
    setJobs(prev => [...newJobs, ...prev])
    startPolling([...newJobs, ...jobs])
  }

  // ── polling ───────────────────────────────────────────────────────────
  const startPolling = useCallback((allJobs) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const active = allJobs.filter(j => !['done','error'].includes(j.status))
      if (active.length === 0) { clearInterval(pollRef.current); return }

      // Fetch all active job statuses in parallel
      const results = await Promise.allSettled(
        active.map(j => fetch(`${API}/download/status/${j.jobId}`).then(r => r.json()))
      )

      setJobs(prev => {
        let updated = [...prev]
        results.forEach((r, i) => {
          if (r.status !== 'fulfilled') return
          const data = r.value
          const jobId = active[i].jobId
          updated = updated.map(j => {
            if (j.jobId !== jobId) return j
            if (data.status === 'done') {
              return { ...j, status:'done', progress:100, normProgress:100,
                downloadUrl:`${API}/download/file/${jobId}`, outFilename:data.filename }
            }
            if (data.status === 'error') {
              return { ...j, status:'error', error:data.error }
            }
            return { ...j, status:data.status, progress:data.progress??j.progress, normProgress:data.normalize_progress??j.normProgress, queue_position:data.queue_position??j.queue_position }
          })
        })
        // Restart polling with fresh state
        allJobs = updated
        return updated
      })
    }, 800)
  }, [])

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), [])

  // ── stats ─────────────────────────────────────────────────────────────
  const stats = {
    total:   jobs.length,
    done:    jobs.filter(j=>j.status==='done').length,
    active:  jobs.filter(j=>!['done','error','queued'].includes(j.status)).length,
    queued:  jobs.filter(j=>j.status==='queued').length,
    failed:  jobs.filter(j=>j.status==='error').length,
  }

  return (
    <div style={S.app}>
      {/* ambient glow */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />

      <div style={S.wrap}>
        {/* Header */}
        <header style={{ textAlign:'center', padding:'52px 0 36px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>▼</div>
            <span style={{ fontSize:19, fontWeight:700, letterSpacing:'-0.4px' }}>YT Downloader</span>
          </div>
          <h1 style={{ fontSize:36, fontWeight:700, margin:'0 0 8px', letterSpacing:'-1.3px', lineHeight:1.15 }}>
            Batch Download &amp; Normalize<br />
            <span style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              YouTube Videos in Parallel
            </span>
          </h1>
          <p style={{ fontSize:14, color:'#666', margin:'0 0 14px' }}>
            Add multiple URLs → Fetch → Download all simultaneously → ffmpeg normalize
          </p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:100, padding:'4px 14px', fontSize:11, color:'#555', ...S.mono }}>
            <span style={{ color:'#8b5cf6' }}>yt-dlp</span> → <span style={{ color:'#3b82f6' }}>libx264 · crf 19 · forced-idr 1</span> → <span style={{ color:'#10b981' }}>_normalize.mp4</span>
          </div>
          {serverInfo && (
            <div style={{ marginTop:10, display:'inline-flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:100, padding:'4px 14px', fontSize:11, color:'#555', ...S.mono }}>
              <span>⚙ {serverInfo.max_workers} worker{serverInfo.max_workers>1?'s':''}</span>
              <span style={{ color:'rgba(255,255,255,0.15)' }}>|</span>
              <span>{serverInfo.cpu_count} CPU</span>
              <span style={{ color:'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: serverInfo.active_jobs > 0 ? '#8b5cf6':'#555' }}>{serverInfo.active_jobs} active</span>
              {serverInfo.queued_jobs > 0 && <><span style={{ color:'rgba(255,255,255,0.15)' }}>|</span><span style={{ color:'#f59e0b' }}>{serverInfo.queued_jobs} waiting</span></>}
            </div>
          )}
        </header>

        {/* Batch input panel */}
        <QueuePanel
          items={items}
          onItemChange={updateItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onFetchInfo={fetchInfo}
          fetchingIdx={fetchingId}
          allReady={allReady && items.some(it=>it.info)}
          onStartAll={startAll}
        />

        {/* Jobs queue */}
        {jobs.length > 0 && (
          <div style={{ marginTop:36 }}>
            {/* Stats bar */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { label:'Total',   val:stats.total,  color:'#555' },
                { label:'Active',  val:stats.active, color:'#8b5cf6' },
                { label:'Queued',  val:stats.queued, color:'#f59e0b' },
                { label:'Done',    val:stats.done,   color:'#10b981' },
                { label:'Failed',  val:stats.failed, color:'#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 16px', textAlign:'center', minWidth:70 }}>
                  <p style={{ margin:0, fontSize:20, fontWeight:700, color:s.color, ...S.mono }}>{s.val}</p>
                  <p style={{ margin:0, fontSize:11, color:'#444' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {jobs.map(job => <JobCard key={job.jobId} job={job} />)}
            </div>
          </div>
        )}

        {/* Empty state features */}
        {jobs.length === 0 && (
          <div style={{ display:'flex', gap:10, marginTop:48, flexWrap:'wrap' }}>
            {[
              { icon:'⚡', color:'#8b5cf6', title:'Parallel downloads', desc:'All URLs process simultaneously in a thread pool' },
              { icon:'▶', color:'#3b82f6', title:'ffmpeg normalize',    desc:'libx264 · crf 19 · forced-idr 1 per file' },
              { icon:'🎵', color:'#ec4899', title:'Audio pass-through', desc:'-c:a copy, zero re-encode loss' },
              { icon:'🔒', color:'#10b981', title:'Fully local',        desc:'Files stay on your server / machine' },
            ].map(f => (
              <div key={f.title} style={{ flex:'1 1 180px', ...S.card, padding:'16px 14px' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:`${f.color}18`, border:`1px solid ${f.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginBottom:10, color:f.color }}>{f.icon}</div>
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
