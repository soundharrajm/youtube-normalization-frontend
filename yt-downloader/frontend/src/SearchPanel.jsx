import { useState, useRef, useEffect } from 'react'

const API = localStorage.getItem('yt_backend_url') || import.meta.env.VITE_API_URL || '/api'

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

const FILTERS = [
  { label:'All',    value:'' },
  { label:'Short',  value:'short' },
  { label:'Medium', value:'medium' },
  { label:'Long',   value:'long' },
]

const CONTENT_TYPES = [
  { label:'All Videos', value:'',        ytType:'video' },
  { label:'Shorts',     value:'short',   ytType:'video' },
  { label:'Full Ep',    value:'episode', ytType:'episode' },
  { label:'Trailer',    value:'trailer', ytType:'movie' },
  { label:'Promo',      value:'promo',   ytType:'video' },
]

const ORDERS = [
  { label:'Relevance', value:'relevance' },
  { label:'Newest',    value:'date' },
  { label:'Views',     value:'viewCount' },
  { label:'Rating',    value:'rating' },
]

// ── Inline video preview modal ─────────────────────────────────────────────
function VideoPreviewModal({ videoId, title, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
      }}
    >
      {/* Title + close */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'min(900px,92vw)', gap:12 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#e0e0f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{title}</span>
        <button onClick={onClose} style={{ flexShrink:0, padding:'5px 14px', borderRadius:7, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'#aaa', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          ✕ Close
        </button>
      </div>

      {/* YouTube embed */}
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        style={{ width:'min(900px,92vw)', height:'min(506px,52vw)', borderRadius:12, border:'none', background:'#000' }}
      />

      <span style={{ fontSize:11, color:'#444' }}>Press Esc or click outside to close</span>
    </div>
  )
}

export default function SearchPanel({ onAddUrl, onClose }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState(null)
  const [duration, setDuration]     = useState('')
  const [contentType, setContentType] = useState('')
  const [order, setOrder]           = useState('relevance')
  const [added, setAdded]           = useState(new Set())
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug]       = useState(false)
  const [nextPageToken, setNextPageToken] = useState(null)
  const [totalResults, setTotalResults]   = useState(0)
  const [previewVideo, setPreviewVideo]   = useState(null)  // {id, title}
  const inputRef = useRef(null)
  const sugTimer = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const fetchSuggestions = (q) => {
    clearTimeout(sugTimer.current)
    if (q.length < 2) { setSuggestions([]); setShowSug(false); return }
    sugTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`${API}/search/suggestions?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        const list = d.suggestions || []
        setSuggestions(list)
        setShowSug(list.length > 0)
      } catch { setSuggestions([]) }
    }, 300)
  }

  const buildParams = (q, pageToken = null) => {
    const params = new URLSearchParams({ q: q.trim(), max: 12, order })
    if (duration) params.set('video_duration', duration)
    if (contentType === 'short') {
      params.set('video_duration', 'short')
    } else if (contentType === 'episode' || contentType === 'trailer') {
      params.set('q', `${q.trim()} ${contentType}`)
    } else if (contentType === 'promo') {
      params.set('q', `${q.trim()} promo`)
    }
    if (pageToken) params.set('page_token', pageToken)
    return params
  }

  const search = async (q = query, append = false) => {
    if (!q.trim()) return
    if (!append) {
      setLoading(true); setResults([]); setNextPageToken(null); setTotalResults(0)
    } else {
      setLoadingMore(true)
    }
    setError(null); setShowSug(false); setSuggestions([])
    if (!append) { inputRef.current?.blur(); document.activeElement?.blur() }
    try {
      const params = buildParams(q, append ? nextPageToken : null)
      const r = await apiFetch(`${API}/search?${params}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Search failed')
      const newResults = d.results || []
      setResults(prev => append ? [...prev, ...newResults] : newResults)
      setNextPageToken(d.next_page_token || null)
      setTotalResults(d.total_results || newResults.length)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }

  const handleAdd = (video) => {
    onAddUrl(video)
    setAdded(prev => new Set([...prev, video.video_id]))
  }
  const handleAddAll = () => results.forEach(v => handleAdd(v))

  const pillBase = { padding:'3px 11px', borderRadius:100, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }
  const pill = (active, activeColor, activeBg) => ({
    ...pillBase,
    border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.1)',
    background: active ? activeBg : 'rgba(255,255,255,0.03)',
    color: active ? activeColor : '#666',
  })

  return (
    <>
      {/* Inline preview modal — renders above everything */}
      {previewVideo && (
        <VideoPreviewModal
          videoId={previewVideo.id}
          title={previewVideo.title}
          onClose={() => setPreviewVideo(null)}
        />
      )}

      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'flex-start', justifyContent:'center',
          padding:'16px',
          overflowY:'auto',
        }}
      >
        <div style={{
          width:'100%', maxWidth:880, margin:'0 16px',
          background:'#0e0e1a', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:16, overflow:'hidden',
          boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
          display:'flex', flexDirection:'column',
          maxHeight:'calc(100vh - 32px)',
        }}>

          {/* Header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>🔎</span>
            <span style={{ fontSize:16, fontWeight:700, color:'#e8e8f0', flex:1 }}>Search YouTube</span>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#888', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>

          {/* Search bar */}
          <div style={{ padding:'16px 20px 12px' }}>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, position:'relative' }}>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value) }}
                  onKeyDown={e => { if (e.key==='Enter'){setShowSug(false);search()} if(e.key==='Escape')setShowSug(false) }}
                  onFocus={() => suggestions.length && setShowSug(true)}
                  onBlur={() => setTimeout(()=>{ setShowSug(false); setSuggestions([]) }, 200)}
                  placeholder="Search for trailers, episodes, channels…"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:10, fontSize:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#e8e8f0', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
                />
                {showSug && suggestions.length > 0 && results.length===0 && !loading && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxHeight:280, overflowY:'auto' }}>
                    {suggestions.map((s,i) => (
                      <div key={i} onMouseDown={()=>{ setQuery(s); setShowSug(false); search(s) }}
                        style={{ padding:'9px 14px', fontSize:13, color:'#ccc', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:8 }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <span style={{ color:'#555', fontSize:12 }}>🔍</span>{s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={()=>search()}
                disabled={loading||!query.trim()}
                style={{ padding:'10px 24px', borderRadius:10, fontSize:14, fontWeight:700, cursor:loading||!query.trim()?'not-allowed':'pointer', fontFamily:'inherit', whiteSpace:'nowrap', border:'none', background:loading||!query.trim()?'rgba(139,92,246,0.3)':'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff' }}
              >{loading ? '⏳' : '🔎 Search'}</button>
            </div>

            {/* Filters */}
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#555', fontWeight:600, marginRight:2 }}>DURATION:</span>
              {FILTERS.map(f => (
                <button key={f.value} onClick={()=>{setDuration(f.value)}} style={pill(duration===f.value,'#a78bfa','rgba(139,92,246,0.2)')}>{f.label}</button>
              ))}
              <span style={{ fontSize:11, color:'#555', fontWeight:600, marginLeft:8, marginRight:2 }}>TYPE:</span>
              {CONTENT_TYPES.map(ct => (
                <button key={ct.value} onClick={()=>setContentType(ct.value)} style={pill(contentType===ct.value,'#34d399','rgba(16,185,129,0.2)')}>{ct.label}</button>
              ))}
              <span style={{ fontSize:11, color:'#555', fontWeight:600, marginLeft:8, marginRight:2 }}>SORT:</span>
              {ORDERS.map(o => (
                <button key={o.value} onClick={()=>setOrder(o.value)} style={pill(order===o.value,'#93c5fd','rgba(59,130,246,0.2)')}>{o.label}</button>
              ))}
            </div>

            {(duration || contentType || order!=='relevance') && (
              <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, color:'#555' }}>Active filters:</span>
                {duration && <span style={{ fontSize:10, background:'rgba(139,92,246,0.15)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.3)', borderRadius:4, padding:'2px 7px' }}>duration: {duration}</span>}
                {contentType && <span style={{ fontSize:10, background:'rgba(16,185,129,0.12)', color:'#34d399', border:'1px solid rgba(16,185,129,0.25)', borderRadius:4, padding:'2px 7px' }}>type: {contentType}</span>}
                {order!=='relevance' && <span style={{ fontSize:10, background:'rgba(59,130,246,0.12)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.25)', borderRadius:4, padding:'2px 7px' }}>sort: {order}</span>}
                <button onClick={()=>{setDuration('');setContentType('');setOrder('relevance')}} style={{ fontSize:10, color:'#ef4444', background:'none', border:'none', cursor:'pointer', padding:'2px 4px' }}>✕ Clear all</button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ margin:'0 20px 12px', padding:'10px 14px', fontSize:13, color:'#f87171', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8 }}>✗ {error}</div>
          )}

          {/* Results grid */}
          {results.length > 0 && (
            <div style={{ overflowY:'auto', flex:1 }}>
              <div style={{ padding:'0 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>
                  {results.length} of {totalResults > 0 ? totalResults.toLocaleString() : '?'} results
                </span>
                <button onClick={handleAddAll} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34d399' }}>+ Add All to Queue</button>
              </div>

              <div style={{ padding:'0 20px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:12 }}>
                {results.map(video => {
                  const isAdded = added.has(video.video_id)
                  return (
                    <div key={video.video_id} style={{ background:'rgba(255,255,255,0.03)', border:isAdded?'1px solid rgba(16,185,129,0.3)':'1px solid rgba(255,255,255,0.08)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', transition:'border-color 0.2s' }}>

                      {/* Thumbnail with play overlay */}
                      <div
                        style={{ position:'relative', flexShrink:0, cursor:'pointer' }}
                        onClick={() => setPreviewVideo({ id: video.video_id, title: video.title })}
                      >
                        <img src={video.thumbnail} alt={video.title} style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />

                        {/* Duration badge */}
                        {video.duration && (
                          <span style={{ position:'absolute', bottom:6, right:6, background:'rgba(0,0,0,0.85)', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, fontFamily:"'JetBrains Mono',monospace" }}>{video.duration}</span>
                        )}

                        {/* Play button overlay */}
                        <div style={{
                          position:'absolute', inset:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          background:'rgba(0,0,0,0)',
                          transition:'background .2s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.45)'}
                          onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0)'}
                        >
                          <div style={{
                            width:44, height:44, borderRadius:'50%',
                            background:'rgba(255,255,255,0.9)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            opacity:0, transition:'opacity .2s',
                            fontSize:18, paddingLeft:3,
                            boxShadow:'0 2px 12px rgba(0,0,0,0.5)',
                          }}
                            onMouseEnter={e => e.currentTarget.style.opacity='1'}
                            onMouseLeave={e => e.currentTarget.style.opacity='0'}
                          >▶</div>
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ padding:'10px 12px', flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#e8e8f0', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{video.title}</p>
                        <p style={{ margin:0, fontSize:11, color:'#666' }}>{video.channel}</p>
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                          {video.views && <span style={{ fontSize:10, color:'#555' }}>{video.views}</span>}
                          {video.published && <span style={{ fontSize:10, color:'#444' }}>· {video.published}</span>}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ padding:'0 12px 12px', display:'flex', gap:6 }}>
                        <button
                          onClick={() => setPreviewVideo({ id: video.video_id, title: video.title })}
                          style={{ flex:'0 0 auto', padding:'7px 10px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer', border:'1px solid rgba(124,106,247,0.35)', background:'rgba(124,106,247,0.1)', color:'#a78bfa' }}
                        >▶</button>
                        <button
                          onClick={() => !isAdded && handleAdd(video)}
                          style={{ flex:1, padding:'7px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:isAdded?'default':'pointer', border:isAdded?'1px solid rgba(16,185,129,0.3)':'1px solid rgba(139,92,246,0.3)', background:isAdded?'rgba(16,185,129,0.12)':'rgba(139,92,246,0.12)', color:isAdded?'#34d399':'#a78bfa' }}
                        >{isAdded ? '✓ Added' : '+ Add to Queue'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Load More */}
              <div style={{ padding:'16px 20px 20px', display:'flex', justifyContent:'center' }}>
                {nextPageToken ? (
                  <button
                    onClick={()=>search(query, true)}
                    disabled={loadingMore}
                    style={{ padding:'10px 32px', borderRadius:10, fontSize:13, fontWeight:700, cursor:loadingMore?'not-allowed':'pointer', fontFamily:'inherit', border:'1px solid rgba(127,119,221,0.35)', background:'rgba(127,119,221,0.1)', color:'#c4beff' }}
                  >{loadingMore ? '⏳ Loading…' : '⬇ Load More'}</button>
                ) : (
                  <span style={{ fontSize:11, color:'#333' }}>— No more results —</span>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && results.length===0 && (
            <div style={{ flex:1, padding:'48px 20px', textAlign:'center', color:'#444' }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🎬</div>
              <p style={{ margin:0, fontSize:14, color:'#555' }}>Search for YouTube videos to add to your download queue</p>
              <p style={{ margin:'8px 0 0', fontSize:12, color:'#333' }}>Try: "Gullak season 5 trailer" · "Sony LIV new series" · "Aamir Khan movie"</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
