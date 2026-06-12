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

loadScript('core/utils.js');
loadScript('core/golfLogic.js');
loadScript('rounds/parsers.js');
loadScript('rounds/garmin-import.js');
loadScript('rounds/roundLogic.js');
loadScript('rounds/rounds.js');

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

const garminCsv = [
  'Date,Player,Club Type,Club Speed,Attack Angle,Club Path,Club Face,Face to Path,Ball Speed,Smash Factor,Launch Angle,Launch Direction,Backspin,Sidespin,Spin Rate,Spin Rate Type,Spin Axis,Apex Height,Carry Distance,Carry Deviation Angle,Carry Deviation Distance,Total Distance,Total Deviation Angle,Total Deviation Distance',
  ',,,[km/h],[deg],[deg],[deg],[deg],[km/h],,[deg],[deg],[rpm],[rpm],[rpm],,[deg],[m],[m],[deg],[m],[m],[deg],[m]',
  '06/11/26 18:02:30 PM,Joel,9 Iron,36,-4,2,1,-1,72,2,18,0,3000,0,3000,Estimated,0,1,11,0,-1,20,0,-2',
  '06/11/26 18:02:48 PM,Joel,9 Iron,108,-5,3,2,-1,144,1.33,19,1,7000,0,7000,Measured,0,16,102,0,2,109,0,3',
].join('\n');
const garmin = GarminImport.parseGarminCsv(garminCsv);
assert.equal(garmin.shots.length, 1);
assert.equal(garmin.removedCount, 1);
assert.equal(garmin.measuredSpinCount, 1);
assert.equal(garmin.shots[0].device, 'garmin_r10');
assert.equal(garmin.shots[0].club, '9 Iron');
assert.equal(garmin.shots[0].club_speed, 30);
assert.equal(garmin.shots[0].ball_speed, 40);
assert.equal(garmin.shots[0].spin_rate, 7000);
assert.equal(garmin.shots[0].shot_time, '2026-06-11T18:02:48');
assert.equal(garmin.shots[0].face_angle, undefined);
assert.equal(garmin.shots[0].club_path, undefined);

const roundSummary = computeRoundSummary(parsed.shots);
assert.equal(roundSummary.totalStrokes, 4);
assert.equal(roundSummary.totalPutts, 2);
assert.equal(roundSummary.holesPlayed, 1);
assert.equal(roundSummary.totalPar, 4);

console.log('pure tests ok');
