// today-focus.js -- Focus selector chips and per-club Today sections
// Functions: _renderFocusChips, setTodayFocus, _getPracticeContext, setTodayPracticeContext,
//   _renderPracticeContextBar, _issueCategory, _contextAllowsIssue, _planForCurrentContext,
//   _filterIssuesForContext, _renderTodayPage, _renderClubFocusSection, _buildFocusStats,
//   _isWedgeKey, _wedgeWindowLabel, _buildWedgeWindows, _worstWedgeWindow, _wedgeTargetDelta,
//   _renderWedgeWindowCard, _detectFocusIssue, _renderFocusStatsCard, _renderFocusTechnicalCard,
//   _renderFocusIssueCard, _renderFocusNoIssueCard, _renderFocusQuickActions, _renderFocusTrainCard,
//   _renderChippingFocus, _renderPuttingFocus

// ── Focus selector functions ──────────────────────────────────────────────

function _renderFocusChips() {
  return `<div class="today-focus-bar">${
    TODAY_FOCUS_LABELS.map(f =>
      `<button class="today-focus-chip${_todayFocus===f.key?' active':''}" onclick="setTodayFocus('${f.key}')">${escapeHtml(f.label)}</button>`
    ).join('')
  }</div>`;
}

window.setTodayFocus = function(key) {
  if (!_todayAllShots) return;
  _todayFocus = key;
  _todayTrainingIssue = null;       // exit training view when focus changes
  _renderTodayPage();
};

function _getPracticeContext() {
  try {
    const saved = localStorage.getItem('today_practice_context');
    return TODAY_PRACTICE_CONTEXTS.some(c => c.key === saved) ? saved : 'range';
  } catch(e) {
    return 'range';
  }
}

window.setTodayPracticeContext = function(key) {
  if (!TODAY_PRACTICE_CONTEXTS.some(c => c.key === key)) return;
  _todayPracticeContext = key;
  try { localStorage.setItem('today_practice_context', key); } catch(e) {}
  _renderTodayPage();
};

function _renderPracticeContextBar() {
  const active = TODAY_PRACTICE_CONTEXTS.find(c => c.key === _todayPracticeContext) || TODAY_PRACTICE_CONTEXTS[0];
  return `<div class="today-context-wrap">
    <div class="today-context-label">Today I can practice</div>
    <div class="today-context-bar">
      ${TODAY_PRACTICE_CONTEXTS.map(c =>
        `<button class="today-context-chip${_todayPracticeContext===c.key?' active':''}" onclick="setTodayPracticeContext('${c.key}')">${escapeHtml(c.label)}</button>`
      ).join('')}
    </div>
    <div class="today-context-desc">${escapeHtml(active.desc)}</div>
  </div>`;
}

function _issueCategory(issue) {
  if (!issue) return 'other';
  if (issue.type === 'putting' || issue.club === 'putter') return 'putting';
  if (['pw','sw','58','60','gw','aw'].includes(issue.club)) return 'wedges';
  if (['chip_chunk','chip_blade','chip_distance_unstable'].includes(issue.key)) return 'short';
  if (issue.club === 'driver') return 'driver';
  return 'irons';
}

function _contextAllowsIssue(issue) {
  const cat = _issueCategory(issue);
  if (_todayPracticeContext === 'simulator') return cat === 'driver' || cat === 'irons';
  if (_todayPracticeContext === 'no_wedges') return cat !== 'wedges' && cat !== 'short';
  return true;
}

function _planForCurrentContext(issue) {
  if (!issue) return issue;
  if (_todayPracticeContext !== 'short') return issue;
  return { ...issue, durationMin: Math.min(issue.durationMin || 40, 25) };
}

function _filterIssuesForContext(issues) {
  return (issues || []).filter(_contextAllowsIssue).map(_planForCurrentContext);
}

function _renderTodayPage() {
  const el = document.getElementById('today-content');
  if (!el) return;
  _todayPracticeContext = _getPracticeContext();
  const chips = _renderFocusChips();

  if (_todayFocus === 'chipping') {
    requestAnimationFrame(() => { el.innerHTML = chips + _renderChippingFocus(); });
    return;
  }
  if (_todayFocus === 'putting') {
    requestAnimationFrame(() => { el.innerHTML = chips + _renderPuttingFocus(); });
    return;
  }
  if (_todayFocus !== 'overall') {
    requestAnimationFrame(() => { el.innerHTML = chips + _renderClubFocusSection(_todayFocus); });
    return;
  }

  const contextIssues = _filterIssuesForContext(_todayIssues);

  // Overall: training sub-view when a club is selected
  if (_todayTrainingIssue) {
    requestAnimationFrame(() => {
      el.innerHTML = chips + _renderTodayTrainingView(_todayTrainingIssue, _todayAllShots);
    });
    return;
  }

  const health = _buildHealthTiles(_todayAllShots, _todayChipSessions, _todayPuttSessions);

  requestAnimationFrame(() => {
    el.innerHTML = chips + _renderTodayContent(contextIssues, health, _todayAllShots.length);
  });
}

function _renderClubFocusSection(focusKey) {
  const CA = window.clubAliases;
  const clubKeys = TODAY_FOCUS_CLUB_KEYS[focusKey] || [focusKey];
  const focusLabel = TODAY_FOCUS_LABELS.find(fl => fl.key === focusKey)?.label || focusKey;

  const focusShots = CA
    ? _todayAllShots.filter(s => clubKeys.some(ck => CA.shotMatchesClub(s, ck))).slice(0, 60)
    : [];

  // 0 shots — clear empty state with both action buttons
  if (!CA || focusShots.length === 0) {
    return `<div class="today-empty-state" style="margin-top:8px;">
      <div class="today-empty-icon">🏌️</div>
      <div class="today-empty-title">No ${escapeHtml(focusLabel)} shots yet</div>
      <div class="today-empty-text">Hit some shots and log them in TrackMan to get ${escapeHtml(focusLabel)} coaching here.</div>
      <div class="today-quick-log-row" style="justify-content:center;gap:8px;">
        <button class="today-log-btn" onclick="showPage('analysis')">Open TrackMan →</button>
        <button class="today-log-btn" onclick="showPage('stats')">Log range →</button>
      </div>
    </div>`;
  }

  const stats     = _buildFocusStats(focusShots);
  const statsCard = _renderFocusStatsCard(stats, focusLabel, focusShots.length);
  const techCard  = _renderFocusTechnicalCard(stats, focusLabel);
  const wedgeCard = _isWedgeKey(focusKey) ? _renderWedgeWindowCard(focusShots, focusLabel, focusKey) : '';

  // 1–4 shots — show what we have, flag insufficient data
  if (focusShots.length < 5) {
    return statsCard + techCard + wedgeCard +
      `<div class="today-focus-card" style="margin:10px 14px 0;">
        <div class="today-focus-card-label">Not enough data yet</div>
        <div style="font-size:13px;color:var(--text2);margin-top:5px;">
          ${escapeHtml(String(focusShots.length))} shot${focusShots.length===1?'':'s'} recorded.
          Add at least 10 recent ${escapeHtml(focusLabel)} shots for a reliable diagnosis.
        </div>
      </div>` + _renderFocusQuickActions();
  }

  // 5+ shots — detect issue directly from focusShots, not from global _todayIssues
  const issue = _detectFocusIssue(focusShots, focusKey);
  if (issue) {
    issue.clubName = focusLabel;
    // Update trend globals so the chart draws for this focus when Stats tab opens
    _trendIssue = issue;
    _trendShots = _todayAllShots;
  }
  const issueCard = issue
    ? _renderFocusIssueCard(issue, focusLabel)
    : _renderFocusNoIssueCard(focusLabel, focusShots.length);

  const drillCat = issue ? _issueToDrillCategory(issue) : '';
  return `
    <div class="today-layer-toggle">
      <button class="today-layer-btn today-layer-coach active" onclick="toggleTodayLayer('coach')">Coach</button>
      <button class="today-layer-btn today-layer-stats" onclick="toggleTodayLayer('stats')">Stats</button>
    </div>
    <div class="today-coach-layer">
      ${statsCard}${techCard}${wedgeCard}${issueCard}
      ${_renderFocusTrainCard(issue, focusLabel, focusKey)}
      ${_renderDrillHistoryCard()}
      ${_renderFocusQuickActions()}
    </div>
    <div class="today-stats-layer">
      ${issue ? _renderShotPatternCard(issue) : ''}
      ${issue ? _renderStatsProgressCard(issue) : ''}
      ${issue ? _renderTrendCard(issue) : ''}
      <div class="today-drill-library-row">
        <button class="today-drill-library-btn" onclick="openDrillCatalog('${drillCat}')">Browse drill library →</button>
      </div>
    </div>`;
}

// ── Focus helpers ─────────────────────────────────────────────────────────

function _buildFocusStats(shots) {
  const carries  = shots.map(s => s.carry).filter(Boolean);
  const sides    = shots.map(s => s.side).filter(s => s != null);
  const faces    = shots.map(s => s.face_angle).filter(x => x != null);
  const paths    = shots.map(s => s.club_path).filter(x => x != null);
  const ftps     = shots.map(s => s.face_to_path).filter(x => x != null);
  const attacks  = shots.map(s => s.attack_angle).filter(x => x != null);
  const smashes  = shots.map(s => s.smash_factor).filter(Boolean);

  const avgCarry = statAvg(carries);
  const carrySD  = statStdDev(carries);

  // Good-shot carry = avg of top third
  const sortedC  = [...carries].sort((a,b) => b-a);
  const topN     = Math.max(1, Math.floor(sortedC.length / 3));
  const goodCarry = sortedC.length ? statAvg(sortedC.slice(0, topN)) : null;

  const carryMin = carries.length ? Math.min(...carries) : null;
  const carryMax = carries.length ? Math.max(...carries) : null;

  const playableCount = sides.filter(s => Math.abs(s) <= 20).length;
  const playableRate  = sides.length ? Math.round(playableCount / sides.length * 100) : null;

  // Main miss direction
  const leftMisses  = sides.filter(s => s < -10).length;
  const rightMisses = sides.filter(s => s > 10).length;
  let mainMiss = null;
  if (sides.length >= 3) {
    if      (rightMisses > leftMisses * 1.5) mainMiss = 'Right';
    else if (leftMisses > rightMisses * 1.5) mainMiss = 'Left';
    else if (leftMisses + rightMisses > 0)   mainMiss = 'Both sides';
  }

  const dates   = shots.map(s => (s.shot_time || s.created_at)?.slice(0,10)).filter(Boolean).sort().reverse();
  const lastDate = dates[0] || null;

  return {
    n: shots.length,
    avgCarry, goodCarry, carrySD, carryMin, carryMax,
    playableRate, mainMiss, lastDate,
    avgFace:   statAvg(faces),
    avgPath:   statAvg(paths),
    avgFTP:    statAvg(ftps),
    avgAttack: statAvg(attacks),
    avgSmash:  statAvg(smashes),
  };
}

function _isWedgeKey(key) {
  return ['wedges','pw','58','sw','aw','gw','lw','60'].includes(key);
}

function _wedgeWindowLabel(shot) {
  const raw = String(shot.shot_type || shot.notes || '').toLowerCase();
  const clock = raw.match(/(?:^|\b)([7-9]|10|11)\s*(?:o'?clock|oclock|clock)\b/);
  if (clock) return `${clock[1]} o'clock`;
  if (/\b(half|1\/2|50%)\b/.test(raw)) return 'half swing';
  if (/\b(three quarter|3\/4|75%)\b/.test(raw)) return '3/4 swing';
  if (/\b(full|stock)\b/.test(raw)) return 'full';
  const carry = Number(shot.carry);
  if (!carry || isNaN(carry)) return 'unlabelled';
  if (carry <= 15) return 'unassigned 0-15m';
  if (carry <= 25) return 'unassigned 16-25m';
  if (carry <= 35) return 'unassigned 26-35m';
  if (carry <= 50) return 'unassigned 36-50m';
  return 'unassigned 50m+';
}

function _buildWedgeWindows(shots) {
  const groups = {};
  shots.forEach(s => {
    if (!s.carry) return;
    const label = _wedgeWindowLabel(s);
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });
  return Object.entries(groups).map(([label, rows]) => {
    const carries = rows.map(r => r.carry).filter(Boolean);
    return {
      label,
      n: rows.length,
      avg: statAvg(carries),
      sd: statStdDev(carries),
      min: carries.length ? Math.min(...carries) : null,
      max: carries.length ? Math.max(...carries) : null,
    };
  }).sort((a, b) => (a.avg || 0) - (b.avg || 0));
}

function _worstWedgeWindow(windows) {
  return windows
    .filter(w => w.n >= 4 && w.sd != null)
    .sort((a, b) => b.sd - a.sd)[0] || null;
}

function _wedgeTargetDelta(clubKey, windowLabel, avg) {
  const target = window.getWedgeTarget?.(clubKey, windowLabel);
  if (target == null || avg == null) return null;
  return { target, delta: avg - target };
}

function _renderWedgeWindowCard(shots, focusLabel, clubKey) {
  const windows = _buildWedgeWindows(shots).filter(w => w.n >= 2);
  if (!windows.length) return '';
  const specificClub = clubKey && ['pw','58','sw','aw','gw','lw','60'].includes(clubKey);

  return `<div class="today-wedge-card">
    <div class="today-wedge-head">Partial wedge windows</div>
    <div class="today-wedge-sub">${escapeHtml(focusLabel)} grouped by TrackMan shot type or notes first, then carry bucket.</div>
    ${windows.slice(0, 6).map(w => {
      const target = specificClub ? (window.getWedgeTarget?.(clubKey, w.label) ?? null) : null;
      const delta = target != null && w.avg != null ? Math.round(w.avg - target) : null;
      const deltaHtml = delta != null
        ? `<span class="ww-delta ${Math.abs(delta) <= 2 ? 'ww-delta-ok' : delta > 0 ? 'ww-delta-long' : 'ww-delta-short'}">${delta > 0 ? '+' : ''}${delta}m vs ${target}m</span>`
        : specificClub ? `<span class="ww-delta ww-delta-none">set target</span>` : '';
      return `<div class="today-wedge-row">
        <span class="today-wedge-label">${escapeHtml(w.label)}</span>
        <span class="today-wedge-stat">${escapeHtml(String(w.n))} shots</span>
        <span class="today-wedge-stat">${f(w.avg,0)}m avg</span>
        <span class="today-wedge-stat today-wedge-sd">±${w.sd == null ? '-' : f(w.sd,1)}m</span>
        ${deltaHtml}
      </div>`;
    }).join('')}
    ${specificClub ? `<div class="ww-setup-hint">Set targets in <button class="ww-setup-link" onclick="openMoreSection('wedgewindows')">More → Wedge windows</button></div>` : ''}
  </div>`;
}

function _detectFocusIssue(focusShots, focusKey) {
  const stats = _buildFocusStats(focusShots);
  const { avgFace, avgAttack, carrySD, avgSmash, avgFTP } = stats;
  const isIrons  = ['irons','7','6','8','9'].includes(focusKey);
  const isWedges = _isWedgeKey(focusKey);
  const isDriver = focusKey === 'driver';
  const faces    = focusShots.map(s => s.face_angle).filter(x => x != null);
  const attacks  = focusShots.map(s => s.attack_angle).filter(x => x != null);
  const carries  = focusShots.map(s => s.carry).filter(Boolean);
  const smashes  = focusShots.map(s => s.smash_factor).filter(Boolean);

  // primaryCk lets _issueIdForDetected map to the correct dict entry
  // group focuses use a representative club; individual focuses use their own key
  const primaryCk = { irons:'7', wedges:'pw' }[focusKey] || focusKey;

  const candidates = [];

  // Face angle — needs ≥ 5 readings
  if (faces.length >= 5 && avgFace != null && Math.abs(avgFace) > 2) {
    const badFacePct = faces.filter(ff => Math.abs(ff) > 2).length / faces.length;
    const sev        = Math.min(Math.abs(avgFace) / 7 + badFacePct * 0.5, 1);
    const isOpen     = avgFace > 0;
    const sliceBias  = avgFTP != null && avgFTP > 3.5;
    const hookBias   = avgFTP != null && avgFTP < -3.5;
    candidates.push({
      key: `face_${primaryCk}`, club: primaryCk, type: 'direction', score: sev,
      simple: isOpen
        ? (sliceBias ? 'Face open — ball starts and curves right' : 'Face open — ball starting right')
        : (hookBias  ? 'Face closed — ball starts and curves left' : 'Face closed — ball starting left'),
      support: `Face avg: ${fSign(avgFace,1)}° · Bad shots: ${Math.round(badFacePct*100)}%${avgFTP != null ? ` · FTP: ${fSign(avgFTP,1)}°` : ''}`,
      deeper: isOpen
        ? `Averaging ${fSign(avgFace,1)}° open. Face accounts for ~75% of start direction.${sliceBias ? ` FTP of ${fSign(avgFTP,1)}° adds curve right — a slice pattern.` : ''}`
        : `Averaging ${fSign(avgFace,1)}° closed — ball launches left.${hookBias ? ` FTP of ${fSign(avgFTP,1)}° adds hook curve.` : ''}`,
      drill: isOpen
        ? 'Face control gate: two tees just outside the ball, swing without catching the right tee.'
        : 'Check grip — feel the face stay square all the way through impact.',
      goal: 'Face avg inside ±2°',
      durationMin: 40,
    });
  }

  // Attack angle — irons / wedges only, needs ≥ 5 readings
  if ((isIrons || isWedges) && attacks.length >= 5 && avgAttack != null) {
    const threshold = isWedges ? -4 : -2;
    if (avgAttack > threshold) {
      const sev = Math.min((avgAttack - threshold) / 5, 1);
      candidates.push({
        key: `attack_${primaryCk}`, club: primaryCk, type: 'attack', score: sev * 1.1,
        simple: 'Not hitting down enough — ball getting scooped',
        support: `Attack angle: ${fSign(avgAttack,1)}° (target below ${threshold}°)`,
        deeper: `Irons need a descending blow. At ${fSign(avgAttack,1)}° you're scooping — produces inconsistent carry and weak ball flight.`,
        drill: 'Ball-then-turf drill: draw a line, club must strike ball before line — every time.',
        goal: `Attack angle below ${threshold}°`,
        durationMin: 40,
      });
    }
  }

  // Carry consistency. Wedges are scored by partial-shot window, not blended carry.
  if (isWedges) {
    const wedgeWindows = _buildWedgeWindows(focusShots);
    const worstWindow = _worstWedgeWindow(wedgeWindows);
    const offTargetWindow = _isWedgeKey(primaryCk) ? wedgeWindows
      .map(w => ({ ...w, targetInfo: _wedgeTargetDelta(primaryCk, w.label, w.avg) }))
      .filter(w => w.n >= 4 && w.targetInfo && Math.abs(w.targetInfo.delta) > 3)
      .sort((a,b) => Math.abs(b.targetInfo.delta) - Math.abs(a.targetInfo.delta))[0] : null;
    const chosenWindow = offTargetWindow || worstWindow;
    const targetInfo = chosenWindow ? _wedgeTargetDelta(primaryCk, chosenWindow.label, chosenWindow.avg) : null;
    if (chosenWindow && (chosenWindow.sd > 5 || targetInfo)) {
      const spreadSev = chosenWindow.sd != null ? Math.min(chosenWindow.sd / 10, 1) : 0;
      const targetSev = targetInfo ? Math.min(Math.abs(targetInfo.delta) / 8, 1) : 0;
      const sev = Math.max(spreadSev, targetSev);
      const targetText = targetInfo ? ` · target ${f(targetInfo.target,0)}m · ${targetInfo.delta > 0 ? '+' : ''}${f(targetInfo.delta,0)}m` : '';
      candidates.push({
        key: `wedge_window_${primaryCk}_${chosenWindow.label.replace(/[^a-z0-9]/gi,'_')}`,
        club: primaryCk, type: 'consistency', score: sev * 0.9,
        simple: targetInfo && Math.abs(targetInfo.delta) > 3
          ? `${chosenWindow.label} wedge is ${targetInfo.delta > 0 ? 'long' : 'short'} vs target`
          : `${chosenWindow.label} wedge distance needs tightening`,
        support: `${chosenWindow.n} shots · avg ${f(chosenWindow.avg,0)}m · spread ±${f(chosenWindow.sd,1)}m${targetText}`,
        deeper: 'Your wedge data is separated by partial-shot window and compared with your target matrix. The issue is either repeatability inside the window or calibration against the intended carry.',
        drill: `${chosenWindow.label} calibration ladder: 12 balls to ${targetInfo ? `${f(targetInfo.target,0)}m` : 'one carry window'}, score only shots inside ±3m.`,
        goal: targetInfo ? `${chosenWindow.label} average within ±3m of ${f(targetInfo.target,0)}m` : `${chosenWindow.label} carry spread below ±5m`,
        durationMin: 25,
      });
    }
  } else if (carries.length >= 7 && carrySD != null) {
    const thresh = isDriver ? 18 : 14;
    if (carrySD > thresh) {
      const sev = Math.min(carrySD / (thresh * 1.8), 1);
      candidates.push({
        key: `consist_${primaryCk}`, club: primaryCk, type: 'consistency', score: sev * 0.85,
        simple: 'Distance unreliable - carry spread too wide',
        support: `Avg: ${f(stats.avgCarry,0)}m · Spread: ±${f(carrySD,0)}m (target ±${thresh}m)`,
        deeper: `Carry SD of ${f(carrySD,0)}m means club selection is a guess. Below ${thresh}m is the target for course-ready consistency.`,
        drill: 'Consistency block: 10 balls to one target, same swing pace each time.',
        goal: `Carry SD below ${thresh}m`,
        durationMin: 30,
      });
    }
  }

  // Smash factor — needs ≥ 5 readings
  if (smashes.length >= 5 && avgSmash != null) {
    const target = isDriver ? 1.42 : 1.28;
    if (avgSmash < target - 0.03) {
      const sev = Math.min((target - avgSmash) / 0.10, 1);
      candidates.push({
        key: `smash_${primaryCk}`, club: primaryCk, type: 'contact', score: sev * 0.8,
        simple: 'Contact off-centre — smash factor low',
        support: `Smash: ${f(avgSmash,2)} (target ${target}+)`,
        deeper: `Every 0.05 smash improvement ≈ 5m more carry, no extra effort. Off-centre contact is costing distance and consistency.`,
        drill: 'Impact tape drill: place tape on face, 10 shots — note where the ball is hitting.',
        goal: `Smash above ${target}`,
        durationMin: 35,
      });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a,b) => b.score - a.score);
  // Enrich with curated drill/goal/pitfall from Dict_golf.json if loaded
  return _enrichIssueFromDict(candidates[0]);
}

function _renderFocusStatsCard(stats, focusLabel, n) {
  const { avgCarry, goodCarry, carryMin, carryMax, carrySD, playableRate, mainMiss, lastDate } = stats;
  const carryStr = avgCarry != null ? `${f(avgCarry,0)}m avg carry` : '–';
  const goodStr  = goodCarry != null ? ` · ${f(goodCarry,0)}m good shot` : '';
  const items = [
    (carryMin != null && carryMax != null) ? `${f(carryMin,0)}–${f(carryMax,0)}m range` : null,
    carrySD   != null ? `±${f(carrySD,0)}m spread` : null,
    playableRate != null ? `${playableRate}% playable` : null,
    mainMiss  ? `Miss: ${mainMiss}` : null,
    lastDate  ? `Last: ${lastDate}` : null,
  ].filter(Boolean);
  return `
    <div class="today-focus-stats-card">
      <div class="today-focus-stats-head">${escapeHtml(focusLabel)} — ${n} shot${n===1?'':'s'}</div>
      <div class="today-focus-stats-carry">${escapeHtml(carryStr)}${escapeHtml(goodStr)}</div>
      ${items.length ? `<div class="today-focus-stats-sub">${items.map(escapeHtml).join(' · ')}</div>` : ''}
    </div>`;
}

function _renderFocusTechnicalCard(stats, focusLabel) {
  const { avgFace, avgPath, avgFTP, avgAttack, avgSmash } = stats;
  const items = [
    avgFace   != null ? { lbl: 'Face',   val: fSign(avgFace,1)+'°'   } : null,
    avgPath   != null ? { lbl: 'Path',   val: fSign(avgPath,1)+'°'   } : null,
    avgFTP    != null ? { lbl: 'F→P',    val: fSign(avgFTP,1)+'°'    } : null,
    avgAttack != null ? { lbl: 'Attack', val: fSign(avgAttack,1)+'°' } : null,
    avgSmash  != null ? { lbl: 'Smash',  val: f(avgSmash,2)          } : null,
  ].filter(Boolean);
  if (!items.length) return '';
  const chips = items.map(it =>
    `<div class="today-focus-tech-chip">
      <span class="today-focus-tech-chip-lbl">${escapeHtml(it.lbl)}</span>
      <span class="today-focus-tech-chip-val">${escapeHtml(it.val)}</span>
    </div>`
  ).join('');
  return `
    <div class="today-focus-tech-card">
      <div class="today-focus-tech-label">Technical pattern</div>
      <div class="today-focus-tech-chips">${chips}</div>
    </div>`;
}

function _renderFocusIssueCard(issue, focusLabel) {
  return `
    <div class="today-hero-card">
      <div class="today-hero-tag">Main issue — ${escapeHtml(focusLabel)}</div>
      <div class="today-hero-title">${escapeHtml(issue.simple)}</div>
      <div class="today-hero-subtitle">${escapeHtml(issue.support)}</div>
      ${issue.deeper ? `<div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.5;">${escapeHtml(issue.deeper)}</div>` : ''}
    </div>`;
}

function _renderFocusNoIssueCard(focusLabel, n) {
  const lowData = n < 10;
  return `
    <div class="today-hero-card hero-green">
      <div class="today-hero-tag">No strong issue — ${escapeHtml(focusLabel)}</div>
      <div class="today-hero-title">${lowData ? 'Not enough data yet' : 'Looking solid'}</div>
      <div class="today-hero-subtitle">
        ${lowData
          ? `${n} shot${n===1?'':'s'} recorded. Add at least 10 recent ${escapeHtml(focusLabel)} shots for a reliable diagnosis.`
          : `Numbers look reasonable. Train consistency or choose Overall for your biggest current problem.`}
      </div>
    </div>`;
}

function _renderFocusQuickActions() {
  return `
    <div class="today-focus-actions">
      <div class="today-quick-log-row" style="margin:0;">
        <button class="today-log-btn" onclick="showPage('analysis')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          TrackMan
        </button>
        <button class="today-log-btn" onclick="showPage('stats')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Log range
        </button>
      </div>
      <button class="today-log-btn today-log-btn-full" onclick="openSessionReview()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Log session result
      </button>
    </div>`;
}

function _renderFocusTrainCard(issue, focusLabel, focusKey) {
  const warmup = focusKey === 'driver'
    ? 'Easy driver swings at 70%, focus on clean contact'
    : focusKey === 'wedges'
      ? 'Chip & pitch at half swing to feel ground contact'
      : '5–10 balls at easy tempo, 70% pace';
  const technical = issue
    ? (issue.drill || `Work on: ${issue.simple}`)
    : `${focusLabel} consistency block — same target, 10 balls`;
  const random = issue
    ? `Vary targets. One thought: ${issue.goal ? issue.goal.split('·')[0].trim() : 'controlled start line'}`
    : `Pick 3 targets, 4 balls each, commit before stepping in`;
  const duration = issue?.durationMin || 40;
  return `
    <div class="today-train-card" style="margin:10px 14px 10px;">
      <div class="today-train-title">${duration}-min range plan — ${escapeHtml(focusLabel)}</div>
      <div class="today-train-drill">🔥 Warm-up (8 min): ${escapeHtml(warmup)}</div>
      <div class="today-train-drill">🎯 Technical (15 min): ${escapeHtml(technical)}</div>
      <div class="today-train-drill">🔀 Random (10 min): ${escapeHtml(random)}</div>
      <div class="today-train-cue">📝 After: log focus area, main miss &amp; best cue in Logbook</div>
    </div>`;
}

function _renderChippingFocus() {
  const sessions = _todayChipSessions || [];
  if (sessions.length < 2) {
    return `<div class="today-empty-state" style="margin-top:8px;">
      <div class="today-empty-icon">⛳</div>
      <div class="today-empty-title">Not enough chipping data yet</div>
      <div class="today-empty-text">Log at least 2 chipping sessions to get a focused coaching tip.</div>
      <div class="today-quick-log-row" style="justify-content:center">
        <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-chip-form')?.click(),350)">Log chipping</button>
      </div>
    </div>`;
  }
  const totalAtt = sessions.reduce((a,b)=>a+(b.attempts||0),0);
  const in1  = sessions.reduce((a,b)=>a+(b.inside_1m||0),0);
  const in2  = sessions.reduce((a,b)=>a+(b.inside_1m||0)+(b.between_1_2m||0),0);
  const out3 = sessions.reduce((a,b)=>a+(b.outside_3m||0),0);
  const in2Rate  = totalAtt ? Math.round(in2/totalAtt*100) : 0;
  const out3Rate = totalAtt ? Math.round(out3/totalAtt*100) : 0;
  const cls = in2Rate >= 60 ? 'today-health-good' : in2Rate >= 40 ? 'today-health-ok' : 'today-health-bad';
  let issue, drill, cue;
  if (out3Rate > 25) {
    issue = 'Distance control — too many chips outside 3m';
    drill = 'Chip-spots: 3 landing spots, 6 balls each. Score landing accuracy, not proximity to hole.';
    cue   = 'Pick a precise landing spot before you swing';
  } else if (in2Rate < 40) {
    issue = 'Touch and distance control need work';
    drill = 'One club, three distances. Weight forward, brush the ground first.';
    cue   = 'Weight forward all the way through';
  } else {
    issue = null;
    drill = 'Gate drill: chip to a gate 1m past the flag. 20 balls.';
    cue   = 'Land softly, let it run to the flag';
  }
  return `
    <div class="today-focus-card ${cls}" style="margin:12px 14px 0;">
      <div class="today-focus-card-label">Chipping — last ${sessions.length} sessions</div>
      <div style="font-size:14px;font-weight:600;color:var(--text);margin:6px 0 2px;">${in2Rate}% inside 2m</div>
      <div style="font-size:12px;color:var(--text3);">Inside 1m: ${totalAtt?Math.round(in1/totalAtt*100):0}% · Outside 3m: ${out3Rate}%</div>
      ${issue ? `<div style="font-size:12px;color:var(--amber);margin-top:5px;">⚠ ${escapeHtml(issue)}</div>` : `<div style="font-size:12px;color:var(--green);margin-top:5px;">✓ Solid chipping — keep building</div>`}
    </div>
    <div class="today-train-card" style="margin:10px 14px 10px;">
      <div class="today-train-title">Chipping practice plan</div>
      <div class="today-train-drill">🎯 Drill: ${escapeHtml(drill)}</div>
      <div class="today-train-drill">📊 Target: 20–30 attempts</div>
      <div class="today-train-cue">💡 Cue: ${escapeHtml(cue)}</div>
      <div class="today-train-cue">📝 Log: date, attempts, inside 2m count</div>
    </div>
    <div class="today-quick-log-row" style="margin:0 14px 20px;">
      <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-chip-form')?.click(),350)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/></svg>
        Log chipping
      </button>
    </div>`;
}

function _renderPuttingFocus() {
  const sessions = _todayPuttSessions || [];
  if (sessions.length < 2) {
    return `<div class="today-empty-state" style="margin-top:8px;">
      <div class="today-empty-icon">⛳</div>
      <div class="today-empty-title">Not enough putting data yet</div>
      <div class="today-empty-text">Log at least 2 putting sessions to get a focused coaching tip.</div>
      <div class="today-quick-log-row" style="justify-content:center">
        <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-putt-form')?.click(),350)">Log putting</button>
      </div>
    </div>`;
  }
  const shortSess = sessions.filter(s => s.distance_m != null && s.distance_m <= 2);
  const lagSess   = sessions.filter(s => s.distance_m != null && s.distance_m > 3);
  const shortHoled = shortSess.reduce((a,b)=>a+(b.holed||0),0);
  const shortTotal = shortSess.reduce((a,b)=>a+(b.total||0),0);
  const shortRate  = shortTotal ? Math.round(shortHoled/shortTotal*100) : null;
  const lagHoled = lagSess.reduce((a,b)=>a+(b.holed||0),0);
  const lagTotal = lagSess.reduce((a,b)=>a+(b.total||0),0);
  const lagRate  = lagTotal ? Math.round(lagHoled/lagTotal*100) : null;
  const cls = shortRate != null ? (shortRate >= 80 ? 'today-health-good' : shortRate >= 65 ? 'today-health-ok' : 'today-health-bad') : 'today-health-neutral';
  let issue, drill, cue;
  if (shortRate != null && shortRate < 65) {
    issue = `Short putt make rate is ${shortRate}% — needs work`;
    drill = '5-in-a-row ladder: make 5 in a row from 1m, then step back to 1.5m. Miss — return to start.';
    cue   = 'See the line, commit before you pull the putter back';
  } else if (lagRate != null && lagRate < 40) {
    issue = 'Lag pace — leaving putts too far away';
    drill = 'Past-the-hole lag: 5–10m putts. Every putt must finish 30cm past. Never short.';
    cue   = 'Always commit past the hole';
  } else {
    issue = null;
    drill = 'Gate putting: 2 tees as gate 30cm ahead. Every putt through the gate.';
    cue   = 'Control the start line, not the result';
  }
  return `
    <div class="today-focus-card ${cls}" style="margin:12px 14px 0;">
      <div class="today-focus-card-label">Putting — last ${sessions.length} sessions</div>
      ${shortRate != null ? `<div style="font-size:14px;font-weight:600;color:var(--text);margin:6px 0 2px;">${shortRate}% make rate (≤2m)</div>` : ''}
      ${lagRate != null ? `<div style="font-size:12px;color:var(--text3);">Lag make rate (>3m): ${lagRate}%</div>` : ''}
      ${issue ? `<div style="font-size:12px;color:var(--amber);margin-top:5px;">⚠ ${escapeHtml(issue)}</div>` : `<div style="font-size:12px;color:var(--green);margin-top:5px;">✓ Solid putting — keep the 5-in-a-row habit</div>`}
    </div>
    <div class="today-train-card" style="margin:10px 14px 10px;">
      <div class="today-train-title">Putting practice plan</div>
      <div class="today-train-drill">🎯 Drill: ${escapeHtml(drill)}</div>
      <div class="today-train-drill">📊 Target: 20–30 attempts</div>
      <div class="today-train-cue">💡 Cue: ${escapeHtml(cue)}</div>
      <div class="today-train-cue">📝 Log: date, distance, attempts, makes</div>
    </div>
    <div class="today-quick-log-row" style="margin:0 14px 20px;">
      <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-putt-form')?.click(),350)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="12" r="2"/><path d="M19 12H7"/></svg>
        Log putting
      </button>
    </div>`;
}

