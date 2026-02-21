import React from 'react';

const Controls = ({ settings, updateSetting }) => {

    const waveforms = ['sine', 'square', 'sawtooth', 'triangle'];

    return (
        <div className="controls-panel">
            <div className="control-group">
                <h3>Oscillator</h3>
                <div className="control-item">
                    <label>Waveform</label>
                    <select
                        value={settings.waveform}
                        onChange={(e) => updateSetting('waveform', e.target.value)}
                        className="synth-select"
                    >
                        {waveforms.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>
            </div>

            <div className="control-group">
                <h3>Envelope</h3>
                <div className="sliders-grid">
                    <div className="control-item">
                        <label>A</label>
                        <input
                            type="range" min="0" max="2" step="0.01"
                            value={settings.attack}
                            onChange={(e) => updateSetting('attack', Number(e.target.value))}
                        />
                    </div>
                    <div className="control-item">
                        <label>D</label>
                        <input
                            type="range" min="0" max="2" step="0.01"
                            value={settings.decay}
                            onChange={(e) => updateSetting('decay', Number(e.target.value))}
                        />
                    </div>
                    <div className="control-item">
                        <label>S</label>
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={settings.sustain}
                            onChange={(e) => updateSetting('sustain', Number(e.target.value))}
                        />
                    </div>
                    <div className="control-item">
                        <label>R</label>
                        <input
                            type="range" min="0" max="5" step="0.01"
                            value={settings.release}
                            onChange={(e) => updateSetting('release', Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className="control-group">
                <h3>Filter</h3>
                <div className="control-item">
                    <label>Cutoff</label>
                    <input
                        type="range" min="20" max="20000" step="10"
                        value={settings.cutoff}
                        onChange={(e) => updateSetting('cutoff', Number(e.target.value))}
                    />
                </div>
                <div className="control-item">
                    <label>Resonance</label>
                    <input
                        type="range" min="0" max="20" step="0.1"
                        value={settings.resonance}
                        onChange={(e) => updateSetting('resonance', Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="control-group">
                <h3>Master</h3>
                <div className="control-item">
                    <label>Volume</label>
                    <input
                        type="range" min="0" max="1" step="0.01"
                        value={settings.masterVolume}
                        onChange={(e) => updateSetting('masterVolume', Number(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
};

export default Controls;
