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

// Default pad mapping — MPD218 Bank A pads (notes 36-51, 16 pads) → common intervals
const DEFAULT_PAD_MAP = {
  36: { interval: -12, label: 'Pad 1 (Oct−)' },
  37: { interval: -7,  label: 'Pad 2' },
  38: { interval: -5,  label: 'Pad 3' },
  39: { interval: -4,  label: 'Pad 4' },
  40: { interval: -3,  label: 'Pad 5' },
  41: { interval: -2,  label: 'Pad 6' },
  42: { interval: -1,  label: 'Pad 7' },
  43: { interval: 0,   label: 'Pad 8 (RPT)' },
  44: { interval: +1,  label: 'Pad 9' },
  45: { interval: +2,  label: 'Pad 10' },
  46: { interval: +3,  label: 'Pad 11' },
  47: { interval: +4,  label: 'Pad 12' },
  48: { interval: +5,  label: 'Pad 13' },
  49: { interval: +7,  label: 'Pad 14' },
  50: { interval: +12, label: 'Pad 15 (Oct+)' },
};

const ASSIGNABLE_ACTIONS = [
  { value: -12, label: 'Oct −' },
  { value: -11, label: '−11' },
  { value: -10, label: '−10' },
  { value: -9, label: '−9' },
  { value: -8, label: '−8' },
  { value: -7, label: '−7' },
  { value: -6, label: '−6' },
  { value: -5, label: '−5' },
  { value: -4, label: '−4' },
  { value: -3, label: '−3' },
  { value: -2, label: '−2' },
  { value: -1, label: '−1' },
  { value: 0,  label: 'RPT' },
  { value: +1, label: '+1' },
  { value: +2, label: '+2' },
  { value: +3, label: '+3' },
  { value: +4, label: '+4' },
  { value: +5, label: '+5' },
  { value: +6, label: '+6' },
  { value: +7, label: '+7' },
  { value: +8, label: '+8' },
  { value: +9, label: '+9' },
  { value: +10, label: '+10' },
  { value: +11, label: '+11' },
  { value: +12, label: 'Oct +' },
];

// Synth controls that can be mapped to MIDI CC knobs/faders
const SYNTH_CONTROLS = [
  { id: 'cutoff',       label: 'Filter Cutoff',  min: 20,  max: 20000, step: 10 },
  { id: 'resonance',    label: 'Resonance',       min: 0,   max: 20,    step: 0.1 },
  { id: 'attack',       label: 'Attack',          min: 0,   max: 2,     step: 0.01 },
  { id: 'decay',        label: 'Decay',            min: 0,   max: 2,     step: 0.01 },
  { id: 'sustain',      label: 'Sustain',          min: 0,   max: 1,     step: 0.01 },
  { id: 'release',      label: 'Release',          min: 0,   max: 5,     step: 0.01 },
  { id: 'masterVolume', label: 'Master Volume',    min: 0,   max: 1,     step: 0.01 },
];

const DEFAULT_CC_MAP = {}; // No default CC mappings

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
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [lastInterval, setLastInterval] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [synthMuted, setSynthMuted] = useState(false);
  const [midiMuted, setMidiMuted] = useState(false);
  const [keyVelocities, setKeyVelocities] = useState(DEFAULT_VELOCITIES);
  const [velocityMultiplier, setVelocityMultiplier] = useState(100);
  const [midiChannel, setMidiChannel] = useState(1);
  const [velocityPopup, setVelocityPopup] = useState(null); // key label or null
  const [midiInputs, setMidiInputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(null);
  const [padMap, setPadMap] = useState(DEFAULT_PAD_MAP);
  const [midiLearnTarget, setMidiLearnTarget] = useState(null); // interval value being learned
  const [lastMidiIn, setLastMidiIn] = useState(null); // { note, vel, name }
  const [showMidiConfig, setShowMidiConfig] = useState(false);
  const [usePadVelocity, setUsePadVelocity] = useState(true);
  const [rapidLearnActive, setRapidLearnActive] = useState(false);
  const rapidLearnActiveRef = useRef(false);
  const [ccMap, setCcMap] = useState(DEFAULT_CC_MAP);
  const [ccLearnTarget, setCcLearnTarget] = useState(null);
  const ccMapRef = useRef(DEFAULT_CC_MAP);
  const ccLearnTargetRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);

  const currentNoteRef = useRef(60);
  const synthMutedRef = useRef(false);
  const midiMutedRef = useRef(false);
  const midiAccessRef = useRef(null);
  const selectedOutputRef = useRef(null);
  const heldNotesRef = useRef(new Map());   // keyLabel → midiNote
  const keyVelocitiesRef = useRef(DEFAULT_VELOCITIES);
  const velocityMultiplierRef = useRef(100);
  const midiChannelRef = useRef(1);
  const selectedInputRef = useRef(null);
  const padMapRef = useRef(DEFAULT_PAD_MAP);
  const midiLearnTargetRef = useRef(null);
  const usePadVelocityRef = useRef(true);

  useEffect(() => { synthMutedRef.current = synthMuted; }, [synthMuted]);
  useEffect(() => { midiMutedRef.current = midiMuted; }, [midiMuted]);
  useEffect(() => { selectedOutputRef.current = selectedOutput; }, [selectedOutput]);
  useEffect(() => { keyVelocitiesRef.current = keyVelocities; }, [keyVelocities]);
  useEffect(() => { velocityMultiplierRef.current = velocityMultiplier; }, [velocityMultiplier]);
  useEffect(() => { midiChannelRef.current = midiChannel; }, [midiChannel]);
  useEffect(() => { selectedInputRef.current = selectedInput; }, [selectedInput]);
  useEffect(() => { padMapRef.current = padMap; }, [padMap]);
  useEffect(() => { midiLearnTargetRef.current = midiLearnTarget; }, [midiLearnTarget]);
  useEffect(() => { usePadVelocityRef.current = usePadVelocity; }, [usePadVelocity]);
  useEffect(() => { rapidLearnActiveRef.current = rapidLearnActive; }, [rapidLearnActive]);
  useEffect(() => { ccMapRef.current = ccMap; }, [ccMap]);
  useEffect(() => { ccLearnTargetRef.current = ccLearnTarget; }, [ccLearnTarget]);

  useEffect(() => {
    currentNoteRef.current = currentNote;
  }, [currentNote]);

  // Close velocity popup on outside click
  useEffect(() => {
    if (!velocityPopup) return;
    const handleClickOutside = () => setVelocityPopup(null);
    // Delay to avoid immediately closing from the same click
    const id = setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [velocityPopup]);

  // MIDI Access — cache the access object, enumerate inputs + outputs
  useEffect(() => {
    const getMIDIAccess = async () => {
      try {
        const access = await navigator.requestMIDIAccess();
        midiAccessRef.current = access;
        const outputs = Array.from(access.outputs.values());
        const inputs = Array.from(access.inputs.values());
        console.log('[MIDI] Access granted. Outputs:', outputs.map(o => ({ id: o.id, name: o.name })));
        console.log('[MIDI] Inputs:', inputs.map(i => ({ id: i.id, name: i.name })));
        setMidiOutputs(outputs);
        setMidiInputs(inputs);
        if (outputs.length > 0) {
          const preferred = pickPreferredOutput(outputs);
          console.log('[MIDI] Auto-selecting output:', preferred.name, preferred.id);
          setSelectedOutput(preferred.id);
        } else {
          console.warn('[MIDI] No outputs found');
        }

        // Auto-select first input
        if (inputs.length > 0) {
          console.log('[MIDI] Auto-selecting input:', inputs[0].name, inputs[0].id);
          setSelectedInput(inputs[0].id);
        }

        // Listen for device changes
        access.onstatechange = (e) => {
          console.log('[MIDI] State change:', e.port.name, e.port.state);
          const updatedOutputs = Array.from(access.outputs.values());
          const updatedInputs = Array.from(access.inputs.values());
          setMidiOutputs(updatedOutputs);
          setMidiInputs(updatedInputs);
          const selectedStillExists = updatedOutputs.some((o) => o.id === selectedOutputRef.current);
          if (!selectedStillExists) {
            const preferred = pickPreferredOutput(updatedOutputs);
            if (preferred) {
              console.log('[MIDI] Re-selecting output after state change:', preferred.name, preferred.id);
              setSelectedOutput(preferred.id);
            }
          }
          const inputStillExists = updatedInputs.some((i) => i.id === selectedInputRef.current);
          if (!inputStillExists && updatedInputs.length > 0) {
            setSelectedInput(updatedInputs[0].id);
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

  const noteOn = useCallback((note, keyLabel) => {
    const perKey = keyLabel ? (keyVelocitiesRef.current[keyLabel] || 100) : 100;
    const velocity = Math.max(1, Math.min(127, Math.round(perKey * velocityMultiplierRef.current / 100)));
    console.log(`[NOTE-ON] note=${note} key=${keyLabel} vel=${velocity}`);

    // Synth sound (polyphonic – no cleanup of previous notes)
    if (!synthMutedRef.current) {
      playNote(note, velocity);
    }

    // MIDI output
    const output = getMidiOutput();
    if (output && !midiMutedRef.current) {
      if (midiChannelRef.current === 0) {
        for (let ch = 0; ch < 16; ch++) {
          output.send([0x90 + ch, note, velocity]);
        }
      } else {
        const ch = midiChannelRef.current - 1;
        output.send([0x90 + ch, note, velocity]);
      }
    }
  }, [playNote, getMidiOutput]);

  const noteOff = useCallback((note) => {
    console.log(`[NOTE-OFF] note=${note}`);

    if (!synthMutedRef.current) {
      stopNote(note);
    }

    const output = getMidiOutput();
    if (output && !midiMutedRef.current) {
      if (midiChannelRef.current === 0) {
        for (let ch = 0; ch < 16; ch++) {
          output.send([0x80 + ch, note, 0]);
        }
      } else {
        const ch = midiChannelRef.current - 1;
        output.send([0x80 + ch, note, 0]);
      }
    }
  }, [stopNote, getMidiOutput]);

  // MIDI Input listener — handles pad presses through the mapping system
  const handleMidiInput = useCallback((note, velocity, isNoteOn) => {
    const mapping = padMapRef.current[note];

    // Show activity regardless of mapping
    if (isNoteOn) {
      setLastMidiIn({ note, vel: velocity, name: getNoteName(note) });
    }

    // MIDI Learn mode — assign this note to the target interval
    if (isNoteOn && midiLearnTargetRef.current !== null) {
      const targetInterval = midiLearnTargetRef.current;
      setPadMap(prev => {
        // Remove any existing mapping for this note
        const next = { ...prev };
        // Also remove any other pad mapped to this same interval (one-to-one)
        Object.keys(next).forEach(k => {
          if (next[k].interval === targetInterval) delete next[k];
        });
        next[note] = { interval: targetInterval, label: `Note ${note} (${getNoteName(note)})` };
        return next;
      });

      // Rapid learn: auto-advance to next action
      if (rapidLearnActiveRef.current) {
        const idx = ASSIGNABLE_ACTIONS.findIndex(a => a.value === targetInterval);
        if (idx >= 0 && idx < ASSIGNABLE_ACTIONS.length - 1) {
          setMidiLearnTarget(ASSIGNABLE_ACTIONS[idx + 1].value);
        } else {
          // Done — reached the end
          setMidiLearnTarget(null);
          setRapidLearnActive(false);
        }
      } else {
        setMidiLearnTarget(null);
      }
      return;
    }

    if (!mapping) return;

    const padLabel = `__pad_${note}__`;

    if (isNoteOn) {
      // Release any previous note this pad is holding
      const prevNote = heldNotesRef.current.get(padLabel);
      if (prevNote !== undefined) {
        noteOff(prevNote);
        heldNotesRef.current.delete(padLabel);
      }

      const interval = mapping.interval;
      setLastInterval(interval);

      const newNote = Math.max(0, Math.min(127, currentNoteRef.current + interval));
      heldNotesRef.current.set(padLabel, newNote);
      setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
      setCurrentNote(newNote);
      setNoteHistory(prev => [...prev.slice(-999), { note: newNote, time: Date.now() }]);

      // Use pad velocity if enabled, otherwise use multiplier
      if (usePadVelocityRef.current) {
        const vel = Math.max(1, Math.min(127, Math.round(velocity * velocityMultiplierRef.current / 100)));
        if (!synthMutedRef.current) playNote(newNote, vel);
        const output = getMidiOutput();
        if (output && !midiMutedRef.current) {
          if (midiChannelRef.current === 0) {
            for (let ch = 0; ch < 16; ch++) output.send([0x90 + ch, newNote, vel]);
          } else {
            output.send([0x90 + (midiChannelRef.current - 1), newNote, vel]);
          }
        }
      } else {
        noteOn(newNote, null);
      }
    } else {
      // Note off
      const heldNote = heldNotesRef.current.get(padLabel);
      if (heldNote !== undefined) {
        noteOff(heldNote);
        heldNotesRef.current.delete(padLabel);
      }
      setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
    }
  }, [noteOn, noteOff, playNote, getMidiOutput]);

  // MIDI CC handler — maps CC knobs/faders to synth controls
  const handleCcInput = useCallback((cc, value) => {
    // CC Learn mode
    if (ccLearnTargetRef.current !== null) {
      const targetControl = ccLearnTargetRef.current;
      setCcMap(prev => {
        const next = { ...prev };
        // Remove any existing mapping for this CC or this control
        Object.keys(next).forEach(k => {
          if (next[k] === targetControl) delete next[k];
        });
        next[cc] = targetControl;
        return next;
      });
      setCcLearnTarget(null);
      return;
    }

    // Apply CC value to mapped synth control
    const controlId = ccMapRef.current[cc];
    if (!controlId) return;
    const ctrl = SYNTH_CONTROLS.find(c => c.id === controlId);
    if (!ctrl) return;
    // Map 0-127 → control's min-max range
    const scaled = ctrl.min + (value / 127) * (ctrl.max - ctrl.min);
    // Round to step precision
    const rounded = Math.round(scaled / ctrl.step) * ctrl.step;
    updateSetting(controlId, Math.max(ctrl.min, Math.min(ctrl.max, rounded)));
  }, [updateSetting]);

  // Attach/detach MIDI input listener when input selection changes
  useEffect(() => {
    if (!midiAccessRef.current || !selectedInput) return;

    const input = midiAccessRef.current.inputs.get(selectedInput);
    if (!input) return;

    console.log('[MIDI-IN] Listening on:', input.name);

    const onMessage = (e) => {
      const [status, note, velocity] = e.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && velocity > 0) {
        handleMidiInput(note, velocity, true);
      } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
        handleMidiInput(note, velocity, false);
      } else if (cmd === 0xB0) {
        // Control Change: note = CC number, velocity = value
        handleCcInput(note, velocity);
      }
    };

    input.onmidimessage = onMessage;
    return () => {
      input.onmidimessage = null;
    };
  }, [selectedInput, handleMidiInput, handleCcInput]);

  // Keyboard handler — polyphonic, all 9 keys can sound simultaneously
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const interval = KEY_MAP[e.key.toLowerCase()];
      if (interval !== undefined) {
        e.preventDefault();
        const label = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();

        // If this key already holds a note, release it first
        const prevNote = heldNotesRef.current.get(label);
        if (prevNote !== undefined) {
          noteOff(prevNote);
          heldNotesRef.current.delete(label);
        }

        setPressedKeys(prev => new Set([...prev, label]));
        setLastInterval(interval);

        const newNote = Math.max(0, Math.min(127, currentNoteRef.current + interval));
        heldNotesRef.current.set(label, newNote);
        setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
        setCurrentNote(newNote);
        setNoteHistory(prev => [...prev.slice(-999), { note: newNote, time: Date.now() }]);
        noteOn(newNote, label);
      }
    };

    const handleKeyUp = (e) => {
      const interval = KEY_MAP[e.key.toLowerCase()];
      if (interval !== undefined) {
        const label = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();

        const heldNote = heldNotesRef.current.get(label);
        if (heldNote !== undefined) {
          noteOff(heldNote);
          heldNotesRef.current.delete(label);
        }

        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(label);
          return next;
        });

        setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
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
    // Release any previous mouse-held note
    const prevMouse = heldNotesRef.current.get('__mouse__');
    if (prevMouse !== undefined) {
      noteOff(prevMouse);
      heldNotesRef.current.delete('__mouse__');
    }
    const interval = note - currentNote;
    setLastInterval(interval);
    setCurrentNote(note);
    heldNotesRef.current.set('__mouse__', note);
    setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
    setNoteHistory(prev => [...prev.slice(-999), { note, time: Date.now() }]);
    noteOn(note, null);
  };

  const handleVisualKeyRelease = (note) => {
    const mouseNote = heldNotesRef.current.get('__mouse__');
    if (mouseNote === note) {
      heldNotesRef.current.delete('__mouse__');
    }
    noteOff(note);
    setActiveNotes(Array.from(new Set(heldNotesRef.current.values())));
  };

  const jumpOctave = (direction) => {
    const newNote = Math.max(0, Math.min(127, currentNote + direction * 12));
    setCurrentNote(newNote);
    setLastInterval(direction * 12);
    setNoteHistory(prev => [...prev.slice(-999), { note: newNote, time: Date.now() }]);
    noteOn(newNote, null);
    // Auto-release octave jump after a short hold
    setTimeout(() => noteOff(newNote), 400);
  };

  return (
    <div className="synth-container">
      <header className="synth-header">
        <h1>REL-MIDI</h1>
        <p className="subtitle">Relative Interval Controller</p>
        <button
          className="info-btn"
          onClick={() => setShowInfo(true)}
          title="About REL-MIDI"
        >ℹ</button>
        <div className="mute-controls">
          <button
            className={`mute-btn ${synthMuted ? 'muted' : ''}`}
            onClick={() => setSynthMuted(m => !m)}
            title={synthMuted ? 'Enable browser sound' : 'Disable browser sound'}
          >
            {synthMuted ? '🔇' : '🔊'} {synthMuted ? 'Enable' : 'Disable'} Browser Sound
          </button>
          <button
            className={`mute-btn ${midiMuted ? 'muted' : ''}`}
            onClick={() => setMidiMuted(m => !m)}
            title={midiMuted ? 'Enable external MIDI' : 'Disable external MIDI'}
          >
            {midiMuted ? '🚫' : '🎹'} {midiMuted ? 'Enable' : 'Disable'} External MIDI
          </button>
        </div>
      </header>

      {/* MIDI Config Panel */}
      <div className="collapsible-section">
        <button
          className="collapsible-header midi-config-toggle"
          onClick={() => setShowMidiConfig(!showMidiConfig)}
        >
          {showMidiConfig ? '▾' : '▸'} MIDI Setup
        </button>
        <div className={`collapsible-body ${showMidiConfig ? 'open' : ''}`}>
        <div className="collapsible-inner">
        <div className="midi-config-panel">
          {/* I/O Selection */}
          <div className="midi-io-section">
            <div className="midi-io-col">
              <h4 className="midi-io-heading">MIDI Input</h4>
              <select
                className="midi-select midi-io-select"
                value={selectedInput || ''}
                onChange={(e) => setSelectedInput(e.target.value || null)}
              >
                <option value="">No MIDI In</option>
                {midiInputs.map(input => (
                  <option key={input.id} value={input.id}>{input.name}</option>
                ))}
              </select>
              {lastMidiIn && (
                <div className="midi-activity">
                  Last: Note {lastMidiIn.note} ({lastMidiIn.name}) vel {lastMidiIn.vel}
                </div>
              )}
            </div>
            <div className="midi-io-col">
              <h4 className="midi-io-heading">MIDI Output</h4>
              <select
                className="midi-select midi-io-select"
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
                <option value={0}>ALL Ch</option>
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Ch {i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pad Velocity Toggle */}
          <div className="midi-option-row">
            <label className="midi-option-label">
              <input
                type="checkbox"
                checked={usePadVelocity}
                onChange={(e) => setUsePadVelocity(e.target.checked)}
              />
              Use pad velocity (pass through how hard you hit)
            </label>
          </div>

          {/* Pad Mapping */}
          <div className="pad-map-section">
            <h4 className="midi-io-heading">Pad Mapping</h4>
            <p className="pad-map-hint">
              Map your controller pads to intervals. Click <strong>Learn</strong> then hit a pad to assign it.
            </p>
            <div className="pad-map-grid">
              {ASSIGNABLE_ACTIONS.map(action => {
                // Find which MIDI note is mapped to this interval
                const mappedEntry = Object.entries(padMap).find(([, v]) => v.interval === action.value);
                const mappedNote = mappedEntry ? Number(mappedEntry[0]) : null;
                const isLearning = midiLearnTarget === action.value;
                return (
                  <div key={action.value} className={`pad-map-row ${isLearning ? 'learning' : ''}`}>
                    <span className={`pad-map-interval ${
                      action.value < 0 ? 'neg' : action.value > 0 ? 'pos' : 'zero'
                    }`}>{action.label}</span>
                    <span className="pad-map-assignment">
                      {mappedNote !== null
                        ? `Note ${mappedNote} (${getNoteName(mappedNote)})`
                        : '—'}
                    </span>
                    <button
                      className={`pad-map-learn-btn ${isLearning ? 'active' : ''}`}
                      onClick={() => setMidiLearnTarget(isLearning ? null : action.value)}
                    >
                      {isLearning ? '⏳ Hit pad…' : 'Learn'}
                    </button>
                    {mappedNote !== null && (
                      <button
                        className="pad-map-clear-btn"
                        onClick={() => setPadMap(prev => {
                          const next = { ...prev };
                          delete next[mappedNote];
                          return next;
                        })}
                        title="Remove this mapping"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pad-map-actions">
              <button
                className={`pad-map-action-btn rapid-learn-btn ${rapidLearnActive ? 'active' : ''}`}
                onClick={() => {
                  if (rapidLearnActive) {
                    setRapidLearnActive(false);
                    setMidiLearnTarget(null);
                  } else {
                    setPadMap({});
                    setRapidLearnActive(true);
                    setMidiLearnTarget(ASSIGNABLE_ACTIONS[0].value);
                  }
                }}
                title="Clear all mappings and learn each interval in sequence — just hit pads left to right"
              >{rapidLearnActive ? '⏹ Stop Rapid Learn' : '⚡ Rapid Learn'}</button>
              <button
                className="pad-map-action-btn"
                onClick={() => setPadMap(DEFAULT_PAD_MAP)}
                title="Reset all pad mappings to MPD218 defaults (Bank A)"
              >Reset to defaults</button>
              <button
                className="pad-map-action-btn"
                onClick={() => setPadMap({})}
                title="Clear all pad mappings"
              >Clear all</button>
              <button
                className="pad-map-action-btn"
                onClick={() => { setMidiLearnTarget(null); setRapidLearnActive(false); }}
                disabled={midiLearnTarget === null}
              >Cancel Learn</button>
            </div>
          </div>

          {/* CC Mapping — Synth Controls */}
          <div className="pad-map-section">
            <h4 className="midi-io-heading">Knob / Fader Mapping</h4>
            <p className="pad-map-hint">
              Map MIDI CC knobs or faders to synth controls. Click <strong>Learn</strong> then turn a knob.
            </p>
            <div className="pad-map-grid">
              {SYNTH_CONTROLS.map(ctrl => {
                const mappedEntry = Object.entries(ccMap).find(([, v]) => v === ctrl.id);
                const mappedCc = mappedEntry ? Number(mappedEntry[0]) : null;
                const isLearning = ccLearnTarget === ctrl.id;
                return (
                  <div key={ctrl.id} className={`pad-map-row ${isLearning ? 'learning' : ''}`}>
                    <span className="pad-map-interval zero">{ctrl.label}</span>
                    <span className="pad-map-assignment">
                      {mappedCc !== null ? `CC ${mappedCc}` : '—'}
                    </span>
                    <button
                      className={`pad-map-learn-btn ${isLearning ? 'active' : ''}`}
                      onClick={() => setCcLearnTarget(isLearning ? null : ctrl.id)}
                    >
                      {isLearning ? '⏳ Turn knob…' : 'Learn'}
                    </button>
                    {mappedCc !== null && (
                      <button
                        className="pad-map-clear-btn"
                        onClick={() => setCcMap(prev => {
                          const next = { ...prev };
                          delete next[mappedCc];
                          return next;
                        })}
                        title="Remove this mapping"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pad-map-actions">
              <button
                className="pad-map-action-btn"
                onClick={() => setCcMap({})}
                title="Clear all CC mappings"
              >Clear all</button>
              <button
                className="pad-map-action-btn"
                onClick={() => setCcLearnTarget(null)}
                disabled={ccLearnTarget === null}
              >Cancel Learn</button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>  {/* end MIDI Config collapsible */}

      {/* Note Display */}
      <div className="note-display">
        <button className="octave-btn" onClick={() => jumpOctave(-1)} title="Jump down one octave (12 semitones) and play the note">
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
        <button className="octave-btn" onClick={() => jumpOctave(1)} title="Jump up one octave (12 semitones) and play the note">
          <span className="octave-label">OCT</span>
          <span className="octave-arrow">▸</span>
        </button>
      </div>

      {/* Notes Played */}
      <div className="note-history-section">
        <label className="section-label">Notes Played</label>
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
                pressedKeys.has(key) ? 'pressed' : '',
                velocityPopup === key ? 'editing' : '',
              ].filter(Boolean).join(' ')}
              style={{ opacity }}
              onClick={(e) => {
                e.stopPropagation();
                setVelocityPopup(prev => prev === key ? null : key);
              }}
            >
              <span className="key-cap">{key}</span>
              <span className="key-interval">
                {interval > 0 ? `+${interval}` : interval === 0 ? 'RPT' : interval}
              </span>
              <span className="key-target">{getNoteName(targetNote)}</span>
              <span className="key-vel-badge">{vel}</span>

              {velocityPopup === key && (
                <div
                  className={`vel-popup ${interval < 0 ? 'neg' : interval > 0 ? 'pos' : 'zero'}`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="vel-popup-header">
                    <span className="vel-popup-title">Key {key} Velocity</span>
                    <button className="vel-popup-close" onClick={() => setVelocityPopup(null)}>✕</button>
                  </div>
                  <p className="vel-popup-desc">
                    Controls how hard the <strong>{key}</strong> key strikes.
                    Only affects this key — other keys keep their own velocity.
                  </p>
                  <div className="vel-popup-slider-row">
                    <span className="vel-popup-min">1</span>
                    <input
                      type="range"
                      className="vel-popup-slider"
                      min="1" max="127" step="1"
                      value={vel}
                      onChange={(e) => {
                        e.stopPropagation();
                        setKeyVelocities(prev => ({ ...prev, [key]: Number(e.target.value) }));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="vel-popup-max">127</span>
                  </div>
                  <div className="vel-popup-value-row">
                    <input
                      type="number"
                      className="vel-popup-num"
                      min="1" max="127"
                      value={vel}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(127, Number(e.target.value) || 1));
                        setKeyVelocities(prev => ({ ...prev, [key]: v }));
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="vel-popup-of">/ 127</span>
                    <button
                      className="vel-popup-reset"
                      onClick={(e) => {
                        e.stopPropagation();
                        setKeyVelocities(prev => ({ ...prev, [key]: 100 }));
                      }}
                    >Reset</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Velocity Multiplier */}
      <div className="velocity-strip" title="Master velocity multiplier — scales all key velocities. 100% = normal, 200% = maximum loudness">
        <label className="velocity-label">Velocity</label>
        <input
          type="range"
          className="velocity-master-slider"
          min="1" max="200" step="1"
          value={velocityMultiplier}
          onChange={(e) => setVelocityMultiplier(Number(e.target.value))}
          title={`Master velocity: ${velocityMultiplier}% — scales all key velocities before sending`}
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
      <div className="collapsible-section">
        <button
          className="collapsible-header"
          onClick={() => setShowControls(!showControls)}
        >
          {showControls ? '▾' : '▸'} Synth Controls
        </button>
        <div className={`collapsible-body ${showControls ? 'open' : ''}`}>
          <div className="collapsible-inner">
          <Controls
            settings={settings}
            updateSetting={updateSetting}
          />
          </div>
        </div>
      </div>

      {/* About Modal */}
      {showInfo && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInfo(false)}>✕</button>
            <h2>REL-MIDI</h2>
            <p className="modal-tagline">Relative Interval Controller</p>

            <div className="modal-section">
              <h3>What is this?</h3>
              <p>
                REL-MIDI is a browser-based musical instrument that lets you play melodies
                using <strong>relative intervals</strong> instead of absolute pitches. Instead of
                pressing "C" then "E" then "G", you press "+4" then "+3" — the interval pattern
                works from any starting note, in any key.
              </p>
            </div>

            <div className="modal-section">
              <h3>How to play</h3>
              <ul>
                <li><strong>Keyboard:</strong> Use A S D F (negative intervals), SPACE (repeat), J K L ; (positive intervals) to move by semitones.</li>
                <li><strong>Octave jumps:</strong> Click the OCT buttons or map pads to ±12.</li>
                <li><strong>MIDI pads:</strong> Connect a pad controller (like an Akai MPD218), open MIDI Setup, and map pads to any interval from −12 to +12.</li>
                <li><strong>Knob mapping:</strong> Map MIDI CC knobs to synth controls (filter, envelope, volume) for hands-on tweaking.</li>
                <li><strong>Rapid Learn:</strong> Hit ⚡ Rapid Learn, then press your pads left-to-right to assign all intervals in sequence.</li>
              </ul>
            </div>

            <div className="modal-section">
              <h3>Features</h3>
              <ul>
                <li>Built-in browser synth with oscillator, ADSR envelope, and resonant filter</li>
                <li>MIDI output to external instruments, DAWs, and hardware</li>
                <li>MIDI input with pad-to-interval mapping and CC-to-control mapping</li>
                <li>Per-key velocity control with adjustable multiplier</li>
                <li>Live grand staff notation with note history</li>
                <li>Export your session as SVG or MIDI file</li>
              </ul>
            </div>

            <div className="modal-section">
              <h3>Who is this for?</h3>
              <p>
                Producers, composers, and music explorers who want to think in intervals
                and patterns rather than fixed keys. Ideal for sketching melodies, learning
                interval relationships, or performing with a pad controller.
              </p>
            </div>

            <div className="modal-section">
              <h3>Requirements</h3>
              <p>
                A modern browser with Web MIDI API support (Chrome, Edge, Opera).
                A MIDI controller is optional — the computer keyboard works out of the box.
              </p>
            </div>

            <div className="modal-footer-links">
              <a href="https://nathaniel-young.com" target="_blank" rel="noopener noreferrer">
                nathaniel-young.com
              </a>
              <span className="modal-copyright">© {new Date().getFullYear()} Nathaniel Young. All rights reserved.</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} <a href="https://nathaniel-young.com" target="_blank" rel="noopener noreferrer">Nathaniel Young</a></span>
        <button className="footer-info-link" onClick={() => setShowInfo(true)}>About</button>
      </footer>
    </div>
  );
}

export default MidiController;