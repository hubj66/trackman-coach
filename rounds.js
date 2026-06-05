// rounds.js v1
// On-course round tracking: Supabase CRUD and summary helpers.

/**
 * Insert a parsed round and its shots into Supabase.
 * Returns { ok, roundId, error }
 */
window.importRound = async function(parsedData) {
  const sb = window.supabaseClient;
  const { data: sd, error: se } = await sb.auth.getSession();
  if (se || !sd?.session?.user) return { ok: false, error: { message: 'Not logged in' } };
  const userId = sd.session.user.id;

  const { data: dup } = await sb.from('rounds').select('id')
    .eq('user_id', userId).eq('round_date', parsedData.roundDate).eq('course_name', parsedData.courseName)
    .limit(1).maybeSingle();
  if (dup) return { ok: false, duplicate: true, error: { message: `A round at ${parsedData.courseName} on ${parsedData.roundDate} is already imported.` } };

  const summary = window.computeRoundSummary(parsedData.shots);

  const { data: roundData, error: roundErr } = await sb.from('rounds').insert({
    user_id: userId,
    round_date: parsedData.roundDate,
    course_name: parsedData.courseName,
    total_strokes: summary.totalStrokes,
    total_putts: summary.totalPutts,
    holes_played: summary.holesPlayed,
    total_par: summary.totalPar,
  }).select('id').single();

  if (roundErr) return { ok: false, error: roundErr };
  const roundId = roundData.id;

  const shotRows = parsedData.shots.map(s => ({
    round_id: roundId,
    user_id: userId,
    hole: s.hole,
    par: s.par,
    hcp: s.hcp,
    shot_number: s.shot_number,
    club: s.club,
    distance_m: s.distance_m,
    lie: s.lie,
    comment: s.comment,
    is_penalty: s.is_penalty,
    miss_direction: s.miss_direction,
  }));

  // Batch in chunks of 100 to avoid request size limits
  for (let i = 0; i < shotRows.length; i += 100) {
    const { error: shotErr } = await sb.from('round_shots').insert(shotRows.slice(i, i + 100));
    if (shotErr) return { ok: false, error: shotErr };
  }
  return { ok: true, roundId };
};

/**
 * Update an existing round: replace metadata and all shots.
 * Returns { ok, roundId, error }
 */
window.updateRound = async function(roundId, parsedData, summary) {
  const sb = window.supabaseClient;
  const { data: sd, error: se } = await sb.auth.getSession();
  if (se || !sd?.session?.user) return { ok: false, error: { message: 'Not logged in' } };
  const userId = sd.session.user.id;

  const { error: updErr } = await sb.from('rounds').update({
    round_date: parsedData.roundDate,
    course_name: parsedData.courseName,
    total_strokes: summary.totalStrokes,
    total_putts: summary.totalPutts,
    holes_played: summary.holesPlayed,
    total_par: summary.totalPar,
  }).eq('id', roundId).eq('user_id', userId);
  if (updErr) return { ok: false, error: updErr };

  const { error: delErr } = await sb.from('round_shots').delete().eq('round_id', roundId).eq('user_id', userId);
  if (delErr) return { ok: false, error: delErr };

  const shotRows = parsedData.shots.map(s => ({
    round_id: roundId, user_id: userId,
    hole: s.hole, par: s.par, hcp: s.hcp, shot_number: s.shot_number,
    club: s.club, distance_m: s.distance_m, lie: s.lie,
    comment: s.comment, is_penalty: s.is_penalty, miss_direction: s.miss_direction,
  }));
  for (let i = 0; i < shotRows.length; i += 100) {
    const { error: shotErr } = await sb.from('round_shots').insert(shotRows.slice(i, i + 100));
    if (shotErr) return { ok: false, error: shotErr };
  }
  return { ok: true, roundId };
};

/** Load a single round by id (must belong to current user). */
window.loadRound = async function(roundId) {
  const sb = window.supabaseClient;
  const { data: sd } = await sb.auth.getSession();
  const userId = sd?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await sb.from('rounds')
    .select('id,round_date,course_name,holes_played,total_strokes,total_putts,total_par')
    .eq('id', roundId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
};

window.loadRounds = async function(limit = 10) {
  const sb = window.supabaseClient;
  const { data: sd } = await sb.auth.getSession();
  const userId = sd?.session?.user?.id;
  if (!userId) return [];
  const { data, error } = await sb.from('rounds')
    .select('id,round_date,course_name,tees,total_strokes,total_putts,holes_played,total_par,notes')
    .eq('user_id', userId)
    .order('round_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

/** Load shots for a specific round (must belong to current user). */
window.loadRoundShots = async function(roundId) {
  const sb = window.supabaseClient;
  const { data: sd } = await sb.auth.getSession();
  const userId = sd?.session?.user?.id;
  if (!userId) return [];
  const { data, error } = await sb.from('round_shots')
    .select('id,hole,par,hcp,shot_number,club,distance_m,lie,comment,is_penalty,miss_direction')
    .eq('round_id', roundId)
    .eq('user_id', userId)
    .order('hole', { ascending: true })
    .order('shot_number', { ascending: true });
  if (error) throw error;
  return data || [];
};

/** Delete a round; cascade removes its shots. */
window.deleteRound = async function(roundId) {
  const sb = window.supabaseClient;
  const { data: sd } = await sb.auth.getSession();
  const userId = sd?.session?.user?.id;
  if (!userId) return { ok: false, error: { message: 'Not logged in' } };
  const { error } = await sb.from('rounds').delete().eq('id', roundId).eq('user_id', userId);
  return error ? { ok: false, error } : { ok: true };
};

/**
 * Compute summary stats from an array of shot objects.
 * GIR: first putt shot_number <= par − 1
 * FW hit: tee shot lie matches fairway variants (case-insensitive)
 */
window.computeRoundSummary = function(shots) {
  const byHole = {};
  shots.forEach(s => {
    if (!byHole[s.hole]) byHole[s.hole] = [];
    byHole[s.hole].push(s);
  });
  const holes = Object.keys(byHole).map(Number).sort((a, b) => a - b);

  let totalStrokes = 0, totalPutts = 0, totalPar = 0, girCount = 0, fwHitCount = 0;
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
    const tee = hs.find(s => s.shot_number === 1);
    if (tee) {
      const lie = (tee.lie || '').toLowerCase();
      if (lie === 'fairway' || lie === 'fareways' || lie === 'fareway') fwHitCount++;
    }
  });

  // Par 3/4/5 breakdown
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

  // Up-and-down from rough/bunker: last recovery shot per hole, did they hole out in ≤1 more shot?
  const roughUD = { att: 0, made: 0 };
  const bunkerUD = { att: 0, made: 0 };
  holes.forEach(h => {
    const hs = byHole[h];
    const total = hs.length;
    const lastRough = [...hs].filter(s => s.shot_number > 1 && (s.lie || '').toLowerCase().includes('rough')).pop();
    const lastBunker = [...hs].filter(s => s.shot_number > 1 && ((s.lie || '').toLowerCase().includes('bunker') || (s.lie || '').toLowerCase().includes('sand'))).pop();
    if (lastRough) { roughUD.att++; if (total - lastRough.shot_number <= 1) roughUD.made++; }
    if (lastBunker) { bunkerUD.att++; if (total - lastBunker.shot_number <= 1) bunkerUD.made++; }
  });

  return {
    totalStrokes,
    totalPutts,
    totalPar: totalPar || null,
    holesPlayed: holes.length,
    girCount,
    fwHitCount,
    avgPuttsPerHole: holes.length ? totalPutts / holes.length : 0,
    strokesByHole,
    byPar,
    roughUD,
    bunkerUD,
  };
};
