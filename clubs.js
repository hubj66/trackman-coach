// clubs.js — all club data
// Primary inputs: face, path, attack (drive the visualizations)
// Secondary inputs: spin, launch, smash (accordion — "More metrics")
// Advanced inputs: dynamic loft, spin axis, carry, club speed (accordion — "Advanced")

const CLUBS = {
  driver: {
    name: 'Driver',
    kpis: [
      { l: 'Ball speed',     v: '95–105 mph',    d: 'Drives carry distance.',            badge: 'br', bt: 'Critical' },
      { l: 'Club path',      v: '−5° to +5°',    d: 'In-to-out preferred.',              badge: 'br', bt: 'Critical' },
      { l: 'Face angle',     v: '±3° to path',   d: 'Controls 75% of start direction.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle',   v: '12–15°',         d: 'Higher = more carry.',              badge: 'by', bt: 'Important' },
      { l: 'Spin rate',      v: '2500–3200 rpm',  d: 'High spin kills distance.',         badge: 'by', bt: 'Important' },
      { l: 'Smash factor',   v: '1.40–1.48',      d: 'Strike quality. Max 1.50.',         badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Fix face angle first — it determines where the ball starts' },
      { c: 'dr', t: 'Get club path inside ±5° — reduces slices and hooks' },
      { c: 'dy', t: 'Work on smash factor (center contact)' },
      { c: 'dg', t: 'Launch and spin matter more as you improve' },
    ],
    // Primary — shown always, drive the visualizations
    primary: [
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -20, max: 20,   def: 0,    ideal: [-3, 3] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -20, max: 20,   def: 0,    ideal: [-5, 5] },
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -5,  max: 8,    def: 3,    ideal: [1, 5] },
    ],
    // More metrics accordion
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 5,   max: 30,   def: 13,   ideal: [12, 15] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 1500, max: 6000, def: 2800, step: 100, ideal: [2500, 3200] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100, max: 150,  def: 135,  ideal: [140, 148], scale: 100, dp: 2 },
    ],
    // Advanced accordion
    advanced: [
      { id: 'clubspeed',    l: 'Club speed',    unit: ' mph', min: 60,  max: 130, def: 95,  ideal: [90, 115] },
      { id: 'dynloft',      l: 'Dynamic loft',  unit: '°',   min: 5,   max: 25,  def: 14,  ideal: [11, 16] },
      { id: 'spinaxis',     l: 'Spin axis',     unit: '°',   min: -20, max: 20,  def: 0,   ideal: [-5, 5] },
    ],
    askTpl: 'I am a 54 handicap. My driver Trackman: face {face}°, path {path}°, attack {attack}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  irons: {
    name: 'Irons (6–9)',
    kpis: [
      { l: 'Attack angle',  v: '−2° to −5°',  d: 'Downward strike = compression + divot.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',     v: '±6° max',      d: 'Consistency over perfection.',            badge: 'br', bt: 'Critical' },
      { l: 'Face to path',  v: '±2° ideal',    d: 'Controls curvature.',                     badge: 'br', bt: 'Critical' },
      { l: 'Ball speed',    v: '80–100 mph',   d: '7-iron target.',                          badge: 'by', bt: 'Important' },
      { l: 'Launch angle',  v: '16–22°',       d: 'Too high = scooping.',                    badge: 'by', bt: 'Important' },
      { l: 'Smash factor',  v: '1.30–1.38',    d: 'Lower than driver by design.',            badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — hitting up on irons is the most common flaw' },
      { c: 'dr', t: 'Face to path — gets ball online and curving predictably' },
      { c: 'dy', t: 'Smash factor improves with consistent striking' },
      { c: 'dg', t: 'Spin rate is less critical at this stage' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -12, max: 8,    def: 0,    ideal: [-5, -2] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -15, max: 15,   def: 0,    ideal: [-2, 2] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -15, max: 15,   def: 0,    ideal: [-6, 6] },
    ],
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 8,   max: 35,   def: 20,   ideal: [16, 22] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 3000, max: 10000, def: 6000, step: 100, ideal: [5000, 7500] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100, max: 145,  def: 130,  ideal: [130, 138], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed',  l: 'Club speed',    unit: ' mph', min: 50,  max: 110, def: 80,  ideal: [75, 100] },
      { id: 'dynloft',    l: 'Dynamic loft',  unit: '°',   min: 10,  max: 35,  def: 22,  ideal: [18, 26] },
      { id: 'spinaxis',   l: 'Spin axis',     unit: '°',   min: -15, max: 15,  def: 0,   ideal: [-4, 4] },
    ],
    askTpl: 'I am a 54 handicap. My iron Trackman: attack {attack}°, face {face}°, path {path}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  wedge: {
    name: 'Wedges',
    kpis: [
      { l: 'Attack angle',   v: '−4° to −8°',    d: 'Steeper than irons = more spin.',   badge: 'br', bt: 'Critical' },
      { l: 'Carry distance', v: 'Consistent',     d: 'Map 50 / 75 / 100 yard carries.',  badge: 'br', bt: 'Critical' },
      { l: 'Spin rate',      v: '6000–9000 rpm',  d: 'Ball stops on green.',              badge: 'by', bt: 'Important' },
      { l: 'Club path',      v: '±4° max',        d: 'Short shots punish path errors.',  badge: 'by', bt: 'Important' },
      { l: 'Face angle',     v: '±2°',            d: 'Small errors matter here.',         badge: 'by', bt: 'Important' },
      { l: 'Low point',      v: 'After ball',     d: 'Divot appears after impact.',       badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — must hit down, not scoop' },
      { c: 'dr', t: 'Carry consistency — map 50/75/100 yard distances' },
      { c: 'dy', t: 'Spin improves naturally as strike improves' },
      { c: 'dg', t: 'Face and path tighten as distance control improves' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -14, max: 6,    def: -2,   ideal: [-8, -4] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -10, max: 10,   def: 0,    ideal: [-2, 2] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -10, max: 10,   def: 0,    ideal: [-4, 4] },
    ],
    secondary: [
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 2000, max: 11000, def: 5000, step: 100, ideal: [6000, 9000] },
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 15,  max: 50,   def: 30,   ideal: [28, 38] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100, max: 138,  def: 120,  ideal: [115, 128], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed', unit: ' mph', min: 30, max: 90, def: 60, ideal: [55, 80] },
    ],
    askTpl: 'I am a 54 handicap. My wedge Trackman: attack {attack}°, face {face}°, path {path}°, spin {spin} rpm, launch {launch}°, club speed {clubspeed} mph. Give me 3 prioritised drills.',
  },

  putter: {
    name: 'Putter',
    kpis: [
      { l: 'Face angle',   v: '±1°',          d: 'Controls 83% of start direction.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', v: '+1° to +3°',   d: 'Smooth early roll.',               badge: 'br', bt: 'Critical' },
      { l: 'Impact spot',  v: 'Center face',  d: 'Off-center twists face.',          badge: 'by', bt: 'Important' },
      { l: 'Club path',    v: 'Consistent',   d: 'Match your natural stroke.',        badge: 'by', bt: 'Important' },
      { l: 'Ball speed',   v: 'Match distance', d: '10 / 20 / 30 ft zones.',         badge: 'by', bt: 'Important' },
      { l: 'Spin loft',    v: 'Low preferred', d: 'High loft causes bouncing.',       badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Face angle — 2° open misses a 20 ft putt badly' },
      { c: 'dr', t: 'Launch angle — pressing down kills roll quality' },
      { c: 'dy', t: 'Speed control — map stroke length to distance' },
      { c: 'dg', t: 'Path matters more once face angle is dialed in' },
    ],
    primary: [
      { id: 'face',   l: 'Face angle',       unit: '°',    min: -6, max: 6, def: 0, ideal: [-1, 1] },
      { id: 'launch', l: 'Launch angle',      unit: '°',    min: -3, max: 7, def: 2, ideal: [1, 3] },
      { id: 'path',   l: 'Club path',         unit: '°',    min: -8, max: 8, def: 0, ideal: [-3, 3] },
    ],
    secondary: [
      { id: 'speed',  l: 'Ball speed (10ft)', unit: ' mph', min: 2,  max: 8, def: 4, ideal: [3, 5] },
    ],
    advanced: [],
    askTpl: 'I am a 54 handicap. My putting Trackman: face {face}°, launch {launch}°, path {path}°. Give me 3 prioritised drills.',
  },
};

// Helpers used by engine.js and app.js
function getAllInputs(club) {
  const C = CLUBS[club];
  return [...(C.primary||[]), ...(C.secondary||[]), ...(C.advanced||[])];
}
