// shotshape.js — shot shape predictor
// Draws a top-down fairway with the predicted ball curve based on face + path

// Shot shape names based on face-to-path relationship
function getShotShape(face, path) {
  const ftp = face - path; // face to path = curvature direction and amount
  const startDir = face;   // ball starts where face points (~75% rule)

  let name, color, desc;

  // Determine start direction
  const startLeft = startDir < -2;
  const startRight = startDir > 2;
  const startStraight = !startLeft && !startRight;

  // Determine curve
  const curvesLeft = ftp < -2;
  const curvesRight = ftp > 2;
  const curvesMild = Math.abs(ftp) <= 6;
  const curvesStrong = Math.abs(ftp) > 6;

  if (startRight && curvesRight && curvesStrong)  { name = 'Slice';       color = '#e24b4a'; desc = 'Starts right, curves hard right. Open face + out-to-in path.'; }
  else if (startRight && curvesRight)              { name = 'Fade';        color = '#EF9F27'; desc = 'Starts right, gentle curve right. Controlled if consistent.'; }
  else if (startStraight && curvesRight && curvesStrong) { name = 'Push slice'; color = '#e24b4a'; desc = 'Starts straight, slices right. Very open face relative to path.'; }
  else if (startStraight && curvesRight)           { name = 'Push fade';   color = '#EF9F27'; desc = 'Starts at target, drifts right. Open face to a square path.'; }
  else if (startLeft && curvesRight)               { name = 'Pull fade';   color = '#EF9F27'; desc = 'Starts left, curves back right. Can work if controlled.'; }
  else if (startLeft && !curvesRight && !curvesLeft) { name = 'Pull';      color = '#e24b4a'; desc = 'Starts left, goes straight left. Closed face, neutral path.'; }
  else if (startLeft && curvesLeft && curvesStrong) { name = 'Hook';       color = '#e24b4a'; desc = 'Starts left, hooks further left. Closed face + in-to-out path.'; }
  else if (startLeft && curvesLeft)                { name = 'Draw';        color = '#1D9E75'; desc = 'Starts left, gentle draw right. This is a controlled good shot.'; }
  else if (startStraight && curvesLeft && curvesStrong) { name = 'Hook';   color = '#e24b4a'; desc = 'Starts at target, hooks left. Closed face relative to path.'; }
  else if (startStraight && curvesLeft)            { name = 'Draw';        color = '#1D9E75'; desc = 'Starts at target, gentle draw. Tour-standard ball flight!'; }
  else if (startRight && curvesLeft)               { name = 'Push draw';   color = '#1D9E75'; desc = 'Starts right, curves back left. Can work if consistent.'; }
  else                                             { name = 'Straight';    color = '#1D9E75'; desc = 'Dead straight. Face square to path — excellent contact.'; }

  return { name, color, desc, ftp, startDir };
}

function drawShotShape() {
  const face = getVal('face');
  const path = getVal('path');
  if (face === null || path === null) return;

  const c = document.getElementById('shotshape-canvas');
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  const w = c.parentElement.clientWidth - 24;
  const h = 220;
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  const d = dk();
  const shape = getShotShape(face, path);

  // Fairway background
  ctx.fillStyle = d ? '#1a2a18' : '#b8dea0';
  ctx.fillRect(0, 0, w, h);

  // Fairway stripes
  const sw = 22;
  for (let i = 0; i * sw < w; i++) {
    ctx.fillStyle = i % 2 === 0
      ? (d ? '#1e3020' : '#c2e4a8')
      : (d ? '#162416' : '#aed898');
    ctx.fillRect(i * sw, 0, sw, h);
  }

  // Rough edges
  ctx.fillStyle = d ? '#102010' : '#7ab060';
  ctx.fillRect(0, 0, w * 0.12, h);
  ctx.fillRect(w * 0.88, 0, w * 0.12, h);

  // Center line (target line)
  ctx.strokeStyle = d ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)';
  ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(w / 2, h - 30); ctx.lineTo(w / 2, 20); ctx.stroke(); ctx.setLineDash([]);

  // Hole/target at top
  ctx.fillStyle = d ? '#555' : '#333';
  ctx.beginPath(); ctx.arc(w / 2, 24, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e24b4a';
  ctx.fillRect(w / 2, 14, 2, 16);
  ctx.beginPath(); ctx.moveTo(w / 2 + 2, 14); ctx.lineTo(w / 2 + 14, 20); ctx.lineTo(w / 2 + 2, 26); ctx.fill();

  // Start point (ball at bottom center)
  const startX = w / 2;
  const startY = h - 25;

  // Calculate ball flight curve
  // Start direction from face angle, curve from face-to-path
  const maxLateral = w * 0.28;
  const flightH = h - 55;

  // Lateral offset at top = start direction effect
  const startOffset = (shape.startDir / 20) * maxLateral;
  // Curve amount = face to path relationship
  const curveAmount = (shape.ftp / 15) * maxLateral * 0.8;

  // Control points for bezier
  const cp1x = startX + startOffset * 0.3;
  const cp1y = startY - flightH * 0.4;
  const cp2x = startX + startOffset - curveAmount * 0.5;
  const cp2y = startY - flightH * 0.7;
  const endX = Math.max(w * 0.14, Math.min(w * 0.86, startX + startOffset - curveAmount));
  const endY = 40;

  // Ball trail (shadow/glow)
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = 10; ctx.globalAlpha = 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.stroke(); ctx.globalAlpha = 1;

  // Main ball flight line
  ctx.strokeStyle = shape.color; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.stroke();

  // Dots along the path
  for (let t = 0.15; t <= 0.85; t += 0.2) {
    const bx = bezierPoint(startX, cp1x, cp2x, endX, t);
    const by = bezierPoint(startY, cp1y, cp2y, endY, t);
    const size = 3 + t * 3;
    ctx.fillStyle = shape.color; ctx.globalAlpha = 0.5 + t * 0.5;
    ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ball at start
  const bg = ctx.createRadialGradient(startX - 2, startY - 3, 1, startX, startY, 9);
  bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#ddd');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(startX, startY, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(startX, startY, 9, 0, Math.PI * 2); ctx.stroke();

  // Landing zone indicator
  ctx.fillStyle = shape.color; ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(endX, endY + 6, 16, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = shape.color;
  ctx.beginPath(); ctx.arc(endX, endY + 6, 6, 0, Math.PI * 2); ctx.fill();

  // Shot shape name badge
  const badgeX = 12, badgeY = h - 44;
  ctx.fillStyle = shape.color; ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.roundRect(badgeX, badgeY, 80, 28, 6); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = shape.color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(badgeX, badgeY, 80, 28, 6); ctx.stroke();
  ctx.fillStyle = shape.color; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(shape.name, badgeX + 10, badgeY + 18);

  // Update description
  const descEl = document.getElementById('shotshape-desc');
  if (descEl) {
    descEl.innerHTML = `<b style="color:${shape.color}">${shape.name}</b> — ${shape.desc}<br><span style="color:var(--text3);font-size:11px">Face to path: ${shape.ftp > 0 ? '+' : ''}${shape.ftp.toFixed(1)}° · Start direction: ${shape.startDir > 0 ? '+' : ''}${shape.startDir.toFixed(1)}°</span>`;
  }
}

function bezierPoint(p0, p1, p2, p3, t) {
  return Math.pow(1-t,3)*p0 + 3*Math.pow(1-t,2)*t*p1 + 3*(1-t)*t*t*p2 + Math.pow(t,3)*p3;
}

function renderShotShapeSection() {
  const C = CLUBS[club];
  const hasFace = C.inputs.find(i => i.id === 'face');
  const hasPath = C.inputs.find(i => i.id === 'path');
  const el = document.getElementById('shotshape-section');
  if (!el) return;

  if (!hasFace || !hasPath || club === 'putter') {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  setTimeout(drawShotShape, 30);
}
