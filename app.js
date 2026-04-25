// app.js v6

let club = 'driver';
let rangeMode = 'realistic';
const vals = {};
let lastColor = {};
let activeKPIExplain = null;

// ── Tab memory ─────────────────────────────────────────────────────────────
function getLastTab() {
  try { return localStorage.getItem('tc_last_tab') || 'today'; } catch { return 'today'; }
}
function setLastTab(page) {
  try { localStorage.setItem('tc_last_tab', page); } catch {}
}

// ── Range mode memory ──────────────────────────────────────────────────────
function getSavedRangeMode() {
  try { return localStorage.getItem('tc_range_mode') || 'realistic'; } catch { return 'realistic'; }
}
function saveRangeMode(mode) {
  try { localStorage.setItem('tc_range_mode', mode); } catch {}
}

// ── Auth panel toggle ───────────────────────────────────────────────────────
function toggleAuthPanel() {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
}

// ── More panel ─────────────────────────────────────────────────────────────
function toggleMorePanel() {
  const panel = document.getElementById('more-panel');
  const btn   = document.getElementById('more-btn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.classList.toggle('active', !isOpen);
  if (isOpen) closeMoreSection();
  const ap = document.getElementById('auth-panel');
  if (ap) ap.style.display = 'none';
}

const MORE_SECTIONS = {
  progress:    { title: 'Progress',        html: '<div class="more-placeholder">Progress tracking coming soon.<br><br>Train regularly and your stats will appear here as you log sessions.</div>' },
  players:     { title: 'Players',         html: '<div class="more-placeholder">Each player can log in and has private data. Sharing and coach access will be added later.</div>' },
  import:      { title: 'Import settings', html: '<div class="more-placeholder">Import settings coming soon.<br><br>Use More → Club aliases to map TrackMan club names to your bag.</div>' },
  profile:     { title: 'Profile',         html: '<div class="more-placeholder">Profile settings coming soon.</div>' },
  appsettings: { title: 'App settings',    html: '<div class="more-placeholder">Your golf data is stored under your own user account.<br><br>Version: 0.3</div>' }
};

function openMoreSection(name) {
  if (name === 'aliases') {
    document.getElementById('more-list').style.display = 'none';
    document.getElementById('more-section').style.display = 'none';
    document.getElementById('more-aliases-section').style.display = 'flex';
    if (typeof renderAliasManager === 'function') renderAliasManager();
    return;
  }
  if (name === 'progress') {
    document.getElementById('more-list').style.display = 'none';
    document.getElementById('more-aliases-section').style.display = 'none';
    document.getElementById('more-section-title').textContent = 'Progress';
    document.getElementById('more-section-body').innerHTML = '<div class="stats-loading">Loading…</div>';
    document.getElementById('more-section').style.display = 'flex';
    if (typeof window.loadProgressSection === 'function') window.loadProgressSection();
    return;
  }
  const section = MORE_SECTIONS[name];
  if (!section) return;
  document.getElementById('more-list').style.display = 'none';
  document.getElementById('more-section-title').textContent = section.title;
  document.getElementById('more-section-body').innerHTML = section.html;
  document.getElementById('more-section').style.display = 'flex';
}

function closeMoreSection() {
  const list  = document.getElementById('more-list');
  const sec   = document.getElementById('more-section');
  const alias = document.getElementById('more-aliases-section');
  if (list)  list.style.display  = 'flex';
  if (sec)   sec.style.display   = 'none';
  if (alias) alias.style.display = 'none';
}

// ── Club selector ──────────────────────────────────────────────────────────
function sel(id, el) {
  club = id;
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  activeKPIExplain = null;
  render();
  loadLastSessionBanner();
}

// ── Range mode ─────────────────────────────────────────────────────────────
function setRangeMode(mode) {
  if (mode !== 'realistic' && mode !== 'good') return;
  rangeMode = mode;
  saveRangeMode(mode);
  applyRangeModeToClubs(rangeMode);
  updateModeButtons();
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  render();
}
function updateModeButtons() {
  document.getElementById('mode-realistic')?.classList.toggle('on', rangeMode === 'realistic');
  document.getElementById('mode-good')?.classList.toggle('on', rangeMode === 'good');
}
function getRangeLabel()    { return rangeMode === 'good' ? 'Good target' : 'Realistic'; }
function getIdealRange(inp) { return inp[rangeMode] || inp.realistic || inp.ideal; }
function getKpiDisplayValue(kpi) { return kpi[rangeMode] || kpi.realistic || kpi.v || ''; }

// ── Accordion ──────────────────────────────────────────────────────────────
function toggleAcc(id) {
  const el = document.getElementById('acc-' + id);
  if (!el) return;
  vibrate(10);
  const wasOpen = el.classList.contains('open');
  el.classList.toggle('open');
  const body = document.getElementById('acc-body-' + id);
  if (body) {
    if (!wasOpen) {
      body.style.maxHeight = body.scrollHeight + 2000 + 'px';
      body.style.opacity = '1';
    } else {
      body.style.maxHeight = '0';
      body.style.opacity = '0';
    }
  }
  if (!wasOpen) {
    if (id === 'viz') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
        drawVizs();
      }));
    }
    if (id === 'shot') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (typeof _drawShotShape === 'function') _drawShotShape();
      }));
    }
  }
}

function toggleAccById(id) {
  const el = document.getElementById(id);
  if (!el) return;
  vibrate(10);
  const wasOpen = el.classList.contains('open');
  el.classList.toggle('open', !wasOpen);
  const body = el.querySelector('.acc-body');
  if (body) {
    if (wasOpen) {
      body.style.maxHeight = '0';
      body.style.opacity = '0';
    } else {
      body.style.maxHeight = body.scrollHeight + 2000 + 'px';
      body.style.opacity = '1';
    }
  }
}

function openAcc(id) {
  const el = document.getElementById('acc-' + id);
  if (!el || el.classList.contains('open')) return;
  el.classList.add('open');
  const body = document.getElementById('acc-body-' + id);
  if (body) { body.style.maxHeight = '4000px'; body.style.opacity = '1'; }
}

function toggleLogForm(id) {
  const head = document.getElementById('sub-head-' + id);
  const body = document.getElementById('sub-body-' + id);
  if (!head || !body) return;
  const isOpen = head.classList.contains('open');
  head.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
  if (!isOpen) { body.style.maxHeight = body.scrollHeight + 400 + 'px'; body.style.opacity = '1'; }
  else { body.style.maxHeight = '0'; body.style.opacity = '0'; }
}

function openLogForm(id) {
  const head = document.getElementById('sub-head-' + id);
  const body = document.getElementById('sub-body-' + id);
  if (!head || !body || head.classList.contains('open')) return;
  head.classList.add('open');
  body.classList.add('open');
  body.style.maxHeight = '900px';
  body.style.opacity = '1';
}

function toggleSub(id) {
  const head = document.getElementById('sub-head-' + id);
  const body = document.getElementById('sub-body-' + id);
  if (!head || !body) return;
  vibrate(10);
  head.classList.toggle('open');
  body.classList.toggle('open');
  body.style.maxHeight = '';
  body.style.opacity = '';
}

// ── Colors ─────────────────────────────────────────────────────────────────
function getColorAdapted(inp, v) {
  const [lo, hi] = getIdealRange(inp);
  if (v >= lo && v <= hi) return '#00d68f';
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return '#ffaa00';
  return '#ff4d4d';
}
function getColor(inp, v) { return getColorAdapted(inp, v); }
function fillPct(inp, v)  { return Math.round((v - inp.min) / (inp.max - inp.min) * 100); }
function dispVal(inp, v)  { return inp.scale ? (v / inp.scale).toFixed(inp.dp || 2) + inp.unit : v + inp.unit; }
function formatIdealValue(val, inp) {
  if (inp.scale) return (val / inp.scale).toFixed(inp.dp || 2);
  return Number.isInteger(val) ? String(val) : String(val);
}
function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

// ── KPI Explain ────────────────────────────────────────────────────────────
function toggleKPIExplain(idx) {
  if (activeKPIExplain === idx) {
    activeKPIExplain = null;
  } else {
    activeKPIExplain = idx;
    vibrate(10);
  }
  renderKPIGrid();
}

function renderKPIGrid() {
  const C = CLUBS[club];
  document.getElementById('kgrid').innerHTML = C.kpis.map((k, i) => {
    const isOpen = activeKPIExplain === i;
    return `<div class="kcard ${badgeToClass(k.bt)}${isOpen ? ' kcard-open' : ''}" onclick="toggleKPIExplain(${i})">
      <div class="kcard-lbl">
        ${k.l}
        <span class="kpi-info-icon">${isOpen ? '▲' : 'ⓘ'}</span>
      </div>
      <div class="kcard-val">${getKpiDisplayValue(k)}</div>
      <div class="kcard-desc">${k.d.split('.')[0]}.</div>
      <div class="badge ${k.badge}">${k.bt}</div>
      ${isOpen ? `<div class="kpi-explain-panel">${k.d}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Distance strip ─────────────────────────────────────────────────────────
function renderDistanceStrip() {
  const el = document.getElementById('distance-strip');
  if (!el) return;
  const C = CLUBS[club];

  // For irons we want to show per-iron distances; for others just the ref club
  const ironKeys = ['6i','7i','8i','9i'];
  const wedgeKeys = ['pw','sw','58'];

  if (club === 'irons') {
    const rows = ironKeys.map(k => {
      const d = getDistanceRow(k);
      return d ? `<span class="dist-chip"><span class="dist-club">${d.label.replace(' Iron','i')}</span><span class="dist-carry">${d.carry}m</span></span>` : '';
    }).join('');
    el.innerHTML = rows;
  } else if (club === 'wedge') {
    const rows = wedgeKeys.map(k => {
      const d = getDistanceRow(k);
      return d ? `<span class="dist-chip"><span class="dist-club">${d.label}</span><span class="dist-carry">${d.carry}m</span></span>` : '';
    }).join('');
    el.innerHTML = rows;
  } else {
    const dr = getClubDistance(club);
    if (dr && dr.carry > 0) {
      el.innerHTML = `<span class="dist-chip"><span class="dist-club">${dr.label}</span><span class="dist-carry">${dr.carry}m carry</span><span class="dist-total">${dr.total}m total</span></span>`;
    } else {
      el.innerHTML = '';
    }
  }
}

// ── Pre-shot routine ───────────────────────────────────────────────────────
function renderRoutine() {
  const C = CLUBS[club];
  const el = document.getElementById('routine-steps');
  if (!el || !C.routine) return;
  el.innerHTML = C.routine.map(r => `
    <div class="routine-step">
      <div class="routine-num">${r.step}</div>
      <div class="routine-content">
        <div class="routine-cue">${r.cue}</div>
        <div class="routine-detail">${r.detail}</div>
      </div>
    </div>
  `).join('');
}

// ── Slider builder ─────────────────────────────────────────────────────────
function buildSlider(inp, v, prefix) {
  const col     = getColorAdapted(inp, v);
  const pct     = fillPct(inp, v);
  const ideal   = getIdealRange(inp);
  const idealStr = `${getRangeLabel().toLowerCase()} ${formatIdealValue(ideal[0], inp)}${inp.unit.trim()} → ${formatIdealValue(ideal[1], inp)}${inp.unit.trim()}`;
  return `<div class="irow" id="${prefix}row-${inp.id}">
    <div class="irow-top">
      <span class="irow-lbl">${inp.l}</span>
      <span class="irow-val" id="${prefix}val-${inp.id}" style="color:${col}">${dispVal(inp, v)}</span>
    </div>
    <input type="range" id="${prefix}range-${inp.id}"
      min="${inp.min}" max="${inp.max}" value="${v}" step="${inp.step || 1}"
      style="--track-color:${col};--track-pct:${pct}%"
      oninput="onSlider('${inp.id}',+this.value,'${prefix}')">
    <div class="irow-labels">
      <span>${inp.min}${inp.unit.trim()}</span>
      <span class="ideal-lbl" style="color:${col}">${idealStr}</span>
      <span>${inp.max}${inp.unit.trim()}</span>
    </div>
  </div>`;
}

// ── Render ─────────────────────────────────────────────────────────────────
function badgeToClass(bt) {
  return bt === 'Critical' ? 'critical' : bt === 'Important' ? 'important' : 'watch';
}

function render() {
  const C = CLUBS[club];
  if (!vals[club]) vals[club] = {};

  renderKPIGrid();

  document.getElementById('focusbox').innerHTML = C.focus.map(f =>
    `<div class="focus-item"><span class="dot ${f.c}"></span><span>${f.t}</span></div>`
  ).join('');

  document.getElementById('kpi-sub').textContent = `${C.kpis.length} metrics · ${getRangeLabel()}`;

  document.getElementById('primary-sliders').innerHTML = C.primary.map(inp => {
    const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    return buildSlider(inp, v, 'main-');
  }).join('');

  const secEl = document.getElementById('secondary-section');
  if (C.secondary?.length) {
    secEl.style.display = 'block';
    document.getElementById('secondary-count').textContent = C.secondary.length;
    document.getElementById('secondary-sliders').innerHTML = C.secondary.map(inp => {
      const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
      return buildSlider(inp, v, 'main-');
    }).join('');
  } else { secEl.style.display = 'none'; }

  const advEl = document.getElementById('advanced-section');
  if (C.advanced?.length) {
    advEl.style.display = 'block';
    document.getElementById('advanced-count').textContent = C.advanced.length;
    document.getElementById('advanced-sliders').innerHTML = C.advanced.map(inp => {
      const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
      return buildSlider(inp, v, 'main-');
    }).join('');
  } else { advEl.style.display = 'none'; }

  const hasFace = C.primary.find(i => i.id === 'face');
  const hasPath = C.primary.find(i => i.id === 'path');
  document.getElementById('acc-shot').style.display =
    (hasFace && hasPath && club !== 'putter') ? 'block' : 'none';

  ['secondary','advanced'].forEach(id => {
    const head = document.getElementById('sub-head-' + id);
    const body = document.getElementById('sub-body-' + id);
    if (head) head.classList.remove('open');
    if (body) { body.classList.remove('open'); body.style.maxHeight = ''; body.style.opacity = ''; }
  });

  renderDistanceStrip();
  renderRoutine();
  diagnose();

  if (document.getElementById('acc-viz')?.classList.contains('open')) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
      drawVizs();
    }));
  }
  if (document.getElementById('acc-shot')?.classList.contains('open')) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (typeof _drawShotShape === 'function') _drawShotShape();
    }));
  }
}

// ── Slider update ──────────────────────────────────────────────────────────
function onSlider(id, v, prefix) {
  if (!vals[club]) vals[club] = {};
  vals[club][id] = v;
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return;
  const col = getColorAdapted(inp, v);
  const pct = fillPct(inp, v);
  const ideal = getIdealRange(inp);
  const idealStr = `${getRangeLabel().toLowerCase()} ${formatIdealValue(ideal[0], inp)}${inp.unit.trim()} → ${formatIdealValue(ideal[1], inp)}${inp.unit.trim()}`;
  if (lastColor[id] && lastColor[id] !== col) vibrate(col === '#00d68f' ? 25 : [8,8,8]);
  lastColor[id] = col;
  ['main-','viz-'].forEach(pfx => {
    const valEl = document.getElementById(pfx + 'val-' + id);
    if (valEl) { valEl.textContent = dispVal(inp, v); valEl.style.color = col; }
    const rangeEl = document.getElementById(pfx + 'range-' + id);
    if (rangeEl) { rangeEl.value = v; rangeEl.style.setProperty('--track-color', col); rangeEl.style.setProperty('--track-pct', pct + '%'); }
    const lbl = document.getElementById(pfx + 'row-' + id)?.querySelector('.ideal-lbl');
    if (lbl) { lbl.style.color = col; lbl.textContent = idealStr; }
  });
  if (id === 'face' || id === 'path') drawShotShape();
  if (id === 'face')   triggerFace('vface','vdface');
  if (id === 'path')   triggerPath('vpath','vdpath');
  if (id === 'attack') triggerAttack('vattack','vdattack');
  diagnose();
}

function getVal(id) {
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return null;
  const v = vals[club] && vals[club][id] !== undefined ? vals[club][id] : inp.def;
  return inp.scale ? v / inp.scale : v;
}

function setBanner(msg, cls) {
  const b = document.getElementById('banner');
  b.innerHTML = msg; b.className = 'banner ' + cls;
  const sub = document.getElementById('diag-sub');
  if (sub) sub.textContent = cls==='banner-bad'?'Faults detected':cls==='banner-good'?'Numbers look good':'Move sliders to diagnose';
}

function setTips(tips) {
  const cls = ['tip-p1','tip-p2','tip-p3'];
  document.getElementById('tiplist').innerHTML = tips.map((t,i) =>
    `<div class="tip-item ${cls[i]||'tip-p3'}"><span class="tip-num">${i+1}</span><span>${t}</span></div>`
  ).join('');
  openAcc('diag');
  if (document.getElementById('acc-viz')?.classList.contains('open')) {
    if (document.getElementById('vface'))   triggerFace('vface','vdface');
    if (document.getElementById('vpath'))   triggerPath('vpath','vdpath');
    if (document.getElementById('vattack')) triggerAttack('vattack','vdattack');
  }
  if (document.getElementById('acc-shot')?.classList.contains('open')) drawShotShape();
}

function doAsk() {
  vibrate(20);
  const C = CLUBS[club];
  let msg = C.askTpl;
  getAllInputs(club).forEach(inp => {
    const v = vals[club] && vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    msg = msg.replace('{' + inp.id + '}', dispVal(inp, v));
  });
  if (navigator.share) {
    navigator.share({ title: 'Trackman drill request', text: msg }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(msg).then(() => showToast('Copied — paste into Claude')).catch(() => prompt('Copy this:', msg));
  } else {
    prompt('Copy this:', msg);
  }
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2500);
}

function drawShotShape() {
  const C = CLUBS[club];
  if (!C.primary.find(i=>i.id==='face') || !C.primary.find(i=>i.id==='path') || club==='putter') return;
  if (typeof _drawShotShape === 'function') _drawShotShape();
}

// ── C1: Last session banner + load into sliders ────────────────────────────
let _lastSessionCache = {};

async function loadLastSessionBanner() {
  const banner = document.getElementById('coach-session-banner');
  const text   = document.getElementById('coach-session-text');
  if (!banner || !text) return;

  const clubKeyMap = {
    driver: ['driver'],
    irons:  ['6','7','8','9'],
    wedge:  ['pw','sw','58'],
    putter: ['putter'],
  };
  const keys = clubKeyMap[club] || [];
  if (!keys.length) { banner.style.display = 'none'; return; }

  try {
    const sb = window.supabaseClient;
    const { data: _authData } = await sb.auth.getSession();
    const _uid = _authData?.session?.user?.id;
    if (!_uid) { banner.style.display = 'none'; return; }
    const { data } = await sb
      .from('trackman_shots')
      .select('club,carry,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,attack_angle,club_path,face_angle,face_to_path,dyn_loft,spin_axis,shot_time,created_at,is_full_shot,exclude_from_progress')
      .eq('user_id', _uid)
      .order('shot_time', { ascending: false })
      .limit(300);

    if (!data?.length) { banner.style.display = 'none'; return; }

    const CA = window.clubAliases;
    const relevantShots = data.filter(s => {
      const resolved = CA ? CA.resolveClub(s.club) : null;
      return resolved ? keys.includes(resolved) : keys.some(k => (s.club||'').toLowerCase().includes(k));
    });

    if (!relevantShots.length) { banner.style.display = 'none'; return; }

    const lastDate = (relevantShots[0].shot_time || relevantShots[0].created_at)?.slice(0,10);
    const lastSessionShots = relevantShots.filter(s => (s.shot_time||s.created_at)?.startsWith(lastDate));
    const progress = lastSessionShots.filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true);

    const n = progress.length || lastSessionShots.length;
    const shots = progress.length ? progress : lastSessionShots;

    const avgOf = key => {
      const v = shots.map(s => s[key]).filter(x => x != null && !isNaN(x));
      return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
    };

    _lastSessionCache[club] = {
      date: lastDate, n,
      carry: avgOf('carry'), face: avgOf('face_angle'), path: avgOf('club_path'),
      attack: avgOf('attack_angle'), smash: avgOf('smash_factor'),
      launch: avgOf('launch_angle'), spin: avgOf('spin_rate'),
      ballSpeed: avgOf('ball_speed'), clubSpeed: avgOf('club_speed'),
      dynLoft: avgOf('dyn_loft'), spinAxis: avgOf('spin_axis'),
    };

    const s = _lastSessionCache[club];
    const fmtN = (v, dp=1) => v != null ? Number(v).toFixed(dp) : '–';
    const fmtS = (v, dp=1) => v != null ? (v>0?'+':'')+Number(v).toFixed(dp) : '–';

    text.innerHTML = `<strong>${lastDate}</strong> · ${n} shots · carry ${fmtN(s.carry)}m · face ${fmtS(s.face)}° · smash ${fmtN(s.smash,2)}`;
    banner.style.display = 'flex';
  } catch(e) {
    banner.style.display = 'none';
  }
}

function loadLastSessionIntoCoach() {
  const s = _lastSessionCache[club];
  if (!s) return;

  if (!vals[club]) vals[club] = {};

  const fieldMap = {
    face:      'face',
    path:      'path',
    attack:    'attack',
    launch:    'launch',
    spin:      'spin',
    smash:     'smash',
    clubSpeed: 'clubspeed',
    dynLoft:   'dynloft',
    spinAxis:  'spinaxis',
  };

  const allInps = getAllInputs(club);
  let loaded = 0;

  Object.entries(fieldMap).forEach(([field, sliderId]) => {
    const inp = allInps.find(i => i.id === sliderId);
    if (!inp) return;
    const val = s[field];
    if (val == null) return;
    const rawVal = inp.scale ? Math.round(val * inp.scale) : Math.round(val * 10) / 10;
    const clamped = Math.max(inp.min, Math.min(inp.max, rawVal));
    vals[club][sliderId] = clamped;
    loaded++;
  });

  render();
  openAcc('numbers');

  ['secondary', 'advanced'].forEach(id => {
    const head = document.getElementById('sub-head-' + id);
    const body = document.getElementById('sub-body-' + id);
    if (head && body) {
      head.classList.add('open');
      body.classList.add('open');
      body.style.maxHeight = '1000px';
      body.style.opacity = '1';
    }
  });

  showToast(`Loaded ${s.date} — ${loaded} metrics into sliders`);
}

// ── Page navigation ────────────────────────────────────────────────────────
const ALL_PAGES = ['today','coach','stats','clubs','analysis'];

function showPage(page) {
  ALL_PAGES.forEach(id => {
    const pageEl = document.getElementById('page-' + id);
    const btnEl  = document.getElementById('nav-' + id + '-btn');
    if (pageEl) { pageEl.style.display = id===page?'block':'none'; pageEl.classList.toggle('active', id===page); }
    if (btnEl)  btnEl.classList.toggle('active', id===page);
  });

  setLastTab(page);

  const ap = document.getElementById('auth-panel');
  if (ap) ap.style.display = 'none';
  const mp = document.getElementById('more-panel');
  if (mp) { mp.style.display = 'none'; const mb = document.getElementById('more-btn'); if (mb) mb.classList.remove('active'); }

  if (page === 'today' && typeof window.initTodayTab === 'function') {
    window.initTodayTab();
  }
  if (page === 'coach') {
    Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
    render();
    loadLastSessionBanner();
  }
  if ((page==='stats'||page==='clubs') && typeof window.loadStatsPage==='function') {
    window.loadStatsPage();
  }
  if (page==='analysis' && typeof window.initAnalysisTab==='function') {
    window.initAnalysisTab();
  }
}

// ── State ──────────────────────────────────────────────────────────────────
function getCurrentState() { return { club, rangeMode, vals: JSON.parse(JSON.stringify(vals)) }; }

function applyState(state) {
  if (!state) return;
  if (state.club) club = state.club;
  if (state.rangeMode) { rangeMode = state.rangeMode; applyRangeModeToClubs(rangeMode); updateModeButtons(); }
  Object.keys(vals).forEach(k => delete vals[k]);
  if (state.vals) Object.entries(state.vals).forEach(([k,v]) => { vals[k]=v; });
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  const tabMap = { driver:0, irons:1, wedge:2, putter:3 };
  const tabs = document.querySelectorAll('.ctab');
  if (tabs[tabMap[club]]) tabs[tabMap[club]].classList.add('on');
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  showPage('coach'); render();
}

window.trackmanCoach = { getCurrentState, applyState };

// ── Theme ──────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  try { localStorage.setItem('tc_theme', theme); } catch {}
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Dark' : '☀ Light';
  // Redraw canvases if analysis tab is visible
  if (typeof drawProgressChart === 'function' && document.getElementById('progress-canvas')) {
    requestAnimationFrame(() => {
      drawProgressChart(window.currentProgKey || 'carry', typeof applyFilter === 'function' ? applyFilter(window.analysisShots || []) : []);
    });
  }
}

async function toggleTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const newTheme = isLight ? 'dark' : 'light';
  applyTheme(newTheme);
  // Save to Supabase if logged in
  if (window.supabaseClient) {
    const { data } = await window.supabaseClient.auth.getSession();
    if (data?.session?.user) {
      await window.supabaseClient.auth.updateUser({ data: { theme: newTheme } });
    }
  }
}

// Apply theme from localStorage immediately (before auth resolves)
(function() {
  try {
    const t = localStorage.getItem('tc_theme');
    if (t === 'light') document.body.classList.add('light-theme');
  } catch {}
})();

// ── Init ───────────────────────────────────────────────────────────────────
rangeMode = getSavedRangeMode();
applyRangeModeToClubs(rangeMode);
updateModeButtons();
render();

window.addEventListener('load', () => {
  loadGolfDict();
  const lastTab = getLastTab();
  showPage(lastTab);

  if (lastTab === 'coach') {
    openAcc('viz');
    Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
    drawVizs();
    const C = CLUBS[club];
    if (C.primary.find(i=>i.id==='face') && C.primary.find(i=>i.id==='path') && club!=='putter') {
      openAcc('shot');
      if (typeof _drawShotShape==='function') _drawShotShape();
    }
    loadLastSessionBanner();
  }
});
