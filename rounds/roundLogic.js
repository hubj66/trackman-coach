// roundLogic.js
// Pure on-course scoring and summary helpers.

/**
 * Compute summary stats from an array of shot objects.
 * GIR: first putt shot_number <= par - 1
 * FW hit (par 4/5 only): lie of the shot after the last tee shot is fairway
 */
function computeRoundSummary(shots) {
  const byHole = {};
  shots.forEach(s => {
    if (!byHole[s.hole]) byHole[s.hole] = [];
    byHole[s.hole].push(s);
  });
  const holes = Object.keys(byHole).map(Number).sort((a, b) => a - b);

  let totalStrokes = 0, totalPutts = 0, totalPar = 0, girCount = 0, fwHitCount = 0, par45Count = 0;
  const strokesByHole = [];

  holes.forEach(h => {
    const hs = byHole[h];
    const par = hs[0]?.par ?? null;
    totalStrokes += hs.length;
    if (par) totalPar += par;
    const puttShots = hs.filter(s => s.club?.toLowerCase() === 'putter');
    totalPutts += puttShots.length;
    strokesByHole.push({ hole: h, par, strokes: hs.length, putts: puttShots.length });

    if (par && puttShots.length) {
      const firstPutt = Math.min(...puttShots.map(s => s.shot_number));
      if (firstPutt <= par - 1) girCount++;
    }
    if (par && par >= 4) {
      par45Count++;
      const teeShots = hs.filter(s => (s.lie || '').toLowerCase() === 'tee');
      if (teeShots.length) {
        const lastTee = teeShots[teeShots.length - 1];
        const nextShot = hs.find(s => s.shot_number === lastTee.shot_number + 1);
        if (nextShot) {
          const nl = (nextShot.lie || '').toLowerCase();
          if (nl === 'fairway' || nl === 'fareways' || nl === 'fareway') fwHitCount++;
        }
      }
    }
  });

  const parGroups = {};
  strokesByHole.forEach(h => {
    if (!h.par) return;
    if (!parGroups[h.par]) parGroups[h.par] = { count: 0, totalRelPar: 0 };
    parGroups[h.par].count++;
    parGroups[h.par].totalRelPar += h.strokes - h.par;
  });
  const byPar = {};
  Object.entries(parGroups).forEach(([par, g]) => {
    byPar[Number(par)] = { count: g.count, avgRelPar: g.totalRelPar / g.count };
  });

  const roughUD = { att: 0, made: 0 };
  const bunkerUD = { att: 0, made: 0 };
  holes.forEach(h => {
    const hs = byHole[h];
    const total = hs.length;
    const lastRough = [...hs].filter(s =>
      s.shot_number > 1 && (s.lie || '').toLowerCase().includes('rough')
    ).pop();
    const lastBunker = [...hs].filter(s =>
      s.shot_number > 1 && (
        (s.lie || '').toLowerCase().includes('bunker') ||
        (s.lie || '').toLowerCase().includes('sand')
      )
    ).pop();
    if (lastRough) { roughUD.att++; if (total - lastRough.shot_number <= 1) roughUD.made++; }
    if (lastBunker) { bunkerUD.att++; if (total - lastBunker.shot_number <= 1) bunkerUD.made++; }
  });

  return {
    totalStrokes,
    totalPutts,
    totalPar: totalPar || null,
    holesPlayed: holes.length,
    par45Holes: par45Count,
    girCount,
    fwHitCount,
    avgPuttsPerHole: holes.length ? totalPutts / holes.length : 0,
    strokesByHole,
    byPar,
    roughUD,
    bunkerUD,
  };
}

window.TCRoundLogic = { computeRoundSummary };
window.computeRoundSummary = computeRoundSummary;
