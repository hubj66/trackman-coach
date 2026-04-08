// analysis.js — Analysis tab: deep dive into one club

// ── State ──────────────────────────────────────────────────────────────────
let analysisClub = '7i';
let analysisFilter = 'progress'; // 'all' | 'full' | 'progress' | 'full_progress'
let analysisShots = [];
let analysisRawSort = { col: 'created_at', dir: -1 };

const ANALYSIS_CLUBS = [
  { key: '4i', label: '4i' },
  { key: '5i', label: '5i' },
  { key: '6i', label: '6i' },
  { key: '7i', label: '7i' },
  { key: '8i', label: '8i' },
  { key: '9i', label: '9i' },
  { key: 'pw', label: 'PW' },
  { key: 'sw', label: 'SW' },
  { key: '58', label: '58°' },
];

const FILTER_OPTIONS = [
  { key: 'all',          label: 'All shots' },
  { key: 'full',         label: 'Full swings' },
  { key: 'progress',     label: 'Progress shots' },
  { key: 'full_progress', label: 'Full + Progress' },
];

// ── Init ───────────────────────────────────────────────────────────────────
function initAnalysisTab() {
  const el = document.getElementById('analysis-club-tabs');
  if (!el) return;
  el.innerHTML = ANALYSIS_CLUBS.map(c =>
    `<button class="atab${c.key === analysisClub ? ' on' : ''}"
      onclick="setAnalysisClub('${c.key}')">${c.label}</button>`
  ).join('');

  const fil = document.getElementById('analysis-filter-tabs');
  if (fil) fil.innerHTML = FILTER_OPTIONS.map(f =>
    `<button class="filter-tab${f.key === analysisFilter ? ' on' : ''}"
      onclick="setAnalysisFilter('${f.key}')">${f.label}</button>`
  ).join('');

  loadAnalysis();
}

function setAnalysisClub(key) {
  analysisClub = key;
  document.querySelectorAll('.atab').forEach(t => t.classList.toggle('on', t.textContent === ANALYSIS_CLUBS.find(c => c.key === key)?.label));
  loadAnalysis();
}

function setAnalysisFilter(key) {
  analysisFilter = key;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('on', t.dataset.key === key || t.textContent === FILTER_OPTIONS.find(f => f.key === key)?.label));
  renderAnalysis(analysisShots);
}

// ── Data loading ───────────────────────────────────────────────────────────
async function loadAnalysis() {
  const el = document.getElementById('analysis-content');
  if (!el) return;
  el.innerHTML = '<div class="analysis-loading">Loading…</div>';

  const sb = window.supabaseClient;
  const { data, error } = await sb
    .from('trackman_shots')
    .select('id,club,carry,total,side,total_side,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,launch_direction,attack_angle,club_path,face_angle,face_to_path,dyn_loft,spin_loft,spin_axis,max_height,landing_angle,hang_time,notes,is_full_shot,exclude_from_progress,shot_type,strike_quality,created_at')
    .ilike('club', `%${analysisClub}%`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    el.innerHTML = `<div class="analysis-empty">Error: ${escapeHtml(error.message)}</div>`;
    return;
  }

  analysisShots = data || [];
  renderAnalysis(analysisShots);
}

function applyFilter(shots) {
  switch (analysisFilter) {
    case 'full':         return shots.filter(s => s.is_full_shot !== false);
    case 'progress':     return shots.filter(s => s.exclude_from_progress !== true);
    case 'full_progress': return shots.filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true);
    default:             return shots;
  }
}

// ── Main render ────────────────────────────────────────────────────────────
function renderAnalysis(allShots) {
  const el = document.getElementById('analysis-content');
  if (!el) return;

  const shots = applyFilter(allShots);

  if (!shots.length) {
    el.innerHTML = `<div class="analysis-empty">No ${analysisClub} shots found for this filter.<br><small>Try "All shots" or upload a session.</small></div>`;
    return;
  }

  el.innerHTML = `
    ${renderOverviewKPIs(shots)}
    ${renderConsistencyMetrics(shots)}
    ${renderDirectionPattern(shots)}
    ${renderDistanceControl(shots)}
    ${renderProgressSection(allShots)}
    ${renderRawTable(shots)}
  `;

  drawProgressCharts(allShots);
  setupTableSort(shots);
}

// ── Stat helpers ───────────────────────────────────────────────────────────
function statAvg(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function statMedian(arr) {
  const v = arr.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m-1] + v[m]) / 2;
}
function statStdDev(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  if (v.length < 2) return null;
  const a = statAvg(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
}
function statPercentile(arr, p) {
  const v = arr.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (p / 100) * (v.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (idx - lo);
}
function f(v, dp = 1) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return Number(v).toFixed(dp);
}
function fSign(v, dp = 1) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return (v > 0 ? '+' : '') + Number(v).toFixed(dp);
}

// ── 1. Overview KPIs ───────────────────────────────────────────────────────
function renderOverviewKPIs(shots) {
  const carries = shots.map(s => s.carry).filter(Boolean);
  const smashes = shots.map(s => s.smash_factor).filter(Boolean);
  const bspeeds = shots.map(s => s.ball_speed).filter(Boolean);
  const cspeeds = shots.map(s => s.club_speed).filter(Boolean);
  const spins   = shots.map(s => s.spin_rate).filter(Boolean);
  const launches= shots.map(s => s.launch_angle).filter(Boolean);

  const kpis = [
    { l: 'Shots',        v: shots.length,           unit: '',     dp: 0 },
    { l: 'Avg Carry',    v: statAvg(carries),        unit: 'm',    dp: 1 },
    { l: 'Median Carry', v: statMedian(carries),     unit: 'm',    dp: 1 },
    { l: 'Carry StdDev', v: statStdDev(carries),     unit: 'm',    dp: 1 },
    { l: 'Avg Smash',    v: statAvg(smashes),        unit: '',     dp: 2 },
    { l: 'Avg Ball Spd', v: statAvg(bspeeds),        unit: ' mph', dp: 1 },
    { l: 'Avg Club Spd', v: statAvg(cspeeds),        unit: ' mph', dp: 1 },
    { l: 'Avg Spin',     v: statAvg(spins),          unit: ' rpm', dp: 0 },
    { l: 'Avg Launch',   v: statAvg(launches),       unit: '°',    dp: 1 },
  ];

  return `<div class="analysis-section">
    <div class="analysis-section-title">Overview</div>
    <div class="analysis-kpi-grid">
      ${kpis.map(k => `
        <div class="analysis-kpi-card">
          <div class="analysis-kpi-label">${k.l}</div>
          <div class="analysis-kpi-value">${k.v === shots.length ? k.v : f(k.v, k.dp)}${k.v !== null && k.v !== shots.length ? k.unit : ''}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── 2. Consistency metrics ─────────────────────────────────────────────────
function renderConsistencyMetrics(shots) {
  const rows = [
    { l: 'Carry StdDev',   v: statStdDev(shots.map(s => s.carry)),        unit: 'm' },
    { l: 'Face StdDev',    v: statStdDev(shots.map(s => s.face_angle)),    unit: '°' },
    { l: 'Path StdDev',    v: statStdDev(shots.map(s => s.club_path)),     unit: '°' },
    { l: 'Launch StdDev',  v: statStdDev(shots.map(s => s.launch_angle)),  unit: '°' },
    { l: 'Spin StdDev',    v: statStdDev(shots.map(s => s.spin_rate)),     unit: ' rpm' },
    { l: 'Smash StdDev',   v: statStdDev(shots.map(s => s.smash_factor)), unit: '' },
  ];

  return `<div class="analysis-section">
    <div class="analysis-section-title">Consistency</div>
    <div class="analysis-row-list">
      ${rows.map(r => `
        <div class="analysis-row">
          <span class="analysis-row-label">${r.l}</span>
          <span class="analysis-row-value">${f(r.v, r.unit === ' rpm' ? 0 : (r.unit === '' ? 3 : 1))}${r.v != null ? r.unit : ''}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── 3. Direction / Miss pattern ─────────────────────────────────────────────
function renderDirectionPattern(shots) {
  const faces  = shots.map(s => s.face_angle).filter(x => x != null);
  const paths  = shots.map(s => s.club_path).filter(x => x != null);
  const ftps   = shots.map(s => s.face_to_path).filter(x => x != null);
  const sides  = shots.map(s => s.side).filter(x => x != null);

  const avgFace = statAvg(faces);
  const avgPath = statAvg(paths);
  const avgFTP  = statAvg(ftps);
  const avgSide = statAvg(sides);

  const left  = sides.filter(s => s < -2).length;
  const right = sides.filter(s => s > 2).length;
  const total = sides.length || 1;

  const missTendency = (() => {
    if (!avgFTP) return '–';
    if (avgFTP > 3)  return avgPath > 3 ? 'Push Draw' : 'Draw';
    if (avgFTP < -3) return avgPath < -3 ? 'Pull Fade' : 'Fade';
    if (avgFace > 2) return avgPath > 0 ? 'Push' : 'Push Fade';
    if (avgFace < -2) return avgPath < 0 ? 'Pull' : 'Pull Draw';
    return 'Straight';
  })();

  const rows = [
    { l: 'Avg Face Angle',   v: fSign(avgFace), unit: '°' },
    { l: 'Avg Club Path',    v: fSign(avgPath), unit: '°' },
    { l: 'Avg Face-to-Path', v: fSign(avgFTP),  unit: '°' },
    { l: 'Avg Side',         v: fSign(avgSide), unit: 'm' },
    { l: '% Left',           v: ((left/total)*100).toFixed(0), unit: '%' },
    { l: '% Right',          v: ((right/total)*100).toFixed(0), unit: '%' },
    { l: 'Miss Tendency',    v: missTendency, unit: '' },
  ];

  return `<div class="analysis-section">
    <div class="analysis-section-title">Direction & Miss Pattern</div>
    <div class="analysis-row-list">
      ${rows.map(r => `
        <div class="analysis-row">
          <span class="analysis-row-label">${r.l}</span>
          <span class="analysis-row-value">${r.v}${r.unit}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── 4. Distance control ────────────────────────────────────────────────────
function renderDistanceControl(shots) {
  const carries = shots.map(s => s.carry).filter(Boolean);
  const avg = statAvg(carries);
  const rows = [
    { l: 'Min Carry',      v: f(Math.min(...carries)), unit: 'm' },
    { l: 'Max Carry',      v: f(Math.max(...carries)), unit: 'm' },
    { l: 'Range',          v: f(Math.max(...carries) - Math.min(...carries)), unit: 'm' },
    { l: 'Median',         v: f(statMedian(carries)), unit: 'm' },
    { l: '10th Percentile',v: f(statPercentile(carries, 10)), unit: 'm' },
    { l: '90th Percentile',v: f(statPercentile(carries, 90)), unit: 'm' },
  ];

  if (!carries.length) return '<div class="analysis-section"><div class="analysis-section-title">Distance Control</div><div class="analysis-empty-small">No carry data</div></div>';

  return `<div class="analysis-section">
    <div class="analysis-section-title">Distance Control</div>
    <div class="analysis-row-list">
      ${rows.map(r => `
        <div class="analysis-row">
          <span class="analysis-row-label">${r.l}</span>
          <span class="analysis-row-value">${r.v}${r.unit}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── 5. Progress charts ─────────────────────────────────────────────────────
function renderProgressSection(allShots) {
  return `<div class="analysis-section">
    <div class="analysis-section-title">Progress Over Time</div>
    <div class="progress-chart-tabs">
      ${['carry','smash_factor','ball_speed','spin_rate','launch_angle','face_angle','club_path','face_to_path'].map((k,i) =>
        `<button class="prog-tab${i===0?' on':''}" onclick="switchProgChart('${k}',this)">${progLabel(k)}</button>`
      ).join('')}
    </div>
    <canvas id="progress-canvas" height="160" style="width:100%;display:block;margin-top:8px;border-radius:10px;background:#161819;"></canvas>
  </div>`;
}

function progLabel(k) {
  const m = { carry:'Carry',smash_factor:'Smash',ball_speed:'Ball Spd',spin_rate:'Spin',launch_angle:'Launch',face_angle:'Face',club_path:'Path',face_to_path:'FTP' };
  return m[k] || k;
}

let currentProgKey = 'carry';

function switchProgChart(key, btn) {
  currentProgKey = key;
  document.querySelectorAll('.prog-tab').forEach(t => t.classList.remove('on'));
  if (btn) btn.classList.add('on');
  drawProgressChart(currentProgKey, applyFilter(analysisShots));
}

function drawProgressCharts(allShots) {
  const shots = applyFilter(allShots);
  drawProgressChart('carry', shots);
}

function drawProgressChart(key, shots) {
  const canvas = document.getElementById('progress-canvas');
  if (!canvas) return;

  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const w = canvas.parentElement?.clientWidth || 320;
  const h = 160;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const ordered = [...shots].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  const values  = ordered.map(s => s[key]).filter(v => v != null && !isNaN(v));

  if (values.length < 2) {
    ctx.fillStyle = '#4e5660';
    ctx.font = "14px 'Barlow', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Not enough data', w/2, h/2);
    return;
  }

  const pad = { t: 20, r: 16, b: 32, l: 44 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;

  function px(i) { return pad.l + (i / (values.length - 1)) * cw; }
  function py(v) { return pad.t + ch - ((v - min) / (max - min)) * ch; }

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    const val = max - ((max - min) / 4) * i;
    ctx.fillStyle = '#4e5660';
    ctx.font = "9px 'DM Mono', monospace";
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), pad.l - 4, y + 3);
  }

  // 5-shot rolling avg
  const rollingAvg = values.map((_, i) => {
    const window = values.slice(Math.max(0, i-4), i+1);
    return window.reduce((a,b) => a+b, 0) / window.length;
  });

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(0,214,143,0.18)');
  grad.addColorStop(1, 'rgba(0,214,143,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(px(0), py(values[0]));
  values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(values.length - 1), pad.t + ch);
  ctx.lineTo(px(0), pad.t + ch);
  ctx.closePath();
  ctx.fill();

  // Individual points
  ctx.fillStyle = 'rgba(0,214,143,0.3)';
  values.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(px(i), py(v), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rolling avg line
  ctx.strokeStyle = '#00d68f';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  rollingAvg.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
  ctx.stroke();

  // Label
  ctx.fillStyle = '#f0ede8';
  ctx.font = "700 11px 'Barlow Condensed', monospace";
  ctx.textAlign = 'left';
  ctx.fillText(progLabel(key).toUpperCase() + ' · ' + values.length + ' shots', pad.l, pad.t - 6);
}

// ── 6. Raw table ───────────────────────────────────────────────────────────
const RAW_COLS = [
  { key: 'created_at',  label: 'Date',    fmt: v => v ? v.slice(0,10) : '–' },
  { key: 'carry',       label: 'Carry',   fmt: v => f(v,1) },
  { key: 'smash_factor',label: 'Smash',   fmt: v => f(v,2) },
  { key: 'ball_speed',  label: 'BSp',     fmt: v => f(v,1) },
  { key: 'club_speed',  label: 'CSp',     fmt: v => f(v,1) },
  { key: 'face_angle',  label: 'Face',    fmt: v => fSign(v,1) },
  { key: 'club_path',   label: 'Path',    fmt: v => fSign(v,1) },
  { key: 'face_to_path',label: 'FTP',     fmt: v => fSign(v,1) },
  { key: 'attack_angle',label: 'Atk',     fmt: v => fSign(v,1) },
  { key: 'launch_angle',label: 'Lch',     fmt: v => f(v,1) },
  { key: 'spin_rate',   label: 'Spin',    fmt: v => v ? Math.round(v) : '–' },
  { key: 'side',        label: 'Side',    fmt: v => fSign(v,1) },
  { key: 'is_full_shot',label: 'Full',    fmt: v => v === false ? '–' : '✓' },
  { key: 'exclude_from_progress', label: 'Excl', fmt: v => v ? '✗' : '' },
  { key: 'notes',       label: 'Notes',   fmt: v => v ? escapeHtml(String(v).slice(0,20)) : '' },
];

function renderRawTable(shots) {
  const sorted = sortShots([...shots], analysisRawSort.col, analysisRawSort.dir);

  return `<div class="analysis-section">
    <div class="analysis-section-title" style="margin-bottom:8px;">Raw Shots (${shots.length})</div>
    <div class="analysis-raw-wrap">
      <table class="analysis-raw-table" id="raw-table">
        <thead>
          <tr>
            ${RAW_COLS.map(c => `<th data-col="${c.key}" onclick="sortRawTable('${c.key}')">${c.label}${c.key===analysisRawSort.col?(analysisRawSort.dir>0?' ↑':' ↓'):''}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${sorted.map(s => `<tr>
            ${RAW_COLS.map(c => `<td>${c.fmt(s[c.key])}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function sortShots(shots, col, dir) {
  return shots.sort((a, b) => {
    const av = a[col], bv = b[col];
    if (av == null) return 1; if (bv == null) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });
}

function sortRawTable(col) {
  if (analysisRawSort.col === col) analysisRawSort.dir *= -1;
  else { analysisRawSort.col = col; analysisRawSort.dir = -1; }
  const shots = applyFilter(analysisShots);
  renderAnalysis(analysisShots);
}

function setupTableSort(shots) {
  // Table is already rendered with onclick handlers
}

// ── Toggle shot flags from raw table ──────────────────────────────────────
async function toggleShotFlag(id, field, currentVal) {
  const sb = window.supabaseClient;
  const { error } = await sb.from('trackman_shots').update({ [field]: !currentVal }).eq('id', id);
  if (error) { showToast('Error: ' + error.message); return; }
  await loadAnalysis();
}

// ── Expose globals ─────────────────────────────────────────────────────────
window.initAnalysisTab   = initAnalysisTab;
window.setAnalysisClub   = setAnalysisClub;
window.setAnalysisFilter = setAnalysisFilter;
window.switchProgChart   = switchProgChart;
window.sortRawTable      = sortRawTable;
window.toggleShotFlag    = toggleShotFlag;
window.loadAnalysis      = loadAnalysis;
