// viz.js — rebuilt diagrams
// Face angle: top-down, full-width fairway, clear clubface, labels in margins
// Club path: top-down, full-width, path arrow through center
// Attack angle: side view, sky + ground

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

function T() {
  const d = dk();
  return {
    s1:    d ? '#1a2e1a' : '#78c455',
    s2:    d ? '#152415' : '#68b045',
    rough: d ? '#0d1a0d' : '#4a8c30',
    sky1:  d ? '#07111e' : '#b8d8f0',
    sky2:  d ? '#0d1e30' : '#daeeff',
    gnd1:  d ? '#1a2e1a' : '#6db84a',
    gnd2:  d ? '#152415' : '#60a840',
    text:  d ? '#f0ede8' : '#0e1012',
    text2: d ? '#6a7580' : '#6a7580',
    text3: d ? '#3a4550' : '#aab0b8',
    green: d ? '#00d68f' : '#00a86b',
    amber: d ? '#ffaa00' : '#d4880a',
    red:   d ? '#ff4d4d' : '#d93030',
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

// ── Backgrounds ────────────────────────────────────────────────────────────

function fillFullFairway(ctx, w, h) {
  const t = T();
  // Full-width fairway stripes
  const sw = 28;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.s1 : t.s2;
    ctx.fillRect(i * sw, 0, sw, h);
  }
}

function fillSideView(ctx, w, h, gy) {
  const t = T();
  // Sky — starts from card bg color at top, fades into sky color
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, dk() ? '#0a1018' : '#d0e8f8');
  sky.addColorStop(0.5, t.sky1);
  sky.addColorStop(1, t.sky2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, gy);
  // Ground stripes
  const sw = 28;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.gnd1 : t.gnd2;
    ctx.fillRect(i * sw, gy, sw, h - gy);
  }
  // Ground edge line
  ctx.strokeStyle = dk() ? '#2a5a2a' : '#55a030';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  // Shadow strip
  const gs = ctx.createLinearGradient(0, gy, 0, gy + 20);
  gs.addColorStop(0, 'rgba(0,0,0,0.3)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs; ctx.fillRect(0, gy, w, 20);
}

// ── Primitives ─────────────────────────────────────────────────────────────

function drawBall(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r*0.3, y - r*0.35, r*0.05, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#eeeeee'); g.addColorStop(1, '#cccccc');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
}

function glowLine(ctx, x1, y1, x2, y2, color, lw) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = lw + 10; ctx.globalAlpha = 0.06;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.lineWidth = lw + 3; ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.lineWidth = lw; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}

function arrowHead(ctx, ex, ey, angle, color, size) {
  ctx.fillStyle = color; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-size,-size*0.5); ctx.lineTo(-size,size*0.5);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawSideFlag(ctx, x, y) {
  ctx.fillStyle = dk() ? '#c8a830' : '#8a6800';
  ctx.fillRect(x-1, y, 1.5, 28);
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(x+1,y); ctx.lineTo(x+18,y+9); ctx.lineTo(x+1,y+18); ctx.fill();
}

function monoLabel(ctx, text, x, y, color, size, align) {
  ctx.font = `500 ${size||9}px 'DM Mono', monospace`;
  ctx.fillStyle = color; ctx.textAlign = align||'center';
  ctx.globalAlpha = 1; ctx.fillText(text, x, y);
}

function boldLabel(ctx, text, x, y, color, size, align) {
  ctx.font = `700 ${size||12}px 'Barlow Condensed', sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align||'center';
  ctx.globalAlpha = 1; ctx.fillText(text, x, y);
}

// ── Animation ──────────────────────────────────────────────────────────────

const animState = {};
const prevAngles = {};

function animateDraw(canvasId, from, to, drawFn) {
  if (animState[canvasId]) cancelAnimationFrame(animState[canvasId]);
  const start = performance.now(), dur = 260;
  function step(now) {
    const t = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1-t, 3);
    drawFn(from + (to - from) * ease, t >= 1);
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
    panels.push({ id:'vface', did:'vdface', title:'Face angle · top view', fn:()=>triggerFace('vface','vdface') });
  if (C.inputs.find(i => i.id === 'path'))
    panels.push({ id:'vpath', did:'vdpath', title:'Club path · top view', fn:()=>triggerPath('vpath','vdpath') });
  if (C.inputs.find(i => i.id === 'attack'))
    panels.push({ id:'vattack', did:'vdattack', title:'Attack angle · side view', fn:()=>triggerAttack('vattack','vdattack') });

  document.getElementById('vgrid').innerHTML = panels.map(p => `
    <div class="vc-wrap">
      <div class="vc-header"><span class="vc-title">${p.title}</span></div>
      <canvas class="cv" id="${p.id}" height="220"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
    </div>`).join('');

  setTimeout(() => panels.forEach(p => p.fn()), 40);
}

function triggerFace(cid, did) {
  const you = getVal('face')||0, ideal = idealMid('face');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawFace(cid, did, cur, ideal, done));
}
function triggerPath(cid, did) {
  const you = getVal('path')||0, ideal = idealMid('path');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawPath(cid, did, cur, ideal, done));
}
function triggerAttack(cid, did) {
  const you = getVal('attack')||0, ideal = idealMid('attack');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawAttack(cid, did, cur, ideal, done));
}

// ── FACE ANGLE — top down ──────────────────────────────────────────────────
// Layout:
//   Top 15%  : flag area + "TARGET" label
//   Mid 70%  : flight arrow zone
//   Ball at 78% height, center-x
//   Clubface drawn at ball, rotated by face angle
//   Labels in left/right margins, never overlapping diagram

function drawFace(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 220); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  // Full-width green
  fillFullFairway(ctx, w, h);

  const cx = w / 2;
  const ballY = h * 0.76;
  const flagY = h * 0.13;
  const fc = kpiColor('face', you);
  const frad = you * Math.PI / 180;

  // ── Target line ──
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.moveTo(cx, flagY+18); ctx.lineTo(cx, ballY-14); ctx.stroke();
  ctx.setLineDash([]);

  // ── Flag — pin + triangle, label above ──
  ctx.fillStyle = dk() ? '#e0e0de' : '#2a2a28';
  ctx.beginPath(); ctx.arc(cx, flagY, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(cx+3,flagY-2); ctx.lineTo(cx+16,flagY); ctx.lineTo(cx+3,flagY+7); ctx.fill();
  monoLabel(ctx, 'FLAG / TARGET', cx, flagY - 10, T().text3, 8);

  // ── Ideal clubface ghost (very subtle) ──
  const irad = ideal * Math.PI / 180;
  ctx.save(); ctx.translate(cx, ballY); ctx.rotate(irad); ctx.globalAlpha = 0.15;
  ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.roundRect(-w*0.3, -8, w*0.6, 16, 3); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // ── Your clubface — full width so it's clearly visible ──
  ctx.save(); ctx.translate(cx, ballY); ctx.rotate(frad);
  const faceW = w * 0.58; // wide enough to clearly see
  // Shadow
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.roundRect(-faceW/2+3, -8+4, faceW, 16, 3); ctx.fill();
  ctx.globalAlpha = 1;
  // Body
  ctx.fillStyle = dk() ? '#2c3640' : '#6a7080';
  ctx.beginPath(); ctx.roundRect(-faceW/2, -8, faceW, 16, 3); ctx.fill();
  // Top edge = the actual face (glowing)
  ctx.shadowColor = fc; ctx.shadowBlur = dk() ? 10 : 5;
  ctx.fillStyle = fc;
  ctx.beginPath(); ctx.roundRect(-faceW/2, -8, faceW, 7, [3,3,0,0]); ctx.fill();
  ctx.shadowBlur = 0;
  // Bright face line
  ctx.strokeStyle = fc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-faceW/2, -8); ctx.lineTo(faceW/2, -8); ctx.stroke();
  ctx.restore();

  // ── Ball on top of clubface ──
  drawBall(ctx, cx, ballY, 10);

  // ── Ball flight arrow ──
  const arrLen = ballY - flagY - 28;
  const tipX = cx + Math.sin(frad) * arrLen * 0.82;
  const tipY = ballY - Math.cos(frad) * arrLen * 0.82;

  // Trail dots
  for (let i = 1; i <= 5; i++) {
    const tt = i/6;
    ctx.fillStyle = fc; ctx.globalAlpha = tt * 0.5;
    ctx.beginPath(); ctx.arc(
      cx + Math.sin(frad)*arrLen*0.82*tt,
      ballY - Math.cos(frad)*arrLen*0.82*tt,
      2.5*tt, 0, Math.PI*2
    ); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dashed line
  ctx.strokeStyle = fc; ctx.lineWidth = 2; ctx.setLineDash([6,4]); ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(cx, ballY-12); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  arrowHead(ctx, tipX, tipY, Math.atan2(tipY-(ballY-12), tipX-cx), fc, 10);

  // ── Angle arc ──
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(cx, ballY, 52, -Math.PI/2, frad-Math.PI/2, you<0);
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ── Labels — YOU in top-right corner, never over the diagram ──
  const youText = `YOU  ${you > 0 ? '+' : ''}${Math.round(you)}°`;
  ctx.font = `700 13px 'Barlow Condensed', sans-serif`;
  const youW = ctx.measureText(youText).width + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.roundRect(w - youW - 14, 14, youW, 22, 3); ctx.fill();
  ctx.globalAlpha = 1;
  boldLabel(ctx, youText, w - 22, 30, fc, 13, 'right');

  // Ideal label — only show when different from you, in top-left corner
  if (Math.abs(you - ideal) > 1) {
    const tgtText = `IDEAL ~${Math.round(ideal)}°`;
    ctx.font = `500 9px 'DM Mono', monospace`;
    const tgtW = ctx.measureText(tgtText).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.roundRect(14, 14, tgtW, 18, 3); ctx.fill();
    ctx.globalAlpha = 0.55; ctx.fillStyle = T().green;
    ctx.font = `500 9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(tgtText, 20, 27); ctx.globalAlpha = 1;
  }

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Face: ${you>0?'+':''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${Math.round(ideal)}°</b><br>${diff<1?'On target!':diff<4?'Close — small adjustment needed.':`Off by ${diff.toFixed(0)}° — ${you>ideal?'face open, needs to close':'face closed, open slightly'}.`}`;
}

// ── CLUB PATH — top down ───────────────────────────────────────────────────
// Full-width green. Target line runs vertically through center.
// Swing path arrow runs diagonally through ball.
// Ball at center. Labels in margins.

function drawPath(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 220); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  fillFullFairway(ctx, w, h);

  const cx = w/2, cy = h*0.5;

  const cx = w/2, cy = h*0.5;
  const pc = kpiColor('path', you);
  const inp = CLUBS[club].inputs.find(i => i.id === 'path');
  const idealRange = inp ? inp.ideal : [-5,5];

  // ── Target line (vertical center) ──
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([8,6]);
  ctx.beginPath(); ctx.moveTo(cx, 14); ctx.lineTo(cx, h-14); ctx.stroke();
  ctx.setLineDash([]);

  // IN / OUT labels (at mid height, left and right of target line)
  monoLabel(ctx, '← INSIDE', cx-10, cy, t.text3, 9, 'right');
  monoLabel(ctx, 'OUTSIDE →', cx+10, cy, t.text3, 9, 'left');

  // Flag at top — pin circle + red triangle only, no extra text
  ctx.fillStyle = dk() ? '#e0e0de' : '#2a2a28';
  ctx.beginPath(); ctx.arc(cx, 20, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(cx+3,18); ctx.lineTo(cx+17,20); ctx.lineTo(cx+3,27); ctx.fill();

  const plen = h * 0.42;
  const irad = ideal * Math.PI / 180;

  // ── Ideal path ghost ──
  const isx = cx - Math.sin(irad)*plen, isy = cy + Math.cos(irad)*plen;
  const iex = cx + Math.sin(irad)*plen, iey = cy - Math.cos(irad)*plen;

  ctx.strokeStyle = t.green; ctx.lineWidth = 14; ctx.lineCap='round'; ctx.globalAlpha = 0.07;
  ctx.beginPath(); ctx.moveTo(isx,isy); ctx.lineTo(iex,iey); ctx.stroke(); ctx.globalAlpha = 1;

  ctx.strokeStyle = t.green; ctx.lineWidth = 1.5; ctx.setLineDash([5,4]); ctx.globalAlpha = 0.38;
  ctx.beginPath(); ctx.moveTo(isx,isy); ctx.lineTo(iex,iey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  arrowHead(ctx, iex, iey, Math.atan2(iey-isy, iex-isx), t.green, 8);

  // ── Your path ──
  const prad = you * Math.PI / 180;
  const sx = cx - Math.sin(prad)*plen, sy = cy + Math.cos(prad)*plen;
  const ex = cx + Math.sin(prad)*plen, ey = cy - Math.cos(prad)*plen;

  glowLine(ctx, sx, sy, ex, ey, pc, 3.5);
  arrowHead(ctx, ex, ey, Math.atan2(ey-sy, ex-sx), pc, 11);

  // ── Ball at center ──
  drawBall(ctx, cx, cy, 11);

  // ── Angle arc ──
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, 52, -Math.PI/2, prad-Math.PI/2, you<0);
    ctx.stroke(); ctx.globalAlpha = 1;
    const arcMid = prad/2 - Math.PI/2;
    monoLabel(ctx, `${Math.abs(Math.round(you))}°`, cx+Math.cos(arcMid)*64, cy+Math.sin(arcMid)*64, pc, 9);
  }

  // ── "YOU" label — in margin, not overlapping arrow ──
  const youText = `YOU  ${you>0?'+':''}${Math.round(you)}°`;
  ctx.font = `700 13px 'Barlow Condensed', sans-serif`;
  const youW = ctx.measureText(youText).width + 16;
  const ylx = you >= 0 ? w - 16 : 16;
  const yly = ey - 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.roundRect(you>=0?ylx-youW:ylx, yly-13, youW, 20, 3); ctx.fill();
  ctx.globalAlpha = 1;
  boldLabel(ctx, youText, ylx, yly, pc, 13, you>=0?'right':'left');

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${pc}">Path: ${you>0?'+':''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${Math.round(ideal)>0?'+':''}${Math.round(ideal)}°</b><br>${diff<2?'On target!':you<idealRange[0]?'Out-to-in — classic slice path.':you>idealRange[1]?'Very in-to-out — hook risk.':'Path is in range.'}`;
}

// ── ATTACK ANGLE — side view ───────────────────────────────────────────────
// Sky above, green ground below. Club shaft arrives at ball from upper-left
// (downward) or lower-left (upward). Full-width canvas.

function drawAttack(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 220); if (!r) return;
  const { ctx, w, h } = r;
  const t = T();

  const gy = h * 0.64;
  fillSideView(ctx, w, h, gy);

  const bx = w * 0.5, by = gy - 12;
  const ac = kpiColor('attack', you);
  const rad = you * Math.PI / 180;
  const slen = Math.min(w * 0.55, 160);

  // Ground level line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.moveTo(20, by); ctx.lineTo(w-20, by); ctx.stroke();
  ctx.setLineDash([]);
  monoLabel(ctx, 'GROUND', w-22, by-6, t.text3, 8, 'right');

  // ── Ideal shaft ghost ──
  const irad = ideal * Math.PI / 180;
  const isx = bx - Math.cos(irad)*slen, isy = by + Math.sin(irad)*slen;
  ctx.strokeStyle = t.green; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(bx-12, by); ctx.stroke(); ctx.globalAlpha = 1;
  // Small label at ideal shaft start
  monoLabel(ctx, `IDEAL ${ideal>0?'+':''}${Math.round(ideal)}°`, isx, isy-10, t.green, 8, 'center');
  ctx.globalAlpha = 0.4; ctx.fillStyle = t.green;
  ctx.beginPath(); ctx.arc(isx, isy, 4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

  // ── Your shaft ──
  const sx = bx - Math.cos(rad)*slen, sy = by + Math.sin(rad)*slen;
  glowLine(ctx, sx, sy, bx-12, by, ac, 5);

  // "FROM HERE" at shaft start
  monoLabel(ctx, 'FROM HERE', sx, sy+16, t.text3, 8, 'center');

  // ── Clubhead ──
  ctx.save(); ctx.translate(bx-12, by); ctx.rotate(-rad + (you<0?0.14:-0.14));
  // Shadow
  ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.roundRect(-8, -10, 28, 20, 3); ctx.fill(); ctx.globalAlpha = 1;
  // Body
  ctx.fillStyle = dk() ? '#2c3640' : '#6a7080';
  ctx.beginPath(); ctx.roundRect(-8, -10, 28, 20, 3); ctx.fill();
  // Face edge (left side)
  ctx.shadowColor = ac; ctx.shadowBlur = dk() ? 8 : 4;
  ctx.fillStyle = ac;
  ctx.beginPath(); ctx.roundRect(-8, -10, 6, 20, [2,0,0,2]); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Direction arrow ──
  const arrL = 60;
  const aex = bx + Math.cos(rad)*arrL, aey = by - Math.sin(rad)*arrL;
  ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.setLineDash([4,3]); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aex, aey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  arrowHead(ctx, aex, aey, Math.atan2(aey-by, aex-bx), ac, 9);

  // ── Angle arc ──
  if (Math.abs(you) > 0.5) {
    ctx.strokeStyle = ac; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
    // Arc from horizontal (pointing left = π) to shaft direction
    const a1 = Math.PI, a2 = Math.PI + rad;
    ctx.beginPath(); ctx.arc(bx, by, 50, Math.min(a1,a2), Math.max(a1,a2)); ctx.stroke();
    ctx.globalAlpha = 1;
    const arcMid = Math.PI + rad/2;
    monoLabel(ctx, `${you>0?'+':''}${Math.round(you)}°`, bx+Math.cos(arcMid)*64, by+Math.sin(arcMid)*64, ac, 9);
  }

  // ── Ball ──
  drawBall(ctx, bx, by, 11);

  // ── Divot ──
  if (you < -2) {
    const dx = bx + 30;
    ctx.fillStyle = dk() ? '#4a3010' : '#7a5520';
    ctx.beginPath(); ctx.ellipse(dx, gy+5, 24, 8, 0.1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = dk() ? '#6a5030' : '#9a7540';
    ctx.beginPath(); ctx.ellipse(dx, gy+4, 16, 6, 0.1, 0, Math.PI*2); ctx.fill();
    monoLabel(ctx, 'DIVOT ✓', dx, gy+22, t.green, 9);
  }

  // ── Tee ──
  if (you > 1 && club === 'driver') {
    ctx.fillStyle = '#d4a840'; ctx.fillRect(bx-3, gy-26, 6, 26);
    ctx.fillStyle = '#e8c050';
    ctx.beginPath(); ctx.ellipse(bx, gy-26, 11, 6, 0, 0, Math.PI); ctx.fill();
    monoLabel(ctx, 'TEE ✓', bx, gy+22, t.amber, 9);
  }

  // ── "YOU" label — top-right area ──
  const youText = `YOU  ${you>0?'+':''}${Math.round(you)}°`;
  ctx.font = `700 13px 'Barlow Condensed', sans-serif`;
  const youW = ctx.measureText(youText).width + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.roundRect(w-youW-14, 14, youW, 22, 3); ctx.fill();
  ctx.globalAlpha = 1;
  boldLabel(ctx, youText, w-22, 30, ac, 13, 'right');

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  el.innerHTML = `<b style="color:${ac}">Attack: ${you>0?'+':''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ${Math.round(ideal)>0?'+':''}${Math.round(ideal)}°</b><br>${Math.abs(you-ideal)<1?'On target!':you>-2&&club!=='driver'?'Too level or upward — this is the scoop. Push toward negative.':you>4&&club==='driver'?'Very upward — check tee height.':'Getting there — push further toward target.'}`;
}
