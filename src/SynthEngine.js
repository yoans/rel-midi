import { useEffect, useRef, useState, useCallback } from 'react';

export const useSynth = () => {
  const audioContext = useRef(null);
  const masterGain = useRef(null);
  const filterNode = useRef(null);
  const activeOscillators = useRef({});

  const [settings, setSettings] = useState({
    waveform: 'sawtooth',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.5,
    release: 0.3,
    cutoff: 2000,
    resonance: 1,
    masterVolume: 0.5
  });

  useEffect(() => {
    // Initialize Audio Context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext.current = new AudioContext();
    
    // Master Gain
    masterGain.current = audioContext.current.createGain();
    masterGain.current.gain.value = settings.masterVolume;
    
    // Filter
    filterNode.current = audioContext.current.createBiquadFilter();
    filterNode.current.type = 'lowpass';
    filterNode.current.frequency.value = settings.cutoff;
    filterNode.current.Q.value = settings.resonance;

    // Connect graph
    filterNode.current.connect(masterGain.current);
    masterGain.current.connect(audioContext.current.destination);

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (masterGain.current) {
      masterGain.current.gain.setTargetAtTime(settings.masterVolume, audioContext.current.currentTime, 0.01);
    }
    if (filterNode.current) {
      filterNode.current.frequency.setTargetAtTime(settings.cutoff, audioContext.current.currentTime, 0.01);
      filterNode.current.Q.setTargetAtTime(settings.resonance, audioContext.current.currentTime, 0.01);
    }
  }, [settings.masterVolume, settings.cutoff, settings.resonance]);

  const playNote = useCallback((note, velocity = 127) => {
    if (!audioContext.current) return;
    
    // Resume context if suspended (browser policy)
    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }

    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const now = audioContext.current.currentTime;
    const vel = velocity / 127;

    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();

    osc.type = settings.waveform;
    osc.frequency.setValueAtTime(freq, now);

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vel, now + settings.attack);
    gain.gain.linearRampToValueAtTime(vel * settings.sustain, now + settings.attack + settings.decay);

    osc.connect(gain);
    gain.connect(filterNode.current);

    osc.start(now);

    // Store reference to stop later
    if (activeOscillators.current[note]) {
        // If note is already playing, stop it first to avoid stuck notes or layering
        stopNote(note);
    }
    activeOscillators.current[note] = { osc, gain };
  }, [settings]);

  const stopNote = useCallback((note) => {
    if (!audioContext.current || !activeOscillators.current[note]) return;

    const { osc, gain } = activeOscillators.current[note];
    const now = audioContext.current.currentTime;

    // Release phase
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings.release);

    osc.stop(now + settings.release + 0.1); // Stop slightly after release to ensure silence
    
    // Cleanup
    setTimeout(() => {
        // disconnect nodes to free memory
        osc.disconnect();
        gain.disconnect();
    }, (settings.release + 0.2) * 1000);

    delete activeOscillators.current[note];
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return {
    playNote,
    stopNote,
    settings,
    updateSetting
  };
};
