// clubs.js
// Club data + KPI definitions
// Distances are managed separately in distances.js and referenced here by distanceRef
// Each metric/input can have two ranges:
// - realistic: better for normal amateurs
// - good: stronger target

const CLUBS = {
  driver: {
    name: 'Driver',
    distanceRef: 'driver',
    kpis: [
      { l: 'Ball speed',   realistic: '90–105 mph',    good: '98–112 mph',    d: 'Drives carry distance.',                         badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: '−6° to +6°',    good: '−4° to +4°',    d: 'Neutral is good. Too extreme creates curve.',   badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   realistic: '±4°',           good: '±2.5°',         d: 'Main control for start direction.',              badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '11–16°',        good: '12–15°',        d: 'Too low loses carry. Too high can float.',       badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    realistic: '2400–3400 rpm', good: '2300–3000 rpm', d: 'Too much spin costs distance.',                  badge: 'by', bt: 'Important' },
      { l: 'Smash factor', realistic: '1.38–1.46',     good: '1.43–1.48',     d: 'Better strike gives more ball speed.',          badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Fix face angle first — it mostly controls where the ball starts' },
      { c: 'dr', t: 'Keep club path within about ±5° for straighter tee shots' },
      { c: 'dy', t: 'Improve strike quality to raise smash factor' },
      { c: 'dg', t: 'Launch and spin matter more once contact becomes consistent' },
    ],
    primary: [
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -20, max: 20, def: 0,    realistic: [-4, 4],    good: [-2.5, 2.5] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -20, max: 20, def: 0,    realistic: [-6, 6],    good: [-4, 4] },
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -5,  max: 8,  def: 3,    realistic: [0, 5],     good: [1, 4] },
    ],
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 5,    max: 30,   def: 13,   realistic: [11, 16],  good: [12, 15] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 1500, max: 6000, def: 2800, step: 100, realistic: [2400, 3400], good: [2300, 3000] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100,  max: 150,  def: 140,  realistic: [138, 146], good: [143, 148], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed',   unit: ' mph', min: 60,  max: 130, def: 95, realistic: [88, 108], good: [95, 112] },
      { id: 'dynloft',   l: 'Dynamic loft', unit: '°',    min: 5,   max: 25,  def: 14, realistic: [11, 17], good: [12, 15] },
      { id: 'spinaxis',  l: 'Spin axis',    unit: '°',    min: -20, max: 20,  def: 0,  realistic: [-6, 6], good: [-4, 4] },
    ],
    askTpl: 'I am a 54 handicap. My driver Trackman: face {face}°, path {path}°, attack {attack}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  irons: {
    name: 'Irons (6–9)',
    distanceRef: '8i',
    kpis: [
      { l: 'Attack angle', realistic: '−5° to −2°',    good: '−5° to −3°',    d: 'Slightly down for clean compression.',           badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: '±6° max',       good: '±4° max',       d: 'Consistency matters more than perfection.',      badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   realistic: '±4°',           good: '±2.5°',         d: 'Main control for start line.',                   badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '17–23°',        good: '18–21°',        d: 'Too high can mean scoop. Too low can be thin.',  badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    realistic: '4800–7200 rpm', good: '5500–7500 rpm', d: 'Useful for stopping power.',                     badge: 'by', bt: 'Important' },
      { l: 'Smash factor', realistic: '1.28–1.35',     good: '1.31–1.36',     d: 'Shorter irons have lower smash than long irons.', badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — hitting down a little is important with irons' },
      { c: 'dr', t: 'Face control — that gets the ball starting online' },
      { c: 'dy', t: 'Smash factor improves as contact becomes more centered' },
      { c: 'dg', t: 'Spin and launch get easier once strike and face improve' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -12, max: 8,  def: -3, realistic: [-5, -2], good: [-5, -3] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -15, max: 15, def: 0,  realistic: [-4, 4], good: [-2.5, 2.5] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -15, max: 15, def: 0,  realistic: [-6, 6], good: [-4, 4] },
    ],
    secondary: [
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 8,    max: 35,    def: 20,   realistic: [17, 23], good: [18, 21] },
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 3000, max: 10000, def: 6000, step: 100, realistic: [4800, 7200], good: [5500, 7500] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100,  max: 145,   def: 132,  realistic: [128, 135], good: [131, 136], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed',   unit: ' mph', min: 50, max: 110, def: 80, realistic: [70, 92], good: [76, 96] },
      { id: 'dynloft',   l: 'Dynamic loft', unit: '°',    min: 10, max: 35,  def: 22, realistic: [19, 27], good: [20, 25] },
      { id: 'spinaxis',  l: 'Spin axis',    unit: '°',    min: -15, max: 15, def: 0,  realistic: [-6, 6], good: [-4, 4] },
    ],
    askTpl: 'I am a 54 handicap. My iron Trackman: attack {attack}°, face {face}°, path {path}°, launch {launch}°, spin {spin} rpm, smash {smash}, club speed {clubspeed} mph, dynamic loft {dynloft}°, spin axis {spinaxis}°. Give me 3 prioritised drills to fix my faults.',
  },

  wedge: {
    name: 'Wedges',
    distanceRef: 'pw',
    kpis: [
      { l: 'Attack angle',   realistic: '−7° to −3°',    good: '−7° to −4°',    d: 'A little steeper than irons.',                  badge: 'br', bt: 'Critical' },
      { l: 'Carry distance', realistic: 'repeatable ±7m', good: 'repeatable ±4m', d: 'Distance control matters most here.',         badge: 'br', bt: 'Critical' },
      { l: 'Face angle',     realistic: '±3°',            good: '±2°',           d: 'Small errors show up quickly.',                badge: 'br', bt: 'Critical' },
      { l: 'Club path',      realistic: '±5° max',        good: '±3° max',       d: 'Short shots punish big path errors.',         badge: 'by', bt: 'Important' },
      { l: 'Spin rate',      realistic: '5000–8500 rpm',  good: '6500–9000 rpm', d: 'Useful, but strike comes first.',             badge: 'by', bt: 'Important' },
      { l: 'Launch angle',   realistic: '26–40°',         good: '28–36°',        d: 'Helps with height and stopping power.',       badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Attack angle — do not scoop wedge shots' },
      { c: 'dr', t: 'Carry consistency — know your stock distances' },
      { c: 'dy', t: 'Strike quality helps spin more than trying to force spin' },
      { c: 'dg', t: 'Path and face get tighter as distance control improves' },
    ],
    primary: [
      { id: 'attack', l: 'Attack angle', unit: '°',    min: -14, max: 6,  def: -5, realistic: [-7, -3], good: [-7, -4] },
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -10, max: 10, def: 0,  realistic: [-3, 3], good: [-2, 2] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -10, max: 10, def: 0,  realistic: [-5, 5], good: [-3, 3] },
    ],
    secondary: [
      { id: 'spin',   l: 'Spin rate',    unit: ' rpm', min: 2000, max: 11000, def: 7000, step: 100, realistic: [5000, 8500], good: [6500, 9000] },
      { id: 'launch', l: 'Launch angle', unit: '°',    min: 15,   max: 50,    def: 32,   realistic: [26, 40], good: [28, 36] },
      { id: 'smash',  l: 'Smash factor', unit: '',     min: 100,  max: 138,   def: 120,  realistic: [114, 127], good: [118, 128], scale: 100, dp: 2 },
    ],
    advanced: [
      { id: 'clubspeed', l: 'Club speed', unit: ' mph', min: 30, max: 90, def: 60, realistic: [50, 72], good: [56, 76] },
    ],
    askTpl: 'I am a 54 handicap. My wedge Trackman: attack {attack}°, face {face}°, path {path}°, spin {spin} rpm, launch {launch}°, club speed {clubspeed} mph. Give me 3 prioritised drills.',
  },

  putter: {
    name: 'Putter',
    distanceRef: 'putter',
    kpis: [
      { l: 'Face angle',   realistic: '±1.5°',        good: '±1°',          d: 'Main control for start line.',                    badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '+1° to +4°',   good: '+1° to +3°',   d: 'Helps smooth roll.',                             badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: 'repeatable ±4°', good: 'repeatable ±3°', d: 'Repeatable matters more than perfect.',       badge: 'by', bt: 'Important' },
      { l: 'Ball speed',   realistic: 'match distance', good: 'tight speed control', d: 'Good speed control saves putts.',        badge: 'by', bt: 'Important' },
      { l: 'Impact spot',  realistic: 'mostly center', good: 'center face',  d: 'Off-center contact changes face delivery.',      badge: 'by', bt: 'Important' },
      { l: 'Spin loft',    realistic: 'low',           good: 'very low',     d: 'Too much loft can create bounce.',               badge: 'bg', bt: 'Watch' },
    ],
    focus: [
      { c: 'dr', t: 'Face angle — the ball starts mostly where the face points' },
      { c: 'dr', t: 'Launch angle — too much press can hurt roll' },
      { c: 'dy', t: 'Speed control — practice 10, 20 and 30 foot ladders' },
      { c: 'dg', t: 'Path matters, but less than face for most putts' },
    ],
    primary: [
      { id: 'face',   l: 'Face angle',   unit: '°',    min: -6, max: 6, def: 0, realistic: [-1.5, 1.5], good: [-1, 1] },
      { id: 'launch', l: 'Launch angle', unit: '°',    min: -3, max: 7, def: 2, realistic: [1, 4],       good: [1, 3] },
      { id: 'path',   l: 'Club path',    unit: '°',    min: -8, max: 8, def: 0, realistic: [-4, 4],      good: [-3, 3] },
    ],
    secondary: [
      { id: 'speed', l: 'Ball speed (10ft)', unit: ' mph', min: 2, max: 8, def: 4, realistic: [3, 5], good: [3.4, 4.8] },
    ],
    advanced: [],
    askTpl: 'I am a 54 handicap. My putting Trackman: face {face}°, launch {launch}°, path {path}°. Give me 3 prioritised drills.',
  },
};

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

function applyRangeModeToClubs(mode) {
  Object.values(CLUBS).forEach(C => {
    getAllInputsByClubObject(C).forEach(inp => {
      if (inp[mode]) inp.ideal = inp[mode].slice();
      else if (inp.realistic) inp.ideal = inp.realistic.slice();
    });
  });
}

function getAllInputsByClubObject(C) {
  return [...(C.primary || []), ...(C.secondary || []), ...(C.advanced || [])];
}
