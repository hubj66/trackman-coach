// today.js — Today coaching screen

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

  el.innerHTML = _renderTodayContent(issues, health, improved, regression, allShots.length);
}

// ── Issue detection ────────────────────────────────────────────────────────

function _detectTodayIssues(allShots, puttSessions) {
  const CA = window.clubAliases;
  if (!CA) return [];
  const issues = [];

  const CLUB_IMPACT = { driver:1.2, '6':1.0, '7':1.0, '8':1.0, '9':1.0, pw:1.15, '58':1.15, sw:1.15 };

  for (const [ck, impact] of Object.entries(CLUB_IMPACT)) {
    const clubShots = allShots.filter(s => CA.shotMatchesClub(s, ck)).slice(0, 40);
    if (clubShots.length < 10) continue;

    const n    = clubShots.length;
    const conf = Math.min(n / 30, 1);
    const clubName = CA.clubLabel(ck);

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
          score: sev * conf * impact,
          simple: isOpen
            ? (sliceBias ? `${clubName} face is open — ball starts and curves right` : `${clubName} face is open — ball starting right`)
            : (hookBias  ? `${clubName} face is closed — ball starts and curves left` : `${clubName} face is closed — ball starting left`),
          support,
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
          score: sev * conf * impact * 1.1,
          simple: `${clubName} — not hitting down enough, ball getting scooped`,
          support: `Attack angle: ${fSign(avgAttack,1)}° (needs to be below -2°)`,
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
          score: sev * conf * impact * 0.85,
          simple: `${clubName} distance is unreliable — carry spread too wide`,
          support: `Median ${f(med,0)}m · spread ±${f(sdCarry,1)}m`,
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
          score: sev * conf * impact * 0.9,
          simple: `${clubName} contact is off-centre — energy transfer too low`,
          support: `Smash factor: ${f(avgSmash,2)} (target ${target}+)`,
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
        issues.push({
          key: 'putting_short', club: 'putter', clubName: 'Putting', type: 'putting',
          score: sev * Math.min(sp.length/5,1) * 1.3,
          simple: `Short putts leaking strokes — ${Math.round(makeRate*100)}% make rate inside 2m`,
          support: `${holed}/${total} made · target is 80%+`,
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

function _renderTodayContent(issues, health, improved, regression, shotCount) {
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
    ${health.length ? _renderHealthTiles(health) : ''}
    ${mainIssue ? _renderMainIssueCard(mainIssue) : _renderNoIssueCard()}
    ${mainIssue ? _renderTrainTodayCard(mainIssue) : ''}
    ${(improved || regression) ? _renderProgressCards(improved, regression) : ''}
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
  return `
    <div class="today-issue-card">
      <div class="today-issue-tag">Main issue</div>
      <div class="today-issue-title">${escapeHtml(issue.simple)}</div>
      <div class="today-issue-support">${escapeHtml(issue.support)}</div>
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

function _renderTrainTodayCard(issue) {
  const dur   = issue.durationMin || 40;
  const short = Math.max(dur - 15, 20);
  const blocks = _buildPlanBlocks(issue, dur);

  return `
    <div class="today-plan-card">
      <div class="today-plan-header">
        <div>
          <div class="today-plan-label">Train today</div>
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
        <button class="today-plan-short-btn" id="today-short-btn">Make it ${short} min</button>
      </div>
    </div>`;
}

function _buildPlanBlocks(issue, dur) {
  const warmup   = 5;
  const drill    = Math.round((dur - 15) * 0.55);
  const transfer = Math.round((dur - 15) * 0.30);
  const pressure = dur - warmup - drill - transfer;
  let t = 0;
  const bl = (name, min, desc) => {
    const b = { name, time: `${t}–${t+min} min`, desc };
    t += min;
    return b;
  };
  return [
    bl('Warm-up',  warmup,   '9-iron and 7-iron. Loosen up, no pressure.'),
    bl('Drill',    drill,    issue.drill),
    bl('Transfer', transfer, `Pick one target. Normal routine. Focus: ${(issue.goal||'').split('·')[0].trim().toLowerCase() || issue.goal}.`),
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
