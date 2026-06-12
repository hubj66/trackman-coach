// garmin-import.js
// Garmin R10 / Garmin Golf app CSV import for trackman-coach.
// Pure parsing logic only — no Supabase calls here.
// Import/insert functions live in auth.js.

(function () {
  'use strict';

  // ── Column-name normaliser ────────────────────────────────────────────────
  // Strips parenthetical units, lowercases, trims whitespace.
  function normCol(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim();
  }

  function hasYards(raw)  { return /[\[(]y[d]?s?[\])]/i.test(raw) || /\byd[s]?\b/i.test(raw); }
  function hasMeters(raw) { return /[\[(]m[\])]/i.test(raw); }
  function hasMph(raw)    { return /mph/i.test(raw); }
  function hasKph(raw)    { return /km\/h|kph/i.test(raw); }

  // ── Field → known column aliases ─────────────────────────────────────────
  // Keys match trackman_shots columns; values are possible Garmin header names
  // after normalisation (lower, no units).
  const COL_ALIASES = {
    date:          ['date', 'date/time', 'datetime', 'shot time'],
    club:          ['club', 'club name', 'club type'],
    carry:         ['carry', 'carry distance', 'carry dist', 'carry (m)', 'carry (yds)'],
    total:         ['total', 'total distance', 'total dist', 'distance', 'total (m)', 'total (yds)'],
    side:          ['offline', 'side', 'lateral', 'deviation', 'offline dist', 'carry deviation distance'],
    total_side:    ['total deviation distance'],
    club_speed:    ['club speed', 'club head speed', 'clubhead speed'],
    ball_speed:    ['ball speed', 'ballspeed', 'ball spd', 'ball velocity'],
    smash_factor:  ['smash factor', 'smash', 'efficiency', 'smash fac'],
    launch_angle:  ['launch angle', 'launch ang', 'vert. launch', 'vertical launch angle', 'launch angle vertical'],
    launch_direction: ['launch direction', 'horizontal launch angle'],
    spin_rate:     ['backspin', 'back spin', 'total spin', 'spin rate', 'spin', 'rpm'],
    spin_rate_type:['spin rate type', 'spin type'],
    max_height:    ['apex height', 'max height', 'maximum height'],
    // Garmin R10 does not reliably output face angle / club path — omit them.
  };

  function detectColumns(headers) {
    const colIdx = {};
    const unitFlags = { distYards: false, distMeters: false, speedMph: false, speedKph: false };

    headers.forEach((raw, i) => {
      if (hasYards(raw))  unitFlags.distYards  = true;
      if (hasMeters(raw)) unitFlags.distMeters = true;
      if (hasMph(raw))    unitFlags.speedMph   = true;
      if (hasKph(raw))    unitFlags.speedKph   = true;

      const norm = normCol(raw);
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        // Match against normalised alias OR normalised raw header
        if (colIdx[field] == null && aliases.includes(norm)) {
          colIdx[field] = i;
        }
      }
    });

    return { colIdx, unitFlags };
  }

  // ── Unit conversion helpers ───────────────────────────────────────────────
  const YDS_TO_M  = 0.9144;
  const MPH_TO_MS = 0.44704;
  const KPH_TO_MS = 1 / 3.6;

  function parseNum(s) {
    if (s == null || s === '') return null;
    const n = parseFloat(String(s).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function round1(v) { return v != null ? Math.round(v * 10) / 10 : null; }

  function parseGarminDate(raw) {
    const match = String(raw || '').trim().match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*([AP]M))?$/i
    );
    if (!match) return null;
    let [, month, day, year, hour, minute, second, meridiem] = match;
    year = Number(year);
    if (year < 100) year += 2000;
    hour = Number(hour);
    if (meridiem && hour <= 12) {
      if (hour === 12) hour = 0;
      if (meridiem.toUpperCase() === 'PM') hour += 12;
    }
    const monthNum = Number(month);
    const dayNum = Number(day);
    if (hour > 23 || monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${second}`;
  }

  // ── Minimal CSV row parser (handles double-quoted fields) ─────────────────
  function parseCSVRow(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        result.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  // ── Main parser ───────────────────────────────────────────────────────────
  /**
   * Parse a Garmin Golf CSV export.
   * @param {string} csvText   Raw CSV file content
   * @param {string} unitHint  'yards' | 'meters' | 'auto'
   * @returns {{ shots: Array, error?: string, warnings: Array }}
   */
  function parseGarminCsv(csvText, unitHint = 'auto') {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Find header row: first row (in first 6) containing 'club' (case-insensitive)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      if (/\bclub\b/i.test(lines[i])) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
      return { shots: [], warnings: [], error: 'No header row found. Expected a row containing "Club".' };
    }

    const headers = parseCSVRow(lines[headerIdx]);
    const possibleUnitRow = parseCSVRow(lines[headerIdx + 1] || '');
    const hasUnitRow = possibleUnitRow.some(cell => /^\s*\[[^\]]+\]\s*$/.test(cell));
    const headersWithUnits = headers.map((header, i) =>
      hasUnitRow && possibleUnitRow[i] ? `${header} ${possibleUnitRow[i]}` : header
    );
    const { colIdx, unitFlags } = detectColumns(headersWithUnits);

    // Determine unit system
    const useYards = unitFlags.distYards
      || (unitHint === 'yards')
      || (!unitFlags.distMeters && !unitFlags.distYards && unitHint === 'auto' && false);
    // Default: meters unless header says yards or user says yards
    const distYards = useYards;
    const speedMph  = unitFlags.speedMph || (unitHint === 'mph');
    const speedKph  = unitFlags.speedKph;

    const shots = [];
    const warnings = [];
    let removedCount = 0;
    let estimatedSpinCount = 0;

    for (let i = headerIdx + 1 + (hasUnitRow ? 1 : 0); i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = parseCSVRow(line);
      if (row.every(c => !c.trim())) continue;

      function get(field)    { const idx = colIdx[field]; return idx != null ? row[idx] : null; }
      function getNum(field) { return parseNum(get(field)); }

      const shotTime = parseGarminDate(get('date'));
      const clubName = (get('club') || '').trim() || null;
      let carry       = getNum('carry');
      let total       = getNum('total');
      let side        = getNum('side');
      let total_side  = getNum('total_side');
      let club_speed  = getNum('club_speed');
      let ball_speed  = getNum('ball_speed');
      const smash     = getNum('smash_factor');
      const launch_a  = getNum('launch_angle');
      const launch_d  = getNum('launch_direction');
      let max_h       = getNum('max_height');
      const rawSpin   = getNum('spin_rate');
      const spinType  = String(get('spin_rate_type') || '').trim().toLowerCase();
      const spinMeasured = spinType === 'measured';
      const spin_r    = spinMeasured ? rawSpin : null;
      if (rawSpin != null && !spinMeasured) estimatedSpinCount++;

      // Convert distances
      if (distYards) {
        if (carry  != null) carry  = carry  * YDS_TO_M;
        if (total  != null) total  = total  * YDS_TO_M;
        if (side   != null) side   = side   * YDS_TO_M;
        if (total_side != null) total_side = total_side * YDS_TO_M;
        if (max_h != null) max_h = max_h * YDS_TO_M;
      }

      // Convert speeds
      if (club_speed != null) {
        if (speedMph) club_speed = club_speed * MPH_TO_MS;
        else if (speedKph) club_speed = club_speed * KPH_TO_MS;
      }
      if (ball_speed != null) {
        if (speedMph)     ball_speed = ball_speed * MPH_TO_MS;
        else if (speedKph) ball_speed = ball_speed * KPH_TO_MS;
        // else assume m/s already
      }

      // Bad contacts and rows without a carry value should not affect coaching.
      if (carry == null || carry < 20) {
        removedCount++;
        continue;
      }

      shots.push({
        shot_time:      shotTime,
        club:          clubName,
        carry:         round1(carry),
        total:         round1(total),
        side:          round1(side),
        total_side:    round1(total_side),
        club_speed:    round1(club_speed),
        ball_speed:    round1(ball_speed),
        smash_factor:  smash,
        launch_angle:  launch_a,
        launch_direction: launch_d,
        spin_rate:     spin_r != null ? Math.round(spin_r) : null,
        max_height:    round1(max_h),
        device:        'garmin_r10',
        is_full_shot:  true,
        exclude_from_progress: false,
      });
    }

    if (!shots.length) {
      warnings.push('No valid shots found. Check that the CSV has Carry or Total columns.');
    }
    if (removedCount) warnings.push(`${removedCount} invalid or under-20 m shots removed.`);
    if (estimatedSpinCount) warnings.push(`${estimatedSpinCount} estimated spin values ignored; only measured spin was imported.`);

    return {
      shots,
      warnings,
      removedCount,
      measuredSpinCount: shots.filter(s => s.spin_rate != null).length,
      unitFlags,
      colIdx,
    };
  }

  // ── HTML helpers ──────────────────────────────────────────────────────────
  function escHtml(v) {
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  function previewHtml(shots) {
    if (!shots.length) return '<div class="garmin-preview-empty">No valid shots detected.</div>';
    const rows = shots.slice(0, 5).map(s =>
      `<div class="garmin-preview-row">
        <span class="garmin-preview-club">${escHtml(s.club || '–')}</span>
        ${s.carry  != null ? `<span class="garmin-preview-val">${s.carry}m carry</span>` : ''}
        ${s.total  != null ? `<span class="garmin-preview-val">${s.total}m total</span>` : ''}
        ${s.side   != null ? `<span class="garmin-preview-side">${s.side >= 0 ? '+' : ''}${s.side}m</span>` : ''}
        ${s.smash_factor != null ? `<span class="garmin-preview-val">${s.smash_factor.toFixed(2)} smash</span>` : ''}
      </div>`
    ).join('');
    const more = shots.length > 5
      ? `<div class="garmin-preview-more">…and ${shots.length - 5} more shots</div>` : '';
    return `<div class="garmin-preview-list">${rows}${more}</div>`;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.GarminImport = { parseGarminCsv, previewHtml };
})();
