// app.js — main app logic

let club = 'driver';
const vals = {};

// ── Club selector ──────────────────────────────────────────────────────────

function sel(id, el) {
  club = id;
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  render();
}

// ── Colors ─────────────────────────────────────────────────────────────────

function getColorAdapted(inp, v) {
  const light = matchMedia('(prefers-color-scheme: light)').matches;
  const [lo, hi] = inp.ideal;
  if (v >= lo && v <= hi) return light ? '#00a86b' : '#00d68f';
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return light ? '#d4880a' : '#ffaa00';
  return light ? '#d93030' : '#ff4d4d';
}

// expose for viz.js kpiColor
function getColor(inp, v) { return getColorAdapted(inp, v); }

function fillPct(inp, v) {
  return Math.round((v - inp.min) / (inp.max - inp.min) * 100);
}

function dispVal(inp, v) {
  if (inp.scale) return (v / inp.scale).toFixed(inp.dp || 2) + inp.unit;
  return v + inp.unit;
}

// ── Vibration ──────────────────────────────────────────────────────────────

function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

// ── Slider HTML builder (shared by main + mini) ────────────────────────────

function buildSlider(inp, v, prefix) {
  const col = getColorAdapted(inp, v);
  const pct = fillPct(inp, v);
  const idealStr = `ideal ${inp.ideal[0]}${inp.unit.trim()} → ${inp.ideal[1]}${inp.unit.trim()}`;
  return `<div class="irow" id="${prefix}row-${inp.id}">
    <div class="irow-top">
      <span class="irow-lbl">${inp.l}</span>
      <span class="irow-val" id="${prefix}val-${inp.id}" style="color:${col}">${dispVal(inp, v)}</span>
    </div>
    <input type="range"
      id="${prefix}range-${inp.id}"
      min="${inp.min}" max="${inp.max}" value="${v}" step="${inp.step || 1}"
      style="--track-color:${col};--track-pct:${pct}%"
      oninput="onSlider('${inp.id}', +this.value, '${prefix}')">
    <div class="irow-labels">
      <span>${inp.min}${inp.unit.trim()}</span>
      <span class="ideal-lbl" style="color:${col}">${idealStr}</span>
      <span>${inp.max}${inp.unit.trim()}</span>
    </div>
  </div>`;
}

// ── Render ─────────────────────────────────────────────────────────────────

function badgeToClass(bt) {
  if (bt === 'Critical') return 'critical';
  if (bt === 'Important') return 'important';
  return 'watch';
}

function render() {
  const C = CLUBS[club];

  // KPI cards
  document.getElementById('kgrid').innerHTML = C.kpis.map(k => `
    <div class="kcard ${badgeToClass(k.bt)}">
      <div class="kcard-lbl">${k.l}</div>
      <div class="kcard-val">${k.v}</div>
      <div class="kcard-desc">${k.d}</div>
      <div class="badge ${k.badge}">${k.bt}</div>
    </div>`).join('');

  // Focus list
  document.getElementById('focusbox').innerHTML = C.focus.map(f =>
    `<div class="focus-item"><span class="dot ${f.c}"></span><span>${f.t}</span></div>`
  ).join('');

  // Main sliders
  if (!vals[club]) vals[club] = {};
  document.getElementById('inputgrid').innerHTML = C.inputs.map(inp => {
    const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    return buildSlider(inp, v, 'main-');
  }).join('');

  diagnose();
  renderShotShapeSection();
}

// ── Render mini sliders below vizs ────────────────────────────────────────

function renderMiniSliders() {
  const C = CLUBS[club];
  const el = document.getElementById('mini-sliders');
  if (!el) return;
  // Only show sliders for KPIs that have visualizations
  const vizIds = C.inputs
    .filter(i => ['face','path','attack'].includes(i.id))
    .filter(i => C.inputs.find(x => x.id === i.id));
  if (!vizIds.length) { el.innerHTML = ''; return; }
  el.innerHTML = vizIds.map(inp => {
    const v = vals[club] && vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    return buildSlider(inp, v, 'mini-');
  }).join('');
}

// ── Slider update ──────────────────────────────────────────────────────────

let lastColor = {};

function onSlider(id, v, prefix) {
  if (!vals[club]) vals[club] = {};
  vals[club][id] = v;

  const inp = CLUBS[club].inputs.find(i => i.id === id);
  if (!inp) return;
  const col = getColorAdapted(inp, v);
  const pct = fillPct(inp, v);

  // Vibrate on zone crossing
  if (lastColor[id] && lastColor[id] !== col) {
    vibrate(col.includes('d68f') || col.includes('a86b') ? 25 : [8,8,8]);
  }
  lastColor[id] = col;

  // Update BOTH main and mini instances
  ['main-', 'mini-'].forEach(pfx => {
    const valEl = document.getElementById(pfx + 'val-' + id);
    if (valEl) { valEl.textContent = dispVal(inp, v); valEl.style.color = col; }
    const rangeEl = document.getElementById(pfx + 'range-' + id);
    if (rangeEl) {
      rangeEl.value = v;
      rangeEl.style.setProperty('--track-color', col);
      rangeEl.style.setProperty('--track-pct', pct + '%');
    }
    const lbl = document.getElementById(pfx + 'row-' + id)?.querySelector('.ideal-lbl');
    if (lbl) lbl.style.color = col;
  });

  // Live update shot shape and visualizations
  if (id === 'face' || id === 'path') drawShotShape();
  if (id === 'face') triggerFace('vface', 'vdface');
  if (id === 'path') triggerPath('vpath', 'vdpath');
  if (id === 'attack') triggerAttack('vattack', 'vdattack');

  diagnose();
}

// ── Value getter ───────────────────────────────────────────────────────────

function getVal(id) {
  const C = CLUBS[club];
  const inp = C.inputs.find(i => i.id === id);
  if (!inp) return null;
  const v = vals[club] && vals[club][id] !== undefined ? vals[club][id] : inp.def;
  return inp.scale ? v / inp.scale : v;
}

// ── Banner + Tips ──────────────────────────────────────────────────────────

function setBanner(msg, cls) {
  const b = document.getElementById('banner');
  b.innerHTML = msg; b.className = 'banner ' + cls;
}

function setTips(tips) {
  const cls = ['tip-p1', 'tip-p2', 'tip-p3'];
  document.getElementById('tiplist').innerHTML = tips.map((t, i) => `
    <div class="tip-item ${cls[i]}">
      <span class="tip-num">${i + 1}</span>
      <span>${t}</span>
    </div>`).join('');
  drawVizs();
  renderShotShapeSection();
  renderMiniSliders();
}

// ── Drill request ──────────────────────────────────────────────────────────

function doAsk() {
  vibrate(20);
  const C = CLUBS[club];
  let msg = C.askTpl;
  C.inputs.forEach(inp => {
    const v = vals[club] && vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    msg = msg.replace('{' + inp.id + '}', dispVal(inp, v));
  });
  if (navigator.share) {
    navigator.share({ title: 'Trackman drill request', text: msg }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(msg)
      .then(() => showToast('Copied — paste into Claude'))
      .catch(() => prompt('Copy this:', msg));
  } else {
    prompt('Copy this:', msg);
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2500);
}

// ── Init ───────────────────────────────────────────────────────────────────

render();
