import { useState, useRef } from 'react'

const CP = {
  pu: '#7c6af7', bg: '#0f0f1a', card: '#1a1a2e', border: 'rgba(255,255,255,0.08)',
  text: '#e2e2f0', sub: '#64748b', green: '#22c55e', red: '#ef4444', mono: 'monospace',
}

function VideoCard({ video, selected, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
      borderRadius: 8, cursor: 'pointer', border: `1px solid ${selected ? CP.pu : CP.border}`,
      background: selected ? 'rgba(124,106,247,0.08)' : 'rgba(255,255,255,0.02)',
      transition: 'all .15s', marginBottom: 5,
    }}>
      {/* Checkbox */}
      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? CP.pu : '#444'}`, background: selected ? CP.pu : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
      </div>

      {/* Thumbnail */}
      {video.thumbnail && (
        <img src={video.thumbnail} alt="" style={{ width: 80, height: 45, borderRadius: 5, objectFit: 'cover', flexShrink: 0, background: '#222' }}
          onError={e => e.target.style.display='none'} />
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: CP.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.title}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
          {video.duration   && <span style={{ fontSize: 10, color: CP.sub, fontFamily: CP.mono }}>{video.duration}</span>}
          {video.upload_date && <span style={{ fontSize: 10, color: CP.sub }}>{video.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</span>}
        </div>
      </div>
    </div>
  )
}

export default function ChannelPanel({ open, onClose, apiFetchFn, user, onAddToQueue, doNormalize, onToggleNormalize }) {
  const [url,       setUrl]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState(null)
  const [error,     setError]     = useState(null)
  const [selected,  setSelected]  = useState(new Set())
  const [adding,    setAdding]    = useState(false)
  const [added,     setAdded]     = useState(0)
  const [filter,    setFilter]    = useState('')
  const inputRef = useRef(null)

  if (!open) return null

  const filtered = (result?.videos || []).filter(v =>
    !filter || v.title.toLowerCase().includes(filter.toLowerCase())
  )

  const allSelected   = filtered.length > 0 && filtered.every(v => selected.has(v.id))
  const someSelected  = filtered.some(v => selected.has(v.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(s => { const n = new Set(s); filtered.forEach(v => n.delete(v.id)); return n })
    } else {
      setSelected(s => { const n = new Set(s); filtered.forEach(v => n.add(v.id)); return n })
    }
  }

  const toggleOne = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function fetchChannel() {
    if (!url.trim()) return
    setLoading(true); setResult(null); setError(null); setSelected(new Set()); setAdded(0)
    try {
      const res = await apiFetchFn('/channel/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), session_id: user?.session_id || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'Failed to fetch channel')
      setResult(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function addSelected() {
    const videos = (result?.videos || []).filter(v => selected.has(v.id))
    if (!videos.length) return
    setAdding(true); setAdded(0)
    for (const v of videos) {
      onAddToQueue(v.url, v.title)
      setAdded(n => n + 1)
      await new Promise(r => setTimeout(r, 80))
    }
    setAdding(false)
    setSelected(new Set())
  }

  const btnBase = { padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 720, maxHeight: '85vh', background: '#13121f', border: '1px solid rgba(124,106,247,0.3)', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', fontFamily: "'Inter','Segoe UI',sans-serif", overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${CP.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>📺</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: CP.text }}>Channel Browser</div>
            <div style={{ fontSize: 11, color: CP.sub }}>Paste a channel or playlist URL to browse and download videos</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${CP.border}`, background: 'rgba(255,255,255,0.04)', color: '#555', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        {/* URL input */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${CP.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchChannel()}
              placeholder="https://www.youtube.com/@ChannelName  or  /c/name  or  playlist URL"
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CP.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, color: CP.text, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={fetchChannel} disabled={loading || !url.trim()}
              style={{ ...btnBase, background: CP.pu, color: '#fff', opacity: loading || !url.trim() ? 0.6 : 1, minWidth: 90 }}>
              {loading ? '⏳ Loading…' : '🔍 Fetch'}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#444' }}>
            Supports: @handle · /c/name · /channel/UCxxx · /user/name · playlist URLs
          </div>
          {error && (
            <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Channel info + controls */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${CP.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: CP.text }}>{result.channel_name}</span>
                <span style={{ fontSize: 11, color: CP.sub, marginLeft: 8 }}>{result.total} video{result.total !== 1 ? 's' : ''}</span>
              </div>

              {/* Normalize toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:8, border:`1px solid ${doNormalize?'rgba(124,106,247,0.3)':'rgba(255,255,255,0.08)'}`, background:doNormalize?'rgba(124,106,247,0.07)':'rgba(255,255,255,0.02)', cursor:'pointer' }}
                onClick={onToggleNormalize}>
                <div style={{ width:28, height:16, borderRadius:8, background:doNormalize?'#7c6af7':'rgba(255,255,255,0.15)', position:'relative', transition:'background .2s', flexShrink:0 }}>
                  <div style={{ width:12, height:12, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:doNormalize?14:2, transition:'left .2s' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:doNormalize?'#7c6af7':CP.sub, whiteSpace:'nowrap' }}>
                  {doNormalize ? '⚡ Normalize' : '⬇️ Raw only'}
                </span>
              </div>

              {/* Filter */}
              <input value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Filter by title…"
                style={{ width: 140, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CP.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: CP.text, outline: 'none', fontFamily: 'inherit' }} />
              {/* Select all */}
              <button onClick={toggleAll} style={{ ...btnBase, padding: '5px 12px', background: allSelected ? 'rgba(239,68,68,0.1)' : 'rgba(124,106,247,0.1)', border: `1px solid ${allSelected ? 'rgba(239,68,68,0.3)' : 'rgba(124,106,247,0.3)'}`, color: allSelected ? '#f87171' : '#7c6af7', fontSize: 11 }}>
                {allSelected ? '☐ Deselect All' : '☑ Select All'}
              </button>
              {/* Add to queue */}
              {selected.size > 0 && (
                <button onClick={addSelected} disabled={adding}
                  style={{ ...btnBase, padding: '5px 14px', background: CP.green, color: '#fff', fontSize: 11, opacity: adding ? 0.7 : 1 }}>
                  {adding ? `Adding ${added}/${selected.size}…` : `⚡ Add ${selected.size} to Queue`}
                </button>
              )}
            </div>

            {/* Video list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: CP.sub, fontSize: 13 }}>No videos match "{filter}"</div>
              )}
              {filtered.map(v => (
                <VideoCard key={v.id} video={v} selected={selected.has(v.id)} onToggle={() => toggleOne(v.id)} />
              ))}
            </div>

            {/* Footer */}
            {selected.size > 0 && (
              <div style={{ padding: '10px 20px', borderTop: `1px solid ${CP.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: CP.sub }}>{selected.size} of {filtered.length} selected</span>
                <button onClick={addSelected} disabled={adding}
                  style={{ ...btnBase, background: '#7c6af7', color: '#fff', fontSize: 13, opacity: adding ? 0.7 : 1 }}>
                  {adding ? `Adding ${added}/${selected.size}…` : `⚡ Add ${selected.size} to Queue`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: CP.sub, padding: 40 }}>
            <span style={{ fontSize: 48 }}>📺</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Paste a channel URL above</span>
            <span style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>Works with YouTube channels, playlists, and any URL that yt-dlp can extract a list from</span>
          </div>
        )}

        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: CP.sub }}>
            <div style={{ fontSize: 32 }}>⏳</div>
            <span style={{ fontSize: 13 }}>Fetching videos… this may take a moment for large channels</span>
          </div>
        )}
      </div>
    </div>
  )
}
