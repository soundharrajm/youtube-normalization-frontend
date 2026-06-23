// CodecResToggle.jsx  — src/components/CodecResToggle.jsx
// Shows codec (H.264 / H.265) + resolution toggle in one row.
// Probes source values from job.detected_codec / job.detected_width / job.detected_height.

import { useState } from 'react';

const RESOLUTIONS = [
  { label: 'Source', value: 'source' },
  { label: '720p',   value: '1280x720' },
  { label: '1080p',  value: '1920x1080' },
  { label: '4K',     value: '3840x2160' },
];

// ── small helpers ─────────────────────────────────────────────────────────────

function srcCodecLabel(codec) {
  if (!codec) return null;
  const c = codec.toLowerCase();
  if (c === 'hevc' || c === 'h265') return 'H.265';
  if (c === 'h264' || c === 'avc')  return 'H.264';
  return codec.toUpperCase();
}

function codecMatches(detected, target) {
  if (!detected) return false;
  const d = detected.toLowerCase();
  if (target === 'h265') return d === 'hevc' || d === 'h265';
  return d === 'h264' || d === 'avc';
}

function resMatches(w, h, target) {
  if (!w || !h || target === 'source') return target === 'source'; // source = always match
  const [tw, th] = target.split('x').map(Number);
  return w === tw && h === th;
}

// ── Pill toggle (generic) ─────────────────────────────────────────────────────

function PillToggle({ options, value, onChange, color }) {
  const BG = { blue: '#1d4ed8', purple: '#7c3aed', teal: '#0d9488' };
  const bg = BG[color] || BG.blue;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        background: bg, borderRadius: 999, padding: 2, gap: 0,
        cursor: 'pointer', fontSize: 11, fontWeight: 600,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      {options.map(opt => (
        <span
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '2px 9px', borderRadius: 999,
            background: value === opt.value ? 'rgba(255,255,255,0.22)' : 'transparent',
            color: value === opt.value ? '#fff' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </span>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ ok, label, hint }) {
  return (
    <span
      title={hint}
      style={{
        fontSize: 10, fontWeight: 600,
        color: ok ? '#4ade80' : '#fbbf24',
        display: 'flex', alignItems: 'center', gap: 3,
      }}
    >
      {ok ? '✓' : '⚠'} {label}
      {ok && <span style={{ color: '#6b7280', fontWeight: 400 }}>(copy)</span>}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CodecResToggle({
  codec,       onCodecChange,   // 'h264' | 'h265'
  resolution,  onResChange,     // 'source' | '1280x720' | '1920x1080' | '3840x2160'
  detectedCodec,                // from job.detected_codec  e.g. 'h264'
  detectedWidth,                // from job.detected_width  e.g. 1920
  detectedHeight,               // from job.detected_height e.g. 1080
}) {
  const codecOk = codecMatches(detectedCodec, codec);
  const resOk   = resMatches(detectedWidth, detectedHeight, resolution);
  const allOk   = codecOk && resOk;

  const srcCodec = srcCodecLabel(detectedCodec);
  const srcRes   = (detectedWidth && detectedHeight)
    ? `${detectedWidth}×${detectedHeight}` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Row 1 — toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Codec toggle */}
        <PillToggle
          options={[{ label: 'H.264', value: 'h264' }, { label: 'H.265', value: 'h265' }]}
          value={codec}
          onChange={onCodecChange}
          color={codec === 'h265' ? 'purple' : 'blue'}
        />

        {/* Resolution toggle */}
        <PillToggle
          options={RESOLUTIONS}
          value={resolution}
          onChange={onResChange}
          color="teal"
        />
      </div>

      {/* Row 2 — source info + status */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {srcCodec && (
          <StatusBadge
            ok={codecOk}
            label={`src:${srcCodec}`}
            hint={codecOk ? 'Codec already matches — will stream copy' : `Will re-encode to ${codec.toUpperCase()}`}
          />
        )}
        {srcRes && (
          <StatusBadge
            ok={resOk}
            label={`src:${srcRes}`}
            hint={
              resOk
                ? 'Resolution already matches — no scale needed'
                : `Will scale from ${srcRes} → ${resolution}`
            }
          />
        )}
        {allOk && (
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>
            ⚡ stream copy — instant
          </span>
        )}
        {!allOk && (srcCodec || srcRes) && (
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
            🔄 re-encode needed
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE IN YOUR JOB CARD
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Add state (per-job, or lifted to parent):
//
//    const [codec, setCodec] = useState('h264');
//    const [resolution, setResolution] = useState('1920x1080');
//
// 2. Render above the Normalize button:
//
//    <CodecResToggle
//      codec={codec}           onCodecChange={setCodec}
//      resolution={resolution} onResChange={setResolution}
//      detectedCodec={job.detected_codec}
//      detectedWidth={job.detected_width}
//      detectedHeight={job.detected_height}
//    />
//
// 3. Pass both to normalize API call:
//
//    await apiFetch('/normalize', {
//      method: 'POST',
//      body: JSON.stringify({
//        job_id: job.id,
//        codec,          // 'h264' | 'h265'
//        resolution,     // 'source' | '1920x1080' | '1280x720' | '3840x2160'
//        flags: normFlags,
//        delogo: delogoConfig,
//      }),
//    });
//
// ─────────────────────────────────────────────────────────────────────────────
// BACKEND: NormalizeRequest update in routes/download.py
// ─────────────────────────────────────────────────────────────────────────────
//
// class NormalizeRequest(BaseModel):
//     job_id: str
//     flags: Optional[str] = None
//     codec: str = "h264"           # NEW
//     resolution: str = "source"    # NEW  e.g. 'source' | '1920x1080' | '1280x720'
//     delogo: Optional[dict] = None
//
// In the handler:
//     run_normalization(
//         job_id=req.job_id,
//         in_path=raw_path,
//         out_path=out_path,
//         user_flags=req.flags or DEFAULT_NORM_FLAGS,
//         target_codec=req.codec,
//         target_res=req.resolution,
//         ffmpeg_threads=FFMPEG_THREADS,
//         delogo=req.delogo,
//     )
//
// ─────────────────────────────────────────────────────────────────────────────
// STORE detected_codec/width/height in jobs after download completes:
// ─────────────────────────────────────────────────────────────────────────────
//
// from normalizer import probe_video
//
// info = probe_video(downloaded_file_path)
// set_job(job_id,
//     status='done',
//     detected_codec=info['codec'],
//     detected_width=info['width'],
//     detected_height=info['height'],
// )
// ─────────────────────────────────────────────────────────────────────────────
