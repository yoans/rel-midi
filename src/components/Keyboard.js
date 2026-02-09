import React, { useEffect, useRef } from 'react';

const isBlackKey = (note) => {
    const n = note % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const getNoteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const OVERLAY_KEYS = [
    { label: 'A', interval: -4 },
    { label: 'S', interval: -3 },
    { label: 'D', interval: -2 },
    { label: 'F', interval: -1 },
    { label: '⎵', interval: 0 },
    { label: 'J', interval: 1 },
    { label: 'K', interval: 2 },
    { label: 'L', interval: 3 },
    { label: ';', interval: 4 },
];

const WHITE_WIDTH = 36;
const KEYBOARD_PADDING = 20;

const getKeyXCenter = (note, startNote) => {
    let whiteCount = 0;
    for (let i = startNote; i < note; i++) {
        if (!isBlackKey(i)) whiteCount++;
    }
    if (isBlackKey(note)) {
        return KEYBOARD_PADDING + whiteCount * WHITE_WIDTH;
    }
    return KEYBOARD_PADDING + whiteCount * WHITE_WIDTH + WHITE_WIDTH / 2;
};

const Keyboard = ({ activeNotes, onNoteOn, onNoteOff, currentNote }) => {
    const startNote = 36;
    const endNote = 96;
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

    const keys = [];
    for (let i = startNote; i <= endNote; i++) {
        keys.push({
            note: i,
            isBlack: isBlackKey(i),
            noteName: getNoteName(i),
            isC: i % 12 === 0,
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
                            ].filter(Boolean).join(' ')}
                            onMouseDown={() => onNoteOn(key.note)}
                            onMouseUp={() => onNoteOff(key.note)}
                            onMouseLeave={() => key.isActive && onNoteOff(key.note)}
                            onTouchStart={(e) => { e.preventDefault(); onNoteOn(key.note); }}
                            onTouchEnd={(e) => { e.preventDefault(); onNoteOff(key.note); }}
                        >
                            {key.isCurrent && <div className="anchor-marker" />}
                            {key.isC && <span className="note-label">{key.noteName}</span>}
                        </div>
                    ))}

                    {/* Floating overlay badges — slide smoothly via CSS transition */}
                    <div className="overlay-layer">
                        {OVERLAY_KEYS.map(({ label, interval }) => {
                            const targetNote = currentNote + interval;
                            const inRange = targetNote >= startNote && targetNote <= endNote;
                            const clampedNote = Math.max(startNote, Math.min(endNote, targetNote));
                            const x = getKeyXCenter(clampedNote, startNote);
                            const onBlack = isBlackKey(clampedNote);
                            return (
                                <div
                                    key={label}
                                    className={`floating-badge ${interval < 0 ? 'neg' : interval > 0 ? 'pos' : 'zero'} ${onBlack ? 'on-black' : ''}`}
                                    style={{
                                        left: `${x}px`,
                                        opacity: inRange ? 1 : 0,
                                    }}
                                >
                                    {label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Keyboard;
