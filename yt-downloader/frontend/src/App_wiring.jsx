// ══════════════════════════════════════════════════════
// App.jsx — changes needed to wire NormSettings
// ══════════════════════════════════════════════════════

// 1. Import the component
import NormSettings from "./NormSettings";


// 2. Add state near your other state declarations
const [normConfig, setNormConfig] = useState({
  presetId: "hq",
  flags: "-c:v libx264 -crf 19 -forced-idr 1 -c:a copy -c:s copy",
});


// 3. Render NormSettings somewhere above your URL list / Download All button
<NormSettings value={normConfig} onChange={setNormConfig} />


// 4. Pass norm_flags in your /download/batch fetch call
//    Find where you POST to /download/batch and add norm_flags to the body:
//
//    const res = await apiFetch("/download/batch", {
//      method: "POST",
//      headers: { "Content-Type": "application/json" },
//      body: JSON.stringify({
//        urls: [...],
//        format_id: selectedFormat,
//        parallel: parallelDownload,
//        norm_flags: normConfig.flags,    // ← ADD THIS
//      }),
//    });
