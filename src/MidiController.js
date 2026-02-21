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

const DEFAULT_KEY_LABELS = [
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

const DEFAULT_VELOCITIES = {};
DEFAULT_KEY_LABELS.forEach(k => { DEFAULT_VELOCITIES[k.key] = 100; });

const pickPreferredOutput = (outputs) => {
  if (!outputs.length) return null;
  const portOne = outputs.find((o) => /^1\s*[-:]/.test(o.name || ''));
  if (portOne) return portOne;
  const notPortTwo = outputs.find((o) => !/^2\s*[-:]/.test(o.name || ''));
  if (notPortTwo) return notPortTwo;
  return outputs[0];
};

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
  const [synthMuted, setSynthMuted] = useState(false);
  const [midiMuted, setMidiMuted] = useState(false);
  const [keyVelocities, setKeyVelocities] = useState(DEFAULT_VELOCITIES);
  const [velocityMultiplier, setVelocityMultiplier] = useState(100);
  const [midiChannel, setMidiChannel] = useState(1);
  const [diagNote, setDiagNote] = useState(60);
  const [diagVolume, setDiagVolume] = useState(100);
  const [diagProgram, setDiagProgram] = useState(0);

  const currentNoteRef = useRef(60);
  const synthMutedRef = useRef(false);
  const midiMutedRef = useRef(false);
  const midiAccessRef = useRef(null);
  const selectedOutputRef = useRef(null);
  const activeNoteRef = useRef(null);
  const keyVelocitiesRef = useRef(DEFAULT_VELOCITIES);
  const velocityMultiplierRef = useRef(100);
  const midiChannelRef = useRef(1);

  useEffect(() => { synthMutedRef.current = synthMuted; }, [synthMuted]);
  useEffect(() => { midiMutedRef.current = midiMuted; }, [midiMuted]);
  useEffect(() => { selectedOutputRef.current = selectedOutput; }, [selectedOutput]);
  useEffect(() => { keyVelocitiesRef.current = keyVelocities; }, [keyVelocities]);
  useEffect(() => { velocityMultiplierRef.current = velocityMultiplier; }, [velocityMultiplier]);
  useEffect(() => { midiChannelRef.current = midiChannel; }, [midiChannel]);

  useEffect(() => {
    currentNoteRef.current = currentNote;
  }, [currentNote]);

  // MIDI Access — cache the access object
  useEffect(() => {
    const getMIDIAccess = async () => {
      try {
        const access = await navigator.requestMIDIAccess();
        midiAccessRef.current = access;
        const outputs = Array.from(access.outputs.values());
        console.log('[MIDI] Access granted. Outputs:', outputs.map(o => ({ id: o.id, name: o.name, state: o.state })));
        setMidiOutputs(outputs);
        if (outputs.length > 0) {
          const preferred = pickPreferredOutput(outputs);
          console.log('[MIDI] Auto-selecting output:', preferred.name, preferred.id);
          setSelectedOutput(preferred.id);
        } else {
          console.warn('[MIDI] No outputs found');
        }

        // Listen for device changes
        access.onstatechange = (e) => {
          console.log('[MIDI] State change:', e.port.name, e.port.state);
          const updated = Array.from(access.outputs.values());
          setMidiOutputs(updated);
          const selectedStillExists = updated.some((o) => o.id === selectedOutputRef.current);
          if (!selectedStillExists) {
            const preferred = pickPreferredOutput(updated);
            if (preferred) {
              console.log('[MIDI] Re-selecting output after state change:', preferred.name, preferred.id);
              setSelectedOutput(preferred.id);
            }
          }
        };
      } catch (err) {
        console.warn('[MIDI] Access denied or not available:', err);
      }
    };
    getMIDIAccess();
  }, []);

  useEffect(() => {
    if (!selectedOutput) {
      console.log('[MIDI] Selected output: none');
      return;
    }
    const output = midiOutputs.find((o) => o.id === selectedOutput);
    console.log('[MIDI] Selected output changed:', output ? `${output.name} (${output.id})` : selectedOutput);
  }, [selectedOutput, midiOutputs]);

  // Helper to get the cached MIDI output
  const getMidiOutput = useCallback(() => {
    if (!midiAccessRef.current) {
      console.log('[MIDI] getMidiOutput: no access object');
      return null;
    }
    if (!selectedOutputRef.current) {
      console.log('[MIDI] getMidiOutput: no output selected');
      return null;
    }
    const output = midiAccessRef.current.outputs.get(selectedOutputRef.current);
    if (!output) {
      console.log('[MIDI] getMidiOutput: output not found for id:', selectedOutputRef.current);
    }
    return output || null;
  }, []);

  const sendMidiToSelectedChannels = useCallback((statusBase, data1, data2, label) => {
    const output = getMidiOutput();
    if (!output || midiMutedRef.current) {
      console.log(`[MIDI-DIAG] Skipped ${label}: output=${!!output} midiMuted=${midiMutedRef.current}`);
      return false;
    }

    if (midiChannelRef.current === 0) {
      for (let ch = 0; ch < 16; ch++) {
        output.send([statusBase + ch, data1, data2]);
      }
      console.log(`[MIDI-DIAG] ${label} sent on ALL channels -> ${output.name}`);
      return true;
    }

    const ch = midiChannelRef.current - 1;
    output.send([statusBase + ch, data1, data2]);
    console.log(`[MIDI-DIAG] ${label} sent on ch${ch + 1} -> ${output.name}`);
    return true;
  }, [getMidiOutput]);

  const handleDiagTestNote = useCallback(() => {
    const note = Math.max(0, Math.min(127, diagNote));
    const velocity = Math.max(1, Math.min(127, Math.round((diagVolume * velocityMultiplierRef.current) / 100)));
    const sent = sendMidiToSelectedChannels(0x90, note, velocity, `Test Note ON note=${note} vel=${velocity}`);
    if (!sent) return;
    setTimeout(() => {
      sendMidiToSelectedChannels(0x80, note, 0, `Test Note OFF note=${note}`);
    }, 400);
  }, [diagNote, diagVolume, sendMidiToSelectedChannels]);

  const handleDiagAllNotesOff = useCallback(() => {
    sendMidiToSelectedChannels(0xB0, 123, 0, 'All Notes Off (CC123)');
  }, [sendMidiToSelectedChannels]);

  const handleDiagPanic = useCallback(() => {
    const output = getMidiOutput();
    if (!output || midiMutedRef.current) {
      console.log(`[MIDI-DIAG] Skipped Panic: output=${!!output} midiMuted=${midiMutedRef.current}`);
      return;
    }

    const channels = midiChannelRef.current === 0
      ? Array.from({ length: 16 }, (_, i) => i)
      : [midiChannelRef.current - 1];

    channels.forEach((ch) => {
      for (let note = 0; note <= 127; note++) {
        output.send([0x80 + ch, note, 0]);
      }
      output.send([0xB0 + ch, 120, 0]);
      output.send([0xB0 + ch, 123, 0]);
    });

    console.log(`[MIDI-DIAG] Panic sent on ${midiChannelRef.current === 0 ? 'ALL channels' : `ch${midiChannelRef.current}`} -> ${output.name}`);
  }, [getMidiOutput]);

  const handleDiagSendVolume = useCallback(() => {
    const value = Math.max(0, Math.min(127, diagVolume));
    sendMidiToSelectedChannels(0xB0, 7, value, `CC7 Volume=${value}`);
  }, [diagVolume, sendMidiToSelectedChannels]);

  const handleDiagSendProgram = useCallback(() => {
    const program = Math.max(0, Math.min(127, diagProgram));
    const output = getMidiOutput();
    if (!output || midiMutedRef.current) {
      console.log(`[MIDI-DIAG] Skipped Program Change: output=${!!output} midiMuted=${midiMutedRef.current}`);
      return;
    }

    if (midiChannelRef.current === 0) {
      for (let ch = 0; ch < 16; ch++) {
        output.send([0xC0 + ch, program]);
      }
      console.log(`[MIDI-DIAG] Program Change ${program} sent on ALL channels -> ${output.name}`);
      return;
    }

    const ch = midiChannelRef.current - 1;
    output.send([0xC0 + ch, program]);
    console.log(`[MIDI-DIAG] Program Change ${program} sent on ch${ch + 1} -> ${output.name}`);
  }, [diagProgram, getMidiOutput]);

  const noteOn = useCallback((note, keyLabel) => {
    // Compute velocity: per-key velocity * global multiplier, clamped 1-127
    const perKey = keyLabel ? (keyVelocitiesRef.current[keyLabel] || 100) : 100;
    const velocity = Math.max(1, Math.min(127, Math.round(perKey * velocityMultiplierRef.current / 100)));
    console.log(`[NOTE-ON] note=${note} key=${keyLabel} perKey=${perKey} mult=${velocityMultiplierRef.current} vel=${velocity}`);

    // Stop any currently sounding note first
    if (activeNoteRef.current !== null) {
      console.log(`[NOTE-ON] Stopping previous note ${activeNoteRef.current}`);
      if (!synthMutedRef.current) stopNote(activeNoteRef.current);
      const output = getMidiOutput();
      if (output && !midiMutedRef.current) {
        if (midiChannelRef.current === 0) {
          console.log(`[MIDI-TX] Note-off (cleanup) ALL ch note=${activeNoteRef.current}`);
          for (let ch = 0; ch < 16; ch++) {
            output.send([0x80 + ch, activeNoteRef.current, 0]);
          }
        } else {
          const ch = midiChannelRef.current - 1;
          console.log(`[MIDI-TX] Note-off (cleanup) ch${ch + 1} note=${activeNoteRef.current}`);
          output.send([0x80 + ch, activeNoteRef.current, 0]);
        }
      }
    }

    activeNoteRef.current = note;
    setActiveNotes([note]);

    // Synth sound
    if (!synthMutedRef.current) {
      playNote(note, velocity);
    } else {
      console.log('[SYNTH] Muted, skipping playNote');
    }

    // MIDI output
    const output = getMidiOutput();
    if (output && !midiMutedRef.current) {
      if (midiChannelRef.current === 0) {
        console.log(`[MIDI-TX] Note-on ALL ch note=${note} vel=${velocity} -> ${output.name}`);
        for (let ch = 0; ch < 16; ch++) {
          output.send([0x90 + ch, note, velocity]);
        }
      } else {
        const ch = midiChannelRef.current - 1;
        console.log(`[MIDI-TX] Note-on ch${ch + 1} note=${note} vel=${velocity} -> ${output.name}`);
        output.send([0x90 + ch, note, velocity]);
      }
    } else {
      console.log(`[MIDI-TX] Skipped note-on: output=${!!output} midiMuted=${midiMutedRef.current}`);
    }
  }, [playNote, stopNote, getMidiOutput]);

  const noteOff = useCallback((note) => {
    if (activeNoteRef.current !== note) {
      console.log(`[NOTE-OFF] Ignored: active=${activeNoteRef.current} requested=${note}`);
      return;
    }
    console.log(`[NOTE-OFF] note=${note}`);
    activeNoteRef.current = null;
    setActiveNotes([]);

    // Stop synth sound
    if (!synthMutedRef.current) {
      stopNote(note);
    }

    // MIDI note-off
    const output = getMidiOutput();
    if (output && !midiMutedRef.current) {
      if (midiChannelRef.current === 0) {
        console.log(`[MIDI-TX] Note-off ALL ch note=${note} -> ${output.name}`);
        for (let ch = 0; ch < 16; ch++) {
          output.send([0x80 + ch, note, 0]);
        }
      } else {
        const ch = midiChannelRef.current - 1;
        console.log(`[MIDI-TX] Note-off ch${ch + 1} note=${note} -> ${output.name}`);
        output.send([0x80 + ch, note, 0]);
      }
    } else {
      console.log(`[MIDI-TX] Skipped note-off: output=${!!output} midiMuted=${midiMutedRef.current}`);
    }
  }, [stopNote, getMidiOutput]);

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
        noteOn(newNote, label);
      }
    };

    const handleKeyUp = (e) => {
      const interval = KEY_MAP[e.key.toLowerCase()];
      if (interval !== undefined) {
        setPressedKey(null);
        // Stop the note on key release
        if (activeNoteRef.current !== null) {
          noteOff(activeNoteRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [noteOn, noteOff]);

  const handleVisualKeyClick = (note) => {
    const interval = note - currentNote;
    setLastInterval(interval);
    setCurrentNote(note);
    setNoteHistory(prev => [...prev.slice(-15), { note, time: Date.now() }]);
    noteOn(note, null);
  };

  const handleVisualKeyRelease = (note) => {
    noteOff(note);
  };

  const jumpOctave = (direction) => {
    const newNote = Math.max(0, Math.min(127, currentNote + direction * 12));
    setCurrentNote(newNote);
    setLastInterval(direction * 12);
    setNoteHistory(prev => [...prev.slice(-15), { note: newNote, time: Date.now() }]);
    noteOn(newNote, null);
    // Auto-release octave jump after a short hold
    setTimeout(() => noteOff(newNote), 400);
  };

  return (
    <div className="synth-container">
      <header className="synth-header">
        <h1>REL-MIDI</h1>
        <p className="subtitle">Relative Interval Controller</p>
        <div className="mute-controls">
          <button
            className={`mute-btn ${synthMuted ? 'muted' : ''}`}
            onClick={() => setSynthMuted(m => !m)}
            title={synthMuted ? 'Unmute Synth' : 'Mute Synth'}
          >
            {synthMuted ? '🔇' : '🔊'} Synth
          </button>
          <button
            className={`mute-btn ${midiMuted ? 'muted' : ''}`}
            onClick={() => setMidiMuted(m => !m)}
            title={midiMuted ? 'Unmute MIDI' : 'Mute MIDI'}
          >
            {midiMuted ? '🚫' : '🎹'} MIDI
          </button>
        </div>
        <div className="midi-routing">
          <select
            className="midi-select"
            value={selectedOutput || ''}
            onChange={(e) => setSelectedOutput(e.target.value || null)}
          >
            <option value="">No MIDI Out</option>
            {midiOutputs.map(output => (
              <option key={output.id} value={output.id}>{output.name}</option>
            ))}
          </select>
          <select
            className="midi-select midi-ch-select"
            value={midiChannel}
            onChange={(e) => setMidiChannel(Number(e.target.value))}
          >
            <option value={0}>ALL</option>
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Ch {i + 1}</option>
            ))}
          </select>
        </div>
        <div className="midi-diagnostics">
          <div className="diag-row">
            <button className="diag-btn" onClick={handleDiagTestNote}>Test Note</button>
            <button className="diag-btn" onClick={handleDiagAllNotesOff}>All Notes Off</button>
            <button className="diag-btn panic" onClick={handleDiagPanic}>Panic</button>
          </div>
          <div className="diag-row diag-controls">
            <label className="diag-label">Note</label>
            <input
              className="diag-num"
              type="number"
              min="0"
              max="127"
              value={diagNote}
              onChange={(e) => setDiagNote(Number(e.target.value))}
            />
            <label className="diag-label">CC7</label>
            <input
              className="diag-num"
              type="number"
              min="0"
              max="127"
              value={diagVolume}
              onChange={(e) => setDiagVolume(Number(e.target.value))}
            />
            <button className="diag-btn" onClick={handleDiagSendVolume}>Send Vol</button>
            <label className="diag-label">Prog</label>
            <input
              className="diag-num"
              type="number"
              min="0"
              max="127"
              value={diagProgram}
              onChange={(e) => setDiagProgram(Number(e.target.value))}
            />
            <button className="diag-btn" onClick={handleDiagSendProgram}>Send Prog</button>
          </div>
        </div>
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
        {DEFAULT_KEY_LABELS.map(({ key, interval, isSpace }) => {
          const targetNote = Math.max(0, Math.min(127, currentNote + interval));
          const vel = keyVelocities[key] || 100;
          const opacity = 0.25 + (vel / 127) * 0.75;
          return (
            <div
              key={key}
              className={[
                'key-btn',
                isSpace ? 'space' : '',
                interval < 0 ? 'neg' : interval > 0 ? 'pos' : 'zero',
                pressedKey === key ? 'pressed' : '',
              ].filter(Boolean).join(' ')}
              style={{ opacity }}
            >
              <span className="key-cap">{key}</span>
              <span className="key-interval">
                {interval > 0 ? `+${interval}` : interval === 0 ? 'RPT' : interval}
              </span>
              <span className="key-target">{getNoteName(targetNote)}</span>
              <input
                type="range"
                className="key-velocity-slider"
                min="1" max="127" step="1"
                value={vel}
                onChange={(e) => {
                  e.stopPropagation();
                  setKeyVelocities(prev => ({ ...prev, [key]: Number(e.target.value) }));
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                title={`Velocity: ${vel}`}
              />
            </div>
          );
        })}
      </div>

      {/* Velocity Multiplier */}
      <div className="velocity-strip">
        <label className="velocity-label">Velocity</label>
        <input
          type="range"
          className="velocity-master-slider"
          min="1" max="200" step="1"
          value={velocityMultiplier}
          onChange={(e) => setVelocityMultiplier(Number(e.target.value))}
        />
        <span className="velocity-value">{velocityMultiplier}%</span>
      </div>

      {/* Staff Notation */}
      <Staff noteHistory={noteHistory} />

      {/* Piano */}
      <Keyboard
        activeNotes={activeNotes}
        onNoteOn={handleVisualKeyClick}
        onNoteOff={handleVisualKeyRelease}
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
        />
      </div>
    </div>
  );
}

export default MidiController;