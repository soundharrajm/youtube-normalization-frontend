import { useState, useRef, useCallback, useEffect } from 'react'

const S = {
  pu:'#7c6af7', green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  bg:'#0f0f17', card:'#1a1a2a', border:'rgba(255,255,255,0.08)',
  text:'#e2e2f0', sub:'#64748b',
}

const TABS = [
  { id:'home',      label:'🏠 Home' },
  { id:'videos',    label:'🎬 Videos' },
  { id:'shorts',    label:'📱 Shorts' },
  { id:'playlists', label:'📋 Playlists' },
]

function VideoCard({ video, selected, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width:180, flexShrink:0, cursor:'pointer', borderRadius:10, overflow:'hidden',
      border:`1.5px solid ${selected?S.pu:'transparent'}`,
      background:selected?'rgba(124,106,247,0.10)':'rgba(255,255,255,0.02)',
      transition:'all .15s', position:'relative',
    }}>
      <div style={{ position:'absolute', top:6, left:6, zIndex:2, width:18, height:18, borderRadius:5,
        border:`2px solid ${selected?S.pu:'rgba(255,255,255,0.5)'}`,
        background:selected?S.pu:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {selected && <span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}
      </div>
      <div style={{ position:'relative', width:'100%', paddingTop:'56.25%', background:'#111' }}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#333', fontSize:24 }}>🎬</div>
        }
        {video.duration && (
          <div style={{ position:'absolute', bottom:4, right:4, background:'rgba(0,0,0,0.85)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3, fontFamily:'monospace' }}>
            {video.duration}
          </div>
        )}
      </div>
      <div style={{ padding:'8px 8px 6px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:S.text, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {video.title}
        </div>
        {video.upload_date && (
          <div style={{ fontSize:10, color:S.sub, marginTop:3 }}>
            {video.upload_date.replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')}
          </div>
        )}
      </div>
    </div>
  )
}

function PlaylistCard({ pl, onExpand, loading }) {
  return (
    <div style={{
      width:180, flexShrink:0, borderRadius:10, overflow:'hidden',
      border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.03)',
      transition:'all .15s', position:'relative',
    }}>
      <div style={{ position:'relative', width:'100%', paddingTop:'56.25%', background:'#111' }}>
        {pl.thumbnail
          ? <img src={pl.thumbnail} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#333', fontSize:24 }}>📋</div>
        }
        {pl.count > 0 && (
          <div style={{ position:'absolute', bottom:4, right:4, background:'rgba(0,0,0,0.85)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3 }}>
            {pl.count} videos
          </div>
        )}
      </div>
      <div style={{ padding:'8px 8px 10px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:S.text, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', marginBottom:6 }}>
          {pl.title}
        </div>
        <button onClick={onExpand} disabled={loading}
          style={{ width:'100%', padding:'5px', borderRadius:6, border:`1px solid ${S.pu}`, background:loading?'rgba(124,106,247,0.05)':'rgba(124,106,247,0.12)', color:loading?S.sub:S.pu, fontSize:10, fontWeight:600, cursor:loading?'wait':'pointer', fontFamily:'inherit' }}>
          {loading ? '⏳ Loading…' : '▶ Load Videos'}
        </button>
      </div>
    </div>
  )
}

function SectionRow({ section, selected, onToggle, onSelectAll, onDeselectAll, onExpandPlaylist, loadingPl }) {
  const scrollRef = useRef(null)
  const hasVideos = section.videos && section.videos.length > 0
  const allSel    = hasVideos && section.videos.every(v => selected.has(v.id))
  const scroll    = (d) => scrollRef.current?.scrollBy({ left:d*400, behavior:'smooth' })

  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontSize:14, fontWeight:700, color:S.text }}>{section.title}</span>
        {!section.is_playlist && hasVideos && <span style={{ fontSize:11, color:S.sub }}>({section.videos.length})</span>}
        {!section.is_playlist && hasVideos && (
          <button onClick={allSel ? onDeselectAll : onSelectAll}
            style={{ fontSize:10, padding:'2px 8px', borderRadius:5, border:`1px solid ${allSel?'rgba(239,68,68,0.3)':'rgba(124,106,247,0.3)'}`, background:allSel?'rgba(239,68,68,0.07)':'rgba(124,106,247,0.07)', color:allSel?'#f87171':S.pu, cursor:'pointer', fontFamily:'inherit' }}>
            {allSel?'☐ Deselect all':'☑ Select all'}
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button onClick={()=>scroll(-1)} style={{ width:24, height:24, borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontSize:13 }}>‹</button>
          <button onClick={()=>scroll(1)}  style={{ width:24, height:24, borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontSize:13 }}>›</button>
        </div>
      </div>
      <div ref={scrollRef} style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent' }}>
        {section.is_playlist
          ? section.videos.map((pl,i) => (
              <PlaylistCard key={i} pl={pl}
                loading={loadingPl === (pl.playlist_id || pl.title)}
                onExpand={() => onExpandPlaylist(pl)} />
            ))
          : section.videos.map(v => (
              <VideoCard key={v.id} video={v} selected={selected.has(v.id)} onToggle={()=>onToggle(v.id)} />
            ))
        }
      </div>
      {!section.is_playlist && section.has_more && (
        <div style={{ textAlign:'center', marginTop:6 }}>
          <button onClick={()=>onExpandPlaylist({playlist_url:section.playlist_url, playlist_id:section.playlist_id, title:section.title})}
            disabled={loadingPl===section.playlist_id}
            style={{ fontSize:11, padding:'5px 16px', borderRadius:7, border:`1px solid rgba(124,106,247,0.3)`, background:'rgba(124,106,247,0.08)', color:S.pu, cursor:'pointer', fontFamily:'inherit' }}>
            {loadingPl===section.playlist_id ? '⏳ Loading…' : '↓ Load more from this playlist'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChannelPanel({ open, onClose, apiFetchFn, user, onAddToQueue, doNormalize, onToggleNormalize, initialUrl }) {
  const [url,        setUrl]        = useState(initialUrl || '')
  const [tab,        setTab]        = useState('home')
  const [limit,      setLimit]      = useState(100)
  const [loading,    setLoading]    = useState(false)
  const [loadingPl,  setLoadingPl]  = useState(null)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)
  const [selected,   setSelected]   = useState(new Set())
  const [adding,     setAdding]     = useState(false)
  const [added,      setAdded]      = useState(0)
  const [filter,     setFilter]     = useState('')
  const [channelUrl, setChannelUrl] = useState('')

  // Auto-fetch when opened with an initial URL
  const didAutoFetch = useRef(false)
  useEffect(() => {
    if (initialUrl && !didAutoFetch.current) {
      didAutoFetch.current = true
      setUrl(initialUrl)
      // Small delay so state settles
      setTimeout(() => {
        handleFetchUrl(initialUrl)
      }, 50)
    }
  }, [initialUrl])

  if (!open) return null

  const toggleOne = (id) => setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  const selectSec   = (sec) => setSelected(s => { const n=new Set(s); sec.videos.forEach(v=>n.add(v.id)); return n })
  const deselectSec = (sec) => setSelected(s => { const n=new Set(s); sec.videos.forEach(v=>n.delete(v.id)); return n })
  const selectAll   = () => { const ids=new Set(); (result?.playlists||[]).forEach(pl=>pl.videos.forEach(v=>ids.add(v.id))); setSelected(ids) }
  const deselectAll = () => setSelected(new Set())

  const filteredPlaylists = (result?.playlists||[]).map(pl=>({
    ...pl,
    videos: filter ? pl.videos.filter(v=>v.title?.toLowerCase().includes(filter.toLowerCase())) : pl.videos,
  })).filter(pl=>pl.videos.length>0)

  async function fetchTab(t, u) {
    const targetUrl = u || channelUrl || url
    if (!targetUrl) return
    setLoading(true); setResult(null); setError(null); setSelected(new Set())
    try {
      const res = await apiFetchFn('/channel/videos', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url:targetUrl, tab:t, limit, session_id:user?.session_id||null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail||'Failed')
      setResult(d)
      if (!channelUrl) setChannelUrl(d.channel_url || targetUrl)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleFetchUrl(u) {
    if (!u) return
    setChannelUrl('')
    setError(null)
    setSelected(new Set())

    if (u.includes('list=') || u.includes('/playlist?')) {
      setLoading(true); setResult(null)
      try {
        const res = await apiFetchFn('/channel/playlist', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ url:u, limit, session_id:user?.session_id||null }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail||'Failed')
        setResult({ channel_name:d.title, channel_url:u, tab:'videos', total:d.total, playlists:[{title:d.title,videos:d.videos,is_playlist:false}] })
        setTab('videos')
      } catch(e) { setError(e.message) }
      finally { setLoading(false) }
      return
    }

    setTab('home')
    await fetchTab('home', u)
  }

  async function handleFetch() {
    await handleFetchUrl(url.trim())
  }

  async function switchTab(t) {
    setTab(t)
    await fetchTab(t)
  }

  async function expandPlaylist(pl) {
    const plKey = pl.playlist_id || pl.title
    setLoadingPl(plKey)
    try {
      const res = await apiFetchFn('/channel/playlist', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url:pl.playlist_url, limit, session_id:user?.session_id||null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail||'Failed')
      // Insert a new video section right after the playlist section
      setResult(prev => {
        const pls = [...(prev?.playlists||[])]
        // Find the playlist section that contains this pl card
        let insertIdx = -1
        for (let i=0; i<pls.length; i++) {
          if (pls[i].is_playlist && pls[i].videos.some(v=>(v.playlist_id||v.title)===plKey)) {
            insertIdx = i+1; break
          }
        }
        const newSection = { title: d.title, videos: d.videos, is_playlist: false }
        if (insertIdx >= 0) {
          pls.splice(insertIdx, 0, newSection)
        } else {
          pls.push(newSection)
        }
        return { ...prev, playlists: pls }
      })
    } catch(e) { setError(e.message) }
    finally { setLoadingPl(null) }
  }

  async function addSelected() {
    const allVids = (result?.playlists||[]).flatMap(pl=>pl.videos)
    const toAdd   = allVids.filter(v=>selected.has(v.id))
    if (!toAdd.length) return
    setAdding(true); setAdded(0)
    for (const v of toAdd) {
      onAddToQueue(v.url, v.title)
      setAdded(n=>n+1)
      await new Promise(r=>setTimeout(r,60))
    }
    setAdding(false); setSelected(new Set())
  }

  const totalSel = selected.size
  const btnBase  = { padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:46 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'95vw', maxWidth:1200, maxHeight:'92vh', background:S.bg, border:`1px solid rgba(124,106,247,0.25)`, borderRadius:16, display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.7)', overflow:'hidden', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:'12px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>📺</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:S.text }}>{result?.channel_name || 'Channel Browser'}</div>
            <div style={{ fontSize:11, color:S.sub }}>{result ? `${result.total} videos · ${result.playlists?.length} sections` : 'Paste a channel URL to browse'}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.04)', color:'#555', fontSize:14, cursor:'pointer' }}>✕</button>
        </div>

        {/* URL bar */}
        <div style={{ padding:'10px 20px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', gap:8 }}>
            <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetch()}
              placeholder="https://www.youtube.com/@ChannelName"
              style={{ flex:1, background:'rgba(0,0,0,0.35)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 14px', fontSize:13, color:S.text, outline:'none', fontFamily:'inherit' }} />
            <select value={limit} onChange={e=>setLimit(Number(e.target.value))}
              style={{ background:'rgba(0,0,0,0.35)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', fontSize:12, color:S.text, outline:'none', cursor:'pointer' }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={0}>All</option>
            </select>
            <button onClick={handleFetch} disabled={loading||!url.trim()}
              style={{ ...btnBase, background:S.pu, color:'#fff', opacity:loading||!url.trim()?0.6:1, minWidth:90 }}>
              {loading?'⏳…':'🔍 Fetch'}
            </button>
          </div>
          {error && <div style={{ marginTop:8, padding:'6px 12px', borderRadius:7, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#f87171' }}>⚠️ {error}</div>}
        </div>

        {/* Tabs — only show after first fetch */}
        {result && (
          <div style={{ display:'flex', alignItems:'center', gap:2, padding:'8px 20px', borderBottom:`1px solid ${S.border}`, flexShrink:0, overflowX:'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>switchTab(t.id)} disabled={loading}
                style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', whiteSpace:'nowrap',
                  background: tab===t.id ? S.pu : 'rgba(255,255,255,0.04)',
                  color: tab===t.id ? '#fff' : S.sub,
                }}>
                {t.label}
              </button>
            ))}
            <div style={{ flex:1 }} />
            {/* Controls */}
            {tab !== 'playlists' && <>
              <button onClick={selectAll}   style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid rgba(124,106,247,0.3)`, background:'rgba(124,106,247,0.08)', color:S.pu, cursor:'pointer', fontFamily:'inherit' }}>☑ All</button>
              <button onClick={deselectAll} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${S.border}`, background:'rgba(255,255,255,0.03)', color:S.sub, cursor:'pointer', fontFamily:'inherit' }}>☐ None</button>
            </>}
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter…"
              style={{ width:130, background:'rgba(0,0,0,0.3)', border:`1px solid ${S.border}`, borderRadius:6, padding:'4px 10px', fontSize:11, color:S.text, outline:'none', fontFamily:'inherit' }} />
            {/* Normalize toggle */}
            <div onClick={onToggleNormalize} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:7, border:`1px solid ${doNormalize?'rgba(124,106,247,0.3)':S.border}`, background:doNormalize?'rgba(124,106,247,0.07)':'transparent', cursor:'pointer' }}>
              <div style={{ width:26, height:14, borderRadius:7, background:doNormalize?S.pu:'rgba(255,255,255,0.15)', position:'relative', flexShrink:0 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:doNormalize?14:2, transition:'left .2s' }} />
              </div>
              <span style={{ fontSize:10, fontWeight:600, color:doNormalize?S.pu:S.sub, whiteSpace:'nowrap' }}>{doNormalize?'⚡ Norm':'⬇️ Raw'}</span>
            </div>
            {totalSel > 0 && (
              <button onClick={addSelected} disabled={adding}
                style={{ ...btnBase, padding:'5px 14px', background:S.green, color:'#fff', fontSize:11, opacity:adding?0.7:1 }}>
                {adding?`Adding ${added}/${totalSel}…`:`⚡ Add ${totalSel}`}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding: result?'16px 20px':'0' }}>
          {result && filteredPlaylists.map((pl,i) => (
            <SectionRow key={i} section={pl} selected={selected}
              onToggle={toggleOne}
              onSelectAll={()=>selectSec(pl)}
              onDeselectAll={()=>deselectSec(pl)}
              loadingPl={loadingPl}
              onExpandPlaylist={expandPlaylist}
            />
          ))}
          {result && filteredPlaylists.length===0 && !loading && (
            <div style={{ textAlign:'center', padding:30, color:S.sub }}>No results{filter?` for "${filter}"`:''}</div>
          )}
          {loading && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:S.sub, padding:60 }}>
              <span style={{ fontSize:40 }}>⏳</span>
              <span style={{ fontSize:13 }}>Fetching {tab} tab…</span>
            </div>
          )}
          {!result && !loading && !error && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:S.sub, padding:60 }}>
              <span style={{ fontSize:48 }}>📺</span>
              <span style={{ fontSize:14, fontWeight:600 }}>Paste a YouTube channel URL above</span>
              <span style={{ fontSize:12, color:'#444', textAlign:'center' }}>Home · Videos · Shorts · Playlists tabs will appear after fetching</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {totalSel > 0 && (
          <div style={{ padding:'10px 20px', borderTop:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:12, color:S.sub }}>{totalSel} video{totalSel!==1?'s':''} selected</span>
            <button onClick={addSelected} disabled={adding}
              style={{ ...btnBase, background:S.pu, color:'#fff', fontSize:13, opacity:adding?0.7:1 }}>
              {adding?`Adding ${added}/${totalSel}…`:`⚡ Add ${totalSel} to Queue`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
