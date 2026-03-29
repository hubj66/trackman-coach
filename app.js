// app.js — accordion-first architecture

let club = 'driver';
const vals = {};
let lastColor = {};

// ── Club selector ──────────────────────────────────────────────────────────

function sel(id, el) {
  club = id;
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  render();
}

// ── Accordion ──────────────────────────────────────────────────────────────

function toggleAcc(id) {
  const el = document.getElementById('acc-' + id);
  if (!el) return;

  vibrate(10);

  const isOpen = el.classList.contains('open');
  el.classList.toggle('open');

  if (!isOpen) {
    // Wait for CSS transition + reflow before drawing canvases
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

function openAcc(id) {
  const el = document.getElementById('acc-' + id);
  if (!el || el.classList.contains('open')) return;
  el.classList.add('open');
}

// ── Sub-accordion ──────────────────────────────────────────────────────────

function toggleSub(id) {
  const head = document.getElementById('sub-head-' + id);
  const body = document.getElementById('sub-body-' + id);
  if (!head || !body) return;

  vibrate(10);
  head.classList.toggle('open');
  body.classList.toggle('open');

  // Clear any inline styles left over from old code so CSS class wins
  body.style.maxHeight = '';
  body.style.opacity = '';
}

// ── Colors ─────────────────────────────────────────────────────────────────

function getColorAdapted(inp, v) {
  const [lo, hi] = inp.ideal;
  if (v >= lo && v <= hi) return '#00d68f';
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return '#ffaa00';
  return '#ff4d4d';
}

function getColor(inp, v) {
  return getColorAdapted(inp, v);
}

function fillPct(inp, v) {
  return Math.round((v - inp.min) / (inp.max - inp.min) * 100);
}

function dispVal(inp, v) {
  if (inp.scale) return (v / inp.scale).toFixed(inp.dp || 2) + inp.unit;
  return v + inp.unit;
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Slider builder ─────────────────────────────────────────────────────────

function buildSlider(inp, v, prefix) {
  const col = getColorAdapted(inp, v);
  const pct = fillPct(inp, v);
  const idealStr = `ideal ${inp.ideal[0]}${inp.unit.trim()} → ${inp.ideal[1]}${inp.unit.trim()}`;

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
  document.getElementById('kpi-sub').textContent = C.kpis.length + ' metrics';

  // Primary sliders
  document.getElementById('primary-sliders').innerHTML = C.primary.map(inp => {
    const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
    return buildSlider(inp, v, 'main-');
  }).join('');

  // Secondary sliders
  const secEl = document.getElementById('secondary-section');
  if (C.secondary && C.secondary.length) {
    secEl.style.display = 'block';
    document.getElementById('secondary-count').textContent = C.secondary.length;
    document.getElementById('secondary-sliders').innerHTML = C.secondary.map(inp => {
      const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
      return buildSlider(inp, v, 'main-');
    }).join('');
  } else {
    secEl.style.display = 'none';
  }

  // Advanced sliders
  const advEl = document.getElementById('advanced-section');
  if (C.advanced && C.advanced.length) {
    advEl.style.display = 'block';
    document.getElementById('advanced-count').textContent = C.advanced.length;
    document.getElementById('advanced-sliders').innerHTML = C.advanced.map(inp => {
      const v = vals[club][inp.id] !== undefined ? vals[club][inp.id] : inp.def;
      return buildSlider(inp, v, 'main-');
    }).join('');
  } else {
    advEl.style.display = 'none';
  }

  // Shot shape accordion visibility
  const hasFace = C.primary.find(i => i.id === 'face');
  const hasPath = C.primary.find(i => i.id === 'path');
  document.getElementById('acc-shot').style.display =
    (hasFace && hasPath && club !== 'putter') ? 'block' : 'none';

  // Close sub-accordions on club switch - use class only, no inline styles
  ['secondary', 'advanced'].forEach(id => {
    const head = document.getElementById('sub-head-' + id);
    const body = document.getElementById('sub-body-' + id);
    if (head) head.classList.remove('open');
    if (body) {
      body.classList.remove('open');
      body.style.maxHeight = '';
      body.style.opacity = '';
    }
  });

  diagnose();

  // Draw vizs if viz accordion is open
  const vizAcc = document.getElementById('acc-viz');
  if (vizAcc?.classList.contains('open')) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
      drawVizs();
    }));
  }

  // Update shot shape if open
  const shotAcc = document.getElementById('acc-shot');
  if (shotAcc?.classList.contains('open')) {
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

  if (lastColor[id] && lastColor[id] !== col) {
    vibrate(col === '#00d68f' ? 25 : [8, 8, 8]);
  }
  lastColor[id] = col;

  // Update all instances of this slider (main- and viz-)
  ['main-', 'viz-'].forEach(pfx => {
    const valEl = document.getElementById(pfx + 'val-' + id);
    if (valEl) {
      valEl.textContent = dispVal(inp, v);
      valEl.style.color = col;
    }

    const rangeEl = document.getElementById(pfx + 'range-' + id);
    if (rangeEl) {
      rangeEl.value = v;
      rangeEl.style.setProperty('--track-color', col);
      rangeEl.style.setProperty('--track-pct', pct + '%');
    }

    const lbl = document.getElementById(pfx + 'row-' + id)?.querySelector('.ideal-lbl');
    if (lbl) lbl.style.color = col;
  });

  // Live diagram updates only — do not redraw the whole viz block here,
  // otherwise the lower slider gets recreated while you drag it.
  if (id === 'face' || id === 'path') drawShotShape();
  if (id === 'face') triggerFace('vface', 'vdface');
  if (id === 'path') triggerPath('vpath', 'vdpath');
  if (id === 'attack') triggerAttack('vattack', 'vdattack');

  diagnose();
}

// ── Value getter ───────────────────────────────────────────────────────────

function getVal(id) {
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return null;
  const v = vals[club] && vals[club][id] !== undefined ? vals[club][id] : inp.def;
  return inp.scale ? v / inp.scale : v;
}

// ── Banner + Tips ──────────────────────────────────────────────────────────

function setBanner(msg, cls) {
  const b = document.getElementById('banner');
  b.innerHTML = msg;
  b.className = 'banner ' + cls;

  // Update diagnosis accordion subtitle
  const sub = document.getElementById('diag-sub');
  if (sub) {
    if (cls === 'banner-bad') sub.textContent = 'Faults detected';
    else if (cls === 'banner-good') sub.textContent = 'Numbers look good';
    else sub.textContent = 'Move sliders to diagnose';
  }
}

function setTips(tips) {
  const cls = ['tip-p1', 'tip-p2', 'tip-p3'];
  document.getElementById('tiplist').innerHTML = tips.map((t, i) => `
    <div class="tip-item ${cls[i] || 'tip-p3'}">
      <span class="tip-num">${i + 1}</span>
      <span>${t}</span>
    </div>`).join('');

  // Auto-open diagnosis accordion when there are tips
  openAcc('diag');

  // Keep the lower sliders stable. Only update the canvases already on screen.
  const vizAcc = document.getElementById('acc-viz');
  if (vizAcc?.classList.contains('open')) {
    if (document.getElementById('vface')) triggerFace('vface', 'vdface');
    if (document.getElementById('vpath')) triggerPath('vpath', 'vdpath');
    if (document.getElementById('vattack')) triggerAttack('vattack', 'vdattack');
  }

  // Shot shape
  const shotAcc = document.getElementById('acc-shot');
  if (shotAcc?.classList.contains('open')) drawShotShape();
}

// ── Drill request ──────────────────────────────────────────────────────────

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
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2500);
}

// ── Shotshape wrapper ──────────────────────────────────────────────────────

function drawShotShape() {
  const C = CLUBS[club];
  const hasFace = C.primary.find(i => i.id === 'face');
  const hasPath = C.primary.find(i => i.id === 'path');
  if (!hasFace || !hasPath || club === 'putter') return;
  if (typeof _drawShotShape === 'function') _drawShotShape();
}

// ── Init ───────────────────────────────────────────────────────────────────

render();

// Auto-open viz + shot once page fully loaded
window.addEventListener('load', () => {
  openAcc('viz');
  Object.keys(prevAngles).forEach(k => delete prevAngles[k]);
  drawVizs();

  const C = CLUBS[club];
  const hasFace = C.primary.find(i => i.id === 'face');
  const hasPath = C.primary.find(i => i.id === 'path');
  if (hasFace && hasPath && club !== 'putter') {
    openAcc('shot');
    if (typeof _drawShotShape === 'function') _drawShotShape();
  }
});
