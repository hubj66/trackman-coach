// roundRect polyfill for Firefox < 112
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    const radius = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
  };
}

// viz.js — premium dark sports aesthetic canvas drawings

function sc(id, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const parentW = c.parentElement.clientWidth;
  const w = parentW > 0 ? parentW : window.innerWidth - 36;
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function idealMid(id) {
  const inp = getAllInputs(club).find(i => i.id === id);
  return inp ? (inp.ideal[0] + inp.ideal[1]) / 2 : 0;
}

// ── Theme colors ───────────────────────────────────────────────────────────
function T() {
  return {
    bg:      d ? '#0e1012' : '#f0f2f4',
    surface: d ? '#161819' : '#ffffff',
    s2:      d ? '#1d2023' : '#f0f2f4',
    s3:      d ? '#252a2d' : '#e4e7ea',
    text:    d ? '#f0ede8' : '#0e1012',
    text2:   d ? '#8a9099' : '#5a6370',
    text3:   d ? '#3e4650' : '#9aa0aa',
    border:  d ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    green:   d ? '#00d68f' : '#00a86b',
    amber:   d ? '#ffaa00' : '#d4880a',
    red:     d ? '#ff4d4d' : '#d93030',
    fairway: d ? '#1a2e1a' : '#6db84a',
    rough:   d ? '#0e1e0e' : '#4a9030',
    stripe1: d ? '#1e3420' : '#78c455',
    stripe2: d ? '#182818' : '#65b040',
    sky1:    d ? '#060c14' : '#c5e0f8',
    sky2:    d ? '#0e1a28' : '#e8f4ff',
    ground:  d ? '#1a2e1a' : '#6db84a',
    gr1:     d ? '#1e3420' : '#78c455',
    gr2:     d ? '#182818' : '#65b040',
  };
}

function kpiColor(id, v) {
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return T().green;
  const [lo, hi] = inp.ideal;
  if (v >= lo && v <= hi) return T().green;
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return T().amber;
  return T().red;
}

// ── Background helpers ─────────────────────────────────────────────────────

function drawFairway(ctx, w, h) {
  const t = T();
  const sw = 20;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(i * sw, 0, sw, h);
  }
}

function drawSkyGround(ctx, w, h, groundRatio) {
  const t = T();
  const gy = h * groundRatio;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, t.sky1);
  sky.addColorStop(1, t.sky2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, gy);

  // Ground stripes
  const sw = 20;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.gr1 : t.gr2;
    ctx.fillRect(i * sw, gy, sw, h - gy);
  }

  // Ground edge line
  ctx.strokeStyle = '#2a5a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();

  // Ground shadow strip
  const gs = ctx.createLinearGradient(0, gy, 0, gy + 16);
  gs.addColorStop(0, 'rgba(0,0,0,0.25)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs; ctx.fillRect(0, gy, w, 16);
}

function drawFlag(ctx, x, y) {
  const t = T();
  ctx.fillStyle = '#c8a830';
  ctx.fillRect(x - 1, y, 1.5, 26);
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 16, y + 8); ctx.lineTo(x + 1, y + 16); ctx.fill();
}

function drawBall(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#e8e8e8');
  g.addColorStop(1, '#cccccc');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

function drawGlowLine(ctx, x1, y1, x2, y2, color, width) {
  // Glow layer
  ctx.strokeStyle = color; ctx.lineWidth = width + 6; ctx.globalAlpha = 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = width + 2; ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  // Core line
  ctx.lineWidth = width; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function drawArrow(ctx, ex, ey, angle, color, size) {
  ctx.fillStyle = color; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.5); ctx.lineTo(-size, size * 0.5);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// ── Animation engine ───────────────────────────────────────────────────────

const animState = {};
const prevAngles = {};

function animateDraw(canvasId, fromVal, toVal, drawFn) {
  if (animState[canvasId]) cancelAnimationFrame(animState[canvasId]);
  const start = performance.now();
  const duration = 280;
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    drawFn(fromVal + (toVal - fromVal) * ease, t >= 1);
    if (t < 1) animState[canvasId] = requestAnimationFrame(step);
    else delete animState[canvasId];
  }
  animState[canvasId] = requestAnimationFrame(step);
}

// ── Viz builder ────────────────────────────────────────────────────────────

function drawVizsDELETE() {
  const C = CLUBS[club]; const allInps = getAllInputs(club);
  const panels = [];
  if (C.primary.find(i => i.id === 'face'))
    panels.push({ id: 'vface', did: 'vdface', title: 'Face angle · top view', fn: () => triggerFace('vface', 'vdface') });
  if (C.primary.find(i => i.id === 'path'))
    panels.push({ id: 'vpath', did: 'vdpath', title: 'Club path · top view', fn: () => triggerPath('vpath', 'vdpath') });
  if (C.primary.find(i => i.id === 'attack'))
    panels.push({ id: 'vattack', did: 'vdattack', title: 'Attack angle · side view', fn: () => triggerAttack('vattack', 'vdattack') });

  document.getElementById('vgrid').innerHTML = panels.map(p => `
    <div class="vc-wrap">
      <div class="vc-header"><span class="vc-title">${p.title}</span></div>
      <canvas class="cv" id="${p.id}" height="200"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
    </div>`).join('');

  setTimeout(() => panels.forEach(p => p.fn()), 40);
}

function triggerFace(cid, did) {
  const you = getVal('face') || 0, ideal = idealMid('face');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawFaceBoth(cid, did, cur, ideal, done));
}
function triggerPath(cid, did) {
  const you = getVal('path') || 0, ideal = idealMid('path');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawPathBoth(cid, did, cur, ideal, done));
}
function triggerAttack(cid, did) {
  const you = getVal('attack') || 0, ideal = idealMid('attack');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawAttackBoth(cid, did, cur, ideal, done));
}

// ── Face angle ─────────────────────────────────────────────────────────────

function drawFaceBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 200); if (!r) return;
  const { ctx, w, h } = r; const t = T();

  // Background
  ctx.fillStyle = t.s2; ctx.fillRect(0, 0, w, h * 0.55);
  drawFairway(ctx, w, h);
  // Sky overlay
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#060c14');
  sky.addColorStop(1, 'rgba(14,22,32,0)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.55);

  // Fairway strip
  const fw = 100, fx = w / 2 - fw / 2;
  for (let i = 0; i * 18 < fw; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(fx + i * 18, 0, 18, h);
  }

  const cx = w / 2, cy = h * 0.63;

  // Target line
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, cy - 20); ctx.stroke(); ctx.setLineDash([]);

  // Flag
  drawFlag(ctx, cx, 20);

  // "TARGET" label
  ctx.fillStyle = t.text3;
  ctx.font = `500 9px 'DM Mono', monospace`;
  ctx.textAlign = 'center'; ctx.fillText('TARGET', cx, 16);

  // Ideal clubface (ghost)
  const irad = ideal * Math.PI / 180;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(irad); ctx.globalAlpha = 0.2;
  ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.roundRect(-34, -10, 68, 20, 3); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // Your clubface
  const frad = you * Math.PI / 180;
  const fc = kpiColor('face', you);

  ctx.save(); ctx.translate(cx, cy); ctx.rotate(frad);
  // Club body
  ctx.fillStyle = '#2a2e32';
  ctx.beginPath(); ctx.roundRect(-34, -10, 68, 20, 3); ctx.fill();
  // Face edge glow
  ctx.shadowColor = fc; ctx.shadowBlur = 8;
  ctx.fillStyle = fc; ctx.fillRect(-34, -10, 68, 5);
  ctx.strokeStyle = fc; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-34, -10); ctx.lineTo(34, -10); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Ball
  drawBall(ctx, cx, cy, 8);

  // Ball flight dots + arrow
  const bd = frad * 0.88, bl = 70;
  const bx = cx + Math.sin(bd) * bl, by = cy - Math.cos(bd) * bl;
  for (let i = 1; i <= 5; i++) {
    const tt = i / 6;
    ctx.fillStyle = fc; ctx.globalAlpha = tt * 0.5;
    ctx.beginPath(); ctx.arc(cx + Math.sin(bd) * bl * tt, cy - Math.cos(bd) * bl * tt, 2.5 * tt, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arrow line
  ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  drawArrow(ctx, bx, by, Math.atan2(by - (cy - 9), bx - cx), fc, 9);

  // Angle arc
  if (Math.abs(you) > 1) {
    ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 38, -Math.PI / 2, frad - Math.PI / 2, you < 0);
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // Labels
  ctx.font = `700 11px 'Barlow Condensed', sans-serif`;
  ctx.textAlign = 'center'; ctx.letterSpacing = '0.05em';
  ctx.fillStyle = fc;
  ctx.fillText('YOU  ' + (you > 0 ? '+' : '') + Math.round(you) + '°',
    cx + (you >= 0 ? 32 : -32), cy + (you >= 0 ? -22 : 22));
  ctx.globalAlpha = 0.5; ctx.fillStyle = t.green;
  ctx.fillText('TARGET  ~' + ideal + '°',
    cx + (ideal >= 0 ? -30 : 30), cy + (ideal >= 0 ? 22 : -22));
  ctx.globalAlpha = 1;

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Your face: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal}°</b><br>${diff < 1 ? 'On target!' : diff < 4 ? 'Close — small adjustment needed.' : `Off by ${diff.toFixed(0)}° — ${you > ideal ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
}

// ── Club path ──────────────────────────────────────────────────────────────

function drawPathBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 200); if (!r) return;
  const { ctx, w, h } = r; const t = T();

  // Full green background
  drawFairway(ctx, w, h);
  const fw = 110, fx = w / 2 - fw / 2;
  for (let i = 0; i * 18 < fw; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(fx + i * 18, 0, 18, h);
  }

  const cx = w / 2, cy = h * 0.52;

  // Target line
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.moveTo(cx, 14); ctx.lineTo(cx, h - 14); ctx.stroke(); ctx.setLineDash([]);

  // In / Out labels
  ctx.font = `500 9px 'DM Mono', monospace`;
  ctx.fillStyle = t.text3;
  ctx.textAlign = 'right'; ctx.fillText('INSIDE', cx - 7, cy - 50);
  ctx.textAlign = 'left'; ctx.fillText('OUTSIDE', cx + 7, cy - 50);

  // Flag
  drawFlag(ctx, cx, 14);

  const plen = 90;

  // Ideal path
  const irad = ideal * Math.PI / 180;
  const isx = cx - Math.sin(irad) * plen, isy = cy + Math.cos(irad) * plen * 0.44 + 8;
  const iex = cx + Math.sin(irad) * plen, iey = cy - Math.cos(irad) * plen * 0.44 - 8;
  ctx.strokeStyle = t.green; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  // Your path
  const inp = getAllInputs(club).find(i => i.id === 'path');
  const idealRange = inp ? inp.ideal : [-5, 5];
  const prad = you * Math.PI / 180;
  const sx = cx - Math.sin(prad) * plen, sy = cy + Math.cos(prad) * plen * 0.44 + 8;
  const ex = cx + Math.sin(prad) * plen, ey = cy - Math.cos(prad) * plen * 0.44 - 8;
  const pc = kpiColor('path', you);

  drawGlowLine(ctx, sx, sy, ex, ey, pc, 3.5);
  drawArrow(ctx, ex, ey, Math.atan2(ey - sy, ex - sx), pc, 10);

  // Ball
  drawBall(ctx, cx, cy, 9);

  // Labels
  ctx.font = `700 11px 'Barlow Condensed', sans-serif`;
  ctx.fillStyle = pc; ctx.textAlign = you >= 0 ? 'left' : 'right';
  ctx.fillText('YOU  ' + (you > 0 ? '+' : '') + Math.round(you) + '°', ex + (you >= 0 ? 10 : -10), ey - 8);
  ctx.globalAlpha = 0.5; ctx.fillStyle = t.green; ctx.textAlign = 'center';
  ctx.fillText('TARGET', iex, iey - 10); ctx.globalAlpha = 1;

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${pc}">Your path: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal > 0 ? '+' : ''}${ideal}°</b><br>${diff < 2 ? 'On target!' : you < idealRange[0] ? 'Out-to-in — classic slice path.' : you > idealRange[1] ? 'Very in-to-out — hook risk.' : 'Path is in range.'}`;
}

// ── Attack angle ───────────────────────────────────────────────────────────

function drawAttackBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 200); if (!r) return;
  const { ctx, w, h } = r; const t = T();

  drawSkyGround(ctx, w, h, 0.68);

  const bx = w * 0.5, by = h * 0.68 - 10;

  // Ground level reference
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(bx - 100, by); ctx.lineTo(bx + 50, by); ctx.stroke(); ctx.setLineDash([]);

  const slen = 120;

  // Ideal shaft (ghost)
  const irad = ideal * Math.PI / 180;
  const isx = bx - Math.cos(irad) * slen, isy = by + Math.sin(irad) * slen;
  ctx.strokeStyle = t.green; ctx.lineWidth = 3; ctx.globalAlpha = 0.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(bx - 8, by); ctx.stroke(); ctx.globalAlpha = 1;

  // Your shaft
  const ac = kpiColor('attack', you);
  const rad = you * Math.PI / 180;
  const sx = bx - Math.cos(rad) * slen, sy = by + Math.sin(rad) * slen;

  drawGlowLine(ctx, sx, sy, bx - 8, by, ac, 4.5);

  // Clubhead
  ctx.save(); ctx.translate(bx - 8, by); ctx.rotate(-rad + (you < 0 ? 0.15 : -0.15));
  ctx.fillStyle = '#2a2e32';
  ctx.beginPath(); ctx.roundRect(-6, -8, 22, 16, 3); ctx.fill();
  ctx.shadowColor = ac; ctx.shadowBlur = 6;
  ctx.fillStyle = ac; ctx.beginPath(); ctx.roundRect(-6, -8, 5, 16, 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Direction arrow
  const aex = bx + Math.cos(rad) * 54, aey = by - Math.sin(rad) * 54;
  ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aex, aey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  drawArrow(ctx, aex, aey, Math.atan2(aey - by, aex - bx), ac, 9);

  // Ball
  drawBall(ctx, bx, by, 9);

  // Angle arc
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = ac; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
    const a1 = -Math.PI, a2 = -Math.PI - rad;
    ctx.beginPath(); ctx.arc(bx, by, 42, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke();
    ctx.globalAlpha = 1;
    const ma = (-Math.PI + -Math.PI - rad) / 2;
    ctx.fillStyle = ac;
    ctx.font = `700 10px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText((you > 0 ? '+' : '') + Math.round(you) + '°', bx + Math.cos(ma) * 56, by + Math.sin(ma) * 56);
  }

  // Divot
  if (you < -2) {
    const gy = h * 0.68;
    ctx.fillStyle = '#4a3010';
    ctx.beginPath(); ctx.ellipse(bx + 22, gy + 4, 19, 7, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a5030';
    ctx.beginPath(); ctx.ellipse(bx + 22, gy + 3, 13, 5, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.green;
    ctx.font = `500 9px 'DM Mono', monospace`; ctx.textAlign = 'center';
    ctx.fillText('DIVOT ✓', bx + 22, gy + 18);
  }

  // Tee
  if (you > 1 && club === 'driver') {
    const gy = h * 0.68;
    ctx.fillStyle = '#d4a840'; ctx.fillRect(bx - 2, gy - 22, 5, 22);
    ctx.fillStyle = '#e8c050';
    ctx.beginPath(); ctx.ellipse(bx, gy - 22, 9, 5, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = t.amber;
    ctx.font = `500 9px 'DM Mono', monospace`; ctx.textAlign = 'center';
    ctx.fillText('TEE ✓', bx, gy + 18);
  }

  // From label
  ctx.fillStyle = t.text3;
  ctx.font = `400 9px 'DM Mono', monospace`; ctx.textAlign = 'center';
  ctx.fillText('approaches from here', sx, sy - 11);

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  el.innerHTML = `<b style="color:${ac}">Your attack: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ${ideal > 0 ? '+' : ''}${ideal}°</b><br>${Math.abs(you - ideal) < 1 ? 'On target!' : you > -2 && club !== 'driver' ? 'Too level or upward — this is the scoop. Push toward negative.' : you > 4 && club === 'driver' ? 'Very upward — check tee height.' : 'Getting there — push further toward target.'}`;
}

// ── Replacement drawVizs with embedded sliders ─────────────────────────────
function drawVizs() {
  const C = CLUBS[club]; const allInps = getAllInputs(club);
  const panels = [];
  if (C.primary.find(i => i.id === 'face'))
    panels.push({ id: 'vface', did: 'vdface', sid: 'face', title: 'Face angle<span>TOP VIEW</span>', fn: () => triggerFace('vface', 'vdface') });
  if (C.primary.find(i => i.id === 'path'))
    panels.push({ id: 'vpath', did: 'vdpath', sid: 'path', title: 'Club path<span>TOP VIEW</span>', fn: () => triggerPath('vpath', 'vdpath') });
  if (C.primary.find(i => i.id === 'attack'))
    panels.push({ id: 'vattack', did: 'vdattack', sid: 'attack', title: 'Attack angle<span>SIDE VIEW</span>', fn: () => triggerAttack('vattack', 'vdattack') });

  document.getElementById('vgrid').innerHTML = panels.map(p => {
    const inp = allInps.find(i => i.id === p.sid);
    const v = (vals[club] && vals[club][p.sid] !== undefined) ? vals[club][p.sid] : (inp ? inp.def : 0);
    const sliderHTML = inp ? buildSlider(inp, v, 'viz-') : '';
    return `<div class="vc-wrap">
      <div class="vc-header"><span class="vc-title">${p.title}</span></div>
      <canvas class="cv" id="${p.id}" height="200"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
      <div class="viz-slider">${sliderHTML}</div>
    </div>`;
  }).join('');

  setTimeout(() => panels.forEach(p => p.fn()), 40);
}
