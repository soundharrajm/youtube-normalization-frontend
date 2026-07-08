import { useState, useRef, useEffect, useCallback } from "react";
import NormSettings from "./NormSettings.jsx";

const STATUS_COLOR = {
  queued:      "#6b7280",
  downloading: "#3b82f6",
  merging:     "#a855f7",
  normalizing: "#f59e0b",
  done:        "#22c55e",
  error:       "#ef4444",
};

const STAGE_LABEL = (j) => {
  if (j.status === "downloading") {
    if (j.stage === "video") return "Fetching video…";
    if (j.stage === "video_downloaded") return "Video ready…";
    if (j.stage?.startsWith("audio_")) {
      const [, n, , total] = j.stage.split("_");
      return `Fetching audio ${n}/${total}…`;
    }
    return "Downloading…";
  }
  if (j.status === "merging") return "Merging audio tracks…";
  if (j.status === "normalizing") return `Normalizing… ${j.normalize_progress || 0}%`;
  if (j.status === "done") return "Done";
  if (j.status === "error") return "Error";
  return "Queued";
};

function Ring({ pct = 0, color = "#3b82f6", size = 36, spin = false }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = spin ? circ * 0.25 : (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={spin ? { animation: "merge-spin 1s linear infinite" } : undefined}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2e2e45" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      {!spin && <text x={size/2} y={size/2+4} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{pct}%</text>}
    </svg>
  );
}

function emptyAudioSource() {
  return { id: Math.random().toString(36).slice(2), url: "", language: "", offsetSec: "" };
}

export default function MergeAudio({ apiFetch, normConfig, onNormConfigChange, sessionId }) {
  const [open, setOpen]               = useState(false);
  const [videoUrl, setVideoUrl]       = useState("");
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [originalLang, setOriginalLang] = useState("");
  const [audioSources, setAudioSources] = useState([emptyAudioSource()]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [doNormalize, setDoNormalize]   = useState(false);
  const [starting, setStarting]       = useState(false);
  const [error, setError]             = useState(null);
  const [jobs, setJobs]                = useState([]);
  const pollRef = useRef(null);

  const addAudioSource    = () => setAudioSources(prev => [...prev, emptyAudioSource()]);
  const removeAudioSource = (id) => setAudioSources(prev => prev.filter(a => a.id !== id));
  const updateAudioSource = (id, field, value) =>
    setAudioSources(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  // ── Poll active jobs ──────────────────────────────────────────────────────
  const pollJobs = useCallback(async (jobIds) => {
    if (!jobIds.length) return;
    try {
      const results = await Promise.all(
        jobIds.map(id => apiFetch(`/merge-audio/status/${id}`).then(r => r.ok ? r.json() : null))
      );
      setJobs(prev => prev.map(j => {
        const fresh = results.find((r, i) => r && jobIds[i] === j.job_id);
        return fresh ? { ...j, ...fresh } : j;
      }));
    } catch (_) {}
  }, [apiFetch]);

  useEffect(() => {
    const activeIds = jobs
      .filter(j => !["done", "error"].includes(j.status))
      .map(j => j.job_id);
    if (activeIds.length) {
      pollRef.current = setInterval(() => pollJobs(activeIds), 1500);
    }
    return () => clearInterval(pollRef.current);
  }, [jobs, pollJobs]);

  // ── Start merge job ───────────────────────────────────────────────────────
  async function handleMerge() {
    setError(null);
    const cleanSources = audioSources
      .filter(a => a.url.trim())
      .map(a => ({
        url: a.url.trim(),
        language: a.language.trim() || null,
        offset_sec: a.offsetSec ? parseFloat(a.offsetSec) : 0,
      }));

    if (!videoUrl.trim()) { setError("Enter the video URL (the visuals to keep)."); return; }
    if (!cleanSources.length) { setError("Add at least one audio source URL."); return; }

    setStarting(true);
    try {
      const body = {
        video_url: videoUrl.trim(),
        audio_sources: cleanSources,
        include_original_audio: keepOriginal,
        original_language: originalLang.trim() || null,
        session_id: sessionId || null,
        norm_flags: doNormalize ? (normConfig?.flags || null) : null,
        output_ext: doNormalize ? (normConfig?.outputExt || "same") : "same",
      };
      const res = await apiFetch("/merge-audio/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed to start merge job"); }
      const created = await res.json();
      setJobs(prev => [{
        job_id: created.job_id,
        status: "queued",
        title: videoUrl,
        audio_count: cleanSources.length,
      }, ...prev]);
      // Reset form for next merge
      setVideoUrl(""); setAudioSources([emptyAudioSource()]); setOriginalLang("");
    } catch (e) { setError(e.message); }
    finally { setStarting(false); }
  }

  const activeCount = jobs.filter(j => !["done", "error"].includes(j.status)).length;
  const doneCount   = jobs.filter(j => j.status === "done").length;

  const clearDone = () => setJobs(prev => prev.filter(j => j.status !== "done" && j.status !== "error"));
  const clearAll  = () => setJobs([]);

  return (
    <div style={styles.wrapper}>
      <style>{`@keyframes merge-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Header / toggle */}
      <button style={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span style={styles.triggerLeft}>
          <span style={styles.triggerIcon}>🎬</span>
          <span>
            <span style={styles.triggerTitle}>Merge Audio (Multi-Language)</span>
            <span style={styles.triggerSub}>
              {activeCount > 0 ? `${activeCount} merging…` : doneCount > 0 ? `${doneCount} done` : "Combine dubs from separate videos"}
            </span>
          </span>
        </span>
        {activeCount > 0 && <span style={{ ...styles.badge, background: "#a855f7" }}>{activeCount} active</span>}
        <span style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>

      {open && (
        <div style={styles.panel}>
          <p style={styles.introText}>
            Pick one video for its <b>visuals</b>, then add other videos purely for their <b>audio</b>
            (e.g. the same trailer uploaded separately in other languages). Every audio track gets
            duration-corrected to match the video exactly — short tracks are padded with silence,
            long ones trimmed — so nothing drifts out of sync.
          </p>

          {/* Video source */}
          <label style={styles.label}>Video URL <span style={styles.hint}>— the visuals to keep</span></label>
          <input style={styles.input} value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..." spellCheck={false} />

          <div style={styles.optRow}>
            <label style={styles.checkbox}>
              <input type="checkbox" checked={keepOriginal} onChange={e => setKeepOriginal(e.target.checked)} />
              Keep this video's own audio as a track too
            </label>
            {keepOriginal && (
              <input style={{ ...styles.input, ...styles.langInput }} value={originalLang}
                onChange={e => setOriginalLang(e.target.value)}
                placeholder="Language label (e.g. English) — optional" spellCheck={false} />
            )}
          </div>

          {/* Audio sources */}
          <label style={{ ...styles.label, marginTop: 14 }}>Audio-only sources</label>
          {audioSources.map((a, i) => (
            <div key={a.id} style={styles.audioRow}>
              <span style={styles.audioRowNum}>{i + 1}</span>
              <input style={{ ...styles.input, flex: 2 }} value={a.url}
                onChange={e => updateAudioSource(a.id, "url", e.target.value)}
                placeholder="https://youtube.com/watch?v=... (audio only, video ignored)" spellCheck={false} />
              <input style={{ ...styles.input, flex: 1 }} value={a.language}
                onChange={e => updateAudioSource(a.id, "language", e.target.value)}
                placeholder="Language (e.g. Hindi)" spellCheck={false} />
              {showAdvanced && (
                <input style={{ ...styles.input, width: 90 }} value={a.offsetSec}
                  onChange={e => updateAudioSource(a.id, "offsetSec", e.target.value)}
                  placeholder="offset s" type="number" step="0.1" />
              )}
              {audioSources.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeAudioSource(a.id)} title="Remove">✕</button>
              )}
            </div>
          ))}

          <div style={styles.rowBetween}>
            <button style={styles.addLink} onClick={addAudioSource}>+ Add another audio source</button>
            <button style={styles.advancedLink} onClick={() => setShowAdvanced(v => !v)}>
              {showAdvanced ? "Hide" : "Show"} manual offset {showAdvanced ? "▴" : "▾"}
            </button>
          </div>
          {showAdvanced && (
            <p style={styles.hintBlock}>
              Only set an offset (seconds) if you already know this audio source starts earlier/later
              than the video — e.g. a different regional upload with a longer intro. Leave blank normally.
            </p>
          )}

          {/* Optional normalize pass */}
          <label style={{ ...styles.checkbox, marginTop: 14 }}>
            <input type="checkbox" checked={doNormalize} onChange={e => setDoNormalize(e.target.checked)} />
            Normalize / re-encode after merging (change output format, codec, etc.)
          </label>
          {doNormalize && (
            <div style={{ marginTop: 8 }}>
              <NormSettings value={normConfig} onChange={onNormConfigChange || (() => {})} />
            </div>
          )}

          {error && <p style={styles.errorMsg}>⚠️ {error}</p>}

          <div style={styles.btnRow}>
            <button style={styles.btnPrimary} onClick={handleMerge} disabled={starting}>
              {starting ? "Starting…" : "▶ Merge & Add to Queue"}
            </button>
          </div>

          {/* Job list */}
          {jobs.length > 0 && (
            <div style={styles.jobSection}>
              <div style={styles.jobHeader}>
                <span style={styles.jobHeaderTitle}>Merge Jobs <span style={{ color: "#a855f7" }}>({jobs.length})</span></span>
                <div style={{ display: "flex", gap: 5 }}>
                  {doneCount > 0 && (
                    <button style={styles.smallBtn} onClick={clearDone}>Clear Done</button>
                  )}
                  <button style={{ ...styles.smallBtn, borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#f87171" }} onClick={clearAll}>
                    ✕ Clear All
                  </button>
                </div>
              </div>

              {jobs.map(j => (
                <div key={j.job_id} style={styles.jobCard}>
                  <Ring
                    pct={j.status === "done" ? 100 : j.normalize_progress || 0}
                    color={STATUS_COLOR[j.status] || "#6b7280"}
                    spin={["downloading", "merging"].includes(j.status)}
                  />
                  <div style={styles.jobInfo}>
                    <p style={styles.jobTitle}>{j.title}</p>
                    <p style={styles.jobStage}>{STAGE_LABEL(j)}</p>
                    {j.status === "done" && (
                      <>
                        <p style={styles.jobOut}>✅ {j.filename}</p>
                        {j.audio_tracks?.length > 0 && (
                          <p style={styles.jobTracks}>
                            🎧 {j.audio_tracks.map(t => `${t.language}${t.duration_diff > 2 ? ` (⚠ ${t.duration_diff}s diff)` : ""}`).join(" · ")}
                          </p>
                        )}
                      </>
                    )}
                    {j.duration_warnings?.length > 0 && j.status !== "error" && (
                      <p style={styles.jobWarn}>⚠️ {j.duration_warnings.join(" · ")}</p>
                    )}
                    {j.status === "error" && <p style={styles.jobError}>❌ {j.error}</p>}
                  </div>
                  <span style={{ ...styles.statusBadge, background: STATUS_COLOR[j.status] }}>
                    {j.status === "done" ? "Done" : j.status === "error" ? "Error" : "Working…"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper:      { fontFamily: "'Inter','Segoe UI',sans-serif", marginBottom: 12 },
  trigger:      { width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#1e1e2e", border: "1px solid #2e2e45", borderRadius: 10, padding: "10px 14px", cursor: "pointer", color: "#e2e2f0", textAlign: "left" },
  triggerLeft:  { flex: 1, display: "flex", alignItems: "center", gap: 10 },
  triggerIcon:  { fontSize: 20 },
  triggerTitle: { display: "block", fontSize: 11, color: "#7878a0", textTransform: "uppercase", letterSpacing: "0.08em" },
  triggerSub:   { display: "block", fontSize: 14, fontWeight: 600, color: "#e2e2f0" },
  badge:        { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, color: "#fff", textTransform: "uppercase" },
  chevron:      { fontSize: 16, color: "#7878a0", transition: "transform 0.2s" },
  panel:        { background: "#16161f", border: "1px solid #2e2e45", borderTop: "none", borderRadius: "0 0 10px 10px", padding: 16 },
  introText:    { fontSize: 12, color: "#9898b8", lineHeight: 1.6, margin: "0 0 14px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8, padding: "10px 12px" },
  label:        { display: "block", fontSize: 12, color: "#9898b8", marginBottom: 6 },
  hint:         { color: "#505070", fontSize: 11 },
  hintBlock:    { fontSize: 11, color: "#6060a0", margin: "6px 0 0", lineHeight: 1.5 },
  input:        { width: "100%", background: "#0d0d18", border: "1px solid #3a3a5c", borderRadius: 6, padding: "9px 12px", color: "#e2e2f0", fontSize: 13, fontFamily: "'JetBrains Mono','Fira Code',monospace", outline: "none", boxSizing: "border-box" },
  langInput:    { flex: 1 },
  optRow:       { display: "flex", gap: 10, alignItems: "center", margin: "10px 0" },
  checkbox:     { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9898b8", cursor: "pointer", whiteSpace: "nowrap" },
  audioRow:     { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 },
  audioRowNum:  { fontSize: 11, color: "#6060a0", width: 16, textAlign: "center", flexShrink: 0 },
  removeBtn:    { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#f87171", width: 28, height: 34, cursor: "pointer", flexShrink: 0 },
  rowBetween:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  addLink:      { background: "none", border: "none", color: "#a855f7", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 },
  advancedLink: { background: "none", border: "none", color: "#6060a0", fontSize: 11, cursor: "pointer", padding: 0 },
  errorMsg:     { background: "#2a1515", border: "1px solid #5a1a1a", borderRadius: 6, padding: "8px 12px", color: "#f87171", fontSize: 13, marginTop: 12, marginBottom: 0 },
  btnRow:       { display: "flex", gap: 8, marginTop: 14, marginBottom: 12 },
  btnPrimary:   { background: "#a855f7", border: "none", borderRadius: 6, padding: "9px 22px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  jobSection:   { borderTop: "1px solid #2e2e45", paddingTop: 12 },
  jobHeader:    { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  jobHeaderTitle: { fontSize: 12, color: "#7878a0", textTransform: "uppercase", letterSpacing: "0.08em" },
  smallBtn:     { fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", color: "#777", cursor: "pointer", fontFamily: "inherit" },
  jobCard:      { display: "flex", alignItems: "flex-start", gap: 12, background: "#1e1e2e", borderRadius: 8, padding: "10px 12px", marginBottom: 6 },
  jobInfo:      { flex: 1, minWidth: 0 },
  jobTitle:     { margin: 0, fontSize: 13, fontWeight: 600, color: "#e2e2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  jobStage:     { margin: "2px 0 0", fontSize: 11, color: "#a855f7" },
  jobOut:       { margin: "3px 0 0", fontSize: 11, color: "#6ee7b7" },
  jobTracks:    { margin: "3px 0 0", fontSize: 10, color: "#9898b8" },
  jobWarn:      { margin: "3px 0 0", fontSize: 10, color: "#f59e0b" },
  jobError:     { margin: "3px 0 0", fontSize: 11, color: "#f87171" },
  statusBadge:  { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, color: "#fff", flexShrink: 0, alignSelf: "center" },
};
