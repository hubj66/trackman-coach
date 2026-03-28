// engine.js — diagnosis logic for each club
// Edit the fault thresholds and tip text here when improving recommendations

function diagnose() {
  ({ driver: diagDriver, irons: diagIrons, wedge: diagWedge, putter: diagPutter })[club]?.();
}

function diagDriver() {
  const face = getVal('face'), path = getVal('path'), attack = getVal('attack'),
        spin = getVal('spin'), smash = getVal('smash');
  const faults = [], tips = [];

  if (Math.abs(face) > 3)  faults.push(`face ${face > 0 ? '+' : ''}${face}° (${face > 0 ? 'open → starts RIGHT' : 'closed → starts LEFT'})`);
  if (path < -5)            faults.push(`path ${path}° (out-to-in → slice)`);
  if (path > 5)             faults.push(`path +${path}° (very in-to-out → hook risk)`);
  if (spin > 3200)          faults.push(`spin ${spin} rpm (too high → less distance)`);
  if (smash < 1.40)         faults.push(`smash ${smash.toFixed(2)} (off-center contact)`);

  if (!faults.length) {
    setBanner('Driver numbers look good! Focus on consistency — repeat these numbers shot after shot.', 'banner-good');
    setTips([
      'Log sessions and track averages. Aim for face angle variation under ±2° between shots.',
      'Push smash factor toward 1.48 by focusing on center contact every swing.',
      'Once consistent, fine-tune launch angle and spin for more distance.',
    ]);
    return;
  }

  setBanner(`<b>Driver faults:</b> ${faults.join(' · ')}.`, 'banner-bad');

  if (Math.abs(face) > 3)
    tips.push(`<b>Face ${face > 0 ? '+' : ''}${face}°:</b> ${face > 0
      ? 'Close grip slightly — rotate both hands right on the handle. Check forearm rotation through impact — you are leaving the face open.'
      : 'Open grip slightly — check you are not rolling wrists too early through impact.'}`);

  if (path < -5)
    tips.push(`<b>Path ${path}° (out-to-in):</b> Drop right foot back 5 cm at address. This promotes in-to-out path automatically. Hit 10 shots targeting path above −3° before worrying about distance.`);

  if (spin > 3200 && tips.length < 3)
    tips.push(`<b>Spin ${spin} rpm:</b> High spin comes from open face or steep attack. Fix face angle first. Also try teeing ball slightly higher and 1 cm more forward in stance.`);

  if (smash < 1.38 && tips.length < 3)
    tips.push(`<b>Smash ${smash.toFixed(2)}:</b> Use face impact tape to find your contact pattern. Practice 20 slow swings focusing on returning the clubhead to the exact same spot.`);

  const fill = [
    'Average face angle and path across 20 shots — improvement shows in averages, not individual shots.',
    'Check grip pressure — tension is the #1 cause of inconsistent face angle.',
    'Focus on one fault at a time. Re-test in your next session.',
  ];
  while (tips.length < 3) tips.push(fill[tips.length - 1]);
  setTips(tips.slice(0, 3));
}

function diagIrons() {
  const attack = getVal('attack'), face = getVal('face'), path = getVal('path'),
        launch = getVal('launch'), smash = getVal('smash');
  const faults = [], tips = [];

  if (attack > -2)          faults.push(`attack ${attack > 0 ? '+' : ''}${attack}° (${attack > 0 ? 'scooping UP' : 'too level'})`);
  if (Math.abs(face) > 2)   faults.push(`face ${face > 0 ? '+' : ''}${face}° (${face > 0 ? 'open → right miss' : 'closed → left miss'})`);
  if (launch > 22)          faults.push(`launch ${launch}° (too high — caused by scoop)`);
  if (Math.abs(path) > 6)   faults.push(`path ${path}° (too extreme)`);
  if (smash < 1.30)         faults.push(`smash ${smash.toFixed(2)} (off-center)`);

  if (!faults.length) {
    setBanner('Iron numbers in a good range. Focus on consistency and repeatability.', 'banner-good');
    setTips([
      'Check divot position — it should appear just after where the ball was, never before.',
      'Aim for smash factor 1.35+ on every strike. Use face tape to track contact.',
      'Map distance gapping — know exactly how far each iron goes with these numbers.',
    ]);
    return;
  }

  setBanner(`<b>Iron faults:</b> ${faults.join(' · ')}.`, 'banner-bad');

  if (attack > -2)
    tips.push(`<b>Attack ${attack > 0 ? '+' : ''}${attack}° (scoop):</b> Move ball 1–2 cm back in stance. Tee a ball 10 cm in front and try to clip it after contact. Do 30 reps watching only attack angle — get it below −2°.`);

  if (Math.abs(face) > 2 && tips.length < 3)
    tips.push(`<b>Face ${face > 0 ? '+' : ''}${face}°:</b> ${face > 0
      ? 'Strengthen grip — weak grip (V at chin) causes open face. Rotate hands right slightly.'
      : 'Forearms rotating too fast — feel the face stay square longer through impact.'}`);

  if (launch > 22 && tips.length < 3)
    tips.push(`<b>Launch ${launch}° (too high):</b> Directly caused by the scoop. Fix attack angle and launch drops automatically into 16–22°. Track both numbers together.`);

  if (smash < 1.30 && tips.length < 3)
    tips.push(`<b>Smash ${smash.toFixed(2)}:</b> Use face impact tape on your iron. Thin contact is caused by scooping — fix attack angle and smash improves automatically.`);

  const fill = [
    'Record average attack angle per session. Target below −2° consistently.',
    'One number per session — do not try to fix everything at once.',
    'Ask your pro to watch low point — where the club bottoms out is the root cause.',
  ];
  while (tips.length < 3) tips.push(fill[tips.length - 1]);
  setTips(tips.slice(0, 3));
}

function diagWedge() {
  const attack = getVal('attack'), face = getVal('face'), spin = getVal('spin');
  const faults = [], tips = [];

  if (attack > -4)          faults.push(`attack ${attack > 0 ? '+' : ''}${attack}° (not steep enough)`);
  if (Math.abs(face) > 2)   faults.push(`face ${face > 0 ? '+' : ''}${face}° (${face > 0 ? 'open' : 'closed'})`);
  if (spin < 6000)          faults.push(`spin ${spin} rpm (too low — ball won't stop)`);

  if (!faults.length) {
    setBanner('Wedge numbers look good. Build your distance map now.', 'banner-good');
    setTips([
      '10 shots at 50 yards, 10 at 75, 10 at 100 — record average carry for each. This is your distance card.',
      'Practice half and three-quarter swings. Confirm carry distances are consistent.',
      'Once distances mapped, work on spin consistency — same carry + same spin = same result.',
    ]);
    return;
  }

  setBanner(`<b>Wedge faults:</b> ${faults.join(' · ')}.`, 'banner-bad');

  if (attack > -4)
    tips.push(`<b>Attack ${attack > 0 ? '+' : ''}${attack}°:</b> Hands forward at address — shaft leans toward target. Feel like you are hitting DOWN and through, not scooping. Get attack angle to at least −4° on Trackman.`);

  if (Math.abs(face) > 2 && tips.length < 3)
    tips.push(`<b>Face ${face > 0 ? '+' : ''}${face}°:</b> At 80 yards, 3° open misses the green completely. Check grip and square face at address. Slow down practice swings and feel face square at impact.`);

  if (spin < 6000 && tips.length < 3)
    tips.push(`<b>Spin ${spin} rpm:</b> Low spin = scooping or thin contact. Fix attack angle first — proper downward strike increases spin naturally without any other change.`);

  const fill = [
    'Map carry distances — 10 shots at 50, 75, 100 yards.',
    'Consistent tempo matters — wild swings cause distance inconsistency.',
    'Ball position centered or slightly back — forward ball causes thin contact.',
  ];
  while (tips.length < 3) tips.push(fill[tips.length - 1]);
  setTips(tips.slice(0, 3));
}

function diagPutter() {
  const face = getVal('face'), launch = getVal('launch');
  const faults = [], tips = [];

  if (Math.abs(face) > 1)     faults.push(`face ${face > 0 ? '+' : ''}${face}° (${face > 0 ? 'open → misses right' : 'closed → misses left'})`);
  if (launch < 1 || launch > 4) faults.push(`launch ${launch}° (${launch < 1 ? 'pressing down — ball bounces' : 'too upward'})`);

  if (!faults.length) {
    setBanner('Putting numbers look solid. Focus on speed control and green reading.', 'banner-good');
    setTips([
      'Speed ladder — 5 putts from 10, 20 and 30 ft. Record ball speed for each. This becomes your distance reference.',
      'Green reading — good numbers with bad read still misses. Combine Trackman data with slope awareness.',
      'Gate drill — two tees just wider than putter face, 20 cm ahead. Keeps path and face honest.',
    ]);
    return;
  }

  setBanner(`<b>Putting faults:</b> ${faults.join(' · ')}.`, 'banner-bad');

  if (Math.abs(face) > 1)
    tips.push(`<b>Face ${face > 0 ? '+' : ''}${face}°:</b> ${face > 0
      ? 'Face open at impact. Lay an alignment rod along your putter face at address — check it points at the hole. Hit 20 putts watching only face angle. Get it within ±1° every time.'
      : 'Closing face too early. Lighter grip pressure and feel the face stay square through impact.'}`);

  if ((launch < 1 || launch > 4) && tips.length < 3)
    tips.push(`<b>Launch ${launch}°:</b> ${launch < 1
      ? 'Pressing down — ball bounces before rolling. Move ball 1 cm forward in stance.'
      : 'Too upward — move ball 1 cm back and feel a level strike at impact.'}`);

  tips.push('20 putts at 10 feet, watching only face angle. Ignore the result — purely focus on ±1° every putt. Once consistent at 10 ft, extend to 20 ft.');
  setTips(tips.slice(0, 3));
}
