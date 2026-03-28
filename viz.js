// viz.js — canvas drawing with golf green texture, animated ball flight, smooth transitions

function dk() { return matchMedia('(prefers-color-scheme: dark)').matches; }

function sc(id, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const w = c.parentElement.clientWidth - 24;
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

// ── Golf green stripe texture ──────────────────────────────────────────────

function drawGreenTexture(ctx, x, y, w, h, dark) {
  ctx.fillStyle = dark ? '#1a2a18' : '#b8dea0';
  ctx.fillRect(x, y, w, h);
  const sw = 18;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0
      ? (dark ? '#1e3020' : '#c2e4a8')
      : (dark ? '#162416' : '#aed898');
    ctx.fillRect(x + i * sw, y, sw, h);
  }
}

function drawFairwayStripe(ctx, x, y, w, h, dark) {
  ctx.fillStyle = dark ? '#223a20' : '#8fcc70';
  ctx.fillRect(x, y, w, h);
  const sw = 14;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0
      ? (dark ? '#264422' : '#98d47a')
      : (dark ? '#1e3620' : '#88c468');
    ctx.fillRect(x + i * sw, y, sw, h);
  }
}

// ── Sky gradient ───────────────────────────────────────────────────────────

function drawSky(ctx, w, h, dark) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (dark) {
    grad.addColorStop(0, '#0d1a2e');
    grad.addColorStop(1, '#1a2a3a');
  } else {
    grad.addColorStop(0, '#c8e8ff');
    grad.addColorStop(1, '#e8f4ff');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── Animation engine ───────────────────────────────────────────────────────

const animState = {};
const prevAngles = {};

function animateDraw(canvasId, fromVal, toVal, drawFn) {
  if (animState[canvasId]) cancelAnimationFrame(animState[canvasId]);
  const start = performance.now();
  const duration = 300;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const current = fromVal + (toVal - fromVal) * ease;
    drawFn(current, t >= 1);
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
    panels.push({ id: 'vface', did: 'vdface', title: 'Face angle — top view', fn: () => triggerFace('vface', 'vdface') });
  if (C.inputs.find(i => i.id === 'path'))
    panels.push({ id: 'vpath', did: 'vdpath', title: 'Club path — top view', fn: () => triggerPath('vpath', 'vdpath') });
  if (C.inputs.find(i => i.id === 'attack'))
    panels.push({ id: 'vattack', did: 'vdattack', title: 'Attack angle — side view', fn: () => triggerAttack('vattack', 'vdattack') });

  document.getElementById('vgrid').innerHTML = panels.map(p => `
    <div class="vc-wrap">
      <div class="vc-title">${p.title}</div>
      <canvas class="cv" id="${p.id}" height="190"></canvas>
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
  const r = sc(cid, 190); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  drawSky(ctx, w, h * 0.58, d);
  drawGreenTexture(ctx, 0, h * 0.58, w, h * 0.42, d);
  drawFairwayStripe(ctx, w / 2 - 48, 0, 96, h, d);

  const cx = w / 2, cy = h * 0.64;

  // Target line
  ctx.strokeStyle = d ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.13)';
  ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, 18); ctx.lineTo(cx, cy - 20); ctx.stroke(); ctx.setLineDash([]);

  // Flag
  ctx.fillStyle = d ? '#d4aa33' : '#8a6a00'; ctx.fillRect(cx - 1, 18, 2, 22);
  ctx.fillStyle = '#e24b4a';
  ctx.beginPath(); ctx.moveTo(cx + 1, 18); ctx.lineTo(cx + 15, 26); ctx.lineTo(cx + 1, 34); ctx.fill();
  ctx.fillStyle = d ? '#ccc' : '#333'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('target', cx, 14);

  // Clubhead shadow
  ctx.save(); ctx.translate(cx, cy + 3); ctx.rotate(you * Math.PI / 180);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Ideal face ghost
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ideal * Math.PI / 180); ctx.globalAlpha = .26;
  ctx.fillStyle = '#1D9E75';
  ctx.beginPath(); ctx.roundRect(-32, -10, 64, 20, 4); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // Your clubface
  const frad = you * Math.PI / 180;
  const fc = Math.abs(you) <= 3 ? '#1D9E75' : Math.abs(you) <= 7 ? '#EF9F27' : '#e24b4a';
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(frad);
  ctx.fillStyle = d ? '#4a4a48' : '#888884';
  ctx.beginPath(); ctx.roundRect(-32, -10, 64, 20, 4); ctx.fill();
  ctx.fillStyle = fc; ctx.fillRect(-32, -10, 64, 5);
  ctx.strokeStyle = fc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-32, -10); ctx.lineTo(32, -10); ctx.stroke();
  ctx.restore();

  // Ball
  const bg = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 9);
  bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#ddd');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();

  // Ball flight trail + arrow
  const bd = frad * 0.88, bl = 72;
  const bx = cx + Math.sin(bd) * bl, by = cy - Math.cos(bd) * bl;
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    ctx.fillStyle = fc; ctx.globalAlpha = t * 0.35;
    ctx.beginPath(); ctx.arc(cx + Math.sin(bd) * bl * t, cy - Math.cos(bd) * bl * t, 3 * t, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = fc; ctx.lineWidth = 2.5; ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  const aa = Math.atan2(by - (cy - 10), bx - cx);
  ctx.fillStyle = fc; ctx.save(); ctx.translate(bx, by); ctx.rotate(aa);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, -5); ctx.lineTo(-11, 5); ctx.closePath(); ctx.fill(); ctx.restore();

  // Labels
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = fc;
  ctx.fillText('you ' + (you > 0 ? '+' : '') + Math.round(you) + '°', cx + (you >= 0 ? 30 : -30), cy + (you >= 0 ? -22 : 22));
  ctx.fillStyle = d ? 'rgba(80,220,140,.9)' : 'rgba(0,100,50,.8)';
  ctx.fillText('target ~' + ideal + '°', cx + (ideal >= 0 ? -28 : 28), cy + (ideal >= 0 ? 22 : -22));

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Your face: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;·&nbsp;<b style="color:#1D9E75">Target: ~${ideal}°</b><br>${diff < 1 ? 'On target!' : diff < 4 ? 'Close — small adjustment needed.' : `Off by ${diff.toFixed(0)}° — ${you > ideal ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
}

// ── Club path ──────────────────────────────────────────────────────────────

function drawPathBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 190); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  drawGreenTexture(ctx, 0, 0, w, h, d);
  drawFairwayStripe(ctx, w / 2 - 52, 0, 104, h, d);

  const cx = w / 2, cy = h * 0.52;

  ctx.strokeStyle = d ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.13)';
  ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(cx, 12); ctx.lineTo(cx, h - 12); ctx.stroke(); ctx.setLineDash([]);

  ctx.fillStyle = d ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.28)'; ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'right'; ctx.fillText('inside', cx - 7, cy - 48);
  ctx.textAlign = 'left'; ctx.fillText('outside', cx + 7, cy - 48);

  ctx.fillStyle = d ? '#d4aa33' : '#8a6a00'; ctx.fillRect(cx - 1, 12, 2, 20);
  ctx.fillStyle = '#e24b4a';
  ctx.beginPath(); ctx.moveTo(cx + 1, 12); ctx.lineTo(cx + 13, 19); ctx.lineTo(cx + 1, 26); ctx.fill();

  const plen = 88;
  const irad = ideal * Math.PI / 180;
  const isx = cx - Math.sin(irad) * plen, isy = cy + Math.cos(irad) * plen * .44 + 6;
  const iex = cx + Math.sin(irad) * plen, iey = cy - Math.cos(irad) * plen * .44 - 6;
  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.globalAlpha = .18;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D9E75';
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke();

  const inp = CLUBS[club].inputs.find(i => i.id === 'path');
  const idealRange = inp ? inp.ideal : [-5, 5];
  const prad = you * Math.PI / 180;
  const sx = cx - Math.sin(prad) * plen, sy = cy + Math.cos(prad) * plen * .44 + 6;
  const ex = cx + Math.sin(prad) * plen, ey = cy - Math.cos(prad) * plen * .44 - 6;
  const pc = inp ? getColor(inp, you) : '#378ADD';

  ctx.strokeStyle = pc; ctx.lineWidth = 14; ctx.globalAlpha = .1;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  const ang = Math.atan2(ey - sy, ex - sx);
  ctx.fillStyle = pc; ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -6); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill(); ctx.restore();

  const bg2 = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 9);
  bg2.addColorStop(0, '#fff'); bg2.addColorStop(1, '#ddd');
  ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = pc; ctx.textAlign = you >= 0 ? 'left' : 'right';
  ctx.fillText('you ' + (you > 0 ? '+' : '') + Math.round(you) + '°', ex + (you >= 0 ? 10 : -10), ey - 8);
  ctx.fillStyle = d ? 'rgba(80,220,140,.9)' : 'rgba(0,100,50,.8)'; ctx.textAlign = 'center';
  ctx.fillText('target', iex, iey - 10);

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${pc}">Your path: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;·&nbsp;<b style="color:#1D9E75">Target: ~${ideal > 0 ? '+' : ''}${ideal}°</b><br>${diff < 2 ? 'On target!' : you < idealRange[0] ? 'Out-to-in — classic slice path.' : you > idealRange[1] ? 'Very in-to-out — hook risk.' : 'Path is in range.'}`;
}

// ── Attack angle ───────────────────────────────────────────────────────────

function drawAttackBoth(cid, did, you, ideal, updateDesc) {
  const r = sc(cid, 190); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  drawSky(ctx, w, h, d);
  const gy = h * 0.68;
  drawGreenTexture(ctx, 0, gy, w, h - gy, d);

  ctx.strokeStyle = d ? '#4a7a30' : '#6ab840'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();

  const groundGrad = ctx.createLinearGradient(0, gy, 0, gy + 14);
  groundGrad.addColorStop(0, 'rgba(0,0,0,0.18)'); groundGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = groundGrad; ctx.fillRect(0, gy, w, 14);

  const bx = w * .5, by = gy - 10;

  ctx.strokeStyle = d ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.09)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(bx - 95, by); ctx.lineTo(bx + 45, by); ctx.stroke(); ctx.setLineDash([]);

  const slen = 118;
  const irad = ideal * Math.PI / 180;
  const isx = bx - Math.cos(irad) * slen, isy = by + Math.sin(irad) * slen;
  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 4; ctx.globalAlpha = .24;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(bx - 8, by); ctx.stroke(); ctx.globalAlpha = 1;

  const inp = CLUBS[club].inputs.find(i => i.id === 'attack');
  const ac = inp ? getColor(inp, you) : '#378ADD';
  const rad = you * Math.PI / 180;
  const sx = bx - Math.cos(rad) * slen, sy = by + Math.sin(rad) * slen;

  ctx.strokeStyle = ac; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.globalAlpha = .1;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx - 8, by); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx - 8, by); ctx.stroke();

  ctx.save(); ctx.translate(bx - 8, by); ctx.rotate(-rad + (you < 0 ? .14 : -.14));
  ctx.fillStyle = d ? '#555550' : '#888884';
  ctx.beginPath(); ctx.roundRect(-6, -8, 20, 16, 3); ctx.fill();
  ctx.fillStyle = ac;
  ctx.beginPath(); ctx.roundRect(-6, -8, 4, 16, 2); ctx.fill();
  ctx.restore();

  const aex = bx + Math.cos(rad) * 52, aey = by - Math.sin(rad) * 52;
  ctx.strokeStyle = ac; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aex, aey); ctx.stroke(); ctx.setLineDash([]);
  const aang = Math.atan2(aey - by, aex - bx);
  ctx.fillStyle = ac; ctx.save(); ctx.translate(aex, aey); ctx.rotate(aang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill(); ctx.restore();

  const ballg = ctx.createRadialGradient(bx - 2, by - 3, 1, bx, by, 9);
  ballg.addColorStop(0, '#fff'); ballg.addColorStop(1, '#ccc');
  ctx.fillStyle = ballg; ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.stroke();

  if (you < -2) {
    const dx = bx + 22;
    ctx.fillStyle = d ? '#5a3a18' : '#7a5a28';
    ctx.beginPath(); ctx.ellipse(dx, gy + 3, 18, 6, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d ? '#8a6a38' : '#aa8a48';
    ctx.beginPath(); ctx.ellipse(dx, gy + 2, 12, 4, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d ? '#bbb' : '#333'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('divot after ball', dx, gy + 17);
  }
  if (you > 1 && club === 'driver') {
    ctx.fillStyle = '#c49040'; ctx.fillRect(bx - 2, gy - 20, 5, 20);
    ctx.fillStyle = '#d4a050';
    ctx.beginPath(); ctx.ellipse(bx, gy - 20, 8, 5, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = d ? '#bbb' : '#333'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('tee — driver only', bx, gy + 17);
  }

  ctx.fillStyle = d ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.28)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('club approaches from here', sx, sy - 10);

  if (!updateDesc) return;
  const el = document.getElementById(did); if (!el) return;
  el.innerHTML = `<b style="color:${ac}">Your attack: ${you > 0 ? '+' : ''}${Math.round(you)}°</b>&nbsp;·&nbsp;<b style="color:#1D9E75">Target: ${ideal > 0 ? '+' : ''}${ideal}°</b><br>${Math.abs(you - ideal) < 1 ? 'On target!' : you > -2 && club !== 'driver' ? 'Too level or upward — this is the scoop. Push toward negative.' : you > 4 && club === 'driver' ? 'Very upward — check tee height.' : 'Getting there — push further toward target.'}`;
}
