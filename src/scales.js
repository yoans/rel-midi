// Scale definitions ported from AG16 (c:\bench\AG16\src\arrow-grid\scales.js)
// Intervals are semitone offsets within one octave; last entry is always 12 (octave repeat).

const scaleGroups = [
    {
        group: 'Common',
        scales: {
            'chromatic':         [0,1,2,3,4,5,6,7,8,9,10,11,12],
            'major':             [0,2,4,5,7,9,11,12],
            'natural minor':     [0,2,3,5,7,8,10,12],
            'melodic minor':     [0,2,3,5,7,9,11,12],
            'pentatonic major':  [0,2,4,7,9,12],
            'pentatonic minor':  [0,3,5,7,10,12],
            'blues':             [0,3,5,6,7,10,12],
            'whole tone':        [0,2,4,6,8,10,12],
        }
    },
    {
        group: 'Modes',
        scales: {
            'dorian':               [0,2,3,5,7,9,10,12],
            'phrygian':             [0,1,3,5,7,8,10,12],
            'lydian':               [0,2,4,6,7,9,11,12],
            'mixolydian':           [0,2,4,5,7,9,10,12],
            'locrian':              [0,1,3,5,6,8,10,12],
            'locrian natural':      [0,2,3,5,6,8,10,12],
            'locrian major':        [0,2,4,5,6,8,10,12],
            'locrian ultra':        [0,1,3,4,6,8,9,12],
            'lydian minor':         [0,2,4,6,7,8,10,12],
            'lydian augmented':     [0,2,4,6,8,9,10,12],
            'mixolydian augmented': [0,2,4,5,8,9,10,12],
        }
    },
    {
        group: 'Jazz',
        scales: {
            'bebop dominant':       [0,2,4,5,7,9,10,11,12],
            'bebop dominant flatnine': [0,1,4,5,7,9,10,11,12],
            'bebop major':          [0,2,4,5,7,8,9,11,12],
            'bebop minor':          [0,2,3,5,7,8,9,10,12],
            'bebop tonic minor':    [0,2,3,5,7,8,9,11,12],
            'altered':              [0,1,3,4,6,8,10,12],
            'diminished':           [0,2,3,5,6,8,9,11,12],
            'augmented':            [0,3,4,7,8,11,12],
            'harmonic major':       [0,2,4,5,8,9,11,12],
            'leading whole tone':   [0,2,4,6,8,10,11,12],
            'overtone':             [0,2,4,6,7,9,10,12],
        }
    },
    {
        group: 'World',
        scales: {
            'spanish':           [0,1,4,5,7,8,10,12],
            'spanish 8 tone':    [0,1,3,4,5,6,8,10,12],
            'flamenco':          [0,1,3,4,5,7,8,10,12],
            'gypsy':             [0,1,4,5,7,8,11,12],
            'hungarian major':   [0,3,4,6,7,9,10,12],
            'romanian':          [0,2,3,6,7,9,10,12],
            'indian':            [0,1,3,4,7,8,10,12],
            'hindu':             [0,2,4,5,7,8,10,12],
            'todi':              [0,1,3,6,7,8,11,12],
            'marva':             [0,1,4,6,7,9,11,12],
            'mohammedan':        [0,2,3,5,7,8,11,12],
            'ethiopian':         [0,2,4,5,7,8,11,12],
            'egyptian':          [0,2,3,6,7,8,11,12],
            'neapolitan minor':  [0,1,3,5,7,8,11,12],
            'neapolitan major':  [0,1,3,5,7,9,11,12],
            'javanese':          [0,1,3,5,7,9,10,12],
        }
    },
    {
        group: 'Asian',
        scales: {
            'chinese':    [0,2,4,7,9,12],
            'chinese 2':  [0,4,6,7,11,12],
            'japanese':   [0,1,5,7,8,12],
            'hirajoshi':  [0,2,3,7,8,12],
            'iwato':      [0,1,5,6,10,12],
            'pelog':      [0,1,3,7,10,12],
        }
    },
    {
        group: 'Exotic',
        scales: {
            'persian':     [0,1,4,5,6,8,11,12],
            'oriental':    [0,1,4,5,6,9,10,12],
            'enigmatic':   [0,1,4,6,8,10,11,12],
            'symmetrical': [0,1,3,4,6,7,9,10,12],
            '3 semitone':  [0,3,6,9,12],
            '4 semitone':  [0,4,8,12],
            'pb':          [0,1,3,6,8,12],
            'pe':          [0,1,3,7,8,12],
            'pd':          [0,2,3,7,9,12],
        }
    },
];

// Flat list with group info, in declaration order
const flatScales = [];
for (const group of scaleGroups) {
    for (const [name, intervals] of Object.entries(group.scales)) {
        flatScales.push({
            label: name.charAt(0).toUpperCase() + name.slice(1),
            value: intervals,
            group: group.group,
        });
    }
}

export { scaleGroups };
export default flatScales;
