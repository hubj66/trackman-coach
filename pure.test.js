// pure.test.js
// Lightweight tests for browser-global pure helpers. Run with:
//   node pure.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');

global.window = global;

function loadScript(path) {
  // Existing app scripts are browser globals, not modules yet.
  global.eval(fs.readFileSync(path, 'utf8'));
}

loadScript('utils.js');
loadScript('golfLogic.js');
loadScript('parsers.js');
loadScript('roundLogic.js');
loadScript('rounds.js');

assert.equal(escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
assert.equal(sum([1, '2', null, 'bad']), 3);
assert.equal(avg([100, 110, 'bad']), 105);
assert.equal(Math.round(stdDev([100, 110]) * 100) / 100, 7.07);

const sessionShots = [
  { shot_time: '2026-06-05T10:00:00', carry: 100, face_angle: 2, club_path: -1, is_full_shot: true, exclude_from_progress: false },
  { shot_time: '2026-06-05T10:05:00', carry: 110, face_angle: 4, club_path: 1, is_full_shot: true, exclude_from_progress: false },
  { shot_time: '2026-06-04T10:00:00', carry: 90, face_angle: 9, club_path: 9, is_full_shot: true, exclude_from_progress: false },
];
const summary = TCGolf.summarizeLastTrackmanSession(sessionShots);
assert.equal(summary.date, '2026-06-05');
assert.equal(summary.n, 2);
assert.equal(summary.carry, 105);
assert.equal(summary.face, 3);

const filtered = TCGolf.filterAnalysisShots([
  { is_full_shot: true, exclude_from_progress: false },
  { is_full_shot: false, exclude_from_progress: false },
  { is_full_shot: true, exclude_from_progress: true },
], 'full_progress');
assert.equal(filtered.length, 1);

const golfPadTsv = [
  'Date\tPark\tHole\tPAR\tHCP\tClub\tDistance\tComment\tLie\tDir',
  '6/1/2026\tGolfpark Otelfingen\t1\t4\t10\tDriver\t180\tGood tee shot\tTee\tL',
  '6/1/2026\tGolfpark Otelfingen\t1\t4\t10\t7\t100\tOn green\tFairway\tS',
  '6/1/2026\tGolfpark Otelfingen\t1\t4\t10\tputter\t8\tLag putt\tGreen\tS',
  '6/1/2026\tGolfpark Otelfingen\t1\t4\t10\tputter\t1\tHoled\tGreen\tS',
].join('\n');

const parsed = parseGolfPadTSV(golfPadTsv);
assert.equal(parsed.roundDate, '2026-06-01');
assert.equal(parsed.courseName, 'Golfpark Otelfingen');
assert.equal(parsed.holes.length, 1);
assert.equal(parsed.shots.length, 4);
assert.equal(parsed.shots[0].miss_direction, 'left');

const roundSummary = computeRoundSummary(parsed.shots);
assert.equal(roundSummary.totalStrokes, 4);
assert.equal(roundSummary.totalPutts, 2);
assert.equal(roundSummary.holesPlayed, 1);
assert.equal(roundSummary.totalPar, 4);

console.log('pure tests ok');
