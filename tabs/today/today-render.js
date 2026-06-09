// today-render.js -- Today page main render: cards, training view, trend chart, drill catalog
// Functions: _renderTodayContent, _renderRecommendationOptions, _renderAnythingElseChooser,
//   _renderHealthTiles, _renderMainIssueCard, _renderNoIssueCard, _renderTrainTodayCard,
//   _buildPlanBlocks, _renderWatchCard, _renderClubPicker, selectTodayClub, selectTodayPlan,
//   _buildGenericPlan, toggleIssueDetail, shrinkTodayPlan, _renderRegressionCard,
//   _renderCoachSummaryCard, _buildImprovedMessage, _renderWhatImprovedCard, _buildClubOverviewRows,
//   _renderRangeSimToggle, _renderReasonCard, _computeClubMiniStats, _renderTodayOptionsList,
//   _renderTodayOptionCard, selectTodayTraining, exitTodayTraining, _renderTodayTrainingView,
//   _renderClubStatsForTraining, toggleTodayLayer, _issueToDrillCategory, _renderTrendCard,
//   _groupBySession, _drawTodayTrendChart, openDrillCatalog, _renderDrillItems, closeDrillCatalog

// ── Render ────────────────────────────────────────────────────────────────

function _renderTodayContent(issues, health, shotCount) {
  if (shotCount < 15 && health.length === 0) {
    return `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Start logging to get coaching</div>
        <div class="today-empty-text">After 15+ shots in the Statistics tab, you'll see your biggest issue and a practice plan here.</div>
        <div class="today-quick-log-row" style="justify-content:center">
          <button class="today-log-btn" onclick="showPage('analysis')">Statistics →</button>
          <button class="today-log-btn" onclick="showPage('stats')">Log short game →</button>
        </div>
      </div>`;
  }

  const mainIssue = issues[0] || null;
  return `
    ${health.length ? _renderHealthTiles(health) : ''}
    ${_renderRangeSimToggle()}
    ${_renderReasonCard(mainIssue)}
    ${issues.length ? _renderTodayOptionsList(issues) : ''}`;
}

function _renderRecommendationOptions(issues, mainIssue) {
  const options = (issues || []).filter(i => i.key !== mainIssue?.key).slice(0, 4);
  if (!options.length) return '';
  return `<div class="today-options-card">
    <div class="today-options-head">Other good options today</div>
    ${options.map(i => `<button class="today-option-row" onclick="selectTodayPlan('${escapeHtml(i.key)}')">
      <span class="today-option-main">${escapeHtml(i.clubName || i.club)} · ${escapeHtml(i.simple)}</span>
      <span class="today-option-sub">${escapeHtml(i.support || i.goal || '')}</span>
    </button>`).join('')}
  </div>`;
}

function _renderAnythingElseChooser(activeCk) {
  const btns = PICKER_CLUBS.map(({ ck, label }) =>
    `<button class="today-anything-btn${ck === activeCk ? ' on' : ''}" data-club="${ck}" onclick="selectTodayClub('${ck}')">${escapeHtml(label)}</button>`
  ).join('');
  return `<div class="today-anything-card">
    <div class="today-anything-head">
      <span>I want to train something else</span>
      <small>Pick any club and Today will build a plan.</small>
    </div>
    <div class="today-anything-grid">${btns}</div>
  </div>`;
}

function _renderHealthTiles(tiles) {
  return `
    <div class="today-section-label">Game Health</div>
    <div class="today-health-tiles">
      ${tiles.map(t=>`
        <div class="today-health-tile today-health-${t.cls}">
          <div class="today-health-value">${escapeHtml(t.value)}</div>
          <div class="today-health-label">${escapeHtml(t.label)}</div>
          <div class="today-health-sub">${escapeHtml(t.sub)}</div>
        </div>`).join('')}
    </div>`;
}

function _renderMainIssueCard(issue) {
  const confCls = issue.conf < 0.4 ? 'hint' : issue.conf < 0.7 ? 'likely' : 'confirmed';
  const urgency = issue.priority === 1 ? 'hero-red' : '';
  const detailId = `issue-detail-${issue.key.replace(/[^a-z0-9]/g,'_')}`;
  return `
    <div class="today-hero-card ${urgency}">
      <div class="today-hero-tag">
        Main issue
        ${issue.confLabel ? `<span class="today-hero-badge">${issue.confLabel}</span>` : ''}
        ${issue.n ? `<span style="color:var(--text3);font-size:9px;">${issue.n} shots</span>` : ''}
      </div>
      <div class="today-hero-title">${escapeHtml(issue.simple)}</div>
      <div class="today-hero-subtitle">${escapeHtml(issue.support)}</div>
      ${issue.deeper ? `<div class="today-hero-stats">
        <div class="today-hero-stat">
          <div class="today-hero-stat-lbl">Evidence</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px;max-width:240px;line-height:1.5;">${escapeHtml(issue.deeper)}</div>
        </div>
      </div>` : ''}
      <div class="today-issue-action-row" style="margin-top:12px;">
        <button class="today-issue-stats-btn" onclick="toggleTodayLayer('stats')">View stats →</button>
      </div>
    </div>`;
}

function _renderNoIssueCard() {
  return `
    <div class="today-hero-card hero-green">
      <div class="today-hero-tag">Looking good</div>
      <div class="today-hero-title">No strong issue detected</div>
      <div class="today-hero-subtitle">Keep logging to build your baseline and track improvements.</div>
    </div>`;
}

let _todayActivePlanIssue = null;

function _renderTrainTodayCard(issue) {
  _todayActivePlanIssue = issue;
  const dur    = issue.durationMin || 40;
  const short  = Math.max(dur - 15, 20);
  const phase  = _detectPracticePhase(issue);
  const blocks = _buildPlanBlocks(issue, dur, phase);
  const phaseLabel = phase === 'transfer' ? 'Transfer' : 'Technical';

  return `
    <div class="today-plan-card">
      <div class="today-plan-header">
        <div>
          <div class="today-plan-label">Train today · <span class="today-plan-phase-badge today-plan-phase-${phase}">${phaseLabel}</span></div>
          <div class="today-plan-title">${escapeHtml(issue.clubName)} · ${dur} min</div>
        </div>
        <div class="today-plan-duration">${dur}<span>min</span></div>
      </div>
      <div class="today-plan-goal">${escapeHtml(issue.goal)}</div>
      <div class="today-plan-blocks">
        ${blocks.map(b=>`
          <div class="today-plan-block">
            <div class="today-plan-block-time">${b.time}</div>
            <div class="today-plan-block-body">
              <div class="today-plan-block-name">${escapeHtml(b.name)}</div>
              <div class="today-plan-block-desc">${escapeHtml(b.desc)}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="today-plan-cta-row">
        <button class="today-plan-start-btn" onclick="showPage('analysis')">Start on Statistics tab →</button>
        <button class="today-plan-short-btn" onclick="shrinkTodayPlan(${short})">Make it ${short} min</button>
      </div>
    </div>
    <div class="today-review-trigger" id="today-review-trigger">
      <button onclick="openSessionReview()">Log session result →</button>
    </div>`;
}

function _buildPlanBlocks(issue, dur, phase = 'technical') {
  const isTransfer = phase === 'transfer';
  const warmup   = 5;
  const drill    = Math.round((dur - 15) * (isTransfer ? 0.30 : 0.55));
  const transfer = Math.round((dur - 15) * (isTransfer ? 0.50 : 0.30));
  const pressure = dur - warmup - drill - transfer;
  let t = 0;
  const bl = (name, min, desc) => {
    const b = { name, time: `${t}–${t+min} min`, desc };
    t += min;
    return b;
  };
  const goalFocus = (issue.goal || '').split('·')[0].trim().toLowerCase() || issue.goal;
  if (isTransfer) {
    return [
      bl('Warm-up',  warmup,   '9-iron and 7-iron. Loosen up, no pressure.'),
      bl('Drill',    drill,    `${issue.drill} — blocked sets of 5.`),
      bl('Transfer', transfer, `Normal routine every shot. Vary targets. Focus: ${goalFocus}.`),
      bl('Pressure', pressure, '10-ball test. Full routine each shot. Log the final result.'),
    ];
  }
  return [
    bl('Warm-up',  warmup,   '9-iron and 7-iron. Loosen up, no pressure.'),
    bl('Drill',    drill,    issue.drill),
    bl('Transfer', transfer, `Pick one target. Normal routine. Focus: ${goalFocus}.`),
    bl('Pressure', pressure, '10-ball test. No swing thoughts. Log the final result.'),
  ];
}


function _renderWatchCard(issue) {
  return `
    <div class="today-watch-card">
      <div class="today-watch-label">Also keep an eye on</div>
      <div class="today-watch-text">${escapeHtml(issue.simple)}</div>
      <div class="today-watch-support">${escapeHtml(issue.support)}</div>
    </div>`;
}

function _renderClubPicker(activeCk) {
  const btns = PICKER_CLUBS.map(({ ck, label }) =>
    `<button class="today-club-btn${ck === activeCk ? ' on' : ''}" data-club="${ck}" onclick="selectTodayClub('${ck}')">${label}</button>`
  ).join('');
  return `
    <div class="today-section-label" style="margin-top:4px">Focus on a club</div>
    <div class="today-club-picker">${btns}</div>`;
}

function selectTodayClub(ck) {
  // Update button active state
  document.querySelectorAll('.today-club-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.club === ck);
  });
  document.querySelectorAll('.today-anything-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.club === ck);
  });

  // Find detected issue for this club, or build a generic plan
  const issue = _todayIssues.find(i => i.club === ck) || _buildGenericPlan(ck, _todayAllShots);

  const section = document.getElementById('today-plan-section');
  if (section) section.innerHTML = _renderTrainTodayCard(issue);
  showToast(`Plan switched: ${issue.clubName || ck}`);
}

function selectTodayPlan(issueKey) {
  const issue = _filterIssuesForContext(_todayIssues).find(i => i.key === issueKey);
  if (!issue) return;
  const section = document.getElementById('today-plan-section');
  if (section) section.innerHTML = _renderTrainTodayCard(issue);
  showToast(`Plan switched: ${issue.clubName || issue.club}`);
}

function _buildGenericPlan(ck, allShots) {
  const CA = window.clubAliases;
  const clubName = CA ? CA.clubLabel(ck) : ck;
  const shots = CA ? allShots.filter(s => CA.shotMatchesClub(s, ck)).slice(0, 30) : [];
  const carries = shots.map(s => s.carry).filter(Boolean);
  const med = statMedian(carries);
  const sd  = statStdDev(carries);

  const isWedge  = ['pw','58','sw'].includes(ck);
  const isDriver = ck === 'driver';
  const isPutter = ck === 'putter';

  let drill, goal;
  if (isPutter) {
    drill = 'Gate drill: 2 tees as gate, 20 pressure putts from 1–2m';
    goal  = '80%+ make rate inside 2m';
  } else if (isWedge) {
    const t1 = med ? Math.round(med * 0.7) : 25;
    const t2 = med ? Math.round(med)        : 35;
    const t3 = med ? Math.round(med * 1.25) : 45;
    drill = `Distance ladder: 10 balls each to ${t1}m, ${t2}m, ${t3}m — score only balls inside ±5m window`;
    goal  = 'Carry SD below 8m · Window hit rate 40%+';
  } else if (isDriver) {
    drill = 'Fairway width drill: pick a realistic corridor, aim for playable start line — ignore carry';
    goal  = 'Playable shots (side ≤ 20m) 70%+';
  } else {
    const target = med ? Math.round(med) : '—';
    drill = `Target carry block: 10 shots to ${target}m, consistent swing pace, note misses`;
    goal  = sd ? `Carry SD below ${Math.round(Math.max(sd * 0.8, 6))}m` : 'Tight and repeatable';
  }

  return {
    key: `manual_${ck}`, club: ck, clubName, type: 'manual',
    score: 0,
    simple: `${clubName} focused session`,
    support: carries.length ? `Last ${carries.length} shots · Median ${f(med,0)}m · ±${f(sd,1)}m` : 'No recent TrackMan data for this club',
    drill,
    goal,
    durationMin: isPutter || isWedge ? 30 : 40,
  };
}

// ── Issue detail toggle ───────────────────────────────────────────────────

function toggleIssueDetail(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.classList.toggle('open');
  if (btn) btn.textContent = open ? 'Hide detail ▴' : 'Why this issue? ▾';
}

// ── Shrink plan ───────────────────────────────────────────────────────────

function shrinkTodayPlan(shortDur) {
  const issue = _todayActivePlanIssue;
  if (!issue) return;
  const section = document.getElementById('today-plan-section');
  if (!section) return;
  section.innerHTML = _renderTrainTodayCard({...issue, durationMin: shortDur});
}


// ── Regression card ───────────────────────────────────────────────────────

function _renderRegressionCard(regression) {
  if (!regression) return '';
  return `
    <div class="today-regression-card">
      <div class="today-regression-label">Watch this</div>
      <div class="today-regression-text">${escapeHtml(regression.text)}</div>
    </div>`;
}

// ── Practice phase detection ──────────────────────────────────────────────


// ── Coach summary card (Feature 3) ───────────────────────────────────────

function _renderCoachSummaryCard(mainIssue, watchItem) {
  const phase      = mainIssue ? _detectPracticePhase(mainIssue) : null;
  const isTransfer = phase === 'transfer';

  if (!mainIssue) {
    return `
      <div class="today-coach-card today-coach-good">
        <div class="today-coach-eyebrow">Coach</div>
        <div class="today-coach-headline">Looking solid right now</div>
        <div class="today-coach-body">No major issue stands out from your recent shots. Keep logging to build a clearer picture — consistency improvements will show here first.</div>
      </div>`;
  }

  const phaseLabel = isTransfer ? 'Transfer phase' : 'Technical phase';
  const phaseDesc  = isTransfer
    ? 'You\'re improving — take this to normal play conditions. Use your routine, vary targets.'
    : 'Repetition first. Drill it before taking it to targets.';

  const ignoreText = watchItem
    ? watchItem.simple.split('—')[0].replace(/[—–]/g, '').trim()
    : null;

  const confCls = mainIssue.conf < 0.4 ? 'hint' : mainIssue.conf < 0.7 ? 'likely' : 'confirmed';
  return `
    <div class="today-coach-card">
      <div class="today-coach-top-row">
        <div class="today-coach-eyebrow-group">
          <div class="today-coach-eyebrow">Coach</div>
          ${mainIssue.confLabel ? `<span class="today-coach-conf today-coach-conf-${confCls}">${mainIssue.confLabel}${mainIssue.n ? ' · ' + mainIssue.n + ' shots' : ''}</span>` : ''}
        </div>
        <button class="today-coach-practice-btn" onclick="openPrePracticeMode()">Practice mode →</button>
      </div>
      ${mainIssue.lowConf ? `<div class="today-coach-lowconf">Log more shots to strengthen this signal</div>` : ''}
      <div class="today-coach-headline">${escapeHtml(mainIssue.simple)}</div>
      <div class="today-coach-body">${escapeHtml(mainIssue.deeper || 'Work on this before anything else.')}</div>
      <div class="today-coach-divider"></div>
      <div class="today-coach-phase-row">
        <span class="today-coach-phase-badge today-coach-phase-${isTransfer ? 'transfer' : 'technical'}">${phaseLabel}</span>
        <span class="today-coach-phase-desc">${escapeHtml(phaseDesc)}</span>
      </div>
      ${ignoreText ? `<div class="today-coach-ignore">Set aside for now: <em>${escapeHtml(ignoreText)}</em></div>` : ''}
    </div>`;
}

// ── What improved card (Feature 10) ──────────────────────────────────────

function _buildImprovedMessage(rawText) {
  const spreadMatch = rawText.match(/(\S+) carry spread improved.*?±(\d+)m.*?±(\d+)m/);
  if (spreadMatch) {
    return `${spreadMatch[1]} distances are getting more reliable — spread dropped from ±${spreadMatch[2]}m to ±${spreadMatch[3]}m. More consistent carry means more confident club selection.`;
  }
  if (rawText.includes('carry spread')) {
    return 'Carry distances are getting more consistent. That\'s a real improvement under pressure.';
  }
  if (rawText.includes('face angle')) {
    return 'Start line is tightening up — the ball is launching closer to your target more often. Face control is clicking.';
  }
  return rawText;
}

function _renderWhatImprovedCard(improved, fixedIssues) {
  const hasFixed = fixedIssues && fixedIssues.length > 0;
  if (!improved && !hasFixed) return '';

  if (hasFixed) {
    return `
      <div class="today-improved-card">
        <div class="today-improved-icon">🎯</div>
        <div class="today-improved-content">
          <div class="today-improved-label">Fixed!</div>
          <div class="today-improved-headline">${escapeHtml(fixedIssues[0].simple)} is no longer your main issue.</div>
          <div class="today-improved-sub">Keep it going — shift focus to what's next.</div>
        </div>
      </div>`;
  }

  const msg = _buildImprovedMessage(improved.text);
  return `
    <div class="today-improved-card">
      <div class="today-improved-icon">↑</div>
      <div class="today-improved-content">
        <div class="today-improved-label">Getting better</div>
        <div class="today-improved-headline">${escapeHtml(msg)}</div>
        <div class="today-improved-raw">${escapeHtml(improved.text)}</div>
      </div>
    </div>`;
}

// ── Club overview overlay ────────────────────────────────────────────────

function _buildClubOverviewRows(allShots) {
  const CA = window.clubAliases;
  if (!CA || !allShots || !allShots.length) return [];

  const byCk = {};
  allShots.forEach(s => {
    if (s._isManual) return;
    const ck = CA.resolveClub ? CA.resolveClub(s.club) : null;
    if (!ck) return;
    if (!byCk[ck]) byCk[ck] = [];
    byCk[ck].push(s);
  });

  const rows = [];
  for (const [ck, shots] of Object.entries(byCk)) {
    if (shots.length < 5) continue;

    // Miss direction from average side offset
    const sides = shots.map(s => s.side).filter(v => v != null);
    const avgSide = sides.length ? sides.reduce((a, b) => a + b, 0) / sides.length : null;
    let missDir = '—';
    if (avgSide != null) {
      if (avgSide > 3)       missDir = 'Right';
      else if (avgSide < -3) missDir = 'Left';
      else                   missDir = 'Straight';
    }

    // Mishit rate: smash_factor < 1.30 (TrackMan shots only)
    const smashes = shots.map(s => s.smash_factor).filter(v => v != null);
    const mishitPct = smashes.length >= 3
      ? Math.round(smashes.filter(v => v < 1.30).length / smashes.length * 100)
      : null;

    // Carry spread ±SD
    const carries = shots.map(s => s.carry).filter(v => v != null);
    let carrySD = null;
    if (carries.length >= 3) {
      const mean = carries.reduce((a, b) => a + b, 0) / carries.length;
      carrySD = Math.round(Math.sqrt(carries.reduce((a, b) => a + (b - mean) ** 2, 0) / carries.length));
    }

    rows.push({ ck, label: CA.clubLabel ? CA.clubLabel(ck) : ck, n: shots.length, missDir, mishitPct, carrySD });
  }

  const ORDER = ['driver','3w','5w','3h','4h','5h','3i','4i','5i','6i','7i','8i','9i','pw','gw','aw','sw','60','58','lw'];
  rows.sort((a, b) => {
    const ai = ORDER.indexOf(a.ck), bi = ORDER.indexOf(b.ck);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return b.n - a.n;
  });

  return rows;
}

window.openClubOverlay = function() {
  const overlay = document.getElementById('club-overview-overlay');
  if (!overlay) return;
  const rows = _buildClubOverviewRows(_todayAllShots);
  const body = overlay.querySelector('.club-ov-body');
  if (body) {
    if (!rows.length) {
      body.innerHTML = '<div class="club-ov-empty">No club data yet.<br>Log shots in the Statistics tab first.</div>';
    } else {
      body.innerHTML =
        `<div class="club-ov-header-row">
          <span class="club-ov-col-name">Club</span>
          <span class="club-ov-col">Miss</span>
          <span class="club-ov-col">Mishit</span>
          <span class="club-ov-col">Spread</span>
        </div>` +
        rows.map(r => {
          const missClass = r.missDir === 'Left' ? 'miss-left' : r.missDir === 'Right' ? 'miss-right' : 'miss-straight';
          return `<button class="club-ov-row" onclick="window._selectClubFromOverlay('${r.ck}')">
            <span class="club-ov-name">${escapeHtml(r.label)}</span>
            <span class="club-ov-miss ${missClass}">${escapeHtml(r.missDir)}</span>
            <span class="club-ov-stat">${r.mishitPct != null ? r.mishitPct + '%' : '—'}</span>
            <span class="club-ov-stat">${r.carrySD != null ? '±' + r.carrySD + 'm' : '—'}</span>
          </button>`;
        }).join('');
    }
  }
  overlay.classList.add('open');
};

window.closeClubOverlay = function() {
  const overlay = document.getElementById('club-overview-overlay');
  if (overlay) overlay.classList.remove('open');
};

window._selectClubFromOverlay = function(ck) {
  closeClubOverlay();
  if (typeof openClubInAnalysis === 'function') openClubInAnalysis(ck);
  else showPage('analysis');
};

// ── Today v2: Range/Sim toggle, reason card, options list, training view ──

function _renderRangeSimToggle() {
  const isSim = _todayPracticeContext === 'simulator';
  return `
    <div class="today-ctx-toggle">
      <button class="today-ctx-btn${!isSim ? ' active' : ''}" onclick="setTodayPracticeContext('range')">Range</button>
      <button class="today-ctx-btn${isSim ? ' active' : ''}" onclick="setTodayPracticeContext('simulator')">Sim</button>
    </div>`;
}

function _renderReasonCard(issue) {
  if (!issue) {
    return `
      <div class="today-reason-card today-reason-good">
        <div class="today-reason-eyebrow">Coach</div>
        <div class="today-reason-headline">Looking solid right now</div>
        <div class="today-reason-body">No major issue stands out. Keep logging to build your baseline.</div>
      </div>`;
  }
  const phase = _detectPracticePhase(issue);
  const isTransfer = phase === 'transfer';
  const phaseLabel = isTransfer ? 'Transfer phase' : 'Technical phase';
  const confCls = issue.conf < 0.4 ? 'hint' : issue.conf < 0.7 ? 'likely' : 'confirmed';
  return `
    <div class="today-reason-card">
      <div class="today-reason-top">
        <span class="today-reason-eyebrow">Train this next</span>
        <span class="today-reason-conf today-reason-conf-${confCls}">${issue.confLabel || ''}</span>
      </div>
      <div class="today-reason-headline">${escapeHtml(issue.simple)}</div>
      <div class="today-reason-because">${escapeHtml(issue.deeper || issue.support || '')}</div>
      <div class="today-reason-meta">
        <span class="today-reason-phase today-reason-phase-${phase}">${phaseLabel}</span>
        ${issue.n ? `<span class="today-reason-shots">${issue.n} shots</span>` : ''}
      </div>
    </div>`;
}

function _computeClubMiniStats(ck) {
  const CA = window.clubAliases;
  if (!CA || !_todayAllShots.length) return null;
  const shots = _todayAllShots.filter(s => CA.shotMatchesClub(s, ck) && !s._isManual).slice(0, 40);
  if (!shots.length) return null;

  const sides = shots.map(s => s.side).filter(v => v != null);
  const leftN     = sides.filter(v => v < -7).length;
  const rightN    = sides.filter(v => v > 7).length;
  const straightN = sides.length - leftN - rightN;

  const carries = shots.map(s => s.carry).filter(Boolean);
  const avgCarry = carries.length ? Math.round(carries.reduce((a,b)=>a+b,0)/carries.length) : null;
  let carrySD = null;
  if (carries.length >= 3 && avgCarry != null) {
    carrySD = Math.round(Math.sqrt(carries.reduce((a,b)=>a+(b-avgCarry)**2,0)/carries.length));
  }

  const smashes = shots.map(s => s.smash_factor).filter(v => v != null);
  const mishitPct = smashes.length >= 3
    ? Math.round(smashes.filter(v => v < 1.30).length / smashes.length * 100)
    : null;

  return { leftN, straightN, rightN, totalSides: sides.length, avgCarry, carrySD, mishitPct, n: shots.length };
}

function _renderTodayOptionsList(issues) {
  const top5 = issues.slice(0, 5);
  if (!top5.length) return '';
  return `
    <div class="today-section-label" style="margin:12px 0 6px;">Options</div>
    <div class="today-opts-list">
      ${top5.map((issue, idx) => _renderTodayOptionCard(issue, idx + 1)).join('')}
    </div>`;
}

function _renderTodayOptionCard(issue, rank) {
  const stats = _computeClubMiniStats(issue.club);

  let sideHtml = '';
  if (stats && stats.totalSides >= 5) {
    sideHtml = `<span class="today-opt-pill">` +
      `<span class="today-opt-L">L${stats.leftN}</span>` +
      ` <span class="today-opt-S">S${stats.straightN}</span>` +
      ` <span class="today-opt-R">R${stats.rightN}</span>` +
      `</span>`;
  }
  const carryHtml = (stats && stats.avgCarry != null)
    ? `<span class="today-opt-pill">${stats.avgCarry}m${stats.carrySD != null ? ' ±'+stats.carrySD : ''}</span>`
    : '';
  let mishitHtml = '';
  if (stats && stats.mishitPct != null) {
    const cls = stats.mishitPct > 40 ? ' today-opt-pill-bad' : stats.mishitPct > 25 ? ' today-opt-pill-warn' : '';
    mishitHtml = `<span class="today-opt-pill${cls}">${stats.mishitPct}% mishit</span>`;
  }

  const ckSafe  = issue.club.replace(/'/g, '');
  const keySafe = issue.key.replace(/'/g, '');

  return `
    <div class="today-opt-card${rank === 1 ? ' today-opt-top' : ''}">
      <div class="today-opt-head">
        <div class="today-opt-rank">${rank}</div>
        <div class="today-opt-info">
          <div class="today-opt-club">${escapeHtml(issue.clubName)}</div>
          <div class="today-opt-issue">${escapeHtml(issue.simple)}</div>
        </div>
        <button class="today-opt-i-btn" title="View in Statistics" onclick="openClubInAnalysis('${ckSafe}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </button>
      </div>
      ${(sideHtml || carryHtml || mishitHtml) ? `<div class="today-opt-data">${sideHtml}${carryHtml}${mishitHtml}</div>` : ''}
      <button class="today-opt-train-btn" onclick="selectTodayTraining('${keySafe}')">Train this →</button>
    </div>`;
}

window.selectTodayTraining = function(issueKey) {
  // Check filtered issues first, then full list
  const all = [..._filterIssuesForContext(_todayIssues), ..._todayIssues];
  const issue = all.find(i => i.key === issueKey);
  if (!issue) return;
  _todayTrainingIssue = issue;
  _renderTodayPage();
};

window.exitTodayTraining = function() {
  _todayTrainingIssue = null;
  _renderTodayPage();
};

function _renderTodayTrainingView(issue, allShots) {
  return `
    <div class="today-training-bar">
      <button class="today-training-back-btn" onclick="exitTodayTraining()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Today
      </button>
      <span class="today-training-label">${escapeHtml(issue.clubName)}</span>
    </div>
    <div id="today-plan-section">
      ${_renderTrainTodayCard(issue)}
    </div>
    ${_renderClubStatsForTraining(issue, allShots)}
    <div class="today-section-label" style="margin-top:12px;">Quick log</div>
    <div class="today-quick-log-row" style="margin-bottom:20px;">
      <button class="today-log-btn" onclick="showPage('analysis')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Statistics
      </button>
      <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-chip-form')?.click(),350)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/></svg>
        Chipping
      </button>
      <button class="today-log-btn" onclick="openManualLogPanel('${issue.club.replace(/'/g,'')}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Manual
      </button>
    </div>`;
}

function _renderClubStatsForTraining(issue, allShots) {
  const CA = window.clubAliases;
  if (!CA) return '';
  const shots = allShots.filter(s => CA.shotMatchesClub(s, issue.club) && !s._isManual).slice(0, 40);
  if (shots.length < 5) return `
    <div class="today-club-stats-card">
      <div class="today-cs-title">${escapeHtml(issue.clubName)} · Club data</div>
      <div class="today-cs-empty">Not enough shots yet to show club stats.</div>
    </div>`;

  const carries  = shots.map(s => s.carry).filter(Boolean);
  const sides    = shots.map(s => s.side).filter(v => v != null);
  const faces    = shots.map(s => s.face_angle).filter(v => v != null);
  const paths    = shots.map(s => s.club_path).filter(v => v != null);
  const ftps     = shots.map(s => s.face_to_path).filter(v => v != null);
  const smashes  = shots.map(s => s.smash_factor).filter(v => v != null);
  const attacks  = shots.map(s => s.attack_angle).filter(v => v != null);

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const sdv = arr => { if(arr.length<2)return null; const m=avg(arr); return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length); };
  const r0  = v => v==null?'—':Math.round(v).toString();
  const r1  = v => v==null?'—':v.toFixed(1);
  const sgn = v => v==null?'—':(v>=0?'+':'')+v.toFixed(1);

  const avgCarry=avg(carries), sdCarry=sdv(carries);
  const avgSide=avg(sides);
  const avgFace=avg(faces), sdFace=sdv(faces);
  const avgPath=avg(paths);
  const avgFTP=avg(ftps);
  const avgSmash=avg(smashes);
  const avgAttack=avg(attacks);

  const leftN    = sides.filter(v=>v<-7).length;
  const rightN   = sides.filter(v=>v>7).length;
  const strtN    = sides.length - leftN - rightN;

  let rows = '';

  if (avgCarry != null) {
    const minC = Math.round(Math.min(...carries));
    const maxC = Math.round(Math.max(...carries));
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Carry avg</span><span class="today-cs-val">${r0(avgCarry)}m${sdCarry!=null?' ±'+r0(sdCarry)+'m':''}</span></div>`;
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Carry range</span><span class="today-cs-val">${minC}–${maxC}m</span></div>`;
  }

  if (sides.length >= 5) {
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Direction</span><span class="today-cs-val"><span class="today-opt-L">L${leftN}</span> <span class="today-opt-S">S${strtN}</span> <span class="today-opt-R">R${rightN}</span>${avgSide!=null?' · avg '+sgn(avgSide)+'m':''}</span></div>`;
  }

  if (faces.length >= 5) {
    const faceCls = Math.abs(avgFace||0)>2 ? 'today-cs-val-bad' : 'today-cs-val-good';
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Face angle</span><span class="today-cs-val ${faceCls}">${sgn(avgFace)}°${sdFace!=null?' ±'+r1(sdFace)+'°':''}</span></div>`;
  }
  if (ftps.length >= 5) {
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Face-to-path</span><span class="today-cs-val">${sgn(avgFTP)}°</span></div>`;
  }
  if (paths.length >= 5) {
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Club path</span><span class="today-cs-val">${sgn(avgPath)}°</span></div>`;
  }
  if (avgSmash != null) {
    const tgt = issue.club==='driver' ? 1.42 : 1.28;
    const sCls = avgSmash < tgt-0.03 ? 'today-cs-val-bad' : avgSmash >= tgt ? 'today-cs-val-good' : '';
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Smash factor</span><span class="today-cs-val ${sCls}">${r1(avgSmash)}</span></div>`;
  }
  if (avgAttack != null && ['6','7','8','9','pw'].includes(issue.club)) {
    const aCls = (avgAttack||0) > -2 ? 'today-cs-val-bad' : 'today-cs-val-good';
    rows += `<div class="today-cs-row"><span class="today-cs-lbl">Attack angle</span><span class="today-cs-val ${aCls}">${sgn(avgAttack)}°</span></div>`;
  }

  const ckSafe = issue.club.replace(/'/g,'');
  return `
    <div class="today-club-stats-card">
      <div class="today-cs-title">${escapeHtml(issue.clubName)} · Club data <span class="today-cs-n">(${shots.length} shots)</span></div>
      <div class="today-cs-rows">${rows}</div>
      <button class="today-cs-link" onclick="openClubInAnalysis('${ckSafe}')">
        Full data in Statistics →
      </button>
    </div>`;
}


function toggleTodayLayer(mode) {
  const wrap = document.getElementById('today-content');
  if (!wrap) return;
  const isStats = mode === 'stats';
  wrap.classList.toggle('today-mode-stats', isStats);
  wrap.querySelectorAll('.today-layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.classList.contains('today-layer-' + mode));
  });
  if (isStats) requestAnimationFrame(() => requestAnimationFrame(() => _drawTodayTrendChart()));
}

// ── Trend chart ───────────────────────────────────────────────────────────

function _issueToDrillCategory(issue) {
  if (!issue) return '';
  if (issue.type === 'putting') return 'putting';
  if (issue.club === 'driver') return 'driver';
  if (['pw','sw','58','60','gw','aw'].includes(issue.club)) return 'wedges';
  if (['chip_chunk','chip_blade','chip_distance_unstable'].includes(issue.key)) return 'short';
  return 'irons';
}

function _renderTrendCard(issue) {
  return `
    <div class="today-trend-card" id="today-trend-card">
      <div class="today-trend-header">
        <div class="today-trend-label">${escapeHtml(issue.clubName)} · trend</div>
        <div class="today-trend-metric-label" id="today-trend-metric-label"></div>
      </div>
      <canvas id="today-trend-canvas" style="width:100%;display:block;border-radius:8px;background:var(--canvas-bg);margin-top:8px;"></canvas>
      <div class="today-trend-footer" id="today-trend-footer"></div>
    </div>`;
}

function _groupBySession(shots, club) {
  const CA = window.clubAliases;
  const filtered = club && CA
    ? shots.filter(s => CA.shotMatchesClub(s, club) && !s._isManual)
    : shots.filter(s => !s._isManual);
  const map = {};
  filtered.forEach(s => {
    const d = (s.shot_time || s.created_at || '').substring(0, 10);
    if (!d) return;
    if (!map[d]) map[d] = [];
    map[d].push(s);
  });
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10);
}

function _drawTodayTrendChart() {
  if (!_trendIssue || !_trendShots) return;
  const canvas = document.getElementById('today-trend-canvas');
  const card   = document.getElementById('today-trend-card');
  if (!canvas || !card) return;

  const issue    = _trendIssue;
  const sessions = _groupBySession(_trendShots, issue.club);

  let points = [], goalLine = null, metricLabel = '', lowerBetter = true;

  if (issue.type === 'direction') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.face_angle != null).map(s => Math.abs(s.face_angle));
      return vals.length >= 2 ? { date: d, v: statAvg(vals) } : null;
    }).filter(Boolean);
    goalLine = 2; metricLabel = '|Face angle| °'; lowerBetter = true;

  } else if (issue.type === 'contact') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.smash_factor > 0.5 && s.smash_factor < 2).map(s => s.smash_factor);
      return vals.length >= 2 ? { date: d, v: statAvg(vals) } : null;
    }).filter(Boolean);
    goalLine = 1.32; metricLabel = 'Smash factor avg'; lowerBetter = false;

  } else if (issue.type === 'consistency') {
    points = sessions.map(([d, sh]) => {
      const vals = sh.filter(s => s.carry > 0 && s.is_full_shot).map(s => s.carry);
      return vals.length >= 3 ? { date: d, v: statStdDev(vals) } : null;
    }).filter(Boolean);
    const isWedge = ['pw','sw','58','60','gw','aw'].includes(issue.club);
    goalLine = issue.club === 'driver' ? 15 : isWedge ? 8 : 10;
    metricLabel = 'Carry SD (m)'; lowerBetter = true;

  } else {
    card.style.display = 'none'; return;
  }

  if (points.length < 3) { card.style.display = 'none'; return; }

  const metricEl = document.getElementById('today-trend-metric-label');
  if (metricEl) metricEl.textContent = metricLabel;

  const latest = points[points.length - 1].v;
  const isImproving = lowerBetter ? latest < points[0].v : latest > points[0].v;
  const footerEl = document.getElementById('today-trend-footer');
  if (footerEl) {
    footerEl.innerHTML = `
      <span class="today-trend-dir${isImproving ? ' today-trend-up' : ''}">${isImproving ? '↑ Improving' : '→ Stable'}</span>
      ${goalLine != null ? `<span class="today-trend-goal-text">Goal: ${goalLine}</span>` : ''}`;
  }

  const isLight = document.body.classList.contains('light-theme');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = 110;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = isLight ? '#e3ddd5' : '#161819';
  ctx.fillRect(0, 0, w, h);

  const pad = { top:10, right:16, bottom:22, left:34 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const vals    = points.map(p => p.v);
  const allV    = goalLine != null ? [...vals, goalLine] : vals;
  const spread  = (Math.max(...allV) - Math.min(...allV)) || 1;
  const lo = Math.min(...allV) - spread * 0.15;
  const hi = Math.max(...allV) + spread * 0.15;
  const range = hi - lo;

  const xOf = i => pad.left + (i / (points.length - 1)) * pw;
  const yOf = v => pad.top + ph - ((v - lo) / range) * ph;

  if (goalLine != null) {
    const gy = yOf(goalLine);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(0,214,143,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + pw, gy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isLight ? 'rgba(0,150,100,.7)' : 'rgba(0,214,143,.6)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('goal', pad.left + pw, gy - 3);
  }

  const lineClr = isImproving
    ? (isLight ? 'rgba(0,160,100,.9)' : 'rgba(0,214,143,.9)')
    : (isLight ? 'rgba(190,120,0,.9)'  : 'rgba(255,170,0,.9)');

  ctx.beginPath();
  points.forEach((p, i) => { i === 0 ? ctx.moveTo(xOf(i), yOf(p.v)) : ctx.lineTo(xOf(i), yOf(p.v)); });
  ctx.strokeStyle = lineClr;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(p.v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineClr;
    ctx.fill();
  });

  const textClr = isLight ? 'rgba(70,65,60,.5)' : 'rgba(138,144,153,.5)';
  ctx.fillStyle = textClr; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText(Math.max(...vals).toFixed(1), pad.left - 3, pad.top + 9);
  ctx.fillText(Math.min(...vals).toFixed(1), pad.left - 3, h - pad.bottom + 4);
  ctx.textAlign = 'center'; ctx.fillStyle = textClr; ctx.font = '8px monospace';
  [0, points.length - 1].forEach(i => ctx.fillText(points[i].date.substring(5), xOf(i), h - 4));
}

// ── Drill catalog ──────────────────────────────────────────────────────────

function openDrillCatalog(category) {
  const overlay = document.getElementById('drill-catalog-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const cats = ['all','driver','irons','wedges','short','putting'];
  const catLabels = { all:'All', driver:'Driver', irons:'Irons', wedges:'Wedges', short:'Short game', putting:'Putting' };
  const active = category || 'all';
  overlay.innerHTML = `
    <div class="drill-catalog-backdrop" onclick="closeDrillCatalog()"></div>
    <div class="drill-catalog-sheet">
      <div class="drill-catalog-header">
        <div class="drill-catalog-title">Drill library</div>
        <button class="drill-catalog-close" onclick="closeDrillCatalog()">✕</button>
      </div>
      <div class="drill-catalog-filters">
        ${cats.map(c => `<button class="drill-cat-btn${active===c?' active':''}" onclick="openDrillCatalog('${c==='all'?'':c}')">${catLabels[c]}</button>`).join('')}
      </div>
      <div class="drill-catalog-list">${_renderDrillItems(category)}</div>
    </div>`;
}

function _renderDrillItems(category) {
  const items = category ? DRILL_CATALOG.filter(d => d.category === category) : DRILL_CATALOG;
  if (!items.length) return '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px;">No drills in this category yet.</div>';
  return items.map(d => `
    <div class="drill-item">
      <div class="drill-item-top">
        <div class="drill-item-name">${escapeHtml(d.name)}</div>
        <div class="drill-item-meta">${d.balls} balls · ${d.min} min</div>
      </div>
      <div class="drill-item-issue">For: ${escapeHtml(d.issue)}</div>
      <div class="drill-item-desc">${escapeHtml(d.desc)}</div>
      <div class="drill-item-cue">Cue — <em>${escapeHtml(d.cue)}</em></div>
    </div>`).join('');
}

function closeDrillCatalog() {
  const overlay = document.getElementById('drill-catalog-overlay');
  if (overlay) overlay.style.display = 'none';
}

