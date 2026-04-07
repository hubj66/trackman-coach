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

const d = true; // dark mode always on

function sc(id, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);

  let ancestor = c.parentElement;
  let parentW = 0;
  while (ancestor && ancestor !== document.body) {
    parentW = ancestor.clientWidth;
    if (parentW > 0) break;
    ancestor = ancestor.parentElement;
  }

  const w = parentW > 0 ? parentW - 28 : window.innerWidth - 36;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';

  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function idealMid(id) {
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return 0;
  const src = typeof getIdealRange === 'function' ? getIdealRange(inp) : inp.ideal;
  return (src[0] + src[1]) / 2;
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
    stripe1: d ? '#1e3420' : '#78c455',
    stripe2: d ? '#182818' : '#65b040',
    sky1:    d ? '#060c14' : '#c5e0f8',
    sky2:    d ? '#0e1a28' : '#e8f4ff',
    gr1:     d ? '#1e3420' : '#78c455',
    gr2:     d ? '#182818' : '#65b040',
  };
}

function kpiColor(id, v) {
  const inp = getAllInputs(club).find(i => i.id === id);
  if (!inp) return T().green;

  const src = typeof getIdealRange === 'function' ? getIdealRange(inp) : inp.ideal;
  const [lo, hi] = src;

  if (v >= lo && v <= hi) return T().green;
  const margin = Math.max((hi - lo) * 0.8, 2);
  if (v >= lo - margin && v <= hi + margin) return T().amber;
  return T().red;
}

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

  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, t.sky1);
  sky.addColorStop(1, t.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, gy);

  const sw = 20;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.gr1 : t.gr2;
    ctx.fillRect(i * sw, gy, sw, h - gy);
  }

  ctx.strokeStyle = '#2a5a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();

  const gs = ctx.createLinearGradient(0, gy, 0, gy + 16);
  gs.addColorStop(0, 'rgba(0,0,0,0.25)');
  gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, gy, w, 16);
}

function drawFlag(ctx, x, y) {
  ctx.fillStyle = '#c8a830';
  ctx.fillRect(x - 1, y, 1.5, 26);
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + 16, y + 8);
  ctx.lineTo(x + 1, y + 16);
  ctx.fill();
}

function drawBall(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#e8e8e8');
  g.addColorStop(1, '#cccccc');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawGlowLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width + 6;
  ctx.globalAlpha = 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.lineWidth = width + 2;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.lineWidth = width;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawArrow(ctx, ex, ey, angle, color, size) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.5);
  ctx.lineTo(-size, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

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

function triggerFace(cid, did) {
  const you = getVal('face') || 0;
  const ideal = idealMid('face');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawFaceBoth(cid, did, cur, ideal, done));
}

function triggerPath(cid, did) {
  const you = getVal('path') || 0;
  const ideal = idealMid('path');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawPathBoth(cid, did, cur, ideal, done));
}

function triggerAttack(cid, did) {
  const you = getVal('attack') || 0;
  const ideal = idealMid('attack');
  const prev = prevAngles[cid] !== undefined ? prevAngles[cid] : you;
  prevAngles[cid] = you;
  animateDraw(cid, prev, you, (cur, done) => drawAttackBoth(cid, did, cur, ideal, done));
}

function drawGrass(ctx, w, h) {
  for (let i = 0; i * 22 < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1b3020' : '#152618';
    ctx.fillRect(i * 22, 0, 22, h);
  }
}

function drawFairwayStrip(ctx, cx, w, h) {
  const fw = 108;
  const fx = cx - fw / 2;
  for (let i = 0; i * 20 < fw; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1f3822' : '#19301a';
    ctx.fillRect(fx + i * 20, 0, 20, h);
  }
  ctx.strokeStyle = 'rgba(42,74,42,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx, 0);
  ctx.lineTo(fx, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx + fw, 0);
  ctx.lineTo(fx + fw, h);
  ctx.stroke();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawBallPremium(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + r * 0.6, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.4, '#f4f4f2');
  g.addColorStop(0.75, '#d8d8d4');
  g.addColorStop(1, '#b8b8b4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.25, r * 0.15, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlagPremium(ctx, x, y) {
  ctx.fillStyle = '#b89828';
  ctx.fillRect(x - 0.75, y, 1.5, 28);
  ctx.fillStyle = '#8a7218';
  ctx.fillRect(x + 0.25, y, 0.5, 28);
  ctx.fillStyle = '#e83030';
  ctx.beginPath();
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + 16, y + 7);
  ctx.lineTo(x + 1, y + 14);
  ctx.fill();
  ctx.fillStyle = '#c42828';
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 7);
  ctx.lineTo(x + 16, y + 7);
  ctx.lineTo(x + 1, y + 14);
  ctx.fill();
}

function drawArrowPremium(ctx, ex, ey, a, c, s) {
  ctx.fillStyle = c;
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-s, -s * 0.45);
  ctx.lineTo(-s * 0.7, 0);
  ctx.lineTo(-s, s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPill(ctx, x, y, t, c, al) {
  ctx.font = "700 10px 'Barlow Condensed', sans-serif";
  const tw = ctx.measureText(t).width, pw = tw + 14, ph = 20, pr = 4;
  let px = al === 'left' ? x : al === 'right' ? x - pw : x - pw / 2;
  ctx.fillStyle = 'rgba(14,16,18,0.7)';
  ctx.beginPath();
  ctx.roundRect(px, y - ph / 2, pw, ph, pr);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(px, y - ph / 2, pw, ph, pr);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.textAlign = 'left';
  ctx.fillText(t, px + 7, y + 3.5);
}

function drawDriverHeadTop(ctx, x, y, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#111417';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23);
  ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6);
  ctx.closePath();
  ctx.fill();
  const cg = ctx.createRadialGradient(2, 8, 1, 0, 10, 30);
  cg.addColorStop(0, 'rgba(55,62,70,0.2)');
  cg.addColorStop(0.5, 'rgba(35,40,48,0.08)');
  cg.addColorStop(1, 'rgba(15,18,22,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23);
  ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23);
  ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 7);
  ctx.stroke();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.moveTo(-18, -5);
  ctx.quadraticCurveTo(0, -9, 18, -5);
  ctx.quadraticCurveTo(0, -1, -18, -5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a4248';
  ctx.beginPath();
  ctx.arc(-17, 1, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIronHeadTop(ctx, x, y, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const S = 1.4;
  const mg = ctx.createLinearGradient(-20 * S, -6 * S, 22 * S, 10 * S);
  mg.addColorStop(0, '#8a9199');
  mg.addColorStop(0.2, '#6b747c');
  mg.addColorStop(0.45, '#a0a8b0');
  mg.addColorStop(0.55, '#7a838b');
  mg.addColorStop(0.8, '#5c656d');
  mg.addColorStop(1, '#4a535b');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(-18 * S, -5 * S);
  ctx.lineTo(18 * S, -5 * S);
  ctx.quadraticCurveTo(22 * S, -3 * S, 22 * S, 2 * S);
  ctx.quadraticCurveTo(22 * S, 8 * S, 18 * S, 10 * S);
  ctx.quadraticCurveTo(0, 14 * S, -16 * S, 10 * S);
  ctx.quadraticCurveTo(-20 * S, 8 * S, -20 * S, 2 * S);
  ctx.quadraticCurveTo(-20 * S, -3 * S, -18 * S, -5 * S);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-18 * S, -5 * S);
  ctx.lineTo(18 * S, -5 * S);
  ctx.quadraticCurveTo(22 * S, -3 * S, 22 * S, 2 * S);
  ctx.quadraticCurveTo(22 * S, 8 * S, 18 * S, 10 * S);
  ctx.quadraticCurveTo(0, 14 * S, -16 * S, 10 * S);
  ctx.quadraticCurveTo(-20 * S, 8 * S, -20 * S, 2 * S);
  ctx.quadraticCurveTo(-20 * S, -3 * S, -18 * S, -5 * S);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(-18 * S, -5 * S);
  ctx.lineTo(18 * S, -5 * S);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.14;
  ctx.fillRect(-17 * S, -5 * S, 34 * S, 4 * S);
  ctx.globalAlpha = 1;
  const hg = ctx.createRadialGradient(-17 * S, 3 * S, 1, -17 * S, 3 * S, 5);
  hg.addColorStop(0, '#8a9199');
  hg.addColorStop(1, '#4a535b');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(-17 * S, 3 * S, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFaceBoth(cid, did, you) {
  const r = sc(cid, 220);
  if (!r) return;
  const { ctx, w, h } = r;
  const fc = kpiColor('face', you);
  const isDriver = club === 'driver';

  drawGrass(ctx, w, h);
  drawFairwayStrip(ctx, w / 2, w, h);
  drawVignette(ctx, w, h);

  const cx = w / 2;
  const ballY = h * 0.46;
  const clubY = h * 0.64;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(cx, 22);
  ctx.lineTo(cx, ballY - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  drawFlagPremium(ctx, cx, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = "500 8px 'DM Mono',monospace";
  ctx.textAlign = 'center';
  ctx.fillText('TARGET', cx, 15);

  ctx.globalAlpha = 0.12;
  if (isDriver) drawDriverHeadTop(ctx, cx, clubY, 0, '#00d68f');
  else drawIronHeadTop(ctx, cx, clubY, 0, '#00d68f');
  ctx.globalAlpha = 1;

  const fRad = you * Math.PI / 180;
  if (isDriver) drawDriverHeadTop(ctx, cx, clubY, fRad, fc);
  else drawIronHeadTop(ctx, cx, clubY, fRad, fc);

  drawBallPremium(ctx, cx, ballY, 8);

  const fLen = 65;
  const fRad2 = fRad * 0.88;
  const fEndX = cx + Math.sin(fRad2) * fLen;
  const fEndY = ballY - Math.cos(fRad2) * fLen;

  ctx.strokeStyle = fc;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, ballY - 9);
  ctx.lineTo(fEndX, fEndY);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, ballY - 9);
  ctx.lineTo(fEndX, fEndY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    ctx.fillStyle = fc;
    ctx.globalAlpha = t * 0.5;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(fRad2) * fLen * t, ballY - Math.cos(fRad2) * fLen * t, 1.5 + t * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawArrowPremium(ctx, fEndX, fEndY, Math.atan2(fEndY - (ballY - 9), fEndX - cx), fc, 8);

  if (Math.abs(you) > 1) {
    ctx.strokeStyle = fc;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, ballY, 34, -Math.PI / 2, fRad - Math.PI / 2, you < 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawPill(ctx, cx + (you >= 0 ? 44 : -44), ballY - 10, 'YOU ' + (you > 0 ? '+' : '') + Math.round(you * 10) / 10 + '°', fc, you >= 0 ? 'left' : 'right');
  drawPill(ctx, cx + (you >= 0 ? -40 : 40), clubY + 28, 'TARGET ~0°', '#00d68f', you >= 0 ? 'right' : 'left');

  const el = document.getElementById(did);
  if (el) {
    const d = Math.abs(you);
    el.innerHTML = `<b style="color:${fc}">Your face: ${you > 0 ? '+' : ''}${Math.round(you * 10) / 10}°</b>&nbsp;&nbsp;<b style="color:#00d68f">Target: ~0°</b><br>${d < 1 ? 'On target!' : d < 4 ? 'Close — small adjustment needed.' : `Off by ${Math.round(d * 10) / 10}° — ${you > 0 ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
  }
}

function drawPathBoth(cid, did, you) {
  const r = sc(cid, 280);
  if (!r) return;
  const { ctx, w, h } = r;
  const pc = kpiColor('path', you);

  drawGrass(ctx, w, h);
  drawFairwayStrip(ctx, w / 2, w, h);
  drawVignette(ctx, w, h);

  const cx = w / 2;
  const ballY = h * 0.50;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, 14);
  ctx.lineTo(cx, h - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  drawFlagPremium(ctx, cx, 14);
  ctx.font = "500 8px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'left';
  ctx.fillText('OUTSIDE', cx + 8, 48);
  ctx.textAlign = 'right';
  ctx.fillText('INSIDE', cx - 8, 48);

  const pRad = you * Math.PI / 180;
  const arcLen = h * 0.36;
  const latSpread = Math.tan(pRad) * arcLen;

  const entryX = cx + latSpread * 0.7;
  const entryY = ballY + arcLen;
  const exitX = cx - latSpread * 0.7;
  const exitY = ballY - arcLen;

  const totalBow = -6 + (-you * 2.4);
  const cp1x = cx + latSpread * 0.25 + totalBow;
  const cp1y = ballY + arcLen * 0.45;
  const cp2x = cx - latSpread * 0.25 + totalBow;
  const cp2y = ballY - arcLen * 0.45;

  const N = 80;
  function bez(eX, eY, c1x, c1y, c2x, c2y, xX, xY) {
    const p = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, m = 1 - t;
      p.push({
        x: m * m * m * eX + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * xX,
        y: m * m * m * eY + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * xY
      });
    }
    return p;
  }

  const pts = bez(entryX, entryY, cp1x, cp1y, cp2x, cp2y, exitX, exitY);
  const ib = -6;
  const ipts = bez(cx, ballY + arcLen, cx + ib, ballY + arcLen * 0.45, cx + ib, ballY - arcLen * 0.45, cx, ballY - arcLen);

  let ii = 0, md = 1e9;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - cx, pts[i].y - ballY);
    if (d < md) { md = d; ii = i; }
  }

  ctx.strokeStyle = '#00d68f';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.2;
  ctx.setLineDash([5, 4]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ipts[0].x, ipts[0].y);
  for (let i = 1; i < ipts.length; i++) ctx.lineTo(ipts[i].x, ipts[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = pc;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = pc;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= ii; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[ii].x, pts[ii].y);
  for (let i = ii + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  const lp = pts[pts.length - 1], pp = pts[pts.length - 3];
  drawArrowPremium(ctx, lp.x, lp.y, Math.atan2(lp.y - pp.y, lp.x - pp.x), pc, 7);

  for (let i = 5; i < pts.length - 5; i += 6) {
    const t = i / pts.length;
    ctx.fillStyle = pc;
    ctx.globalAlpha = 0.1 + t * 0.35;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, 0.8 + t * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawBallPremium(ctx, cx, ballY, 8);

  if (Math.abs(you) > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, ballY + 20);
    ctx.lineTo(cx, ballY - 20);
    ctx.stroke();
    ctx.strokeStyle = pc;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, ballY, 18, -Math.PI / 2, -Math.PI / 2 + pRad, you < 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const li = Math.round(pts.length * 0.8);
  drawPill(ctx, pts[li].x + (pts[li].x > cx ? 10 : -10), pts[li].y - 2, 'YOU ' + (you > 0 ? '+' : '') + Math.round(you * 10) / 10 + '°', pc, pts[li].x > cx ? 'left' : 'right');
  const ili = Math.round(ipts.length * 0.8);
  drawPill(ctx, ipts[ili].x - 30, ipts[ili].y, 'TARGET 0°', '#00d68f', 'right');

  ctx.font = "500 7px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.textAlign = 'center';
  ctx.fillText('BACKSWING', pts[2].x, pts[2].y + 12);
  ctx.fillText('FOLLOW-THROUGH', lp.x, lp.y - 12);

  const el = document.getElementById(did);
  if (el) {
    const d = Math.abs(you);
    let desc;
    if (d < 2) desc = 'Neutral path — club moving along the target line.';
    else if (you < -4) desc = 'Out-to-in — club comes from outside, exits inside. Classic slice path.';
    else if (you < 0) desc = 'Slightly out-to-in — mild fade path.';
    else if (you > 4) desc = 'Very in-to-out — club comes from inside, exits outside. Hook risk.';
    else desc = 'Slightly in-to-out — mild draw path.';
    el.innerHTML = `<b style="color:${pc}">Your path: ${you > 0 ? '+' : ''}${Math.round(you * 10) / 10}°</b>&nbsp;&nbsp;<b style="color:#00d68f">Target: ~0°</b><br>${desc}`;
  }
}

function drawAttackBoth(cid, did, you) {
  const r = sc(cid, 280);
  if (!r) return;
  const { ctx, w, h } = r;
  const ac = kpiColor('attack', you);
  const isDriver = club === 'driver';
  const ideal = idealMid('attack');

  const gy = h * 0.65;
  drawSkyGround(ctx, w, h, gy / h);
  drawVignette(ctx, w, h);

  const stanceAnchor = w * 0.50;
  const bx = isDriver ? (stanceAnchor + 24) : stanceAnchor;
  const by = gy - 11;

  const rightFootX = bx - 5;
  const rightFootY = gy;
  const rightKneeX = rightFootX - 2;
  const rightKneeY = gy - 24;
  const leftFootX = rightFootX - 58;
  const leftFootY = gy;
  const leftKneeX = leftFootX + 22;
  const leftKneeY = gy - 28;
  const hipX = rightFootX - 7;
  const hipY = gy - 68;
  const shoulderX = hipX - 10;
  const shoulderY = gy - 112;
  const neckX = shoulderX - 3;
  const neckY = shoulderY - 11;
  const shoulderLeftX = neckX - 13;
  const shoulderLeftY = gy - 104;
  const shoulderRightX = neckX + 18;
  const shoulderRightY = gy - 120;
  const headX = neckX - 3;
  const headY = neckY - 9.5;
  const handsX = bx + 4;
  const handsY = by - 42;
  const clubX = bx - 22;
  const clubY = gy - 4;

  if (isDriver) {
    ctx.fillStyle = '#c8963a';
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + 4, by);
    ctx.lineTo(bx + 2.5, by + 18);
    ctx.lineTo(bx - 2.5, by + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8b050';
    ctx.beginPath();
    ctx.ellipse(bx, by, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(bx - 70, gy + 2);
  ctx.lineTo(bx + 50, gy + 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.fillStyle = 'rgba(255,255,255,0.11)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(headX, headY, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(neckX, neckY);
  ctx.lineTo(shoulderX, shoulderY);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shoulderLeftX, shoulderLeftY);
  ctx.lineTo(shoulderRightX, shoulderRightY);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.quadraticCurveTo(hipX - 2, gy - 76, hipX, hipY);
  ctx.stroke();
  ctx.lineWidth = 5.8;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(rightKneeX, rightKneeY);
  ctx.lineTo(rightFootX, rightFootY);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(leftKneeX, leftKneeY);
  ctx.lineTo(leftFootX, leftFootY);
  ctx.stroke();
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(shoulderRightX, shoulderRightY);
  ctx.lineTo(handsX, handsY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(shoulderLeftX, shoulderLeftY);
  ctx.quadraticCurveTo(shoulderX - 2, gy - 95, handsX + 3, handsY + 1);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(hipX, gy + 4, 36, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(handsX, handsY);
  ctx.lineTo(clubX + 10, clubY - 4);
  ctx.stroke();

  const rad = you * Math.PI / 180;
  const arcR = w * 0.38;
  const backX = clubX - arcR * 0.7;
  const backY = clubY - arcR * 0.55;
  const fwdX = clubX + arcR * 0.9;
  const fwdY = clubY - arcR * (0.08 + you * 0.018);
  const c1x = clubX - arcR * 0.3;
  const c1y = clubY + Math.sin(rad) * arcR * 0.3 - 8;
  const c2x = clubX + arcR * 0.4;
  const c2y = clubY - Math.sin(rad) * arcR * 0.25;

  ctx.strokeStyle = ac;
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(backX, backY);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, fwdX, fwdY);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(backX, backY);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, fwdX, fwdY);
  ctx.stroke();
  drawArrowPremium(ctx, fwdX, fwdY, Math.atan2(fwdY - c2y, fwdX - c2x), ac, 8);

  const ir = ideal * Math.PI / 180;
  ctx.strokeStyle = '#00d68f';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(backX, backY);
  ctx.bezierCurveTo(c1x, clubY + Math.sin(ir) * arcR * 0.3 - 8, c2x, clubY - Math.sin(ir) * arcR * 0.25, fwdX, clubY - arcR * (0.08 + ideal * 0.018));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const crot = isDriver ? (-0.12 - rad * 0.10) : (-rad + (you < 0 ? 0.12 : -0.12));
  if (isDriver) {
    ctx.save();
    ctx.translate(clubX, clubY);
    ctx.rotate(crot);
    const dg = ctx.createLinearGradient(-10, -12, 20, 12);
    dg.addColorStop(0, '#2a3038');
    dg.addColorStop(0.5, '#343c44');
    dg.addColorStop(1, '#252c34');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.roundRect(-10, -12, 30, 24, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(-10, -12, 30, 24, 8);
    ctx.stroke();
    ctx.shadowColor = ac;
    ctx.shadowBlur = 12;
    ctx.fillStyle = ac;
    ctx.beginPath();
    ctx.roundRect(14, -12, 6, 24, [0, 4, 4, 0]);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(clubX, clubY);
    ctx.rotate(crot);
    const ig = ctx.createLinearGradient(-6, -8, 16, 8);
    ig.addColorStop(0, '#7a838b');
    ig.addColorStop(0.3, '#a0a8b0');
    ig.addColorStop(0.6, '#8a9199');
    ig.addColorStop(1, '#5c656d');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.roundRect(-5, -8, 20, 16, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.roundRect(-5, -8, 20, 16, 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) {
      const ly = -5 + i * 3.2;
      ctx.beginPath();
      ctx.moveTo(-3, ly);
      ctx.lineTo(12, ly);
      ctx.stroke();
    }
    ctx.shadowColor = ac;
    ctx.shadowBlur = 10;
    ctx.fillStyle = ac;
    ctx.beginPath();
    ctx.roundRect(11, -8, 4, 16, [0, 2, 2, 0]);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawBallPremium(ctx, bx, by, 8);

  if (you < -2 && !isDriver) {
    const dx = bx + 22;
    ctx.fillStyle = 'rgba(58,32,8,0.7)';
    ctx.beginPath();
    ctx.ellipse(dx, gy + 5, 22, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,56,24,0.6)';
    ctx.beginPath();
    ctx.ellipse(dx, gy + 4, 13, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,56,24,0.5)';
    [[dx + 8, gy - 2, 2], [dx + 14, gy - 5, 1.5], [dx + 4, gy - 7, 1.2], [dx - 6, gy - 3, 1.8], [dx + 10, gy - 9, 1]].forEach(([px, py, pr]) => {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
    drawPill(ctx, dx, gy + 20, 'DIVOT ✓', '#00d68f', 'center');
  }

  ctx.fillStyle = ac;
  ctx.font = "700 28px 'Barlow Condensed',sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText((you > 0 ? '+' : '') + Math.round(you * 10) / 10 + '°', 14, 38);
  ctx.font = "500 10px 'DM Mono',monospace";
  ctx.fillStyle = '#3a4550';
  ctx.fillText('ATTACK ANGLE', 14, 52);
  ctx.fillStyle = '#00d68f';
  ctx.globalAlpha = 0.6;
  ctx.fillText('IDEAL ' + (ideal > 0 ? '+' : '') + Math.round(ideal * 10) / 10 + '°', 14, 66);
  ctx.globalAlpha = 1;
  ctx.font = "500 8px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'center';
  ctx.fillText('IMPACT', bx, gy + 18);

  const el = document.getElementById(did);
  if (el) {
    const diff = Math.abs(you - ideal);
    let msg;
    if (diff < 1) msg = 'On target!';
    else if (you > -2 && !isDriver) msg = 'Too level — scooping. Push toward negative.';
    else if (you > 4 && isDriver) msg = 'Very upward — check tee height and ball position.';
    else msg = 'Getting there — keep pushing toward target.';
    const posLabel = isDriver ? 'Ball forward off lead heel' : 'Ball centered in stance';
    el.innerHTML = `<b style="color:${ac}">${you > 0 ? '+' : ''}${Math.round(you * 10) / 10}°</b> attack &nbsp;·&nbsp; <b style="color:#00d68f">target ${ideal > 0 ? '+' : ''}${Math.round(ideal * 10) / 10}°</b><br>${msg}<br><span style="color:#4e5660;font-size:11px">${posLabel}</span>`;
  }
}

function drawVizs() {
  const ids = [
    ['c-face', 'd-face'],
    ['c-path', 'd-path'],
    ['c-attack', 'd-attack'],
  ];

  ids.forEach(([cid]) => {
    const c = document.getElementById(cid);
    if (c) {
      const h = cid === 'c-face' ? 220 : 280;
      c.height = h;
      c.style.height = h + 'px';
    }
  });

  triggerFace('c-face', 'd-face');
  triggerPath('c-path', 'd-path');
  triggerAttack('c-attack', 'd-attack');
}
