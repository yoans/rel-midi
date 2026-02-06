import React, { useEffect, useRef } from 'react';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const getNoteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const isBlackKey = (note) => {
    const n = note % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
};

const KEY_INTERVALS = {
    'A': -4, 'S': -3, 'D': -2, 'F': -1,
    '⎵': 0,
    'J': 1, 'K': 2, 'L': 3, ';': 4,
};

const Keyboard = ({ activeNotes, onNoteOn, onNoteOff, currentNote }) => {
    const startNote = 36; // C2
    const endNote = 96;   // C7
    const containerRef = useRef(null);
    const currentKeyRef = useRef(null);

    // Auto-scroll to keep current note centered
    useEffect(() => {
        if (currentKeyRef.current && containerRef.current) {
            const container = containerRef.current;
            const key = currentKeyRef.current;
            const containerRect = container.getBoundingClientRect();
            const keyRect = key.getBoundingClientRect();

            const keyCenter = keyRect.left + keyRect.width / 2 - containerRect.left + container.scrollLeft;
            const scrollTarget = keyCenter - containerRect.width / 2;

            container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
        }
    }, [currentNote]);

    // Build overlay map: note → [{label, interval}]
    const overlayMap = {};
    if (currentNote !== undefined) {
        Object.entries(KEY_INTERVALS).forEach(([label, interval]) => {
            const target = currentNote + interval;
            if (target >= startNote && target <= endNote) {
                if (!overlayMap[target]) overlayMap[target] = [];
                overlayMap[target].push({ label, interval });
            }
        });
    }

    const keys = [];
    for (let i = startNote; i <= endNote; i++) {
        keys.push({
            note: i,
            isBlack: isBlackKey(i),
            noteName: getNoteName(i),
            isC: i % 12 === 0,
            overlays: overlayMap[i] || [],
            isCurrent: i === currentNote,
            isActive: activeNotes.includes(i),
        });
    }

    return (
        <div className="keyboard-wrapper">
            <div className="keyboard-container" ref={containerRef}>
                <div className="keyboard">
                    {keys.map((key) => (
                        <div
                            key={key.note}
                            ref={key.isCurrent ? currentKeyRef : null}
                            className={[
                                'key',
                                key.isBlack ? 'black-key' : 'white-key',
                                key.isActive ? 'active' : '',
                                key.isCurrent ? 'anchor' : '',
                                key.overlays.length > 0 ? 'has-overlay' : '',
                            ].filter(Boolean).join(' ')}
                            onMouseDown={() => onNoteOn(key.note)}
                            onMouseUp={() => onNoteOff(key.note)}
                            onMouseLeave={() => key.isActive && onNoteOff(key.note)}
                            onTouchStart={(e) => { e.preventDefault(); onNoteOn(key.note); }}
                            onTouchEnd={(e) => { e.preventDefault(); onNoteOff(key.note); }}
                        >
                            {key.overlays.length > 0 && (
                                <div className="key-overlays">
                                    {key.overlays.map(({ label, interval }) => (
                                        <span
                                            key={label}
                                            className={`overlay-badge ${interval < 0 ? 'neg' : interval > 0 ? 'pos' : 'zero'}`}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {key.isCurrent && <div className="anchor-marker" />}
                            {key.isC && <span className="note-label">{key.noteName}</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Keyboard;
