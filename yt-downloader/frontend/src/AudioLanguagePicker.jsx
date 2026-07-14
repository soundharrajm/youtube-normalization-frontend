import { useState, useEffect, useRef } from "react";

// Comprehensive ISO 639-2 language list (106 languages) — with 100+ possible
// codes, most detected/typed values should match a preset directly instead
// of falling back to "Custom code…".
const LANGUAGE_PRESETS = [
  { code: "afr", name: "Afrikaans" },
  { code: "alb", name: "Albanian" },
  { code: "amh", name: "Amharic" },
  { code: "ara", name: "Arabic" },
  { code: "arm", name: "Armenian" },
  { code: "asm", name: "Assamese" },
  { code: "aze", name: "Azerbaijani" },
  { code: "baq", name: "Basque" },
  { code: "ben", name: "Bengali" },
  { code: "bos", name: "Bosnian" },
  { code: "bre", name: "Breton" },
  { code: "bul", name: "Bulgarian" },
  { code: "mya", name: "Burmese" },
  { code: "cat", name: "Catalan" },
  { code: "ceb", name: "Cebuano" },
  { code: "chi", name: "Chinese" },
  { code: "cor", name: "Cornish" },
  { code: "hrv", name: "Croatian" },
  { code: "cze", name: "Czech" },
  { code: "dan", name: "Danish" },
  { code: "div", name: "Dhivehi" },
  { code: "dut", name: "Dutch" },
  { code: "dzo", name: "Dzongkha" },
  { code: "eng", name: "English" },
  { code: "epo", name: "Esperanto" },
  { code: "est", name: "Estonian" },
  { code: "fij", name: "Fijian" },
  { code: "fil", name: "Filipino" },
  { code: "fin", name: "Finnish" },
  { code: "fre", name: "French" },
  { code: "glg", name: "Galician" },
  { code: "geo", name: "Georgian" },
  { code: "ger", name: "German" },
  { code: "gre", name: "Greek" },
  { code: "guj", name: "Gujarati" },
  { code: "hat", name: "Haitian Creole" },
  { code: "hau", name: "Hausa" },
  { code: "haw", name: "Hawaiian" },
  { code: "heb", name: "Hebrew" },
  { code: "hin", name: "Hindi" },
  { code: "hun", name: "Hungarian" },
  { code: "ice", name: "Icelandic" },
  { code: "ibo", name: "Igbo" },
  { code: "ind", name: "Indonesian" },
  { code: "gle", name: "Irish" },
  { code: "ita", name: "Italian" },
  { code: "jpn", name: "Japanese" },
  { code: "kan", name: "Kannada" },
  { code: "kaz", name: "Kazakh" },
  { code: "khm", name: "Khmer" },
  { code: "kor", name: "Korean" },
  { code: "kur", name: "Kurdish" },
  { code: "kir", name: "Kyrgyz" },
  { code: "lao", name: "Lao" },
  { code: "lat", name: "Latin" },
  { code: "lav", name: "Latvian" },
  { code: "lit", name: "Lithuanian" },
  { code: "ltz", name: "Luxembourgish" },
  { code: "mac", name: "Macedonian" },
  { code: "mlg", name: "Malagasy" },
  { code: "may", name: "Malay" },
  { code: "mal", name: "Malayalam" },
  { code: "mlt", name: "Maltese" },
  { code: "mri", name: "Maori" },
  { code: "mar", name: "Marathi" },
  { code: "mon", name: "Mongolian" },
  { code: "cnr", name: "Montenegrin" },
  { code: "nep", name: "Nepali" },
  { code: "nor", name: "Norwegian" },
  { code: "ori", name: "Odia" },
  { code: "pus", name: "Pashto" },
  { code: "per", name: "Persian" },
  { code: "pol", name: "Polish" },
  { code: "por", name: "Portuguese" },
  { code: "pan", name: "Punjabi" },
  { code: "rum", name: "Romanian" },
  { code: "rus", name: "Russian" },
  { code: "sam", name: "Samoan" },
  { code: "gla", name: "Scottish Gaelic" },
  { code: "srp", name: "Serbian" },
  { code: "snd", name: "Sindhi" },
  { code: "sin", name: "Sinhala" },
  { code: "slo", name: "Slovak" },
  { code: "slv", name: "Slovenian" },
  { code: "som", name: "Somali" },
  { code: "spa", name: "Spanish" },
  { code: "swa", name: "Swahili" },
  { code: "swe", name: "Swedish" },
  { code: "tgl", name: "Tagalog" },
  { code: "tgk", name: "Tajik" },
  { code: "tam", name: "Tamil" },
  { code: "tel", name: "Telugu" },
  { code: "tha", name: "Thai" },
  { code: "bod", name: "Tibetan" },
  { code: "ton", name: "Tongan" },
  { code: "tur", name: "Turkish" },
  { code: "tuk", name: "Turkmen" },
  { code: "ukr", name: "Ukrainian" },
  { code: "urd", name: "Urdu" },
  { code: "uzb", name: "Uzbek" },
  { code: "vie", name: "Vietnamese" },
  { code: "wel", name: "Welsh" },
  { code: "xho", name: "Xhosa" },
  { code: "yid", name: "Yiddish" },
  { code: "yor", name: "Yoruba" },
  { code: "zul", name: "Zulu" },
];
const NAME_BY_CODE = Object.fromEntries(LANGUAGE_PRESETS.map(l => [l.code, l.name]));

function LanguageCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selected = LANGUAGE_PRESETS.find(l => l.code === value);
  const displayValue = open
    ? query
    : (selected ? `${selected.name} (${selected.code})` : (value === "custom" ? "Custom code…" : ""));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? LANGUAGE_PRESETS.filter(l => l.name.toLowerCase().includes(q) || l.code.includes(q))
    : LANGUAGE_PRESETS;

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(code) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function openDropdown() {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.select(), 0);
  }

  return (
    <div ref={wrapperRef} style={S.comboWrapper}>
      <input
        ref={inputRef}
        style={S.select}
        value={displayValue}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={openDropdown}
        onClick={openDropdown}
        placeholder="Type to search 106 languages…"
        readOnly={!open}
      />
      <span style={S.comboArrow}>{open ? "▲" : "▼"}</span>

      {open && (
        <div style={S.dropdown}>
          {filtered.length === 0 && (
            <div style={S.dropdownEmpty}>No matches — use "Custom code…" below</div>
          )}
          {filtered.map(l => (
            <div
              key={l.code}
              style={{ ...S.dropdownItem, ...(l.code === value ? S.dropdownItemActive : {}) }}
              onMouseDown={e => { e.preventDefault(); pick(l.code); }}
            >
              {l.name} <span style={S.dropdownItemCode}>({l.code})</span>
            </div>
          ))}
          <div
            style={{ ...S.dropdownItem, ...S.dropdownItemCustom, ...(value === "custom" ? S.dropdownItemActive : {}) }}
            onMouseDown={e => { e.preventDefault(); pick("custom"); }}
          >
            ✏️ Custom code…
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [dismissed, setDismissed] = useState(false);

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

  const [collapsed, setCollapsed] = useState(false);

  if (!rows.length) return null;

  if (collapsed) {
    return (
      <div style={S.wrapper}>
        <button style={S.collapsedBar} onClick={() => setCollapsed(false)} title="Show audio language settings">
          <span style={S.headerIcon}>🌐</span>
          <span style={S.headerTitle}>Assign audio track languages</span>
          <span style={S.expandHint}>click to show ▾</span>
        </button>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      <div style={S.header}>
        <span style={S.headerIcon}>🌐</span>
        <span style={S.headerTitle}>Assign audio track languages</span>
        <button style={S.closeBtn} onClick={() => setCollapsed(true)} title="Hide (can be shown again)">✕</button>
      </div>
      <p style={S.headerHint}>Order below = order in the file. {LANGUAGE_PRESETS.length} languages available — search by typing in the dropdown.</p>

      {rows.map((r, i) => (
        <div key={i} style={S.card}>
          <div style={S.cardTopRow}>
            <span style={S.rowNum}>#{i + 1}</span>

            <div style={S.reorderCol}>
              <button style={S.reorderBtn} disabled={i === 0} onClick={() => moveRow(i, -1)} title="Move up">▲</button>
              <button style={S.reorderBtn} disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)} title="Move down">▼</button>
            </div>

            <LanguageCombobox value={r.code} onChange={code => updateRow(i, "code", code)} />

            <label style={S.defaultLabel} title="Plays by default when the file is opened">
              <input type="radio" name={`default-${jobId}`} checked={r.isDefault} onChange={() => setDefault(i)} />
              Default
            </label>
          </div>

          {r.code === "custom" && (
            <div style={S.customRow}>
              <span style={S.customHint}>3-letter ISO 639-2 code (e.g. <code>mal</code> for Malayalam, <code>zho</code> for Chinese):</span>
              <input
                style={S.customInput}
                value={r.customCode}
                onChange={e => updateRow(i, "customCode", e.target.value.toLowerCase().slice(0, 3))}
                placeholder="e.g. mal"
                maxLength={3}
                autoFocus
              />
            </div>
          )}

          <input
            style={S.titleInput}
            value={r.title}
            onChange={e => updateRow(i, "title", e.target.value)}
            placeholder={NAME_BY_CODE[r.code] ? `Display title (defaults to "${NAME_BY_CODE[r.code]}")` : "Display title (optional)"}
          />
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
  wrapper:      { background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, padding: "10px 12px", marginTop: 8, fontFamily: "'Inter','Segoe UI',sans-serif", width: "100%", boxSizing: "border-box" },
  header:       { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  closeBtn:     { marginLeft: "auto", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, width: 20, height: 20, color: "#9898b8", fontSize: 11, cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0 },

  collapsedBar: { width: "100%", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" },
  expandHint:   { marginLeft: "auto", fontSize: 10, color: "#6060a0", flexShrink: 0 },
  headerIcon:   { fontSize: 13 },
  headerTitle:  { fontSize: 12, fontWeight: 700, color: "#c084fc" },
  headerHint:   { fontSize: 10, color: "#6060a0", margin: "0 0 10px", lineHeight: 1.4 },

  card:         { background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: 8, marginBottom: 8 },
  cardTopRow:   { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowNum:       { fontSize: 10, color: "#6060a0", flexShrink: 0 },
  reorderCol:   { display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 },
  reorderBtn:   { fontSize: 8, width: 16, height: 13, padding: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "#9898b8", cursor: "pointer" },

  select:       { background: "#0d0d18", border: "1px solid #3a3a5c", borderRadius: 6, padding: "7px 26px 7px 8px", color: "#e2e2f0", fontSize: 12, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", cursor: "text" },

  comboWrapper: { position: "relative", flex: "1 1 140px", minWidth: 0 },
  comboArrow:   { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#9898b8", pointerEvents: "none" },
  dropdown:     { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 240, overflowY: "auto", background: "#14141f", border: "1px solid #3a3a5c", borderRadius: 6, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  dropdownItem: { padding: "7px 10px", fontSize: 12, color: "#e2e2f0", cursor: "pointer" },
  dropdownItemActive: { background: "rgba(168,85,247,0.18)", color: "#e9d5ff" },
  dropdownItemCode: { color: "#6060a0", fontSize: 10.5 },
  dropdownItemCustom: { borderTop: "1px solid rgba(255,255,255,0.08)", color: "#f59e0b", fontWeight: 600, position: "sticky", bottom: 0, background: "#14141f" },
  dropdownEmpty: { padding: "10px", fontSize: 11, color: "#6b7280", fontStyle: "italic" },

  defaultLabel: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#9898b8", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 },

  customRow:    { marginTop: 6, paddingTop: 6, borderTop: "1px dashed rgba(255,255,255,0.08)" },
  customHint:   { display: "block", fontSize: 10, color: "#f59e0b", marginBottom: 4, lineHeight: 1.4 },
  customInput:  { width: "100%", boxSizing: "border-box", background: "#1a0d24", border: "1.5px solid #a855f7", borderRadius: 6, padding: "8px 10px", color: "#e9d5ff", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", outline: "none", fontFamily: "'JetBrains Mono','Fira Code',monospace" },

  titleInput:   { width: "100%", boxSizing: "border-box", marginTop: 6, background: "#0d0d18", border: "1px solid #3a3a5c", borderRadius: 6, padding: "6px 8px", color: "#e2e2f0", fontSize: 11, outline: "none", fontFamily: "inherit" },

  errorMsg:     { fontSize: 11, color: "#f87171", margin: "6px 0 0" },
  savedMsg:     { fontSize: 11, color: "#6ee7b7", margin: "6px 0 0" },
  btnRow:       { display: "flex", justifyContent: "flex-end", marginTop: 8 },
  saveBtn:      { background: "#a855f7", border: "none", borderRadius: 6, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
