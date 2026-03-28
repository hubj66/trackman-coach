// app.js — main app logic, state, UI rendering
// Wires together clubs.js, engine.js, viz.js and shotshape.js

let club = 'driver';
const vals = {};

// ── Club selector ──────────────────────────────────────────────────────────

function sel(id, el) {
  club = id;
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  // Clear stored previous angles so visualizations don't animate from wrong value
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  render();
}

// ── Color helpers ──────────────────────────────────────────────────────────

function getColor(inp, v) {
  const [lo, hi] = inp.ideal;
  if (v >= lo && v <= hi) return '#1D9E75';
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return '#EF9F27';
  return '#e24b4a';
}

function fillPct(inp, v) {
  return Math.round((v - inp.min) / (inp.max - inp.min) * 100);
}

function dispVal(inp, v) {
  if (inp.scale) return (v / inp.scale).toFixed(inp.dp || 2) + inp.unit;
  return v + inp.unit;
}

// ── Android vibration feedback ─────────────────────────────────────────────

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
  const C = CLUBS[club];

  // KPI cards
  document.getElementById('kgrid').innerHTML = C.kpis.map(k => `
    <div class="kcard">
      <div class="kcard-lbl">${k.l}</div>
      <div class="kcard-val">${k.v}</div>
      <div class="kcard-desc">${k.d}</div>
      <div class="badge ${k.badge}">${k.bt}</div>
    </div>`).join('');

  // Focus list
  document.getElementById('focusbox').innerHTML = C.focus.map(f =>
    `<div class="focus-item"><span class="dot ${f.c}"></span><span>${f.t}</span></div>`
  ).join('');

  // Input sliders
  if (!vals[club]) vals[club] = {};
  document.getElementById('inputgrid').innerHTML = C.inputs.map(inp => {
    const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    const col = getColor(inp, v);
    const pct = fillPct(inp, v);
    const idealStr = `ideal ${inp.ideal[0]}${inp.unit.trim()} to ${inp.ideal[1]}${inp.unit.trim()}`;
    return `<div class="irow">
      <div class="irow-top">
        <span class="irow-lbl">${inp.l}</span>
        <span class="irow-val" id="iv-${inp.id}" style="color:${col}">${dispVal(inp, v)}</span>
      </div>
      <input type="range" min="${inp.min}" max="${inp.max}" value="${v}" step="${inp.step || 1}"
        oninput="onSlider('${inp.id}', +this.value)"
        onchange="onSliderEnd('${inp.id}', +this.value)">
      <div class="track-wrap">
        <div class="track-bg">
          <div class="track-fill" id="sf-${inp.id}" style="width:${pct}%;background:${col}"></div>
        </div>
      </div>
      <div class="irow-labels">
        <span>${inp.min}${inp.unit.trim()}</span>
        <span class="ideal-lbl" style="color:${col}">${idealStr}</span>
        <span>${inp.max}${inp.unit.trim()}</span>
      </div>
    </div>`;
  }).join('');

  diagnose();
  renderShotShapeSection();
}

// ── Slider update ──────────────────────────────────────────────────────────

let lastColor = {};

function onSlider(id, v) {
  if (!vals[club]) vals[club] = {};
  vals[club][id] = v;
  const inp = CLUBS[club].inputs.find(i => i.id === id);
  if (!inp) return;
  const col = getColor(inp, v);

  // Vibrate when crossing into green zone (entering ideal range)
  if (lastColor[id] && lastColor[id] !== '#1D9E75' && col === '#1D9E75') {
    vibrate(30); // short pulse = entered ideal zone
  } else if (lastColor[id] && lastColor[id] === '#1D9E75' && col !== '#1D9E75') {
    vibrate([10, 10, 10]); // double tap = left ideal zone
  }
  lastColor[id] = col;

  const el = document.getElementById('iv-' + id);
  if (el) { el.textContent = dispVal(inp, v); el.style.color = col; }
  const sf = document.getElementById('sf-' + id);
  if (sf) { sf.style.width = fillPct(inp, v) + '%'; sf.style.background = col; }

  // Live update shot shape while dragging face or path
  if (id === 'face' || id === 'path') drawShotShape();

  diagnose();
}

function onSliderEnd(id, v) {
  // Animate visualizations only when user lifts finger (smoother UX)
  if (id === 'face') triggerFace('vface', 'vdface');
  if (id === 'path') triggerPath('vpath', 'vdpath');
  if (id === 'attack') triggerAttack('vattack', 'vdattack');
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
  b.innerHTML = msg;
  b.className = 'banner ' + cls;
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
      .then(() => showToast('Copied! Paste into Claude.'))
      .catch(() => prompt('Copy this:', msg));
  } else {
    prompt('Copy this:', msg);
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg.length > 60 ? msg.slice(0, 57) + '…' : msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2500);
}

// ── Init ───────────────────────────────────────────────────────────────────

render();
