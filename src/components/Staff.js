import React, { useEffect, useRef, useState, useCallback } from 'react';

const MIDI_TO_DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const getNoteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const getStaffPosition = (midiNote) => {
  const octave = Math.floor(midiNote / 12) - 1;
  const pitchClass = midiNote % 12;
  const diatonic = MIDI_TO_DIATONIC[pitchClass];
  return (octave * 7 + diatonic) - 30;
};

/* ── Grand staff layout constants ── */
const HS = 5;                                        // half-space px
const TREBLE_TOP = 22;                               // y of top treble line (F5, pos 8)
const TREBLE_LINES = [0, 2, 4, 6, 8];                // E4 → F5
const BASS_LINES   = [-4, -6, -8, -10, -12];         // A3 → G2
const STAFF_GAP = 28;                                // px gap between staves
const BASS_TOP = TREBLE_TOP + 8 * HS + STAFF_GAP;    // y of top bass line (A3)
const NOTE_SP  = 38;                                 // horizontal spacing
const CLEF_W   = 44;                                 // left margin for clefs
const R_PAD    = 18;
const NRX = 5.5, NRY = 4;                            // notehead radii
const STEM_LEN = HS * 2 * 3;                         // stem = 3 spaces
const SYS_H    = BASS_TOP + 8 * HS + 22;             // one system height
const SYS_GAP  = 14;                                 // gap between systems

/* ── Y mapping ── */
const trebleY = (pos) => TREBLE_TOP + (8 - pos) * HS;
const bassY   = (pos) => BASS_TOP  + (-4 - pos) * HS;
const onTreble = (pos) => pos >= -2;
const getY = (pos) => onTreble(pos) ? trebleY(pos) : bassY(pos);

/* ── Ledger lines ── */
const getLedgerLines = (staffPos) => {
  const lines = [];
  if (onTreble(staffPos)) {
    for (let l = -2;  l >= staffPos; l -= 2) lines.push(trebleY(l));
    for (let l = 10;  l <= staffPos; l += 2) lines.push(trebleY(l));
  } else {
    for (let l = -2;  l <= staffPos && l > -4; l += 2) lines.push(bassY(l));
    for (let l = -14; l >= staffPos; l -= 2)  lines.push(bassY(l));
  }
  return lines;
};

/* ─────────── MIDI file generation ─────────── */
const varLen = (v) => {
  const b = [v & 0x7F]; v >>= 7;
  while (v) { b.unshift((v & 0x7F) | 0x80); v >>= 7; }
  return b;
};
const u32 = (v) => [(v>>24)&0xFF,(v>>16)&0xFF,(v>>8)&0xFF,v&0xFF];
const u16 = (v) => [(v>>8)&0xFF,v&0xFF];

const buildMidiFile = (history) => {
  const TPQ = 480, TEMPO = 500000; // 120 BPM
  const msToTicks = (ms) => Math.round(ms * TPQ / (TEMPO / 1000));
  const trk = [];
  trk.push(...varLen(0), 0xFF, 0x51, 0x03,
    (TEMPO>>16)&0xFF, (TEMPO>>8)&0xFF, TEMPO&0xFF);
  for (let i = 0; i < history.length; i++) {
    const n = Math.max(0, Math.min(127, history[i].note));
    const dur = i < history.length - 1
      ? Math.max(80, Math.min(4000, history[i+1].time - history[i].time))
      : 500;
    trk.push(...varLen(0), 0x90, n, 80);
    trk.push(...varLen(msToTicks(dur)), 0x80, n, 0);
  }
  trk.push(...varLen(0), 0xFF, 0x2F, 0x00);
  const f = [];
  f.push(0x4D,0x54,0x68,0x64,...u32(6),...u16(0),...u16(1),...u16(TPQ));
  f.push(0x4D,0x54,0x72,0x6B,...u32(trk.length),...trk);
  return new Uint8Array(f);
};

const download = (blob, name) => {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: name,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

/* ═══════════════ Component ═══════════════ */
const Staff = ({ noteHistory }) => {
  const outerRef = useRef(null);
  const svgRef   = useRef(null);
  const [w, setW]             = useState(600);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const measure = () => outerRef.current && setW(outerRef.current.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  const availW   = w - CLEF_W - R_PAD;
  const perLine  = Math.max(1, Math.floor(availW / NOTE_SP));
  const visible  = expanded ? noteHistory : noteHistory.slice(-perLine);

  const lines = [];
  if (expanded && visible.length > perLine) {
    for (let i = 0; i < visible.length; i += perLine)
      lines.push(visible.slice(i, i + perLine));
  } else {
    lines.push(visible);
  }

  const svgH = lines.length * SYS_H + Math.max(0, lines.length - 1) * SYS_GAP;

  /* ── render one grand-staff system ── */
  const renderSystem = (notes, li, yOff) => {
    const tYs  = TREBLE_LINES.map(p => yOff + trebleY(p));
    const bYs  = BASS_LINES.map(p  => yOff + bassY(p));
    const topY = yOff + TREBLE_TOP;
    const botY = yOff + BASS_TOP + 8 * HS;

    const noteX = (i, count) => {
      if (expanded) return CLEF_W + NOTE_SP * 0.5 + i * NOTE_SP;
      return w - R_PAD - NOTE_SP * 0.5 - (count - 1 - i) * NOTE_SP;
    };

    return (
      <g key={li}>
        {/* Left barline connecting both staves */}
        <line x1={CLEF_W - 10} y1={topY} x2={CLEF_W - 10} y2={botY}
          stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />

        {/* Treble staff lines */}
        {tYs.map((y, i) => (
          <line key={`t${i}`} x1={CLEF_W - 10} y1={y} x2={w} y2={y}
            stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        ))}

        {/* Bass staff lines */}
        {bYs.map((y, i) => (
          <line key={`b${i}`} x1={CLEF_W - 10} y1={y} x2={w} y2={y}
            stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        ))}

        {/* Treble clef glyph */}
        <text x={CLEF_W - 8} y={yOff + trebleY(2) + 10}
          fill="rgba(255,255,255,0.4)" fontSize="38"
          fontFamily="'Times New Roman', serif" style={{ userSelect: 'none' }}>
          𝄞
        </text>

        {/* Bass clef glyph */}
        <text x={CLEF_W - 6} y={yOff + bassY(-6) + 8}
          fill="rgba(255,255,255,0.4)" fontSize="28"
          fontFamily="'Times New Roman', serif" style={{ userSelect: 'none' }}>
          𝄢
        </text>

        {/* Notes */}
        {notes.map((entry, i) => {
          const x  = noteX(i, notes.length);
          const sp = getStaffPosition(entry.note);
          const y  = yOff + getY(sp);
          const sharp = IS_SHARP[entry.note % 12];
          const isCurrent = li === lines.length - 1 && i === notes.length - 1;
          const ledgers   = getLedgerLines(sp).map(ly => ly + yOff);
          const globalI   = expanded ? li * perLine + i : i;
          const total     = expanded ? noteHistory.length : visible.length;
          const opacity   = 0.2 + (globalI / Math.max(1, total)) * 0.8;
          const color     = isCurrent ? '#00e88f' : 'rgba(255,255,255,0.7)';
          const stemUp    = onTreble(sp) ? sp < 4 : sp < -8;
          const stemX     = stemUp ? x + NRX - 0.5 : x - NRX + 0.5;
          const stemY2    = stemUp ? y - STEM_LEN : y + STEM_LEN;

          return (
            <g key={`${entry.time}-${i}`} opacity={opacity}>
              {ledgers.map((ly, k) => (
                <line key={k} x1={x - 9} y1={ly} x2={x + 9} y2={ly}
                  stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
              ))}
              {sharp && (
                <text x={x - 13} y={y + 4} fill={color} fontSize="10" fontWeight="bold">♯</text>
              )}
              <ellipse cx={x} cy={y} rx={NRX} ry={NRY}
                fill={color} transform={`rotate(-12, ${x}, ${y})`} />
              <line x1={stemX} y1={y} x2={stemX} y2={stemY2}
                stroke={color} strokeWidth={1.2} />
              {isCurrent && (
                <text x={x} y={yOff + SYS_H - 4} textAnchor="middle"
                  fill="#00e88f" fontSize="8" fontWeight="700"
                  style={{ userSelect: 'none' }}>
                  {getNoteName(entry.note)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  /* ── export handlers ── */
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#1c1c2e');
    clone.insertBefore(rect, clone.firstChild);
    const svg = new XMLSerializer().serializeToString(clone);
    download(new Blob([svg], { type: 'image/svg+xml' }), `rel-midi-notation-${Date.now()}.svg`);
  }, []);

  const exportMIDI = useCallback(() => {
    if (!noteHistory.length) return;
    download(
      new Blob([buildMidiFile(noteHistory)], { type: 'audio/midi' }),
      `rel-midi-export-${Date.now()}.mid`
    );
  }, [noteHistory]);

  return (
    <div className="staff-outer" ref={outerRef}>
      <div className={`staff-container ${expanded ? 'staff-expanded' : ''}`}>
        <svg ref={svgRef} width={w} height={svgH} className="staff-svg"
          style={{ overflow: 'visible', display: 'block' }}>
          {lines.map((ln, li) =>
            renderSystem(ln, li, li * (SYS_H + SYS_GAP))
          )}
        </svg>
      </div>
      <div className="staff-toolbar">
        <button className="staff-btn" onClick={() => setExpanded(!expanded)}
          title={expanded
            ? 'Show only the most recent notes in a single line'
            : 'Expand to see the complete note history across multiple staff lines'}>
          {expanded ? '▾ Collapse' : `▸ Full History (${noteHistory.length} notes)`}
        </button>
        <button className="staff-btn" onClick={exportSVG}
          title="Download the staff notation as an SVG image file">
          📄 Export Notation
        </button>
        <button className="staff-btn" onClick={exportMIDI}
          title="Download all played notes as a standard MIDI file (.mid) for use in DAWs and music software">
          🎵 Export MIDI
        </button>
      </div>
    </div>
  );
};

export default Staff;
