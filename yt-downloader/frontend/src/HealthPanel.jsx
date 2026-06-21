import { useState, useEffect, useCallback } from 'react'

const POLL_INTERVAL = 5000

function StatusDot({ ok }) {
  return (
    <span style={{
      display:'inline-block', width:8, height:8, borderRadius:'50%', flexShrink:0,
      background: ok ? '#22c55e' : '#ef4444',
      boxShadow: ok ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
    }} />
  )
}

function Bar({ pct, color }) {
  const bg = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : color || '#3b82f6'
  return (
    <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.06)', borderRadius:100, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:bg, borderRadius:100, transition:'width 0.5s ease' }} />
    </div>
  )
}

function Row({ icon, label, value, ok, bar, barPct, barColor, mono }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:14, flexShrink:0, width:20 }}>{icon}</span>
      <span style={{ fontSize:11, color:'#9898b8', flex:1 }}>{label}</span>
      {ok !== undefined && <StatusDot ok={ok} />}
      {bar && <Bar pct={barPct} color={barColor} />}
      <span style={{ fontSize:11, fontWeight:600, color:'#e2e2f0', fontFamily:mono?'monospace':'inherit', flexShrink:0, minWidth:50, textAlign:'right' }}>
        {value}
      </span>
    </div>
  )
}

export default function HealthPanel({ open, onClose, apiFetchFn }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [lastPoll,  setLastPoll]  = useState(null)
  const [showRoutes,setShowRoutes]= useState(false)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetchFn('/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
      setLastPoll(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiFetchFn])

  useEffect(() => {
    if (!open) return
    fetchHealth()
    const t = setInterval(fetchHealth, POLL_INTERVAL)
    return () => clearInterval(t)
  }, [open, fetchHealth])

  if (!open) return null

  const overall = data?.status === 'ok'
  const routes  = data?.routes ? Object.keys(data.routes) : []

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingTop:54, paddingRight:12, pointerEvents:'none' }}>
      <div style={{ width:340, maxHeight:'85vh', overflowY:'auto', background:'#16161f', border:`1px solid ${overall?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:14, boxShadow:'0 16px 48px rgba(0,0,0,0.5)', pointerEvents:'all', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, background:'#16161f', zIndex:2 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <StatusDot ok={!error && overall} />
            <span style={{ fontSize:13, fontWeight:700, color:'#e2e2f0' }}>System Health</span>
            {loading && <span style={{ fontSize:10, color:'#555' }}>updating…</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {lastPoll && <span style={{ fontSize:9, color:'#444', fontFamily:'monospace' }}>{lastPoll}</span>}
            <button onClick={fetchHealth} title="Refresh" style={{ width:24, height:24, borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', fontSize:12, cursor:'pointer' }}>↻</button>
            <button onClick={onClose} style={{ width:24, height:24, borderRadius:6, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding:'10px 16px', background:'rgba(239,68,68,0.07)', borderBottom:'1px solid rgba(239,68,68,0.15)', fontSize:11, color:'#f87171' }}>
            ⚠️ Cannot reach backend: {error}
          </div>
        )}

        {data && (
          <div style={{ padding:'4px 16px 14px' }}>

            {/* System */}
            <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, padding:'10px 0 4px' }}>System</div>
            <Row icon="⚡" label="CPU Usage"   bar barPct={data.cpu_percent} barColor="#3b82f6" value={`${data.cpu_percent}%`} mono />
            <Row icon="🧠" label="RAM Usage"   bar barPct={data.ram_percent} barColor="#8b5cf6" value={`${data.ram_percent}% (${data.ram_free_gb}GB free)`} mono />
            <Row icon="💾" label="Disk Free"   ok={data.disk_ok} value={`${data.disk_free_gb} / ${data.disk_total_gb} GB`} mono />
            <Row icon="🕐" label="Uptime"      value={data.uptime} mono />

            {/* Workers */}
            <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, padding:'10px 0 4px' }}>Workers</div>
            <Row icon="🔧" label="Max Workers" value={`${data.max_workers} workers / ${data.cpu_count} CPUs`} mono />
            <Row icon="↻"  label="Active Jobs" bar barPct={data.max_workers > 0 ? (data.active_jobs/data.max_workers)*100 : 0} barColor="#10b981" value={`${data.active_jobs} running`} mono />
            <Row icon="⏳" label="Queued Jobs" value={`${data.queued_jobs} waiting`} mono />

            {/* Services */}
            <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700, padding:'10px 0 4px' }}>Services</div>
            <Row icon="🎬" label="ffmpeg"      ok={data.ffmpeg_ok}   value={data.ffmpeg_ok ? 'Ready' : 'Not found'} />
            <Row icon="🍪" label="YT Cookies"  ok={data.cookies_ok}  value={data.cookies_ok ? 'Loaded' : 'None (anon mode)'} />
            <Row icon="🖥️" label="Local Mode"  ok={data.local_mode}  value={data.local_mode ? 'Enabled' : 'Server mode'} />

            {/* Routes — auto-discovered */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0 4px' }}>
              <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>
                API Routes <span style={{ color:'#3b82f6', fontSize:10 }}>({data.route_count})</span>
              </div>
              <button onClick={()=>setShowRoutes(v=>!v)} style={{ fontSize:9, padding:'2px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.04)', color:'#777', cursor:'pointer', fontFamily:'inherit' }}>
                {showRoutes ? 'Hide' : 'Show all'}
              </button>
            </div>

            {showRoutes && (
              <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'8px 10px', maxHeight:200, overflowY:'auto' }}>
                {routes.map(path => (
                  <div key={path} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
                    <span style={{ fontSize:10, color:'#6ee7b7', fontFamily:'monospace' }}>{path}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Overall status */}
            <div style={{ marginTop:12, padding:'8px 12px', borderRadius:8, background:overall?'rgba(34,197,94,0.07)':'rgba(239,68,68,0.07)', border:`1px solid ${overall?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, display:'flex', alignItems:'center', gap:8 }}>
              <StatusDot ok={overall} />
              <span style={{ fontSize:12, fontWeight:600, color:overall?'#22c55e':'#f87171' }}>
                {overall ? 'All systems operational' : 'Degraded — check ffmpeg or disk'}
              </span>
            </div>

            <div style={{ marginTop:6, fontSize:9, color:'#444', textAlign:'center' }}>
              Auto-refreshes every 5s · {data.route_count} endpoints registered
            </div>
          </div>
        )}

        {!data && !error && (
          <div style={{ padding:20, textAlign:'center', fontSize:12, color:'#555' }}>Checking system health…</div>
        )}
      </div>
    </div>
  )
}
