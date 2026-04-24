// analysis.js v5
// Face SD in session headers · Fault frequency summary · Baseline reference line

let analysisClub   = '7';
let analysisFilter = 'progress';
let analysisShots  = [];
let analysisRawSort = { col: 'shot_time', dir: -1 };
let editingRowId   = null;
let currentProgKey = 'carry';
let _allFetchedShots = [];
let openSessions = new Set();
let analysisMapActiveDates = null; // null = all dates; Set<string> = filtered

const FILTER_OPTIONS = [
  { key:'all',           label:'All' },
  { key:'full',          label:'Full swings' },
  { key:'progress',      label:'Progress' },
  { key:'full_progress', label:'Full + Prog' },
];

const SESSION_COLORS = ['#00d68f','#ffaa00','#7b9cff','#ff7eb3','#40e0d0','#f4a460','#b8ff5a','#ff6b6b','#c084fc','#34d3f7','#fbbf24','#a3e635'];

const CA = () => window.clubAliases;

// ── Baselines per club/metric — update as confirmed carries change ──────────
const BASELINES = {
  '7': { carry: 108, smash_factor: 1.30, face_angle: 0, attack_angle: -3 },
  '9': { carry: 88,  smash_factor: 1.30, face_angle: 0 },
  'pw':{ carry: 82,  smash_factor: 1.28, face_angle: 0 },
  '6': { carry: 114, smash_factor: 1.30, face_angle: 0 },
  '58':{ carry: 59,  smash_factor: 1.18, face_angle: 0 },
};
function getBaselineForMetric(key, club) {
  return BASELINES[club]?.[key] ?? null;
}

// ── Benchmarks for KPI color coding ───────────────────────────────────────
const KPI_BENCHMARKS = {
  carry:       { good: [110,135], ok: [90,155] },
  smash_factor:{ good: [1.30,1.38], ok: [1.24,1.42] },
  ball_speed:  { good: [42,52],   ok: [36,56] },   // m/s
  club_speed:  { good: [32,43],   ok: [27,47] },   // m/s
  spin_rate:   { good: [5000,7500], ok: [3500,9000] },
  launch_angle:{ good: [17,23],   ok: [13,28] },
};
function kpiColor(key, val) {
  if (val == null) return '';
  const b = KPI_BENCHMARKS[key];
  if (!b) return '';
  if (val >= b.good[0] && val <= b.good[1]) return 'kpi-good';
  if (val >= b.ok[0]   && val <= b.ok[1])   return 'kpi-ok';
  return 'kpi-bad';
}
function carrySDColor(v) {
  if (v == null) return '';
  if (v < 8) return 'kpi-good';
  if (v < 15) return 'kpi-ok';
  return 'kpi-bad';
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initAnalysisTab() {
  await CA().loadAliases();
  buildAnalysisClubTabs();
  buildFilterTabs();
  loadAnalysis();
}

function buildAnalysisClubTabs() {
  const el = document.getElementById('analysis-club-tabs');
  if (!el) return;
  const defs = CA().CLUB_DEFINITIONS.filter(c => !['3w','5w'].includes(c.key));
  el.innerHTML = defs.map(c =>
    `<button class="atab${c.key===analysisClub?' on':''}" onclick="setAnalysisClub('${c.key}')">${c.label}</button>`
  ).join('');
}

function buildFilterTabs() {
  const el = document.getElementById('analysis-filter-tabs');
  if (!el) return;
  el.innerHTML = FILTER_OPTIONS.map(f =>
    `<button class="filter-tab${f.key===analysisFilter?' on':''}" onclick="setAnalysisFilter('${f.key}')">${f.label}</button>`
  ).join('');
}

function setAnalysisClub(key) {
  analysisClub = key;
  document.querySelectorAll('.atab').forEach(t =>
    t.classList.toggle('on', t.textContent === CA().clubLabel(key))
  );
  openSessions = new Set();
  analysisShots = _allFetchedShots.filter(s => CA().shotMatchesClub(s, analysisClub));
  renderAnalysis(analysisShots);
}

function setAnalysisFilter(key) {
  analysisFilter = key;
  document.querySelectorAll('.filter-tab').forEach(t =>
    t.classList.toggle('on', t.textContent === FILTER_OPTIONS.find(f=>f.key===key)?.label)
  );
  renderAnalysis(analysisShots);
}

// ── Data ───────────────────────────────────────────────────────────────────
async function loadAnalysis() {
  const el = document.getElementById('analysis-content');
  if (!el) return;
  el.innerHTML = '<div class="analysis-loading">Loading…</div>';
  editingRowId = null;
  await CA().loadAliases();

  const { data: _authData } = await window.supabaseClient.auth.getSession();
  if (!_authData?.session?.user) {
    el.innerHTML = `<div class="analysis-empty">
      <strong>Sign in to view your Trackman data</strong>
      Your shot history, progress charts and club stats will appear here.
      <small><button class="analysis-login-btn" onclick="toggleAuthPanel()">Login →</button></small>
    </div>`;
    return;
  }

  const sb = window.supabaseClient;
  const user = _authData.session.user;
  const { data, error } = await sb
    .from('trackman_shots')
    .select('id,club,carry,total,side,total_side,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,launch_direction,attack_angle,club_path,face_angle,face_to_path,dyn_loft,spin_loft,spin_axis,max_height,landing_angle,hang_time,notes,is_full_shot,exclude_from_progress,shot_type,strike_quality,shot_time,created_at')
    .eq('user_id', user.id)
    .order('shot_time', { ascending: false })
    .limit(2000);

  if (error) { el.innerHTML = `<div class="analysis-empty">Error: ${escapeHtml(error.message)}</div>`; return; }
  _allFetchedShots = data || [];
  analysisShots = _allFetchedShots.filter(s => CA().shotMatchesClub(s, analysisClub));
  renderAnalysis(analysisShots);
}

function applyFilter(shots) {
  switch (analysisFilter) {
    case 'full':          return shots.filter(s => s.is_full_shot !== false);
    case 'progress':      return shots.filter(s => s.exclude_from_progress !== true);
    case 'full_progress': return shots.filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true);
    default:              return shots;
  }
}

function buildSessionColorMap(shots) {
  const dates = [...new Set([...shots].sort((a,b)=>new Date(a.shot_time||a.created_at)-new Date(b.shot_time||b.created_at)).map(s=>(s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))];
  const map = {};
  dates.forEach((d,i) => { map[d] = SESSION_COLORS[i % SESSION_COLORS.length]; });
  return map;
}

// ── Main render ────────────────────────────────────────────────────────────
function renderAnalysis(allShots) {
  const el = document.getElementById('analysis-content');
  if (!el) return;
  const shots = applyFilter(allShots);
  const colorMap = buildSessionColorMap(allShots);

  const unknowns = CA().findUnknownClubNames(_allFetchedShots);
  const unknownBanner = unknowns.length
    ? `<div class="analysis-unknown-banner">⚠ Unmapped names: <strong>${unknowns.map(u=>escapeHtml(u)).join(', ')}</strong> — <a href="#" onclick="showPage('clubs');return false;">fix in Clubs</a></div>`
    : '';

  if (!shots.length) {
    el.innerHTML = unknownBanner + `<div class="analysis-empty">No <strong>${CA().clubLabel(analysisClub)}</strong> shots for this filter.<br><small>Check club aliases in the Clubs tab.</small></div>`;
    return;
  }

  // Preserve accordion open/closed states across club switches and filter changes.
  // On first render (no anacc-overview in DOM yet) fall back to defaults.
  const _accIds = ['overview', 'maps', 'consist', 'direction', 'distance', 'progress', 'shots'];
  const _firstRender = !document.getElementById('anacc-overview');
  const openAccs = new Set(
    _firstRender
      ? ['overview', 'maps', 'progress', 'shots']
      : _accIds.filter(id => document.getElementById('anacc-' + id)?.classList.contains('open'))
  );

  el.innerHTML = unknownBanner + `
    ${renderAnalysisAcc('overview',  'Overview',              renderOverviewKPIs(shots), openAccs.has('overview'))}
    ${renderAnalysisAcc('maps',      'Shot Maps',             renderShotMaps(shots, allShots), openAccs.has('maps'))}
    ${renderAnalysisAcc('consist',   'Consistency',           renderConsistency(shots), openAccs.has('consist'))}
    ${renderAnalysisAcc('direction', 'Direction &amp; Pattern', renderDirection(shots), openAccs.has('direction'))}
    ${renderAnalysisAcc('distance',  'Distance Control',      renderDistanceControl(shots), openAccs.has('distance'))}
    ${renderAnalysisAcc('progress',  'Progress Over Time',    renderProgressSection(allShots), openAccs.has('progress'))}
    ${renderAnalysisAcc('shots',     'Shot Log',              renderSessionGroups(shots, colorMap), openAccs.has('shots'))}
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    drawProgressChart(currentProgKey, applyFilter(analysisShots));
    const filteredShots = applyFilter(analysisShots);
    const colorMap2 = buildSessionColorMap(analysisShots);
    const activeShotsForMaps = filteredShots.filter(s =>
      analysisMapActiveDates === null || analysisMapActiveDates.has((s.shot_time||s.created_at)?.slice(0,10))
    );
    drawTopViewMap(activeShotsForMaps, colorMap2);
    drawSideViewMap(activeShotsForMaps, colorMap2);
    openSessions.forEach(date => {
      const body = document.getElementById(`session-body-${date}`);
      const head = document.getElementById(`session-head-${date}`);
      if (body) { body.style.display = 'block'; }
      if (head) { head.classList.add('open'); }
    });
  }));
}

function renderAnalysisAcc(id, title, content, defaultOpen) {
  return `<div class="acc${defaultOpen?' open':''}" id="anacc-${id}">
    <div class="acc-head" onclick="toggleAccById('anacc-${id}')">
      <div class="acc-title" style="font-size:14px;">${title}</div>
      <div class="acc-arrow">›</div>
    </div>
    <div class="acc-body" ${defaultOpen?'style="max-height:4000px;opacity:1;"':''}>
      <div class="analysis-acc-content">${content}</div>
    </div>
  </div>`;
}

// ── Canvas theme helper ────────────────────────────────────────────────────
function _cv() {
  const light = document.body.classList.contains('light-theme');
  return {
    grid:        light ? 'rgba(0,0,0,0.10)'   : 'rgba(255,255,255,0.05)',
    gridMid:     light ? 'rgba(0,0,0,0.18)'   : 'rgba(255,255,255,0.12)',
    dim:         light ? '#5a5550'             : '#4e5660',
    baseline:    light ? 'rgba(0,0,0,0.32)'   : 'rgba(255,255,255,0.28)',
    baselineTxt: light ? 'rgba(0,0,0,0.50)'   : 'rgba(255,255,255,0.4)',
    ground:      light ? 'rgba(0,0,0,0.22)'   : 'rgba(255,255,255,0.18)',
    center:      light ? 'rgba(0,0,0,0.18)'   : 'rgba(255,255,255,0.12)',
    sessionSep:  light ? 'rgba(0,0,0,0.10)'   : 'rgba(255,255,255,0.09)',
    gradTop:     light ? 'rgba(0,148,88,0.18)' : 'rgba(0,214,143,0.13)',
    gradBot:     light ? 'rgba(0,148,88,0)'    : 'rgba(0,214,143,0)',
    // Golf field
    rough1:      light ? '#9dbf78'             : '#111b0d',
    rough2:      light ? '#90b56e'             : '#0e1709',
    fw1:         light ? '#5fa038'             : '#1a3214',
    fw2:         light ? '#538e31'             : '#152a10',
    greenFill:   light ? 'rgba(55,155,25,0.38)' : 'rgba(40,190,80,0.18)',
    greenStr:    light ? 'rgba(40,130,10,0.75)' : 'rgba(50,220,90,0.45)',
    fwEdge:      light ? 'rgba(0,0,0,0.25)'    : 'rgba(0,0,0,0.35)',
    flagPole:    light ? 'rgba(30,20,10,0.70)' : 'rgba(255,255,255,0.65)',
    // Side view
    skyTop:      light ? 'rgba(120,185,230,0.40)' : 'rgba(15,28,48,0.70)',
    skyBot:      light ? 'rgba(120,185,230,0)'    : 'rgba(15,28,48,0)',
    groundStrip: light ? 'rgba(80,140,45,0.30)'  : 'rgba(18,42,12,0.55)',
  };
}

// ── Stat helpers ───────────────────────────────────────────────────────────
function statAvg(arr) {
  const v=arr.filter(x=>x!=null&&!isNaN(x));
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
}
function statMedian(arr) {
  const v=arr.filter(x=>x!=null&&!isNaN(x)).sort((a,b)=>a-b);
  if(!v.length)return null;
  const m=Math.floor(v.length/2);
  return v.length%2?v[m]:(v[m-1]+v[m])/2;
}
function statStdDev(arr) {
  const v=arr.filter(x=>x!=null&&!isNaN(x));
  if(v.length<2)return null;
  const a=statAvg(v);
  return Math.sqrt(v.reduce((s,x)=>s+(x-a)**2,0)/(v.length-1));
}
function statPercentile(arr,p) {
  const v=arr.filter(x=>x!=null&&!isNaN(x)).sort((a,b)=>a-b);
  if(!v.length)return null;
  const idx=(p/100)*(v.length-1);
  const lo=Math.floor(idx),hi=Math.ceil(idx);
  return lo===hi?v[lo]:v[lo]+(v[hi]-v[lo])*(idx-lo);
}
function f(v,dp=1)    { return (v==null||isNaN(v))?'–':Number(v).toFixed(dp); }
function fSign(v,dp=1){ return (v==null||isNaN(v))?'–':(v>0?'+':'')+Number(v).toFixed(dp); }

// ── Load into Coach button ─────────────────────────────────────────────────
function renderLoadIntoCoachBtn(shots) {
  const lastDate = (shots[0]?.shot_time || shots[0]?.created_at)?.slice(0,10);
  if (!lastDate) return '';
  return `<button class="load-into-coach-btn" onclick="loadAnalysisSessionIntoCoach('${lastDate}')">
    ⟵ Load ${lastDate} averages into Coach
  </button>`;
}

function loadAnalysisSessionIntoCoach(date) {
  const shots = applyFilter(analysisShots).filter(s => (s.shot_time||s.created_at)?.startsWith(date));
  if (!shots.length) return;

  const coachMap = {
    driver: 'driver',
    '6':'irons','7':'irons','8':'irons','9':'irons',
    'pw':'wedge','sw':'wedge','58':'wedge',
    'putter':'putter',
  };
  const coachClub = coachMap[analysisClub] || 'irons';

  const avgOf = key => {
    const v = shots.map(s=>s[key]).filter(x=>x!=null&&!isNaN(x));
    return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  };

  if (!window.vals) return;
  if (!window.vals[coachClub]) window.vals[coachClub] = {};

  const CLUBS_REF = window.CLUBS;
  if (!CLUBS_REF) return;
  const allInps = getAllInputs(coachClub);

  const mapping = [
    ['face_angle',  'face'],
    ['club_path',   'path'],
    ['attack_angle','attack'],
    ['launch_angle','launch'],
    ['spin_rate',   'spin'],
    ['smash_factor','smash'],
    ['ball_speed',  'ballspeed'],
    ['club_speed',  'clubspeed'],
    ['dyn_loft',    'dynloft'],
    ['spin_axis',   'spinaxis'],
  ];

  mapping.forEach(([dbField, sliderId]) => {
    const inp = allInps.find(i => i.id === sliderId);
    if (!inp) return;
    const avg = avgOf(dbField);
    if (avg == null) return;
    const raw = inp.scale ? Math.round(avg * inp.scale) : Math.round(avg);
    window.vals[coachClub][sliderId] = Math.max(inp.min, Math.min(inp.max, raw));
  });

  showPage('coach');
  const tabNames = { driver:'Driver', irons:'Irons 6–9', wedge:'Wedges', putter:'Putter' };
  document.querySelectorAll('.ctab').forEach(t => {
    if (t.textContent === tabNames[coachClub]) { t.click(); }
  });
  showToast(`Loaded ${date} → Coach`);
}

// ── Overview KPIs ──────────────────────────────────────────────────────────
function renderOverviewKPIs(shots) {
  const c=shots.map(s=>s.carry).filter(Boolean);
  const sm=shots.map(s=>s.smash_factor).filter(Boolean);
  const bs=shots.map(s=>s.ball_speed).filter(Boolean);
  const cs=shots.map(s=>s.club_speed).filter(Boolean);
  const sp=shots.map(s=>s.spin_rate).filter(Boolean);
  const la=shots.map(s=>s.launch_angle).filter(Boolean);

  const avgCarry=statAvg(c),medCarry=statMedian(c),sdCarry=statStdDev(c);
  const avgSmash=statAvg(sm),avgBS=statAvg(bs),avgCS=statAvg(cs);
  const avgSpin=statAvg(sp),avgLaunch=statAvg(la);

  // Trend: compare most recent 20% of shots vs all-time average
  const recentN=Math.max(3,Math.round(shots.length*0.2));
  const recent=shots.slice(0,recentN);
  const trendCarry=statAvg(recent.map(s=>s.carry).filter(Boolean));
  const trendSmash=statAvg(recent.map(s=>s.smash_factor).filter(Boolean));
  const trendArrow=(recent,all,thresh)=>{
    if(recent==null||all==null)return'';
    const d=recent-all;
    if(d>thresh)return'<span class="kpi-trend kpi-trend-up">↑</span>';
    if(d<-thresh)return'<span class="kpi-trend kpi-trend-down">↓</span>';
    return'<span class="kpi-trend kpi-trend-flat">→</span>';
  };

  const kpis = [
    { l:'Shots',      raw:shots.length,    disp:shots.length,          cls:'' },
    { l:'Avg Carry',  raw:avgCarry,        disp:f(avgCarry)+'m'+trendArrow(trendCarry,avgCarry,1.5),  cls:kpiColor('carry',avgCarry) },
    { l:'Median',     raw:medCarry,        disp:f(medCarry)+'m',        cls:kpiColor('carry',medCarry) },
    { l:'Carry ±',    raw:sdCarry,         disp:f(sdCarry)+'m',         cls:carrySDColor(sdCarry) },
    { l:'Smash',      raw:avgSmash,        disp:f(avgSmash,2)+trendArrow(trendSmash,avgSmash,0.01), cls:kpiColor('smash_factor',avgSmash) },
    { l:'Ball Speed', raw:avgBS,           disp:f(avgBS)+' m/s',        cls:kpiColor('ball_speed',avgBS) },
    { l:'Club Speed', raw:avgCS,           disp:f(avgCS)+' m/s',        cls:kpiColor('club_speed',avgCS) },
    { l:'Avg Spin',   raw:avgSpin,         disp:avgSpin?Math.round(avgSpin)+' rpm':'–', cls:kpiColor('spin_rate',avgSpin) },
    { l:'Launch',     raw:avgLaunch,       disp:f(avgLaunch)+'°',       cls:kpiColor('launch_angle',avgLaunch) },
  ];

  const loadBtn = renderLoadIntoCoachBtn(shots);

  return `
    ${loadBtn}
    <div class="analysis-kpi-grid">
      ${kpis.map(k=>`<div class="analysis-kpi-card ${k.cls}">
        <div class="analysis-kpi-label">${k.l}</div>
        <div class="analysis-kpi-value">${k.disp}</div>
      </div>`).join('')}
    </div>`;
}

// ── Consistency ───────────────────────────────────────────────────────────
function renderConsistency(shots) {
  const carries = shots.map(s=>s.carry).filter(Boolean);
  const faces   = shots.map(s=>s.face_angle).filter(x=>x!=null);
  const paths   = shots.map(s=>s.club_path).filter(x=>x!=null);
  const smashes = shots.map(s=>s.smash_factor).filter(Boolean);
  const attacks = shots.map(s=>s.attack_angle).filter(x=>x!=null);
  const spins   = shots.map(s=>s.spin_rate).filter(Boolean);

  const row = (label, center, sd, sdCls) => `
    <div class="consist-row">
      <div class="consist-label">${label}</div>
      <div class="consist-stats">
        <span class="consist-center">${center}</span>
        <span class="consist-sep">·</span>
        <span class="consist-sd ${sdCls}">±${sd} SD</span>
      </div>
    </div>`;

  let rows = '';
  if (carries.length) {
    const med = statMedian(carries), sd = statStdDev(carries);
    rows += row('Carry', f(med,0)+'m', f(sd,1)+'m', carrySDColor(sd));
  }
  if (smashes.length) {
    const avg = statAvg(smashes), sd = statStdDev(smashes);
    rows += row('Smash', f(avg,2), f(sd,3), kpiColor('smash_factor',avg));
  }
  if (faces.length) {
    const avg = statAvg(faces), sd = statStdDev(faces);
    rows += row('Face', fSign(avg,1)+'°', f(sd,1)+'°', '');
  }
  if (paths.length) {
    const avg = statAvg(paths), sd = statStdDev(paths);
    rows += row('Path', fSign(avg,1)+'°', f(sd,1)+'°', '');
  }
  if (attacks.length) {
    const avg = statAvg(attacks), sd = statStdDev(attacks);
    rows += row('Attack', fSign(avg,1)+'°', f(sd,1)+'°', '');
  }
  if (spins.length) {
    const avg = statAvg(spins), sd = statStdDev(spins);
    rows += row('Spin', avg?Math.round(avg)+' rpm':'–', avg?Math.round(sd)+' rpm':'–', kpiColor('spin_rate',avg));
  }

  return `<div class="consist-list">${rows || '<div class="analysis-empty-small">No data</div>'}</div>`;
}

// ── Direction & Pattern ────────────────────────────────────────────────────
function renderDirection(shots) {
  const faces = shots.map(s=>s.face_angle).filter(x=>x!=null);
  const paths = shots.map(s=>s.club_path).filter(x=>x!=null);
  const ftps  = shots.map(s=>s.face_to_path).filter(x=>x!=null);
  const sides = shots.map(s=>s.side).filter(x=>x!=null);

  const avgFace = statAvg(faces), avgPath = statAvg(paths), avgFTP = statAvg(ftps);
  const tot = sides.length || 1;
  const left   = sides.filter(s=>s<-5).length;
  const right  = sides.filter(s=>s>5).length;
  const center = tot - left - right;
  const lPct = sides.length ? Math.round(left/tot*100)   : 0;
  const rPct = sides.length ? Math.round(right/tot*100)  : 0;
  const cPct = 100 - lPct - rPct;

  const miss = (()=>{
    if (!avgFTP) return '–';
    if (avgFTP > 4)  return avgPath != null && avgPath > 3 ? 'Push Draw' : 'Draw / Fade';
    if (avgFTP < -4) return avgPath != null && avgPath < -3 ? 'Pull Fade' : 'Fade / Draw';
    if (avgFace != null && avgFace > 2)  return 'Push Right';
    if (avgFace != null && avgFace < -2) return 'Pull Left';
    return 'Neutral';
  })();

  const faceDesc = avgFace==null ? '–' : Math.abs(avgFace)<=1 ? `${fSign(avgFace,1)}° neutral` : avgFace>0 ? `${fSign(avgFace,1)}° open` : `${fSign(avgFace,1)}° closed`;
  const pathDesc = avgPath==null ? '–' : Math.abs(avgPath)<=2 ? `${fSign(avgPath,1)}°` : avgPath>0 ? `${fSign(avgPath,1)}° in-to-out` : `${fSign(avgPath,1)}° out-to-in`;
  const ftpDesc  = avgFTP==null  ? '–' : Math.abs(avgFTP)<=3  ? `${fSign(avgFTP,1)}° neutral`  : avgFTP>0 ? `${fSign(avgFTP,1)}° slice bias` : `${fSign(avgFTP,1)}° hook bias`;

  const row=(l,v)=>`<div class="analysis-row"><span class="analysis-row-label">${l}</span><span class="analysis-row-value">${v}</span></div>`;

  const stackedBar = sides.length >= 3 ? `
    <div class="dir-miss-wrap">
      <div class="dir-miss-label">Landing distribution (±5m = centre)</div>
      <div class="dir-miss-stacked">
        ${lPct > 0 ? `<div class="dir-miss-seg dir-miss-left" style="width:${lPct}%">${lPct >= 14 ? lPct+'%' : ''}</div>` : ''}
        ${cPct > 0 ? `<div class="dir-miss-seg dir-miss-center" style="width:${cPct}%">${cPct >= 14 ? cPct+'%' : ''}</div>` : ''}
        ${rPct > 0 ? `<div class="dir-miss-seg dir-miss-right" style="width:${rPct}%">${rPct >= 14 ? rPct+'%' : ''}</div>` : ''}
      </div>
      <div class="dir-miss-legend">
        <span class="dml dml-l"></span>L ${lPct}%
        <span class="dml dml-c"></span>C ${cPct}%
        <span class="dml dml-r"></span>R ${rPct}%
        ${avgFTP != null ? `<span class="dir-pattern-text">${miss}</span>` : ''}
      </div>
    </div>` : '';

  return `
    <div class="analysis-two-col">
      <div>
        <div class="analysis-col-label">Angle averages</div>
        <div class="analysis-row-list">
          ${faces.length ? row('Face', faceDesc) : ''}
          ${paths.length ? row('Path', pathDesc) : ''}
          ${ftps.length  ? row('FTP',  ftpDesc)  : ''}
          ${!faces.length && !paths.length ? '<div class="analysis-empty-small">No angle data</div>' : ''}
        </div>
      </div>
      <div>
        <div class="analysis-col-label">Pattern</div>
        <div class="analysis-row-list">
          ${row('Pattern', miss)}
          ${sides.length ? row('Shots', sides.length+'') : ''}
        </div>
      </div>
    </div>
    ${stackedBar}`;
}

// ── Distance control ───────────────────────────────────────────────────────
function renderDistanceControl(shots) {
  const c = shots.map(s=>s.carry).filter(Boolean);
  if (!c.length) return '<div class="analysis-empty-small">No carry data</div>';
  const sorted = [...c].sort((a,b)=>a-b);
  const med = statMedian(c), sd = statStdDev(c);
  const p10 = statPercentile(c,10), p90 = statPercentile(c,90);
  const row = (l,v) => `<div class="analysis-row"><span class="analysis-row-label">${l}</span><span class="analysis-row-value">${v}</span></div>`;
  return `
    <div class="dist-summary">
      <div class="dist-main">
        <span class="dist-median">${f(med,0)}m</span>
        <span class="dist-sd ${carrySDColor(sd)}">±${f(sd,1)}m</span>
        <span class="dist-label">median · std dev</span>
      </div>
    </div>
    <div class="analysis-row-list" style="display:grid;grid-template-columns:1fr 1fr;">
      ${row('Min', f(sorted[0],0)+'m')}
      ${row('Max', f(sorted[sorted.length-1],0)+'m')}
      ${row('Range', f(sorted[sorted.length-1]-sorted[0],0)+'m')}
      ${row('P10 – P90', f(p10,0)+'–'+f(p90,0)+'m')}
    </div>`;
}

// ── Progress chart ─────────────────────────────────────────────────────────
function renderProgressSection(allShots) {
  const metrics=['carry','smash_factor','ball_speed','spin_rate','launch_angle','face_angle','club_path','face_to_path','attack_angle','playable_rate'];
  return`<div class="progress-chart-tabs">
    ${metrics.map(k=>`<button class="prog-tab${k===currentProgKey?' on':''}" onclick="switchProgChart('${k}',this)">${progLabel(k)}</button>`).join('')}
  </div>
  <canvas id="progress-canvas" height="190" style="width:100%;display:block;margin-top:8px;border-radius:10px;background:var(--canvas-bg);"></canvas>
  <div class="progress-baseline-note" id="progress-baseline-note"></div>`;
}

function progLabel(k){return{carry:'Carry',smash_factor:'Smash',ball_speed:'Ball Spd',spin_rate:'Spin',launch_angle:'Launch',face_angle:'Face',club_path:'Path',face_to_path:'FTP',attack_angle:'Attack',playable_rate:'Playable %'}[k]||k;}

function switchProgChart(key,btn){
  currentProgKey=key;
  document.querySelectorAll('.prog-tab').forEach(t=>t.classList.remove('on'));
  if(btn)btn.classList.add('on');
  drawProgressChart(key,applyFilter(analysisShots));
}

function drawProgressChart(key,shots){
  const canvas=document.getElementById('progress-canvas');
  if(!canvas)return;
  const dpr=Math.min(window.devicePixelRatio||2,3);
  const w=canvas.parentElement?.clientWidth||340,h=190;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);

  // ── Special: rolling playable-rate chart ──────────────────────────────
  if (key === 'playable_rate') {
    const cv2=_cv();
    const sortedAll=[...shots].sort((a,b)=>new Date(a.shot_time||a.created_at)-new Date(b.shot_time||b.created_at));
    const sideShots=sortedAll.filter(s=>s.side!=null);
    const winSize=10;
    const pts=sideShots.map((_,i)=>{
      const win=sideShots.slice(Math.max(0,i-winSize+1),i+1);
      return win.filter(s=>Math.abs(s.side)<=20).length/win.length*100;
    });
    if(pts.length<3){
      ctx.fillStyle=cv2.dim;ctx.font="13px 'Barlow',sans-serif";ctx.textAlign='center';
      ctx.fillText('Not enough side data (need 3+ shots)',w/2,h/2);return;
    }
    const pad2={t:28,r:20,b:38,l:48};
    const cw2=w-pad2.l-pad2.r,ch2=h-pad2.t-pad2.b;
    const px2=i=>pad2.l+(i/(pts.length-1))*cw2;
    const py2=v=>pad2.t+ch2-(v/100)*ch2;
    ctx.font="9px 'DM Mono',monospace";ctx.textAlign='right';
    for(const pct of [0,25,50,75,100]){
      const y=py2(pct);
      ctx.strokeStyle=cv2.grid;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(pad2.l,y);ctx.lineTo(w-pad2.r,y);ctx.stroke();
      ctx.fillStyle=cv2.dim;ctx.fillText(pct+'%',pad2.l-6,y+3);
    }
    const tY=py2(70);
    ctx.strokeStyle=cv2.baseline;ctx.lineWidth=1;ctx.setLineDash([8,5]);
    ctx.beginPath();ctx.moveTo(pad2.l,tY);ctx.lineTo(w-pad2.r,tY);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=cv2.baselineTxt;ctx.textAlign='right';ctx.font="8px 'DM Mono',monospace";
    ctx.fillText('target 70%',w-pad2.r-2,tY-3);
    const grad2=ctx.createLinearGradient(0,pad2.t,0,pad2.t+ch2);
    grad2.addColorStop(0,cv2.gradTop);grad2.addColorStop(1,cv2.gradBot);
    ctx.fillStyle=grad2;ctx.beginPath();ctx.moveTo(px2(0),py2(pts[0]));
    pts.forEach((v,i)=>ctx.lineTo(px2(i),py2(v)));
    ctx.lineTo(px2(pts.length-1),pad2.t+ch2);ctx.lineTo(px2(0),pad2.t+ch2);ctx.closePath();ctx.fill();
    pts.forEach((v,i)=>{
      ctx.fillStyle=v>=70?'#00d68f':v>=50?'#ffaa00':'#ff4d4d';ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(px2(i),py2(v),3.5,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
    const roll2=pts.map((_,i)=>{const s2=pts.slice(Math.max(0,i-4),i+1);return s2.reduce((a,b)=>a+b,0)/s2.length;});
    ctx.strokeStyle='#00d68f';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();roll2.forEach((v,i)=>i===0?ctx.moveTo(px2(i),py2(v)):ctx.lineTo(px2(i),py2(v)));ctx.stroke();
    const lastRate=pts[pts.length-1];
    const rCol=lastRate>=70?'#00d68f':lastRate>=50?'#ffaa00':'#ff4d4d';
    ctx.font="700 11px 'Barlow Condensed',sans-serif";ctx.textAlign='left';ctx.fillStyle=rCol;
    ctx.fillText(`PLAYABLE % · ${pts.length} shots · last ${Math.round(lastRate)}%`,pad2.l,pad2.t-12);
    const noteEl2=document.getElementById('progress-baseline-note');
    if(noteEl2)noteEl2.textContent='Rolling 10-shot playable rate · dashed = 70% target';
    return;
  }

  const isSign=['face_angle','club_path','face_to_path','attack_angle'].includes(key);
  const colorMap=buildSessionColorMap(shots);
  const ordered=[...shots].sort((a,b)=>new Date(a.shot_time||a.created_at)-new Date(b.shot_time||b.created_at)).filter(s=>s[key]!=null&&!isNaN(s[key]));
  const values=ordered.map(s=>Number(s[key]));
  const dates=ordered.map(s=>(s.shot_time||s.created_at)?.slice(0,10)||'');
  if(values.length<2){ctx.fillStyle='#4e5660';ctx.font="13px 'Barlow',sans-serif";ctx.textAlign='center';ctx.fillText('Not enough data',w/2,h/2);return;}

  // Include baseline in scale if it exists
  const baseline=getBaselineForMetric(key,analysisClub);
  const allVals=baseline!=null?[...values,baseline]:values;

  const pad={t:28,r:20,b:38,l:48};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const span=Math.max(...allVals)-Math.min(...allVals)||1;
  const min=Math.min(...allVals)-span*0.1,max=Math.max(...allVals)+span*0.1;
  const px=i=>pad.l+(i/(values.length-1))*cw;
  const py=v=>pad.t+ch-((v-min)/(max-min))*ch;

  const cv=_cv();
  ctx.strokeStyle=cv.grid;ctx.lineWidth=1;
  ctx.font="9px 'DM Mono',monospace";ctx.fillStyle=cv.dim;ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const y=pad.t+(ch/4)*i,val=max-((max-min)/4)*i;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    ctx.fillText(isSign?(val>0?'+':'')+val.toFixed(1):val.toFixed(key==='spin_rate'?0:1),pad.l-6,y+3);
  }

  // ── Baseline reference line ────────────────────────────────────────────
  if(baseline!=null){
    const by=py(baseline);
    ctx.save();
    ctx.strokeStyle=cv.baseline;ctx.lineWidth=1;ctx.globalAlpha=1;
    ctx.setLineDash([8,5]);
    ctx.beginPath();ctx.moveTo(pad.l,by);ctx.lineTo(w-pad.r,by);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=cv.baselineTxt;ctx.textAlign='right';ctx.font="8px 'DM Mono',monospace";
    ctx.fillText('baseline '+(isSign?(baseline>0?'+':'')+baseline:baseline),w-pad.r-2,by-3);
    ctx.restore();
  }

  let prev='';ctx.setLineDash([3,4]);ctx.strokeStyle=cv.sessionSep;ctx.lineWidth=1;
  dates.forEach((d,i)=>{if(d!==prev&&i>0){ctx.beginPath();ctx.moveTo(px(i),pad.t);ctx.lineTo(px(i),pad.t+ch);ctx.stroke();}prev=d;});
  ctx.setLineDash([]);

  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,cv.gradTop);grad.addColorStop(1,cv.gradBot);
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(px(0),py(values[0]));
  values.forEach((v,i)=>ctx.lineTo(px(i),py(v)));
  ctx.lineTo(px(values.length-1),pad.t+ch);ctx.lineTo(px(0),pad.t+ch);ctx.closePath();ctx.fill();

  values.forEach((v,i)=>{ctx.fillStyle=colorMap[dates[i]]||'#00d68f';ctx.globalAlpha=0.85;ctx.beginPath();ctx.arc(px(i),py(v),3.5,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;

  const roll=values.map((_,i)=>{const w2=values.slice(Math.max(0,i-4),i+1);return w2.reduce((a,b)=>a+b,0)/w2.length;});
  ctx.strokeStyle='#00d68f';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();roll.forEach((v,i)=>i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v)));ctx.stroke();

  const n=values.length,sX=values.reduce((_,__,i)=>_+i,0),sY=values.reduce((a,b)=>a+b,0);
  const sXY=values.reduce((a,v,i)=>a+i*v,0),sX2=values.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sXY-sX*sY)/(n*sX2-sX*sX),intercept=(sY-slope*sX)/n;
  const tStart=intercept,tEnd=slope*(n-1)+intercept;
  const tCol=slope>0.01?'#00d68f':slope<-0.01?'#ff4d4d':'#8a9099';
  ctx.strokeStyle=tCol;ctx.lineWidth=1.5;ctx.globalAlpha=0.6;ctx.setLineDash([7,4]);
  ctx.beginPath();ctx.moveTo(px(0),py(tStart));ctx.lineTo(px(n-1),py(tEnd));ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;

  const diff=tEnd-tStart,arrow=slope>0.01?'↑':slope<-0.01?'↓':'→';
  ctx.font="700 10px 'Barlow Condensed',sans-serif";ctx.textAlign='right';ctx.fillStyle=tCol;
  ctx.fillText(`${arrow} ${diff>0?'+':''}${diff.toFixed(key==='spin_rate'?0:1)}`,w-pad.r,pad.t-12);
  ctx.fillStyle='#f0ede8';ctx.textAlign='left';ctx.font="700 11px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${progLabel(key).toUpperCase()} · ${values.length} shots`,pad.l,pad.t-12);

  const ud=[...new Set(dates)];ctx.font="9px 'DM Mono',monospace";ctx.textAlign='left';let lx=pad.l;
  ud.forEach(d=>{if(lx>w-60)return;const col=colorMap[d]||'#00d68f';ctx.fillStyle=col;ctx.beginPath();ctx.arc(lx+4,pad.t+ch+20,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6a7380';ctx.fillText(d.slice(5),lx+12,pad.t+ch+23);lx+=54;});

  // Baseline note
  const noteEl=document.getElementById('progress-baseline-note');
  if(noteEl){
    noteEl.textContent=baseline!=null?`Dashed line = confirmed baseline (${isSign?(baseline>0?'+':'')+baseline:baseline})`:'' ;
  }
}

// ── Session groups ─────────────────────────────────────────────────────────
function renderSessionGroups(shots, colorMap) {
  const sorted = sortShots([...shots], analysisRawSort.col, analysisRawSort.dir);
  const groups = [];
  const groupMap = {};
  sorted.forEach(s => {
    const date = (s.shot_time || s.created_at)?.slice(0,10) || 'Unknown';
    if (!groupMap[date]) {
      groupMap[date] = [];
      groups.push({ date, shots: groupMap[date] });
    }
    groupMap[date].push(s);
  });

  return `
    <div class="session-sort-bar">
      Sort: <button class="sort-micro-btn" onclick="sortRawTable('shot_time')">Date ${analysisRawSort.col==='shot_time'?(analysisRawSort.dir>0?'↑':'↓'):''}</button>
      <button class="sort-micro-btn" onclick="sortRawTable('carry')">Carry ${analysisRawSort.col==='carry'?(analysisRawSort.dir>0?'↑':'↓'):''}</button>
      <button class="sort-micro-btn" onclick="sortRawTable('smash_factor')">Smash ${analysisRawSort.col==='smash_factor'?(analysisRawSort.dir>0?'↑':'↓'):''}</button>
    </div>
    ${groups.map(g => renderSessionGroup(g, colorMap)).join('')}
  `;
}

function renderSessionGroup(group, colorMap) {
  const { date, shots } = group;
  const sessionCol = colorMap[date] || '#8a9099';
  const isOpen = openSessions.has(date);

  const carries = shots.map(s=>s.carry).filter(Boolean);
  const avgCarry = carries.length ? (carries.reduce((a,b)=>a+b,0)/carries.length).toFixed(1) : '–';
  const avgFace = statAvg(shots.map(s=>s.face_angle).filter(x=>x!=null));
  const faceSD = statStdDev(shots.map(s=>s.face_angle).filter(x=>x!=null));
  const avgSmash = statAvg(shots.map(s=>s.smash_factor).filter(Boolean));

  const facePart = avgFace!=null
    ? `face ${avgFace>0?'+':''}${avgFace.toFixed(1)}° ±${faceSD!=null?faceSD.toFixed(1):'–'}°`
    : '–';

  // Fault frequency summary
  const faultSummary = renderFaultFrequency(shots);

  return `
    <div class="session-group" id="session-group-${date}">
      <div class="session-head${isOpen?' open':''}" id="session-head-${date}"
           onclick="toggleSession('${date}')">
        <span class="session-dot" style="background:${sessionCol}"></span>
        <span class="session-date">${date}</span>
        <span class="session-meta">${shots.length} shots · ${avgCarry}m · ${facePart} · smash ${f(avgSmash,2)}</span>
        <span class="session-chevron">${isOpen?'▲':'▼'}</span>
      </div>
      <div class="session-body" id="session-body-${date}" style="display:${isOpen?'block':'none'};">
        <div class="session-load-btn-wrap">
          <button class="load-into-coach-btn-sm" onclick="loadAnalysisSessionIntoCoach('${date}')">
            Load ${date} into Coach
          </button>
        </div>
        ${faultSummary}
        ${renderShotRows(shots, sessionCol)}
      </div>
    </div>`;
}

// ── Fault frequency summary ────────────────────────────────────────────────
function renderFaultFrequency(shots) {
  const faces = shots.map(s=>s.face_angle).filter(x=>x!=null);
  const attacks = shots.map(s=>s.attack_angle).filter(x=>x!=null);
  if(!faces.length) return '';

  const openFace = faces.filter(f=>f>3).length;
  const closedFace = faces.filter(f=>f<-3).length;
  const solidFace = faces.length - openFace - closedFace;
  const total = faces.length;

  const downCount = attacks.filter(a=>a<=-2).length;
  const levelCount = attacks.filter(a=>a>-2&&a<=0).length;
  const scopeCount = attacks.filter(a=>a>0).length;

  const pct = (n,t) => t?Math.round(n/t*100)+'%':'–';

  const faceRows = [
    { label:'Face open >+3°', n:openFace, cls:'fault-bad' },
    { label:'Face closed <−3°', n:closedFace, cls:'fault-bad' },
    { label:'Face solid ±3°', n:solidFace, cls:'fault-good' },
  ].filter(r=>r.n>0);

  const attackRows = attacks.length ? [
    { label:'Hitting down ≤−2°', n:downCount, cls:'fault-good' },
    { label:'Level −2°–0°', n:levelCount, cls:'fault-warn' },
    { label:'Scooping >0°', n:scopeCount, cls:'fault-bad' },
  ].filter(r=>r.n>0) : [];

  return `<div class="fault-summary">
    <div class="fault-col">
      <div class="fault-col-label">Face angle</div>
      ${faceRows.map(r=>`<div class="fault-row ${r.cls}">
        <span class="fault-label">${r.label}</span>
        <span class="fault-count">${r.n} <span class="fault-pct">${pct(r.n,total)}</span></span>
      </div>`).join('')}
    </div>
    ${attackRows.length?`<div class="fault-col">
      <div class="fault-col-label">Attack angle</div>
      ${attackRows.map(r=>`<div class="fault-row ${r.cls}">
        <span class="fault-label">${r.label}</span>
        <span class="fault-count">${r.n} <span class="fault-pct">${pct(r.n,attacks.length)}</span></span>
      </div>`).join('')}
    </div>`:''}
  </div>`;
}

function toggleSession(date) {
  const body = document.getElementById(`session-body-${date}`);
  const head = document.getElementById(`session-head-${date}`);
  if (!body || !head) return;
  const isOpen = openSessions.has(date);
  if (isOpen) {
    openSessions.delete(date);
    body.style.display = 'none';
    head.classList.remove('open');
    head.querySelector('.session-chevron').textContent = '▼';
  } else {
    openSessions.add(date);
    body.style.display = 'block';
    head.classList.add('open');
    head.querySelector('.session-chevron').textContent = '▲';
  }
}

function renderShotRows(shots, sessionCol) {
  return `<div class="analysis-raw-wrap">
    <table class="analysis-raw-table">
      <thead><tr>
        <th>Time</th>
        <th>Carry</th><th>Smash</th>
        <th>Face</th><th>Path</th><th>FTP</th>
        <th>Atk</th><th>Launch</th><th>Spin</th><th>Side</th>
        <th>Full</th><th>Prog</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>
        ${shots.map(s => renderShotRow(s, sessionCol)).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderShotRow(s, sessionCol) {
  const time = s.shot_time ? new Date(s.shot_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : (s.created_at ? new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '');
  if (s.id === editingRowId) {
    return `<tr class="shot-row shot-row-editing" data-id="${s.id}">
      <td><span class="shot-time">${time}</span></td>
      <td>${f(s.carry,1)}</td><td>${f(s.smash_factor,2)}</td>
      <td>${fSign(s.face_angle,1)}</td><td>${fSign(s.club_path,1)}</td><td>${fSign(s.face_to_path,1)}</td>
      <td>${fSign(s.attack_angle,1)}</td><td>${f(s.launch_angle,1)}</td>
      <td>${s.spin_rate?Math.round(s.spin_rate):'–'}</td><td>${fSign(s.side,1)}</td>
      <td><select id="edit-full-${s.id}" class="edit-select">
        <option value="1"${s.is_full_shot!==false?' selected':''}>✓</option>
        <option value="0"${s.is_full_shot===false?' selected':''}>–</option>
      </select></td>
      <td><select id="edit-excl-${s.id}" class="edit-select">
        <option value="0"${!s.exclude_from_progress?' selected':''}>Incl</option>
        <option value="1"${s.exclude_from_progress?' selected':''}>Excl</option>
      </select></td>
      <td><input id="edit-notes-${s.id}" class="edit-notes-input" type="text" value="${escapeHtml(s.notes||'')}" placeholder="Notes…"></td>
      <td class="shot-actions">
        <button class="shot-action-btn shot-save" onclick="saveEditRow('${s.id}')">✓</button>
        <button class="shot-action-btn shot-cancel" onclick="cancelEditRow()">✕</button>
      </td>
    </tr>`;
  }
  return `<tr class="shot-row" data-id="${s.id}">
    <td><span class="shot-time">${time}</span></td>
    <td>${f(s.carry,1)}</td>
    <td>${f(s.smash_factor,2)}</td>
    <td class="${faceCol(s.face_angle)}">${fSign(s.face_angle,1)}</td>
    <td>${fSign(s.club_path,1)}</td>
    <td class="${ftpCol(s.face_to_path)}">${fSign(s.face_to_path,1)}</td>
    <td>${fSign(s.attack_angle,1)}</td>
    <td>${f(s.launch_angle,1)}</td>
    <td>${s.spin_rate?Math.round(s.spin_rate):'–'}</td>
    <td>${fSign(s.side,1)}</td>
    <td class="${s.is_full_shot===false?'cell-dim':'cell-good-dim'}">${s.is_full_shot===false?'–':'✓'}</td>
    <td class="${s.exclude_from_progress?'cell-warn':''}">${s.exclude_from_progress?'Excl':''}</td>
    <td class="shot-notes">${escapeHtml(s.notes||'')}</td>
    <td class="shot-actions">
      <button class="shot-action-btn shot-edit" onclick="startEditRow('${s.id}')">Edit</button>
    </td>
  </tr>`;
}

function faceCol(v){return v==null?'':Math.abs(v)<=2?'cell-good':Math.abs(v)<=4?'cell-warn':'cell-bad';}
function ftpCol(v){return v==null?'':Math.abs(v)<=3?'cell-good':Math.abs(v)<=6?'cell-warn':'cell-bad';}

function sortShots(shots,col,dir){
  return shots.sort((a,b)=>{const av=a[col],bv=b[col];if(av==null)return 1;if(bv==null)return -1;return(av<bv?-1:av>bv?1:0)*dir;});
}
function sortRawTable(col){
  analysisRawSort=analysisRawSort.col===col?{col,dir:analysisRawSort.dir*-1}:{col,dir:-1};
  renderAnalysis(analysisShots);
}
function startEditRow(id){
  editingRowId=id;renderAnalysis(analysisShots);
  requestAnimationFrame(()=>document.querySelector(`tr[data-id="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'}));
}
function cancelEditRow(){editingRowId=null;renderAnalysis(analysisShots);}
async function saveEditRow(id){
  const fullEl=document.getElementById(`edit-full-${id}`);
  const exclEl=document.getElementById(`edit-excl-${id}`);
  const notesEl=document.getElementById(`edit-notes-${id}`);
  if(!fullEl||!exclEl||!notesEl)return;
  const{data:_ad}=await window.supabaseClient.auth.getSession();
  const uid=_ad?.session?.user?.id;
  if(!uid){showToast('Not logged in');return;}
  const updates={is_full_shot:fullEl.value==='1',exclude_from_progress:exclEl.value==='1',notes:notesEl.value.trim()||null};
  const{error}=await window.supabaseClient.from('trackman_shots').update(updates).eq('id',id).eq('user_id',uid);
  if(error){showToast('Save failed: '+error.message);return;}
  [analysisShots,_allFetchedShots].forEach(arr=>{
    const idx=arr.findIndex(s=>s.id===id);
    if(idx!==-1)arr[idx]={...arr[idx],...updates};
  });
  editingRowId=null;showToast('Saved ✓');renderAnalysis(analysisShots);
}

// ── Shot Maps ─────────────────────────────────────────────────────────────
function renderShotMaps(shots, allShots) {
  const colorMap = buildSessionColorMap(allShots);
  const allDates = [...new Set(shots.map(s => (s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))].sort();

  // Init or prune stale dates
  if (analysisMapActiveDates === null || ![...analysisMapActiveDates].some(d => allDates.includes(d))) {
    analysisMapActiveDates = new Set(allDates);
  } else {
    [...analysisMapActiveDates].forEach(d => { if (!allDates.includes(d)) analysisMapActiveDates.delete(d); });
  }

  const pills = allDates.map(d => {
    const col = colorMap[d] || '#8a9099';
    const on = analysisMapActiveDates.has(d);
    return `<button class="map-date-pill${on?' on':''}" style="--pill-color:${col}" onclick="toggleMapDate('${d}')">${d.slice(5)}</button>`;
  }).join('');

  const allOn = analysisMapActiveDates.size === allDates.length;
  return `
    <div class="map-date-filter" id="map-date-filter">
      <span class="map-date-label">Sessions:</span>
      <button class="map-date-pill map-date-all${allOn?' on':''}" onclick="selectAllMapDates()">All</button>
      ${pills}
    </div>
    <div class="map-chart-block">
      <div class="map-chart-title">Top View &nbsp;·&nbsp; landing zone (carry &amp; lateral)</div>
      <canvas id="top-view-canvas" height="230" style="width:100%;display:block;border-radius:10px;background:var(--canvas-bg);margin-top:4px;"></canvas>
    </div>
    <div class="map-chart-block" style="margin-top:14px;">
      <div class="map-chart-title">Side View &nbsp;·&nbsp; ball flight &amp; roll</div>
      <canvas id="side-view-canvas" height="165" style="width:100%;display:block;border-radius:10px;background:var(--canvas-bg);margin-top:4px;"></canvas>
    </div>`;
}

function toggleMapDate(date) {
  if (!analysisMapActiveDates) return;
  if (analysisMapActiveDates.has(date)) {
    if (analysisMapActiveDates.size > 1) analysisMapActiveDates.delete(date);
  } else {
    analysisMapActiveDates.add(date);
  }
  _redrawMaps();
}

function selectAllMapDates() {
  const shots = applyFilter(analysisShots);
  const allDates = [...new Set(shots.map(s => (s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))];
  analysisMapActiveDates = new Set(allDates);
  _redrawMaps();
}

function _redrawMaps() {
  const shots = applyFilter(analysisShots);
  const colorMap = buildSessionColorMap(analysisShots);
  const allDates = [...new Set(shots.map(s => (s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))].sort();
  const allOn = analysisMapActiveDates.size === allDates.length;

  // Update pill states without full re-render
  const filterEl = document.getElementById('map-date-filter');
  if (filterEl) {
    filterEl.querySelectorAll('.map-date-pill').forEach(btn => btn.classList.remove('on'));
    if (allOn) filterEl.querySelector('.map-date-all')?.classList.add('on');
    allDates.forEach(d => {
      if (analysisMapActiveDates.has(d)) {
        // find by onclick attribute
        const btn = [...filterEl.querySelectorAll('.map-date-pill')].find(b => b.getAttribute('onclick')?.includes(d));
        if (btn) btn.classList.add('on');
      }
    });
  }

  const active = shots.filter(s => analysisMapActiveDates.has((s.shot_time||s.created_at)?.slice(0,10)));
  drawTopViewMap(active, colorMap);
  drawSideViewMap(active, colorMap);
}

function drawTopViewMap(shots, colorMap) {
  const canvas = document.getElementById('top-view-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio||2, 3);
  const w = canvas.parentElement?.clientWidth || 340, h = 320;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cv = _cv();

  const valid = shots.filter(s => s.carry != null && s.side != null);

  // Always draw background even with no data
  ctx.fillStyle = cv.rough1;
  ctx.fillRect(0, 0, w, h);

  if (!valid.length) {
    ctx.fillStyle=cv.dim; ctx.font="13px 'Barlow',sans-serif"; ctx.textAlign='center';
    ctx.fillText('No lateral (side) data for this club', w/2, h/2); return;
  }

  const carries = valid.map(s=>s.carry), sides = valid.map(s=>s.side);
  const avgCarry = statAvg(carries);
  const sdCarry = Math.max(statStdDev(carries)||5, 5);
  const maxAbsSide = Math.max(...sides.map(Math.abs), 8);

  const pad = {t:22, r:14, b:28, l:46};
  const cw = w-pad.l-pad.r, ch = h-pad.t-pad.b;

  const sideRange = Math.max(maxAbsSide * 1.35, 12);
  const carryRange = Math.max(sdCarry * 4.5, 20);
  const carryMin = avgCarry - carryRange * 0.45;
  const carryMax = carryMin + carryRange;

  const px = sv  => pad.l + cw * (sv + sideRange) / (sideRange * 2);
  const py = cvv => pad.t + ch - ch * (cvv - carryMin) / (carryMax - carryMin);
  const mPerPxX = (sideRange*2)/cw, mPerPxY = carryRange/ch;

  // ── 1. Rough background (striped) ─────────────────────────────────────
  const roughH = 18;
  for (let i = 0; i * roughH < h; i++) {
    ctx.fillStyle = i%2===0 ? cv.rough1 : cv.rough2;
    ctx.fillRect(0, i*roughH, w, roughH);
  }

  // ── 2. Fairway corridor (25 m wide, centred) ──────────────────────────
  const fairwayM = 25;
  const fwL = Math.max(pad.l,   px(-fairwayM/2));
  const fwR = Math.min(pad.l+cw, px( fairwayM/2));
  const fwW = fwR - fwL;
  if (fwW > 8) {
    const fwH = 22;
    for (let i = 0; i * fwH < h; i++) {
      ctx.fillStyle = i%2===0 ? cv.fw1 : cv.fw2;
      ctx.fillRect(fwL, i*fwH, fwW, fwH);
    }
    // Soft edges
    const fadeW = Math.min(10, fwW * 0.12);
    const gradL = ctx.createLinearGradient(fwL, 0, fwL+fadeW, 0);
    gradL.addColorStop(0, cv.fwEdge); gradL.addColorStop(1, 'transparent');
    ctx.fillStyle = gradL; ctx.fillRect(fwL, 0, fadeW, h);
    const gradR = ctx.createLinearGradient(fwR, 0, fwR-fadeW, 0);
    gradR.addColorStop(0, cv.fwEdge); gradR.addColorStop(1, 'transparent');
    ctx.fillStyle = gradR; ctx.fillRect(fwR-fadeW, 0, fadeW, h);
  }

  // ── 3. Target green area ───────────────────────────────────────────────
  const cx0 = px(0), cy0 = py(avgCarry);
  const greenRx = Math.max(6/mPerPxX, 12), greenRy = Math.max(6/mPerPxY, 9);

  // Glow halo
  const halo = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, greenRx*2.2);
  halo.addColorStop(0, 'rgba(40,190,80,0.22)');
  halo.addColorStop(1, 'rgba(40,190,80,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.ellipse(cx0, cy0, greenRx*2.2, greenRy*2.2, 0, 0, Math.PI*2); ctx.fill();

  // Green circle
  ctx.fillStyle = cv.greenFill;
  ctx.strokeStyle = cv.greenStr; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx0, cy0, greenRx, greenRy, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Flag pole + flag
  const poleTop = cy0 - greenRy * 0.85;
  ctx.strokeStyle=cv.flagPole; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx0, cy0-2); ctx.lineTo(cx0, poleTop-10); ctx.stroke();
  ctx.fillStyle='rgba(220,50,50,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx0, poleTop-10);
  ctx.lineTo(cx0+10, poleTop-6);
  ctx.lineTo(cx0, poleTop-2);
  ctx.closePath(); ctx.fill();

  // ── 4. Carry grid labels ──────────────────────────────────────────────
  ctx.font = "9px 'DM Mono',monospace";
  const carryStep = Math.ceil(carryRange/4/5)*5;
  const cFirst = Math.ceil(carryMin/carryStep)*carryStep;
  for (let c=cFirst; c<=carryMax; c+=carryStep) {
    const y = py(c);
    ctx.strokeStyle=cv.grid; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+cw, y); ctx.stroke();
    ctx.fillStyle=cv.dim; ctx.textAlign='right';
    ctx.fillText(Math.round(c)+'m', pad.l-4, y+3);
  }

  // ── 5. Centre / target line ───────────────────────────────────────────
  ctx.strokeStyle=cv.center; ctx.lineWidth=1; ctx.setLineDash([4,5]);
  ctx.beginPath(); ctx.moveTo(px(0), pad.t); ctx.lineTo(px(0), pad.t+ch); ctx.stroke();
  ctx.setLineDash([]);

  // ── 6. Target dot (pin position) ─────────────────────────────────────
  ctx.fillStyle='rgba(0,214,143,0.85)';
  ctx.beginPath(); ctx.arc(cx0, cy0, 4.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,214,143,0.35)'; ctx.lineWidth=2; ctx.beginPath();
  ctx.arc(cx0, cy0, 7, 0, Math.PI*2); ctx.stroke();

  // ── 7. Shot dots ──────────────────────────────────────────────────────
  valid.forEach(s => {
    const date = (s.shot_time||s.created_at)?.slice(0,10)||'';
    const col = colorMap[date]||'#8a9099';
    const x = px(s.side), y = py(s.carry);
    if (x<pad.l-4||x>pad.l+cw+4||y<pad.t-4||y>pad.t+ch+4) return;
    ctx.fillStyle=col; ctx.globalAlpha=0.82;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.35; ctx.strokeStyle=col; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI*2); ctx.stroke();
  });
  ctx.globalAlpha=1;

  // ── 8. Axis labels ────────────────────────────────────────────────────
  ctx.fillStyle=cv.dim; ctx.font="9px 'DM Mono',monospace"; ctx.textAlign='center';
  ctx.fillText('← L', pad.l+cw*0.12, pad.t+ch+18);
  ctx.fillText('0',   pad.l+cw*0.5,  pad.t+ch+18);
  ctx.fillText('R →', pad.l+cw*0.88, pad.t+ch+18);
}

function drawSideViewMap(shots, colorMap) {
  const canvas = document.getElementById('side-view-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio||2, 3);
  const w = canvas.parentElement?.clientWidth || 340, h = 165;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cv = _cv();

  // Sky gradient + ground strip background
  const groundY = h - 28;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, cv.skyTop); skyGrad.addColorStop(1, cv.skyBot);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = cv.groundStrip; ctx.fillRect(0, groundY, w, h - groundY);

  const valid = shots.filter(s => s.carry != null);
  if (!valid.length) {
    ctx.fillStyle=cv.dim; ctx.font="13px 'Barlow',sans-serif"; ctx.textAlign='center';
    ctx.fillText('No carry data', w/2, h/2); return;
  }

  const carries = valid.map(s=>s.carry);
  const totals  = valid.map(s=>s.total||s.carry);
  const heights = valid.map(s=>s.max_height).filter(Boolean);

  const avgCarry = statAvg(carries);
  const avgTotal = statAvg(totals);
  const avgApex  = heights.length ? statAvg(heights) : avgCarry * 0.13;
  const maxTotal = Math.max(...totals) * 1.06;
  const maxHeight = (heights.length ? Math.max(...heights) : avgApex * 1.4) * 1.15;

  const pad = {t:22, r:16, b:28, l:12};
  const cw = w-pad.l-pad.r, ch = h-pad.t-pad.b;

  const px = d  => pad.l + (d/maxTotal)*cw;
  const py = ht => pad.t + ch - (ht/maxHeight)*ch;

  // Ground line
  ctx.strokeStyle=cv.ground; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad.l,py(0)); ctx.lineTo(pad.l+cw,py(0)); ctx.stroke();

  // Distance grid
  ctx.font="9px 'DM Mono',monospace"; ctx.fillStyle=cv.dim;
  const distStep = Math.ceil(maxTotal/4/5)*5;
  for (let d=distStep; d<=maxTotal; d+=distStep) {
    const x=px(d);
    ctx.strokeStyle=cv.grid; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,py(0)); ctx.stroke();
    ctx.fillStyle=cv.dim; ctx.textAlign='center'; ctx.fillText(Math.round(d)+'m', x, py(0)+17);
  }

  // Draw each shot arc (faint)
  valid.forEach(s => {
    const date=(s.shot_time||s.created_at)?.slice(0,10)||'';
    const col=colorMap[date]||'#8a9099';
    const carry=s.carry, total=s.total||carry;
    const apex=s.max_height||avgApex;

    // Quadratic bezier: control point gives exact peak at t=0.5
    // cpY = pad.t + ch*(1 - 2*apex/maxHeight); cpX = px(carry*0.40)
    const cpX=px(carry*0.40);
    const cpY=Math.max(2, pad.t + ch*(1 - 2*apex/maxHeight));

    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.globalAlpha=0.42;
    ctx.beginPath(); ctx.moveTo(px(0),py(0));
    ctx.quadraticCurveTo(cpX, cpY, px(carry), py(0));
    ctx.stroke();

    // Roll
    if (total > carry+0.5) {
      ctx.globalAlpha=0.28; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(px(carry),py(0)); ctx.lineTo(px(total),py(0)); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha=1;
  });

  // Average arc (bold green)
  const avgCpX=px(avgCarry*0.40);
  const avgCpY=Math.max(2, pad.t + ch*(1 - 2*avgApex/maxHeight));
  ctx.strokeStyle='#00d68f'; ctx.lineWidth=2.5; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.moveTo(px(0),py(0));
  ctx.quadraticCurveTo(avgCpX, avgCpY, px(avgCarry), py(0));
  ctx.stroke();

  if (avgTotal > avgCarry+0.5) {
    ctx.globalAlpha=0.55; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(px(avgCarry),py(0)); ctx.lineTo(px(avgTotal),py(0)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1;

  // Label
  ctx.fillStyle=cv.dim; ctx.font="10px 'Barlow',sans-serif"; ctx.textAlign='left';
  let lbl = `Avg carry ${f(avgCarry)}m`;
  if (avgTotal > avgCarry+0.5) lbl += `  · roll ${f(avgTotal-avgCarry)}m`;
  if (heights.length) lbl += `  · apex ${f(avgApex)}m`;
  ctx.fillText(lbl, pad.l+2, pad.t-6);
}

// ── Alias Manager ──────────────────────────────────────────────────────────
async function renderAliasManager(){
  const el=document.getElementById('alias-manager');if(!el)return;
  const{data:_ad}=await window.supabaseClient.auth.getSession();
  if(!_ad?.session?.user){
    el.innerHTML='<div class="alias-msg" style="padding:8px 0;">Log in to manage club aliases.</div>';
    return;
  }
  await CA().loadAliases();
  const unknowns=CA().findUnknownClubNames(_allFetchedShots);
  const defs=CA().CLUB_DEFINITIONS;
  el.innerHTML=`
    <p class="alias-intro">Maps raw Trackman names → canonical clubs. One place, everything reads from here.</p>
    ${unknowns.length?`<div class="alias-unknown-box">
      <div class="alias-unknown-title">⚠ Unmapped in your data</div>
      <div class="alias-unknown-list">${unknowns.map(u=>`<div class="alias-unknown-row">
        <span class="alias-raw-name">${escapeHtml(u)}</span>
        <select id="alias-sel-${btoa(encodeURIComponent(u)).replace(/[^a-z0-9]/gi,'')}" class="alias-key-select">
          <option value="">— assign —</option>
          ${defs.map(d=>`<option value="${d.key}">${d.label}</option>`).join('')}
        </select>
        <button class="alias-add-btn" onclick="quickAddAlias('${escapeHtml(u)}','alias-sel-${btoa(encodeURIComponent(u)).replace(/[^a-z0-9]/gi,'')}')">Add</button>
      </div>`).join('')}</div>
    </div>`:`<div class="alias-all-mapped">✓ All club names mapped</div>`}
    <div class="alias-section-title" style="margin-top:14px;">Current Mappings</div>
    <div class="alias-table-wrap"><table class="alias-table">
      <thead><tr><th>Raw Trackman Name</th><th>Club</th><th></th></tr></thead>
      <tbody>${defs.map(d=>{
        const raws=CA().getRawNamesForKey(d.key);
        if(!raws.length)return`<tr class="alias-row-empty"><td colspan="3"><span class="alias-key-label">${d.label}</span> — none yet</td></tr>`;
        return raws.map(raw=>{
          const isGlobal=CA().isGlobalAlias(raw);
          return`<tr class="alias-row">
            <td class="alias-raw">${escapeHtml(raw)}${isGlobal?` <span class="alias-global-badge" title="Shared alias — visible to all users">global</span>`:''}
            </td>
            <td><span class="alias-key-badge">${d.label}</span></td>
            <td>${isGlobal
              ?`<span class="alias-global-lock" title="Global aliases cannot be deleted">🔒</span>`
              :`<button class="alias-del-btn" onclick="deleteAliasRow('${escapeHtml(raw)}')">✕</button>`}
            </td>
          </tr>`;
        }).join('');
      }).join('')}</tbody>
    </table></div>
    <div class="alias-add-form">
      <div class="alias-section-title">Add personal alias</div>
      <div class="alias-add-row">
        <input id="alias-new-raw" type="text" placeholder="Raw name (e.g. '7 Iron')">
        <select id="alias-new-key" class="alias-key-select">
          <option value="">— club —</option>
          ${defs.map(d=>`<option value="${d.key}">${d.label}</option>`).join('')}
        </select>
        <button class="alias-add-btn" onclick="manualAddAlias()">Add</button>
      </div>
      <div id="alias-msg" class="alias-msg"></div>
    </div>`;
}
async function quickAddAlias(rawName,selectId){const sel=document.getElementById(selectId);if(!sel?.value){showAliasMsg('Select a club');return;}const res=await CA().addAlias(rawName,sel.value);if(!res.ok){showAliasMsg('Error: '+res.msg);return;}showAliasMsg('Added ✓');renderAliasManager();}
async function manualAddAlias(){const r=document.getElementById('alias-new-raw');const k=document.getElementById('alias-new-key');if(!r?.value.trim()){showAliasMsg('Enter a name');return;}if(!k?.value){showAliasMsg('Select a club');return;}const res=await CA().addAlias(r.value.trim(),k.value);if(!res.ok){showAliasMsg('Error: '+res.msg);return;}r.value='';showAliasMsg('Added ✓');renderAliasManager();}
async function deleteAliasRow(raw){const res=await CA().deleteAlias(raw);if(!res.ok){showAliasMsg('Error: '+res.msg);return;}showAliasMsg('Removed ✓');renderAliasManager();}
function showAliasMsg(m){const el=document.getElementById('alias-msg');if(el){el.textContent=m;setTimeout(()=>{if(el)el.textContent='';},3000);}}

// ── Expose ─────────────────────────────────────────────────────────────────
window.initAnalysisTab        = initAnalysisTab;
window.setAnalysisClub        = setAnalysisClub;
window.setAnalysisFilter      = setAnalysisFilter;
window.switchProgChart        = switchProgChart;
window.sortRawTable           = sortRawTable;
window.startEditRow           = startEditRow;
window.cancelEditRow          = cancelEditRow;
window.saveEditRow            = saveEditRow;
window.loadAnalysis           = loadAnalysis;
window.toggleSession          = toggleSession;
window.loadAnalysisSessionIntoCoach = loadAnalysisSessionIntoCoach;
window.renderAliasManager     = renderAliasManager;
window.quickAddAlias          = quickAddAlias;
window.manualAddAlias         = manualAddAlias;
window.deleteAliasRow         = deleteAliasRow;
window.toggleMapDate          = toggleMapDate;
window.selectAllMapDates      = selectAllMapDates;
