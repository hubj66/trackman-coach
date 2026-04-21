// today.js — Today coaching screen

let _todayAllShots = [];
let _todayIssues   = [];

const PICKER_CLUBS = [
  { ck:'driver', label:'Driver' },
  { ck:'6',      label:'6i' },
  { ck:'7',      label:'7i' },
  { ck:'8',      label:'8i' },
  { ck:'9',      label:'9i' },
  { ck:'pw',     label:'PW' },
  { ck:'58',     label:'58°' },
  { ck:'putter', label:'Putt' },
];

async function initTodayTab() {
  const el = document.getElementById('today-content');
  if (!el) return;

  el.innerHTML = '<div class="today-loading">Loading your coaching summary…</div>';

  const sb = window.supabaseClient;
  const { data: authData } = await sb.auth.getSession();
  if (!authData?.session?.user) {
    el.innerHTML = `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Sign in to see your coaching</div>
        <div class="today-empty-text">Your practice data will be analysed to show you exactly what to work on.</div>
        <button class="today-login-btn" onclick="toggleAuthPanel()">Login →</button>
      </div>`;
    return;
  }

  const [{ data: shots }, { data: chips }, { data: putts }] = await Promise.all([
    sb.from('trackman_shots')
      .select('id,club,carry,total,side,smash_factor,ball_speed,face_angle,face_to_path,club_path,attack_angle,launch_angle,spin_rate,is_full_shot,exclude_from_progress,shot_time,created_at')
      .eq('exclude_from_progress', false)
      .order('shot_time', { ascending: false })
      .limit(300),
    sb.from('chipping_sessions')
      .select('session_date,attempts,inside_1m,between_1_2m,outside_3m')
      .order('session_date', { ascending: false })
      .limit(10),
    sb.from('putting_sessions')
      .select('session_date,distance_m,holed,total')
      .order('session_date', { ascending: false })
      .limit(20),
  ]);

  const allShots = shots || [];
  const chipSessions = chips || [];
  const puttSessions = putts || [];

  const issues    = _detectTodayIssues(allShots, puttSessions);
  const health    = _buildHealthTiles(allShots, chipSessions, puttSessions);
  const improved  = _detectImprovement(allShots);
  const regression = _detectRegression(allShots);

  _todayAllShots = allShots;
  _todayIssues   = issues;

  // Detect fixed issues (present last time, gone now)
  const today10 = new Date().toISOString().slice(0,10);
  const sevenDaysAgo = new Date(Date.now()-7*24*3600*1000).toISOString().slice(0,10);
  let fixedIssues = [];
  try {
    const prev = JSON.parse(localStorage.getItem('today_prev_issues')||'[]');
    fixedIssues = prev.filter(pi=>pi.date>=sevenDaysAgo && !issues.find(ci=>ci.key===pi.key)).slice(0,1);
    localStorage.setItem('today_prev_issues', JSON.stringify(
      issues.map(i=>({key:i.key,simple:i.simple,date:today10}))
    ));
  } catch(e) {}

  el.innerHTML = _renderTodayContent(issues, health, improved, regression, allShots.length, fixedIssues);
}

// ── Issue detection ────────────────────────────────────────────────────────

function _confLabel(conf) {
  return conf < 0.4 ? 'Hint' : conf < 0.7 ? 'Likely' : 'Confirmed';
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
        const sev   = Math.min(Math.abs(avgFace) / 7, 1);
        const isOpen = avgFace > 0;
        const sliceBias = avgFTP != null && avgFTP > 3.5;
        const hookBias  = avgFTP != null && avgFTP < -3.5;
        const support = [
          `Face avg: ${fSign(avgFace,1)}°`,
          ftps.length ? `FTP: ${fSign(avgFTP,1)}°` : null,
        ].filter(Boolean).join(' · ');
        issues.push({
          key: `face_${ck}`, club: ck, clubName, type: 'direction',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * recency,
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
    if (carries.length >= 10) {
      const sdCarry = statStdDev(carries);
      const thresh  = ['pw','58','sw'].includes(ck) ? 8 : 14;
      if (sdCarry != null && sdCarry > thresh) {
        const sev = Math.min(sdCarry / (thresh * 1.8), 1);
        const med = statMedian(carries);
        issues.push({
          key: `consist_${ck}`, club: ck, clubName, type: 'consistency',
          n, conf, confLabel, lowConf,
          score: sev * conf * impact * 0.85 * recency,
          simple: `${clubName} distance is unreliable — carry spread too wide`,
          support: `Median ${f(med,0)}m · spread ±${f(sdCarry,1)}m`,
          deeper: `Carry SD of ${f(sdCarry,1)}m (target below ${thresh}m) means your distances are unpredictable under pressure. The goal isn't hitting it further — it's knowing exactly how far you'll carry each shot so club selection isn't a guess.`,
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
          score: sev * conf * impact * 0.9 * recency,
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

  return issues.sort((a,b) => b.score - a.score);
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

function _renderTodayContent(issues, health, improved, regression, shotCount, fixedIssues=[]) {
  const mainIssue = issues[0] || null;
  const watchItem = issues[1] || null;

  if (shotCount < 15 && health.length === 0) {
    return `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Start logging to get coaching</div>
        <div class="today-empty-text">After 15+ shots in the Trackman tab, you'll see your biggest issue and a personalised practice plan here.</div>
        <div class="today-quick-log-row" style="justify-content:center">
          <button class="today-log-btn" onclick="showPage('analysis')">Log Trackman</button>
          <button class="today-log-btn" onclick="showPage('stats')">Log short game</button>
        </div>
      </div>`;
  }

  return `
    ${_renderCoachSummaryCard(mainIssue, watchItem)}
    ${_renderWhatImprovedCard(improved, fixedIssues)}
    ${health.length ? _renderHealthTiles(health) : ''}
    ${mainIssue ? _renderMainIssueCard(mainIssue) : _renderNoIssueCard()}
    ${_renderClubPicker(mainIssue?.club || null)}
    <div id="today-plan-section">
      ${mainIssue ? _renderTrainTodayCard(mainIssue) : ''}
    </div>
    ${regression ? _renderRegressionCard(regression) : ''}
    ${watchItem ? _renderWatchCard(watchItem) : ''}
    <div class="today-section-label" style="margin-top:16px;">Quick log</div>
    <div class="today-quick-log-row">
      <button class="today-log-btn" onclick="showPage('analysis')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Trackman
      </button>
      <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-chip-form')?.click(),350)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/></svg>
        Chipping
      </button>
      <button class="today-log-btn" onclick="showPage('stats');setTimeout(()=>document.getElementById('sub-head-putt-form')?.click(),350)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="12" r="2"/><path d="M19 12H7"/></svg>
        Putting
      </button>
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
  const detailId = `issue-detail-${issue.key.replace(/[^a-z0-9]/g,'_')}`;
  return `
    <div class="today-issue-card">
      <div class="today-issue-meta">
        <div class="today-issue-tag">Main issue</div>
        ${issue.confLabel ? `<div class="today-issue-conf today-issue-conf-${confCls}">${issue.confLabel}${issue.n ? ' · '+issue.n+' shots' : ''}</div>` : ''}
      </div>
      <div class="today-issue-title">${escapeHtml(issue.simple)}</div>
      <div class="today-issue-support">${escapeHtml(issue.support)}</div>
      ${issue.deeper ? `
        <button class="today-issue-detail-btn" onclick="toggleIssueDetail('${detailId}', this)">Why this issue? ▾</button>
        <div class="today-issue-detail" id="${detailId}">${escapeHtml(issue.deeper)}</div>` : ''}
    </div>`;
}

function _renderNoIssueCard() {
  return `
    <div class="today-issue-card today-issue-good">
      <div class="today-issue-tag">Looking good</div>
      <div class="today-issue-title">No strong issue detected from recent shots</div>
      <div class="today-issue-support">Keep logging to build your baseline</div>
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
        <button class="today-plan-start-btn" onclick="showPage('analysis')">Start on Trackman tab →</button>
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

function _renderProgressCards(improved, regression) {
  return `
    <div class="today-progress-row">
      ${improved ? `
        <div class="today-progress-card today-progress-good">
          <div class="today-progress-label">Getting better</div>
          <div class="today-progress-text">${escapeHtml(improved.text)}</div>
        </div>` : ''}
      ${regression ? `
        <div class="today-progress-card today-progress-warn">
          <div class="today-progress-label">Watch this</div>
          <div class="today-progress-text">${escapeHtml(regression.text)}</div>
        </div>` : ''}
    </div>`;
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

  // Find detected issue for this club, or build a generic plan
  const issue = _todayIssues.find(i => i.club === ck) || _buildGenericPlan(ck, _todayAllShots);

  const section = document.getElementById('today-plan-section');
  if (section) section.innerHTML = _renderTrainTodayCard(issue);
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
    support: carries.length ? `Last ${carries.length} shots · Median ${f(med,0)}m · ±${f(sd,1)}m` : 'No recent Trackman data for this club',
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

// ── Session review ────────────────────────────────────────────────────────

function openSessionReview() {
  const trigger = document.getElementById('today-review-trigger');
  if (!trigger) return;
  const issue = _todayActivePlanIssue;
  const goal = issue?.goal || 'Hit your target';
  trigger.innerHTML = `
    <div class="today-review-form">
      <div class="today-review-form-title">How did today's session go?</div>
      <div class="today-review-goal">Goal: ${escapeHtml(goal)}</div>
      <div class="today-review-options">
        <button class="today-review-opt" data-result="hit"    onclick="selectReviewResult(this)">✓ Hit target</button>
        <button class="today-review-opt" data-result="close"  onclick="selectReviewResult(this)">~ Close</button>
        <button class="today-review-opt" data-result="miss"   onclick="selectReviewResult(this)">✗ Not yet</button>
      </div>
      <textarea class="today-review-note" id="today-review-note" placeholder="Optional note…" rows="2"></textarea>
      <button class="today-review-submit" onclick="submitSessionReview()">Save result</button>
    </div>`;
}

function selectReviewResult(btn) {
  document.querySelectorAll('.today-review-opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function submitSessionReview() {
  const resultBtn = document.querySelector('.today-review-opt.selected');
  if (!resultBtn) { showToast('Pick a result first'); return; }
  const result = resultBtn.dataset.result;
  const note   = document.getElementById('today-review-note')?.value?.trim() || '';
  const issue  = _todayActivePlanIssue;
  const today10 = new Date().toISOString().slice(0,10);

  try {
    const reviews = JSON.parse(localStorage.getItem('today_reviews')||'[]');
    reviews.unshift({ date:today10, issueKey:issue?.key, issueSimple:issue?.simple, goal:issue?.goal, result, note });
    localStorage.setItem('today_reviews', JSON.stringify(reviews.slice(0,20)));
  } catch(e) {}

  const icon  = result==='hit' ? '✓' : result==='close' ? '~' : '✗';
  const cls   = result==='hit' ? 'good' : result==='close' ? 'ok' : 'warn';
  const label = result==='hit' ? 'Hit target' : result==='close' ? 'Getting close' : 'Not yet — keep at it';
  const trigger = document.getElementById('today-review-trigger');
  if (trigger) trigger.innerHTML = `
    <div class="today-review-result today-review-result-${cls}">
      <span class="today-review-result-icon">${icon}</span>
      <div>
        <div class="today-review-result-label">${label}</div>
        ${note ? `<div class="today-review-result-note">${escapeHtml(note)}</div>` : ''}
      </div>
    </div>`;
}

// ── "You fixed this" card (kept for backward compat) ─────────────────────

function _renderFixedCard(fixed) {
  return `
    <div class="today-fixed-card">
      <div class="today-fixed-icon">🎯</div>
      <div>
        <div class="today-fixed-label">Fixed!</div>
        <div class="today-fixed-text">${escapeHtml(fixed.simple)} is no longer showing as an issue.</div>
      </div>
    </div>`;
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

  return `
    <div class="today-coach-card">
      <div class="today-coach-top-row">
        <div class="today-coach-eyebrow">Coach</div>
        <button class="today-coach-practice-btn" onclick="openPrePracticeMode()">Practice mode →</button>
      </div>
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

// ── Pre-practice mode (Feature 5) ────────────────────────────────────────

function openPrePracticeMode() {
  const issue = _todayActivePlanIssue;
  if (!issue) { showToast('Open a practice plan below first'); return; }

  const overlay = document.getElementById('prepractice-overlay');
  if (!overlay) return;

  const phase      = _detectPracticePhase(issue);
  const isTransfer = phase === 'transfer';
  const drillText  = isTransfer
    ? `${issue.drill} — vary targets each rep, use your full routine.`
    : issue.drill;

  overlay.innerHTML = `
    <div class="prepractice-panel">
      <div class="prepractice-topbar">
        <button class="prepractice-back-btn" onclick="closePrePracticeMode()">← Today</button>
        <div class="prepractice-topbar-label">Practice mode</div>
      </div>
      <div class="prepractice-body">
        <div class="prepractice-eyebrow">Today's focus</div>
        <div class="prepractice-headline">${escapeHtml(issue.simple)}</div>

        <div class="prepractice-block">
          <div class="prepractice-block-label">Your drill</div>
          <div class="prepractice-block-text">${escapeHtml(drillText)}</div>
        </div>

        <div class="prepractice-block">
          <div class="prepractice-block-label">Done when</div>
          <div class="prepractice-block-text prepractice-goal">${escapeHtml(issue.goal)}</div>
        </div>

        ${isTransfer ? `<div class="prepractice-phase-note">Transfer phase — normal routine every shot, vary targets</div>` : ''}

        <button class="prepractice-start-btn" onclick="showPage('analysis');closePrePracticeMode()">Open Trackman tab →</button>
      </div>
      <div class="prepractice-footer">
        <button class="prepractice-log-btn" onclick="closePrePracticeMode();setTimeout(openSessionReview,150)">Done — log session result</button>
      </div>
    </div>`;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePrePracticeMode() {
  const overlay = document.getElementById('prepractice-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}
