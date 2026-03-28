// shotshape.js — premium shot shape predictor

function getShotShape(face, path) {
  const ftp = face - path;
  const startDir = face;

  const startLeft = startDir < -2, startRight = startDir > 2, startStraight = !startLeft && !startRight;
  const curvesLeft = ftp < -2, curvesRight = ftp > 2;
  const curvesStrong = Math.abs(ftp) > 6;

  let name, color, desc;
  const d = !matchMedia('(prefers-color-scheme: light)').matches;
  const G = d ? '#00d68f' : '#00a86b';
  const A = d ? '#ffaa00' : '#d4880a';
  const R = d ? '#ff4d4d' : '#d93030';

  if      (startRight && curvesRight && curvesStrong)          { name = 'Slice';       color = R; desc = 'Starts right, curves hard right. Open face + out-to-in path.'; }
  else if (startRight && curvesRight)                          { name = 'Fade';         color = A; desc = 'Starts right, gentle curve right. Controlled if consistent.'; }
  else if (startStraight && curvesRight && curvesStrong)       { name = 'Push slice';   color = R; desc = 'Starts straight, slices right. Very open face to path.'; }
  else if (startStraight && curvesRight)                       { name = 'Push fade';    color = A; desc = 'Starts at target, drifts right. Open face to square path.'; }
  else if (startLeft && curvesRight)                           { name = 'Pull fade';    color = A; desc = 'Starts left, curves back right. Can work if consistent.'; }
  else if (startLeft && !curvesRight && !curvesLeft)           { name = 'Pull';         color = R; desc = 'Starts left, goes straight left. Closed face, neutral path.'; }
  else if (startLeft && curvesLeft && curvesStrong)            { name = 'Hook';         color = R; desc = 'Starts left, hooks further left. Closed face + in-to-out path.'; }
  else if (startLeft && curvesLeft)                            { name = 'Draw';         color = G; desc = 'Starts left, gentle draw right. Controlled good shot.'; }
  else if (startStraight && curvesLeft && curvesStrong)        { name = 'Hook';         color = R; desc = 'Starts at target, hooks left. Closed face relative to path.'; }
  else if (startStraight && curvesLeft)                        { name = 'Draw';         color = G; desc = 'Starts at target, gentle draw. Tour-standard ball flight!'; }
  else if (startRight && curvesLeft)                           { name = 'Push draw';    color = G; desc = 'Starts right, curves back left. Can work if consistent.'; }
  else                                                          { name = 'Straight';    color = G; desc = 'Dead straight. Face square to path — excellent contact.'; }

  return { name, color, desc, ftp, startDir };
}

function bezierPoint(p0, p1, p2, p3, t) {
  return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t*t*p2 + t**3*p3;
}

function _drawShotShape() {
  const face = getVal('face'), path = getVal('path');
  if (face === null || path === null) return;

  const c = document.getElementById('shotshape-canvas');
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const parentW = c.parentElement.clientWidth;
  // If parent is hidden (clientWidth = 0), use fallback width
  const w = parentW > 0 ? parentW : window.innerWidth - 36;
  const h = 230;
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  const d = !matchMedia('(prefers-color-scheme: light)').matches;
  const shape = getShotShape(face, path);

  // Fairway background with stripes
  const sw = 22;
  const c1 = d ? '#1e3420' : '#78c455', c2 = d ? '#182818' : '#65b040';
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(i * sw, 0, sw, h);
  }

  // Rough edges
  ctx.fillStyle = d ? '#0e1e0e' : '#4a9030';
  ctx.fillRect(0, 0, w * 0.13, h);
  ctx.fillRect(w * 0.87, 0, w * 0.13, h);

  // Rough edge lines
  ctx.strokeStyle = d ? '#2a4a2a' : '#3a7020'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(w * 0.13, 0); ctx.lineTo(w * 0.13, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.87, 0); ctx.lineTo(w * 0.87, h); ctx.stroke();

  // Target line
  const cx = w / 2;
  ctx.strokeStyle = d ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1.5; ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(cx, h - 30); ctx.lineTo(cx, 24); ctx.stroke(); ctx.setLineDash([]);

  // Hole at top
  ctx.fillStyle = d ? '#1a1a18' : '#2a2a28';
  ctx.beginPath(); ctx.arc(cx, 26, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = d ? '#3a3a38' : '#5a5a58'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, 26, 9, 0, Math.PI * 2); ctx.stroke();
  // Flag pin
  ctx.fillStyle = d ? '#c8a830' : '#8a6800'; ctx.fillRect(cx - 0.75, 12, 1.5, 18);
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.moveTo(cx + 1, 12); ctx.lineTo(cx + 14, 18); ctx.lineTo(cx + 1, 24); ctx.fill();

  // Ball flight
  const startX = cx, startY = h - 28;
  const maxLateral = w * 0.27;
  const flightH = h - 60;
  const startOffset = (shape.startDir / 20) * maxLateral;
  const curveAmount = (shape.ftp / 15) * maxLateral * 0.8;
  const cp1x = startX + startOffset * 0.25, cp1y = startY - flightH * 0.35;
  const cp2x = startX + startOffset - curveAmount * 0.45, cp2y = startY - flightH * 0.7;
  const endX = Math.max(w * 0.15, Math.min(w * 0.85, startX + startOffset - curveAmount));
  const endY = 44;

  // Glow
  ctx.shadowColor = shape.color; ctx.shadowBlur = d ? 16 : 8;
  ctx.strokeStyle = shape.color; ctx.lineWidth = 12; ctx.globalAlpha = 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY); ctx.stroke();
  ctx.shadowBlur = 0;

  // Main curve
  ctx.globalAlpha = 1; ctx.lineWidth = 3.5; ctx.strokeStyle = shape.color;
  ctx.beginPath(); ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY); ctx.stroke();

  // Dots along curve
  for (let i = 1; i <= 6; i++) {
    const tt = i / 7;
    const px = bezierPoint(startX, cp1x, cp2x, endX, tt);
    const py = bezierPoint(startY, cp1y, cp2y, endY, tt);
    ctx.fillStyle = shape.color; ctx.globalAlpha = 0.3 + tt * 0.5;
    ctx.beginPath(); ctx.arc(px, py, 2 + tt * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Landing zone glow
  ctx.shadowColor = shape.color; ctx.shadowBlur = d ? 12 : 6;
  ctx.fillStyle = shape.color; ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.arc(endX, endY + 6, 18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = shape.color;
  ctx.beginPath(); ctx.arc(endX, endY + 6, 6, 0, Math.PI * 2); ctx.fill();

  // Ball at start
  const bg = ctx.createRadialGradient(startX - 3, startY - 3, 1, startX, startY, 10);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#cccccc');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(startX, startY, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(startX, startY, 10, 0, Math.PI * 2); ctx.stroke();

  // Shot name badge
  ctx.font = `700 14px 'Barlow Condensed', sans-serif`;
  const bw = ctx.measureText(shape.name).width + 22;
  const bx2 = 14, by2 = h - 46;
  ctx.fillStyle = shape.color; ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.roundRect(bx2, by2, bw, 30, 4); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = shape.color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx2, by2, bw, 30, 4); ctx.stroke();
  ctx.fillStyle = shape.color; ctx.textAlign = 'left';
  ctx.fillText(shape.name.toUpperCase(), bx2 + 11, by2 + 20);

  // Face-to-path badge (top right)
  const ftpText = `FTP ${shape.ftp > 0 ? '+' : ''}${shape.ftp.toFixed(1)}°`;
  ctx.font = `500 9px 'DM Mono', monospace`;
  const fw2 = ctx.measureText(ftpText).width + 16;
  ctx.fillStyle = d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.roundRect(w - fw2 - 12, h - 40, fw2, 24, 3); ctx.fill();
  ctx.fillStyle = d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'right';
  ctx.fillText(ftpText, w - 20, h - 24);

  // Description
  const el = document.getElementById('shotshape-desc');
  if (el) {
    el.innerHTML = `<b style="color:${shape.color}">${shape.name}</b> — ${shape.desc}<br><span style="font-size:11px;opacity:0.55">Face to path ${shape.ftp > 0 ? '+' : ''}${shape.ftp.toFixed(1)}° · Start dir ${shape.startDir > 0 ? '+' : ''}${shape.startDir.toFixed(1)}°</span>`;
  }
}

function renderShotShapeSection() {
  const C = CLUBS[club];
  const hasFace = C.inputs.find(i => i.id === 'face');
  const hasPath = C.inputs.find(i => i.id === 'path');
  const el = document.getElementById('shotshape-section');
  if (!el) return;
  if (!hasFace || !hasPath || club === 'putter') {
    el.style.display = 'none'; return;
  }
  el.style.display = 'block';
  setTimeout(_drawShotShape, 30);
}
