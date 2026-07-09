import { useState } from "react";

const LANGUAGE_PRESETS = [
  { code: "eng", name: "English" }, { code: "hin", name: "Hindi" },
  { code: "tel", name: "Telugu" },  { code: "tam", name: "Tamil" },
  { code: "may", name: "Malay" },   { code: "chi", name: "Chinese" },
  { code: "fre", name: "French" },  { code: "ger", name: "German" },
  { code: "spa", name: "Spanish" }, { code: "por", name: "Portuguese" },
  { code: "ita", name: "Italian" }, { code: "jpn", name: "Japanese" },
  { code: "kor", name: "Korean" },  { code: "ara", name: "Arabic" },
  { code: "rus", name: "Russian" }, { code: "ind", name: "Indonesian" },
  { code: "ben", name: "Bengali" }, { code: "pan", name: "Punjabi" },
  { code: "urd", name: "Urdu" },    { code: "tha", name: "Thai" },
  { code: "vie", name: "Vietnamese" }, { code: "tur", name: "Turkish" },
];
const NAME_BY_CODE = Object.fromEntries(LANGUAGE_PRESETS.map(l => [l.code, l.name]));

function rowFromDetected(code, i) {
  const known = NAME_BY_CODE[code];
  return {
    code: known ? code : "custom",
    customCode: known ? "" : (code === "und" ? "" : code),
    title: known || "",
    isDefault: i === 0,
  };
}

export default function AudioLanguagePicker({ apiFetch, jobId, detectedLanguages, onSaved }) {
  const [rows, setRows] = useState(() => (detectedLanguages || []).map(rowFromDetected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const updateRow = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const setDefault = (i) =>
    setRows(prev => prev.map((r, idx) => ({ ...r, isDefault: idx === i })));

  const moveRow = (i, dir) => {
    setRows(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  async function handleSave() {
    setError(null); setSaving(true); setSaved(false);
    try {
      const labels = rows.map(r => {
        const code = r.code === "custom" ? (r.customCode.trim().toLowerCase().slice(0, 3) || "und") : r.code;
        const title = r.title.trim() || NAME_BY_CODE[code] || code.toUpperCase();
        return { language: code, title, default: r.isDefault };
      });
      const res = await apiFetch("/merge-audio/relabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, labels }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed to save labels"); }
      const data = await res.json();
      setSaved(true);
      onSaved?.(data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (!rows.length) return null;

  return (
    <div style={S.wrapper}>
      <div style={S.header}>
        <span style={S.headerIcon}>🌐</span>
        <span style={S.headerTitle}>Assign audio track languages</span>
        <span style={S.headerHint}>order below = order in the file</span>
      </div>

      {rows.map((r, i) => (
        <div key={i} style={S.row}>
          <span style={S.rowNum}>#{i + 1}</span>

          <div style={S.reorderCol}>
            <button style={S.reorderBtn} disabled={i === 0} onClick={() => moveRow(i, -1)} title="Move up">▲</button>
            <button style={S.reorderBtn} disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)} title="Move down">▼</button>
          </div>

          <select style={S.select} value={r.code} onChange={e => updateRow(i, "code", e.target.value)}>
            {LANGUAGE_PRESETS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            <option value="custom">Custom code…</option>
          </select>

          {r.code === "custom" && (
            <input style={{ ...S.input, width: 60 }} value={r.customCode}
              onChange={e => updateRow(i, "customCode", e.target.value)}
              placeholder="e.g. mal" maxLength={3} />
          )}

          <input style={{ ...S.input, flex: 1 }} value={r.title}
            onChange={e => updateRow(i, "title", e.target.value)}
            placeholder={NAME_BY_CODE[r.code] || "Display title (optional)"} />

          <label style={S.defaultLabel} title="Plays by default when the file is opened">
            <input type="radio" name={`default-${jobId}`} checked={r.isDefault} onChange={() => setDefault(i)} />
            Default
          </label>
        </div>
      ))}

      {error && <p style={S.errorMsg}>⚠️ {error}</p>}
      {saved && !error && <p style={S.savedMsg}>✅ Saved — tags updated on the file directly.</p>}

      <div style={S.btnRow}>
        <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "💾 Save Language Labels"}
        </button>
      </div>
    </div>
  );
}

const S = {
  wrapper:      { background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, padding: "10px 12px", marginTop: 8, fontFamily: "'Inter','Segoe UI',sans-serif" },
  header:       { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  headerIcon:   { fontSize: 13 },
  headerTitle:  { fontSize: 12, fontWeight: 700, color: "#c084fc" },
  headerHint:   { fontSize: 10, color: "#6060a0", marginLeft: "auto" },
  row:          { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 },
  rowNum:       { fontSize: 10, color: "#6060a0", width: 20, flexShrink: 0 },
  reorderCol:   { display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 },
  reorderBtn:   { fontSize: 8, width: 16, height: 13, padding: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "#9898b8", cursor: "pointer" },
  select:       { background: "#0d0d18", border: "1px solid #3a3a5c", borderRadius: 6, padding: "6px 8px", color: "#e2e2f0", fontSize: 12, outline: "none", fontFamily: "inherit", flexShrink: 0 },
  input:        { background: "#0d0d18", border: "1px solid #3a3a5c", borderRadius: 6, padding: "6px 8px", color: "#e2e2f0", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", minWidth: 0 },
  defaultLabel: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#9898b8", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 },
  errorMsg:     { fontSize: 11, color: "#f87171", margin: "6px 0 0" },
  savedMsg:     { fontSize: 11, color: "#6ee7b7", margin: "6px 0 0" },
  btnRow:       { display: "flex", justifyContent: "flex-end", marginTop: 8 },
  saveBtn:      { background: "#a855f7", border: "none", borderRadius: 6, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
