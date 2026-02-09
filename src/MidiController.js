import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSynth } from './SynthEngine';
import Keyboard from './components/Keyboard';
import Controls from './components/Controls';
import Staff from './components/Staff';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const getNoteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const KEY_MAP = {
  'a': -4, 's': -3, 'd': -2, 'f': -1,
  ' ': 0,
  'j': 1, 'k': 2, 'l': 3, ';': 4,
};

const KEY_LABELS = [
  { key: 'A', interval: -4 },
  { key: 'S', interval: -3 },
  { key: 'D', interval: -2 },
  { key: 'F', interval: -1 },
  { key: 'SPACE', interval: 0, isSpace: true },
  { key: 'J', interval: +1 },
  { key: 'K', interval: +2 },
  { key: 'L', interval: +3 },
  { key: ';', interval: +4 },
];

function MidiController() {
  const { playNote, stopNote, settings, updateSetting } = useSynth();
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [currentNote, setCurrentNote] = useState(60);
  const [activeNotes, setActiveNotes] = useState([]);
  const [noteHistory, setNoteHistory] = useState([{ note: 60, time: Date.now() }]);
  const [pressedKey, setPressedKey] = useState(null);
  const [lastInterval, setLastInterval] = useState(null);
  const [showControls, setShowControls] = useState(false);

  const currentNoteRef = useRef(60);

  useEffect(() => {
    currentNoteRef.current = currentNote;
  }, [currentNote]);

  // MIDI Access
  useEffect(() => {
    const getMIDIAccess = async () => {
      try {
        const access = await navigator.requestMIDIAccess();
        const outputs = Array.from(access.outputs.values());
        setMidiOutputs(outputs);
        if (outputs.length > 0) setSelectedOutput(outputs[0].id);
      } catch (err) {
        console.warn('MIDI access not available:', err);
      }
    };
    getMIDIAccess();
  }, []);

  const triggerNote = useCallback((note, velocity = 100) => {
    setActiveNotes([note]);
    playNote(note);

    if (selectedOutput) {
      navigator.requestMIDIAccess().then(access => {
        const output = access.outputs.get(selectedOutput);
        if (output) {
          output.send([0x90, note, velocity]);
          setTimeout(() => {
            output.send([0x80, note, 0]);
            stopNote(note);
            setActiveNotes([]);
          }, 400);
        }
      });
    } else {
      setTimeout(() => {
        stopNote(note);
        setActiveNotes([]);
      }, 400);
    }
  }, [playNote, stopNote, selectedOutput]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const interval = KEY_MAP[e.key.toLowerCase()];
      if (interval !== undefined) {
        e.preventDefault();
        const label = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
        setPressedKey(label);
        setLastInterval(interval);

        const newNote = Math.max(0, Math.min(127, currentNoteRef.current + interval));
        setCurrentNote(newNote);
        setNoteHistory(prev => [...prev.slice(-15), { note: newNote, time: Date.now() }]);
        triggerNote(newNote);
      }
    };

    const handleKeyUp = (e) => {
      const interval = KEY_MAP[e.key.toLowerCase()];
      if (interval !== undefined) {
        setPressedKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerNote]);

  const handleVisualKeyClick = (note) => {
    const interval = note - currentNote;
    setLastInterval(interval);
    setCurrentNote(note);
    setNoteHistory(prev => [...prev.slice(-15), { note, time: Date.now() }]);
    triggerNote(note);
  };

  const jumpOctave = (direction) => {
    const newNote = Math.max(0, Math.min(127, currentNote + direction * 12));
    setCurrentNote(newNote);
    setLastInterval(direction * 12);
    setNoteHistory(prev => [...prev.slice(-15), { note: newNote, time: Date.now() }]);
    triggerNote(newNote);
  };

  return (
    <div className="synth-container">
      <header className="synth-header">
        <h1>REL-MIDI</h1>
        <p className="subtitle">Relative Interval Controller</p>
      </header>

      {/* Note Display */}
      <div className="note-display">
        <button className="octave-btn" onClick={() => jumpOctave(-1)} title="Octave Down">
          <span className="octave-arrow">◂</span>
          <span className="octave-label">OCT</span>
        </button>
        <div className="note-display-center">
          <div className="note-name">{getNoteName(currentNote)}</div>
          <div className="note-midi">MIDI {currentNote}</div>
          <div
            className={`interval-indicator ${lastInterval === null ? 'hidden' : lastInterval > 0 ? 'pos' : lastInterval < 0 ? 'neg' : 'zero'}`}
          >
            {lastInterval !== null
              ? (lastInterval > 0 ? `+${lastInterval}` : lastInterval === 0 ? '●' : lastInterval)
              : '\u00A0'}
          </div>
        </div>
        <button className="octave-btn" onClick={() => jumpOctave(1)} title="Octave Up">
          <span className="octave-label">OCT</span>
          <span className="octave-arrow">▸</span>
        </button>
      </div>

      {/* Note History */}
      <div className="note-history">
        {noteHistory.map((entry, i) => {
          const isCurrent = i === noteHistory.length - 1;
          return (
            <div
              key={`${entry.time}-${i}`}
              className={`history-note ${isCurrent ? 'current' : ''}`}
              style={{ opacity: 0.25 + (i / noteHistory.length) * 0.75 }}
            >
              {getNoteName(entry.note)}
            </div>
          );
        })}
      </div>

      {/* Key Hints */}
      <div className="key-hints-bar">
        {KEY_LABELS.map(({ key, interval, isSpace }) => {
          const targetNote = Math.max(0, Math.min(127, currentNote + interval));
          return (
            <div
              key={key}
              className={[
                'key-btn',
                isSpace ? 'space' : '',
                interval < 0 ? 'neg' : interval > 0 ? 'pos' : 'zero',
                pressedKey === key ? 'pressed' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="key-cap">{key}</span>
              <span className="key-interval">
                {interval > 0 ? `+${interval}` : interval === 0 ? 'RPT' : interval}
              </span>
              <span className="key-target">{getNoteName(targetNote)}</span>
            </div>
          );
        })}
      </div>

      {/* Staff Notation */}
      <Staff noteHistory={noteHistory} />

      {/* Piano */}
      <Keyboard
        activeNotes={activeNotes}
        onNoteOn={handleVisualKeyClick}
        onNoteOff={() => {}}
        currentNote={currentNote}
      />

      {/* Collapsible Controls */}
      <button
        className="controls-toggle"
        onClick={() => setShowControls(!showControls)}
      >
        {showControls ? '▾ Hide Synth Controls' : '▸ Synth Controls'}
      </button>
      <div className={`controls-wrapper ${showControls ? 'open' : ''}`}>
        <Controls
          settings={settings}
          updateSetting={updateSetting}
          midiOutputs={midiOutputs}
          selectedOutput={selectedOutput}
          setSelectedOutput={setSelectedOutput}
        />
      </div>
    </div>
  );
}

export default MidiController;