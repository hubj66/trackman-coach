// viz.js — clean diagram drawings
// Face angle: top-down (pure fairway, bird's eye)
// Club path: top-down (pure fairway, bird's eye)
// Attack angle: side view (sky + ground)

function dk() { return !matchMedia('(prefers-color-scheme: light)').matches; }

function sc(id, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const w = c.parentElement.clientWidth;
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function idealMid(id) {
  const inp = CLUBS[club].inputs.find(i => i.id === id);
  return inp ? (inp.ideal[0] + inp.ideal[1]) / 2 : 0;
}

// ── Theme ──────────────────────────────────────────────────────────────────
function T() {
  const d = dk();
  return {
    // Fairway (top-down)
    rough:   d ? '#0d1a0d' : '#4a8c30',
    rough2:  d ? '#0f1f0f' : '#528a38',
    fairway: d ? '#162816' : '#6db84a',
    stripe1: d ? '#1a2e1a' : '#78c455',
    stripe2: d ? '#142414' : '#68b045',
    // Sky (side view)
    sky1:    d ? '#07111e' : '#b8d8f0',
    sky2:    d ? '#0d1e30' : '#daeeff',
    // Ground (side view)
    gnd1:    d ? '#1a2e1a' : '#6db84a',
    gnd2:    d ? '#162616' : '#60a840',
    gnd3:    d ? '#1e3020' : '#78c455',
    // Text / UI
    text:    d ? '#f0ede8' : '#0e1012',
    text2:   d ? '#8a9099' : '#5a6370',
    text3:   d ? '#3e4650' : '#9aa0aa',
    border:  d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    // Status colors
    green:   d ? '#00d68f' : '#00a86b',
    amber:   d ? '#ffaa00' : '#d4880a',
    red:     d ? '#ff4d4d' : '#d93030',
  };
}

function kpiColor(id, v) {
  const inp = CLUBS[club].inputs.find(i => i.id === id);
  const t = T();
  if (!inp) return t.green;
  const [lo, hi] = inp.ideal;
  if (v >= lo && v <= hi) return t.green;
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return t.amber;
  return t.red;
}

// ── Drawing helpers ────────────────────────────────────────────────────────

// Full top-down fairway (used for face angle + club path)
function fillTopDown(ctx, w, h) {
  const t = T();
  // Rough background
  ctx.fillStyle = t.rough; ctx.fillRect(0, 0, w, h);
  // Fairway stripe across center
  const fw = Math.round(w * 0.55), fx = Math.round((w - fw) / 2);
  const sw = 20;
  for (let i = 0; i * sw < fw; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(fx + i * sw, 0, sw, h);
  }
  // Rough edge fade lines
  ctx.strokeStyle = dk() ? '#243824' : '#55a030'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx + fw, 0); ctx.lineTo(fx + fw, h); ctx.stroke();
}

// Side view: sky top, ground bottom
function fillSideView(ctx, w, h, gy) {
  const t = T();
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, t.sky1); sky.addColorStop(1, t.sky2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, gy);
  // Ground stripes
  const sw = 20;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.gnd1 : t.gnd2;
    ctx.fillRect(i * sw, gy, sw, h - gy);
  }
  // Ground edge
  ctx.strokeStyle = dk() ? '#2a5a2a' : '#55a030'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  // Shadow strip under ground edge
  const gs = ctx.createLinearGradient(0, gy, 0, gy + 18);
  gs.addColorStop(0, 'rgba(0,0,0,0.25)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs; ctx.fillRect(0, gy, w, 18);
}

// Golf ball with gloss
function drawBall(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#eeeeee'); g.addColorStop(1, '#cccccc');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

// Glowing colored line
function glowLine(ctx, x1, y1, x2, y2, color, w) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = w + 8; ctx.globalAlpha = 0.07;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = w + 2; ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = w; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// Arrowhead
function arrowHead(ctx, ex, ey, angle, color, size) {
  ctx.fillStyle = color; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-size,-size*0.5); ctx.lineTo(-size,size*0.5);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// Top-down flag (viewed from above — just a pin dot)
function drawTopPin(ctx, x, y) {
  const t = T();
  // Pin shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Pin circle
  ctx.fillStyle = t.text; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  // Label
  ctx.fillStyle = t.text2;
  ctx.font = `500 9px 'DM Mono', monospace`;
  ctx.textAlign = 'center'; ctx.fillText('FLAG', x, y - 10);
}

// Side-view flag
function drawSideFlag(ctx, x, y) {
  ctx.fillStyle = dk() ? '#c8a830' : '#8a6800'; ctx.fillRect(x - 1, y, 1.5, 26);
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(x+1,y); ctx.lineTo(x+16,y+8); ctx.lineTo(x+1,y+16); ctx.fill();
}

// Mono label
function monoLabel(ctx, text, x, y, color, size, align) {
  ctx.font = `500 ${size || 9}px 'DM Mono', monospace`;
  ctx.fillStyle = color; ctx.textAlign = align || 'center';
  ctx.fillText(text, x, y);
}

// Condensed bold label
function boldLabel(ctx, text, x, y, color, size, align) {
  ctx.font = `700 ${size || 12}px 'Barlow Condensed', sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align || 'center';
  ctx.fillText(text, x, y);
}

// ── Animation engine ───────────────────────────────────────────────────────

const animState = {};
const prevAngles = {};

function animateDraw(canvasId, fromVal, toVal, drawFn) {
  if (animState[canvasId]) cancelAnimationFrame(animState[canvasId]);
  const start = performance.now();
  const duration = 260;
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease out cubic
    drawFn(fromVal + (toVal - fromVal) * ease, t >= 1);
    if (t < 1) animState[canvasId] = requestAnimationFrame(step);
    else delete animState[canvasId];
  }
  animState[canvasId] = requestAnimationFrame(step);
}

// ── Viz builder ────────────────────────────────────────────────────────────

function drawVizs() {
  const C = CLUBS[club];
  const panels = [];
  if (C.inputs.find(i => i.id === 'face'))
    panels.push({ id: 'vface', did: 'vdface', title: 'Face angle · top view', fn: () => triggerFace('vface', 'vdface') });
  if (C.inputs.find(i => i.id === 'path'))
    panels.push({ id: 'vpath', did: 'vdpath', title: 'Club path · top view', fn: () => triggerPath('vpath', 'vdpath') });
  if (C.inputs.find(i => i.id === 'attack'))
    panels.push({ id: 'vattack', did: 'vdattack', title: 'Attack angle · side view', fn: () => triggerAttack('vattack', 'vdattack') });

  document.getElementById('vgrid').innerHTML = panels.map(p => `
    <div class="vc-wrap">
      <div class="vc-header"><span class="vc-title">${p.title}</span></div>
      <canvas class="cv" id="${p.id}" height="210"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
    </div>`).join('');

  setTimeout(() => panels.forEach(p => p.fn()), 40);
}

function triggerFace(cid, did) {
  const you = getVal('face') || 0, ideal = idealMid('face');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawFace(cid, did, cur, ideal, done));
}
function triggerPath(cid, did) {
  const you = getVal('path') || 0, ideal = idealMid('path');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawPath(cid, did, cur, ideal, done));
}
function triggerAttack(cid, did) {
  const you = getVal('attack') || 0, ideal = idealMid('attack');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawAttack(cid, did, cur, ideal, done));
}

// ── Face angle — TOP DOWN ──────────────────────────────────────────────────
// Bird's eye view. All green. Ball at bottom, flag at top, fairway between.
// Clubface rotates at ball position. Arrow shows where ball starts.

function drawFace(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 210); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  // Pure top-down fairway
  fillTopDown(ctx, w, h);

  const cx = w / 2;
  // Ball sits at bottom 30%, flag at top
  const ballY = h * 0.72;
  const flagY = h * 0.12;

  // Target line (dashed, running toward flag)
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(cx, ballY - 10); ctx.lineTo(cx, flagY + 12); ctx.stroke();
  ctx.setLineDash([]);

  // Flag (top-down pin)
  drawTopPin(ctx, cx, flagY);

  // Distance markers on target line
  for (let i = 1; i <= 3; i++) {
    const my = ballY - (ballY - flagY - 12) * (i / 4);
    ctx.fillStyle = t.text3; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(cx, my, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Ideal face ghost ──
  const irad = ideal * Math.PI / 180;
  ctx.save(); ctx.translate(cx, ballY); ctx.rotate(irad); ctx.globalAlpha = 0.18;
  ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.roundRect(-36, -9, 72, 18, 3); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // ── Your clubface ──
  const frad = you * Math.PI / 180;
  const fc = kpiColor('face', you);

  // Club shadow
  ctx.save(); ctx.translate(cx, ballY + 3); ctx.rotate(frad); ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.roundRect(-36, -9, 72, 18, 3); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // Club body
  ctx.save(); ctx.translate(cx, ballY); ctx.rotate(frad);
  ctx.fillStyle = dk() ? '#2c3238' : '#7a7e88';
  ctx.beginPath(); ctx.roundRect(-36, -9, 72, 18, 3); ctx.fill();
  // Face edge (the hitting surface — top of the rotated rect)
  ctx.shadowColor = fc; ctx.shadowBlur = dk() ? 8 : 4;
  ctx.fillStyle = fc;
  ctx.beginPath(); ctx.roundRect(-36, -9, 72, 6, [3, 3, 0, 0]); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = fc; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-36, -9); ctx.lineTo(36, -9); ctx.stroke();
  ctx.restore();

  // Ball
  drawBall(ctx, cx, ballY, 9);

  // ── Ball flight arrow ──
  // Arrow direction = face angle (where face points = where ball starts)
  const arrLen = ballY - flagY - 30;
  const bx = cx + Math.sin(frad) * arrLen * 0.85;
  const by = ballY - Math.cos(frad) * arrLen * 0.85;

  // Trail dots
  for (let i = 1; i <= 4; i++) {
    const tt = i / 5;
    ctx.fillStyle = fc; ctx.globalAlpha = tt * 0.45;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(frad)*arrLen*0.85*tt, ballY - Math.cos(frad)*arrLen*0.85*tt, 2.5*tt, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dashed arrow line
  ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(cx, ballY - 10); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  arrowHead(ctx, bx, by, Math.atan2(by - (ballY - 10), bx - cx), fc, 9);

  // ── Angle arc ──
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(cx, ballY, 44, -Math.PI / 2, frad - Math.PI / 2, you < 0);
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ── Labels ──
  // "YOU" label near arrow tip
  const labX = cx + Math.sin(frad) * (arrLen * 0.5);
  const labY = ballY - Math.cos(frad) * (arrLen * 0.5);
  const offset = you >= 0 ? 28 : -28;
  boldLabel(ctx, `YOU  ${you > 0 ? '+' : ''}${Math.round(you)}°`, labX + offset, labY, fc, 11);

  // "TARGET" label near ideal line
  ctx.globalAlpha = 0.45;
  boldLabel(ctx, `TARGET  ~${ideal}°`, cx + (ideal >= 0 ? -44 : 44), flagY + 26, t.green, 10);
  ctx.globalAlpha = 1;

  // ── Compass ── (tiny N arrow top-right for orientation)
  const compassX = w - 22, compassY = 22;
  ctx.fillStyle = t.text3; ctx.globalAlpha = 0.5;
  ctx.font = `500 8px 'DM Mono', monospace`; ctx.textAlign = 'center';
  ctx.fillText('▲ N', compassX, compassY + 4); ctx.globalAlpha = 1;

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Face: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal}°</b><br>${diff < 1 ? 'On target!' : diff < 4 ? 'Close — small adjustment needed.' : `Off by ${diff.toFixed(0)}° — ${you > ideal ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
}

// ── Club path — TOP DOWN ───────────────────────────────────────────────────
// Bird's eye view. Swing direction arrow through ball. Target line vertical.

function drawPath(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 210); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  fillTopDown(ctx, w, h);

  const cx = w / 2, cy = h * 0.5;

  // Target line (vertical dashed)
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.moveTo(cx, 16); ctx.lineTo(cx, h - 16); ctx.stroke();
  ctx.setLineDash([]);

  // "IN" / "OUT" labels
  monoLabel(ctx, 'INSIDE', cx - 38, 28, t.text3, 8, 'right');
  monoLabel(ctx, 'OUTSIDE', cx + 8, 28, t.text3, 8, 'left');

  // Flag at top
  drawTopPin(ctx, cx, 18);

  const plen = h * 0.38;

  // ── Ideal path ghost ──
  const irad = ideal * Math.PI / 180;
  const isx = cx - Math.sin(irad) * plen, isy = cy + Math.cos(irad) * plen;
  const iex = cx + Math.sin(irad) * plen, iey = cy - Math.cos(irad) * plen;

  ctx.strokeStyle = t.green; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.globalAlpha = 0.08;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke(); ctx.globalAlpha = 1;

  ctx.strokeStyle = t.green; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  // Ideal arrow (ghost)
  arrowHead(ctx, iex, iey, Math.atan2(iey - isy, iex - isx), t.green, 8);
  ctx.globalAlpha = 0.4;
  monoLabel(ctx, 'TARGET PATH', iex + (ideal >= 0 ? 10 : -10), iey - 8, t.green, 8, ideal >= 0 ? 'left' : 'right');
  ctx.globalAlpha = 1;

  // ── Your path ──
  const inp = CLUBS[club].inputs.find(i => i.id === 'path');
  const idealRange = inp ? inp.ideal : [-5, 5];
  const prad = you * Math.PI / 180;
  const sx = cx - Math.sin(prad) * plen, sy = cy + Math.cos(prad) * plen;
  const ex = cx + Math.sin(prad) * plen, ey = cy - Math.cos(prad) * plen;
  const pc = kpiColor('path', you);

  glowLine(ctx, sx, sy, ex, ey, pc, 3.5);
  arrowHead(ctx, ex, ey, Math.atan2(ey - sy, ex - sx), pc, 10);

  // Ball at center
  drawBall(ctx, cx, cy, 10);

  // ── Labels ──
  boldLabel(ctx, `YOU  ${you > 0 ? '+' : ''}${Math.round(you)}°`,
    ex + (you >= 0 ? 12 : -12), ey - 10, pc, 11, you >= 0 ? 'left' : 'right');

  // Angle arc
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, -Math.PI / 2, prad - Math.PI / 2, you < 0);
    ctx.stroke(); ctx.globalAlpha = 1;
    // Angle text on arc
    const arcMid = prad / 2 - Math.PI / 2;
    monoLabel(ctx, `${Math.abs(Math.round(you))}°`, cx + Math.cos(arcMid) * 60, cy + Math.sin(arcMid) * 60, pc, 9);
  }

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${pc}">Path: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal > 0 ? '+' : ''}${ideal}°</b><br>${diff < 2 ? 'On target!' : you < idealRange[0] ? 'Out-to-in — classic slice path.' : you > idealRange[1] ? 'Very in-to-out — hook risk.' : 'Path is in range.'}`;
}

// ── Attack angle — SIDE VIEW ───────────────────────────────────────────────
// Viewed from the side. Sky above, green ground below.
// Club shaft arrives at ball from upper-left (downward) or lower-left (upward).

function drawAttack(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 210); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  const gy = h * 0.65; // ground level
  fillSideView(ctx, w, h, gy);

  const bx = w * 0.48, by = gy - 11;

  // Ground level reference line
  ctx.strokeStyle = t.text3; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(bx - 110, by); ctx.lineTo(bx + 60, by); ctx.stroke();
  ctx.setLineDash([]);
  monoLabel(ctx, 'GROUND LEVEL', bx - 70, by - 6, t.text3, 8);

  const slen = 130;

  // ── Ideal shaft ghost ──
  const irad = ideal * Math.PI / 180;
  const isx = bx - Math.cos(irad) * slen;
  const isy = by + Math.sin(irad) * slen;
  ctx.strokeStyle = t.green; ctx.lineWidth = 3; ctx.globalAlpha = 0.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(bx - 10, by); ctx.stroke(); ctx.globalAlpha = 1;
  monoLabel(ctx, 'TARGET', isx + 6, isy, t.green, 8, 'left');
  ctx.globalAlpha = 0.4; ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.arc(isx, isy, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

  // ── Your shaft ──
  const ac = kpiColor('attack', you);
  const rad = you * Math.PI / 180;
  const sx = bx - Math.cos(rad) * slen, sy = by + Math.sin(rad) * slen;

  glowLine(ctx, sx, sy, bx - 10, by, ac, 4);

  // "from here" label at shaft start
  monoLabel(ctx, 'FROM HERE', sx, sy - 12, t.text3, 8);

  // Clubhead at impact point
  ctx.save(); ctx.translate(bx - 10, by); ctx.rotate(-rad + (you < 0 ? 0.14 : -0.14));
  // Head body
  ctx.fillStyle = dk() ? '#2c3238' : '#7a7e88';
  ctx.beginPath(); ctx.roundRect(-7, -9, 24, 18, 3); ctx.fill();
  // Face edge (left side of head = the face)
  ctx.shadowColor = ac; ctx.shadowBlur = dk() ? 7 : 3;
  ctx.fillStyle = ac;
  ctx.beginPath(); ctx.roundRect(-7, -9, 5, 18, [2, 0, 0, 2]); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Direction arrow (short, showing where club is going)
  const arrLen = 58;
  const aex = bx + Math.cos(rad) * arrLen, aey = by - Math.sin(rad) * arrLen;
  ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aex, aey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  arrowHead(ctx, aex, aey, Math.atan2(aey - by, aex - bx), ac, 9);

  // Angle arc at ball
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = ac; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
    // Arc from horizontal (0) to the shaft angle
    const arcStart = Math.PI; // pointing left
    const arcEnd = Math.PI + rad;
    ctx.beginPath();
    ctx.arc(bx, by, 46, Math.min(arcStart, arcEnd), Math.max(arcStart, arcEnd));
    ctx.stroke(); ctx.globalAlpha = 1;
    // Angle label on arc
    const arcMid = Math.PI + rad / 2;
    monoLabel(ctx, `${you > 0 ? '+' : ''}${Math.round(you)}°`,
      bx + Math.cos(arcMid) * 60, by + Math.sin(arcMid) * 60, ac, 9);
  }

  // Ball
  drawBall(ctx, bx, by, 10);

  // ── Ground indicators ──

  // Divot (negative attack = hitting down = correct for irons)
  if (you < -2) {
    const dx = bx + 26;
    // Divot shape
    ctx.fillStyle = dk() ? '#4a3010' : '#7a5520';
    ctx.beginPath(); ctx.ellipse(dx, gy + 5, 22, 7, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dk() ? '#6a5030' : '#9a7540';
    ctx.beginPath(); ctx.ellipse(dx, gy + 4, 14, 5, 0.1, 0, Math.PI * 2); ctx.fill();
    monoLabel(ctx, 'DIVOT ✓', dx, gy + 20, t.green, 9);
  }

  // Tee (driver hitting up)
  if (you > 1 && club === 'driver') {
    ctx.fillStyle = '#d4a840'; ctx.fillRect(bx - 2.5, gy - 24, 5, 24);
    ctx.fillStyle = '#e8c050';
    ctx.beginPath(); ctx.ellipse(bx, gy - 24, 10, 6, 0, 0, Math.PI); ctx.fill();
    monoLabel(ctx, 'TEE ✓', bx, gy + 20, t.amber, 9);
  }

  // ── YOU label ──
  boldLabel(ctx, `YOU  ${you > 0 ? '+' : ''}${Math.round(you)}°`, sx + 8, sy + 14, ac, 11, 'left');

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  el.innerHTML = `<b style="color:${ac}">Attack: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ${ideal > 0 ? '+' : ''}${ideal}°</b><br>${Math.abs(you - ideal) < 1 ? 'On target!' : you > -2 && club !== 'driver' ? 'Too level or upward — this is the scoop. Push toward negative.' : you > 4 && club === 'driver' ? 'Very upward — check tee height.' : 'Getting there — push further toward target.'}`;
}
