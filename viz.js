// viz.js — canvas drawing functions for face angle, club path and attack angle
// Edit drawing parameters here to adjust visual appearance

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

function drawVizs() {
  const C = CLUBS[club];
  const panels = [];
  if (C.inputs.find(i => i.id === 'face'))
    panels.push({ id: 'vface', did: 'vdface', title: 'Face angle — top view', fn: () => drawFaceBoth('vface', 'vdface', getVal('face') || 0, idealMid('face')) });
  if (C.inputs.find(i => i.id === 'path'))
    panels.push({ id: 'vpath', did: 'vdpath', title: 'Club path — top view', fn: () => drawPathBoth('vpath', 'vdpath', getVal('path') || 0, idealMid('path')) });
  if (C.inputs.find(i => i.id === 'attack'))
    panels.push({ id: 'vattack', did: 'vdattack', title: 'Attack angle — side view', fn: () => drawAttackBoth('vattack', 'vdattack', getVal('attack') || 0, idealMid('attack')) });

  document.getElementById('vgrid').innerHTML = panels.map(p => `
    <div class="vc-wrap">
      <div class="vc-title">${p.title}</div>
      <canvas class="cv" id="${p.id}" height="180"></canvas>
      <div class="vc-desc" id="${p.did}"></div>
    </div>`).join('');

  setTimeout(() => panels.forEach(p => p.fn()), 40);
}

function drawFaceBoth(cid, did, you, ideal) {
  const r = sc(cid, 180); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  ctx.fillStyle = d ? '#1a2a18' : '#c8e6b0'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d ? '#223a20' : '#a8d890'; ctx.fillRect(w / 2 - 44, 0, 88, h);

  const cx = w / 2, cy = h * .64;
  ctx.strokeStyle = d ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.18)';
  ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, 16); ctx.lineTo(cx, cy - 18); ctx.stroke(); ctx.setLineDash([]);

  // Flag
  ctx.fillStyle = d ? '#ffcc44' : '#aa7700'; ctx.fillRect(cx - 1, 16, 2, 20);
  ctx.fillStyle = '#e24b4a';
  ctx.beginPath(); ctx.moveTo(cx + 1, 16); ctx.lineTo(cx + 13, 23); ctx.lineTo(cx + 1, 30); ctx.fill();
  ctx.fillStyle = d ? '#bbb' : '#555'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('flag', cx, 13);

  // Ideal face (faded green)
  const irad = ideal * Math.PI / 180;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(irad); ctx.globalAlpha = .32;
  ctx.fillStyle = '#1D9E75'; ctx.fillRect(-30, -9, 60, 18); ctx.restore(); ctx.globalAlpha = 1;

  // Your face
  const frad = you * Math.PI / 180;
  const fc = Math.abs(you) <= 3 ? '#1D9E75' : Math.abs(you) <= 7 ? '#EF9F27' : '#e24b4a';
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(frad);
  ctx.fillStyle = fc; ctx.fillRect(-30, -9, 60, 18);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-30, -9); ctx.lineTo(30, -9); ctx.stroke();
  ctx.restore();

  // Ball
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();

  // Ball flight arrow
  const bd = frad * .9, bl = 64, bx = cx + Math.sin(bd) * bl, by = cy - Math.cos(bd) * bl;
  ctx.strokeStyle = fc; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  const aa = Math.atan2(by - (cy - 8), bx - cx);
  ctx.fillStyle = fc; ctx.save(); ctx.translate(bx, by); ctx.rotate(aa);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, -5); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill(); ctx.restore();

  // Labels
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = fc; ctx.fillText('you ' + (you > 0 ? '+' : '') + you + '°', cx + (you >= 0 ? 28 : -28), cy + (you >= 0 ? -20 : 20));
  ctx.fillStyle = d ? 'rgba(100,220,150,.9)' : 'rgba(0,110,55,.75)';
  ctx.fillText('target ~' + ideal + '°', cx + (ideal >= 0 ? -26 : 26), cy + (ideal >= 0 ? 20 : -20));

  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${fc}">Your face: ${you > 0 ? '+' : ''}${you}°</b> &nbsp;·&nbsp; <b style="color:#1D9E75">Target: ~${ideal}°</b><br>${diff < 1 ? 'On target!' : diff < 4 ? 'Close — small adjustment needed.' : `Off by ${diff.toFixed(0)}° — ${you > ideal ? 'face open, needs to close' : 'face closed, open slightly'}.`}`;
}

function drawPathBoth(cid, did, you, ideal) {
  const r = sc(cid, 180); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  ctx.fillStyle = d ? '#1a2a18' : '#c8e6b0'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d ? '#223a20' : '#a8d890'; ctx.fillRect(w / 2 - 48, 0, 96, h);

  const cx = w / 2, cy = h * .52;
  ctx.strokeStyle = d ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.18)';
  ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.stroke(); ctx.setLineDash([]);

  ctx.fillStyle = d ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.28)'; ctx.font = '10px sans-serif';
  ctx.textAlign = 'right'; ctx.fillText('in', cx - 5, cy - 42);
  ctx.textAlign = 'left'; ctx.fillText('out', cx + 5, cy - 42);

  // Flag
  ctx.fillStyle = d ? '#ffcc44' : '#aa7700'; ctx.fillRect(cx - 1, 10, 2, 18);
  ctx.fillStyle = '#e24b4a';
  ctx.beginPath(); ctx.moveTo(cx + 1, 10); ctx.lineTo(cx + 11, 17); ctx.lineTo(cx + 1, 24); ctx.fill();

  const plen = 82;

  // Ideal path (faded green)
  const irad = ideal * Math.PI / 180;
  const isx = cx - Math.sin(irad) * plen, isy = cy + Math.cos(irad) * plen * .42 + 6;
  const iex = cx + Math.sin(irad) * plen, iey = cy - Math.cos(irad) * plen * .42 - 6;
  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.globalAlpha = .18;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D9E75';
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(iex, iey); ctx.stroke();

  // Your path
  const inp = CLUBS[club].inputs.find(i => i.id === 'path');
  const idealRange = inp ? inp.ideal : [-5, 5];
  const prad = you * Math.PI / 180;
  const sx = cx - Math.sin(prad) * plen, sy = cy + Math.cos(prad) * plen * .42 + 6;
  const ex = cx + Math.sin(prad) * plen, ey = cy - Math.cos(prad) * plen * .42 - 6;
  const pc = inp ? getColor(inp, you) : '#378ADD';

  ctx.strokeStyle = pc; ctx.lineWidth = 8; ctx.globalAlpha = .14;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

  const ang = Math.atan2(ey - sy, ex - sx);
  ctx.fillStyle = pc; ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill(); ctx.restore();

  // Ball
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();

  // Labels
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = pc; ctx.textAlign = you >= 0 ? 'left' : 'right';
  ctx.fillText('you ' + (you > 0 ? '+' : '') + you + '°', ex + (you >= 0 ? 9 : -9), ey - 7);
  ctx.fillStyle = d ? 'rgba(100,220,150,.9)' : 'rgba(0,110,55,.75)'; ctx.textAlign = 'center';
  ctx.fillText('target', iex, iey - 9);

  const el = document.getElementById(did); if (!el) return;
  const diff = Math.abs(you - ideal);
  el.innerHTML = `<b style="color:${pc}">Your path: ${you > 0 ? '+' : ''}${you}°</b> &nbsp;·&nbsp; <b style="color:#1D9E75">Target: ~${ideal > 0 ? '+' : ''}${ideal}°</b><br>${diff < 2 ? 'On target!' : you < idealRange[0] ? 'Out-to-in — over the top. Classic slice path.' : you > idealRange[1] ? 'Very in-to-out — hook risk.' : 'Path is in range.'}`;
}

function drawAttackBoth(cid, did, you, ideal) {
  const r = sc(cid, 180); if (!r) return;
  const { ctx, w, h } = r; const d = dk();

  ctx.fillStyle = d ? '#1a2535' : '#b8d4f0'; ctx.fillRect(0, 0, w, h);
  const gy = h * .68;
  ctx.fillStyle = d ? '#2a3a20' : '#8fbc5a'; ctx.fillRect(0, gy, w, h - gy);
  ctx.strokeStyle = d ? '#4a6a30' : '#5a9e2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();

  const bx = w * .5, by = gy - 9;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.stroke();

  ctx.strokeStyle = d ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(bx - 88, by); ctx.lineTo(bx + 40, by); ctx.stroke(); ctx.setLineDash([]);

  const slen = 112;

  // Ideal shaft (faded green)
  const irad = ideal * Math.PI / 180;
  const isx = bx - Math.cos(irad) * slen, isy = by + Math.sin(irad) * slen;
  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 3.5; ctx.globalAlpha = .28;
  ctx.beginPath(); ctx.moveTo(isx, isy); ctx.lineTo(bx - 7, by); ctx.stroke(); ctx.globalAlpha = 1;

  // Your shaft
  const inp = CLUBS[club].inputs.find(i => i.id === 'attack');
  const ac = inp ? getColor(inp, you) : '#378ADD';
  const rad = you * Math.PI / 180, sx = bx - Math.cos(rad) * slen, sy = by + Math.sin(rad) * slen;
  ctx.strokeStyle = ac; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx - 8, by); ctx.stroke();

  // Clubhead
  ctx.save(); ctx.translate(bx - 8, by); ctx.rotate(-rad + (you < 0 ? .12 : -.12));
  ctx.fillStyle = ac; ctx.fillRect(-5, -7, 18, 14); ctx.restore();

  // Direction arrow
  const aex = bx + Math.cos(rad) * 48, aey = by - Math.sin(rad) * 48;
  ctx.strokeStyle = ac; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aex, aey); ctx.stroke(); ctx.setLineDash([]);
  const aang = Math.atan2(aey - by, aex - bx);
  ctx.fillStyle = ac; ctx.save(); ctx.translate(aex, aey); ctx.rotate(aang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, -5); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill(); ctx.restore();

  // Divot (irons / wedges hitting down)
  if (you < -2) {
    ctx.fillStyle = d ? '#6a4a20' : '#9b7b2a';
    ctx.beginPath(); ctx.ellipse(bx + 18, gy, 15, 5, .2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d ? '#bbb' : '#444'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('divot after ball', bx + 18, gy + 15);
  }

  // Tee (driver hitting up)
  if (you > 1 && club === 'driver') {
    ctx.fillStyle = '#c49040'; ctx.fillRect(bx - 2, gy - 17, 5, 17);
    ctx.fillStyle = '#b48030'; ctx.beginPath(); ctx.ellipse(bx, gy - 17, 7, 4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = d ? '#bbb' : '#444'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('tee — driver only', bx, gy + 15);
  }

  ctx.fillStyle = d ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.3)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('club from here', sx, sy - 10);

  const el = document.getElementById(did); if (!el) return;
  el.innerHTML = `<b style="color:${ac}">Your attack: ${you > 0 ? '+' : ''}${you}°</b> &nbsp;·&nbsp; <b style="color:#1D9E75">Target: ${ideal > 0 ? '+' : ''}${ideal}°</b><br>${Math.abs(you - ideal) < 1 ? 'On target!' : you > -2 && club !== 'driver' ? 'Too level or upward — this is the scoop. Push negative.' : you > 4 && club === 'driver' ? 'Very upward — check tee height.' : 'Getting there — push further toward target.'}`;
}
