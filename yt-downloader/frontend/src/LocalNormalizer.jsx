import { useState, useRef, useEffect, useCallback } from "react";

const VIDEO_EXTS = [".mp4", ".mkv", ".mov", ".avi", ".ts", ".m4v", ".wmv", ".flv", ".webm"];

const STATUS_COLOR = {
  queued:      "#6b7280",
  normalizing: "#3b82f6",
  done:        "#22c55e",
  error:       "#ef4444",
};

const STATUS_LABEL = {
  queued:      "Queued",
  normalizing: "Normalizing…",
  done:        "Done",
  error:       "Error",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Ring({ pct = 0, color = "#3b82f6", size = 36 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#2e2e45" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle"
        fontSize="9" fill={color} fontWeight="700">{pct}%</text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LocalNormalizer({ apiFetch, normConfig, isLocalMode }) {
  const [paths, setPaths]         = useState("");
  const [recursive, setRecursive] = useState(false);
  const [skipDone, setSkipDone]   = useState(true);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [starting, setStarting]   = useState(false);
  const [jobs, setJobs]           = useState([]);       // { job_id, source_path, out_path, ...status }
  const [error, setError]         = useState(null);
  const [open, setOpen]           = useState(false);
  const pollRef = useRef(null);

  // ── Poll active jobs ──────────────────────────────────────────────────────
  const pollJobs = useCallback(async (jobIds) => {
    if (!jobIds.length) return;
    try {
      const res = await apiFetch("/download/status/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobIds),
      });
      const data = await res.json();
      setJobs(prev =>
        prev.map(j => {
          const fresh = data[j.job_id];
          return fresh ? { ...j, ...fresh } : j;
        })
      );
    } catch (_) {}
  }, [apiFetch]);

  useEffect(() => {
    const activeIds = jobs
      .filter(j => j.status === "queued" || j.status === "normalizing")
      .map(j => j.job_id);

    if (activeIds.length) {
      pollRef.current = setInterval(() => pollJobs(activeIds), 1000);
    }
    return () => clearInterval(pollRef.current);
  }, [jobs, pollJobs]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  async function handleScan() {
    const pathList = paths.split("\n").map(p => p.trim()).filter(Boolean);
    if (!pathList.length) { setError("Enter at least one path."); return; }
    setError(null);
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiFetch("/normalize/local/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: pathList, recursive, skip_already_normalized: skipDone }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Scan failed");
      }
      setScanResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // ── Start jobs ────────────────────────────────────────────────────────────
  async function handleStart() {
    const pathList = paths.split("\n").map(p => p.trim()).filter(Boolean);
    setError(null);
    setStarting(true);
    try {
      const res = await apiFetch("/normalize/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paths: pathList,
          norm_flags: normConfig?.flags || null,
          recursive,
          skip_already_normalized: skipDone,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Failed to start jobs");
      }
      const created = await res.json(); // [{ job_id, source_path, out_path, status }]
      setJobs(prev => [
        ...created.map(j => ({
          job_id:             j.job_id,
          source_path:        j.source_path,
          out_path:           j.out_path,
          title:              j.source_path.split(/[\\/]/).pop(),
          status:             "queued",
          normalize_progress: 0,
        })),
        ...prev,
      ]);
      setScanResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  function clearDone() {
    setJobs(prev => prev.filter(j => j.status !== "done" && j.status !== "error"));
  }

  const activeCount = jobs.filter(j => j.status === "queued" || j.status === "normalizing").length;
  const doneCount   = jobs.filter(j => j.status === "done").length;

  // ── Server mode guard ─────────────────────────────────────────────────────
  if (!isLocalMode) {
    return (
      <div style={styles.serverBlock}>
        <span style={styles.serverIcon}>🖥️</span>
        <div>
          <p style={styles.serverTitle}>Local Normalizer — not available</p>
          <p style={styles.serverSub}>
            The backend is running in server mode. Local file paths aren't accessible.
            <br />Set <code>LOCAL_MODE=true</code> in your backend <code>.env</code> to enable this.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* Header / toggle */}
      <button style={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span style={styles.triggerLeft}>
          <span style={styles.triggerIcon}>📁</span>
          <span>
            <span style={styles.triggerTitle}>Local File Normalizer</span>
            <span style={styles.triggerSub}>
              {activeCount > 0
                ? `${activeCount} running…`
                : doneCount > 0
                ? `${doneCount} done`
                : "Normalize files on this machine"}
            </span>
          </span>
        </span>
        {activeCount > 0 && (
          <span style={{ ...styles.badge, background: "#3b82f6" }}>{activeCount} active</span>
        )}
        <span style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>

      {open && (
        <div style={styles.panel}>

          {/* Path input */}
          <label style={styles.label}>
            File or folder path(s)
            <span style={styles.hint}> — one per line; folders are scanned automatically</span>
          </label>
          <textarea
            style={styles.textarea}
            rows={3}
            value={paths}
            onChange={e => { setPaths(e.target.value); setScanResult(null); }}
            placeholder={"C:\\Videos\\movie.mp4\nC:\\Shows\\Season1\\"}
            spellCheck={false}
          />

          {/* Options row */}
          <div style={styles.optRow}>
            <label style={styles.checkbox}>
              <input type="checkbox" checked={recursive}
                onChange={e => setRecursive(e.target.checked)} />
              Scan subfolders recursively
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" checked={skipDone}
                onChange={e => setSkipDone(e.target.checked)} />
              Skip already-normalized files
            </label>
          </div>

          {/* Supported formats note */}
          <p style={styles.extsNote}>
            Supported: {VIDEO_EXTS.join("  ")}
          </p>

          {/* Error */}
          {error && <p style={styles.errorMsg}>⚠️ {error}</p>}

          {/* Action buttons */}
          <div style={styles.btnRow}>
            <button style={styles.btnSecondary} onClick={handleScan} disabled={scanning || !paths.trim()}>
              {scanning ? "Scanning…" : "🔍 Preview files"}
            </button>
            <button style={styles.btnPrimary} onClick={handleStart} disabled={starting || !paths.trim()}>
              {starting ? "Starting…" : "▶ Normalize"}
            </button>
          </div>

          {/* Scan preview */}
          {scanResult && (
            <div style={styles.scanBox}>
              <p style={styles.scanTitle}>
                {scanResult.count === 0
                  ? "No eligible files found."
                  : `Found ${scanResult.count} file${scanResult.count !== 1 ? "s" : ""} to normalize:`}
              </p>
              {scanResult.files.map((f, i) => (
                <div key={i} style={styles.scanRow}>
                  <span style={styles.scanFile}>{f.source.split(/[\\/]/).pop()}</span>
                  <span style={styles.scanMeta}>{f.size_mb} MB</span>
                  <span style={styles.scanArrow}>→</span>
                  <span style={styles.scanOut}>{f.out.split(/[\\/]/).pop()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Job list */}
          {jobs.length > 0 && (
            <div style={styles.jobSection}>
              <div style={styles.jobHeader}>
                <span style={styles.jobHeaderTitle}>Jobs</span>
                {doneCount > 0 && (
                  <button style={styles.clearBtn} onClick={clearDone}>Clear done</button>
                )}
              </div>

              {/* ── Queue status bar ── */}
              {jobs.length > 0 && (() => {
                const total     = jobs.length
                const done      = jobs.filter(j => j.status === 'done').length
                const running   = jobs.filter(j => j.status === 'normalizing').length
                const queued    = jobs.filter(j => j.status === 'queued').length
                const errored   = jobs.filter(j => j.status === 'error').length
                const pct       = total > 0 ? Math.round(done / total * 100) : 0
                return (
                  <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, color:'#7878a0', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>⚡ Queue</span>
                      <div style={{ display:'flex', gap:10, fontSize:10, fontFamily:'monospace' }}>
                        {running > 0 && <span style={{ color:'#3b82f6' }}>↻ {running} running</span>}
                        {queued  > 0 && <span style={{ color:'#f59e0b' }}>⏳ {queued} waiting</span>}
                        {done    > 0 && <span style={{ color:'#22c55e' }}>✓ {done} done</span>}
                        {errored > 0 && <span style={{ color:'#ef4444' }}>✕ {errored} error</span>}
                      </div>
                      <span style={{ fontSize:10, color:'#3b82f6', fontWeight:700, fontFamily:'monospace' }}>{pct}%</span>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:100, height:4 }}>
                      <div style={{
                        height:'100%', borderRadius:100,
                        background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                        width:`${pct}%`, transition:'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                )
              })()}

              {jobs.map(j => (
                <div key={j.job_id} style={styles.jobCard}>
                  <Ring
                    pct={j.status === "done" ? 100 : j.normalize_progress || 0}
                    color={STATUS_COLOR[j.status] || "#6b7280"}
                  />
                  <div style={styles.jobInfo}>
                    <p style={styles.jobTitle}>{j.title || j.source_path?.split(/[\\/]/).pop()}</p>
                    <p style={styles.jobPath}>{j.source_path}</p>
                    {j.status === "done" && (
                      <p style={styles.jobOut}>✅ {j.out_path}</p>
                    )}
                    {j.status === "error" && (
                      <p style={styles.jobError}>❌ {j.error}</p>
                    )}
                  </div>
                  <span style={{ ...styles.statusBadge, background: STATUS_COLOR[j.status] }}>
                    {STATUS_LABEL[j.status]}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: { fontFamily: "'Inter','Segoe UI',sans-serif", marginBottom: "12px" },
  trigger: {
    width: "100%", display: "flex", alignItems: "center", gap: "10px",
    background: "#1e1e2e", border: "1px solid #2e2e45", borderRadius: "10px",
    padding: "10px 14px", cursor: "pointer", color: "#e2e2f0", textAlign: "left",
  },
  triggerLeft: { flex: 1, display: "flex", alignItems: "center", gap: "10px" },
  triggerIcon: { fontSize: "20px" },
  triggerTitle: { display: "block", fontSize: "11px", color: "#7878a0", textTransform: "uppercase", letterSpacing: "0.08em" },
  triggerSub: { display: "block", fontSize: "14px", fontWeight: 600, color: "#e2e2f0" },
  badge: { fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", color: "#fff", textTransform: "uppercase" },
  chevron: { fontSize: "16px", color: "#7878a0", transition: "transform 0.2s" },

  panel: { background: "#16161f", border: "1px solid #2e2e45", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "16px" },

  label: { display: "block", fontSize: "12px", color: "#9898b8", marginBottom: "6px" },
  hint:  { color: "#505070", fontSize: "11px" },
  textarea: {
    width: "100%", background: "#0d0d18", border: "1px solid #3a3a5c",
    borderRadius: "6px", padding: "9px 12px", color: "#e2e2f0",
    fontSize: "13px", fontFamily: "'JetBrains Mono','Fira Code',monospace",
    outline: "none", resize: "vertical", boxSizing: "border-box",
  },

  optRow: { display: "flex", gap: "20px", margin: "10px 0 6px" },
  checkbox: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#9898b8", cursor: "pointer" },

  extsNote: { fontSize: "11px", color: "#505070", margin: "0 0 12px", fontFamily: "monospace", letterSpacing: "0.03em" },

  errorMsg: { background: "#2a1515", border: "1px solid #5a1a1a", borderRadius: "6px", padding: "8px 12px", color: "#f87171", fontSize: "13px", marginBottom: "10px" },

  btnRow: { display: "flex", gap: "8px", marginBottom: "12px" },
  btnSecondary: {
    background: "#252538", border: "1px solid #3a3a5c", borderRadius: "6px",
    padding: "8px 16px", color: "#a0a0c8", fontSize: "13px", cursor: "pointer",
  },
  btnPrimary: {
    background: "#3b82f6", border: "none", borderRadius: "6px",
    padding: "8px 20px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },

  scanBox: { background: "#0d0d18", borderRadius: "8px", padding: "12px", marginBottom: "12px" },
  scanTitle: { fontSize: "12px", color: "#7878a0", margin: "0 0 8px" },
  scanRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginBottom: "4px" },
  scanFile: { color: "#e2e2f0", flex: "0 0 auto", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  scanMeta: { color: "#505070", fontSize: "11px", flex: "0 0 auto" },
  scanArrow: { color: "#3b82f6" },
  scanOut: { color: "#6ee7b7", fontFamily: "monospace", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  jobSection: { borderTop: "1px solid #2e2e45", paddingTop: "12px" },
  jobHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" },
  jobHeaderTitle: { fontSize: "12px", color: "#7878a0", textTransform: "uppercase", letterSpacing: "0.08em" },
  clearBtn: { background: "none", border: "none", color: "#6060a0", fontSize: "12px", cursor: "pointer" },

  jobCard: {
    display: "flex", alignItems: "flex-start", gap: "12px",
    background: "#1e1e2e", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px",
  },
  jobInfo: { flex: 1, minWidth: 0 },
  jobTitle: { margin: 0, fontSize: "13px", fontWeight: 600, color: "#e2e2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  jobPath: { margin: "2px 0 0", fontSize: "10px", color: "#505070", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  jobOut:  { margin: "3px 0 0", fontSize: "11px", color: "#6ee7b7" },
  jobError:{ margin: "3px 0 0", fontSize: "11px", color: "#f87171" },
  statusBadge: { fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", color: "#fff", flexShrink: 0, alignSelf: "center" },

  serverBlock: {
    display: "flex", gap: "14px", alignItems: "flex-start",
    background: "#1a1a28", border: "1px solid #2e2e45", borderRadius: "10px", padding: "14px 16px",
  },
  serverIcon: { fontSize: "24px", flexShrink: 0, marginTop: "2px" },
  serverTitle: { margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#e2e2f0" },
  serverSub: { margin: 0, fontSize: "12px", color: "#7878a0", lineHeight: 1.5 },
};
