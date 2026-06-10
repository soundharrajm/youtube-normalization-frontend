import { useState } from "react";

const PRESETS = [
  { id:"fast",    label:"⚡ Fast",         desc:"Copy streams, no re-encode",           flags:"-c:v copy -c:a copy -c:s copy",                            badge:"fastest",  badgeColor:"#22c55e" },
  { id:"balanced",label:"⚖️ Balanced",     desc:"H.264 CRF 23 — good size/quality",    flags:"-c:v libx264 -crf 23 -preset medium -c:a copy -c:s copy", badge:"default",  badgeColor:"#3b82f6" },
  { id:"hq",      label:"🎬 High Quality", desc:"H.264 CRF 19 + forced IDR (original)", flags:"-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy", badge:"original", badgeColor:"#a855f7" },
  { id:"hq265",   label:"💎 H.265",        desc:"HEVC CRF 24 — smaller files",          flags:"-c:v libx265 -crf 24 -preset medium -c:a copy -c:s copy", badge:"smaller",  badgeColor:"#f59e0b" },
  { id:"custom",  label:"✏️ Custom",       desc:"Enter your own ffmpeg flags",           flags:"",                                                         badge:"custom",   badgeColor:"#6b7280" },
];

const OUTPUT_FORMATS = [
  { ext:"same", label:"Same as source", desc:"mp4→mp4  ts→ts",  color:"#8b5cf6" },
  { ext:"mp4",  label:".mp4",           desc:"Most compatible", color:"#6ee7b7" },
  { ext:"ts",   label:".ts",            desc:"Transport Stream",color:"#6ee7b7" },
  { ext:"mkv",  label:".mkv",           desc:"Best for subs",   color:"#6ee7b7" },
  { ext:"mov",  label:".mov",           desc:"Apple QuickTime", color:"#6ee7b7" },
];

export default function NormSettings({ value, onChange }) {
  const [customInput, setCustomInput] = useState(value?.presetId === "custom" ? value.flags : "")
  const [open, setOpen] = useState(false)

  const activePreset = PRESETS.find(p => p.id === value?.presetId) || PRESETS[2]
  const activeExt    = value?.outputExt || "same"

  function selectPreset(preset) {
    if (preset.id === "custom") onChange({ ...value, presetId:"custom", flags:customInput })
    else onChange({ ...value, presetId:preset.id, flags:preset.flags })
  }

  function handleCustomChange(e) {
    setCustomInput(e.target.value)
    onChange({ ...value, presetId:"custom", flags:e.target.value })
  }

  function selectExt(ext) {
    onChange({ ...value, outputExt: ext })
  }

  return (
    <div style={S.wrapper}>

      {/* ── Always-visible output format row ── */}
      <div style={S.formatBar}>
        <span style={S.formatBarLabel}>Output format</span>
        <div style={S.formatBtns}>
          {OUTPUT_FORMATS.map(f => {
            const active = activeExt === f.ext
            return (
              <button key={f.ext} onClick={() => selectExt(f.ext)} title={f.desc} style={{
                ...S.fmtBtn,
                background: active
                  ? (f.ext === "same" ? "rgba(139,92,246,0.2)" : "rgba(110,231,183,0.15)")
                  : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${active
                  ? (f.ext === "same" ? "#8b5cf6" : "#6ee7b7")
                  : "rgba(255,255,255,0.1)"}`,
                color: active
                  ? (f.ext === "same" ? "#a78bfa" : "#6ee7b7")
                  : "#888",
              }}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Collapsible preset trigger ── */}
      <button style={S.trigger} onClick={() => setOpen(o => !o)}>
        <span style={S.triggerLeft}>
          <span style={S.triggerIcon}>🎞️</span>
          <span>
            <span style={S.triggerTitle}>Encoding Preset</span>
            <span style={S.triggerSub}>{activePreset.label}</span>
          </span>
        </span>
        <span style={{ ...S.badge, background: activePreset.badgeColor }}>{activePreset.badge}</span>
        <span style={{ ...S.chevron, transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>

      {/* ── Expanded presets ── */}
      {open && (
        <div style={S.panel}>
          <div style={S.presetGrid}>
            {PRESETS.map(preset => {
              const active = activePreset.id === preset.id
              return (
                <button key={preset.id} onClick={() => selectPreset(preset)} style={{
                  ...S.presetCard,
                  borderColor: active ? preset.badgeColor : "transparent",
                  background: active ? "#252538" : "#1e1e2e",
                }}>
                  <div style={S.presetHeader}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{preset.label}</span>
                    <span style={{ ...S.badge, background:preset.badgeColor }}>{preset.badge}</span>
                  </div>
                  <p style={S.presetDesc}>{preset.desc}</p>
                  {preset.id !== "custom" && <code style={S.presetCode}>{preset.flags}</code>}
                </button>
              )
            })}
          </div>

          {activePreset.id === "custom" && (
            <div style={{ marginBottom:14 }}>
              <label style={S.customLabel}>
                ffmpeg flags <span style={{ fontSize:11, color:"#6060a0" }}>(between <code>-i input</code> and <code>output</code>)</span>
              </label>
              <input style={S.customInput} value={customInput} onChange={handleCustomChange}
                spellCheck={false} placeholder="-c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k" />
            </div>
          )}

          <div style={S.preview}>
            <span style={S.previewLabel}>Command preview</span>
            <code style={S.previewCode}>
              ffmpeg -y -i <span style={{color:"#f59e0b"}}>input.mp4</span> -map 0{" "}
              <span style={{color:"#facc15"}}>{activePreset.id==="custom" ? customInput||"<your flags>" : activePreset.flags}</span>{" "}
              <span style={{color:"#6ee7b7"}}>output_normalize.{activeExt==="same" ? "<src_ext>" : activeExt}</span>
            </code>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button style={S.doneBtn} onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  wrapper:     { fontFamily:"'Inter','Segoe UI',sans-serif", marginBottom:12 },

  // ── always-visible format bar ──
  formatBar:   {
    display:"flex", alignItems:"center", gap:12,
    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:10, padding:"10px 14px", marginBottom:6,
  },
  formatBarLabel: { fontSize:11, color:"#7878a0", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, whiteSpace:"nowrap" },
  formatBtns:  { display:"flex", gap:6, flexWrap:"wrap", flex:1 },
  fmtBtn:      {
    fontSize:12, fontWeight:700, padding:"5px 12px", borderRadius:8,
    cursor:"pointer", fontFamily:"monospace", transition:"all 0.15s",
    whiteSpace:"nowrap",
  },

  // ── preset trigger ──
  trigger:     { width:"100%", display:"flex", alignItems:"center", gap:10, background:"#1e1e2e", border:"1px solid #2e2e45", borderRadius:10, padding:"10px 14px", cursor:"pointer", color:"#e2e2f0", textAlign:"left" },
  triggerLeft: { flex:1, display:"flex", alignItems:"center", gap:10 },
  triggerIcon: { fontSize:20 },
  triggerTitle:{ display:"block", fontSize:11, color:"#7878a0", textTransform:"uppercase", letterSpacing:"0.08em" },
  triggerSub:  { display:"block", fontSize:14, fontWeight:600, color:"#e2e2f0" },
  badge:       { fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20, color:"#fff", textTransform:"uppercase", flexShrink:0 },
  chevron:     { fontSize:16, color:"#7878a0", transition:"transform 0.2s" },

  // ── expanded panel ──
  panel:       { background:"#16161f", border:"1px solid #2e2e45", borderTop:"none", borderRadius:"0 0 10px 10px", padding:16 },
  presetGrid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8, marginBottom:14 },
  presetCard:  { border:"2px solid", borderRadius:8, padding:"10px 12px", cursor:"pointer", textAlign:"left", color:"#e2e2f0", transition:"all 0.15s" },
  presetHeader:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  presetDesc:  { margin:"0 0 6px", fontSize:11, color:"#9898b8" },
  presetCode:  { display:"block", fontSize:10, color:"#6ee7b7", background:"#0d0d18", borderRadius:4, padding:"4px 6px", overflowX:"auto", whiteSpace:"nowrap", fontFamily:"monospace" },
  customLabel: { display:"block", fontSize:12, color:"#9898b8", marginBottom:6 },
  customInput: { width:"100%", background:"#0d0d18", border:"1px solid #3a3a5c", borderRadius:6, padding:"9px 12px", color:"#6ee7b7", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" },
  preview:     { background:"#0d0d18", borderRadius:6, padding:"10px 12px", marginBottom:14 },
  previewLabel:{ display:"block", fontSize:10, color:"#6060a0", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 },
  previewCode: { fontSize:11, color:"#a0a0c8", fontFamily:"monospace", wordBreak:"break-all" },
  doneBtn:     { background:"#3b82f6", border:"none", borderRadius:6, padding:"7px 18px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" },
}
