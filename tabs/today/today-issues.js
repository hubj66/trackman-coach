// today-issues.js -- Issue detection, health tiles, trend detection, practice phase
// Functions: _issueIdForDetected, _enrichIssueFromDict, _confLabel, _detectTodayIssues,
//   _mergeTodayIssues, _buildClubHealthIssues, _buildHealthTiles, _detectImprovement,
//   _detectRegression, _detectPracticePhase

// ── Dict_golf enrichment ───────────────────────────────────────────────────

function _issueIdForDetected(issue) {
  const { key, club: ck } = issue;
  if (key.startsWith('face_')) {
    const isOpen = issue.simple.includes('open');
    if (ck === 'driver') return isOpen ? 'drv_open_face_slice' : 'drv_closed_face_hook';
    return isOpen ? null : 'iron_pull_left';
  }
  if (key.startsWith('attack_')) return 'iron_fat';
  if (key.startsWith('consist_'))
    return ['pw','58','sw'].includes(ck) ? 'wedge_distance_control_unstable' : 'iron_contact_inconsistent';
  if (key.startsWith('smash_'))
    return ck === 'driver' ? 'drv_heel_strike_fade' : 'iron_thin';
  if (key === 'putting_short') return 'putt_short_conversion_low';
  return null;
}

function _enrichIssueFromDict(issue) {
  if (!_golfDict) return issue;
  const issueId = _issueIdForDetected(issue);
  if (!issueId) return issue;
  for (const g of _golfDict.issue_groups) {
    const di = g.issues.find(i => i.issue_id === issueId);
    if (!di) continue;
    const drill = di.prioritized_drills?.[0];
    if (drill?.steps?.length)
      issue.drill = `${drill.name} (${drill.balls_or_time}): ${drill.steps[0]}`;
    const numeric = di.success_criteria?.numeric?.[0];
    if (numeric) issue.goal = numeric;
    const pitfall = di.common_pitfalls?.[0];
    if (pitfall) issue.deeper += ` Common pitfall: ${pitfall}.`;
    break;
  }
  return issue;
}

// ── Issue detection ────────────────────────────────────────────────────────

function _confLabel(conf) {
  return conf < 0.4 ? 'Emerging' : conf < 0.7 ? 'Likely' : 'Confirmed';
}

function _detectTodayIssues(allShots, puttSessions) {
  const CA = window.clubAliases;
  if (!CA) return [];
  const issues = [];

  const CLUB_IMPACT = { driver:1.2, '6':1.0, '7':1.0, '8':1.0, '9':1.0, pw:1.15, '58':1.15, sw:1.15 };

  for (const [ck, impact] of Object.entries(CLUB_IMPACT)) {
    const clubShots = allShots.filter(s => CA.shotMatchesClub(s, ck)).slice(0, 40);
    if (clubShots.length < 12) continue;

    const n    = clubShots.length;
    const conf = Math.min(n / 30, 1);
    const clubName = CA.clubLabel(ck);
    const confLabel = _confLabel(conf);
    const lowConf   = n < 30;

    // Recency: exponential decay with 21-day half-life
    const daysSince = clubShots[0]?.shot_time
      ? (Date.now() - new Date(clubShots[0].shot_time)) / 86400000 : 0;
    const recency = Math.max(0.5, Math.exp(-daysSince / 21));

    const faces   = clubShots.map(s=>s.face_angle).filter(x=>x!=null);
    const ftps    = clubShots.map(s=>s.face_to_path).filter(x=>x!=null);
    const carries = clubShots.map(s=>s.carry).filter(Boolean);
    const smashes = clubShots.map(s=>s.smash_factor).filter(Boolean);
    const attacks = clubShots.map(s=>s.attack_angle).filter(x=>x!=null);

    // Direction / face bias
    if (faces.length >= 10) {
      const avgFace = statAvg(faces);
      const avgFTP  = ftps.length ? statAvg(ftps) : null;
      if (avgFace != null && Math.abs(avgFace) > 2) {
        const badFacePct = faces.filter(f => Math.abs(f) > 2).length / faces.length;
        const sev = Math.min((Math.abs(avgFace) / 7) * 0.45 + badFacePct * 0.9, 1);
        const isOpen = avgFace > 0;
        const sliceBias = avgFTP != null && avgFTP > 3.5;
        const hookBias  = avgFTP != null && avgFTP < -3.5;
        const support = [
          `Face avg: ${fSign(avgFace,1)}°`,
          `Bad face: ${Math.round(badFacePct * 100)}%`,
          ftps.length ? `FTP: ${fSign(avgFTP,1)}°` : null,
        ].filter(Boolean).join(' · ');
        issues.push({
          key: `face_${ck}`, club: ck, clubName, type: 'direction',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * recency * (['9','pw','58','sw'].includes(ck) ? 1.2 : 1.0),
          simple: isOpen
            ? (sliceBias ? `${clubName} face is open — ball starts and curves right` : `${clubName} face is open — ball starting right`)
            : (hookBias  ? `${clubName} face is closed — ball starts and curves left` : `${clubName} face is closed — ball starting left`),
          support,
          deeper: isOpen
            ? `Face angle is what starts the ball's direction. Averaging ${fSign(avgFace,1)}° open means the ball launches right of target.${sliceBias ? ` Face-to-path of ${fSign(avgFTP,1)}° compounds it — the ball keeps curving right throughout the flight. This is the root cause, not the path.` : ''}`
            : `A closed face starts the ball left.${hookBias ? ` Face-to-path of ${fSign(avgFTP,1)}° adds curve to the left. Address grip and face awareness at impact first.` : ''}`,
          drill: isOpen
            ? 'Face control: half-swings, feel face neutral at impact (target -1° to +2°)'
            : 'Face control: check grip, practice feeling the face square through the ball',
          goal:  `Face avg inside ±2° · Start line tighter`,
          durationMin: 40,
        });
      }
    }

    // Iron attack angle
    if (['6','7','8','9','pw'].includes(ck) && attacks.length >= 8) {
      const avgAttack = statAvg(attacks);
      if (avgAttack != null && avgAttack > -2) {
        const sev = Math.min((avgAttack + 2) / 5, 1);
        issues.push({
          key: `attack_${ck}`, club: ck, clubName, type: 'contact',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 1.1 * recency,
          simple: `${clubName} — not hitting down enough, ball getting scooped`,
          support: `Attack angle: ${fSign(avgAttack,1)}° (needs to be below -2°)`,
          deeper: `Irons should strike with a descending blow. TrackMan defines negative attack angle as the club moving downward into the ball, compressing it properly. At ${fSign(avgAttack,1)}° you're scooping through impact — this produces inconsistent carry distances and weak ball flight.`,
          drill: 'Low-point drill: ball position back, hands forward, hit down and through',
          goal:  `Attack angle below -2° on 6+ of 10 shots`,
          durationMin: 40,
        });
      }
    }

    // Carry consistency
    if (['pw','58','sw'].includes(ck)) {
      const wedgeWindows = _buildWedgeWindows(clubShots);
      const worstWindow = _worstWedgeWindow(wedgeWindows);
      const offTargetWindow = wedgeWindows
        .map(w => ({ ...w, targetInfo: _wedgeTargetDelta(ck, w.label, w.avg) }))
        .filter(w => w.n >= 4 && w.targetInfo && Math.abs(w.targetInfo.delta) > 3)
        .sort((a,b) => Math.abs(b.targetInfo.delta) - Math.abs(a.targetInfo.delta))[0];
      const chosenWindow = offTargetWindow || worstWindow;
      const targetInfo = chosenWindow ? _wedgeTargetDelta(ck, chosenWindow.label, chosenWindow.avg) : null;
      if (chosenWindow && (chosenWindow.sd > 5 || targetInfo)) {
        const spreadSev = chosenWindow.sd != null ? Math.min(chosenWindow.sd / 10, 1) : 0;
        const targetSev = targetInfo ? Math.min(Math.abs(targetInfo.delta) / 8, 1) : 0;
        const sev = Math.max(spreadSev, targetSev);
        const targetText = targetInfo ? ` · target ${f(targetInfo.target,0)}m · ${targetInfo.delta > 0 ? '+' : ''}${f(targetInfo.delta,0)}m` : '';
        const simple = targetInfo && Math.abs(targetInfo.delta) > 3
          ? `${clubName} ${chosenWindow.label} is ${targetInfo.delta > 0 ? 'long' : 'short'} vs target`
          : `${clubName} ${chosenWindow.label} distance needs tightening`;
        issues.push({
          key: `wedge_window_${ck}_${chosenWindow.label.replace(/[^a-z0-9]/gi,'_')}`,
          club: ck, clubName, type: 'consistency',
          n: chosenWindow.n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.95 * recency,
          simple,
          support: `${chosenWindow.n} shots · avg ${f(chosenWindow.avg,0)}m · spread ±${f(chosenWindow.sd,1)}m${targetText}`,
          deeper: `${clubName} wedges are judged inside each partial-shot window and compared with your target matrix. The goal is repeatability plus calibration: the same window should finish close to its intended carry.`,
          drill: `${chosenWindow.label} calibration ladder: 12 balls to ${targetInfo ? `${f(targetInfo.target,0)}m` : 'one carry window'}, score only shots inside ±3m`,
          goal:  targetInfo ? `${chosenWindow.label} average within ±3m of ${f(targetInfo.target,0)}m` : `${chosenWindow.label} carry spread below ±5m`,
          durationMin: 25,
        });
      }
    } else if (carries.length >= 10) {
      const sdCarry = statStdDev(carries);
      const thresh  = 14;
      if (sdCarry != null && sdCarry > thresh) {
        const sev = Math.min(sdCarry / (thresh * 1.8), 1);
        const med = statMedian(carries);
        issues.push({
          key: `consist_${ck}`, club: ck, clubName, type: 'consistency',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.85 * recency,
          simple: `${clubName} distance is unreliable - carry spread too wide`,
          support: `Median ${f(med,0)}m · spread ±${f(sdCarry,1)}m`,
          deeper: `Carry SD of ${f(sdCarry,1)}m (target below ${thresh}m) means your distances are unpredictable under pressure. The goal isn't hitting it further - it's knowing exactly how far you'll carry each shot so club selection isn't a guess.`,
          drill: 'Consistency block: 10 shots to one target, same swing pace each time',
          goal:  `Carry SD below ${thresh}m`,
          durationMin: 30,
        });
      }
    }

    // Smash factor (contact)
    if (smashes.length >= 8) {
      const avgSmash = statAvg(smashes);
      const target   = ck === 'driver' ? 1.42 : 1.28;
      if (avgSmash != null && avgSmash < target - 0.03) {
        const sev = Math.min((target - avgSmash) / 0.10, 1);
        issues.push({
          key: `smash_${ck}`, club: ck, clubName, type: 'contact',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.8 * recency,
          simple: `${clubName} contact is off-centre — energy transfer too low`,
          support: `Smash factor: ${f(avgSmash,2)} (target ${target}+)`,
          deeper: `Smash factor = ball speed ÷ club speed. At ${f(avgSmash,2)} you're losing energy to off-centre strikes. Every 0.05 smash improvement is roughly 5m more carry with the same swing — no extra effort required.`,
          drill: 'Strike drill: impact tape / tee-peg on ground, focus on centre strike',
          goal:  `Smash above ${target}`,
          durationMin: 35,
        });
      }
    }
  }

  // Short putt weakness
  if (puttSessions && puttSessions.length >= 2) {
    const sp    = puttSessions.filter(p => p.distance_m != null && p.distance_m <= 2);
    const holed = sp.reduce((a,b)=>a+(b.holed||0),0);
    const total = sp.reduce((a,b)=>a+(b.total||0),0);
    if (sp.length >= 2 && total > 0) {
      const makeRate = holed / total;
      if (makeRate < 0.75) {
        const sev = Math.min((0.85 - makeRate) * 3, 1);
        const pConf = Math.min(sp.length/5,1);
        issues.push({
          key: 'putting_short', club: 'putter', clubName: 'Putting', type: 'putting',
          n: total, conf: pConf, confLabel: _confLabel(pConf), lowConf: sp.length < 5,
          score: sev * pConf * 1.3,
          simple: `Short putts leaking strokes — ${Math.round(makeRate*100)}% make rate inside 2m`,
          support: `${holed}/${total} made · target is 80%+`,
          deeper: `Short putts inside 2m should be your highest conversion rate. Every miss drops a free stroke and puts pressure on your approach game. Gate drills build the consistent stroke needed to convert these under pressure.`,
          drill: 'Gate drill: 2 tees as gate, 20 pressure putts at 1m then 1.5m',
          goal:  '80%+ make rate inside 2m',
          durationMin: 25,
        });
      }
    }
  }

  issues.forEach(i => _enrichIssueFromDict(i));
  return issues.sort((a,b) => b.score - a.score);
}

function _mergeTodayIssues(detected, healthIssues) {
  const byKey = new Map();
  [...(detected || []), ...(healthIssues || [])].forEach(issue => {
    if (!issue?.key) return;
    const existing = byKey.get(issue.key);
    if (!existing || (issue.score || 0) > (existing.score || 0)) byKey.set(issue.key, issue);
  });
  return [...byKey.values()].sort((a,b) => (b.score || 0) - (a.score || 0));
}

function _buildClubHealthIssues(allShots) {
  const CA = window.clubAliases;
  if (!CA) return [];
  const clubKeys = ['driver','6','7','8','9','pw','58','sw'];
  return clubKeys.map(ck => {
    const shots = (allShots || []).filter(s => CA.shotMatchesClub(s, ck)).slice(0, 40);
    if (shots.length < 8) return null;
    const carries = shots.map(s => s.carry).filter(Boolean);
    const sides = shots.map(s => s.side).filter(x => x != null);
    const faces = shots.map(s => s.face_angle).filter(x => x != null);
    const paths = shots.map(s => s.club_path).filter(x => x != null);
    const ftps = shots.map(s => s.face_to_path).filter(x => x != null);
    const carrySD = statStdDev(carries);
    const sideAvg = sides.length ? statAvg(sides) : null;
    const faceAvg = faces.length ? statAvg(faces) : null;
    const faceSD = statStdDev(faces);
    const pathAvg = paths.length ? statAvg(paths) : null;
    const ftpAvg = ftps.length ? statAvg(ftps) : null;
    const reasons = [];
    let score = 0;

    if (carrySD != null && carrySD > (['pw','58','sw'].includes(ck) ? 7 : 13)) {
      score += Math.min(carrySD / 20, 1) * 0.65;
      reasons.push(`carry spread +/-${f(carrySD,1)}m`);
    }
    if (sideAvg != null && Math.abs(sideAvg) > 7) {
      score += Math.min(Math.abs(sideAvg) / 18, 1) * 0.65;
      reasons.push(`miss ${Math.abs(Math.round(sideAvg))}m ${sideAvg > 0 ? 'right' : 'left'}`);
    }
    if (faceAvg != null && Math.abs(faceAvg) > 2.5) {
      score += Math.min(Math.abs(faceAvg) / 7, 1) * 0.75;
      reasons.push(`face ${fSign(faceAvg,1)} deg`);
    }
    if (faceSD != null && faceSD > 3.5) {
      score += Math.min(faceSD / 7, 1) * 0.45;
      reasons.push(`face scatter +/-${f(faceSD,1)} deg`);
    }
    if (!reasons.length || score < 0.55) return null;

    const clubName = CA.clubLabel(ck);
    const avgPathText = pathAvg != null ? ` Path ${fSign(pathAvg,1)} deg.` : '';
    const avgFtpText = ftpAvg != null ? ` Face-to-path ${fSign(ftpAvg,1)} deg.` : '';
    const conf = Math.min(shots.length / 30, 1);
    return {
      key:`health_${ck}`,
      club:ck,
      clubName,
      type:'club_health',
      n:shots.length,
      conf,
      confLabel:_confLabel(conf),
      lowConf:shots.length < 30,
      priority:2,
      score:score * Math.min(shots.length / 20, 1),
      simple:`${clubName} is the weakest health signal today`,
      support:reasons.slice(0, 3).join(' / '),
      deeper:`Club Health combines distance spread, miss side, face bias and face scatter.${avgPathText}${avgFtpText}`,
      drill:faceAvg != null && Math.abs(faceAvg) > 2.5
        ? '6-shot face control test: normal feel, then earlier release feel. Keep the one that moves face closer to 0.'
        : '10-ball trust test: same target, full routine, record carry and miss side.',
      goal:faceAvg != null && Math.abs(faceAvg) > 2.5
        ? 'Face closer to 0 deg and lower scatter'
        : 'Smaller carry spread and predictable miss side',
      durationMin:['pw','58','sw'].includes(ck) ? 25 : 35,
    };
  }).filter(Boolean);
}

// ── Health tiles ──────────────────────────────────────────────────────────

function _buildHealthTiles(allShots, chipSessions, puttSessions) {
  const CA = window.clubAliases;
  const tiles = [];

  if (CA) {
    // Driver playable rate
    const ds = allShots.filter(s => CA.shotMatchesClub(s,'driver')).slice(0,30);
    const dSide = ds.filter(s => s.side != null);
    if (dSide.length >= 5) {
      const playable = dSide.filter(s => Math.abs(s.side) <= 20).length;
      const rate = Math.round(playable / dSide.length * 100);
      tiles.push({ label:'Tee shots', value:rate+'%', sub:'playable', cls: rate>=70?'good':rate>=50?'ok':'bad' });
    }

    // 7-iron carry SD
    const is = allShots.filter(s => CA.shotMatchesClub(s,'7')).slice(0,30);
    const iCarries = is.map(s=>s.carry).filter(Boolean);
    if (iCarries.length >= 5) {
      const sd  = statStdDev(iCarries);
      const med = statMedian(iCarries);
      tiles.push({ label:'7-iron', value:'±'+f(sd,0)+'m', sub:f(med,0)+'m median', cls: sd<8?'good':sd<14?'ok':'bad' });
    }
  }

  // Chipping inside 2m
  if (chipSessions && chipSessions.length >= 2) {
    const total = chipSessions.reduce((a,b)=>a+(b.attempts||0),0);
    const in2m  = chipSessions.reduce((a,b)=>a+(b.inside_1m||0)+(b.between_1_2m||0),0);
    if (total > 0) {
      const rate = Math.round(in2m/total*100);
      tiles.push({ label:'Chipping', value:rate+'%', sub:'inside 2m', cls: rate>=60?'good':rate>=40?'ok':'bad' });
    }
  }

  // Putting 1–2m make rate
  if (puttSessions && puttSessions.length >= 2) {
    const sp    = puttSessions.filter(p => p.distance_m != null && p.distance_m <= 2);
    const holed = sp.reduce((a,b)=>a+(b.holed||0),0);
    const total = sp.reduce((a,b)=>a+(b.total||0),0);
    if (sp.length >= 2 && total > 0) {
      const rate = Math.round(holed/total*100);
      tiles.push({ label:'Putting', value:rate+'%', sub:'1–2m made', cls: rate>=80?'good':rate>=65?'ok':'bad' });
    }
  }

  return tiles;
}

// ── Trend detection ───────────────────────────────────────────────────────

function _detectImprovement(allShots) {
  const CA = window.clubAliases;
  if (!CA) return null;
  let best = null;

  for (const ck of ['driver','7','6','9','pw','58']) {
    const cs = allShots.filter(s => CA.shotMatchesClub(s, ck));
    if (cs.length < 24) continue;

    const recent = cs.slice(0, 15);
    const prev   = cs.slice(15, 30);

    const rSD = statStdDev(recent.map(s=>s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s=>s.carry).filter(Boolean));
    if (rSD != null && pSD != null && pSD - rSD > 2) {
      const delta = pSD - rSD;
      if (!best || delta > best.delta) {
        best = { delta, text: `${CA.clubLabel(ck)} carry spread improved: ±${f(pSD,0)}m → ±${f(rSD,0)}m` };
      }
    }

    const rFaces = recent.map(s=>s.face_angle).filter(x=>x!=null);
    const pFaces = prev.map(s=>s.face_angle).filter(x=>x!=null);
    if (rFaces.length >= 6 && pFaces.length >= 6) {
      const rAbs = Math.abs(statAvg(rFaces)||0), pAbs = Math.abs(statAvg(pFaces)||0);
      const delta = pAbs - rAbs;
      if (delta > 0.8 && (!best || delta > best.delta * 0.6)) {
        best = { delta, text: `${CA.clubLabel(ck)} face angle improving: avg ${fSign(statAvg(pFaces),1)}° → ${fSign(statAvg(rFaces),1)}°` };
      }
    }
  }
  return best;
}

function _detectRegression(allShots) {
  const CA = window.clubAliases;
  if (!CA) return null;
  let worst = null;

  for (const ck of ['driver','7','6','9','pw','58']) {
    const cs = allShots.filter(s => CA.shotMatchesClub(s, ck));
    if (cs.length < 20) continue;

    const recent = cs.slice(0, 10);
    const prev   = cs.slice(10, 25);

    const rSD = statStdDev(recent.map(s=>s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s=>s.carry).filter(Boolean));
    if (rSD != null && pSD != null && rSD - pSD > 3) {
      const delta = rSD - pSD;
      if (!worst || delta > worst.delta) {
        worst = { delta, text: `${CA.clubLabel(ck)} carry spread widening: ±${f(pSD,0)}m → ±${f(rSD,0)}m` };
      }
    }
  }
  return worst;
}

// ── Render ────────────────────────────────────────────────────────────────

function _detectPracticePhase(issue) {
  if (!issue || !_todayAllShots || _todayAllShots.length < 20) return 'technical';
  const CA = window.clubAliases;
  if (!CA) return 'technical';

  const clubShots = _todayAllShots.filter(s => CA.shotMatchesClub(s, issue.club));
  if (clubShots.length < 20) return 'technical';

  const recent = clubShots.slice(0, 10);
  const prev   = clubShots.slice(10, 20);

  if (issue.type === 'direction') {
    const rFaces = recent.map(s => s.face_angle).filter(x => x != null);
    const pFaces = prev.map(s => s.face_angle).filter(x => x != null);
    if (rFaces.length >= 5 && pFaces.length >= 5) {
      const rAbs = Math.abs(statAvg(rFaces) || 0);
      const pAbs = Math.abs(statAvg(pFaces) || 0);
      if (pAbs - rAbs > 0.8) return 'transfer';
    }
  } else if (issue.type === 'consistency') {
    const rSD = statStdDev(recent.map(s => s.carry).filter(Boolean));
    const pSD = statStdDev(prev.map(s => s.carry).filter(Boolean));
    if (rSD != null && pSD != null && pSD - rSD > 2) return 'transfer';
  } else if (issue.type === 'contact') {
    const rSmash = statAvg(recent.map(s => s.smash_factor).filter(Boolean));
    const pSmash = statAvg(prev.map(s => s.smash_factor).filter(Boolean));
    if (rSmash != null && pSmash != null && rSmash - pSmash > 0.02) return 'transfer';
  }

  return 'technical';
}
