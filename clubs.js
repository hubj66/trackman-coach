// clubs.js
// Club data + KPI definitions

const CLUBS = {
  driver: {
    name: 'Driver',
    distanceRef: 'driver',
    routine: [
      { step: 1, cue: 'Ball position', detail: 'Forward off lead heel — furthest forward in stance' },
      { step: 2, cue: 'Shaft neutral', detail: 'Shaft points at belt buckle — no forward press' },
      { step: 3, cue: 'Lead thumb', detail: 'Right of logo — face square at address. Weight 60/40 left.' },
    ],
    kpis: [
      { l: 'Ball speed',   realistic: '90–105 mph',    good: '98–112 mph',    d: 'Directly drives carry distance. Ball speed = club speed × smash factor. The only way to gain distance without better contact is more club speed — but smash is faster to improve.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: '−6° to +6°',    good: '−4° to +4°',    d: 'Direction the clubhead travels at impact. Negative = out-to-in (slice path). Positive = in-to-out (draw path). Combine with face angle to predict ball curve.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   realistic: '±4°',           good: '±2.5°',         d: 'Where the face points at impact. Controls ~75% of start direction. Open (+) = starts right. Closed (−) = starts left. Most important single number for direction.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '11–16°',        good: '12–15°',        d: 'Vertical angle ball leaves the face. Interact with spin to determine carry. Too low = runs out of height early. Too high = ball balloons and loses distance.', badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    realistic: '2400–3400 rpm', good: '2300–3000 rpm', d: 'Lower spin with driver = more carry and roll. High spin (>3500) causes ballooning. Fix steep attack angle and open face to reduce spin naturally.', badge: 'by', bt: 'Important' },
      { l: 'Smash factor', realistic: '1.38–1.46',     good: '1.43–1.48',     d: 'Ball speed ÷ club speed. Measures strike efficiency. Every 0.01 gain = ~1.5m carry at 90mph. Max theoretical is ~1.50. Use face tape to find your contact pattern.', badge: 'bg', bt: 'Watch' },
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
    routine: [
      { step: 1, cue: 'Ball position', detail: 'PW/9i = centre · 7i = 1 ball left of centre · 6i = 2 balls left of centre' },
      { step: 2, cue: 'Shaft angle', detail: 'Shaft points at belt buckle — sets correct distance from ball' },
      { step: 3, cue: 'Lead thumb', detail: 'Right of logo — face square at address. Weight 60/40 left.' },
    ],
    kpis: [
      { l: 'Attack angle', realistic: '−5° to −2°',    good: '−5° to −3°',    d: 'How steeply the club descends at impact. Negative = hitting down (correct for irons). Near 0° or positive = scooping. Improved from ~0° to ~−3° — keep pushing toward −4°. Divot position tells you this without Trackman.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: '±6° max',       good: '±4° max',       d: 'Direction the clubhead travels. More stable than face angle for most amateurs. Combined with face angle, determines ball curve. Your path is relatively stable — face is the priority to fix.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',   realistic: '±4°',           good: '±2.5°',         d: 'Where the face points at impact. Your primary fault: swinging from −9° to +6° — that 15° spread explains nearly all your left/right misses. Controls ~75% of start direction. This is the #1 thing to tighten.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '17–23°',        good: '18–21°',        d: 'Vertical angle ball leaves. Too high = scooping (attack angle problem). Too low = hands too far forward or delofted. Fix attack angle and launch fixes itself automatically.', badge: 'by', bt: 'Important' },
      { l: 'Spin rate',    realistic: '4800–7200 rpm', good: '5500–7500 rpm', d: 'Spin helps the ball stop on the green. Follows from good strike and steep attack. Do not chase spin directly — fix smash and attack angle first and spin improves automatically.', badge: 'by', bt: 'Important' },
      { l: 'Smash factor', realistic: '1.28–1.35',     good: '1.31–1.36',     d: 'Ball speed ÷ club speed. The #1 diagnostic for strike quality — fix this before anything else. Below 1.26 = significant energy lost to off-center contact. Use face impact tape to find your pattern.', badge: 'bg', bt: 'Watch' },
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
    routine: [
      { step: 1, cue: 'Ball position', detail: 'PW = centre · SW = centre · 58° = just back of centre' },
      { step: 2, cue: 'Shaft lean', detail: 'Hands slightly forward — shaft leans toward target. No scooping.' },
      { step: 3, cue: 'Lead thumb', detail: 'Right of logo. Weight 60/40 left. Grip pressure light.' },
    ],
    kpis: [
      { l: 'Attack angle',   realistic: '−7° to −3°',    good: '−7° to −4°',    d: 'Wedges need a steeper downward strike than long irons. Near 0° = scooping — ball flies low, spins less, rolls through the green. Fix this one and distance control + spin both improve for free.', badge: 'br', bt: 'Critical' },
      { l: 'Carry distance', realistic: 'repeatable ±7m', good: 'repeatable ±4m', d: 'Distance control is the primary wedge skill. Knowing your stock carry for PW (82m), 9i (88m), 7i (108m), 58° (59m) and hitting within ±5m every time beats all other wedge improvements.', badge: 'br', bt: 'Critical' },
      { l: 'Face angle',     realistic: '±3°',            good: '±2°',           d: 'From inside 100m, a 3° face error matters much more than from 150m. A 3° open face from 30m = ball starts 1.5m right before any curve. Prioritise face at address over everything else for wedges.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',      realistic: '±5° max',        good: '±3° max',       d: 'Short shots punish big path errors. At wedge distances the ball does not have time to curve back. Keep path within ±4° and face within ±2° for controllable wedge flights.', badge: 'by', bt: 'Important' },
      { l: 'Spin rate',      realistic: '5000–8500 rpm',  good: '6500–9000 rpm', d: 'Wedge spin is high because you hit steeply and grooves engage. Higher spin = ball checks up. Do not force spin — it is a byproduct of good downward strike. Fix attack angle and spin follows.', badge: 'by', bt: 'Important' },
      { l: 'Launch angle',   realistic: '26–40°',         good: '28–36°',        d: 'Higher launch = softer landing = easier to stop. Paired with good spin, high launch allows you to attack pins. Follows from clean downward strike — do not chase this directly.', badge: 'bg', bt: 'Watch' },
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
    routine: [
      { step: 1, cue: 'Eyes over ball', detail: 'Drop a ball from your eye — it should land on the ball on the ground' },
      { step: 2, cue: 'Face aim', detail: 'Aim face first, then build your stance around it. Face is #1.' },
      { step: 3, cue: 'Speed focus', detail: 'Before each putt, pick a speed target — die at the hole or 30cm past.' },
    ],
    kpis: [
      { l: 'Face angle',   realistic: '±1.5°',        good: '±1°',          d: 'Main control for start line. Ball starts ~90% toward where the face points on short putts. Getting face within ±1° every putt is the most important putting skill. Everything else is secondary.', badge: 'br', bt: 'Critical' },
      { l: 'Launch angle', realistic: '+1° to +4°',   good: '+1° to +3°',   d: 'Slightly upward launch helps the ball roll smoothly instead of bouncing. Too much forward press (negative) causes the ball to skip. Too upward and the ball hops. Move ball position to adjust.', badge: 'br', bt: 'Critical' },
      { l: 'Club path',    realistic: 'repeatable ±4°', good: 'repeatable ±3°', d: 'Repeatable path matters more than perfect path for putting. Arc or straight-back-straight-through both work — consistency is the goal. Path matters far less than face for start direction.', badge: 'by', bt: 'Important' },
      { l: 'Ball speed',   realistic: 'match distance', good: 'tight speed control', d: 'Good speed control saves more putts than improved aim. Practice 10, 20 and 30 foot ladders — ball finishing within 30cm of the hole. Speed is the skill that transfers most to the course.', badge: 'by', bt: 'Important' },
      { l: 'Impact spot',  realistic: 'mostly center', good: 'center face',  d: 'Off-center contact changes face delivery and ball speed. Stick a piece of face tape on the putter and check contact pattern over 10 putts. Most amateurs miss toward the toe.', badge: 'by', bt: 'Important' },
      { l: 'Spin loft',    realistic: 'low',           good: 'very low',     d: 'Dynamic loft at impact. Too much = ball bounces before rolling. Ideally less than 3°. Forward ball position and level stroke reduces this automatically.', badge: 'bg', bt: 'Watch' },
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
