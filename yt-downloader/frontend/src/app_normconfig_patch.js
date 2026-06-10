// ══════════════════════════════════════════════════════
// App.jsx — 3 small changes
// ══════════════════════════════════════════════════════

// 1. normConfig state — add outputExt defaulting to "same":
//
// const [normConfig, setNormConfig] = useState({
//   presetId:  'hq',
//   flags:     '-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy',
//   outputExt: 'same',    // ← ADD (same = output ext matches input ext)
// })


// 2. _dispatchDownload POST body — add output_ext:
//
// body: JSON.stringify({
//   items: [{ url, format_id, session_id }],
//   norm_flags: normConfig.flags,
//   output_ext: normConfig.outputExt || 'same',   // ← ADD
// }),


// 3. Header pill — update to show extension setting:
//
// FIND this in the JSX (the pill showing yt-dlp → ... → _normalize.mp4):
//   → <span style={{ color:'#10b981' }}>_normalize.mp4</span>
//
// REPLACE WITH:
//   → <span style={{ color:'#10b981' }}>
//       _normalize.{normConfig.outputExt === 'same' ? '<src>' : normConfig.outputExt}
//     </span>
