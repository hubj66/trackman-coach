// today.js — Today coaching screen

let _todayAllShots = [];
let _todayIssues   = [];
let _trendIssue    = null;
let _trendShots    = null;

const PICKER_CLUBS = [
  { ck:'driver', label:'Driver' },
  { ck:'6',      label:'6i' },
  { ck:'7',      label:'7i' },
  { ck:'8',      label:'8i' },
  { ck:'9',      label:'9i' },
  { ck:'pw',     label:'PW' },
  { ck:'58',     label:'58°' },
  { ck:'putter', label:'Putt' },
];

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

async function initTodayTab() {
  const el = document.getElementById('today-content');
  if (!el) return;

  el.innerHTML = '<div class="today-loading"><div class="today-loading-spinner"></div>Loading your coaching summary…</div>';

  const sb = window.supabaseClient;
  const { data: authData } = await sb.auth.getSession();
  if (!authData?.session?.user) {
    el.innerHTML = `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Sign in to see your coaching</div>
        <div class="today-empty-text">Your practice data will be analysed to show you exactly what to work on.</div>
        <button class="today-login-btn" onclick="toggleAuthPanel()">Login →</button>
      </div>`;
    return;
  }
  const CA = window.clubAliases;
  if (CA?.loadAliases) {
    await CA.loadAliases();
  }

  const [{ data: shots }, { data: chips }, { data: putts }] = await Promise.all([
    sb.from('trackman_shots')
      .select('id,club,carry,total,side,smash_factor,ball_speed,face_angle,face_to_path,club_path,attack_angle,launch_angle,spin_rate,is_full_shot,exclude_from_progress,shot_time,created_at')
      .eq('exclude_from_progress', false)
      .order('shot_time', { ascending: false })
      .limit(300),
    sb.from('chipping_sessions')
      .select('session_date,attempts,inside_1m,between_1_2m,outside_3m')
      .order('session_date', { ascending: false })
      .limit(10),
    sb.from('putting_sessions')
      .select('session_date,distance_m,holed,total')
      .order('session_date', { ascending: false })
      .limit(20),
  ]);

  const allShots = _mergeManualShots(shots || []);
  const chipSessions = chips || [];
  const puttSessions = putts || [];

  const issues    = _detectTodayIssues(allShots, puttSessions);
  const health    = _buildHealthTiles(allShots, chipSessions, puttSessions);
  const improved  = _detectImprovement(allShots);
  const regression = _detectRegression(allShots);

  _todayAllShots = allShots;
  _todayIssues   = issues;
  _trendIssue    = issues[0] || null;
  _trendShots    = allShots;

  // Detect fixed issues (present last time, gone now)
  const today10 = new Date().toISOString().slice(0,10);
  const sevenDaysAgo = new Date(Date.now()-7*24*3600*1000).toISOString().slice(0,10);
  let fixedIssues = [];
  try {
    const prev = JSON.parse(localStorage.getItem('today_prev_issues')||'[]');
    fixedIssues = prev.filter(pi=>pi.date>=sevenDaysAgo && !issues.find(ci=>ci.key===pi.key)).slice(0,1);
    localStorage.setItem('today_prev_issues', JSON.stringify(
      issues.map(i=>({key:i.key,simple:i.simple,date:today10}))
    ));
  } catch(e) {}

  requestAnimationFrame(() => {
    el.innerHTML = _renderTodayContent(issues, health, improved, regression, allShots.length, fixedIssues);
  });
}

// ── Issue detection ────────────────────────────────────────────────────────

function _confLabel(conf) {
  return conf < 0.4 ? 'Emerging' : conf < 0.7 ? 'Likely' : 'Confirmed';
}

function _detectTodayIssues(allShots, puttSessions) {
  const CA = window.clubAliases;
  if (!CA) return [];
  const issues = [];

  const CLUB_IMPACT = { driver:1.2, '6':1.0, '7':1.0, '8':1.0, '9':1.0, pw:1.15, '58':1.15, sw:1.15 };

  for (const [ck, impact] of Object.entries(CLUB_IMPACT)) {
    const clubShots = allShots.filter(s => CA.shotMatchesClub(s, ck)).slice(0, 40);
    if (clubShots.length < 12) continue;

    const n    = clubShots.length;
    const conf = Math.min(n / 30, 1);
    const clubName = CA.clubLabel(ck);
    const confLabel = _confLabel(conf);
    const lowConf   = n < 30;

    // Recency: exponential decay with 21-day half-life
    const daysSince = clubShots[0]?.shot_time
      ? (Date.now() - new Date(clubShots[0].shot_time)) / 86400000 : 0;
    const recency = Math.max(0.5, Math.exp(-daysSince / 21));

    const faces   = clubShots.map(s=>s.face_angle).filter(x=>x!=null);
    const ftps    = clubShots.map(s=>s.face_to_path).filter(x=>x!=null);
    const carries = clubShots.map(s=>s.carry).filter(Boolean);
    const smashes = clubShots.map(s=>s.smash_factor).filter(Boolean);
    const attacks = clubShots.map(s=>s.attack_angle).filter(x=>x!=null);

    // Direction / face bias
    if (faces.length >= 10) {
      const avgFace = statAvg(faces);
      const avgFTP  = ftps.length ? statAvg(ftps) : null;
      if (avgFace != null && Math.abs(avgFace) > 2) {
        const badFacePct = faces.filter(f => Math.abs(f) > 2).length / faces.length;
        const sev = Math.min((Math.abs(avgFace) / 7) * 0.45 + badFacePct * 0.9, 1);
        const isOpen = avgFace > 0;
        const sliceBias = avgFTP != null && avgFTP > 3.5;
        const hookBias  = avgFTP != null && avgFTP < -3.5;
        const support = [
          `Face avg: ${fSign(avgFace,1)}°`,
          `Bad face: ${Math.round(badFacePct * 100)}%`,
          ftps.length ? `FTP: ${fSign(avgFTP,1)}°` : null,
        ].filter(Boolean).join(' · ');
        issues.push({
          key: `face_${ck}`, club: ck, clubName, type: 'direction',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * recency * (['9','pw','58','sw'].includes(ck) ? 1.2 : 1.0),
          simple: isOpen
            ? (sliceBias ? `${clubName} face is open — ball starts and curves right` : `${clubName} face is open — ball starting right`)
            : (hookBias  ? `${clubName} face is closed — ball starts and curves left` : `${clubName} face is closed — ball starting left`),
          support,
          deeper: isOpen
            ? `Face angle is what starts the ball's direction. Averaging ${fSign(avgFace,1)}° open means the ball launches right of target.${sliceBias ? ` Face-to-path of ${fSign(avgFTP,1)}° compounds it — the ball keeps curving right throughout the flight. This is the root cause, not the path.` : ''}`
            : `A closed face starts the ball left.${hookBias ? ` Face-to-path of ${fSign(avgFTP,1)}° adds curve to the left. Address grip and face awareness at impact first.` : ''}`,
          drill: isOpen
            ? 'Face control: half-swings, feel face neutral at impact (target -1° to +2°)'
            : 'Face control: check grip, practice feeling the face square through the ball',
          goal:  `Face avg inside ±2° · Start line tighter`,
          durationMin: 40,
        });
      }
    }

    // Iron attack angle
    if (['6','7','8','9','pw'].includes(ck) && attacks.length >= 8) {
      const avgAttack = statAvg(attacks);
      if (avgAttack != null && avgAttack > -2) {
        const sev = Math.min((avgAttack + 2) / 5, 1);
        issues.push({
          key: `attack_${ck}`, club: ck, clubName, type: 'contact',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 1.1 * recency,
          simple: `${clubName} — not hitting down enough, ball getting scooped`,
          support: `Attack angle: ${fSign(avgAttack,1)}° (needs to be below -2°)`,
          deeper: `Irons should strike with a descending blow. TrackMan defines negative attack angle as the club moving downward into the ball, compressing it properly. At ${fSign(avgAttack,1)}° you're scooping through impact — this produces inconsistent carry distances and weak ball flight.`,
          drill: 'Low-point drill: ball position back, hands forward, hit down and through',
          goal:  `Attack angle below -2° on 6+ of 10 shots`,
          durationMin: 40,
        });
      }
    }

    // Carry consistency
    if (carries.length >= 10) {
      const sdCarry = statStdDev(carries);
      const thresh  = ['pw','58','sw'].includes(ck) ? 8 : 14;
      if (sdCarry != null && sdCarry > thresh) {
        const sev = Math.min(sdCarry / (thresh * 1.8), 1);
        const med = statMedian(carries);
        issues.push({
          key: `consist_${ck}`, club: ck, clubName, type: 'consistency',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.85 * recency,
          simple: `${clubName} distance is unreliable — carry spread too wide`,
          support: `Median ${f(med,0)}m · spread ±${f(sdCarry,1)}m`,
          deeper: `Carry SD of ${f(sdCarry,1)}m (target below ${thresh}m) means your distances are unpredictable under pressure. The goal isn't hitting it further — it's knowing exactly how far you'll carry each shot so club selection isn't a guess.`,
          drill: 'Consistency block: 10 shots to one target, same swing pace each time',
          goal:  `Carry SD below ${thresh}m`,
          durationMin: 30,
        });
      }
    }

    // Smash factor (contact)
    if (smashes.length >= 8) {
      const avgSmash = statAvg(smashes);
      const target   = ck === 'driver' ? 1.42 : 1.28;
      if (avgSmash != null && avgSmash < target - 0.03) {
        const sev = Math.min((target - avgSmash) / 0.10, 1);
        issues.push({
          key: `smash_${ck}`, club: ck, clubName, type: 'contact',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.8 * recency,
          simple: `${clubName} contact is off-centre — energy transfer too low`,
          support: `Smash factor: ${f(avgSmash,2)} (target ${target}+)`,
          deeper: `Smash factor = ball speed ÷ club speed. At ${f(avgSmash,2)} you're losing energy to off-centre strikes. Every 0.05 smash improvement is roughly 5m more carry with the same swing — no extra effort required.`,
          drill: 'Strike drill: impact tape / tee-peg on ground, focus on centre strike',
          goal:  `Smash above ${target}`,
          durationMin: 35,
        });
      }
    }
  }

  // Short putt weakness
  if (puttSessions && puttSessions.length >= 2) {
    const sp    = puttSessions.filter(p => p.distance_m != null && p.distance_m <= 2);
    const holed = sp.reduce((a,b)=>a+(b.holed||0),0);
    const total = sp.reduce((a,b)=>a+(b.total||0),0);
    if (sp.length >= 2 && total > 0) {
      const makeRate = holed / total;
      if (makeRate < 0.75) {
        const sev = Math.min((0.85 - makeRate) * 3, 1);
        const pConf = Math.min(sp.length/5,1);
        issues.push({
          key: 'putting_short', club: 'putter', clubName: 'Putting', type: 'putting',
          n: total, conf: pConf, confLabel: _confLabel(pConf), lowConf: sp.length < 5,
          score: sev * pConf * 1.3,
          simple: `Short putts leaking strokes — ${Math.round(makeRate*100)}% make rate inside 2m`,
          support: `${holed}/${total} made · target is 80%+`,
          deeper: `Short putts inside 2m should be your highest conversion rate. Every miss drops a free stroke and puts pressure on your approach game. Gate drills build the consistent stroke needed to convert these under pressure.`,
          drill: 'Gate drill: 2 tees as gate, 20 pressure putts at 1m then 1.5m',
          goal:  '80%+ make rate inside 2m',
          durationMin: 25,
        });
      }
    }
  }

  return issues.sort((a,b) => b.score - a.score);
}

// ── Health tiles ──────────────────────────────────────────────────────────

function _buildHealthTiles(allShots, chipSessions, puttSessions) {
  const CA = window.clubAliases;
  const tiles = [];

  if (CA) {
    // Driver playable rate
    const ds = allShots.filter(s => CA.shotMatchesClub(s,'driver')).slice(0,30);
    const dSide = ds.filter(s => s.side != null);
    if (dSide.length >= 5) {
      const playable = dSide.filter(s => Math.abs(s.side) <= 20).length;
      const rate = Math.round(playable / dSide.length * 100);
      tiles.push({ label:'Tee shots', value:rate+'%', sub:'playable', cls: rate>=70?'good':rate>=50?'ok':'bad' });
    }

    // 7-iron carry SD
    const is = allShots.filter(s => CA.shotMatchesClub(s,'7')).slice(0,30);
    const iCarries = is.map(s=>s.carry).filter(Boolean);
    if (iCarries.length >= 5) {
      const sd  = statStdDev(iCarries);
      const med = statMedian(iCarries);
      tiles.push({ label:'7-iron', value:'±'+f(sd,0)+'m', sub:f(med,0)+'m median', cls: sd<8?'good':sd<14?'ok':'bad' });
    }
  }

  // Chipping inside 2m
  if (chipSessions && chipSessions.length >= 2) {
    const total = chipSessions.reduce((a,b)=>a+(b.attempts||0),0);
    const in2m  = chipSessions.reduce((a,b)=>a+(b.inside_1m||0)+(b.between_1_2m||0),0);
    if (total > 0) {
      const rate = Math.round(in2m/total*100);
      tiles.push({ label:'Chipping', value:rate+'%', sub:'inside 2m', cls: rate>=60?'good':rate>=40?'ok':'bad' });
    }
  }

  // Putting 1–2m make rate
  if (puttSessions && puttSessions.length >= 2) {
    const sp    = puttSessions.filter(p => p.distance_m != null && p.distance_m <= 2);
    const holed = sp.reduce((a,b)=>a+(b.holed||0),0);
    const total = sp.reduce((a,b)=>a+(b.total||0),0);
    if (sp.length >= 2 && total > 0) {
      const rate = Math.round(holed/total*100);
      tiles.push({ label:'Putting', value:rate+'%', sub:'1–2m made', cls: rate>=80?'good':rate>=65?'ok':'bad' });
    }
  }

  return tiles;
}

// ── Trend detection ───────────────────────────────────────────────────────

function _detectImprovement(allShots) {
  const CA = window.clubAliases;
  if (!CA) return null;
  let best = null;

  for (const ck of ['driver','7','6','9','pw','58']) {
    const cs = allShots.filter(s => CA.shotMatchesClub(s, ck));
    if (cs.length < 24) continue;

    const recent = cs.slice(0, 15);
    const prev   = cs.slice(15, 30);

    const rSD = statStdDev(recent.map(s=>s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s=>s.carry).filter(Boolean));
    if (rSD != null && pSD != null && pSD - rSD > 2) {
      const delta = pSD - rSD;
      if (!best || delta > best.delta) {
        best = { delta, text: `${CA.clubLabel(ck)} carry spread improved: ±${f(pSD,0)}m → ±${f(rSD,0)}m` };
      }
    }

    const rFaces = recent.map(s=>s.face_angle).filter(x=>x!=null);
    const pFaces = prev.map(s=>s.face_angle).filter(x=>x!=null);
    if (rFaces.length >= 6 && pFaces.length >= 6) {
      const rAbs = Math.abs(statAvg(rFaces)||0), pAbs = Math.abs(statAvg(pFaces)||0);
      const delta = pAbs - rAbs;
      if (delta > 0.8 && (!best || delta > best.delta * 0.6)) {
        best = { delta, text: `${CA.clubLabel(ck)} face angle improving: avg ${fSign(statAvg(pFaces),1)}° → ${fSign(statAvg(rFaces),1)}°` };
      }
    }
  }
  return best;
}

function _detectRegression(allShots) {
  const CA = window.clubAliases;
  if (!CA) return null;
  let worst = null;

  for (const ck of ['driver','7','6','9','pw','58']) {
    const cs = allShots.filter(s => CA.shotMatchesClub(s, ck));
    if (cs.length < 20) continue;

    const recent = cs.slice(0, 10);
    const prev   = cs.slice(10, 25);

    const rSD = statStdDev(recent.map(s=>s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s=>s.carry).filter(Boolean));
    if (rSD != null && pSD != null && rSD - pSD > 3) {
      const delta = rSD - pSD;
      if (!worst || delta > worst.delta) {
        worst = { delta, text: `${CA.clubLabel(ck)} carry spread widening: ±${f(pSD,0)}m → ±${f(rSD,0)}m` };
      }
    }
  }
  return worst;
}

// ── Render ────────────────────────────────────────────────────────────────

function _renderTodayContent(issues, health, improved, regression, shotCount, fixedIssues=[]) {
  const mainIssue = issues[0] || null;
  const watchItem = issues[1] || null;

  if (shotCount < 15 && health.length === 0) {
    return `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Start logging to get coaching</div>
        <div class="today-empty-text">After 15+ shots in the Trackman tab, you'll see your biggest issue and a personalised practice plan here.</div>
        <div class="today-quick-log-row" style="justify-content:center">
          <button class="today-log-btn" onclick="showPage('analysis')">Log Trackman</button>
          <button class="today-log-btn" onclick="showPage('stats')">Log short game</button>
        </div>
      </div>`;
  }

  const manualClubArg = mainIssue ? `'${mainIssue.club}'` : 'null';
  return `
    <div class="today-layer-toggle">
      <button class="today-layer-btn today-layer-coach active" onclick="toggleTodayLayer('coach')">Coach</button>
      <button class="today-layer-btn today-layer-stats" onclick="toggleTodayLayer('stats')">Stats</button>
    </div>
    <div class="today-coach-layer">
      ${_renderCoachSummaryCard(mainIssue, watchItem)}
      <div id="today-plan-section">
        ${mainIssue ? _renderTrainTodayCard(mainIssue) : ''}
      </div>
      <div class="today-section-label" style="margin-top:4px;">Quick log</div>
      <div class="today-quick-log-row" style="margin-bottom:20px;">
        <button class="today-log-btn" onclick="showPage('analysis')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Trackman
        </button>
        <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-chip-form')?.click(),350)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/></svg>
          Chipping
        </button>
        <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-putt-form')?.click(),350)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="12" r="2"/><path d="M19 12H7"/></svg>
          Putting
        </button>
        <button class="today-log-btn" onclick="openManualLogPanel(${manualClubArg})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Manual
        </button>
      </div>
      ${_renderWhatImprovedCard(improved, fixedIssues)}
      ${health.length ? _renderHealthTiles(health) : ''}
      ${mainIssue ? _renderMainIssueCard(mainIssue) : _renderNoIssueCard()}
      ${_renderDrillHistoryCard()}
    </div>
    <div class="today-stats-layer">
      ${mainIssue ? _renderShotPatternCard(mainIssue) : ''}
      ${mainIssue ? _renderStatsProgressCard(mainIssue) : ''}
      ${mainIssue ? _renderTrendCard(mainIssue) : ''}
      ${_renderClubPicker(mainIssue?.club || null)}
      ${regression ? _renderRegressionCard(regression) : ''}
      ${watchItem ? _renderWatchCard(watchItem) : ''}
      <div class="today-drill-library-row">
        <button class="today-drill-library-btn" onclick="openGlossaryLibrary()">Open lexikon →</button>
      </div>
      <div class="today-drill-library-row">
        <button class="today-drill-library-btn" onclick="openDrillCatalog('${mainIssue ? _issueToDrillCategory(mainIssue) : ''}')">Browse drill library →</button>
      </div>
    </div>`;
}

function _renderHealthTiles(tiles) {
  return `
    <div class="today-section-label">Game Health</div>
    <div class="today-health-tiles">
      ${tiles.map(t=>`
        <div class="today-health-tile today-health-${t.cls}">
          <div class="today-health-value">${escapeHtml(t.value)}</div>
          <div class="today-health-label">${escapeHtml(t.label)}</div>
          <div class="today-health-sub">${escapeHtml(t.sub)}</div>
        </div>`).join('')}
    </div>`;
}

function _renderMainIssueCard(issue) {
  const confCls = issue.conf < 0.4 ? 'hint' : issue.conf < 0.7 ? 'likely' : 'confirmed';
  const detailId = `issue-detail-${issue.key.replace(/[^a-z0-9]/g,'_')}`;
  return `
    <div class="today-issue-card">
      <div class="today-issue-meta">
        <div class="today-issue-tag">Main issue</div>
        ${issue.confLabel ? `<div class="today-issue-conf today-issue-conf-${confCls}">${issue.confLabel}${issue.n ? ' · '+issue.n+' shots' : ''}</div>` : ''}
      </div>
      <div class="today-issue-title">${escapeHtml(issue.simple)}</div>
      <div class="today-issue-support">${escapeHtml(issue.support)}</div>
      <div class="today-issue-action-row">
        ${issue.deeper ? `<button class="today-issue-detail-btn" onclick="toggleIssueDetail('${detailId}', this)">Why this? ▾</button>` : ''}
        <button class="today-issue-stats-btn" onclick="toggleTodayLayer('stats')">View stats →</button>
      </div>
      ${issue.deeper ? `<div class="today-issue-detail" id="${detailId}">${escapeHtml(issue.deeper)}</div>` : ''}
    </div>`;
}

function _renderNoIssueCard() {
  return `
    <div class="today-issue-card today-issue-good">
      <div class="today-issue-tag">Looking good</div>
      <div class="today-issue-title">No strong issue detected from recent shots</div>
      <div class="today-issue-support">Keep logging to build your baseline</div>
    </div>`;
}

let _todayActivePlanIssue = null;

function _renderTrainTodayCard(issue) {
  _todayActivePlanIssue = issue;
  const dur    = issue.durationMin || 40;
  const short  = Math.max(dur - 15, 20);
  const phase  = _detectPracticePhase(issue);
  const blocks = _buildPlanBlocks(issue, dur, phase);
  const phaseLabel = phase === 'transfer' ? 'Transfer' : 'Technical';

  return `
    <div class="today-plan-card">
      <div class="today-plan-header">
        <div>
          <div class="today-plan-label">Train today · <span class="today-plan-phase-badge today-plan-phase-${phase}">${phaseLabel}</span></div>
          <div class="today-plan-title">${escapeHtml(issue.clubName)} · ${dur} min</div>
        </div>
        <div class="today-plan-duration">${dur}<span>min</span></div>
      </div>
      <div class="today-plan-goal">${escapeHtml(issue.goal)}</div>
      <div class="today-plan-blocks">
        ${blocks.map(b=>`
          <div class="today-plan-block">
            <div class="today-plan-block-time">${b.time}</div>
            <div class="today-plan-block-body">
              <div class="today-plan-block-name">${escapeHtml(b.name)}</div>
              <div class="today-plan-block-desc">${escapeHtml(b.desc)}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="today-plan-cta-row">
        <button class="today-plan-start-btn" onclick="showPage('analysis')">Start on Trackman tab →</button>
        <button class="today-plan-short-btn" onclick="shrinkTodayPlan(${short})">Make it ${short} min</button>
      </div>
    </div>
    <div class="today-review-trigger" id="today-review-trigger">
      <button onclick="openSessionReview()">Log session result →</button>
    </div>`;
}

function _buildPlanBlocks(issue, dur, phase = 'technical') {
  const isTransfer = phase === 'transfer';
  const warmup   = 5;
  const drill    = Math.round((dur - 15) * (isTransfer ? 0.30 : 0.55));
  const transfer = Math.round((dur - 15) * (isTransfer ? 0.50 : 0.30));
  const pressure = dur - warmup - drill - transfer;
  let t = 0;
  const bl = (name, min, desc) => {
    const b = { name, time: `${t}–${t+min} min`, desc };
    t += min;
    return b;
  };
  const goalFocus = (issue.goal || '').split('·')[0].trim().toLowerCase() || issue.goal;
  if (isTransfer) {
    return [
      bl('Warm-up',  warmup,   '9-iron and 7-iron. Loosen up, no pressure.'),
      bl('Drill',    drill,    `${issue.drill} — blocked sets of 5.`),
      bl('Transfer', transfer, `Normal routine every shot. Vary targets. Focus: ${goalFocus}.`),
      bl('Pressure', pressure, '10-ball test. Full routine each shot. Log the final result.'),
    ];
  }
  return [
    bl('Warm-up',  warmup,   '9-iron and 7-iron. Loosen up, no pressure.'),
    bl('Drill',    drill,    issue.drill),
    bl('Transfer', transfer, `Pick one target. Normal routine. Focus: ${goalFocus}.`),
    bl('Pressure', pressure, '10-ball test. No swing thoughts. Log the final result.'),
  ];
}


function _renderWatchCard(issue) {
  return `
    <div class="today-watch-card">
      <div class="today-watch-label">Also keep an eye on</div>
      <div class="today-watch-text">${escapeHtml(issue.simple)}</div>
      <div class="today-watch-support">${escapeHtml(issue.support)}</div>
    </div>`;
}

function _renderClubPicker(activeCk) {
  const btns = PICKER_CLUBS.map(({ ck, label }) =>
    `<button class="today-club-btn${ck === activeCk ? ' on' : ''}" data-club="${ck}" onclick="selectTodayClub('${ck}')">${label}</button>`
  ).join('');
  return `
    <div class="today-section-label" style="margin-top:4px">Focus on a club</div>
    <div class="today-club-picker">${btns}</div>`;
}

function selectTodayClub(ck) {
  // Update button active state
  document.querySelectorAll('.today-club-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.club === ck);
  });

  // Find detected issue for this club, or build a generic plan
  const issue = _todayIssues.find(i => i.club === ck) || _buildGenericPlan(ck, _todayAllShots);

  const section = document.getElementById('today-plan-section');
  if (section) section.innerHTML = _renderTrainTodayCard(issue);
}

function _buildGenericPlan(ck, allShots) {
  const CA = window.clubAliases;
  const clubName = CA ? CA.clubLabel(ck) : ck;
  const shots = CA ? allShots.filter(s => CA.shotMatchesClub(s, ck)).slice(0, 30) : [];
  const carries = shots.map(s => s.carry).filter(Boolean);
  const med = statMedian(carries);
  const sd  = statStdDev(carries);

  const isWedge  = ['pw','58','sw'].includes(ck);
  const isDriver = ck === 'driver';
  const isPutter = ck === 'putter';

  let drill, goal;
  if (isPutter) {
    drill = 'Gate drill: 2 tees as gate, 20 pressure putts from 1–2m';
    goal  = '80%+ make rate inside 2m';
  } else if (isWedge) {
    const t1 = med ? Math.round(med * 0.7) : 25;
    const t2 = med ? Math.round(med)        : 35;
    const t3 = med ? Math.round(med * 1.25) : 45;
    drill = `Distance ladder: 10 balls each to ${t1}m, ${t2}m, ${t3}m — score only balls inside ±5m window`;
    goal  = 'Carry SD below 8m · Window hit rate 40%+';
  } else if (isDriver) {
    drill = 'Fairway width drill: pick a realistic corridor, aim for playable start line — ignore carry';
    goal  = 'Playable shots (side ≤ 20m) 70%+';
  } else {
    const target = med ? Math.round(med) : '—';
    drill = `Target carry block: 10 shots to ${target}m, consistent swing pace, note misses`;
    goal  = sd ? `Carry SD below ${Math.round(Math.max(sd * 0.8, 6))}m` : 'Tight and repeatable';
  }

  return {
    key: `manual_${ck}`, club: ck, clubName, type: 'manual',
    score: 0,
    simple: `${clubName} focused session`,
    support: carries.length ? `Last ${carries.length} shots · Median ${f(med,0)}m · ±${f(sd,1)}m` : 'No recent Trackman data for this club',
    drill,
    goal,
    durationMin: isPutter || isWedge ? 30 : 40,
  };
}

// ── Issue detail toggle ───────────────────────────────────────────────────

function toggleIssueDetail(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.classList.toggle('open');
  if (btn) btn.textContent = open ? 'Hide detail ▴' : 'Why this issue? ▾';
}

// ── Shrink plan ───────────────────────────────────────────────────────────

function shrinkTodayPlan(shortDur) {
  const issue = _todayActivePlanIssue;
  if (!issue) return;
  const section = document.getElementById('today-plan-section');
  if (!section) return;
  section.innerHTML = _renderTrainTodayCard({...issue, durationMin: shortDur});
}

// ── Session review ────────────────────────────────────────────────────────

function openSessionReview() {
  const trigger = document.getElementById('today-review-trigger');
  if (!trigger) return;
  const issue = _todayActivePlanIssue;
  const goal = issue?.goal || 'Hit your target';
  trigger.innerHTML = `
    <div class="today-review-form">
      <div class="today-review-form-title">How did today's session go?</div>
      <div class="today-review-goal">Goal: ${escapeHtml(goal)}</div>
      <div class="today-review-options">
        <button class="today-review-opt" data-result="hit"    onclick="selectReviewResult(this)">✓ Hit target</button>
        <button class="today-review-opt" data-result="close"  onclick="selectReviewResult(this)">~ Close</button>
        <button class="today-review-opt" data-result="miss"   onclick="selectReviewResult(this)">✗ Not yet</button>
      </div>
      <textarea class="today-review-note" id="today-review-note" placeholder="Optional note…" rows="2"></textarea>
      <button class="today-review-submit" onclick="submitSessionReview()">Save result</button>
    </div>`;
}

function selectReviewResult(btn) {
  document.querySelectorAll('.today-review-opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function submitSessionReview() {
  const resultBtn = document.querySelector('.today-review-opt.selected');
  if (!resultBtn) { showToast('Pick a result first'); return; }
  const result = resultBtn.dataset.result;
  const note   = document.getElementById('today-review-note')?.value?.trim() || '';
  const issue  = _todayActivePlanIssue;
  const today10 = new Date().toISOString().slice(0,10);

  try {
    const reviews = JSON.parse(localStorage.getItem('today_reviews')||'[]');
    reviews.unshift({ date:today10, issueKey:issue?.key, issueSimple:issue?.simple, goal:issue?.goal, result, note });
    localStorage.setItem('today_reviews', JSON.stringify(reviews.slice(0,20)));
  } catch(e) {}

  const icon  = result==='hit' ? '✓' : result==='close' ? '~' : '✗';
  const cls   = result==='hit' ? 'good' : result==='close' ? 'ok' : 'warn';
  const label = result==='hit' ? 'Hit target' : result==='close' ? 'Getting close' : 'Not yet — keep at it';
  const trigger = document.getElementById('today-review-trigger');
  if (trigger) trigger.innerHTML = `
    <div class="today-review-result today-review-result-${cls}">
      <span class="today-review-result-icon">${icon}</span>
      <div>
        <div class="today-review-result-label">${label}</div>
        ${note ? `<div class="today-review-result-note">${escapeHtml(note)}</div>` : ''}
      </div>
    </div>`;
}


// ── Regression card ───────────────────────────────────────────────────────

function _renderRegressionCard(regression) {
  if (!regression) return '';
  return `
    <div class="today-regression-card">
      <div class="today-regression-label">Watch this</div>
      <div class="today-regression-text">${escapeHtml(regression.text)}</div>
    </div>`;
}

// ── Practice phase detection ──────────────────────────────────────────────

function _detectPracticePhase(issue) {
  if (!issue || !_todayAllShots || _todayAllShots.length < 20) return 'technical';
  const CA = window.clubAliases;
  if (!CA) return 'technical';

  const clubShots = _todayAllShots.filter(s => CA.shotMatchesClub(s, issue.club));
  if (clubShots.length < 20) return 'technical';

  const recent = clubShots.slice(0, 10);
  const prev   = clubShots.slice(10, 20);

  if (issue.type === 'direction') {
    const rFaces = recent.map(s => s.face_angle).filter(x => x != null);
    const pFaces = prev.map(s => s.face_angle).filter(x => x != null);
    if (rFaces.length >= 5 && pFaces.length >= 5) {
      const rAbs = Math.abs(statAvg(rFaces) || 0);
      const pAbs = Math.abs(statAvg(pFaces) || 0);
      if (pAbs - rAbs > 0.8) return 'transfer';
    }
  } else if (issue.type === 'consistency') {
    const rSD = statStdDev(recent.map(s => s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s => s.carry).filter(Boolean));
    if (rSD != null && pSD != null && pSD - rSD > 2) return 'transfer';
  } else if (issue.type === 'contact') {
    const rSmash = statAvg(recent.map(s => s.smash_factor).filter(Boolean));
    const pSmash = statAvg(prev.map(s => s.smash_factor).filter(Boolean));
    if (rSmash != null && pSmash != null && rSmash - pSmash > 0.02) return 'transfer';
  }

  return 'technical';
}

// ── Coach summary card (Feature 3) ───────────────────────────────────────

function _renderCoachSummaryCard(mainIssue, watchItem) {
  const phase      = mainIssue ? _detectPracticePhase(mainIssue) : null;
  const isTransfer = phase === 'transfer';

  if (!mainIssue) {
    return `
      <div class="today-coach-card today-coach-good">
        <div class="today-coach-eyebrow">Coach</div>
        <div class="today-coach-headline">Looking solid right now</div>
        <div class="today-coach-body">No major issue stands out from your recent shots. Keep logging to build a clearer picture — consistency improvements will show here first.</div>
      </div>`;
  }

  const phaseLabel = isTransfer ? 'Transfer phase' : 'Technical phase';
  const phaseDesc  = isTransfer
    ? 'You\'re improving — take this to normal play conditions. Use your routine, vary targets.'
    : 'Repetition first. Drill it before taking it to targets.';

  const ignoreText = watchItem
    ? watchItem.simple.split('—')[0].replace(/[—–]/g, '').trim()
    : null;

  const confCls = mainIssue.conf < 0.4 ? 'hint' : mainIssue.conf < 0.7 ? 'likely' : 'confirmed';
  return `
    <div class="today-coach-card">
      <div class="today-coach-top-row">
        <div class="today-coach-eyebrow-group">
          <div class="today-coach-eyebrow">Coach</div>
          ${mainIssue.confLabel ? `<span class="today-coach-conf today-coach-conf-${confCls}">${mainIssue.confLabel}${mainIssue.n ? ' · ' + mainIssue.n + ' shots' : ''}</span>` : ''}
        </div>
        <button class="today-coach-practice-btn" onclick="openPrePracticeMode()">Practice mode →</button>
      </div>
      ${mainIssue.lowConf ? `<div class="today-coach-lowconf">Log more shots to strengthen this signal</div>` : ''}
      <div class="today-coach-headline">${escapeHtml(mainIssue.simple)}</div>
      <div class="today-coach-body">${escapeHtml(mainIssue.deeper || 'Work on this before anything else.')}</div>
      <div class="today-coach-divider"></div>
      <div class="today-coach-phase-row">
        <span class="today-coach-phase-badge today-coach-phase-${isTransfer ? 'transfer' : 'technical'}">${phaseLabel}</span>
        <span class="today-coach-phase-desc">${escapeHtml(phaseDesc)}</span>
      </div>
      ${ignoreText ? `<div class="today-coach-ignore">Set aside for now: <em>${escapeHtml(ignoreText)}</em></div>` : ''}
    </div>`;
}

// ── What improved card (Feature 10) ──────────────────────────────────────

function _buildImprovedMessage(rawText) {
  const spreadMatch = rawText.match(/(\S+) carry spread improved.*?±(\d+)m.*?±(\d+)m/);
  if (spreadMatch) {
    return `${spreadMatch[1]} distances are getting more reliable — spread dropped from ±${spreadMatch[2]}m to ±${spreadMatch[3]}m. More consistent carry means more confident club selection.`;
  }
  if (rawText.includes('carry spread')) {
    return 'Carry distances are getting more consistent. That\'s a real improvement under pressure.';
  }
  if (rawText.includes('face angle')) {
    return 'Start line is tightening up — the ball is launching closer to your target more often. Face control is clicking.';
  }
  return rawText;
}

function _renderWhatImprovedCard(improved, fixedIssues) {
  const hasFixed = fixedIssues && fixedIssues.length > 0;
  if (!improved && !hasFixed) return '';

  if (hasFixed) {
    return `
      <div class="today-improved-card">
        <div class="today-improved-icon">🎯</div>
        <div class="today-improved-content">
          <div class="today-improved-label">Fixed!</div>
          <div class="today-improved-headline">${escapeHtml(fixedIssues[0].simple)} is no longer your main issue.</div>
          <div class="today-improved-sub">Keep it going — shift focus to what's next.</div>
        </div>
      </div>`;
  }

  const msg = _buildImprovedMessage(improved.text);
  return `
    <div class="today-improved-card">
      <div class="today-improved-icon">↑</div>
      <div class="today-improved-content">
        <div class="today-improved-label">Getting better</div>
        <div class="today-improved-headline">${escapeHtml(msg)}</div>
        <div class="today-improved-raw">${escapeHtml(improved.text)}</div>
      </div>
    </div>`;
}

// ── Pre-practice mode (Feature 5) ────────────────────────────────────────

function openPrePracticeMode() {
  const issue = _todayActivePlanIssue;
  if (!issue) { showToast('Open a practice plan below first'); return; }

  const overlay = document.getElementById('prepractice-overlay');
  if (!overlay) return;

  const phase      = _detectPracticePhase(issue);
  const isTransfer = phase === 'transfer';
  const drillText  = isTransfer
    ? `${issue.drill} — vary targets each rep, use your full routine.`
    : issue.drill;

  overlay.innerHTML = `
    <div class="prepractice-panel">
      <div class="prepractice-topbar">
        <button class="prepractice-back-btn" onclick="closePrePracticeMode()">← Today</button>
        <div class="prepractice-topbar-label">Practice mode</div>
      </div>
      <div class="prepractice-body">
        <div class="prepractice-eyebrow">Today's focus</div>
        <div class="prepractice-headline">${escapeHtml(issue.simple)}</div>

        <div class="prepractice-block">
          <div class="prepractice-block-label">Your drill</div>
          <div class="prepractice-block-text">${escapeHtml(drillText)}</div>
        </div>

        <div class="prepractice-block">
          <div class="prepractice-block-label">Done when</div>
          <div class="prepractice-block-text prepractice-goal">${escapeHtml(issue.goal)}</div>
        </div>

        ${isTransfer ? `<div class="prepractice-phase-note">Transfer phase — normal routine every shot, vary targets</div>` : ''}

        <button class="prepractice-start-btn" onclick="showPage('analysis');closePrePracticeMode()">Open Trackman tab →</button>
      </div>
      <div class="prepractice-footer">
        <button class="prepractice-log-btn" onclick="closePrePracticeMode();setTimeout(openSessionReview,150)">Done — log session result</button>
      </div>
    </div>`;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePrePracticeMode() {
  const overlay = document.getElementById('prepractice-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Shot pattern card (Feature 7) ─────────────────────────────────────────

function _renderShotPatternCard(mainIssue) {
  if (!mainIssue || mainIssue.type === 'putting') return '';
  const CA = window.clubAliases;
  if (!CA) return '';

  const clubShots = _todayAllShots
    .filter(s => CA.shotMatchesClub(s, mainIssue.club))
    .slice(0, 20);

  if (mainIssue.type === 'direction' || mainIssue.type === 'contact') {
    const faces = clubShots.map(s => s.face_angle).filter(x => x != null);
    if (faces.length < 5) return '';

    const left   = faces.filter(f => f < -1.5).length;
    const center = faces.filter(f => Math.abs(f) <= 1.5).length;
    const right  = faces.filter(f => f > 1.5).length;
    const total  = faces.length;
    const lPct   = Math.round(left   / total * 100);
    const cPct   = Math.round(center / total * 100);
    const rPct   = Math.round(right  / total * 100);
    const avgF   = statAvg(faces);
    const sdF    = statStdDev(faces);
    const goodPct = cPct;

    return `
      <div class="today-pattern-card">
        <div class="today-pattern-header">
          <span class="today-pattern-label">Face pattern · ${escapeHtml(mainIssue.clubName)}</span>
          <span class="today-pattern-n">${total} shots</span>
        </div>
        <div class="today-pattern-strip">
          <div class="today-pattern-zone today-pattern-left" style="flex:${Math.max(lPct,5)}">
            <span class="today-pattern-zone-label">Left</span>
            <span class="today-pattern-zone-pct">${lPct}%</span>
          </div>
          <div class="today-pattern-zone today-pattern-center" style="flex:${Math.max(cPct,5)}">
            <span class="today-pattern-zone-label">Square</span>
            <span class="today-pattern-zone-pct">${cPct}%</span>
          </div>
          <div class="today-pattern-zone today-pattern-right" style="flex:${Math.max(rPct,5)}">
            <span class="today-pattern-zone-label">Right</span>
            <span class="today-pattern-zone-pct">${rPct}%</span>
          </div>
        </div>
        <div class="today-pattern-stats">
          <span>Avg face ${fSign(avgF,1)}°</span>
          <span>·</span>
          <span>SD ±${f(sdF,1)}°</span>
          <span>·</span>
          <span class="${goodPct>=50?'today-pattern-good':goodPct>=30?'today-pattern-ok':'today-pattern-bad'}">${goodPct}% square</span>
          <button class="gloss-btn" onclick="showGlossaryTip('face_angle')">?</button>
        </div>
      </div>`;
  }

  if (mainIssue.type === 'consistency') {
    const carries = clubShots.map(s => s.carry).filter(Boolean);
    if (carries.length < 5) return '';

    const med   = statMedian(carries);
    const sd    = statStdDev(carries);
    const tgt   = ['pw','58','sw'].includes(mainIssue.club) ? 8 : 14;
    const tight = carries.filter(c => Math.abs(c - med) <= tgt / 2).length;
    const pct   = Math.round(tight / carries.length * 100);

    return `
      <div class="today-pattern-card">
        <div class="today-pattern-header">
          <span class="today-pattern-label">Distance spread · ${escapeHtml(mainIssue.clubName)}</span>
          <span class="today-pattern-n">${carries.length} shots</span>
        </div>
        <div class="today-pattern-carry-row">
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val">${f(med,0)}m</div>
            <div class="today-pattern-carry-lbl">median carry</div>
          </div>
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val today-pattern-${sd>tgt?'bad':'good'}">±${f(sd,0)}m</div>
            <div class="today-pattern-carry-lbl">spread (target &lt;${tgt}m)</div>
          </div>
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val today-pattern-${pct>=60?'good':pct>=40?'ok':'bad'}">${pct}%</div>
            <div class="today-pattern-carry-lbl">within ±${Math.round(tgt/2)}m</div>
          </div>
        </div>
      </div>`;
  }

  return '';
}

// ── Stats progress card (Feature 2) ──────────────────────────────────────

function _renderStatsProgressCard(mainIssue) {
  if (!mainIssue || mainIssue.type === 'putting') return '';
  const CA = window.clubAliases;
  if (!CA) return '';

  const clubShots = _todayAllShots.filter(s => CA.shotMatchesClub(s, mainIssue.club));
  if (clubShots.length < 20) return '';

  const recent = clubShots.slice(0, 10);
  const prev   = clubShots.slice(10, 20);
  const tiles  = [];

  if (mainIssue.type === 'direction') {
    const rF = recent.map(s => s.face_angle).filter(x => x != null);
    const pF = prev.map(s => s.face_angle).filter(x => x != null);
    if (rF.length < 4) return '';

    const rAvg = statAvg(rF);
    const pAvg = pF.length >= 4 ? statAvg(pF) : null;
    const rSD  = statStdDev(rF);
    const pSD  = pF.length >= 4 ? statStdDev(pF) : null;
    const goodPct = Math.round(rF.filter(f => Math.abs(f) <= 2).length / rF.length * 100);
    const prevGP  = pF.length >= 4 ? Math.round(pF.filter(f => Math.abs(f) <= 2).length / pF.length * 100) : null;
    const improving = pAvg != null && Math.abs(rAvg) < Math.abs(pAvg) - 0.3;

    tiles.push({
      value: fSign(rAvg, 1) + '°',
      label: 'face avg', gloss: 'face_angle',
      trend: pAvg != null ? (improving ? `↑ from ${fSign(pAvg,1)}°` : `was ${fSign(pAvg,1)}°`) : null,
      good: Math.abs(rAvg) <= 2,
    });
    tiles.push({
      value: '±' + f(rSD, 1) + '°',
      label: 'spread', gloss: 'spread',
      trend: pSD != null ? (rSD < pSD - 0.2 ? '↑ tighter' : `was ±${f(pSD,1)}°`) : null,
      good: rSD < 2.5,
    });
    tiles.push({
      value: goodPct + '%',
      label: 'square',
      trend: prevGP != null && goodPct > prevGP + 3 ? `↑ from ${prevGP}%` : null,
      good: goodPct >= 40,
    });

  } else if (mainIssue.type === 'contact') {
    const rS = recent.map(s => s.smash_factor).filter(Boolean);
    const pS = prev.map(s => s.smash_factor).filter(Boolean);
    if (rS.length < 4) return '';

    const rAvg  = statAvg(rS);
    const pAvg  = pS.length >= 4 ? statAvg(pS) : null;
    const target = mainIssue.club === 'driver' ? 1.42 : 1.28;
    const goodPct = Math.round(rS.filter(s => s >= target - 0.02).length / rS.length * 100);

    tiles.push({
      value: f(rAvg, 2),
      label: 'smash avg', gloss: 'smash_factor',
      trend: pAvg != null ? (rAvg > pAvg + 0.01 ? `↑ from ${f(pAvg,2)}` : `was ${f(pAvg,2)}`) : null,
      good: rAvg >= target - 0.03,
    });
    tiles.push({ value: goodPct + '%', label: 'good hits', trend: null, good: goodPct >= 50 });
    tiles.push({ value: f(target, 2), label: 'target smash', gloss: 'smash_factor', trend: null, good: rAvg >= target });

  } else if (mainIssue.type === 'consistency') {
    const rC = recent.map(s => s.carry).filter(Boolean);
    const pC = prev.map(s => s.carry).filter(Boolean);
    if (rC.length < 4) return '';

    const rSD  = statStdDev(rC);
    const pSD  = pC.length >= 4 ? statStdDev(pC) : null;
    const rMed = statMedian(rC);
    const tgt  = ['pw','58','sw'].includes(mainIssue.club) ? 8 : 14;
    const goodPct = Math.round(rC.filter(c => Math.abs(c - rMed) <= tgt * 0.6).length / rC.length * 100);

    tiles.push({ value: f(rMed, 0) + 'm', label: 'median carry', gloss: 'carry', trend: null, good: true });
    tiles.push({
      value: '±' + f(rSD, 0) + 'm',
      label: 'spread', gloss: 'spread',
      trend: pSD != null ? (rSD < pSD - 1 ? `↑ from ±${f(pSD,0)}m` : `was ±${f(pSD,0)}m`) : null,
      good: rSD < tgt,
    });
    tiles.push({ value: goodPct + '%', label: 'within range', trend: null, good: goodPct >= 50 });
  }

  if (!tiles.length) return '';

  return `
    <div class="today-stats-card">
      <div class="today-stats-label">Your numbers · ${escapeHtml(mainIssue.clubName)} · last 10 shots</div>
      <div class="today-stats-tiles">
        ${tiles.map(t => `
          <div class="today-stat-tile">
            <div class="today-stat-value ${t.good ? 'today-stat-green' : 'today-stat-amber'}">${escapeHtml(t.value)}</div>
            ${t.trend ? `<div class="today-stat-trend ${t.good ? 'today-stat-trend-good' : ''}">${escapeHtml(t.trend)}</div>` : ''}
            <div class="today-stat-name">${escapeHtml(t.label)}${t.gloss ? `<button class="gloss-btn" onclick="showGlossaryTip('${t.gloss}')">?</button>` : ''}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Manual shot log (Feature 9) ───────────────────────────────────────────

let _manualLogState = { club: null, face: null, contact: null };

function _mergeManualShots(trackmanShots) {
  try {
    const manual  = JSON.parse(localStorage.getItem('manual_shots') || '[]');
    const cutoff  = new Date(Date.now() - 14 * 86400000).toISOString();
    const recent  = manual.filter(m => m.ts >= cutoff);
    const faceMap  = { open: 3.5, closed: -3.5, square: 0 };
    const smashMap = { pure: 1.38, ok: 1.25, miss: 1.10 };
    const synthetic = recent.map(m => ({
      club: m.club,
      face_angle:   faceMap[m.face]    ?? 0,
      smash_factor: smashMap[m.contact] ?? 1.20,
      carry: null, side: null, attack_angle: null,
      launch_angle: null, spin_rate: null, ball_speed: null,
      club_path: null, face_to_path: null,
      is_full_shot: true, exclude_from_progress: false,
      shot_time: m.ts, _isManual: true,
    }));
    return [...trackmanShots, ...synthetic];
  } catch(e) {
    return trackmanShots;
  }
}

function openManualLogPanel(prefillClub) {
  _manualLogState = { club: prefillClub || null, face: null, contact: null };
  const overlay = document.getElementById('manual-log-overlay');
  if (!overlay) return;

  const clubBtns = PICKER_CLUBS.map(({ ck, label }) =>
    `<button class="manual-log-club-btn${ck === _manualLogState.club ? ' on' : ''}" data-ck="${ck}" onclick="selectManualClub('${ck}')">${label}</button>`
  ).join('');

  overlay.innerHTML = `
    <div class="manual-log-backdrop" onclick="closeManualLogPanel()"></div>
    <div class="manual-log-sheet">
      <div class="manual-log-header">
        <div class="manual-log-title">Log a shot</div>
        <button class="manual-log-close" onclick="closeManualLogPanel()">✕</button>
      </div>
      <div class="manual-log-body">
        <div class="manual-log-section-label">Club</div>
        <div class="manual-log-club-row" id="manual-log-clubs">${clubBtns}</div>

        <div class="manual-log-section-label">Face at impact</div>
        <div class="manual-log-opts" id="manual-log-face-opts">
          <button class="manual-log-opt" data-val="closed" onclick="selectManualOpt(this,'face')">← Closed</button>
          <button class="manual-log-opt" data-val="square" onclick="selectManualOpt(this,'face')">Square ✓</button>
          <button class="manual-log-opt" data-val="open"   onclick="selectManualOpt(this,'face')">Open →</button>
        </div>

        <div class="manual-log-section-label">Contact quality</div>
        <div class="manual-log-opts" id="manual-log-contact-opts">
          <button class="manual-log-opt" data-val="pure" onclick="selectManualOpt(this,'contact')">Pure</button>
          <button class="manual-log-opt" data-val="ok"   onclick="selectManualOpt(this,'contact')">OK</button>
          <button class="manual-log-opt" data-val="miss" onclick="selectManualOpt(this,'contact')">Thin / Fat</button>
        </div>

        <button class="manual-log-save-btn" onclick="submitManualLog()">Save shot</button>
        <div class="manual-log-hint">Manual shots supplement TrackMan data when sessions are short.</div>
      </div>
    </div>`;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeManualLogPanel() {
  const overlay = document.getElementById('manual-log-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function selectManualClub(ck) {
  _manualLogState.club = ck;
  document.querySelectorAll('.manual-log-club-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.ck === ck)
  );
}

function selectManualOpt(btn, field) {
  _manualLogState[field] = btn.dataset.val;
  btn.closest('.manual-log-opts')?.querySelectorAll('.manual-log-opt')
    .forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function submitManualLog() {
  if (!_manualLogState.club)  { showToast('Pick a club first');     return; }
  if (!_manualLogState.face)  { showToast('Pick face direction');   return; }
  try {
    const shots = JSON.parse(localStorage.getItem('manual_shots') || '[]');
    shots.unshift({ club: _manualLogState.club, face: _manualLogState.face, contact: _manualLogState.contact || 'ok', ts: new Date().toISOString() });
    localStorage.setItem('manual_shots', JSON.stringify(shots.slice(0, 100)));
  } catch(e) {}
  closeManualLogPanel();
  showToast('Shot logged ✓');
}

// ── Drill history card (Feature 4) ────────────────────────────────────────

function _renderDrillHistoryCard() {
  let reviews;
  try { reviews = JSON.parse(localStorage.getItem('today_reviews') || '[]'); } catch(e) { return ''; }
  if (reviews.length < 2) return '';

  const recent = reviews.slice(0, 15);

  // Aggregate per drill key
  const drillMap = {};
  for (const r of recent) {
    const k = r.issueKey || '_';
    if (!drillMap[k]) drillMap[k] = {
      label: (r.issueSimple || 'Session').split('—')[0].trim().slice(0, 38),
      hit: 0, close: 0, miss: 0, n: 0,
    };
    drillMap[k].n++;
    drillMap[k][r.result === 'hit' ? 'hit' : r.result === 'close' ? 'close' : 'miss']++;
  }

  const drills = Object.values(drillMap).filter(d => d.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);

  const drillRowsHtml = drills.map(d => {
    const hitPct = Math.round(d.hit / d.n * 100);
    const cls = hitPct >= 60 ? 'today-stat-green' : 'today-stat-amber';
    return `
      <div class="today-drill-agg-row">
        <div class="today-drill-agg-label">${escapeHtml(d.label)}</div>
        <div class="today-drill-agg-right">
          <span class="today-drill-agg-pct ${cls}">${hitPct}%</span>
          <span class="today-drill-agg-n">${d.n} sessions</span>
        </div>
      </div>`;
  }).join('');

  const recentHtml = recent.slice(0, 5).map(r => {
    const icon = r.result === 'hit' ? '✓' : r.result === 'close' ? '~' : '✗';
    const label = (r.issueSimple || 'Session').split('—')[0].trim().slice(0, 32);
    return `
      <div class="today-drill-row">
        <span class="today-drill-icon today-drill-${r.result}">${icon}</span>
        <span class="today-drill-name">${escapeHtml(label)}</span>
        <span class="today-drill-date">${r.date ? escapeHtml(r.date.slice(5)) : ''}</span>
      </div>`;
  }).join('');

  return `
    <div class="today-drill-card">
      <div class="today-section-label" style="margin-bottom:8px;">Drill history</div>
      ${drillRowsHtml}
      ${drills.length ? '<div class="today-drill-sep"></div>' : ''}
      ${recentHtml}
    </div>`;
}

// ── Coach / Stats layer toggle ────────────────────────────────────────────

function toggleTodayLayer(mode) {
  const wrap = document.getElementById('today-content');
  if (!wrap) return;
  const isStats = mode === 'stats';
  wrap.classList.toggle('today-mode-stats', isStats);
  wrap.querySelectorAll('.today-layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.classList.contains('today-layer-' + mode));
  });
  if (isStats) requestAnimationFrame(() => requestAnimationFrame(() => _drawTodayTrendChart()));
}

// ── Trend chart ───────────────────────────────────────────────────────────

function _issueToDrillCategory(issue) {
  if (!issue) return '';
  if (issue.type === 'putting') return 'putting';
  if (issue.club === 'driver') return 'driver';
  if (['pw','sw','58','60','gw','aw'].includes(issue.club)) return 'wedges';
  if (['chip_chunk','chip_blade','chip_distance_unstable'].includes(issue.key)) return 'short';
  return 'irons';
}

function _renderTrendCard(issue) {
  return `
    <div class="today-trend-card" id="today-trend-card">
      <div class="today-trend-header">
        <div class="today-trend-label">${escapeHtml(issue.clubName)} · trend</div>
        <div class="today-trend-metric-label" id="today-trend-metric-label"></div>
      </div>
      <canvas id="today-trend-canvas" style="width:100%;display:block;border-radius:8px;background:var(--canvas-bg);margin-top:8px;"></canvas>
      <div class="today-trend-footer" id="today-trend-footer"></div>
    </div>`;
}

function _groupBySession(shots, club) {
  const CA = window.clubAliases;
  const filtered = club && CA
    ? shots.filter(s => CA.shotMatchesClub(s, club) && !s._isManual)
    : shots.filter(s => !s._isManual);
  const map = {};
  filtered.forEach(s => {
    const d = (s.shot_time || s.created_at || '').substring(0, 10);
    if (!d) return;
    if (!map[d]) map[d] = [];
    map[d].push(s);
  });
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10);
}

function _drawTodayTrendChart() {
  if (!_trendIssue || !_trendShots) return;
  const canvas = document.getElementById('today-trend-canvas');
  const card   = document.getElementById('today-trend-card');
  if (!canvas || !card) return;

  const issue    = _trendIssue;
  const sessions = _groupBySession(_trendShots, issue.club);

  let points = [], goalLine = null, metricLabel = '', lowerBetter = true;

  if (issue.type === 'direction') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.face_angle != null).map(s => Math.abs(s.face_angle));
      return vals.length >= 2 ? { date: d, v: statAvg(vals) } : null;
    }).filter(Boolean);
    goalLine = 2; metricLabel = '|Face angle| °'; lowerBetter = true;

  } else if (issue.type === 'contact') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.smash_factor > 0.5 && s.smash_factor < 2).map(s => s.smash_factor);
      return vals.length >= 2 ? { date: d, v: statAvg(vals) } : null;
    }).filter(Boolean);
    goalLine = 1.32; metricLabel = 'Smash factor avg'; lowerBetter = false;

  } else if (issue.type === 'consistency') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.carry > 0 && s.is_full_shot).map(s => s.carry);
      return vals.length >= 3 ? { date: d, v: statStdDev(vals) } : null;
    }).filter(Boolean);
    const isWedge = ['pw','sw','58','60','gw','aw'].includes(issue.club);
    goalLine = issue.club === 'driver' ? 15 : isWedge ? 8 : 10;
    metricLabel = 'Carry SD (m)'; lowerBetter = true;

  } else {
    card.style.display = 'none'; return;
  }

  if (points.length < 3) { card.style.display = 'none'; return; }

  const metricEl = document.getElementById('today-trend-metric-label');
  if (metricEl) metricEl.textContent = metricLabel;

  const latest = points[points.length - 1].v;
  const isImproving = lowerBetter ? latest < points[0].v : latest > points[0].v;
  const footerEl = document.getElementById('today-trend-footer');
  if (footerEl) {
    footerEl.innerHTML = `
      <span class="today-trend-dir${isImproving ? ' today-trend-up' : ''}">${isImproving ? '↑ Improving' : '→ Stable'}</span>
      ${goalLine != null ? `<span class="today-trend-goal-text">Goal: ${goalLine}</span>` : ''}`;
  }

  const isLight = document.body.classList.contains('light-theme');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = 110;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = isLight ? '#e3ddd5' : '#161819';
  ctx.fillRect(0, 0, w, h);

  const pad = { top:10, right:16, bottom:22, left:34 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const vals    = points.map(p => p.v);
  const allV    = goalLine != null ? [...vals, goalLine] : vals;
  const spread  = (Math.max(...allV) - Math.min(...allV)) || 1;
  const lo = Math.min(...allV) - spread * 0.15;
  const hi = Math.max(...allV) + spread * 0.15;
  const range = hi - lo;

  const xOf = i => pad.left + (i / (points.length - 1)) * pw;
  const yOf = v => pad.top + ph - ((v - lo) / range) * ph;

  if (goalLine != null) {
    const gy = yOf(goalLine);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(0,214,143,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + pw, gy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isLight ? 'rgba(0,150,100,.7)' : 'rgba(0,214,143,.6)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('goal', pad.left + pw, gy - 3);
  }

  const lineClr = isImproving
    ? (isLight ? 'rgba(0,160,100,.9)' : 'rgba(0,214,143,.9)')
    : (isLight ? 'rgba(190,120,0,.9)'  : 'rgba(255,170,0,.9)');

  ctx.beginPath();
  points.forEach((p, i) => { i === 0 ? ctx.moveTo(xOf(i), yOf(p.v)) : ctx.lineTo(xOf(i), yOf(p.v)); });
  ctx.strokeStyle = lineClr;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(p.v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineClr;
    ctx.fill();
  });

  const textClr = isLight ? 'rgba(70,65,60,.5)' : 'rgba(138,144,153,.5)';
  ctx.fillStyle = textClr; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText(Math.max(...vals).toFixed(1), pad.left - 3, pad.top + 9);
  ctx.fillText(Math.min(...vals).toFixed(1), pad.left - 3, h - pad.bottom + 4);
  ctx.textAlign = 'center'; ctx.fillStyle = textClr; ctx.font = '8px monospace';
  [0, points.length - 1].forEach(i => ctx.fillText(points[i].date.substring(5), xOf(i), h - 4));
}

// ── Drill catalog ──────────────────────────────────────────────────────────

function openDrillCatalog(category) {
  const overlay = document.getElementById('drill-catalog-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const cats = ['all','driver','irons','wedges','short','putting'];
  const catLabels = { all:'All', driver:'Driver', irons:'Irons', wedges:'Wedges', short:'Short game', putting:'Putting' };
  const active = category || 'all';
  overlay.innerHTML = `
    <div class="drill-catalog-backdrop" onclick="closeDrillCatalog()"></div>
    <div class="drill-catalog-sheet">
      <div class="drill-catalog-header">
        <div class="drill-catalog-title">Drill library</div>
        <button class="drill-catalog-close" onclick="closeDrillCatalog()">✕</button>
      </div>
      <div class="drill-catalog-filters">
        ${cats.map(c => `<button class="drill-cat-btn${active===c?' active':''}" onclick="openDrillCatalog('${c==='all'?'':c}')">${catLabels[c]}</button>`).join('')}
      </div>
      <div class="drill-catalog-list">${_renderDrillItems(category)}</div>
    </div>`;
}

function _renderDrillItems(category) {
  const items = category ? DRILL_CATALOG.filter(d => d.category === category) : DRILL_CATALOG;
  if (!items.length) return '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px;">No drills in this category yet.</div>';
  return items.map(d => `
    <div class="drill-item">
      <div class="drill-item-top">
        <div class="drill-item-name">${escapeHtml(d.name)}</div>
        <div class="drill-item-meta">${d.balls} balls · ${d.min} min</div>
      </div>
      <div class="drill-item-issue">For: ${escapeHtml(d.issue)}</div>
      <div class="drill-item-desc">${escapeHtml(d.desc)}</div>
      <div class="drill-item-cue">Cue — <em>${escapeHtml(d.cue)}</em></div>
    </div>`).join('');
}

function closeDrillCatalog() {
  const overlay = document.getElementById('drill-catalog-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ── Glossary overlay (Feature 6) ──────────────────────────────────────────

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

function openGlossaryLibrary(activeKey = '') {
  const overlay = document.getElementById('glossary-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="glossary-backdrop" onclick="closeGlossaryTip()"></div>
    <div class="glossary-sheet glossary-sheet-library">
      <div class="glossary-header">
        <div>
          <div class="glossary-top-label">Lexikon</div>
          <div class="glossary-term-label">Golf terms & ball flight</div>
        </div>
        <button class="glossary-close" onclick="closeGlossaryTip()">✕</button>
      </div>

      <div class="glossary-body glossary-library-body">
        ${_renderGlossaryBallFlightVisual()}
        ${_renderGlossaryGroups(activeKey)}
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function _renderGlossaryGroups(activeKey = '') {
  return GLOSSARY_GROUPS.map(group => `
    <div class="glossary-group">
      <div class="glossary-group-label">${escapeHtml(group.label)}</div>
      <div class="glossary-card-grid">
        ${group.items.map(key => _renderGlossaryCard(key, activeKey)).join('')}
      </div>
    </div>
  `).join('');
}

function _renderGlossaryCard(key, activeKey = '') {
  const entry = GLOSSARY_TERMS[key];
  if (!entry) return '';

  const isActive = key === activeKey;
  return `
    <button class="glossary-card ${isActive ? 'glossary-card-active' : ''}" onclick="showGlossaryTip('${key}', true)">
      <div class="glossary-card-title">${escapeHtml(entry.term)}</div>
      <div class="glossary-card-text">${escapeHtml(_shortGlossaryText(entry.def))}</div>
    </button>
  `;
}

function _shortGlossaryText(text) {
  if (!text) return '';
  const firstSentence = text.split('. ')[0]?.trim() || text;
  return firstSentence.endsWith('.') ? firstSentence : firstSentence + '.';
}

function _renderGlossaryBallFlightVisual() {
  return `
    <div class="glossary-hero">
      <div class="glossary-hero-header">
        <div class="glossary-group-label">Ball flight visual</div>
        <button class="glossary-hero-link" onclick="showGlossaryTip('face_to_path', true)">Open explanation</button>
      </div>

      <div class="glossary-hero-sub">
        For a right-handed golfer: <b>face</b> mainly controls start direction, <b>face-to-path</b> mainly controls curve.
      </div>

      <div class="bf-grid">
        <div class="bf-corner"></div>
        <div class="bf-head">Path left<br><span>outside-in</span></div>
        <div class="bf-head">Path neutral<br><span>target line</span></div>
        <div class="bf-head">Path right<br><span>inside-out</span></div>

        <div class="bf-side">Face left<br><span>closed</span></div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Pull hook</div>
          <div class="bf-shape bf-shape-left-hard">↖</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Pull</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Pull fade</div>
          <div class="bf-shape bf-shape-right-soft">↗</div>
        </div>

        <div class="bf-side">Face square<br><span>near target</span></div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Hook</div>
          <div class="bf-shape bf-shape-left-hard">↖</div>
        </div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Straight</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Fade</div>
          <div class="bf-shape bf-shape-right-soft">↗</div>
        </div>

        <div class="bf-side">Face right<br><span>open</span></div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Push draw</div>
          <div class="bf-shape bf-shape-left-soft">↖</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Push</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Push slice</div>
          <div class="bf-shape bf-shape-right-hard">↗</div>
        </div>
      </div>

      <div class="glossary-hero-note">
        Simple rule: <b>start line = face</b>, <b>curve = face-to-path</b>.
      </div>
    </div>
  `;
}

function showGlossaryTip(key, showBackButton = false) {
  const entry = GLOSSARY_TERMS[key];
  if (!entry) return;
  const overlay = document.getElementById('glossary-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="glossary-backdrop" onclick="closeGlossaryTip()"></div>
    <div class="glossary-sheet">
      <div class="glossary-header">
        <div>
          ${showBackButton ? `<button class="glossary-back-link" onclick="openGlossaryLibrary('${key}')">← Back to lexikon</button>` : ''}
          <div class="glossary-term-label">${escapeHtml(entry.term)}</div>
        </div>
        <button class="glossary-close" onclick="closeGlossaryTip()">✕</button>
      </div>
      <div class="glossary-body">
        <div class="glossary-def">${escapeHtml(entry.def)}</div>
        ${key === 'face_to_path' ? `
          <div class="glossary-mini-rule">
            <div><b>Negative face-to-path</b> = curves left</div>
            <div><b>Positive face-to-path</b> = curves right</div>
          </div>
        ` : ''}
        ${entry.tip ? `
          <div class="glossary-tip-block">
            <div class="glossary-tip-eyebrow">Coach tip</div>
            <div class="glossary-tip-text">${escapeHtml(entry.tip)}</div>
          </div>` : ''}
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeGlossaryTip() {
  const overlay = document.getElementById('glossary-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}
