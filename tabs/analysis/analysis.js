// analysis.js v5
// Face SD in session headers · Fault frequency summary · Baseline reference line

let analysisClub   = '7';
let analysisFilter = 'progress';
let analysisShots  = [];
let analysisRawSort = { col: 'shot_time', dir: -1 };
let editingRowId   = null;
let currentProgKey = 'carry';
let currentChartMode = 'sessions';
let currentAnalysisSection = 'report';
let currentReportFilter = 'included';
let currentReportWindow = 'all';
let swingCauseAnswers = {};
let swingPracticeResults = {};
let _allFetchedShots = [];
let openSessions = new Set();
let analysisMapActiveDates = null; // null = all dates; Set<string> = filtered

const FILTER_OPTIONS = [
  { key:'all',           label:'All' },
  { key:'progress',      label:'Included' },
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
  if (typeof window.loadWedgeWindows === 'function') {
    await window.loadWedgeWindows();
  }
  loadSwingCauseAnswers();
  loadSwingPracticeResults();
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

  const { user } = await window.TCData.getCurrentUser();
  if (!user) {
    el.innerHTML = `<div class="analysis-empty">
      <strong>Sign in to view your TrackMan data</strong>
      Your shot history, progress charts and club stats will appear here.
      <small><button class="analysis-login-btn" onclick="toggleAuthPanel()">Login →</button></small>
    </div>`;
    return;
  }

  const { data, error } = await window.TCData.fetchTrackmanShots(
    user.id,
    'id,club,carry,total,side,total_side,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,launch_direction,attack_angle,club_path,face_angle,face_to_path,dyn_loft,spin_loft,spin_axis,max_height,landing_angle,hang_time,notes,is_full_shot,exclude_from_progress,shot_type,strike_quality,shot_time,created_at',
    { limit: 2000 }
  );

  if (error) { el.innerHTML = `<div class="analysis-empty">Error: ${escapeHtml(error.message)}</div>`; return; }
  _allFetchedShots = data || [];
  if (window.__pendingAnalysisClub) {
    analysisClub = window.__pendingAnalysisClub;
    window.__pendingAnalysisClub = null;
    buildAnalysisClubTabs();
  }
  analysisShots = _allFetchedShots.filter(s => CA().shotMatchesClub(s, analysisClub));
  renderAnalysis(analysisShots);
}

function applyFilter(shots) { return window.TCGolf.filterAnalysisShots(shots, analysisFilter); }

function recentFormShots(shots, n = 50) {
  return [...shots].sort(byRecent).slice(0, n);
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
  const formShots = recentFormShots(shots);
  const colorMap = buildSessionColorMap(allShots);

  const unknowns = CA().findUnknownClubNames(_allFetchedShots);
  const unknownBanner = unknowns.length
    ? `<div class="analysis-unknown-banner">⚠ Unmapped names: <strong>${unknowns.map(u=>escapeHtml(u)).join(', ')}</strong> — <a href="#" onclick="showPage('clubs');return false;">fix in Clubs</a></div>`
    : '';

  if (!shots.length) {
    el.innerHTML = unknownBanner + `<div class="analysis-empty">No <strong>${CA().clubLabel(analysisClub)}</strong> shots for this filter.<br><small>Check club aliases in More → Club aliases.</small></div>`;
    return;
  }

  el.innerHTML = unknownBanner + `
    ${renderTrackmanSectionTabs()}
    <section class="trackman-section" id="trackman-section-report">
      <div class="trackman-section-head">
        <div class="trackman-section-title">Report</div>
        <div class="trackman-section-sub">What matters for this club right now.</div>
      </div>
      ${renderDataUsedChips(allShots, formShots, 'Report')}
      ${renderClubHealthStrip(_allFetchedShots)}
      ${renderTrackmanInsights(formShots, allShots)}
      ${renderPlayDecisionCard(formShots)}
      ${renderClubReportMetrics(allShots, 50)}
      ${renderAnalysisAcc('cause-check', 'Cause Check',
        renderSwingCauseCheck(shots) + renderTrackmanNumberExplainer(getClubReportShots()),
        false)}
      ${renderAnalysisAcc('details-diagrams', 'Details & Diagrams',
        `<div class="trackman-subgrid">
          <div class="trackman-subpanel">${renderOverviewKPIs(shots)}</div>
          <div class="trackman-subpanel">${renderConsistency(shots)}</div>
          <div class="trackman-subpanel">${renderDirection(shots)}</div>
          <div class="trackman-subpanel">${renderDistanceControl(shots)}</div>
        </div>
        <div class="report-diagram-note">Blue = club/attack path, red = face/launch, dashed grey = neutral reference. Quality labels are simple checkpoints, not fixed swing laws.</div>
        <div class="report-diagram-grid">
          <canvas id="report-delivery-canvas" height="260"></canvas>
          <canvas id="report-path-canvas" height="260"></canvas>
        </div>`,
        false)}
      ${renderAnalysisAcc('range-course', 'Range vs Course',
        renderRoundComparisonCard(allShots),
        false)}
    </section>
    <section class="trackman-section" id="trackman-section-charts">
      <div class="trackman-section-head">
        <div class="trackman-section-title">Charts</div>
        <div class="trackman-section-sub">Trends, windows and shot pattern.</div>
      </div>
      ${renderDataUsedChips(allShots, shots, 'Charts')}
      ${renderProgressSection(allShots)}
      <div class="trackman-chart-divider"></div>
      ${renderShotMaps(shots, allShots)}
    </section>
    <section class="trackman-section" id="trackman-section-shots">
      <div class="trackman-section-head">
        <div class="trackman-section-title">Shots</div>
        <div class="trackman-section-sub">Edit use/skip, wedge windows and notes.</div>
      </div>
      ${renderDataUsedChips(allShots, shots, 'Shots')}
      ${renderSessionGroups(shots, colorMap)}
    </section>
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    drawTrackmanChart(currentChartMode, currentProgKey, applyFilter(analysisShots));
    const filteredShots = applyFilter(analysisShots);
    const colorMap2 = buildSessionColorMap(analysisShots);
    const activeShotsForMaps = filteredShots.filter(s =>
      analysisMapActiveDates === null || analysisMapActiveDates.has((s.shot_time||s.created_at)?.slice(0,10))
    );
    drawTopViewMap(activeShotsForMaps, colorMap2);
    drawSideViewMap(activeShotsForMaps, colorMap2);
    drawClubReportDiagrams();
    const _distOf = s => (s.shot_type === 'round' && s.total) ? s.total : s.carry;
    const _distVals = filteredShots.map(_distOf).filter(Boolean);
    _drawHistogram('dist-histogram', _distVals, { unit:'m', median: statMedian(_distVals), sd: statStdDev(_distVals), title:'distance distribution' });
    _drawDirHistogram('dir-histogram', filteredShots.map(s=>s.side).filter(x=>x!=null));
    openSessions.forEach(date => {
      const body = document.getElementById(`session-body-${date}`);
      const head = document.getElementById(`session-head-${date}`);
      if (body) { body.style.display = 'block'; }
      if (head) { head.classList.add('open'); }
    });
  }));
}

function renderTrackmanSectionTabs() {
  const tabs = [
    { key:'report', label:'Report' },
    { key:'charts', label:'Charts' },
    { key:'shots',  label:'Shots' },
  ];
  return `<div class="trackman-section-tabs">
    ${tabs.map(t => `<button class="trackman-section-tab${currentAnalysisSection===t.key?' on':''}" onclick="showTrackmanSection('${t.key}')">${t.label}</button>`).join('')}
  </div>`;
}

function showTrackmanSection(key) {
  currentAnalysisSection = key;
  document.querySelectorAll('.trackman-section-tab').forEach(btn => {
    btn.classList.toggle('on', btn.textContent.toLowerCase() === key);
  });
  document.getElementById(`trackman-section-${key}`)?.scrollIntoView({ behavior:'smooth', block:'start' });
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
const REPORT_METRICS = [
  { key:'carry',        label:'Carry',        unit:'m',   dp:0, signed:false },
  { key:'smash_factor', label:'Smash',        unit:'',    dp:2, signed:false },
  { key:'ball_speed',   label:'Ball Spd',     unit:'m/s', dp:1, signed:false },
  { key:'spin_rate',    label:'Spin',         unit:'rpm', dp:0, signed:false },
  { key:'launch_angle', label:'Launch',       unit:'deg', dp:1, signed:true  },
  { key:'attack_angle', label:'Attack',       unit:'deg', dp:1, signed:true  },
  { key:'dyn_loft',     label:'Dyn Loft',     unit:'deg', dp:1, signed:true  },
  { key:'spin_loft',    label:'Spin Loft',    unit:'deg', dp:1, signed:true  },
  { key:'club_path',    label:'Path',         unit:'deg', dp:1, signed:true  },
  { key:'face_angle',   label:'Face',         unit:'deg', dp:1, signed:true  },
  { key:'face_to_path', label:'FTP',          unit:'deg', dp:1, signed:true  },
  { key:'spin_axis',    label:'Spin Axis',    unit:'deg', dp:1, signed:true  },
];

function shotDateMs(s) {
  const raw = s.shot_time || s.created_at || '';
  const ms = Date.parse(raw);
  return isNaN(ms) ? 0 : ms;
}

function byRecent(a, b) { return shotDateMs(b) - shotDateMs(a); }

function isAssignedWedgeWindowShot(s) {
  return isWedgeShot(s) && isWedgeWindowValue(s.shot_type);
}

function getClubReportShots() {
  let shots = [..._allFetchedShots].filter(s => CA().shotMatchesClub(s, analysisClub));
  if (currentReportFilter === 'included') shots = shots.filter(s => !s.exclude_from_progress);
  if (currentReportFilter === 'range') shots = shots.filter(s => s.shot_type !== 'round');
  if (currentReportFilter === 'round') shots = shots.filter(s => s.shot_type === 'round');
  if (currentReportFilter === 'windowed') shots = shots.filter(isAssignedWedgeWindowShot);
  if (currentReportWindow !== 'all') shots = shots.filter(s => normalizeWedgeWindowValue(s.shot_type) === currentReportWindow);
  return shots.sort(byRecent);
}

function reportFilterLabel() {
  return {
    included: 'used shots',
    all: 'all shots',
    range: 'range/simulator',
    round: 'on-course',
    windowed: 'assigned windows',
  }[currentReportFilter] || 'used shots';
}

function reportWindowOptions() {
  if (!isAnalysisWedgeClub()) return [];
  const values = new Set();
  _allFetchedShots.forEach(s => {
    if (CA().shotMatchesClub(s, analysisClub) && isWedgeWindowValue(s.shot_type)) values.add(normalizeWedgeWindowValue(s.shot_type));
  });
  return WEDGE_WINDOW_OPTIONS
    .filter(o => o.value && values.has(o.value))
    .map(o => ({ value:o.value, label:o.label }));
}

function setReportFilter(key) {
  currentReportFilter = key;
  if (key !== 'windowed') currentReportWindow = 'all';
  renderAnalysis(analysisShots);
}

function setReportWindow(value) {
  currentReportWindow = value || 'all';
  if (currentReportWindow !== 'all') currentReportFilter = 'windowed';
  renderAnalysis(analysisShots);
}

function renderReportFilters() {
  const options = [
    { key:'included', label:'Use' },
    { key:'all',      label:'All' },
    { key:'range',    label:'Range' },
    { key:'round',    label:'Course' },
  ];
  if (isAnalysisWedgeClub()) options.push({ key:'windowed', label:'Windows' });
  const windowOptions = reportWindowOptions();
  return `<div class="report-filter-row">
    ${options.map(o => `<button class="report-filter-btn${currentReportFilter===o.key?' on':''}" onclick="setReportFilter('${o.key}')">${o.label}</button>`).join('')}
    ${windowOptions.length ? `<select class="report-window-select" onchange="setReportWindow(this.value)" aria-label="Wedge window filter">
      <option value="all"${currentReportWindow==='all'?' selected':''}>All windows</option>
      ${windowOptions.map(o => `<option value="${escapeHtml(o.value)}"${currentReportWindow===o.value?' selected':''}>${escapeHtml(o.label)}</option>`).join('')}
    </select>` : ''}
  </div>`;
}

function metricDisplay(metric, value) {
  if (value == null || isNaN(value)) return '-';
  const n = Number(value);
  const core = metric.signed ? fSign(n, metric.dp) : f(n, metric.dp);
  if (!metric.unit) return core;
  if (metric.unit === 'deg') return `${core} deg`;
  return `${core} ${metric.unit}`;
}

function reportTrend(metric, shots) {
  const enough = shots.filter(s => s[metric.key] != null && !isNaN(s[metric.key]));
  if (enough.length < 8) return { text:'', cls:'neutral' };
  const n = Math.min(10, Math.floor(enough.length / 2));
  const recent = statMedian(enough.slice(0, n).map(s => s[metric.key]));
  const previous = statMedian(enough.slice(n, n * 2).map(s => s[metric.key]));
  if (recent == null || previous == null) return { text:'', cls:'neutral' };
  const delta = recent - previous;
  const threshold = metric.key === 'smash_factor' ? 0.01 : (metric.unit === 'rpm' ? 100 : 0.4);
  if (Math.abs(delta) < threshold) return { text:'stable', cls:'neutral' };
  return {
    text: `${delta > 0 ? '+' : ''}${metric.dp === 0 ? Math.round(delta) : delta.toFixed(metric.dp)} vs prev`,
    cls: delta > 0 ? 'up' : 'down',
  };
}

function windowDisplayLabel(value) {
  return WEDGE_WINDOW_OPTIONS.find(o => o.value === value)?.label || value;
}

function wedgeWindowTargetRows(reportShots) {
  if (!isAnalysisWedgeClub()) return [];
  const assigned = reportShots.filter(isAssignedWedgeWindowShot);
  const labels = new Set(assigned.map(s => normalizeWedgeWindowValue(s.shot_type)));
  WEDGE_WINDOW_OPTIONS.forEach(o => {
    if (o.value && window.getWedgeTarget?.(analysisClub, o.value) != null) labels.add(o.value);
  });
  const selectedLabels = currentReportWindow === 'all'
    ? [...labels]
    : [...labels].filter(label => label === currentReportWindow);
  return selectedLabels
    .map(label => {
      const shots = assigned
        .filter(s => normalizeWedgeWindowValue(s.shot_type) === label && s.carry > 0)
        .sort(byRecent);
      const carries = shots.map(s => Number(s.carry)).filter(x => !isNaN(x));
      const target = window.getWedgeTarget?.(analysisClub, label) ?? null;
      const median = statMedian(carries);
      const sd = statStdDev(carries);
      const miss = target != null && median != null ? median - target : null;
      const n = Math.min(5, Math.floor(carries.length / 2));
      const recent = n ? statMedian(carries.slice(0, n)) : null;
      const previous = n ? statMedian(carries.slice(n, n * 2)) : null;
      const recentDelta = recent != null && previous != null ? recent - previous : null;
      return { label, shots, count:carries.length, target, median, sd, miss, recentDelta };
    })
    .filter(r => r.count || r.target != null)
    .sort((a,b) => {
      const ai = WEDGE_WINDOW_OPTIONS.findIndex(o => o.value === a.label);
      const bi = WEDGE_WINDOW_OPTIONS.findIndex(o => o.value === b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function targetMissClass(miss) {
  if (miss == null) return 'neutral';
  const abs = Math.abs(miss);
  if (abs <= 3) return 'good';
  if (abs <= 6) return 'ok';
  return 'bad';
}

function renderWedgeTargetReport(reportShots) {
  const rows = wedgeWindowTargetRows(reportShots);
  if (!rows.length) return '';
  const bestRows = rows.filter(r => r.miss != null);
  const nearest = bestRows.length
    ? [...bestRows].sort((a,b) => Math.abs(a.miss) - Math.abs(b.miss))[0]
    : null;
  const needs = bestRows.length
    ? [...bestRows].sort((a,b) => Math.abs(b.miss) - Math.abs(a.miss))[0]
    : null;
  const summary = nearest && needs
    ? `closest ${windowDisplayLabel(nearest.label)} (${fSign(nearest.miss,0)}m) / biggest miss ${windowDisplayLabel(needs.label)} (${fSign(needs.miss,0)}m)`
    : 'set targets in More / Wedge windows';
  return `<div class="wedge-target-report">
    <div class="wedge-target-head">
      <div class="wedge-target-title">Window Targets</div>
      <div class="wedge-target-summary">${escapeHtml(summary)}</div>
    </div>
    <div class="wedge-target-table">
      <div class="wedge-target-row wedge-target-row-head">
        <span>Window</span><span>Target</span><span>Median</span><span>Miss</span><span>SD</span><span>Recent</span>
      </div>
      ${rows.map(r => {
        const missCls = targetMissClass(r.miss);
        const trendCls = r.recentDelta == null ? 'neutral' : r.recentDelta > 0 ? 'up' : r.recentDelta < 0 ? 'down' : 'neutral';
        return `<div class="wedge-target-row">
          <span class="wedge-target-window">${escapeHtml(windowDisplayLabel(r.label))}<small>${r.count} shots</small></span>
          <span>${r.target == null ? '-' : f(r.target,0)+'m'}</span>
          <span>${r.median == null ? '-' : f(r.median,0)+'m'}</span>
          <span class="target-miss ${missCls}">${r.miss == null ? '-' : fSign(r.miss,0)+'m'}</span>
          <span>${r.sd == null ? '-' : f(r.sd,1)+'m'}</span>
          <span class="target-recent ${trendCls}">${r.recentDelta == null ? '-' : fSign(r.recentDelta,1)+'m'}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderDataUsedChips(allShots, shots, label) {
  const clubShots = (allShots || []).filter(s => CA().shotMatchesClub(s, analysisClub));
  const filtered = shots || [];
  const roundCount = filtered.filter(s => s.shot_type === 'round').length;
  const rangeCount = filtered.length - roundCount;
  const chips = [
    label,
    CA().clubLabel(analysisClub),
    analysisFilter === 'progress' ? 'Included shots' : 'All shots',
    `${filtered.length} shown`,
  ].filter(Boolean);

  if (rangeCount && roundCount) chips.push('Range + course');
  else if (roundCount) chips.push('Course only');
  else chips.push('Range/simulator');

  if (isAnalysisWedgeClub()) {
    const assigned = filtered.filter(isAssignedWedgeWindowShot).length;
    const unassigned = filtered.filter(s => isWedgeShot(s) && !isAssignedWedgeWindowShot(s)).length;
    chips.push(`${assigned} windowed`);
    if (unassigned) chips.push(`${unassigned} unassigned`);
  }

  const skipped = clubShots.filter(s => s.exclude_from_progress).length;
  if (analysisFilter === 'progress' && skipped) chips.push(`${skipped} skipped`);

  return `<div class="data-used-strip">
    ${chips.map(c => `<span class="data-used-chip">${escapeHtml(c)}</span>`).join('')}
  </div>`;
}

function healthStatusClass(status) {
  return status === 'good' ? 'good' : status === 'bad' ? 'bad' : status === 'warn' ? 'warn' : 'neutral';
}

function clubHealthForShots(clubShots) {
  const included = window.TCGolf.filterAnalysisShots(clubShots || [], 'progress');
  const shots = [...included].sort(byRecent).slice(0, 50);
  if (shots.length < 5) {
    return { status:'neutral', label:'Needs data', score:'--', reason:`${shots.length} included shots` };
  }

  const carries = shots.map(s => s.carry).filter(x => x != null && !isNaN(x));
  const sides = shots.map(s => s.side ?? s.total_side).filter(x => x != null && !isNaN(x));
  const faces = shots.map(s => s.face_angle).filter(x => x != null && !isNaN(x));
  const faceSd = statStdDev(faces);
  const carrySd = statStdDev(carries);
  const sideMed = statMedian(sides);
  const faceMed = statMedian(faces);
  const playableRows = shots.filter(s => s.strike_quality || s.playable_pct != null);
  const playableGood = playableRows.filter(s => {
    const pct = Number(s.playable_pct);
    if (!isNaN(pct)) return pct >= 70;
    const q = String(s.strike_quality || '').toLowerCase();
    return q.includes('good') || q.includes('play');
  }).length;
  const playableRate = playableRows.length ? playableGood / playableRows.length : null;
  const reasons = [];
  let risk = 0;

  if (carrySd != null && carrySd > 12) { risk += 2; reasons.push(`carry spread ${f(carrySd,1)}m`); }
  else if (carrySd != null && carrySd > 8) { risk += 1; reasons.push(`carry spread ${f(carrySd,1)}m`); }

  if (sideMed != null && Math.abs(sideMed) > 12) { risk += 2; reasons.push(`miss ${Math.abs(Math.round(sideMed))}m ${sideMed > 0 ? 'right' : 'left'}`); }
  else if (sideMed != null && Math.abs(sideMed) > 6) { risk += 1; reasons.push(`miss ${Math.abs(Math.round(sideMed))}m ${sideMed > 0 ? 'right' : 'left'}`); }

  if (faceMed != null && Math.abs(faceMed) > 5) { risk += 2; reasons.push(`face ${fSign(faceMed,1)} deg`); }
  else if (faceMed != null && Math.abs(faceMed) > 2.5) { risk += 1; reasons.push(`face ${fSign(faceMed,1)} deg`); }

  if (faceSd != null && faceSd > 4) { risk += 1; reasons.push(`face scatter +/-${f(faceSd,1)} deg`); }
  if (playableRate != null && playableRate < 0.55) { risk += 2; reasons.push(`playable ${Math.round(playableRate * 100)}%`); }
  else if (playableRate != null && playableRate < 0.7) { risk += 1; reasons.push(`playable ${Math.round(playableRate * 100)}%`); }

  if (!reasons.length) reasons.push('stable enough to trust');
  const status = risk >= 4 ? 'bad' : risk >= 2 ? 'warn' : 'good';
  const label = status === 'good' ? 'Good' : status === 'warn' ? 'Watch' : 'Fix first';
  const score = status === 'good' ? 'OK' : status === 'warn' ? '!' : '!!';
  return { status, label, score, reason:reasons.slice(0, 2).join(' / ') };
}

function renderClubHealthStrip(allShots) {
  const defs = CA().CLUB_DEFINITIONS.filter(c => !['3w','5w'].includes(c.key));
  const rows = defs
    .map(def => {
      const shots = (allShots || []).filter(s => CA().shotMatchesClub(s, def.key));
      return { def, shots, health:clubHealthForShots(shots) };
    })
    .filter(r => r.shots.length || r.def.key === analysisClub)
    .sort((a,b) => (a.def.key === analysisClub ? -1 : b.def.key === analysisClub ? 1 : b.shots.length - a.shots.length))
    .slice(0, 8);

  if (!rows.length) return '';
  return `<div class="club-health-strip">
    ${rows.map(r => `<button class="club-health-card ${r.def.key === analysisClub ? 'active' : ''} ${healthStatusClass(r.health.status)}" onclick="setAnalysisClub('${r.def.key}')">
      <span class="club-health-club">${escapeHtml(r.def.label)}</span>
      <span class="club-health-score">${escapeHtml(r.health.score)}</span>
      <span class="club-health-label">${escapeHtml(r.health.label)}</span>
      <span class="club-health-reason">${escapeHtml(r.health.reason)}</span>
    </button>`).join('')}
  </div>`;
}

function renderPlayDecisionCard(shots) {
  const carries = shots.map(s => s.carry).filter(x => x != null && !isNaN(x));
  if (carries.length < 4) return '';
  const sideVals = shots.map(s => s.side ?? s.total_side).filter(x => x != null && !isNaN(x));
  const carryMed = statMedian(carries);
  const carryP10 = statPercentile(carries, 10);
  const carryP90 = statPercentile(carries, 90);
  const sideMed = statMedian(sideVals);
  const sideAbs = sideMed == null ? null : Math.abs(sideMed);
  let aim = 'Aim normally';
  let avoid = 'No strong side bias yet.';

  if (sideMed != null && sideMed > 5) {
    aim = `Aim ${Math.round(Math.min(12, sideAbs / 2 + 3))}m left`;
    avoid = 'Avoid right pins until the start line is calmer.';
  } else if (sideMed != null && sideMed < -5) {
    aim = `Aim ${Math.round(Math.min(12, sideAbs / 2 + 3))}m right`;
    avoid = 'Avoid left pins until the start line is calmer.';
  }

  const trust = carryP10 != null && carryP90 != null
    ? `Play ${f(carryMed,0)}m carry. Normal range ${f(carryP10,0)}-${f(carryP90,0)}m.`
    : `Play ${f(carryMed,0)}m carry.`;

  let wedgeNote = '';
  if (isAnalysisWedgeClub()) {
    const rows = wedgeWindowTargetRows(getClubReportShots()).filter(r => r.miss != null);
    if (rows.length) {
      const worst = [...rows].sort((a,b) => Math.abs(b.miss) - Math.abs(a.miss))[0];
      wedgeNote = `<div class="play-decision-note">Window note: ${escapeHtml(windowDisplayLabel(worst.label))} is ${Math.abs(Math.round(worst.miss))}m ${worst.miss > 0 ? 'long' : 'short'} versus target.</div>`;
    }
  }

  return `<div class="play-decision-card">
    <div class="play-decision-head">
      <div>
        <div class="play-decision-kicker">How to play this club</div>
        <div class="play-decision-title">${escapeHtml(aim)}</div>
      </div>
      <div class="play-decision-carry">${escapeHtml(f(carryMed,0))}<span>m</span></div>
    </div>
    <div class="play-decision-grid">
      <div><strong>Distance</strong><span>${escapeHtml(trust)}</span></div>
      <div><strong>Miss plan</strong><span>${escapeHtml(avoid)}</span></div>
      <div><strong>Trust level</strong><span>${carries.length >= 15 ? 'Enough shots for a real pattern.' : 'Early signal. Add more shots before making big course decisions.'}</span></div>
    </div>
    ${wedgeNote}
  </div>`;
}

function renderRoundComparisonCard(allShots) {
  const clubShots = (allShots || []).filter(s => CA().shotMatchesClub(s, analysisClub) && !s.exclude_from_progress);
  const rangeShots = clubShots.filter(s => s.shot_type !== 'round');
  const roundShots = clubShots.filter(s => s.shot_type === 'round');
  if (!rangeShots.length && !roundShots.length) return '';
  if (roundShots.length < 3) {
    return `<div class="round-compare-card muted">
      <div class="round-compare-title">Round comparison</div>
      <div class="round-compare-body">Need 3+ on-course TrackMan shots with this club before the app can compare range numbers to real round performance.</div>
    </div>`;
  }

  const rangeCarry = statMedian(rangeShots.map(s => s.carry).filter(x => x != null && !isNaN(x)));
  const roundDist = statMedian(roundShots.map(s => s.total || s.carry).filter(x => x != null && !isNaN(x)));
  const rangeSide = statMedian(rangeShots.map(s => s.side ?? s.total_side).filter(x => x != null && !isNaN(x)));
  const roundSide = statMedian(roundShots.map(s => s.side ?? s.total_side).filter(x => x != null && !isNaN(x)));
  const distDelta = rangeCarry != null && roundDist != null ? roundDist - rangeCarry : null;
  const sideDelta = rangeSide != null && roundSide != null ? roundSide - rangeSide : null;
  const distText = distDelta == null
    ? 'Not enough distance data yet.'
    : `Course is ${Math.abs(Math.round(distDelta))}m ${distDelta >= 0 ? 'longer' : 'shorter'} than range carry.`;
  const sideText = sideDelta == null
    ? 'Not enough miss-side data yet.'
    : Math.abs(sideDelta) < 5
      ? 'Course miss matches the practice pattern.'
      : `Course miss shifts ${Math.abs(Math.round(sideDelta))}m ${sideDelta > 0 ? 'right' : 'left'} versus practice.`;

  return `<div class="round-compare-card">
    <div class="round-compare-title">Round comparison</div>
    <div class="round-compare-grid">
      <div><span>Range carry</span><strong>${rangeCarry == null ? '-' : f(rangeCarry,0)+'m'}</strong></div>
      <div><span>Course dist</span><strong>${roundDist == null ? '-' : f(roundDist,0)+'m'}</strong></div>
      <div><span>Range miss</span><strong>${rangeSide == null ? '-' : fSign(rangeSide,0)+'m'}</strong></div>
      <div><span>Course miss</span><strong>${roundSide == null ? '-' : fSign(roundSide,0)+'m'}</strong></div>
    </div>
    <div class="round-compare-body">${escapeHtml(distText)} ${escapeHtml(sideText)}</div>
  </div>`;
}

function explainSignedMetric(value, deadband, positive, negative, neutral='neutral') {
  if (value == null || isNaN(value)) return 'No data yet.';
  if (Math.abs(value) <= deadband) return `${neutral} (${fSign(value,1)} deg)`;
  return `${value > 0 ? positive : negative} (${fSign(value,1)} deg)`;
}

function renderTrackmanNumberExplainer(shots) {
  if (!shots?.length) return '';
  const face = reportMedian(shots, 'face_angle');
  const path = reportMedian(shots, 'club_path');
  const ftp = reportMedian(shots, 'face_to_path');
  const attack = reportMedian(shots, 'attack_angle');
  const items = [
    {
      label:'Face',
      value:face,
      text:`${explainSignedMetric(face, 2, 'open to target', 'closed to target')}. Face mostly controls start direction.`,
    },
    {
      label:'Path',
      value:path,
      text:`${explainSignedMetric(path, 2, 'inside-out', 'outside-in')}. Path shapes the swing direction through the ball.`,
    },
    {
      label:'Face-to-path',
      value:ftp,
      text:`${explainSignedMetric(ftp, 3, 'fade/slice curve risk', 'draw/hook curve risk', 'curve playable')}. This mostly explains curve.`,
    },
    {
      label:'Attack',
      value:attack,
      text:`${explainSignedMetric(attack, 1, 'upward/sweeping', 'downward strike')}. Irons usually want some downward strike; driver can be more level or upward.`,
    },
  ].filter(i => i.value != null && !isNaN(i.value));

  let pattern = '';
  if (face != null && path != null && ftp != null) {
    if (face > 2 && path > 2 && Math.abs(ftp) <= 3) {
      pattern = 'Pattern read: path is not the main problem. The club travels inside-out, but the face is open to the target, so pushes/right misses are likely face timing.';
    } else if (ftp > 3) {
      pattern = 'Pattern read: face is open relative to path, so the ball has fade/slice curve risk.';
    } else if (ftp < -3) {
      pattern = 'Pattern read: face is closed relative to path, so the ball has draw/hook curve risk.';
    } else if (Math.abs(face) <= 2 && Math.abs(path) <= 2) {
      pattern = 'Pattern read: face and path are close to neutral. If misses remain, check strike, low point and distance control.';
    }
  }

  if (!items.length) return '';
  return `<div class="trackman-explainer-card">
    <div class="trackman-explainer-head">
      <div class="trackman-explainer-title">Number Explainer</div>
      <div class="trackman-explainer-sub">Plain English from the selected report data.</div>
    </div>
    <div class="trackman-explainer-grid">
      ${items.map(i => `<div class="trackman-explainer-item">
        <span>${escapeHtml(i.label)}</span>
        <strong>${escapeHtml(fSign(i.value,1))} deg</strong>
        <p>${escapeHtml(i.text)}</p>
      </div>`).join('')}
    </div>
    ${pattern ? `<div class="trackman-explainer-pattern">${escapeHtml(pattern)}</div>` : ''}
  </div>`;
}

function renderTrackmanInsights(shots, allShots) {
  const reportShots = getClubReportShots().slice(0, 50);
  const insights = [];

  if (isAnalysisWedgeClub()) {
    const targetRows = wedgeWindowTargetRows(reportShots).filter(r => r.miss != null);
    if (targetRows.length) {
      const biggest = [...targetRows].sort((a,b) => Math.abs(b.miss) - Math.abs(a.miss))[0];
      const cls = targetMissClass(biggest.miss);
      insights.push({
        cls,
        title:`${windowDisplayLabel(biggest.label)} is ${Math.abs(Math.round(biggest.miss))}m ${biggest.miss > 0 ? 'long' : 'short'}`,
        body:`Target ${f(biggest.target,0)}m, median ${f(biggest.median,0)}m across ${biggest.count} shots.`,
      });
    } else {
      insights.push({
        cls:'neutral',
        title:'No calibrated wedge window yet',
        body:'Edit a few wedge shots and set Window so targets can compare against real medians.',
      });
    }
  }

  const face = statMedian(shots.map(s => s.face_angle).filter(x => x != null && !isNaN(x)));
  if (face != null) {
    const q = reportMetricQuality('face_angle', face);
    insights.push({
      cls:q.label === 'Good' ? 'good' : q.label === 'OK' ? 'ok' : 'bad',
      title:`Face ${face > 0 ? 'open' : face < 0 ? 'closed' : 'neutral'} ${fSign(face,1)} deg`,
      body: q.label === 'Good' ? 'Face control is in a good range.' : 'Watch start direction and face control in the next session.',
    });
  }

  const ftp = statMedian(shots.map(s => s.face_to_path).filter(x => x != null && !isNaN(x)));
  if (ftp != null) {
    const q = reportMetricQuality('face_to_path', ftp);
    insights.push({
      cls:q.label === 'Good' ? 'good' : q.label === 'OK' ? 'ok' : 'bad',
      title:`Face-to-path ${fSign(ftp,1)} deg`,
      body: Math.abs(ftp) <= 3 ? 'Curve control looks playable.' : 'This can create too much curve if it stays there.',
    });
  }

  const carryMetric = REPORT_METRICS.find(m => m.key === 'carry');
  const carryTrend = reportTrend(carryMetric, [...reportShots].sort(byRecent));
  if (carryTrend.text) {
    insights.push({
      cls:carryTrend.cls === 'up' ? 'good' : carryTrend.cls === 'down' ? 'ok' : 'neutral',
      title:`Carry ${carryTrend.text}`,
      body:'Recent shots compared with the previous similar group.',
    });
  }

  const shown = insights.slice(0, 3);
  if (!shown.length) return '';
  return `<div class="trackman-insights">
    ${shown.map(i => `<div class="trackman-insight ${i.cls}">
      <div class="trackman-insight-title">${escapeHtml(i.title)}</div>
      <div class="trackman-insight-body">${escapeHtml(i.body)}</div>
    </div>`).join('')}
  </div>`;
}

const SWING_CAUSE_QUESTIONS = [
  {
    key:'focus',
    label:'What were you focusing on?',
    options:[
      { value:'hips', label:'Hips / rotation' },
      { value:'release', label:'Arms / release' },
      { value:'tempo', label:'Tempo' },
      { value:'strike', label:'Strike' },
      { value:'ballpos', label:'Ball position' },
      { value:'unsure', label:'Not sure' },
    ],
  },
  {
    key:'ball',
    label:'What did the ball mostly do?',
    options:[
      { value:'start_right', label:'Started right' },
      { value:'curve_right', label:'Straight then right' },
      { value:'pull_fade', label:'Left then right' },
      { value:'mixed', label:'Mixed starts' },
      { value:'unsure', label:'Not sure' },
    ],
  },
  {
    key:'feel',
    label:'What did it feel like?',
    options:[
      { value:'stuck', label:'Club stuck behind' },
      { value:'late', label:'Hands late' },
      { value:'open', label:'Face open' },
      { value:'body_pull', label:'Pulling with body' },
      { value:'weak', label:'Weak strike' },
      { value:'unsure', label:'Not sure' },
    ],
  },
];

function loadSwingCauseAnswers() {
  try { swingCauseAnswers = JSON.parse(localStorage.getItem('tc_swing_cause_answers') || '{}'); }
  catch { swingCauseAnswers = {}; }
}

function saveSwingCauseAnswers() {
  try { localStorage.setItem('tc_swing_cause_answers', JSON.stringify(swingCauseAnswers)); } catch {}
}

function loadSwingPracticeResults() {
  try { swingPracticeResults = JSON.parse(localStorage.getItem('tc_swing_practice_results') || '{}'); }
  catch { swingPracticeResults = {}; }
}

function saveSwingPracticeResults() {
  try { localStorage.setItem('tc_swing_practice_results', JSON.stringify(swingPracticeResults)); } catch {}
}

function causeAnswersForClub() {
  if (!swingCauseAnswers[analysisClub]) swingCauseAnswers[analysisClub] = {};
  return swingCauseAnswers[analysisClub];
}

function setSwingCauseChoice(key, value) {
  const answers = causeAnswersForClub();
  answers[key] = value;
  saveSwingCauseAnswers();
  renderAnalysis(analysisShots);
}

function setSwingPracticeResult(result) {
  swingPracticeResults[analysisClub] = {
    result,
    date: new Date().toISOString(),
    focus: causeAnswersForClub().focus || '',
  };
  saveSwingPracticeResults();
  renderAnalysis(analysisShots);
}

function renderSwingPracticeResult(result) {
  const saved = swingPracticeResults[analysisClub];
  const savedText = saved?.result
    ? `Last result: ${saved.result} (${(saved.date || '').slice(0,10) || 'today'})`
    : 'After the 6-shot test, tap the result so Today can remember what worked.';
  return `<div class="swing-practice-loop">
    <div class="swing-practice-title">Practice link</div>
    <div class="swing-practice-body">${escapeHtml(result.test)}</div>
    <div class="swing-practice-actions">
      ${['improved','same','worse'].map(v => `<button class="swing-practice-btn${saved?.result===v?' on':''}" onclick="setSwingPracticeResult('${v}')">${v}</button>`).join('')}
    </div>
    <div class="swing-practice-saved">${escapeHtml(savedText)}</div>
  </div>`;
}

function angleDesc(value, goodAbs, labelPos, labelNeg) {
  if (value == null) return '-';
  if (Math.abs(value) <= goodAbs) return `neutral ${fSign(value,1)} deg`;
  return `${value > 0 ? labelPos : labelNeg} ${fSign(value,1)} deg`;
}

function swingPatternStats(shots) {
  const recent = [...shots].sort(byRecent).slice(0, 30);
  const faces = recent.map(s => s.face_angle).filter(x => x != null && !isNaN(x));
  const paths = recent.map(s => s.club_path).filter(x => x != null && !isNaN(x));
  const ftps = recent.map(s => s.face_to_path).filter(x => x != null && !isNaN(x));
  const sides = recent.map(s => s.side).filter(x => x != null && !isNaN(x));
  if (recent.length < 5 || faces.length < 4 || paths.length < 4) return null;
  const face = statMedian(faces);
  const path = statMedian(paths);
  const ftp = statMedian(ftps);
  const side = statMedian(sides);
  const faceSd = statStdDev(faces);
  const miss = side == null ? 'unknown' : side > 5 ? 'right' : side < -5 ? 'left' : 'center';
  return {
    n: recent.length,
    face,
    path,
    ftp,
    side,
    faceSd,
    miss,
    faceText: angleDesc(face, 2, 'open', 'closed'),
    pathText: angleDesc(path, 2, 'in-to-out', 'out-to-in'),
    ftpText: angleDesc(ftp, 3, 'open to path', 'closed to path'),
    scatterText: faceSd == null ? '-' : faceSd > 3.5 ? `high scatter +/-${f(faceSd,1)} deg` : `stable +/-${f(faceSd,1)} deg`,
  };
}

function swingCauseResult(stats, answers) {
  const focus = answers.focus || '';
  const ball = answers.ball || '';
  const feel = answers.feel || '';
  const faceOpen = stats.face != null && stats.face > 2;
  const faceClosed = stats.face != null && stats.face < -2;
  const inToOut = stats.path != null && stats.path > 2;
  const outToIn = stats.path != null && stats.path < -2;
  const ftpNeutral = stats.ftp == null || Math.abs(stats.ftp) <= 3;
  const ftpOpen = stats.ftp != null && stats.ftp > 3;
  const highScatter = stats.faceSd != null && stats.faceSd > 3.5;

  let title = 'Face/path pattern needs one more input';
  let cause = 'Use the choices above to narrow whether this is mostly face control, path, strike, or timing.';
  let test = 'Hit 6 normal shots, then change one feel only and compare face angle, face scatter and start direction.';

  if (stats.miss === 'right' && faceOpen && inToOut && ftpNeutral) {
    title = 'Likely face open to target, not a path problem';
    cause = 'The club is traveling from the inside, but the face is still open to the target. If you are driving hard with the hips, the arms/club may be arriving late.';
    test = 'Try an earlier face-closure or turn-down release feel for 6 shots. Keep path similar, but look for face angle closer to 0 and lower face scatter.';
  } else if (ball === 'curve_right' || ftpOpen) {
    title = 'Likely face open relative to path';
    cause = 'The curve-right pattern points more to face-to-path than aim. The ball may start okay and then peel right.';
    test = 'Try a release/face-control drill and check whether face-to-path moves closer to 0 without path getting more left.';
  } else if (highScatter || ball === 'mixed') {
    title = 'Likely timing or release inconsistency';
    cause = 'The average may not be the main issue; the face is arriving inconsistently from shot to shot.';
    test = 'Use a slower tempo or shorter swing set. Track whether face scatter drops before chasing more speed.';
  } else if (stats.miss === 'left' && faceClosed) {
    title = 'Likely face closed to target';
    cause = 'The face is arriving closed enough to move start direction left. Path matters less if the face is consistently closed.';
    test = 'Use a softer release feel and check whether face angle moves closer to 0 while strike stays solid.';
  } else if (outToIn && Math.abs(stats.path) > Math.abs(stats.face || 0)) {
    title = 'Path may be the bigger lever';
    cause = 'Path is more left than neutral, so swing direction may be influencing the miss pattern.';
    test = 'Try a path-neutral rehearsal and check whether club path moves closer to 0 without face getting more open.';
  }

  if ((focus === 'hips' || feel === 'body_pull' || feel === 'stuck' || feel === 'late') && faceOpen) {
    title = 'Body may be outracing arms/club';
    cause = 'Your input points to rotation leading the club. That can leave the face open to target, especially when the club feels stuck or the hands feel late.';
    test = 'Keep the hip feel, but add an earlier turn-down release. Good result: face closer to 0, same or slightly less inside-out path, tighter face scatter.';
  } else if (focus === 'release' || feel === 'open') {
    test = 'Make release the experiment: 3 normal shots, 3 earlier face-closure shots. Keep only the version that improves face angle without creating a pull.';
  } else if (focus === 'tempo') {
    test = 'Use a 75% tempo set. If face scatter improves, speed/sequence may be part of the issue.';
  } else if (focus === 'strike' || feel === 'weak') {
    cause += ' Strike feedback matters here too; weak contact can make face/path numbers harder to trust.';
    test = 'Pair the face/path check with strike quality. Only trust the pattern from solid strikes.';
  } else if (focus === 'ballpos') {
    test = 'Test one ball-position change at a time. Keep the best version only if start direction and face scatter both improve.';
  }

  return { title, cause, test };
}

function renderSwingCauseCheck(shots) {
  const stats = swingPatternStats(shots);
  if (!stats) {
    return `<div class="swing-cause-panel">
      <div class="swing-cause-head">
        <div>
          <div class="swing-cause-title">Cause Check</div>
          <div class="swing-cause-sub">Need 5+ recent shots with face and path data.</div>
        </div>
      </div>
      <div class="swing-cause-empty">Import a few TrackMan shots with face angle and club path, then this will ask follow-up questions and suggest a testable feel.</div>
    </div>`;
  }
  const answers = causeAnswersForClub();
  const result = swingCauseResult(stats, answers);
  const answered = SWING_CAUSE_QUESTIONS.filter(q => answers[q.key]).length;
  const pattern = [
    `Miss ${stats.miss}`,
    `Face ${stats.faceText}`,
    `Path ${stats.pathText}`,
    `FTP ${stats.ftpText}`,
    `Face ${stats.scatterText}`,
  ];
  return `<div class="swing-cause-panel">
    <div class="swing-cause-head">
      <div>
        <div class="swing-cause-title">Cause Check</div>
        <div class="swing-cause-sub">${answered}/3 inputs selected / based on last ${stats.n} shots</div>
      </div>
    </div>
    <div class="swing-pattern-pills">
      ${pattern.map(p => `<span>${escapeHtml(p)}</span>`).join('')}
    </div>
    <div class="swing-cause-questions">
      ${SWING_CAUSE_QUESTIONS.map(q => `<div class="swing-cause-question">
        <div class="swing-cause-question-label">${escapeHtml(q.label)}</div>
        <div class="swing-cause-options">
          ${q.options.map(o => `<button class="swing-cause-option${answers[q.key]===o.value?' on':''}" onclick="setSwingCauseChoice('${q.key}','${o.value}')">${escapeHtml(o.label)}</button>`).join('')}
        </div>
      </div>`).join('')}
    </div>
    <div class="swing-cause-result">
      <div class="swing-cause-result-label">Likely cause to test</div>
      <div class="swing-cause-result-title">${escapeHtml(result.title)}</div>
      <div class="swing-cause-result-body">${escapeHtml(result.cause)}</div>
      <div class="swing-cause-test"><strong>Test:</strong> ${escapeHtml(result.test)}</div>
      ${renderSwingPracticeResult(result)}
    </div>
  </div>`;
}

function renderClubReportMetrics(allShots, limit) {
  let reportShots = getClubReportShots();
  if (limit) reportShots = reportShots.slice(0, limit);
  const clubLabel = CA().clubLabel(analysisClub);
  const filters = renderReportFilters();
  if (!reportShots.length) {
    return `${filters}<div class="analysis-empty-small">No ${escapeHtml(clubLabel)} shots match this report filter.</div>`;
  }
  const cards = REPORT_METRICS.map(metric => {
    const vals = reportShots.map(s => s[metric.key]).filter(x => x != null && !isNaN(x));
    const med = statMedian(vals);
    const trend = reportTrend(metric, reportShots);
    return `<div class="report-metric-card">
      <div class="report-metric-label">${metric.label}</div>
      <div class="report-metric-value">${metricDisplay(metric, med)}</div>
      <div class="report-trend ${trend.cls}">${trend.text || `${vals.length} shots`}</div>
    </div>`;
  }).join('');
  return `${filters}
    <div class="report-summary-line">${escapeHtml(clubLabel)} / ${reportFilterLabel()} / ${reportShots.length} shots / medians</div>
    ${renderWedgeTargetReport(reportShots)}
    <div class="report-metric-grid">${cards}</div>`;
}

function prepReportCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const w = canvas.parentElement?.clientWidth || 340;
  const dpr = window.devicePixelRatio || 1;
  const dynamicHeight = Math.round(Math.max(260, Math.min(340, w * 0.62)));
  canvas.style.height = dynamicHeight + 'px';
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(dynamicHeight * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, w, h:dynamicHeight };
}

function reportMedian(shots, key) {
  return statMedian(shots.map(s => s[key]).filter(x => x != null && !isNaN(x)));
}

function reportMetricQuality(key, value) {
  if (value == null || isNaN(value)) return { label:'No data', color:_cv().dim };
  const abs = Math.abs(Number(value));
  const green = '#00d68f', amber = '#ffaa00', red = '#ff6b6b';
  if (['face_angle','club_path','face_to_path','spin_axis'].includes(key)) {
    if (abs <= 2) return { label:'Good', color:green };
    if (abs <= 5) return { label:'OK', color:amber };
    return { label:'Watch', color:red };
  }
  if (key === 'attack_angle') {
    if (value <= -1 && value >= -6) return { label:'Good', color:green };
    if (value <= 1 && value >= -8) return { label:'OK', color:amber };
    return { label:'Watch', color:red };
  }
  if (key === 'launch_angle') {
    if (value >= 16 && value <= 34) return { label:'OK', color:green };
    return { label:'Check', color:amber };
  }
  if (key === 'spin_rate') {
    if (value >= 3500) return { label:'OK', color:green };
    return { label:'Low', color:amber };
  }
  return { label:'Info', color:_cv().lineColor };
}

function drawReportText(ctx, label, value, x, y, align='left', quality=null) {
  const cv = _cv();
  ctx.textAlign = align;
  ctx.font = "600 13px 'DM Sans',sans-serif";
  ctx.fillStyle = cv.titleTxt;
  ctx.fillText(label, x, y);
  ctx.font = "700 15px 'DM Mono',monospace";
  ctx.fillStyle = cv.lineColor;
  ctx.fillText(value, x, y + 17);
  if (quality) {
    ctx.font = "700 10px 'DM Mono',monospace";
    ctx.fillStyle = quality.color;
    ctx.fillText(quality.label, x, y + 34);
  }
}

function drawReportLegend(ctx, items, x, y) {
  ctx.font = "10px 'DM Mono',monospace";
  ctx.textAlign = 'left';
  let lx = x;
  items.forEach(item => {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(item.dashed ? [5, 4] : []);
    ctx.beginPath();ctx.moveTo(lx, y - 3);ctx.lineTo(lx + 16, y - 3);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = _cv().dim;
    ctx.fillText(item.label, lx + 20, y);
    lx += item.w || 88;
  });
}

function drawClubReportDiagrams() {
  const shots = getClubReportShots();
  drawDeliveryDiagram(shots);
  drawPathDiagram(shots);
}

function drawDeliveryDiagram(shots) {
  const p = prepReportCanvas('report-delivery-canvas');
  if (!p) return;
  const { ctx, w, h } = p;
  const cv = _cv();
  const light = document.body.classList.contains('light-theme');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = light ? '#f4f1ea' : '#161a1d';
  ctx.fillRect(0, 0, w, h);

  const launch = reportMedian(shots, 'launch_angle');
  const attack = reportMedian(shots, 'attack_angle');
  const dynLoft = reportMedian(shots, 'dyn_loft');
  const spin = reportMedian(shots, 'spin_rate');
  const spinLoft = reportMedian(shots, 'spin_loft');
  const baseX = w * 0.47;
  const baseY = h * 0.70;
  ctx.strokeStyle = cv.gridMid;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(28, baseY - 26); ctx.lineTo(w - 28, baseY - 26); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = cv.baseline;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, baseY); ctx.lineTo(w - 28, baseY); ctx.stroke();

  ctx.strokeStyle = '#2f68ff';
  ctx.lineWidth = 2;
  const attackRad = (attack || 0) * Math.PI / 180;
  ctx.beginPath(); ctx.moveTo(baseX - 82, baseY + Math.sin(attackRad) * 36); ctx.lineTo(baseX + 72, baseY - Math.sin(attackRad) * 36); ctx.stroke();

  ctx.strokeStyle = '#ff4f3a';
  ctx.lineWidth = 2.5;
  const launchRad = (launch || 0) * Math.PI / 180;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(baseX + 104, baseY - Math.tan(launchRad) * 104); ctx.stroke();

  ctx.save();
  ctx.translate(baseX - 6, baseY - 2);
  ctx.rotate(-0.18);
  ctx.fillStyle = cv.titleTxt;
  ctx.fillRect(-7, -88, 14, 88);
  ctx.fillStyle = light ? '#202326' : '#050607';
  ctx.beginPath(); ctx.ellipse(0, 0, 42, 17, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cv.lineColor;
  ctx.fillRect(-4, -8, 8, 3);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.arc(w * 0.78, baseY - 30, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = cv.gridMid; ctx.stroke();

  drawReportLegend(ctx, [
    { label:'launch', color:'#ff4f3a', w:82 },
    { label:'attack', color:'#2f68ff', w:82 },
    { label:'reference', color:cv.gridMid, dashed:true, w:104 },
  ], 16, h - 14);
  drawReportText(ctx, 'Dynamic Loft', metricDisplay(REPORT_METRICS.find(m => m.key === 'dyn_loft'), dynLoft), 16, 24);
  drawReportText(ctx, 'Spin Rate', metricDisplay(REPORT_METRICS.find(m => m.key === 'spin_rate'), spin), w - 16, 24, 'right', reportMetricQuality('spin_rate', spin));
  drawReportText(ctx, 'Attack Angle', metricDisplay(REPORT_METRICS.find(m => m.key === 'attack_angle'), attack), 16, h - 62, 'left', reportMetricQuality('attack_angle', attack));
  drawReportText(ctx, 'Spin Loft', metricDisplay(REPORT_METRICS.find(m => m.key === 'spin_loft'), spinLoft), w - 16, h - 62, 'right');
}

function drawPathDiagram(shots) {
  const p = prepReportCanvas('report-path-canvas');
  if (!p) return;
  const { ctx, w, h } = p;
  const cv = _cv();
  const light = document.body.classList.contains('light-theme');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = light ? '#f4f1ea' : '#161a1d';
  ctx.fillRect(0, 0, w, h);

  const path = reportMedian(shots, 'club_path');
  const face = reportMedian(shots, 'face_angle');
  const ftp = reportMedian(shots, 'face_to_path');
  const axis = reportMedian(shots, 'spin_axis');
  const cx = w * 0.50;
  const cy = h * 0.55;
  const len = Math.min(150, w * 0.34);
  const lineAt = (deg, color, width=2) => {
    const r = (deg || 0) * Math.PI / 180;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(r) * len, cy + Math.sin(r) * len * 0.45);
    ctx.lineTo(cx + Math.cos(r) * len, cy - Math.sin(r) * len * 0.45);
    ctx.stroke();
  };
  lineAt(path, '#2f68ff', 2);
  lineAt(face, '#ff4f3a', 2);
  ctx.strokeStyle = cv.baseline;
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(cx - len, cy); ctx.lineTo(cx + len, cy); ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((face || 0) * -Math.PI / 180 * 0.35);
  ctx.fillStyle = light ? '#202326' : '#050607';
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cv.titleTxt;
  ctx.fillRect(-6, -106, 12, 92);
  ctx.fillStyle = cv.lineColor;
  ctx.fillRect(-6, -22, 12, 3);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.arc(w * 0.76, cy - 8, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = cv.gridMid; ctx.stroke();

  drawReportLegend(ctx, [
    { label:'path', color:'#2f68ff', w:70 },
    { label:'face', color:'#ff4f3a', w:70 },
    { label:'neutral', color:cv.baseline, dashed:true, w:88 },
  ], 16, h - 14);
  drawReportText(ctx, 'Club Path', metricDisplay(REPORT_METRICS.find(m => m.key === 'club_path'), path), 16, 24, 'left', reportMetricQuality('club_path', path));
  drawReportText(ctx, 'Face To Path', metricDisplay(REPORT_METRICS.find(m => m.key === 'face_to_path'), ftp), w - 16, 24, 'right', reportMetricQuality('face_to_path', ftp));
  drawReportText(ctx, 'Face Angle', metricDisplay(REPORT_METRICS.find(m => m.key === 'face_angle'), face), 16, h - 62, 'left', reportMetricQuality('face_angle', face));
  drawReportText(ctx, 'Spin Axis', metricDisplay(REPORT_METRICS.find(m => m.key === 'spin_axis'), axis), w - 16, h - 62, 'right', reportMetricQuality('spin_axis', axis));
}

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
    gradTop:     light ? 'rgba(0,148,88,0.22)' : 'rgba(0,214,143,0.18)',
    gradBot:     light ? 'rgba(0,148,88,0)'    : 'rgba(0,214,143,0)',
    titleTxt:    light ? '#1a1916'             : '#f0ede8',
    lineColor:   light ? '#007a45'             : '#00d68f',
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
    ${stackedBar}
    ${sides.length >= 4 ? '<canvas id="dir-histogram" height="82" style="width:100%;display:block;border-radius:8px;background:var(--canvas-bg);margin-top:12px;"></canvas>' : ''}`;
}

// ── Distance control ───────────────────────────────────────────────────────
function renderDistanceControl(shots) {
  // On-course shots use total distance; TrackMan shots use carry
  const distOf = s => (s.shot_type === 'round' && s.total) ? s.total : s.carry;
  const c = shots.map(distOf).filter(Boolean);
  if (!c.length) return '<div class="analysis-empty-small">No carry data</div>';
  const sorted = [...c].sort((a,b)=>a-b);
  const med = statMedian(c), sd = statStdDev(c);
  const p10 = statPercentile(c,10), p90 = statPercentile(c,90);
  const hasOnCourse = shots.some(s => s.shot_type === 'round' && s.total);
  const row = (l,v) => `<div class="analysis-row"><span class="analysis-row-label">${l}</span><span class="analysis-row-value">${v}</span></div>`;
  return `
    <div class="dist-summary">
      <div class="dist-main">
        <span class="dist-median">${f(med,0)}m</span>
        <span class="dist-sd ${carrySDColor(sd)}">±${f(sd,1)}m</span>
        <span class="dist-label">median · std dev${hasOnCourse?' · on-course=total':''}</span>
      </div>
    </div>
    <div class="analysis-row-list" style="display:grid;grid-template-columns:1fr 1fr;">
      ${row('Min', f(sorted[0],0)+'m')}
      ${row('Max', f(sorted[sorted.length-1],0)+'m')}
      ${row('Range', f(sorted[sorted.length-1]-sorted[0],0)+'m')}
      ${row('P10 – P90', f(p10,0)+'–'+f(p90,0)+'m')}
    </div>
    <canvas id="dist-histogram" height="88" style="width:100%;display:block;border-radius:8px;background:var(--canvas-bg);margin-top:12px;"></canvas>`;
}

// ── Progress chart ─────────────────────────────────────────────────────────
function renderProgressSection(allShots) {
  const modes = [
    { key:'sessions', label:'Sessions' },
    { key:'recent', label:'Recent trend' },
    { key:'windows', label:'Window targets' },
    { key:'pattern', label:'Shot pattern' },
  ];
  const metrics=['carry','smash_factor','ball_speed','spin_rate','launch_angle','face_angle','club_path','face_to_path','attack_angle','playable_rate'];
  const showMetrics = currentChartMode === 'sessions' || currentChartMode === 'recent';
  return`<div class="chart-mode-tabs">
    ${modes.map(m=>`<button class="chart-mode-tab${m.key===currentChartMode?' on':''}" onclick="switchChartMode('${m.key}')">${m.label}</button>`).join('')}
  </div>
  ${showMetrics ? `<div class="progress-chart-tabs">
    ${metrics.map(k=>`<button class="prog-tab${k===currentProgKey?' on':''}" onclick="switchProgChart('${k}',this)">${progLabel(k)}</button>`).join('')}
  </div>` : ''}
  <canvas id="progress-canvas" height="220" style="width:100%;display:block;margin-top:8px;border-radius:10px;background:var(--canvas-bg);"></canvas>
  <div class="progress-baseline-note" id="progress-baseline-note"></div>`;
}

function progLabel(k){return{carry:'Carry',smash_factor:'Smash',ball_speed:'Ball Spd',spin_rate:'Spin',launch_angle:'Launch',face_angle:'Face',club_path:'Path',face_to_path:'FTP',attack_angle:'Attack',playable_rate:'Playable %'}[k]||k;}

function switchChartMode(mode) {
  currentChartMode = mode;
  renderAnalysis(analysisShots);
}

function switchProgChart(key,btn){
  currentProgKey=key;
  document.querySelectorAll('.prog-tab').forEach(t=>t.classList.remove('on'));
  if(btn)btn.classList.add('on');
  drawTrackmanChart(currentChartMode,currentProgKey,applyFilter(analysisShots));
}

function drawTrackmanChart(mode, key, shots) {
  if (mode === 'sessions') return drawSessionChart(key, shots);
  if (mode === 'windows') return drawWindowTargetChart(shots);
  if (mode === 'pattern') return drawPatternChart(shots);
  return drawProgressChart(key, shots);
}

function redrawCurrentTrackmanChart() {
  drawTrackmanChart(currentChartMode, currentProgKey, applyFilter(analysisShots));
}

function prepProgressCanvas(height=190) {
  const canvas=document.getElementById('progress-canvas');
  if(!canvas)return null;
  const dpr=Math.min(window.devicePixelRatio||2,3);
  const w=canvas.parentElement?.clientWidth||340;
  const h=Math.max(height, w < 430 ? 250 : height);
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  return { canvas, ctx, w, h };
}

function sessionMetricValue(shots, key) {
  if (key === 'playable_rate') {
    const sideShots = shots.filter(s => s.side != null);
    return sideShots.length ? sideShots.filter(s => Math.abs(s.side) <= 20).length / sideShots.length * 100 : null;
  }
  return statMedian(shots.map(s => s[key]).filter(x => x != null && !isNaN(x)));
}

function drawEmptyChart(ctx, w, h, line1, line2='') {
  ctx.fillStyle = _cv().dim;
  ctx.font = "13px 'Barlow',sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(line1, w/2, h/2 - (line2 ? 6 : 0));
  if (line2) {
    ctx.font = "11px 'Barlow',sans-serif";
    ctx.fillText(line2, w/2, h/2 + 14);
  }
}

function drawSessionChart(key, shots) {
  const p = prepProgressCanvas(220);
  if (!p) return;
  const { ctx, w, h } = p;
  const compact = w < 430;
  const cv = _cv();
  const colorMap = buildSessionColorMap(shots);
  const byDate = {};
  [...shots].sort((a,b)=>shotDateMs(a)-shotDateMs(b)).forEach(s => {
    const d = (s.shot_time || s.created_at)?.slice(0,10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  });
  const sessions = Object.entries(byDate)
    .map(([date, ss]) => ({ date, value:sessionMetricValue(ss, key), count:ss.length }))
    .filter(s => s.value != null);
  if (!sessions.length) {
    drawEmptyChart(ctx, w, h, 'No session data for this metric', 'Choose another metric or import shots with this TrackMan field.');
    const note = document.getElementById('progress-baseline-note');
    if (note) note.textContent = '';
    return;
  }
  const values = sessions.map(s => s.value);
  const baseline = key === 'playable_rate' ? 70 : getBaselineForMetric(key, analysisClub);
  const allVals = baseline != null ? [...values, baseline] : values;
  const pad=compact ? {t:36,r:16,b:56,l:54} : {t:30,r:20,b:44,l:48};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const span=Math.max(...allVals)-Math.min(...allVals)||1;
  const min=Math.min(...allVals)-span*0.14,max=Math.max(...allVals)+span*0.14;
  const py=v=>pad.t+ch-((v-min)/(max-min))*ch;
  const barW=Math.max(10, Math.min(34, cw / Math.max(sessions.length, 1) * 0.58));
  const xOf=i=>pad.l+(sessions.length===1?cw/2:(i/(sessions.length-1))*cw);
  const isPct = key === 'playable_rate';
  const isSign=['face_angle','club_path','face_to_path','attack_angle'].includes(key);

  ctx.strokeStyle=cv.grid;ctx.lineWidth=1;ctx.font=`${compact ? 10 : 9}px 'DM Mono',monospace`;ctx.fillStyle=cv.dim;ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const y=pad.t+(ch/4)*i,val=max-((max-min)/4)*i;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    const txt = isPct ? Math.round(val)+'%' : isSign ? fSign(val,1) : f(val,key==='spin_rate'?0:1);
    ctx.fillText(txt,pad.l-6,y+3);
  }
  if (baseline != null) {
    const by=py(baseline);
    ctx.save();ctx.strokeStyle=cv.baseline;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(pad.l,by);ctx.lineTo(w-pad.r,by);ctx.stroke();ctx.restore();
  }
  const labelStep = compact ? Math.max(1, Math.ceil(sessions.length / 5)) : 1;
  sessions.forEach((s,i)=>{
    const x=xOf(i), y=py(s.value), col=colorMap[s.date]||cv.lineColor;
    const baseVal = min <= 0 && max >= 0 ? 0 : min;
    const zero=py(baseVal);
    ctx.fillStyle=col;ctx.globalAlpha=0.72;
    ctx.fillRect(x-barW/2, Math.min(y,zero), barW, Math.max(3, Math.abs(zero-y)));
    ctx.globalAlpha=1;
    if (i % labelStep === 0 || i === sessions.length - 1) {
      ctx.fillStyle=cv.dim;ctx.font=`${compact ? 10 : 9}px 'DM Mono',monospace`;ctx.textAlign='center';
      ctx.fillText(s.date.slice(5), x, pad.t+ch+(compact ? 28 : 20));
    }
  });
  const med=statMedian(values);
  if (med != null) {
    const my=py(med);
    ctx.strokeStyle=cv.lineColor;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad.l,my);ctx.lineTo(w-pad.r,my);ctx.stroke();
  }
  ctx.fillStyle=cv.titleTxt;ctx.textAlign='left';ctx.font=`700 ${compact ? 12 : 11}px 'Barlow Condensed',sans-serif`;
  ctx.fillText(`${progLabel(key).toUpperCase()} BY SESSION`,pad.l,pad.t-12);
  const note = document.getElementById('progress-baseline-note');
  if (note) note.textContent = `Each bar is one session median${baseline != null ? ' / dashed = target or baseline' : ''}.`;
}

function drawWindowTargetChart(shots) {
  const p = prepProgressCanvas(190);
  if (!p) return;
  const { ctx, w, h } = p;
  if (!isAnalysisWedgeClub()) {
    drawEmptyChart(ctx, w, h, 'Window targets are for wedges', 'Select PW, SW, 58, 60 or another wedge club');
    const note = document.getElementById('progress-baseline-note');
    if (note) note.textContent = '';
    return;
  }
  return drawProgressChart('carry', shots);
}

function drawPatternChart(shots) {
  const p = prepProgressCanvas(210);
  if (!p) return;
  const { ctx, w, h } = p;
  const cv = _cv();
  const colorMap = buildSessionColorMap(shots);
  const valid = shots.filter(s => s.carry != null && s.side != null);
  if (valid.length < 2) {
    drawEmptyChart(ctx, w, h, 'Need carry and side data for shot pattern', 'Import TrackMan shots with Carry and Side to see this chart.');
    const note = document.getElementById('progress-baseline-note');
    if (note) note.textContent = '';
    return;
  }
  const carries = valid.map(s => Number(s.carry));
  const sides = valid.map(s => Number(s.side));
  const pad={t:28,r:18,b:40,l:48};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const sideMax=Math.max(12, Math.max(...sides.map(Math.abs))*1.25);
  const cMin=Math.max(0, Math.min(...carries)-8);
  const cMax=Math.max(...carries)+8;
  const xOf=s=>pad.l+((s+sideMax)/(sideMax*2))*cw;
  const yOf=c=>pad.t+ch-((c-cMin)/(cMax-cMin))*ch;

  ctx.strokeStyle=cv.grid;ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+(ch/4)*i,val=cMax-((cMax-cMin)/4)*i;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    ctx.fillStyle=cv.dim;ctx.font="9px 'DM Mono',monospace";ctx.textAlign='right';ctx.fillText(Math.round(val)+'m',pad.l-6,y+3);
  }
  [-20, -10, 0, 10, 20].forEach(s => {
    if (Math.abs(s) > sideMax) return;
    const x=xOf(s);
    ctx.strokeStyle=s===0?cv.baseline:cv.grid;ctx.lineWidth=s===0?1.4:1;
    ctx.setLineDash(s===0?[6,5]:[2,4]);
    ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+ch);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=cv.dim;ctx.font="9px 'DM Mono',monospace";ctx.textAlign='center';ctx.fillText((s>0?'+':'')+s+'m',x,pad.t+ch+20);
  });
  valid.forEach(s => {
    const date=(s.shot_time||s.created_at)?.slice(0,10)||'';
    const col=colorMap[date]||cv.lineColor;
    const x=xOf(Number(s.side)), y=yOf(Number(s.carry));
    ctx.fillStyle=col;ctx.globalAlpha=0.78;
    ctx.beginPath();ctx.arc(x,y,4.2,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
  const avgSide=statAvg(sides), avgCarry=statAvg(carries);
  if (avgSide != null && avgCarry != null) {
    const ax=xOf(avgSide), ay=yOf(avgCarry);
    ctx.strokeStyle=cv.lineColor;ctx.lineWidth=2;ctx.beginPath();ctx.arc(ax,ay,10,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=cv.lineColor;ctx.beginPath();ctx.arc(ax,ay,4,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle=cv.titleTxt;ctx.textAlign='left';ctx.font="700 11px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${CA().clubLabel(analysisClub).toUpperCase()} SHOT PATTERN`,pad.l,pad.t-12);
  const note = document.getElementById('progress-baseline-note');
  if (note) note.textContent = 'Side-to-side pattern by carry. Ring shows the average shot.';
}

function drawProgressChart(key,shots){
  const canvas=document.getElementById('progress-canvas');
  if(!canvas)return;
  const dpr=Math.min(window.devicePixelRatio||2,3);
  const w=canvas.parentElement?.clientWidth||340,h=190;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);

  // Shared smooth catmull-rom → bezier helper (needs ctx in scope)
  function smLine(xs,ys){const n=xs.length;for(let i=0;i<n-1;i++){const x0=xs[Math.max(0,i-1)],y0=ys[Math.max(0,i-1)],x1=xs[i],y1=ys[i],x2=xs[i+1],y2=ys[i+1],x3=xs[Math.min(n-1,i+2)],y3=ys[Math.min(n-1,i+2)];ctx.bezierCurveTo(x1+(x2-x0)/6,y1+(y2-y0)/6,x2-(x3-x1)/6,y2-(y3-y1)/6,x2,y2);}}

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
    const pxs2=pts.map((_,i)=>px2(i)),pys2=pts.map(v=>py2(v));
    ctx.fillStyle=grad2;ctx.beginPath();ctx.moveTo(pxs2[0],pys2[0]);smLine(pxs2,pys2);
    ctx.lineTo(pxs2[pxs2.length-1],pad2.t+ch2);ctx.lineTo(pxs2[0],pad2.t+ch2);ctx.closePath();ctx.fill();
    pts.forEach((v,i)=>{
      ctx.fillStyle=v>=70?'#00d68f':v>=50?'#ffaa00':'#ff4d4d';ctx.globalAlpha=0.6;
      ctx.beginPath();ctx.arc(pxs2[i],pys2[i],2.5,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
    const roll2=pts.map((_,i)=>{const s2=pts.slice(Math.max(0,i-4),i+1);return s2.reduce((a,b)=>a+b,0)/s2.length;});
    const rys2=roll2.map(v=>py2(v));
    ctx.strokeStyle=cv2.lineColor;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(pxs2[0],rys2[0]);smLine(pxs2,rys2);ctx.stroke();
    const plLast=pts[pts.length-1],plLx=pxs2[pxs2.length-1],plLy=pys2[pys2.length-1];
    ctx.shadowColor=cv2.lineColor;ctx.shadowBlur=8;
    ctx.fillStyle=cv2.lineColor;ctx.globalAlpha=1;ctx.beginPath();ctx.arc(plLx,plLy,5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(plLx,plLy,2,0,Math.PI*2);ctx.fill();
    const lastRate=pts[pts.length-1];
    const rCol=lastRate>=70?'#00d68f':lastRate>=50?'#ffaa00':'#ff4d4d';
    ctx.font="700 11px 'Barlow Condensed',sans-serif";ctx.textAlign='left';ctx.fillStyle=rCol;
    ctx.fillText(`PLAYABLE % · ${pts.length} shots · last ${Math.round(lastRate)}%`,pad2.l,pad2.t-12);
    const noteEl2=document.getElementById('progress-baseline-note');
    if(noteEl2)noteEl2.textContent='Rolling 10-shot playable rate · dashed = 70% target';
    return;
  }

  if (key === 'carry' && isAnalysisWedgeClub()) {
    const cvw = _cv();
    const wedgeShots = [...shots]
      .filter(s => s.carry > 0 && isWedgeWindowValue(s.shot_type))
      .sort((a,b) => new Date(a.shot_time||a.created_at) - new Date(b.shot_time||b.created_at));
    const dateList = [...new Set(wedgeShots.map(s => (s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))];
    const groups = {};
    wedgeShots.forEach(s => {
      const d = (s.shot_time || s.created_at)?.slice(0,10);
      if (!d) return;
      const label = wedgeWindowLabelForShot(s);
      if (!groups[label]) groups[label] = {};
      if (!groups[label][d]) groups[label][d] = [];
      groups[label][d].push(Number(s.carry));
    });
    const series = Object.entries(groups)
      .map(([label, byDate]) => {
        const points = dateList.map((d, i) => {
          const vals = byDate[d] || [];
          return vals.length ? { i, date: d, value: vals.reduce((a,b)=>a+b,0)/vals.length, n: vals.length } : null;
        }).filter(Boolean);
        const count = Object.values(byDate).reduce((a, vals) => a + vals.length, 0);
        return { label, points, count, target: window.getWedgeTarget?.(analysisClub, label) ?? null };
      })
      .filter(s => s.points.length >= 2)
      .sort((a,b) => b.count - a.count)
      .slice(0, 5);

    if (series.length) {
      const vals = series.flatMap(s => [...s.points.map(p => p.value), ...(s.target != null ? [s.target] : [])]);
      const padw = { t:30, r:20, b:44, l:48 };
      const cww = w - padw.l - padw.r;
      const chw = h - padw.t - padw.b;
      const span = Math.max(...vals) - Math.min(...vals) || 1;
      const min = Math.min(...vals) - span * 0.15;
      const max = Math.max(...vals) + span * 0.15;
      const pxw = i => padw.l + (dateList.length <= 1 ? 0 : (i / (dateList.length - 1)) * cww);
      const pyw = v => padw.t + chw - ((v - min) / (max - min)) * chw;
      const palette = ['#00d68f','#ffaa00','#7b9cff','#ff7eb3','#40e0d0'];

      ctx.strokeStyle = cvw.grid;
      ctx.lineWidth = 1;
      ctx.font = "9px 'DM Mono',monospace";
      ctx.fillStyle = cvw.dim;
      ctx.textAlign = 'right';
      for (let i=0;i<=4;i++) {
        const y = padw.t + (chw/4) * i;
        const val = max - ((max-min)/4) * i;
        ctx.beginPath();ctx.moveTo(padw.l,y);ctx.lineTo(w-padw.r,y);ctx.stroke();
        ctx.fillText(val.toFixed(0), padw.l-6, y+3);
      }

      dateList.forEach((d,i) => {
        if (i === 0) return;
        ctx.strokeStyle = cvw.sessionSep;
        ctx.lineWidth = 1;
        ctx.setLineDash([3,4]);
        ctx.beginPath();ctx.moveTo(pxw(i),padw.t);ctx.lineTo(pxw(i),padw.t+chw);ctx.stroke();
      });
      ctx.setLineDash([]);

      series.forEach((s, si) => {
        const col = palette[si % palette.length];
        const xs = s.points.map(p => pxw(p.i));
        const ys = s.points.map(p => pyw(p.value));
        if (s.target != null) {
          const ty = pyw(s.target);
          ctx.save();
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          ctx.setLineDash([6,4]);
          ctx.beginPath();ctx.moveTo(padw.l,ty);ctx.lineTo(w-padw.r,ty);ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();ctx.moveTo(xs[0],ys[0]);
        if (xs.length > 2) smLine(xs,ys);
        else ctx.lineTo(xs[1],ys[1]);
        ctx.stroke();
        s.points.forEach((p, pi) => {
          ctx.fillStyle = col;
          ctx.globalAlpha = pi === s.points.length - 1 ? 1 : 0.65;
          ctx.beginPath();ctx.arc(pxw(p.i), pyw(p.value), pi === s.points.length - 1 ? 4 : 3, 0, Math.PI*2);ctx.fill();
        });
        ctx.globalAlpha = 1;
      });

      ctx.textAlign = 'left';
      ctx.font = "700 11px 'Barlow Condensed',sans-serif";
      ctx.fillStyle = cvw.titleTxt;
      ctx.fillText(`${CA().clubLabel(analysisClub).toUpperCase()} CARRY BY WINDOW`, padw.l, padw.t-12);

      ctx.font = "9px 'DM Mono',monospace";
      let lx = padw.l;
      series.forEach((s, si) => {
        if (lx > w - 80) return;
        const col = palette[si % palette.length];
        const last = s.points[s.points.length - 1]?.value;
        const delta = s.target != null && last != null ? Math.round(last - s.target) : null;
        ctx.fillStyle = col;
        ctx.beginPath();ctx.arc(lx+4,padw.t+chw+20,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle = cvw.dim;
        ctx.fillText(delta == null ? s.label : `${s.label} ${delta > 0 ? '+' : ''}${delta}m`, lx+12, padw.t+chw+23);
        lx += Math.max(76, s.label.length * 7 + (delta == null ? 22 : 46));
      });

      const noteElW = document.getElementById('progress-baseline-note');
      if (noteElW) noteElW.textContent = 'Carry split by wedge window. Dashed coloured lines show your target carry when set.';
      return;
    }

    ctx.fillStyle = '#4e5660';
    ctx.font = "13px 'Barlow',sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Need 2+ sessions in assigned wedge windows', w/2, h/2 - 6);
    ctx.font = "11px 'Barlow',sans-serif";
    ctx.fillText('Edit wedge shots and set Window, then this chart will compare target vs actual.', w/2, h/2 + 14);
    const noteElW = document.getElementById('progress-baseline-note');
    if (noteElW) noteElW.textContent = 'Wedge carry charts stay split by window instead of blending partial shots.';
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
  const xs=values.map((_,i)=>px(i)),ys=values.map(v=>py(v));
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(xs[0],ys[0]);smLine(xs,ys);
  ctx.lineTo(xs[xs.length-1],pad.t+ch);ctx.lineTo(xs[0],pad.t+ch);ctx.closePath();ctx.fill();

  values.forEach((v,i)=>{ctx.fillStyle=colorMap[dates[i]]||cv.lineColor;ctx.globalAlpha=0.65;ctx.beginPath();ctx.arc(xs[i],ys[i],3,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;

  const roll=values.map((_,i)=>{const sl=values.slice(Math.max(0,i-4),i+1);return sl.reduce((a,b)=>a+b,0)/sl.length;});
  const rys=roll.map(v=>py(v));
  ctx.strokeStyle=cv.lineColor;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(xs[0],rys[0]);smLine(xs,rys);ctx.stroke();
  // Last-value highlighted dot
  const lvx=xs[xs.length-1],lvy=ys[ys.length-1],lvv=values[values.length-1];
  ctx.shadowColor=cv.lineColor;ctx.shadowBlur=8;
  ctx.fillStyle=cv.lineColor;ctx.beginPath();ctx.arc(lvx,lvy,5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(lvx,lvy,2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=cv.lineColor;ctx.textAlign='right';ctx.font="700 9px 'DM Mono',monospace";
  ctx.fillText((isSign?(lvv>0?'+':'')+lvv.toFixed(1):lvv.toFixed(key==='spin_rate'?0:1)),lvx-8,lvy-7);

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
  ctx.fillStyle=cv.titleTxt;ctx.textAlign='left';ctx.font="700 11px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${progLabel(key).toUpperCase()} · ${values.length} shots`,pad.l,pad.t-12);

  const ud=[...new Set(dates)];ctx.font="9px 'DM Mono',monospace";ctx.textAlign='left';let lx=pad.l;
  ud.forEach(d=>{if(lx>w-60)return;const col=colorMap[d]||cv.lineColor;ctx.fillStyle=col;ctx.beginPath();ctx.arc(lx+4,pad.t+ch+20,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=cv.dim;ctx.fillText(d.slice(5),lx+12,pad.t+ch+23);lx+=54;});

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

const WEDGE_WINDOW_OPTIONS = [
  { value:'', label:'-' },
  { value:"7 o'clock", label:"7 o'clock" },
  { value:"8 o'clock", label:"8 o'clock" },
  { value:"9 o'clock", label:"9 o'clock" },
  { value:"10 o'clock", label:"10 o'clock" },
  { value:"11 o'clock", label:"11 o'clock" },
  { value:'half swing', label:'Half' },
  { value:'3/4 swing', label:'3/4' },
  { value:'full', label:'Full' },
];

function isWedgeShot(s) {
  const ca = CA();
  const wedgeKeys = ['pw','58','sw','aw','gw','lw','60'];
  if (ca?.shotMatchesClub) return wedgeKeys.some(ck => ca.shotMatchesClub(s, ck));
  return wedgeKeys.includes(String(s.club || '').toLowerCase());
}

function isAnalysisWedgeClub() {
  return ['pw','58','sw','aw','gw','lw','60'].includes(analysisClub);
}

function normalizeWedgeWindowValue(value) {
  return value === 'stock' ? 'full' : value;
}

function isWedgeWindowValue(value) {
  const normalized = normalizeWedgeWindowValue(value);
  return WEDGE_WINDOW_OPTIONS.some(o => o.value && o.value === normalized);
}

function wedgeWindowLabelForShot(s) {
  if (isWedgeWindowValue(s.shot_type)) return normalizeWedgeWindowValue(s.shot_type);
  const raw = String(s.shot_type || s.notes || '').toLowerCase();
  const clock = raw.match(/(?:^|\b)([7-9]|10|11)\s*(?:o'?clock|oclock|clock)\b/);
  if (clock) return `${clock[1]} o'clock`;
  if (/\b(half|1\/2|50%)\b/.test(raw)) return 'half swing';
  if (/\b(three quarter|3\/4|75%)\b/.test(raw)) return '3/4 swing';
  if (/\b(full|stock)\b/.test(raw)) return 'full';
  const carry = Number(s.carry);
  if (!carry || isNaN(carry)) return 'unlabelled';
  if (carry <= 15) return '0-15m';
  if (carry <= 25) return '16-25m';
  if (carry <= 35) return '26-35m';
  if (carry <= 50) return '36-50m';
  return '50m+';
}

function renderShotWindowSelect(s) {
  const current = isWedgeWindowValue(s.shot_type) ? normalizeWedgeWindowValue(s.shot_type) : '';
  return `<select id="edit-window-${s.id}" class="edit-select edit-window-select" title="Wedge shot window">
    ${WEDGE_WINDOW_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === current ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
  </select>`;
}

function renderShotWindowDisplay(s) {
  if (!isWedgeShot(s) || !isWedgeWindowValue(s.shot_type)) return '<span class="cell-dim">-</span>';
  const ca = CA();
  const resolvedKey = ca?.resolveClub ? ca.resolveClub(s.club) : null;
  const windowValue = normalizeWedgeWindowValue(s.shot_type);
  const target = resolvedKey && window.getWedgeTarget ? window.getWedgeTarget(resolvedKey, windowValue) : null;
  const targetHtml = target != null ? `<span class="shot-window-target">${target}m</span>` : '';
  return `<span class="shot-window-pill">${escapeHtml(windowValue)}</span>${targetHtml}`;
}

function renderShotRows(shots, sessionCol) {
  return `<div class="analysis-raw-wrap">
    <table class="analysis-raw-table">
      <thead><tr>
        <th>Time</th>
        <th>Carry</th><th>Smash</th>
        <th>Face</th><th>Path</th><th>FTP</th>
        <th>Atk</th><th>Launch</th><th>Spin</th><th>Side</th>
        <th>Use</th><th>Window</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>
        ${shots.map(s => renderShotRow(s, sessionCol)).join('')}
      </tbody>
    </table>
  </div>
  <div class="analysis-shot-card-list">
    ${shots.map(s => renderShotCard(s, sessionCol)).join('')}
  </div>`;
}

function renderShotRow(s, sessionCol) {
  const time = s.shot_time ? new Date(s.shot_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : (s.created_at ? new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '');
  const wedgeShot = isWedgeShot(s);
  if (s.id === editingRowId) {
    return `<tr class="shot-row shot-row-editing" data-id="${s.id}" data-shot-id="${s.id}">
      <td><span class="shot-time">${time}</span></td>
      <td>${f(s.carry,1)}</td><td>${f(s.smash_factor,2)}</td>
      <td>${fSign(s.face_angle,1)}</td><td>${fSign(s.club_path,1)}</td><td>${fSign(s.face_to_path,1)}</td>
      <td>${fSign(s.attack_angle,1)}</td><td>${f(s.launch_angle,1)}</td>
      <td>${s.spin_rate?Math.round(s.spin_rate):'–'}</td><td>${fSign(s.side,1)}</td>
      <td><select id="edit-excl-${s.id}" class="edit-select">
        <option value="0"${!s.exclude_from_progress?' selected':''}>Use</option>
        <option value="1"${s.exclude_from_progress?' selected':''}>Skip</option>
      </select></td>
      <td>${wedgeShot ? renderShotWindowSelect(s) : '<span class="cell-dim">-</span>'}</td>
      <td><input id="edit-notes-${s.id}" class="edit-notes-input" type="text" value="${escapeHtml(s.notes||'')}" placeholder="Notes…"></td>
      <td class="shot-actions">
        <button class="shot-action-btn shot-save" onclick="saveEditRow('${s.id}')">✓</button>
        <button class="shot-action-btn shot-cancel" onclick="cancelEditRow()">✕</button>
      </td>
    </tr>`;
  }
  return `<tr class="shot-row" data-id="${s.id}" data-shot-id="${s.id}">
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
    <td class="${s.exclude_from_progress?'cell-warn':''}">${s.exclude_from_progress?'Skip':'Use'}</td>
    <td>${renderShotWindowDisplay(s)}</td>
    <td class="shot-notes">${escapeHtml(s.notes||'')}</td>
    <td class="shot-actions">
      <button class="shot-action-btn shot-edit" onclick="startEditRow('${s.id}')">Edit</button>
    </td>
  </tr>`;
}

function renderShotCard(s, sessionCol) {
  const time = s.shot_time ? new Date(s.shot_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : (s.created_at ? new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '');
  const wedgeShot = isWedgeShot(s);
  const status = s.exclude_from_progress ? 'Skip' : 'Use';
  if (s.id === editingRowId) {
    return `<div class="analysis-shot-card shot-row-editing" data-shot-id="${s.id}" style="--session-color:${sessionCol}">
      <div class="shot-card-head">
        <span class="shot-card-time">${time}</span>
        <span class="shot-card-carry">${f(s.carry,1)}m</span>
      </div>
      <div class="shot-card-edit-grid">
        <label>Use<select id="edit-excl-m-${s.id}" class="edit-select">
          <option value="0"${!s.exclude_from_progress?' selected':''}>Use</option>
          <option value="1"${s.exclude_from_progress?' selected':''}>Skip</option>
        </select></label>
        ${wedgeShot ? `<label>Window${renderShotWindowSelectMobile(s)}</label>` : ''}
        <label class="shot-card-edit-notes">Notes<input id="edit-notes-m-${s.id}" class="edit-notes-input" type="text" value="${escapeHtml(s.notes||'')}" placeholder="Notes..."></label>
      </div>
      <div class="shot-card-actions">
        <button class="shot-action-btn shot-save" onclick="saveEditRow('${s.id}')">Save</button>
        <button class="shot-action-btn shot-cancel" onclick="cancelEditRow()">Cancel</button>
      </div>
    </div>`;
  }
  return `<div class="analysis-shot-card" data-shot-id="${s.id}" style="--session-color:${sessionCol}">
    <div class="shot-card-head">
      <span class="shot-card-time">${time}</span>
      <span class="shot-card-carry">${f(s.carry,1)}m</span>
      <span class="shot-card-status ${s.exclude_from_progress?'skip':'use'}">${status}</span>
    </div>
    <div class="shot-card-metrics">
      <span><small>Face</small><strong class="${faceCol(s.face_angle)}">${fSign(s.face_angle,1)}</strong></span>
      <span><small>Path</small><strong>${fSign(s.club_path,1)}</strong></span>
      <span><small>FTP</small><strong class="${ftpCol(s.face_to_path)}">${fSign(s.face_to_path,1)}</strong></span>
      <span><small>Spin</small><strong>${s.spin_rate?Math.round(s.spin_rate):'-'}</strong></span>
    </div>
    <div class="shot-card-foot">
      <span>${renderShotWindowDisplay(s)}</span>
      <span class="shot-notes">${escapeHtml(s.notes||'')}</span>
      <button class="shot-action-btn shot-edit" onclick="startEditRow('${s.id}')">Edit</button>
    </div>
  </div>`;
}

function renderShotWindowSelectMobile(s) {
  const current = isWedgeWindowValue(s.shot_type) ? normalizeWedgeWindowValue(s.shot_type) : '';
  return `<select id="edit-window-m-${s.id}" class="edit-select edit-window-select" title="Wedge shot window">
    ${WEDGE_WINDOW_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === current ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
  </select>`;
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
function findVisibleShotNode(id) {
  const nodes = [...document.querySelectorAll(`[data-shot-id="${id}"]`)];
  return nodes.find(n => n.offsetParent !== null) || nodes[0] || null;
}
function renderAnalysisKeepingRow(id){
  const row = findVisibleShotNode(id);
  const beforeTop = row?.getBoundingClientRect().top ?? null;
  const beforeScrollY = window.scrollY;
  renderAnalysis(analysisShots);
  if (beforeTop == null) return;
  requestAnimationFrame(() => {
    const nextRow = findVisibleShotNode(id);
    if (!nextRow) { window.scrollTo(0, beforeScrollY); return; }
    window.scrollBy(0, nextRow.getBoundingClientRect().top - beforeTop);
  });
}
function startEditRow(id){
  editingRowId=id;
  renderAnalysisKeepingRow(id);
}
function cancelEditRow(){const id=editingRowId;editingRowId=null;renderAnalysisKeepingRow(id);}
async function saveEditRow(id){
  const exclEl=document.getElementById(`edit-excl-${id}`)||document.getElementById(`edit-excl-m-${id}`);
  const windowEl=document.getElementById(`edit-window-${id}`)||document.getElementById(`edit-window-m-${id}`);
  const notesEl=document.getElementById(`edit-notes-${id}`)||document.getElementById(`edit-notes-m-${id}`);
  if(!exclEl||!notesEl)return;
  const { user } = await window.TCData.getCurrentUser();
  const uid = user?.id;
  if(!uid){showToast('Not logged in');return;}
  const current = analysisShots.find(s=>s.id===id) || _allFetchedShots.find(s=>s.id===id) || {};
  const updates={exclude_from_progress:exclEl.value==='1',notes:notesEl.value.trim()||null};
  if(windowEl){
    updates.shot_type = windowEl.value || (current.shot_type && !isWedgeWindowValue(current.shot_type) ? current.shot_type : null);
    updates.is_full_shot = windowEl.value ? windowEl.value === 'full' : current.is_full_shot !== false;
  }
  const{error}=await window.supabaseClient.from('trackman_shots').update(updates).eq('id',id).eq('user_id',uid);
  if(error){showToast('Save failed: '+error.message);return;}
  [analysisShots,_allFetchedShots].forEach(arr=>{
    const idx=arr.findIndex(s=>s.id===id);
    if(idx!==-1)arr[idx]={...arr[idx],...updates};
  });
  editingRowId=null;showToast('Saved ✓');renderAnalysisKeepingRow(id);
}

// ── Shot Maps ─────────────────────────────────────────────────────────────
function renderShotMaps(shots, allShots) {
  const colorMap = buildSessionColorMap(allShots);
  const allDates = [...new Set(shots.map(s => (s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))].sort();

  // Init or prune stale dates
  if (analysisMapActiveDates === null || ![...analysisMapActiveDates].some(d => allDates.includes(d))) {
    analysisMapActiveDates = new Set(allDates.slice(-4));
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

// ── Covariance ellipse in canvas-pixel space ───────────────────────────────
function _covEllipse(xs, ys, stdScale) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a,b)=>a+b,0)/n;
  const my = ys.reduce((a,b)=>a+b,0)/n;
  const cxx = xs.reduce((s,x)=>s+(x-mx)**2,0)/(n-1);
  const cyy = ys.reduce((s,y)=>s+(y-my)**2,0)/(n-1);
  const cxy = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/(n-1);
  const disc = Math.sqrt(Math.max(0,(cxx-cyy)**2+4*cxy**2));
  const l1 = Math.sqrt(Math.max(0,(cxx+cyy+disc)/2)) * stdScale;
  const l2 = Math.sqrt(Math.max(0,(cxx+cyy-disc)/2)) * stdScale;
  const angle = 0.5 * Math.atan2(2*cxy, cxx-cyy);
  return { cx:mx, cy:my, rx:Math.max(l1,l2,4), ry:Math.max(Math.min(l1,l2),2), angle };
}

function drawTopViewMap(shots, colorMap) {
  const canvas = document.getElementById('top-view-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio||2, 3);
  const light = document.body.classList.contains('light-theme');
  const w = canvas.parentElement?.clientWidth || 340, h = 300;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cv = _cv();

  // ── Clean background ──────────────────────────────────────────────────────
  ctx.fillStyle = light ? '#f2f0ec' : '#0d1215';
  ctx.fillRect(0, 0, w, h);

  const valid = shots.filter(s => s.carry != null && s.side != null);
  if (!valid.length) {
    ctx.fillStyle=cv.dim; ctx.font="13px 'Barlow',sans-serif"; ctx.textAlign='center';
    ctx.fillText('No lateral data for this club', w/2, h/2); return;
  }

  const carries = valid.map(s=>s.carry), sides = valid.map(s=>s.side);
  const avgCarry = statAvg(carries);
  const sdCarry  = Math.max(statStdDev(carries)||5, 5);
  const maxAbsSide = Math.max(...sides.map(Math.abs), 10);

  const pad = {t:20, r:12, b:44, l:52};
  const cw = w-pad.l-pad.r, ch = h-pad.t-pad.b;

  const sideRange  = Math.max(maxAbsSide * 1.45, 14);
  const carryRange = Math.max(sdCarry * 5.2, 22);
  const carryMin   = Math.max(0, avgCarry - carryRange * 0.42);
  const carryMax   = carryMin + carryRange;

  const mapX = sv  => pad.l + cw * (sv + sideRange) / (sideRange * 2);
  const mapY = cvv => pad.t + ch - ch * (cvv - carryMin) / (carryMax - carryMin);

  // ── Concentric distance arcs from tee (below chart) ───────────────────────
  // Tee is at carry=0 in metric space; in canvas coords it is below the chart.
  const pyPerM = ch / carryRange;
  const oy = pad.t + ch + carryMin * pyPerM; // canvas Y of the tee (below visible area)
  const originX = mapX(0);
  const carryStep = Math.ceil(carryRange/4/5)*5;
  const cFirst = Math.ceil(carryMin/carryStep)*carryStep;

  ctx.save();
  ctx.beginPath(); ctx.rect(pad.l, pad.t, cw, ch); ctx.clip();
  for (let c=cFirst; c<=carryMax+carryStep; c+=carryStep) {
    const arcR = c * pyPerM; // distance from tee in px
    ctx.beginPath();
    ctx.arc(originX, oy, arcR, 0, Math.PI*2);
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 0.9; ctx.stroke();
  }
  ctx.restore();

  // ── Fairway corridor (subtle green tint) ──────────────────────────────────
  const fwL = mapX(-14), fwR = mapX(14);
  if (fwR - fwL > 6) {
    const g = ctx.createLinearGradient(fwL, 0, fwR, 0);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.18, light ? 'rgba(60,110,50,0.09)' : 'rgba(0,214,143,0.05)');
    g.addColorStop(0.5,  light ? 'rgba(60,110,50,0.14)' : 'rgba(0,214,143,0.08)');
    g.addColorStop(0.82, light ? 'rgba(60,110,50,0.09)' : 'rgba(0,214,143,0.05)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(fwL, pad.t, fwR-fwL, ch);
  }

  // ── Grid: carry lines (horizontal) ────────────────────────────────────────
  for (let c=cFirst; c<=carryMax; c+=carryStep) {
    const y = mapY(c);
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth=1; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = light ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.58)';
    ctx.font = "10px 'DM Mono',monospace"; ctx.textAlign='right';
    ctx.fillText(Math.round(c)+'m', pad.l-3, y+3.5);
  }

  // ── Grid: side lines (vertical) ───────────────────────────────────────────
  const sideStep = Math.ceil(sideRange/3/5)*5;
  for (let s=-Math.floor(sideRange/sideStep)*sideStep; s<=sideRange; s+=sideStep) {
    if (s===0) continue;
    const x = mapX(s);
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth=1; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,pad.t+ch); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Side distance labels at bottom of grid
  ctx.font = "9px 'DM Mono',monospace";
  ctx.fillStyle = light ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.52)';
  for (let s=-Math.floor(sideRange/sideStep)*sideStep; s<=sideRange; s+=sideStep) {
    const x = mapX(s);
    if (x < pad.l+4 || x > pad.l+cw-4) continue;
    ctx.textAlign = 'center';
    ctx.fillText((s===0?'0':(s>0?'+':'')+s)+'m', x, pad.t+ch+20);
  }

  // ── Centre target line ────────────────────────────────────────────────────
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.10)';
  ctx.lineWidth=1.2; ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(mapX(0),pad.t); ctx.lineTo(mapX(0),pad.t+ch); ctx.stroke();
  ctx.setLineDash([]);

  // ── Per-session dispersion ellipses ───────────────────────────────────────
  const byDate = {};
  valid.forEach(s => {
    const date = (s.shot_time||s.created_at)?.slice(0,10)||'?';
    if (!byDate[date]) byDate[date] = {xs:[], ys:[]};
    byDate[date].xs.push(mapX(s.side));
    byDate[date].ys.push(mapY(s.carry));
  });

  // Draw ellipses back-to-front (largest first)
  const ellipses = [];
  Object.entries(byDate).forEach(([date, {xs, ys}]) => {
    const col = colorMap[date] || '#8a9099';
    const ell = _covEllipse(xs, ys, 1.6);
    if (ell) ellipses.push({...ell, col, n:xs.length});
  });
  ellipses.sort((a,b)=>b.rx*b.ry - a.rx*a.ry);

  ellipses.forEach(({cx, cy, rx, ry, angle, col}) => {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.globalAlpha = 0.09; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.70;
    ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  });

  // ── Shot dots ─────────────────────────────────────────────────────────────
  valid.forEach(s => {
    const date = (s.shot_time||s.created_at)?.slice(0,10)||'';
    const col = colorMap[date]||'#8a9099';
    const x = mapX(s.side), y = mapY(s.carry);
    if (x<pad.l-6||x>pad.l+cw+6||y<pad.t-6||y>pad.t+ch+6) return;
    // Glow
    ctx.fillStyle = col; ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.fill();
    // Fill
    ctx.globalAlpha = 0.88;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI*2); ctx.fill();
    // Specular
    ctx.fillStyle = 'rgba(255,255,255,0.40)'; ctx.globalAlpha = 0.40;
    ctx.beginPath(); ctx.arc(x-1.2, y-1.2, 1.6, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // ── Average target ring ───────────────────────────────────────────────────
  const cx0 = mapX(0), cy0 = mapY(avgCarry);
  const ac = light ? '#007a45' : '#00d68f';
  // Halo
  const halo = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, 16);
  halo.addColorStop(0, light ? 'rgba(0,122,69,0.22)' : 'rgba(0,214,143,0.22)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx0, cy0, 16, 0, Math.PI*2); ctx.fill();
  // Outer ring
  ctx.strokeStyle = ac; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.arc(cx0, cy0, 9, 0, Math.PI*2); ctx.stroke();
  // Inner dot
  ctx.fillStyle = ac; ctx.globalAlpha = 0.92;
  ctx.beginPath(); ctx.arc(cx0, cy0, 4.5, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Edge direction labels ─────────────────────────────────────────────────
  ctx.font = "9px 'DM Mono',monospace";
  ctx.fillStyle = light ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.36)';
  ctx.textAlign = 'left';  ctx.fillText('← L', pad.l,     pad.t+ch+36);
  ctx.textAlign = 'right'; ctx.fillText('R →', pad.l+cw,  pad.t+ch+36);
}

function drawSideViewMap(shots, colorMap) {
  const canvas = document.getElementById('side-view-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio||2, 3);
  const light = document.body.classList.contains('light-theme');
  const w = canvas.parentElement?.clientWidth || 340, h = 185;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cv = _cv();

  const valid = shots.filter(s => s.carry != null);

  // ── Background: sky + rough + green ground ────────────────────────────────
  const groundH = 22;   // green band at bottom
  const roughH  = 14;   // gray rough above green
  const groundY = h - groundH;
  const roughY  = groundY - roughH;

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, roughY);
  skyGrad.addColorStop(0, light ? 'rgba(190,215,240,0.30)' : 'rgba(12,22,40,0.80)');
  skyGrad.addColorStop(1, light ? 'rgba(190,215,240,0)'    : 'rgba(12,22,40,0)');
  ctx.fillStyle = light ? '#f0eeea' : '#0d1215';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, roughY);

  // Rough strip
  ctx.fillStyle = light ? 'rgba(165,190,145,0.55)' : 'rgba(22,40,14,0.60)';
  ctx.fillRect(0, roughY, w, roughH);

  // Green ground band
  ctx.fillStyle = light ? 'rgba(80,155,55,0.55)' : 'rgba(25,65,18,0.80)';
  ctx.fillRect(0, groundY, w, groundH);
  // Green/rough edge line
  ctx.strokeStyle = light ? 'rgba(55,120,35,0.50)' : 'rgba(50,140,30,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

  if (!valid.length) {
    ctx.fillStyle=cv.dim; ctx.font="13px 'Barlow',sans-serif"; ctx.textAlign='center';
    ctx.fillText('No carry data', w/2, roughY/2); return;
  }

  const carries  = valid.map(s=>s.carry);
  const totals   = valid.map(s=>s.total||s.carry);
  const heights  = valid.map(s=>s.max_height).filter(Boolean);
  const launches = valid.map(s=>s.launch_angle).filter(x=>x!=null&&x>1);
  const landings = valid.map(s=>s.landing_angle).filter(x=>x!=null&&x>1);

  const avgCarry   = statAvg(carries);
  const avgTotal   = statAvg(totals);
  const avgApex    = heights.length ? statAvg(heights) : avgCarry * 0.14;
  const avgLaunch  = launches.length ? statAvg(launches) : 0;
  const avgLanding = landings.length ? statAvg(landings) : 0;
  const maxTotal   = Math.max(...totals) * 1.08;
  const maxHeight  = (heights.length ? Math.max(...heights) : avgApex*1.4) * 1.18;

  const pad = {t:20, r:14, b:groundH+roughH+4, l:10};
  const cw = w-pad.l-pad.r, ch = h-pad.t-pad.b;

  const mapX = d  => pad.l + (d/maxTotal)*cw;
  const mapY = ht => pad.t + ch - (ht/maxHeight)*ch;
  const groundPY = mapY(0);

  // ── Distance grid ─────────────────────────────────────────────────────────
  ctx.font="9px 'DM Mono',monospace";
  const distStep = Math.ceil(maxTotal/4/5)*5;
  for (let d=distStep; d<=maxTotal; d+=distStep) {
    const x=mapX(d);
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth=1; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,groundPY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=cv.dim; ctx.textAlign='center';
    ctx.fillText(Math.round(d)+'m', x, groundPY+roughH+10);
  }

  // ── Arc control-point helper ──────────────────────────────────────────────
  // For a quadratic Bézier with both endpoints at groundPY, the control point
  // is the intersection of the launch tangent (rising from x0) and the landing
  // tangent (descending into xc).  Falls back to max_height, then geometry.
  const _cp = (x0, xc, launchDeg, landingDeg, apexH) => {
    const la = launchDeg  > 1 ? Math.tan(Math.min(launchDeg,  50) * Math.PI / 180) : 0;
    const ld = landingDeg > 1 ? Math.tan(Math.min(Math.abs(landingDeg), 75) * Math.PI / 180) : 0;
    if (la > 0 && ld > 0) {
      const x1 = (la * x0 + ld * xc) / (la + ld);
      return { cpX: x1, cpY: Math.max(pad.t+2, groundPY - la * (x1 - x0)) };
    }
    const ah = apexH > 0 ? apexH : avgApex;
    return { cpX: x0 + (xc - x0) * 0.42, cpY: Math.max(pad.t+2, 2 * mapY(ah) - groundPY) };
  };

  // ── Individual shot arcs ───────────────────────────────────────────────────
  valid.forEach(s => {
    const date=(s.shot_time||s.created_at)?.slice(0,10)||'';
    const col=colorMap[date]||'#8a9099';
    const carry=s.carry, total=s.total||carry;
    const {cpX,cpY}=_cp(mapX(0), mapX(carry), s.launch_angle, s.landing_angle, s.max_height);

    ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.globalAlpha=0.38; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(mapX(0), groundPY);
    ctx.quadraticCurveTo(cpX, cpY, mapX(carry), groundPY);
    ctx.stroke();

    if (total > carry+0.5) {
      const rollPx = mapX(total) - mapX(carry);
      const ld = (s.landing_angle > 1) ? s.landing_angle : 38;
      const h0 = Math.min(Math.max(rollPx * Math.tan(ld * Math.PI / 180) * 0.40, 3), ch * 0.18);
      const ox = mapX(carry);
      // Three decaying bounces then flat roll: [end_fraction, peak_height]
      const seq = [[0.20,h0],[0.40,h0*0.42],[0.57,h0*0.16],[1.00,0]];
      ctx.globalAlpha=0.25; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(ox, groundPY);
      let px = ox;
      for (const [f,h] of seq) {
        const ex = ox + rollPx * f;
        ctx.quadraticCurveTo((px+ex)/2, groundPY-h, ex, groundPY);
        px = ex;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha=1; ctx.lineCap='butt';
  });

  // ── Average arc — highlighted ─────────────────────────────────────────────
  const {cpX:avgCpX, cpY:avgCpY} = _cp(mapX(0), mapX(avgCarry), avgLaunch, avgLanding, avgApex);
  const ac = light ? '#007a45' : '#00d68f';

  // Glow
  ctx.strokeStyle=ac; ctx.lineWidth=6; ctx.globalAlpha=0.09; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(mapX(0),groundPY);
  ctx.quadraticCurveTo(avgCpX, avgCpY, mapX(avgCarry), groundPY);
  ctx.stroke();
  // Main
  ctx.lineWidth=2.8; ctx.globalAlpha=0.92;
  ctx.beginPath(); ctx.moveTo(mapX(0),groundPY);
  ctx.quadraticCurveTo(avgCpX, avgCpY, mapX(avgCarry), groundPY);
  ctx.stroke();

  if (avgTotal > avgCarry+0.5) {
    const rollPx = mapX(avgTotal) - mapX(avgCarry);
    const avgLd = avgLanding > 1 ? avgLanding : 38;
    const h0 = Math.min(Math.max(rollPx * Math.tan(avgLd * Math.PI / 180) * 0.40, 3), ch * 0.18);
    const ox = mapX(avgCarry);
    const seq = [[0.20,h0],[0.40,h0*0.42],[0.57,h0*0.16],[1.00,0]];
    ctx.globalAlpha=0.60; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(ox, groundPY);
    let px = ox;
    for (const [f,h] of seq) {
      const ex = ox + rollPx * f;
      ctx.quadraticCurveTo((px+ex)/2, groundPY-h, ex, groundPY);
      px = ex;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1; ctx.lineCap='butt';

  // Landing dot
  ctx.fillStyle=ac; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.arc(mapX(avgCarry), groundPY, 4, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  // ── Apex label + stat line ────────────────────────────────────────────────
  ctx.fillStyle=cv.dim; ctx.font="9px 'DM Mono',monospace"; ctx.textAlign='left';
  let lbl = `avg carry ${f(avgCarry)}m`;
  if (avgTotal > avgCarry+0.5) lbl += `  roll ${f(avgTotal-avgCarry)}m`;
  if (heights.length) lbl += `  apex ${f(avgApex)}m`;
  if (avgLaunch > 1)  lbl += `  LA ${f(avgLaunch,0)}°`;
  ctx.fillText(lbl, pad.l+2, pad.t-5);
  // Apex dot: x from Bézier midpoint, y from measured height or Bézier estimate
  const showApex = heights.length > 0 || (avgLaunch > 1 && avgLanding > 1);
  if (showApex) {
    const x0a=mapX(0), xca=mapX(avgCarry);
    const apexX = 0.25*x0a + 0.5*avgCpX + 0.25*xca;
    const apexY = Math.max(pad.t+4, heights.length ? mapY(avgApex) : 0.5*(groundPY+avgCpY));
    ctx.strokeStyle=ac; ctx.lineWidth=1; ctx.globalAlpha=0.4; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(apexX, groundPY); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    ctx.fillStyle=ac; ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.arc(apexX, apexY, 3, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}

// ── Distribution histograms ────────────────────────────────────────────────
function _drawHistogram(canvasId, values, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values.length) return;
  const { unit = 'm', median, sd, title = '' } = opts || {};
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const light = document.body.classList.contains('light-theme');
  const w = canvas.parentElement?.clientWidth || 340, h = 88;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.fillStyle = light ? '#f2f0ec' : '#0d1215'; ctx.fillRect(0, 0, w, h);
  const pad = { t:20, r:14, b:22, l:12 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const lo = Math.min(...values), hi = Math.max(...values);
  const range = hi - lo || 1;
  const nBins = Math.max(6, Math.min(14, Math.round(Math.sqrt(values.length) * 1.6)));
  const binW = range / nBins;
  const bins = Array(nBins).fill(0);
  values.forEach(v => { const idx = Math.min(Math.floor((v - lo) / binW), nBins - 1); bins[idx]++; });
  const maxCount = Math.max(...bins, 1);
  const xOf = v => pad.l + cw * (v - lo) / range;
  const bpx = cw / nBins;
  if (median != null && sd != null) {
    const sdL = Math.max(pad.l, xOf(median - sd));
    const sdR = Math.min(pad.l + cw, xOf(median + sd));
    ctx.fillStyle = light ? 'rgba(0,120,80,0.11)' : 'rgba(0,214,143,0.09)';
    ctx.fillRect(sdL, pad.t, sdR - sdL, ch);
  }
  const barClr = light ? 'rgba(0,122,69,0.55)' : 'rgba(0,214,143,0.48)';
  bins.forEach((count, i) => {
    const barH = ch * count / maxCount;
    ctx.fillStyle = barClr;
    ctx.fillRect(pad.l + i * bpx + 1, pad.t + ch - barH, bpx - 2, barH);
  });
  if (median != null) {
    const mx = xOf(median);
    if (mx >= pad.l && mx <= pad.l + cw) {
      ctx.strokeStyle = light ? 'rgba(0,122,69,0.90)' : 'rgba(0,214,143,0.90)';
      ctx.lineWidth = 1.8; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(mx, pad.t); ctx.lineTo(mx, pad.t + ch); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = light ? 'rgba(0,122,69,0.9)' : 'rgba(0,214,143,0.9)';
      ctx.font = "bold 9px 'DM Mono',monospace"; ctx.textAlign = 'center';
      ctx.fillText(Math.round(median) + unit, mx, pad.t - 5);
    }
  }
  const lblClr = light ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.38)';
  ctx.fillStyle = lblClr; ctx.font = "8px 'DM Mono',monospace";
  ctx.textAlign = 'left';  ctx.fillText(Math.round(lo) + unit, pad.l, h - 4);
  ctx.textAlign = 'right'; ctx.fillText(Math.round(hi) + unit, pad.l + cw, h - 4);
  if (title) { ctx.textAlign = 'center'; ctx.fillStyle = light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.25)'; ctx.fillText(title, pad.l + cw / 2, h - 4); }
}

function _drawDirHistogram(canvasId, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values.length) return;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const light = document.body.classList.contains('light-theme');
  const w = canvas.parentElement?.clientWidth || 340, h = 82;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.fillStyle = light ? '#f2f0ec' : '#0d1215'; ctx.fillRect(0, 0, w, h);
  const pad = { t:8, r:12, b:22, l:12 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const maxAbs = Math.max(...values.map(Math.abs), 12) * 1.15;
  const nBins = 14;
  const binW = (maxAbs * 2) / nBins;
  const bins = Array(nBins).fill(0);
  values.forEach(v => { const idx = Math.min(Math.floor((v + maxAbs) / binW), nBins - 1); bins[idx]++; });
  const maxCount = Math.max(...bins, 1);
  const xOf = v => pad.l + cw * (v + maxAbs) / (maxAbs * 2);
  const bpx = cw / nBins;
  const corrL = xOf(-5), corrR = xOf(5);
  ctx.fillStyle = light ? 'rgba(0,120,80,0.09)' : 'rgba(0,214,143,0.07)';
  ctx.fillRect(Math.max(pad.l, corrL), pad.t, Math.min(corrR, pad.l+cw) - Math.max(pad.l, corrL), ch);
  bins.forEach((count, i) => {
    const barH = ch * count / maxCount;
    const binCentre = -maxAbs + (i + 0.5) * binW;
    const clr = Math.abs(binCentre) <= 5
      ? (light ? 'rgba(0,120,60,0.58)' : 'rgba(0,200,110,0.52)')
      : binCentre < 0 ? (light ? 'rgba(80,100,200,0.55)' : 'rgba(120,150,255,0.52)')
        : (light ? 'rgba(210,90,50,0.55)' : 'rgba(255,140,80,0.52)');
    ctx.fillStyle = clr;
    ctx.fillRect(pad.l + i * bpx + 1, pad.t + ch - barH, bpx - 2, barH);
  });
  const cx0 = xOf(0);
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx0, pad.t); ctx.lineTo(cx0, pad.t + ch); ctx.stroke();
  ctx.font = "8px 'DM Mono',monospace";
  ctx.fillStyle = light ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.38)';
  ctx.textAlign = 'left';  ctx.fillText('L', pad.l, h - 4);
  ctx.textAlign = 'center'; ctx.fillText('0m', cx0, h - 4);
  ctx.textAlign = 'right'; ctx.fillText('R', pad.l + cw, h - 4);
}

// ── Alias Manager ──────────────────────────────────────────────────────────
async function renderAliasManager(){
  const el=document.getElementById('alias-manager');if(!el)return;
  const { user } = await window.TCData.getCurrentUser();
  if(!user){
    el.innerHTML='<div class="alias-msg" style="padding:8px 0;">Log in to manage club aliases.</div>';
    return;
  }
  await CA().loadAliases();
  const unknowns=CA().findUnknownClubNames(_allFetchedShots);
  const defs=CA().CLUB_DEFINITIONS;
  el.innerHTML=`
    <p class="alias-intro">Maps raw TrackMan names → canonical clubs. One place, everything reads from here.</p>
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
      <thead><tr><th>Raw TrackMan Name</th><th>Club</th><th></th></tr></thead>
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
window.setReportFilter        = setReportFilter;
window.setReportWindow        = setReportWindow;
window.setSwingCauseChoice    = setSwingCauseChoice;
window.setSwingPracticeResult = setSwingPracticeResult;
window.showTrackmanSection    = showTrackmanSection;
window.switchChartMode        = switchChartMode;
window.switchProgChart        = switchProgChart;
window.redrawCurrentTrackmanChart = redrawCurrentTrackmanChart;
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
