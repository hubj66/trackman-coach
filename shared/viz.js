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

// viz.js — canvas drawings, theme-aware

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
  if (document.body.classList.contains('light-theme')) {
    return {
      bg:           '#e0dbd2',
      surface:      '#f5f2ed',
      s2:           '#ede8e1',
      s3:           '#e3ddd6',
      text:         '#1a1916',
      text2:        '#2e3828',
      text3:        '#7a7770',
      border:       'rgba(0,0,0,0.1)',
      green:        '#007a45',
      amber:        '#b07000',
      red:          '#c02020',
      stripe1:      '#3a6030',
      stripe2:      '#2e5228',
      fwStripe1:    '#4a7838',
      fwStripe2:    '#3c6830',
      sky1:         '#4a88be',
      sky2:         '#80b8e0',
      targetLine:   'rgba(0,0,0,0.18)',
      labelSub:     'rgba(0,0,0,0.45)',
      labelFaint:   'rgba(0,0,0,0.28)',
      golferStroke: 'rgba(0,0,0,0.55)',
      golferFill:   'rgba(0,0,0,0.22)',
      groundGuide:  'rgba(0,0,0,0.15)',
    };
  }
  return {
    bg:           '#0e1012',
    surface:      '#161819',
    s2:           '#1d2023',
    s3:           '#252a2d',
    text:         '#f0ede8',
    text2:        '#8a9099',
    text3:        '#3e4650',
    border:       'rgba(255,255,255,0.07)',
    green:        '#00d68f',
    amber:        '#ffaa00',
    red:          '#ff4d4d',
    stripe1:      '#1b3020',
    stripe2:      '#152618',
    fwStripe1:    '#1f3822',
    fwStripe2:    '#19301a',
    sky1:         '#050a10',
    sky2:         '#0c1620',
    targetLine:   'rgba(255,255,255,0.1)',
    labelSub:     'rgba(255,255,255,0.2)',
    labelFaint:   'rgba(255,255,255,0.12)',
    golferStroke: 'rgba(255,255,255,0.25)',
    golferFill:   'rgba(255,255,255,0.11)',
    groundGuide:  'rgba(255,255,255,0.14)',
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

// ── Background helpers ─────────────────────────────────────────────────────

function drawGrassFullBg(ctx, w, h) {
  const t = T();
  for (let i = 0; i * 22 < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(i * 22, 0, 22, h);
  }
}

function drawFairwayStrip(ctx, cx, w, h) {
  const t = T();
  const fw = 108, fx = cx - fw / 2;
  for (let i = 0; i * 20 < fw; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.fwStripe1 : t.fwStripe2;
    ctx.fillRect(fx + i * 20, 0, 20, h);
  }
  ctx.strokeStyle = 'rgba(42,74,42,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx + fw, 0); ctx.lineTo(fx + fw, h); ctx.stroke();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w/2, h/2, w * 0.25, w/2, h/2, w * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSkyGround(ctx, w, h, groundRatio) {
  const t = T();
  const gy = h * groundRatio;
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, t.sky1);
  sky.addColorStop(1, t.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, gy);

  for (let i = 0; i * 22 < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? t.stripe1 : t.stripe2;
    ctx.fillRect(i * 22, gy, 22, h - gy);
  }

  ctx.strokeStyle = '#2a5a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();

  const gs = ctx.createLinearGradient(0, gy, 0, gy + 20);
  gs.addColorStop(0, 'rgba(0,0,0,0.3)');
  gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, gy, w, 20);
}

function drawFlag(ctx, x, y) {
  ctx.fillStyle = '#b89828'; ctx.fillRect(x - 0.75, y, 1.5, 28);
  ctx.fillStyle = '#8a7218'; ctx.fillRect(x + 0.25, y, 0.5, 28);
  ctx.fillStyle = '#e83030';
  ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 16, y + 7); ctx.lineTo(x + 1, y + 14); ctx.fill();
  ctx.fillStyle = '#c42828';
  ctx.beginPath(); ctx.moveTo(x + 1, y + 7); ctx.lineTo(x + 16, y + 7); ctx.lineTo(x + 1, y + 14); ctx.fill();
}

function drawBallPremium(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.6, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#f4f4f2'); g.addColorStop(0.75, '#d8d8d4'); g.addColorStop(1, '#b8b8b4');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.25, r * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawBall(ctx, x, y, r) {
  drawBallPremium(ctx, x, y, r);
}

function drawArrowHead(ctx, ex, ey, angle, color, size) {
  ctx.fillStyle = color; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.45); ctx.lineTo(-size * 0.7, 0); ctx.lineTo(-size, size * 0.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPill(ctx, x, y, text, color, align) {
  ctx.font = "700 10px 'Barlow Condensed', sans-serif";
  const tw = ctx.measureText(text).width;
  const pw = tw + 14, ph = 20, pr = 4;
  let px = align === 'left' ? x : align === 'right' ? x - pw : x - pw / 2;
  ctx.fillStyle = 'rgba(14,16,18,0.7)';
  ctx.beginPath(); ctx.roundRect(px, y - ph / 2, pw, ph, pr); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.roundRect(px, y - ph / 2, pw, ph, pr); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left';
  ctx.fillText(text, px + 7, y + 3.5);
}

// ── Top-down clubhead renderers (face angle viz) ───────────────────────────

function drawDriverHeadTopDown(ctx, x, y, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#111417';
  ctx.beginPath(); ctx.moveTo(-19, -6); ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23); ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6); ctx.closePath(); ctx.fill();
  const cg = ctx.createRadialGradient(2, 8, 1, 0, 10, 30);
  cg.addColorStop(0, 'rgba(55,62,70,0.2)'); cg.addColorStop(0.5, 'rgba(35,40,48,0.08)'); cg.addColorStop(1, 'rgba(15,18,22,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(-19, -6); ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23); ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-19, -6); ctx.quadraticCurveTo(0, -10, 19, -6);
  ctx.bezierCurveTo(27, -2, 29, 11, 21, 23); ctx.quadraticCurveTo(0, 31, -21, 23);
  ctx.bezierCurveTo(-29, 11, -27, -2, -19, -6); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 7); ctx.stroke();
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(-19, -6); ctx.quadraticCurveTo(0, -10, 19, -6); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.moveTo(-18, -5); ctx.quadraticCurveTo(0, -9, 18, -5);
  ctx.quadraticCurveTo(0, -1, -18, -5); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a4248'; ctx.beginPath(); ctx.arc(-17, 1, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawIronHeadTopDown(ctx, x, y, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const S = 1.4;
  const mg = ctx.createLinearGradient(-20*S, -6*S, 22*S, 10*S);
  mg.addColorStop(0, '#8a9199'); mg.addColorStop(0.2, '#6b747c'); mg.addColorStop(0.45, '#a0a8b0');
  mg.addColorStop(0.55, '#7a838b'); mg.addColorStop(0.8, '#5c656d'); mg.addColorStop(1, '#4a535b');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(-18*S, -5*S); ctx.lineTo(18*S, -5*S);
  ctx.quadraticCurveTo(22*S, -3*S, 22*S, 2*S); ctx.quadraticCurveTo(22*S, 8*S, 18*S, 10*S);
  ctx.quadraticCurveTo(0, 14*S, -16*S, 10*S); ctx.quadraticCurveTo(-20*S, 8*S, -20*S, 2*S);
  ctx.quadraticCurveTo(-20*S, -3*S, -18*S, -5*S); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-18*S, -5*S); ctx.lineTo(18*S, -5*S);
  ctx.quadraticCurveTo(22*S, -3*S, 22*S, 2*S); ctx.quadraticCurveTo(22*S, 8*S, 18*S, 10*S);
  ctx.quadraticCurveTo(0, 14*S, -16*S, 10*S); ctx.quadraticCurveTo(-20*S, 8*S, -20*S, 2*S);
  ctx.quadraticCurveTo(-20*S, -3*S, -18*S, -5*S); ctx.closePath(); ctx.stroke();
  ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.moveTo(-18*S, -5*S); ctx.lineTo(18*S, -5*S); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.globalAlpha = 0.14; ctx.fillRect(-17*S, -5*S, 34*S, 4*S); ctx.globalAlpha = 1;
  const hg = ctx.createRadialGradient(-17*S, 3*S, 1, -17*S, 3*S, 5);
  hg.addColorStop(0, '#8a9199'); hg.addColorStop(1, '#4a535b');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(-17*S, 3*S, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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

// ── Viz builder triggers ───────────────────────────────────────────────────

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

// ════════════════════════════════════════════════════════════════════════════
// FACE ANGLE — top-down, realistic clubheads, all grass
// ════════════════════════════════════════════════════════════════════════════

function drawFaceBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 200);
  if (!r) return;
  const { ctx, w, h } = r;
  const t = T();
  const fc = kpiColor('face', you);
  const isDriver = club === 'driver';

  drawGrassFullBg(ctx, w, h);
  drawFairwayStrip(ctx, w / 2, w, h);
  drawVignette(ctx, w, h);

  const cx = w / 2, ballY = h * 0.46, clubY = h * 0.64;

  // Target line
  ctx.strokeStyle = t.targetLine; ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(cx, ballY - 14); ctx.stroke();
  ctx.setLineDash([]);

  drawFlag(ctx, cx, 18);
  ctx.fillStyle = t.labelSub;
  ctx.font = "500 8px 'DM Mono', monospace"; ctx.textAlign = 'center';
  ctx.fillText('TARGET', cx, 15);

  // Ghost clubhead (ideal)
  ctx.globalAlpha = 0.12;
  if (isDriver) drawDriverHeadTopDown(ctx, cx, clubY, 0, t.green);
  else drawIronHeadTopDown(ctx, cx, clubY, 0, t.green);
  ctx.globalAlpha = 1;

  // Your clubhead
  const fRad = you * Math.PI / 180;
  if (isDriver) drawDriverHeadTopDown(ctx, cx, clubY, fRad, fc);
  else drawIronHeadTopDown(ctx, cx, clubY, fRad, fc);

  // Ball
  drawBall(ctx, cx, ballY, 8);

  // Ball flight trail
  const fLen = 65, fRad2 = fRad * 0.88;
  const fEndX = cx + Math.sin(fRad2) * fLen;
  const fEndY = ballY - Math.cos(fRad2) * fLen;

  ctx.strokeStyle = fc; ctx.lineWidth = 6; ctx.globalAlpha = 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, ballY - 9); ctx.lineTo(fEndX, fEndY); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, ballY - 9); ctx.lineTo(fEndX, fEndY); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  for (let i = 1; i <= 6; i++) {
    const tt = i / 7;
    ctx.fillStyle = fc; ctx.globalAlpha = tt * 0.5;
    ctx.beginPath(); ctx.arc(cx + Math.sin(fRad2) * fLen * tt, ballY - Math.cos(fRad2) * fLen * tt, 1.5 + tt * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawArrowHead(ctx, fEndX, fEndY, Math.atan2(fEndY - (ballY - 9), fEndX - cx), fc, 8);

  // Angle arc
  if (Math.abs(you) > 1) {
    ctx.strokeStyle = fc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(cx, ballY, 34, -Math.PI / 2, fRad - Math.PI / 2, you < 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Labels
  drawPill(ctx, cx + (you >= 0 ? 44 : -44), ballY - 10,
    'YOU ' + (you > 0 ? '+' : '') + Math.round(you) + '°', fc, you >= 0 ? 'left' : 'right');
  drawPill(ctx, cx + (you >= 0 ? -40 : 40), clubY + 28,
    'TARGET ~' + ideal + '°', t.green, you >= 0 ? 'right' : 'left');

  if (!updateDesc) return;
  const el = document.getElementById(did);
  if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Your face: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal}°</b><br>${diff < 1 ? 'On target!' : diff < 4 ? 'Close — small adjustment needed.' : `Off by ${diff.toFixed(0)}° — ${you > ideal ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
}

// ════════════════════════════════════════════════════════════════════════════
// CLUB PATH — top-down, curved swing arc, curvature flips with path
// ════════════════════════════════════════════════════════════════════════════

function drawPathBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 200);
  if (!r) return;
  const { ctx, w, h } = r;
  const t = T();
  const pc = kpiColor('path', you);

  drawGrassFullBg(ctx, w, h);
  drawFairwayStrip(ctx, w / 2, w, h);
  drawVignette(ctx, w, h);

  const cx = w / 2, ballY = h * 0.50;

  // Target line
  ctx.strokeStyle = t.targetLine; ctx.lineWidth = 1;
  ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.moveTo(cx, 14); ctx.lineTo(cx, h - 14); ctx.stroke();
  ctx.setLineDash([]);

  drawFlag(ctx, cx, 14);
  ctx.font = "500 8px 'DM Mono', monospace"; ctx.fillStyle = t.labelSub;
  ctx.textAlign = 'left'; ctx.fillText('OUTSIDE', cx + 8, 48);
  ctx.textAlign = 'right'; ctx.fillText('INSIDE', cx - 8, 48);

  const pRad = you * Math.PI / 180;
  const arcLen = h * 0.36;
  const latSpread = Math.tan(pRad) * arcLen;
  const entryX = cx + latSpread * 0.7, entryY = ballY + arcLen;
  const exitX = cx - latSpread * 0.7, exitY = ballY - arcLen;

  // Arc bow: negative path → bow RIGHT, positive → bow LEFT
  const totalBow = -6 + (-you * 2.4);
  const cp1x = cx + latSpread * 0.25 + totalBow, cp1y = ballY + arcLen * 0.45;
  const cp2x = cx - latSpread * 0.25 + totalBow, cp2y = ballY - arcLen * 0.45;

  const N = 80;
  function bez(eX, eY, c1x, c1y, c2x, c2y, xX, xY) {
    const p = [];
    for (let i = 0; i <= N; i++) {
      const t2 = i / N, m = 1 - t2;
      p.push({ x: m*m*m*eX + 3*m*m*t2*c1x + 3*m*t2*t2*c2x + t2*t2*t2*xX,
               y: m*m*m*eY + 3*m*m*t2*c1y + 3*m*t2*t2*c2y + t2*t2*t2*xY });
    }
    return p;
  }

  const pts = bez(entryX, entryY, cp1x, cp1y, cp2x, cp2y, exitX, exitY);
  const ib = -6;
  const ipts = bez(cx, ballY + arcLen, cx + ib, ballY + arcLen * 0.45, cx + ib, ballY - arcLen * 0.45, cx, ballY - arcLen);

  let ii = 0, md = 1e9;
  for (let i = 0; i < pts.length; i++) {
    const dd = Math.hypot(pts[i].x - cx, pts[i].y - ballY);
    if (dd < md) { md = dd; ii = i; }
  }

  // Ideal ghost
  ctx.strokeStyle = t.green; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.2;
  ctx.setLineDash([5, 4]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ipts[0].x, ipts[0].y);
  for (let i = 1; i < ipts.length; i++) ctx.lineTo(ipts[i].x, ipts[i].y);
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;

  // Your arc — glow
  ctx.strokeStyle = pc; ctx.lineWidth = 8; ctx.globalAlpha = 0.04; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke(); ctx.globalAlpha = 1;

  // Pre-impact
  ctx.strokeStyle = pc; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= ii; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Post-impact
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pts[ii].x, pts[ii].y);
  for (let i = ii + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Arrow
  const lp = pts[pts.length - 1], pp = pts[pts.length - 3];
  drawArrowHead(ctx, lp.x, lp.y, Math.atan2(lp.y - pp.y, lp.x - pp.x), pc, 7);

  // Speed dots
  for (let i = 5; i < pts.length - 5; i += 6) {
    const tt = i / pts.length;
    ctx.fillStyle = pc; ctx.globalAlpha = 0.1 + tt * 0.35;
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 0.8 + tt * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawBall(ctx, cx, ballY, 8);

  // Angle annotation
  if (Math.abs(you) > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(cx, ballY + 20); ctx.lineTo(cx, ballY - 20); ctx.stroke();
    ctx.strokeStyle = pc; ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(cx, ballY, 18, -Math.PI / 2, -Math.PI / 2 + pRad, you < 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Labels
  const li = Math.round(pts.length * 0.8);
  drawPill(ctx, pts[li].x + (pts[li].x > cx ? 10 : -10), pts[li].y - 2,
    'YOU ' + (you > 0 ? '+' : '') + Math.round(you) + '°', pc, pts[li].x > cx ? 'left' : 'right');
  const ili = Math.round(ipts.length * 0.8);
  drawPill(ctx, ipts[ili].x - 30, ipts[ili].y, 'TARGET ' + ideal + '°', t.green, 'right');

  ctx.font = "500 7px 'DM Mono', monospace"; ctx.fillStyle = t.labelFaint; ctx.textAlign = 'center';
  ctx.fillText('BACKSWING', pts[2].x, pts[2].y + 12);
  ctx.fillText('FOLLOW-THROUGH', lp.x, lp.y - 12);

  if (!updateDesc) return;
  const el = document.getElementById(did);
  if (!el) return;
  const inp = getAllInputs(club).find(i => i.id === 'path');
  const idealRange = typeof getIdealRange === 'function' ? getIdealRange(inp) : inp.ideal;
  const diff = Math.abs(you);
  let desc;
  if (diff < 2) desc = 'Neutral path — club moving along the target line.';
  else if (you < -4) desc = 'Out-to-in — club comes from outside, exits inside. Classic slice path.';
  else if (you < 0) desc = 'Slightly out-to-in — mild fade path.';
  else if (you > 4) desc = 'Very in-to-out — club comes from inside, exits outside. Hook risk.';
  else desc = 'Slightly in-to-out — mild draw path.';
  el.innerHTML = `<b style="color:${pc}">Your path: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;&nbsp;<b style="color:${t.green}">Target: ~${ideal > 0 ? '+' : ''}${ideal}°</b><br>${desc}`;
}

// ════════════════════════════════════════════════════════════════════════════
// ATTACK ANGLE — original viz.js figure, clubhead LEFT of ball, ball pos varies
// ════════════════════════════════════════════════════════════════════════════

function drawAttackBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 240);
  if (!r) return;
  const { ctx, w, h } = r;
  const ac = kpiColor('attack', you);
  const isDriver = club === 'driver';
  const t = T();

  const gy = h * 0.67;
  drawSkyGround(ctx, w, h, gy / h);
  drawVignette(ctx, w, h);

  // Ball position: driver forward, iron/wedge center
  const stanceAnchor = w * 0.50;
  const bx = isDriver ? (stanceAnchor + 24) : stanceAnchor;
  const by = gy - 11;

  // Clubhead on LEFT of ball
  const clubX = bx - 22;
  const clubY = gy - 4;

  // Tee
  if (isDriver) {
    ctx.fillStyle = '#c8963a';
    ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by);
    ctx.lineTo(bx + 2.5, by + 18); ctx.lineTo(bx - 2.5, by + 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8b050';
    ctx.beginPath(); ctx.ellipse(bx, by, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Ground guide
  ctx.strokeStyle = t.groundGuide; ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(bx - 70, gy + 2); ctx.lineTo(bx + 50, gy + 2); ctx.stroke();
  ctx.setLineDash([]);

  // ── Original viz.js golfer figure ──
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

  ctx.save();
  ctx.strokeStyle = t.golferStroke;
  ctx.fillStyle = t.golferFill;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Head (bigger)
  ctx.beginPath(); ctx.arc(headX, headY, 10.5, 0, Math.PI * 2); ctx.fill();
  // Neck
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(neckX, neckY); ctx.lineTo(shoulderX, shoulderY); ctx.stroke();
  // Shoulders
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(shoulderLeftX, shoulderLeftY); ctx.lineTo(shoulderRightX, shoulderRightY); ctx.stroke();
  // Torso
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY); ctx.quadraticCurveTo(hipX - 2, gy - 76, hipX, hipY); ctx.stroke();
  // Front leg
  ctx.lineWidth = 5.8;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(rightKneeX, rightKneeY); ctx.lineTo(rightFootX, rightFootY); ctx.stroke();
  // Back leg
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(leftKneeX, leftKneeY); ctx.lineTo(leftFootX, leftFootY); ctx.stroke();
  // Lead arm
  ctx.lineWidth = 4.6;
  ctx.beginPath(); ctx.moveTo(shoulderRightX, shoulderRightY); ctx.lineTo(handsX, handsY); ctx.stroke();
  // Trail arm
  ctx.beginPath(); ctx.moveTo(shoulderLeftX, shoulderLeftY);
  ctx.quadraticCurveTo(shoulderX - 2, gy - 95, handsX + 3, handsY + 1); ctx.stroke();
  ctx.restore();

  // Golfer shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(hipX, gy + 4, 36, 5, 0, 0, Math.PI * 2); ctx.fill();

  // Shaft — hands to clubhead
  ctx.strokeStyle = 'rgba(255,255,255,0.34)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(handsX, handsY); ctx.lineTo(clubX + 10, clubY - 4); ctx.stroke();

  // ── Swing arc ──
  const rad = you * Math.PI / 180;
  const arcR = w * 0.38;
  const backX = clubX - arcR * 0.7, backY = clubY - arcR * 0.55;
  const fwdX = clubX + arcR * 0.9, fwdY = clubY - arcR * (0.08 + you * 0.018);
  const c1x = clubX - arcR * 0.3, c1y = clubY + Math.sin(rad) * arcR * 0.3 - 8;
  const c2x = clubX + arcR * 0.4, c2y = clubY - Math.sin(rad) * arcR * 0.25;

  // Glow
  ctx.strokeStyle = ac; ctx.lineWidth = 10; ctx.globalAlpha = 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(backX, backY); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, fwdX, fwdY); ctx.stroke();
  // Main
  ctx.lineWidth = 2.5; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(backX, backY); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, fwdX, fwdY); ctx.stroke();
  drawArrowHead(ctx, fwdX, fwdY, Math.atan2(fwdY - c2y, fwdX - c2x), ac, 8);

  // Ideal ghost
  const ir = ideal * Math.PI / 180;
  ctx.strokeStyle = t.green; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(backX, backY);
  ctx.bezierCurveTo(c1x, clubY + Math.sin(ir) * arcR * 0.3 - 8, c2x, clubY - Math.sin(ir) * arcR * 0.25, fwdX, clubY - arcR * (0.08 + ideal * 0.018));
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;

  // ── Clubhead — LEFT of ball, face RIGHT ──
  const crot = isDriver ? (-0.12 - rad * 0.10) : (-rad + (you < 0 ? 0.12 : -0.12));
  if (isDriver) {
    ctx.save(); ctx.translate(clubX, clubY); ctx.rotate(crot);
    const dg = ctx.createLinearGradient(-10, -12, 20, 12);
    dg.addColorStop(0, '#2a3038'); dg.addColorStop(0.5, '#343c44'); dg.addColorStop(1, '#252c34');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.roundRect(-10, -12, 30, 24, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.roundRect(-10, -12, 30, 24, 8); ctx.stroke();
    ctx.shadowColor = ac; ctx.shadowBlur = 12; ctx.fillStyle = ac;
    ctx.beginPath(); ctx.roundRect(14, -12, 6, 24, [0, 4, 4, 0]); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(clubX, clubY); ctx.rotate(crot);
    const ig = ctx.createLinearGradient(-6, -8, 16, 8);
    ig.addColorStop(0, '#7a838b'); ig.addColorStop(0.3, '#a0a8b0'); ig.addColorStop(0.6, '#8a9199'); ig.addColorStop(1, '#5c656d');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.roundRect(-5, -8, 20, 16, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.roundRect(-5, -8, 20, 16, 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) { const ly = -5 + i * 3.2; ctx.beginPath(); ctx.moveTo(-3, ly); ctx.lineTo(12, ly); ctx.stroke(); }
    ctx.shadowColor = ac; ctx.shadowBlur = 10; ctx.fillStyle = ac;
    ctx.beginPath(); ctx.roundRect(11, -8, 4, 16, [0, 2, 2, 0]); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Ball on top
  drawBall(ctx, bx, by, 8);

  // Divot (after ball, to the right)
  if (you < -2 && !isDriver) {
    const dx = bx + 22;
    ctx.fillStyle = 'rgba(58,32,8,0.7)';
    ctx.beginPath(); ctx.ellipse(dx, gy + 5, 22, 6, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,56,24,0.6)';
    ctx.beginPath(); ctx.ellipse(dx, gy + 4, 13, 4, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,56,24,0.5)';
    [[dx+8,gy-2,2],[dx+14,gy-5,1.5],[dx+4,gy-7,1.2],[dx-6,gy-3,1.8],[dx+10,gy-9,1]].forEach(([px,py,pr]) => {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    });
    drawPill(ctx, dx, gy + 20, 'DIVOT ✓', t.green, 'center');
  }

  // Labels
  ctx.fillStyle = ac; ctx.font = "700 28px 'Barlow Condensed', sans-serif"; ctx.textAlign = 'left';
  ctx.fillText((you > 0 ? '+' : '') + Math.round(you) + '°', 14, 38);
  ctx.font = "500 10px 'DM Mono', monospace"; ctx.fillStyle = t.text2;
  ctx.fillText('ATTACK ANGLE', 14, 52);
  ctx.fillStyle = t.green; ctx.globalAlpha = 0.6;
  ctx.fillText('IDEAL ' + (ideal > 0 ? '+' : '') + ideal + '°', 14, 66);
  ctx.globalAlpha = 1;

  ctx.font = "500 8px 'DM Mono', monospace"; ctx.fillStyle = t.labelSub; ctx.textAlign = 'center';
  ctx.fillText('IMPACT', bx, gy + 18);

  if (!updateDesc) return;
  const el = document.getElementById(did);
  if (!el) return;
  const diff = Math.abs(you - ideal);
  let msg;
  if (diff < 1) msg = 'On target!';
  else if (you > -2 && !isDriver) msg = 'Too level — scooping. Push toward negative.';
  else if (you > 4 && isDriver) msg = 'Very upward — check tee height and ball position.';
  else msg = 'Getting there — keep pushing toward target.';
  const posLabel = isDriver ? 'Ball forward off lead heel' : 'Ball centered in stance';
  el.innerHTML = `<b style="color:${ac}">${you > 0 ? '+' : ''}${Math.round(you)}°</b> attack &nbsp;·&nbsp; <b style="color:${t.green}">target ${ideal > 0 ? '+' : ''}${ideal}°</b><br>${msg}<br><span style="color:#4e5660;font-size:11px">${posLabel}</span>`;
}

// ── Replacement drawVizs with embedded sliders ─────────────────────────────
function drawVizs() {
  const C = CLUBS[club];
  const allInps = getAllInputs(club);
  const panels = [];

  if (C.primary.find(i => i.id === 'face')) {
    panels.push({
      id: 'vface', did: 'vdface', sid: 'face',
      title: 'Face angle<span>TOP VIEW</span>',
      fn: () => triggerFace('vface', 'vdface')
    });
  }

  if (C.primary.find(i => i.id === 'path')) {
    panels.push({
      id: 'vpath', did: 'vdpath', sid: 'path',
      title: 'Club path<span>TOP VIEW</span>',
      fn: () => triggerPath('vpath', 'vdpath')
    });
  }

  if (C.primary.find(i => i.id === 'attack')) {
    panels.push({
      id: 'vattack', did: 'vdattack', sid: 'attack',
      title: 'Attack angle<span>SIDE VIEW</span>',
      fn: () => triggerAttack('vattack', 'vdattack')
    });
  }

  document.getElementById('vgrid').innerHTML = panels.map(p => {
    const inp = allInps.find(i => i.id === p.sid);
    const v = (vals[club] && vals[club][p.sid] !== undefined)
      ? vals[club][p.sid]
      : (inp ? inp.def : 0);
    const sliderHTML = inp ? buildSlider(inp, v, 'viz-') : '';

    return `<div class="vc-wrap">
      <div class="vc-header"><span class="vc-title">${p.title}</span></div>
      <canvas class="cv" id="${p.id}" height="200"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
      <div class="viz-slider">${sliderHTML}</div>
    </div>`;
  }).join('');

  requestAnimationFrame(() => requestAnimationFrame(() => panels.forEach(p => p.fn())));
}
