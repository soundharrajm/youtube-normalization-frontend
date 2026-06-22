import { useState, useRef } from 'react'

const S = {
  pu: '#7c6af7', green: '#22c55e', red: '#ef4444',
  bg: '#0f0f17', card: '#1a1a2a', border: 'rgba(255,255,255,0.08)',
  text: '#e2e2f0', sub: '#64748b',
}

function VideoCard({ video, selected, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: 180, flexShrink: 0, cursor: 'pointer',
      border: `1.5px solid ${selected ? S.pu : 'transparent'}`,
      borderRadius: 10, overflow: 'hidden',
      background: selected ? 'rgba(124,106,247,0.10)' : 'rgba(255,255,255,0.02)',
      transition: 'all .15s', position: 'relative',
    }}>
      {/* Checkbox */}
      <div style={{ position:'absolute', top:6, left:6, zIndex:2, width:18, height:18, borderRadius:5, border:`2px solid ${selected?S.pu:'rgba(255,255,255,0.5)'}`, background:selected?S.pu:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {selected && <span style={{ color:'#fff', fontSize:11, fontWeight:800, lineHeight:1 }}>✓</span>}
      </div>

      {/* Thumbnail */}
      <div style={{ position:'relative', width:'100%', paddingTop:'56.25%', background:'#111' }}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#333', fontSize:24 }}>🎬</div>
        }
        {video.duration && (
          <div style={{ position:'absolute', bottom:4, right:4, background:'rgba(0,0,0,0.8)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3, fontFamily:'monospace' }}>
            {video.duration}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'8px 8px 6px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:S.text, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {video.title}
        </div>
        {video.upload_date && (
          <div style={{ fontSize:10, color:S.sub, marginTop:3 }}>
            {video.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
          </div>
        )}
      </div>
    </div>
  )
}

function PlaylistRow({ playlist, selected, onToggle, onSelectAll, onDeselectAll }) {
  const scrollRef = useRef(null)
  const allSelected = playlist.videos.every(v => selected.has(v.id))
  const someSelected = playlist.videos.some(v => selected.has(v.id))

  const scroll = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 400, behavior: 'smooth' })
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontSize:14, fontWeight:700, color:S.text }}>{playlist.title}</span>
        <span style={{ fontSize:11, color:S.sub }}>({playlist.videos.length})</span>
        <button onClick={allSelected ? onDeselectAll : onSelectAll}
          style={{ fontSize:10, padding:'2px 8px', borderRadius:5, border:`1px solid ${allSelected?'rgba(239,68,68,0.3)':'rgba(124,106,247,0.3)'}`, background:allSelected?'rgba(239,68,68,0.07)':'rgba(124,106,247,0.07)', color:allSelected?'#f87171':S.pu, cursor:'pointer', fontFamily:'inherit' }}>
          {allSelected ? '☐ Deselect all' : '☑ Select all'}
        </button>
        {/* Scroll arrows */}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button onClick={()=>scroll(-1)} style={{ width:24, height:24, borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontSize:12 }}>‹</button>
          <button onClick={()=>scroll(1)}  style={{ width:24, height:24, borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontSize:12 }}>›</button>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div ref={scrollRef} style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent' }}>
        {playlist.videos.map(v => (
          <VideoCard key={v.id} video={v} selected={selected.has(v.id)} onToggle={() => onToggle(v.id)} />
        ))}
      </div>
    </div>
  )
}

export default function ChannelPanel({ open, onClose, apiFetchFn, user, onAddToQueue, doNormalize, onToggleNormalize }) {
  const [url,      setUrl]      = useState('')
  const [limit,    setLimit]    = useState(100)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [adding,   setAdding]   = useState(false)
  const [added,    setAdded]    = useState(0)
  const [filter,   setFilter]   = useState('')

  if (!open) return null

  const totalSelected = selected.size

  const toggleOne = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectPlaylist   = (pl) => setSelected(s => { const n = new Set(s); pl.videos.forEach(v => n.add(v.id)); return n })
  const deselectPlaylist = (pl) => setSelected(s => { const n = new Set(s); pl.videos.forEach(v => n.delete(v.id)); return n })

  const selectAll   = () => {
    const ids = new Set()
    ;(result?.playlists||[]).forEach(pl => pl.videos.forEach(v => ids.add(v.id)))
    setSelected(ids)
  }
  const deselectAll = () => setSelected(new Set())

  // Filter playlists
  const filteredPlaylists = (result?.playlists || []).map(pl => ({
    ...pl,
    videos: filter ? pl.videos.filter(v => v.title.toLowerCase().includes(filter.toLowerCase())) : pl.videos,
  })).filter(pl => pl.videos.length > 0)

  async function fetchChannel() {
    if (!url.trim()) return
    setLoading(true); setResult(null); setError(null); setSelected(new Set()); setAdded(0)
    try {
      const res = await apiFetchFn('/channel/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), limit, session_id: user?.session_id || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'Failed')
      setResult(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function addSelected() {
    const allVids = (result?.playlists||[]).flatMap(pl => pl.videos)
    const toAdd   = allVids.filter(v => selected.has(v.id))
    if (!toAdd.length) return
    setAdding(true); setAdded(0)
    for (const v of toAdd) {
      onAddToQueue(v.url, v.title)
      setAdded(n => n + 1)
      await new Promise(r => setTimeout(r, 60))
    }
    setAdding(false); setSelected(new Set())
  }

  const btnBase = { padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:54 }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'92vw', maxWidth:1100, maxHeight:'90vh', background:S.bg, border:`1px solid rgba(124,106,247,0.3)`, borderRadius:16, display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.7)', overflow:'hidden', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:22 }}>📺</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:S.text }}>
              {result ? result.channel_name : 'Channel Browser'}
            </div>
            <div style={{ fontSize:11, color:S.sub }}>
              {result ? `${result.total} videos · ${result.playlists?.length} sections` : 'Paste a channel or playlist URL'}
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#555', fontSize:14, cursor:'pointer' }}>✕</button>
        </div>

        {/* URL bar */}
        <div style={{ padding:'12px 20px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', gap:8 }}>
            <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchChannel()}
              placeholder="https://www.youtube.com/@ChannelName"
              style={{ flex:1, background:'rgba(0,0,0,0.35)', border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', fontSize:13, color:S.text, outline:'none', fontFamily:'inherit' }} />
            <select value={limit} onChange={e=>setLimit(Number(e.target.value))}
              style={{ background:'rgba(0,0,0,0.35)', border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 10px', fontSize:12, color:S.text, outline:'none', cursor:'pointer' }}>
              <option value={50}>50 videos</option>
              <option value={100}>100 videos</option>
              <option value={200}>200 videos</option>
              <option value={500}>500 videos</option>
              <option value={0}>All (slow)</option>
            </select>
            <button onClick={fetchChannel} disabled={loading||!url.trim()}
              style={{ ...btnBase, background:S.pu, color:'#fff', opacity:loading||!url.trim()?0.6:1, minWidth:100 }}>
              {loading ? '⏳ Loading…' : '🔍 Fetch'}
            </button>
          </div>
          {error && <div style={{ marginTop:8, padding:'7px 12px', borderRadius:7, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#f87171' }}>⚠️ {error}</div>}
        </div>

        {/* Controls bar — only when results loaded */}
        {result && (
          <div style={{ padding:'8px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
            {/* Select all / deselect all */}
            <button onClick={selectAll} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid rgba(124,106,247,0.3)`, background:'rgba(124,106,247,0.08)', color:S.pu, cursor:'pointer', fontFamily:'inherit' }}>☑ Select All</button>
            <button onClick={deselectAll} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.03)', color:S.sub, cursor:'pointer', fontFamily:'inherit' }}>☐ Deselect All</button>

            {/* Filter */}
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter titles…"
              style={{ width:160, background:'rgba(0,0,0,0.3)', border:`1px solid ${S.border}`, borderRadius:6, padding:'4px 10px', fontSize:11, color:S.text, outline:'none', fontFamily:'inherit' }} />

            {/* Normalize toggle */}
            <div onClick={onToggleNormalize} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:7, border:`1px solid ${doNormalize?'rgba(124,106,247,0.3)':S.border}`, background:doNormalize?'rgba(124,106,247,0.07)':'rgba(255,255,255,0.02)', cursor:'pointer' }}>
              <div style={{ width:28, height:16, borderRadius:8, background:doNormalize?S.pu:'rgba(255,255,255,0.15)', position:'relative', transition:'background .2s', flexShrink:0 }}>
                <div style={{ width:12, height:12, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:doNormalize?14:2, transition:'left .2s' }} />
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:doNormalize?S.pu:S.sub, whiteSpace:'nowrap' }}>
                {doNormalize ? '⚡ Normalize' : '⬇️ Raw only'}
              </span>
            </div>

            {/* Add to queue */}
            {totalSelected > 0 && (
              <button onClick={addSelected} disabled={adding}
                style={{ ...btnBase, padding:'5px 14px', background:S.green, color:'#fff', fontSize:12, marginLeft:'auto', opacity:adding?0.7:1 }}>
                {adding ? `Adding ${added}/${totalSelected}…` : `⚡ Add ${totalSelected} to Queue`}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding: result ? '16px 20px' : '0' }}>
          {/* Playlist groups */}
          {result && filteredPlaylists.map((pl, i) => (
            <PlaylistRow key={i} playlist={pl} selected={selected}
              onToggle={toggleOne}
              onSelectAll={()=>selectPlaylist(pl)}
              onDeselectAll={()=>deselectPlaylist(pl)}
            />
          ))}
          {result && filteredPlaylists.length === 0 && (
            <div style={{ textAlign:'center', padding:30, color:S.sub }}>No videos match "{filter}"</div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:S.sub, padding:60 }}>
              <span style={{ fontSize:40 }}>⏳</span>
              <span style={{ fontSize:13 }}>Fetching channel… may take a moment</span>
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && !error && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:S.sub, padding:60 }}>
              <span style={{ fontSize:48 }}>📺</span>
              <span style={{ fontSize:14, fontWeight:600 }}>Paste a YouTube channel URL above</span>
              <span style={{ fontSize:12, color:'#444', textAlign:'center' }}>Supports @handle · /c/name · /channel/UC... · playlist URLs</span>
            </div>
          )}
        </div>

        {/* Footer — selected count */}
        {totalSelected > 0 && (
          <div style={{ padding:'10px 20px', borderTop:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:12, color:S.sub }}>{totalSelected} video{totalSelected!==1?'s':''} selected</span>
            <button onClick={addSelected} disabled={adding}
              style={{ ...btnBase, background:S.pu, color:'#fff', fontSize:13, opacity:adding?0.7:1 }}>
              {adding ? `Adding ${added}/${totalSelected}…` : `⚡ Add ${totalSelected} to Queue`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
