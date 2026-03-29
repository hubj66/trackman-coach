// clubs.js
// Club data + KPI definitions
// Distances are managed separately in distances.js and referenced here by distanceRef

const CLUBS = {
  driver: {
    name: 'Driver',
    distanceRef: 'driver',
    kpis: [
      { l: 'Ball speed',   v: '95–105 mph',   d: 'Drives carry distance.',            badge: 'br', bt: 'Critical' },
      { l: 'Club path',    v: '−5° to +5°',   d: 'In-to-out is helpful, but neutral is fine.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   v: '±3°',          d: 'Main control for start direction.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', v: '12–15°',       d: 'Too low costs carry.',              badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    v: '2500–3200 rpm', d: 'Too much spin kills distance.',    badge: 'by', bt: 'Important' },
      { l: 'Smash factor', v: '1.40–1.48',    d: 'Better strike = more ball speed.',  badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Fix face angle first — it mostly controls where the ball starts' },
      { c: 'dr', t: 'Keep club path within about ±5° for straighter tee shots' },
      { c: 'dy', t: 'Improve strike quality to raise smash factor' },
      { c: 'dg', t: 'Launch and spin matter more once contact becomes consistent' },
    ],
    primary: [
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -20, max: 20,   def: 0,    ideal: [-3, 3] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -20, max: 20,   def: 0,    ideal: [-5, 5] },
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -5,  max: 8,    def: 3,    ideal: [1, 5] },
    ],
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',     min: 5,    max: 30,   def: 13,   ideal: [12, 15] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm',  min: 1500, max: 6000, def: 2800, step: 100, ideal: [2500, 3200] },
      { id: 'smash',  l: 'Smash factor', unit: '',      min: 100,  max: 150,  def: 140,  ideal: [140, 148], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed',   unit: ' mph', min: 60,  max: 130, def: 95, ideal: [90, 115] },
      { id: 'dynloft',   l: 'Dynamic loft', unit: '°',    min: 5,   max: 25,  def: 14, ideal: [11, 16] },
      { id: 'spinaxis',  l: 'Spin axis',    unit: '°',    min: -20, max: 20,  def: 0,  ideal: [-5, 5] },
    ],
    askTpl: 'I am a 54 handicap. My driver Trackman: face {face}°, path {path}°, attack {attack}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  irons: {
    name: 'Irons (6–9)',
    distanceRef: '8i',
    kpis: [
      { l: 'Attack angle', v: '−2° to −5°',  d: 'Slightly down for clean compression.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',    v: '±6° max',     d: 'Consistency matters more than perfect numbers.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   v: '±3°',         d: 'Main control for start line.',          badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', v: '16–22°',      d: 'Too high can mean scooping.',           badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    v: '5000–7500 rpm', d: 'Helps stopping power on greens.',     badge: 'by', bt: 'Important' },
      { l: 'Smash factor', v: '1.30–1.38',   d: 'Good strike without chasing perfection.', badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — hitting down a little is important with irons' },
      { c: 'dr', t: 'Face control — that gets the ball starting online' },
      { c: 'dy', t: 'Smash factor improves as contact becomes more centered' },
      { c: 'dg', t: 'Spin and launch get easier once strike and face improve' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -12, max: 8,   def: -3, ideal: [-5, -2] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -15, max: 15,  def: 0,  ideal: [-3, 3] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -15, max: 15,  def: 0,  ideal: [-6, 6] },
    ],
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',     min: 8,    max: 35,    def: 20,   ideal: [16, 22] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm',  min: 3000, max: 10000, def: 6000, step: 100, ideal: [5000, 7500] },
      { id: 'smash',  l: 'Smash factor', unit: '',      min: 100,  max: 145,   def: 134,  ideal: [130, 138], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed',   unit: ' mph', min: 50,  max: 110, def: 80, ideal: [75, 100] },
      { id: 'dynloft',   l: 'Dynamic loft', unit: '°',    min: 10,  max: 35,  def: 22, ideal: [18, 26] },
      { id: 'spinaxis',  l: 'Spin axis',    unit: '°',    min: -15, max: 15,  def: 0,  ideal: [-4, 4] },
    ],
    askTpl: 'I am a 54 handicap. My iron Trackman: attack {attack}°, face {face}°, path {path}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  wedge: {
    name: 'Wedges',
    distanceRef: 'pw',
    kpis: [
      { l: 'Attack angle',   v: '−4° to −8°',    d: 'A little steeper than irons.',      badge: 'br', bt: 'Critical' },
      { l: 'Carry distance', v: 'Consistent',    d: 'Distance control matters most here.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',     v: '±2°',           d: 'Small errors show up quickly.',      badge: 'br', bt: 'Critical' },
      { l: 'Club path',      v: '±4° max',       d: 'Short shots punish big path errors.', badge: 'by', bt: 'Important' },
      { l: 'Spin rate',      v: '6000–9000 rpm', d: 'Useful, but strike comes first.',    badge: 'by', bt: 'Important' },
      { l: 'Launch angle',   v: '28–38°',        d: 'Helps with height and stopping power.', badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — do not scoop wedge shots' },
      { c: 'dr', t: 'Carry consistency — know your stock distances' },
      { c: 'dy', t: 'Strike quality helps spin more than trying to force spin' },
      { c: 'dg', t: 'Path and face get tighter as distance control improves' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -14, max: 6,   def: -5, ideal: [-8, -4] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -10, max: 10,  def: 0,  ideal: [-2, 2] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -10, max: 10,  def: 0,  ideal: [-4, 4] },
    ],
    secondary: [
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 2000, max: 11000, def: 7000, step: 100, ideal: [6000, 9000] },
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 15,   max: 50,    def: 32,   ideal: [28, 38] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100,  max: 138,   def: 120,  ideal: [115, 128], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed', unit: ' mph', min: 30, max: 90, def: 60, ideal: [55, 80] },
    ],
    askTpl: 'I am a 54 handicap. My wedge Trackman: attack {attack}°, face {face}°, path {path}°, spin {spin} rpm, launch {launch}°, club speed {clubspeed} mph. Give me 3 prioritised drills.',
  },

  putter: {
    name: 'Putter',
    distanceRef: 'putter',
    kpis: [
      { l: 'Face angle',   v: '±1°',        d: 'Main control for start line.',          badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', v: '+1° to +3°', d: 'Helps smooth roll.',                    badge: 'br', bt: 'Critical' },
      { l: 'Club path',    v: 'Consistent', d: 'Repeatable matters more than perfect.', badge: 'by', bt: 'Important' },
      { l: 'Ball speed',   v: 'Match distance', d: 'Good speed control saves putts.',   badge: 'by', bt: 'Important' },
      { l: 'Impact spot',  v: 'Center face', d: 'Off-center contact changes face delivery.', badge: 'by', bt: 'Important' },
      { l: 'Spin loft',    v: 'Low preferred', d: 'Too much loft can create bounce.',   badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Face angle — the ball starts mostly where the face points' },
      { c: 'dr', t: 'Launch angle — too much press can hurt roll' },
      { c: 'dy', t: 'Speed control — practice 10, 20 and 30 foot ladders' },
      { c: 'dg', t: 'Path matters, but less than face for most putts' },
    ],
    primary: [
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -6, max: 6, def: 0, ideal: [-1, 1] },
      { id: 'launch', l: 'Launch angle', unit: '°',    min: -3, max: 7, def: 2, ideal: [1, 3] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -8, max: 8, def: 0, ideal: [-3, 3] },
    ],
    secondary: [
      { id: 'speed', l: 'Ball speed (10ft)', unit: ' mph', min: 2, max: 8, def: 4, ideal: [3, 5] },
    ],
    advanced: [],
    askTpl: 'I am a 54 handicap. My putting Trackman: face {face}°, launch {launch}°, path {path}°. Give me 3 prioritised drills.',
  },
};

// Helpers used by engine.js and app.js
function getAllInputs(club) {
  const C = CLUBS[club];
  return [...(C.primary || []), ...(C.secondary || []), ...(C.advanced || [])];
}

function getClubDistance(club) {
  const ref = CLUBS[club]?.distanceRef;
  if (!ref) return null;

  if (typeof getDistanceRow === 'function') {
    return getDistanceRow(ref);
  }

  return null;
}
