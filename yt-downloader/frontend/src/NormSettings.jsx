import { useState } from "react";

const PRESETS = [
  {
    id: "fast",
    label: "⚡ Fast",
    desc: "Copy streams, no re-encode",
    flags: "-c:v copy -c:a copy -c:s copy",
    badge: "fastest",
    badgeColor: "#22c55e",
  },
  {
    id: "balanced",
    label: "⚖️ Balanced",
    desc: "H.264 CRF 23 — good size/quality",
    flags: "-c:v libx264 -crf 23 -preset medium -c:a copy -c:s copy",
    badge: "default",
    badgeColor: "#3b82f6",
  },
  {
    id: "hq",
    label: "🎬 High Quality",
    desc: "H.264 CRF 19 + forced IDR (original)",
    flags: "-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy",
    badge: "original",
    badgeColor: "#a855f7",
  },
  {
    id: "hq265",
    label: "💎 H.265",
    desc: "HEVC CRF 24 — smaller files",
    flags: "-c:v libx265 -crf 24 -preset medium -c:a copy -c:s copy",
    badge: "smaller",
    badgeColor: "#f59e0b",
  },
  {
    id: "custom",
    label: "✏️ Custom",
    desc: "Enter your own ffmpeg flags",
    flags: "",
    badge: "custom",
    badgeColor: "#6b7280",
  },
];

export default function NormSettings({ value, onChange }) {
  // value = { presetId, flags }
  const [customInput, setCustomInput] = useState(
    value?.presetId === "custom" ? value.flags : ""
  );
  const [open, setOpen] = useState(false);

  const activePreset = PRESETS.find((p) => p.id === value?.presetId) || PRESETS[2];

  function selectPreset(preset) {
    if (preset.id === "custom") {
      onChange({ presetId: "custom", flags: customInput });
    } else {
      onChange({ presetId: preset.id, flags: preset.flags });
    }
  }

  function handleCustomChange(e) {
    setCustomInput(e.target.value);
    onChange({ presetId: "custom", flags: e.target.value });
  }

  return (
    <div style={styles.wrapper}>
      {/* Collapsed trigger */}
      <button style={styles.trigger} onClick={() => setOpen((o) => !o)}>
        <span style={styles.triggerLeft}>
          <span style={styles.triggerIcon}>🎞️</span>
          <span>
            <span style={styles.triggerTitle}>Normalization</span>
            <span style={styles.triggerSub}>{activePreset.label}</span>
          </span>
        </span>
        <span style={{ ...styles.badge, background: activePreset.badgeColor }}>
          {activePreset.badge}
        </span>
        <span style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▾
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={styles.panel}>
          <p style={styles.panelHint}>
            Choose how ffmpeg processes each download. Applied to <em>all</em> queued videos.
          </p>

          <div style={styles.presetGrid}>
            {PRESETS.map((preset) => {
              const active = activePreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  style={{
                    ...styles.presetCard,
                    ...(active ? styles.presetCardActive : {}),
                    borderColor: active ? preset.badgeColor : "transparent",
                  }}
                  onClick={() => selectPreset(preset)}
                >
                  <div style={styles.presetHeader}>
                    <span style={styles.presetLabel}>{preset.label}</span>
                    <span style={{ ...styles.badge, background: preset.badgeColor }}>
                      {preset.badge}
                    </span>
                  </div>
                  <p style={styles.presetDesc}>{preset.desc}</p>
                  {preset.id !== "custom" && (
                    <code style={styles.presetCode}>{preset.flags}</code>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom flags input */}
          {activePreset.id === "custom" && (
            <div style={styles.customBox}>
              <label style={styles.customLabel}>
                ffmpeg flags &nbsp;
                <span style={styles.customHint}>
                  (inserted between <code>-i input</code> and <code>output</code>)
                </span>
              </label>
              <input
                style={styles.customInput}
                value={customInput}
                onChange={handleCustomChange}
                placeholder="-c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k"
                spellCheck={false}
              />
            </div>
          )}

          {/* Live preview */}
          <div style={styles.preview}>
            <span style={styles.previewLabel}>Command preview</span>
            <code style={styles.previewCode}>
              ffmpeg -y -i input.mp4 -map 0{" "}
              <span style={{ color: "#facc15" }}>
                {activePreset.id === "custom" ? customInput || "<your flags>" : activePreset.flags}
              </span>{" "}
              output_normalize.mp4
            </code>
          </div>

          <div style={styles.panelFooter}>
            <button style={styles.doneBtn} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    marginBottom: "12px",
  },
  trigger: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#1e1e2e",
    border: "1px solid #2e2e45",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    color: "#e2e2f0",
    textAlign: "left",
    transition: "border-color 0.15s",
  },
  triggerLeft: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  triggerIcon: { fontSize: "20px" },
  triggerTitle: {
    display: "block",
    fontSize: "11px",
    color: "#7878a0",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  triggerSub: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e2f0",
  },
  badge: {
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: "20px",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
  },
  chevron: {
    fontSize: "16px",
    color: "#7878a0",
    transition: "transform 0.2s",
  },
  panel: {
    background: "#16161f",
    border: "1px solid #2e2e45",
    borderTop: "none",
    borderRadius: "0 0 10px 10px",
    padding: "16px",
  },
  panelHint: {
    margin: "0 0 14px",
    fontSize: "13px",
    color: "#7878a0",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "8px",
    marginBottom: "14px",
  },
  presetCard: {
    background: "#1e1e2e",
    border: "2px solid transparent",
    borderRadius: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
    color: "#e2e2f0",
    transition: "border-color 0.15s, background 0.15s",
  },
  presetCardActive: {
    background: "#252538",
  },
  presetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  presetLabel: {
    fontSize: "13px",
    fontWeight: 600,
  },
  presetDesc: {
    margin: "0 0 6px",
    fontSize: "11px",
    color: "#9898b8",
  },
  presetCode: {
    display: "block",
    fontSize: "10px",
    color: "#6ee7b7",
    background: "#0d0d18",
    borderRadius: "4px",
    padding: "4px 6px",
    overflowX: "auto",
    whiteSpace: "nowrap",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  customBox: {
    marginBottom: "14px",
  },
  customLabel: {
    display: "block",
    fontSize: "12px",
    color: "#9898b8",
    marginBottom: "6px",
  },
  customHint: {
    fontSize: "11px",
    color: "#6060a0",
  },
  customInput: {
    width: "100%",
    background: "#0d0d18",
    border: "1px solid #3a3a5c",
    borderRadius: "6px",
    padding: "9px 12px",
    color: "#6ee7b7",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    outline: "none",
    boxSizing: "border-box",
  },
  preview: {
    background: "#0d0d18",
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "14px",
  },
  previewLabel: {
    display: "block",
    fontSize: "10px",
    color: "#6060a0",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "5px",
  },
  previewCode: {
    fontSize: "11px",
    color: "#a0a0c8",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    wordBreak: "break-all",
  },
  panelFooter: {
    display: "flex",
    justifyContent: "flex-end",
  },
  doneBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    padding: "7px 18px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
