// today-data.js -- Static constants and module-level state for the Today tab

// today.js — Today coaching screen

let _todayAllShots = [];
let _todayIssues   = [];
let _trendIssue    = null;
let _trendShots    = null;
let _todayFocus    = 'overall';
let _todayChipSessions = [];
let _todayPuttSessions = [];
let _todayPracticeContext = 'range';
let _todayTrainingIssue   = null;   // set when user selects a club to train

const TODAY_PRACTICE_CONTEXTS = [
  { key:'range',     label:'Range',     desc:'All practice options' },
  { key:'simulator', label:'Simulator', desc:'Full-swing only; skips wedges and green work' },
  { key:'no_wedges', label:'No wedges', desc:'Keeps driver, irons and putting options' },
  { key:'short',     label:'Short',     desc:'Keeps the plan compact' },
];

const PICKER_CLUBS = [
  { ck:'driver', label:'Driver' },
  { ck:'6',      label:'6i' },
  { ck:'7',      label:'7i' },
  { ck:'8',      label:'8i' },
  { ck:'9',      label:'9i' },
  { ck:'pw',     label:'PW' },
  { ck:'sw',     label:'SW' },
  { ck:'58',     label:'58°' },
  { ck:'putter', label:'Putt' },
];

// ── Focus selector ────────────────────────────────────────────────────────
const TODAY_FOCUS_LABELS = [
  { key:'overall',  label:'Overall' },
  { key:'driver',   label:'Driver' },
  { key:'irons',    label:'Irons' },
  { key:'6',        label:'6i' },
  { key:'7',        label:'7i' },
  { key:'8',        label:'8i' },
  { key:'9',        label:'9i' },
  { key:'wedges',   label:'Wedges' },
  { key:'pw',       label:'PW' },
  { key:'58',       label:'58°' },
  { key:'sw',       label:'SW' },
  { key:'chipping', label:'Chipping' },
  { key:'putting',  label:'Putting' },
];

// Maps focus key → club key(s) for filtering shots
const TODAY_FOCUS_CLUB_KEYS = {
  driver:  ['driver'],
  irons:   ['6','7','8','9'],
  '6':     ['6'],
  '7':     ['7'],
  '8':     ['8'],
  '9':     ['9'],
  wedges:  ['pw','58','sw'],
  pw:      ['pw'],
  '58':    ['58'],
  sw:      ['sw'],
};

const GLOSSARY_TERMS = {
  face_angle: {
    term: 'Face Angle',
    def: 'The direction the clubface points at impact, in degrees from the target line. Positive = open (pointing right), negative = closed (pointing left). Face angle is the #1 factor determining where the ball starts — it accounts for ~75% of initial direction.',
    tip: 'A consistent 3° open face pushes every shot ~7m right at 150m. Small numbers matter a lot.'
  },
  smash_factor: {
    term: 'Smash Factor',
    def: 'Ball speed ÷ club head speed. Measures how efficiently the club transfers energy to the ball at impact. Driver max ~1.50; good contact is 1.42–1.48. Below 1.38 means off-centre strikes are costing you distance and consistency.',
    tip: 'Every 0.05 improvement in smash ≈ 5m more carry — no extra swing effort required.'
  },
  attack_angle: {
    term: 'Attack Angle',
    def: 'The up/down angle of the clubhead at impact. Negative = hitting down on the ball (correct for irons). For irons, −2° to −5° creates proper compression and a divot after the ball. For driver, a slight upward attack (+1° to +3°) maximises distance.',
    tip: 'Scooping (positive attack angle with irons) is the #1 cause of thin, weak, inconsistent iron shots.'
  },
  face_to_path: {
    term: 'Face-to-Path',
    def: 'The difference between where the face points and where the club swings at impact. This creates curve. Positive = face open to path → ball curves right (slice). Negative = face closed to path → ball curves left (hook). Target ±2° for a manageable flight.',
    tip: 'Fix face angle first. If the face is square, even a poor path produces a far more playable shot.'
  },
  carry: {
    term: 'Carry Distance',
    def: 'How far the ball travels through the air before landing, in metres. Different from total distance (which includes roll). Use carry for club selection — especially to greens with hazards short or front pins.',
    tip: 'Knowing carry ±5m per club is the difference between guessing and managing a round.'
  },
  spin_rate: {
    term: 'Spin Rate',
    def: 'How fast the ball spins after impact, in RPM. Higher spin = more lift and stopping power, but less distance. Driver ideal: 2000–2800 RPM. Wedges: 7000–10000 RPM gives the stopping power to hold greens.',
    tip: 'Driver: high spin kills distance. Wedges: low spin means the ball won\'t check up on the green.'
  },
  launch_angle: {
    term: 'Launch Angle',
    def: 'The vertical angle the ball leaves the face, measured from the ground. Driver ideal: 10–15°. 7-iron: 16–22°. Scooping increases launch — this is why scooped irons fly high but fall well short of their expected carry.',
    tip: 'Optimal launch + low spin = maximum carry. Fix attack angle and launch corrects itself automatically.'
  },
  club_path: {
    term: 'Club Path',
    def: 'The direction the clubhead is swinging through impact, relative to the target line. Negative = out-to-in (common slice cause). Positive = in-to-out (hook swing). Path controls mainly how much the ball curves, not where it starts.',
    tip: 'Most golfers focus on path first. Face angle matters more — fix the face, then work on path.'
  },
  spread: {
    term: 'Spread (SD)',
    def: 'Standard deviation of your carry distances — measures shot-to-shot consistency. A spread of ±8m means most shots land within 8m of your average. Lower = more predictable club selection on the course.',
    tip: 'Under ±8m for wedges and ±14m for mid-irons is the target for course-ready consistency.'
  },
};

// ── Drill catalog ─────────────────────────────────────────────────────────

const DRILL_CATALOG = [
  // Driver
  { id:'drv_gate',     name:'Face control gate',         category:'driver',  categoryLabel:'Driver',
    balls:20, min:10, issue:'Slice / open face',
    desc:'Two tees just outside the ball form a gate. Swing through without the face catching the right tee. Builds face awareness at impact.',
    cue:'Face stays square, not open.' },
  { id:'drv_split',    name:'Split-hand release',         category:'driver',  categoryLabel:'Driver',
    balls:12, min:8,  issue:'Hook / over-release',
    desc:'Grip with a gap between hands. Swing at 70% focusing on a controlled release through impact. Prevents over-rotating the face.',
    cue:'Hold the finish off.' },
  { id:'drv_start',    name:'Start-line challenge',       category:'driver',  categoryLabel:'Driver',
    balls:15, min:10, issue:'Block / push right',
    desc:'Pick a specific start line — not the target. Score only on whether the ball launches on that line, ignoring distance.',
    cue:'Control the launch, not the flight.' },
  { id:'drv_sweep',    name:'Sweep-the-tee',              category:'driver',  categoryLabel:'Driver',
    balls:15, min:10, issue:'High spin / balloon',
    desc:'Tee high and focus on brushing the tee forward. Promotes positive attack angle and low spin. No hitting down.',
    cue:'Brush the tee forward.' },
  { id:'drv_same',     name:'Same setup drill',           category:'driver',  categoryLabel:'Driver',
    balls:15, min:10, issue:'Two-way miss',
    desc:'Same address, same target, same finish every ball — no compensations. Builds a repeatable pattern over variability.',
    cue:'Process over outcome.' },
  // Irons
  { id:'iron_align',   name:'Alignment stick start-line', category:'irons',   categoryLabel:'Irons',
    balls:15, min:10, issue:'Pull left',
    desc:'Place an alignment stick 1m ahead on the target line. Every ball must start right of the stick.',
    cue:'Launch right, let it draw back.' },
  { id:'iron_repeat',  name:'10-ball repeatability block',category:'irons',   categoryLabel:'Irons',
    balls:10, min:8,  issue:'Contact inconsistency',
    desc:'10 balls to the same target at the same pace. Score only clean contacts. No heroics — build pattern first.',
    cue:'Repeat, repeat, repeat.' },
  { id:'iron_turf',    name:'Ball-then-turf drill',       category:'irons',   categoryLabel:'Irons',
    balls:15, min:10, issue:'Fat shots',
    desc:'Draw a line in the turf. The club must strike ball before line — every time. No exceptions allowed.',
    cue:'Ball first, then turf.' },
  { id:'iron_brush',   name:'Brush-and-hold',             category:'irons',   categoryLabel:'Irons',
    balls:12, min:8,  issue:'Thin shots',
    desc:'Brush the turf with a long, low follow-through and hold the finish for 3 seconds. Removes scooping habit.',
    cue:'Brush low and hold.' },
  { id:'lng_lowpoint', name:'Long-iron low point',        category:'irons',   categoryLabel:'Long irons',
    balls:15, min:10, issue:'Fat / contact loss',
    desc:'Draw a line in sand or on a mat. Leave a divot starting at or forward of the line on every swing.',
    cue:'Forward low point, every rep.' },
  // Wedges
  { id:'wedge_ladder', name:'3-distance ladder',          category:'wedges',  categoryLabel:'Wedges',
    balls:30, min:20, issue:'Distance control',
    desc:'Pick 3 distances (e.g. 50 / 70 / 90m). 10 balls each. Score only balls inside ±5m window. Rotate through.',
    cue:'Same swing, different length.' },
  { id:'wedge_press',  name:'Lead-side pressure wedge',   category:'wedges',  categoryLabel:'Wedges',
    balls:15, min:10, issue:'Fat wedge',
    desc:'60% weight on lead foot at address, stay there through impact. Eliminates hanging back and chunking.',
    cue:'Stay left all the way through.' },
  { id:'wedge_brush',  name:'Brush-the-grass ladder',     category:'wedges',  categoryLabel:'Wedges',
    balls:12, min:8,  issue:'Blade / thin',
    desc:'Focus on brushing the grass before the ball. Progress from 30m to 70m — ground contact must come first.',
    cue:'Brush first, launch second.' },
  // Short game
  { id:'chip_weight',  name:'Weight-forward chip block',  category:'short',   categoryLabel:'Short game',
    balls:20, min:12, issue:'Chunk / fat chip',
    desc:'70% weight on lead foot at address, keep it there all the way through. 20 chips from tight lies — clean contacts only.',
    cue:'Lead side stays loaded.' },
  { id:'chip_spots',   name:'One club, three spots',      category:'short',   categoryLabel:'Short game',
    balls:18, min:12, issue:'Distance control',
    desc:'Pick 3 landing spots at different distances. 6 balls to each. Score on landing accuracy, not proximity to hole.',
    cue:'Land it precisely.' },
  { id:'chip_soft',    name:'Soft-landing brush',         category:'short',   categoryLabel:'Short game',
    balls:15, min:10, issue:'Blade / thin chip',
    desc:'Brush the turf an inch before the ball. Aim for a soft landing on a specific spot, not the hole.',
    cue:'Brush the ground, land softly.' },
  // Putting
  { id:'putt_gate',    name:'Gate putting drill',         category:'putting', categoryLabel:'Putting',
    balls:20, min:15, issue:'Push / pull start line',
    desc:'Two tees 30cm ahead as a gate, slightly wider than the putter. Every putt must roll through.',
    cue:'Gate first, hole second.' },
  { id:'putt_5row',    name:'5-in-a-row ladder',          category:'putting', categoryLabel:'Putting',
    balls:20, min:15, issue:'Short putt conversion',
    desc:'Make 5 in a row from 1m before stepping back 25cm each time. Miss — return to start. Progress to 2.5m.',
    cue:'No misses inside 1m.' },
  { id:'putt_lag_past',name:'Past-the-hole lag',          category:'putting', categoryLabel:'Putting',
    balls:15, min:12, issue:'Lag short / under pace',
    desc:'From 8–12m: every putt must finish at least 30cm past the hole. Trains committing to distance.',
    cue:'Never short.' },
  { id:'putt_zone',    name:'Lag zone drill',             category:'putting', categoryLabel:'Putting',
    balls:15, min:12, issue:'Lag long / over pace',
    desc:'Two tees 60cm past the hole. Every lag must stop between the hole and the tees. Trains pace control.',
    cue:'Die in the zone.' },
];


// -- Glossary groups (used by today-overlays.js) ----------------------------------

const GLOSSARY_GROUPS = [
  {
    id: 'ball_flight',
    label: 'Ball flight',
    items: ['face_angle', 'club_path', 'face_to_path']
  },
  {
    id: 'contact',
    label: 'Contact',
    items: ['smash_factor', 'attack_angle']
  },
  {
    id: 'distance',
    label: 'Distance',
    items: ['carry', 'launch_angle', 'spin_rate', 'spread']
  }
];
