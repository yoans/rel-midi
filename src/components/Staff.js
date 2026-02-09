import React, { useEffect, useRef, useState } from 'react';

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

const Staff = ({ noteHistory }) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);

  const LINE_SPACING = 10;
  const STAFF_TOP = 30;
  const NOTE_SPACING = 38;
  const CLEF_WIDTH = 36;
  const RIGHT_PAD = 16;
  const NOTE_RX = 5.5;
  const NOTE_RY = 4;
  const STEM_LENGTH = LINE_SPACING * 3;
  const svgHeight = 95;

  // Measure container width on mount and resize
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const getY = (staffPos) => STAFF_TOP + (8 - staffPos) * (LINE_SPACING / 2);

  // Calculate how many notes fit in the available width
  const availableWidth = containerWidth - CLEF_WIDTH - RIGHT_PAD;
  const maxNotes = Math.max(1, Math.floor(availableWidth / NOTE_SPACING));
  const notes = noteHistory.slice(-maxNotes);

  // Position notes: rightmost note near the right edge, earlier notes to the left
  const getNoteX = (index) => {
    const rightEdge = containerWidth - RIGHT_PAD - NOTE_SPACING / 2;
    return rightEdge - (notes.length - 1 - index) * NOTE_SPACING;
  };

  const staffLineYs = [0, 2, 4, 6, 8].map(p => getY(p));

  const getLedgerLines = (staffPos) => {
    const lines = [];
    if (staffPos <= -1) {
      for (let l = -2; l >= staffPos; l -= 2) lines.push(getY(l));
    }
    if (staffPos >= 9) {
      for (let l = 10; l <= staffPos; l += 2) lines.push(getY(l));
    }
    return lines;
  };

  return (
    <div className="staff-container" ref={containerRef}>
      <svg width={containerWidth} height={svgHeight} className="staff-svg">
        {/* Staff lines — full width */}
        {staffLineYs.map((y, i) => (
          <line key={i} x1={0} y1={y} x2={containerWidth} y2={y}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        ))}

        {/* Treble clef */}
        <text x={6} y={getY(2) + 10} fill="rgba(255,255,255,0.15)" fontSize="38"
          fontFamily="'Times New Roman', serif" style={{ userSelect: 'none' }}>
          𝄞
        </text>

        {/* Notes */}
        {notes.map((entry, i) => {
          const x = getNoteX(i);
          const staffPos = getStaffPosition(entry.note);
          const y = getY(staffPos);
          const sharp = IS_SHARP[entry.note % 12];
          const isCurrent = i === notes.length - 1;
          const ledgerLines = getLedgerLines(staffPos);
          const opacity = 0.2 + (i / notes.length) * 0.8;
          const color = isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.45)';

          const stemUp = staffPos < 4;
          const stemX = stemUp ? x + NOTE_RX - 0.5 : x - NOTE_RX + 0.5;
          const stemY2 = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;

          return (
            <g key={`${entry.time}-${i}`} opacity={opacity}>
              {/* Ledger lines */}
              {ledgerLines.map((ly, li) => (
                <line key={li} x1={x - 9} y1={ly} x2={x + 9} y2={ly}
                  stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
              ))}

              {/* Sharp accidental */}
              {sharp && (
                <text x={x - 13} y={y + 4} fill={color} fontSize="10" fontWeight="bold">♯</text>
              )}

              {/* Note head */}
              <ellipse cx={x} cy={y} rx={NOTE_RX} ry={NOTE_RY}
                fill={color}
                transform={`rotate(-12, ${x}, ${y})`}
              />

              {/* Stem */}
              <line x1={stemX} y1={y} x2={stemX} y2={stemY2}
                stroke={color} strokeWidth={1.2} />

              {/* Current note label */}
              {isCurrent && (
                <text x={x} y={svgHeight - 4} textAnchor="middle"
                  fill="var(--primary)" fontSize="8" fontWeight="700"
                  style={{ userSelect: 'none' }}>
                  {getNoteName(entry.note)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Staff;
