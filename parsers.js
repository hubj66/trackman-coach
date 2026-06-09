// parsers.js
// Import parsers and normalizers. Keep these pure and browser-global for now.

const ROUND_CLUB_MAP = {
  '1':'driver','driver':'driver',
  '2':'2i','2 iron':'2i',
  '3':'3','3 iron':'3',
  '4':'4','4 iron':'4',
  '5':'5','5 iron':'5',
  '6':'6','6 iron':'6',
  '7':'7','7 iron':'7',
  '8':'8','8 iron':'8',
  '9':'9','9 iron':'9',
  'pw':'pw','pitching wedge':'pw',
  'gw':'aw','gap wedge':'aw','approach wedge':'aw','aw':'aw',
  'sw':'sw','sand wedge':'sw',
  '58':'58','56':'56','52':'52','60':'60',
  'lw':'lw','lob wedge':'lw',
  '3w':'3w','3 wood':'3w','3wood':'3w',
  '5w':'5w','5 wood':'5w','5wood':'5w',
  '7w':'7w','7 wood':'7w','7wood':'7w',
  'hybrid':'hybrid','4h':'hybrid','5h':'hybrid','3h':'hybrid',
  'putter':'putter',
};

function normaliseRoundClub(raw) {
  if (!raw) return null;
  return ROUND_CLUB_MAP[raw.trim().toLowerCase()] ?? null;
}

function parseMissDir(val) {
  if (!val) return null;
  const v = val.trim().toLowerCase().replace(/\s+/g, '-');
  if (v === 'l' || v === 'left') return 'left';
  if (v === 'r' || v === 'right') return 'right';
  if (v === 's' || v === 'c' || v === 'straight' || v === 'centre' || v === 'center') return 'straight';
  if (v === '+' || v === 'long' || v === 'lg') return 'long';
  if (v === '-' || v === 'short' || v === 'sh') return 'short';
  if (v === 'l+' || v === 'left-long' || v === 'll') return 'left-long';
  if (v === 'l-' || v === 'left-short' || v === 'ls') return 'left-short';
  if (v === 'r+' || v === 'right-long' || v === 'rl') return 'right-long';
  if (v === 'r-' || v === 'right-short' || v === 'rs') return 'right-short';
  return null;
}

function extractMissDirFromComment(comment) {
  if (!comment) return null;
  const c = comment.toLowerCase();
  const hasLeft  = /\bleft\b/.test(c);
  const hasRight = /\bright\b/.test(c);
  const hasShort = /\bshort\b/.test(c);
  const hasLong  = /\blong\b/.test(c);

  if (!hasLeft && !hasRight && !hasShort && !hasLong) {
    return /\bstraight\b/.test(c) ? 'straight' : null;
  }

  let lateral = null;
  if (hasLeft && hasRight) {
    lateral = c.indexOf('left') < c.indexOf('right') ? 'left' : 'right';
  } else if (hasLeft) {
    lateral = 'left';
  } else if (hasRight) {
    lateral = 'right';
  }

  const depth = hasLong && !hasShort ? 'long' : hasShort && !hasLong ? 'short' : null;

  if (lateral && depth) return `${lateral}-${depth}`;
  return lateral || depth || null;
}

function parseRoundDist(val) {
  if (!val && val !== 0) return null;
  const s = String(val).replace(',', '.').trim();
  const n = parseFloat(s);
  if (isNaN(n) || n > 400) return null;
  return n;
}

const PENALTY_RE = /penalty|out on the|stroke and distance|\bOB\b/i;

// Supports M/D/YYYY (GolfPad default) and DD.MM.YYYY (European export).
function parseDateToISO(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length !== 3) return null;
    const [m, d, yr] = parts.map(Number);
    if (isNaN(m) || isNaN(d) || isNaN(yr)) return null;
    return `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length !== 3) return null;
    const [d, m, yr] = parts.map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(yr)) return null;
    return `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

/**
 * Parse a GolfPad tab-separated export.
 * Columns: Date | Park | Hole | PAR | HCP | Club | Distance | Comment | Lie | [Dir]
 * Returns { roundDate, courseName, holes[], shots[] }
 */
function parseGolfPadTSV(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const first = (cols[0] || '').trim().toLowerCase();
    // Skip header lines.
    if (first === 'date' || first === 'park' || first === 'hole') continue;
    if (cols.length < 5) continue;
    rows.push(cols);
  }
  if (!rows.length) throw new Error('No data rows found. Check the pasted format.');

  const roundDate = parseDateToISO(rows[0][0]) || rows[0][0]?.trim() || '?';
  const courseName = (rows[0][1] || '').trim() || 'Unknown course';

  const holeCounters = {};
  const shots = rows.map(cols => {
    const hole = parseInt(cols[2], 10);
    if (!hole || isNaN(hole)) return null;
    const par = parseInt(cols[3], 10) || null;
    const hcp = parseInt(cols[4], 10) || null;
    const club = (cols[5] || '').trim() || null;
    const distance_m = parseRoundDist(cols[6]);
    const comment = (cols[7] || '').trim() || null;
    const lieRaw = (cols[8] || '').trim() || null;
    const lie = lieRaw && lieRaw.toLowerCase() === 'sand' ? 'Bunker' : lieRaw;
    const miss_direction = parseMissDir(cols[9]) ?? extractMissDirFromComment(comment);
    const is_penalty = club?.toLowerCase() === 'penalty' || (comment ? PENALTY_RE.test(comment) : false);

    holeCounters[hole] = (holeCounters[hole] || 0) + 1;
    return { hole, par, hcp, shot_number: holeCounters[hole], club, distance_m, lie, comment, is_penalty, miss_direction };
  }).filter(Boolean);

  if (!shots.length) throw new Error('No valid shots found.');

  const holeMap = {};
  shots.forEach(s => {
    if (!holeMap[s.hole]) holeMap[s.hole] = { hole: s.hole, par: s.par, hcp: s.hcp, strokes: 0 };
    holeMap[s.hole].strokes++;
  });
  const holes = Object.values(holeMap).sort((a, b) => a.hole - b.hole);

  return { roundDate, courseName, holes, shots };
}

window.TCParsers = {
  normaliseRoundClub,
  parseMissDir,
  extractMissDirFromComment,
  parseRoundDist,
  parseDateToISO,
  parseGolfPadTSV,
};

Object.assign(window, {
  normaliseRoundClub,
  parseGolfPadTSV,
});
