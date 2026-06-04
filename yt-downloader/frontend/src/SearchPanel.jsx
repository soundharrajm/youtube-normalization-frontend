import { useState, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'bypass-tunnel-reminder': 'true', ...options.headers },
  })
}

const FILTERS = [
  { label: 'All',    value: '' },
  { label: 'Short',  value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Long',   value: 'long' },
]

const ORDERS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Newest',    value: 'date' },
  { label: 'Views',     value: 'viewCount' },
  { label: 'Rating',    value: 'rating' },
]

export default function SearchPanel({ onAddUrl, onClose }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [duration, setDuration] = useState('')
  const [order, setOrder]       = useState('relevance')
  const [added, setAdded]       = useState(new Set())
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug]   = useState(false)
  const inputRef = useRef(null)
  const sugTimer = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const fetchSuggestions = (q) => {
    clearTimeout(sugTimer.current)
    if (q.length < 2) { setSuggestions([]); return }
    sugTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`${API}/search/suggestions?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        setSuggestions(d.suggestions || [])
        setShowSug(true)
      } catch { setSuggestions([]) }
    }, 300)
  }

  const search = async (q = query) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setShowSug(false)
    setSuggestions([])
    try {
      const params = new URLSearchParams({ q: q.trim(), max: 12, order })
      if (duration) params.set('duration', duration)
      const r = await apiFetch(`${API}/search?${params}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Search failed')
      setResults(d.results || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = (video) => {
    onAddUrl(video.url)
    setAdded(prev => new Set([...prev, video.video_id]))
  }

  const handleAddAll = () => {
    results.forEach(v => handleAdd(v))
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      paddingTop:60, paddingBottom:40, overflowY:'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width:'100%', maxWidth:860,
        background:'#0e0e1a', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:16, overflow:'hidden',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
        margin:'0 16px',
      }}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)',
          display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:20 }}>🔎</div>
          <span style={{ fontSize:16, fontWeight:700, color:'#e8e8f0', flex:1 }}>
            Search YouTube
          </span>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:8, color:'#888', fontSize:16, width:32, height:32,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>✕</button>
        </div>

        {/* Search bar */}
        <div style={{ padding:'16px 20px 12px', position:'relative' }}>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, position:'relative' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value) }}
                onKeyDown={e => { if (e.key === 'Enter') search(); if (e.key === 'Escape') setShowSug(false) }}
                onFocus={() => suggestions.length && setShowSug(true)}
                placeholder="Search for videos, channels, trailers..."
                style={{
                  width:'100%', padding:'10px 14px', borderRadius:10, fontSize:14,
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
                  color:'#e8e8f0', outline:'none', fontFamily:'inherit', boxSizing:'border-box',
                }}
              />
              {/* Suggestions dropdown */}
              {showSug && suggestions.length > 0 && (
                <div style={{
                  position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
                  background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:10, zIndex:10, overflow:'hidden',
                  boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {suggestions.map((s, i) => (
                    <div key={i} onClick={() => { setQuery(s); setShowSug(false); search(s) }}
                      style={{ padding:'9px 14px', fontSize:13, color:'#ccc', cursor:'pointer',
                        borderBottom:'1px solid rgba(255,255,255,0.05)',
                        display:'flex', alignItems:'center', gap:8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}
                    >
                      <span style={{ color:'#555', fontSize:12 }}>🔍</span> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => search()} disabled={loading || !query.trim()} style={{
              padding:'10px 20px', borderRadius:10, border:'none',
              background: loading || !query.trim() ? '#2a2a3a' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
              color: loading || !query.trim() ? '#555' : '#fff',
              fontSize:14, fontWeight:700, cursor: loading || !query.trim() ? 'not-allowed':'pointer',
              fontFamily:'inherit', whiteSpace:'nowrap',
            }}>
              {loading ? '⏳ Searching…' : '🔍 Search'}
            </button>
          </div>

          {/* Filters row */}
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'#555', fontWeight:600 }}>DURATION:</span>
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => setDuration(f.value)} style={{
                padding:'4px 12px', borderRadius:100, fontSize:11, fontWeight:600,
                border:`1px solid ${duration===f.value ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                background: duration===f.value ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
                color: duration===f.value ? '#a78bfa' : '#666', cursor:'pointer', fontFamily:'inherit',
              }}>{f.label}</button>
            ))}
            <span style={{ fontSize:11, color:'#555', fontWeight:600, marginLeft:8 }}>SORT:</span>
            {ORDERS.map(o => (
              <button key={o.value} onClick={() => setOrder(o.value)} style={{
                padding:'4px 12px', borderRadius:100, fontSize:11, fontWeight:600,
                border:`1px solid ${order===o.value ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                background: order===o.value ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                color: order===o.value ? '#93c5fd' : '#666', cursor:'pointer', fontFamily:'inherit',
              }}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin:'0 20px 12px', padding:'10px 14px', background:'rgba(239,68,68,0.08)',
            border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontSize:13, color:'#f87171' }}>
            ✗ {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            {/* Results header */}
            <div style={{ padding:'0 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>
                {results.length} RESULTS
              </span>
              <button onClick={handleAddAll} style={{
                padding:'5px 14px', borderRadius:8, border:'1px solid rgba(16,185,129,0.3)',
                background:'rgba(16,185,129,0.08)', color:'#34d399',
                fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>
                + Add All to Queue
              </button>
            </div>

            {/* Results grid */}
            <div style={{ padding:'0 20px 20px', display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
              {results.map(video => {
                const isAdded = added.has(video.video_id)
                return (
                  <div key={video.video_id} style={{
                    background:'rgba(255,255,255,0.03)', border:`1px solid ${isAdded ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column',
                    transition:'border-color 0.2s',
                  }}>
                    {/* Thumbnail */}
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <img src={video.thumbnail} alt={video.title}
                        style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
                      {video.duration && (
                        <span style={{
                          position:'absolute', bottom:6, right:6,
                          background:'rgba(0,0,0,0.85)', color:'#fff',
                          fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4,
                          fontFamily:"'JetBrains Mono',monospace",
                        }}>{video.duration}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding:'10px 12px', flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                      <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#e8e8f0',
                        overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2,
                        WebkitBoxOrient:'vertical', lineHeight:1.4 }}>
                        {video.title}
                      </p>
                      <p style={{ margin:0, fontSize:11, color:'#666' }}>{video.channel}</p>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                        {video.views && (
                          <span style={{ fontSize:10, color:'#555' }}>{video.views}</span>
                        )}
                        {video.published && (
                          <span style={{ fontSize:10, color:'#444' }}>· {video.published}</span>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <div style={{ padding:'0 12px 12px' }}>
                      <button onClick={() => handleAdd(video)} style={{
                        width:'100%', padding:'7px', borderRadius:8, border:'none',
                        background: isAdded ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
                        color: isAdded ? '#34d399' : '#a78bfa',
                        fontSize:12, fontWeight:700, cursor: isAdded ? 'default':'pointer',
                        fontFamily:'inherit',
                        border: `1px solid ${isAdded ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
                      }}>
                        {isAdded ? '✓ Added to Queue' : '+ Add to Queue'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results.length === 0 && (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'#444' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎬</div>
            <p style={{ margin:0, fontSize:14 }}>Search for YouTube videos to add to your download queue</p>
            <p style={{ margin:'8px 0 0', fontSize:12, color:'#333' }}>
              Try: "Gullak season 5 trailer" or "Sony LIV new series"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
