// today-overlays.js -- Overlays and panels: session review, pre-practice, shot pattern,
//   stats progress, manual log, drill history, glossary
// Functions: openSessionReview, selectReviewResult, submitSessionReview, openPrePracticeMode,
//   closePrePracticeMode, _renderShotPatternCard, _renderStatsProgressCard, _mergeManualShots,
//   openManualLogPanel, closeManualLogPanel, selectManualClub, selectManualOpt, submitManualLog,
//   _renderDrillHistoryCard, openGlossaryLibrary, _renderGlossaryGroups, _renderGlossaryCard,
//   _shortGlossaryText, _renderGlossaryBallFlightVisual, showGlossaryTip, closeGlossaryTip

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

        <button class="prepractice-start-btn" onclick="showPage('analysis');closePrePracticeMode()">Open TrackMan tab →</button>
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

// ── Shot pattern card (Feature 7) ─────────────────────────────────────────

function _renderShotPatternCard(mainIssue) {
  if (!mainIssue || mainIssue.type === 'putting') return '';
  const CA = window.clubAliases;
  if (!CA) return '';

  const clubShots = _todayAllShots
    .filter(s => CA.shotMatchesClub(s, mainIssue.club))
    .slice(0, 20);

  if (mainIssue.type === 'direction' || mainIssue.type === 'contact') {
    const faces = clubShots.map(s => s.face_angle).filter(x => x != null);
    if (faces.length < 5) return '';

    const left   = faces.filter(f => f < -1.5).length;
    const center = faces.filter(f => Math.abs(f) <= 1.5).length;
    const right  = faces.filter(f => f > 1.5).length;
    const total  = faces.length;
    const lPct   = Math.round(left   / total * 100);
    const cPct   = Math.round(center / total * 100);
    const rPct   = Math.round(right  / total * 100);
    const avgF   = statAvg(faces);
    const sdF    = statStdDev(faces);
    const goodPct = cPct;

    return `
      <div class="today-pattern-card">
        <div class="today-pattern-header">
          <span class="today-pattern-label">Face pattern · ${escapeHtml(mainIssue.clubName)}</span>
          <span class="today-pattern-n">${total} shots</span>
        </div>
        <div class="today-pattern-strip">
          <div class="today-pattern-zone today-pattern-left" style="flex:${Math.max(lPct,5)}">
            <span class="today-pattern-zone-label">Left</span>
            <span class="today-pattern-zone-pct">${lPct}%</span>
          </div>
          <div class="today-pattern-zone today-pattern-center" style="flex:${Math.max(cPct,5)}">
            <span class="today-pattern-zone-label">Square</span>
            <span class="today-pattern-zone-pct">${cPct}%</span>
          </div>
          <div class="today-pattern-zone today-pattern-right" style="flex:${Math.max(rPct,5)}">
            <span class="today-pattern-zone-label">Right</span>
            <span class="today-pattern-zone-pct">${rPct}%</span>
          </div>
        </div>
        <div class="today-pattern-stats">
          <span>Avg face ${fSign(avgF,1)}°</span>
          <span>·</span>
          <span>SD ±${f(sdF,1)}°</span>
          <span>·</span>
          <span class="${goodPct>=50?'today-pattern-good':goodPct>=30?'today-pattern-ok':'today-pattern-bad'}">${goodPct}% square</span>
          <button class="gloss-btn" onclick="showGlossaryTip('face_angle')">?</button>
        </div>
      </div>`;
  }

  if (mainIssue.type === 'consistency') {
    const carries = clubShots.map(s => s.carry).filter(Boolean);
    if (carries.length < 5) return '';

    const med   = statMedian(carries);
    const sd    = statStdDev(carries);
    const tgt   = ['pw','58','sw'].includes(mainIssue.club) ? 8 : 14;
    const tight = carries.filter(c => Math.abs(c - med) <= tgt / 2).length;
    const pct   = Math.round(tight / carries.length * 100);

    return `
      <div class="today-pattern-card">
        <div class="today-pattern-header">
          <span class="today-pattern-label">Distance spread · ${escapeHtml(mainIssue.clubName)}</span>
          <span class="today-pattern-n">${carries.length} shots</span>
        </div>
        <div class="today-pattern-carry-row">
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val">${f(med,0)}m</div>
            <div class="today-pattern-carry-lbl">median carry</div>
          </div>
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val today-pattern-${sd>tgt?'bad':'good'}">±${f(sd,0)}m</div>
            <div class="today-pattern-carry-lbl">spread (target &lt;${tgt}m)</div>
          </div>
          <div class="today-pattern-carry-stat">
            <div class="today-pattern-carry-val today-pattern-${pct>=60?'good':pct>=40?'ok':'bad'}">${pct}%</div>
            <div class="today-pattern-carry-lbl">within ±${Math.round(tgt/2)}m</div>
          </div>
        </div>
      </div>`;
  }

  return '';
}

// ── Stats progress card (Feature 2) ──────────────────────────────────────

function _renderStatsProgressCard(mainIssue) {
  if (!mainIssue || mainIssue.type === 'putting') return '';
  const CA = window.clubAliases;
  if (!CA) return '';

  const clubShots = _todayAllShots.filter(s => CA.shotMatchesClub(s, mainIssue.club));
  if (clubShots.length < 20) return '';

  const recent = clubShots.slice(0, 10);
  const prev   = clubShots.slice(10, 20);
  const tiles  = [];

  if (mainIssue.type === 'direction') {
    const rF = recent.map(s => s.face_angle).filter(x => x != null);
    const pF = prev.map(s => s.face_angle).filter(x => x != null);
    if (rF.length < 4) return '';

    const rAvg = statAvg(rF);
    const pAvg = pF.length >= 4 ? statAvg(pF) : null;
    const rSD  = statStdDev(rF);
    const pSD  = pF.length >= 4 ? statStdDev(pF) : null;
    const goodPct = Math.round(rF.filter(f => Math.abs(f) <= 2).length / rF.length * 100);
    const prevGP  = pF.length >= 4 ? Math.round(pF.filter(f => Math.abs(f) <= 2).length / pF.length * 100) : null;
    const improving = pAvg != null && Math.abs(rAvg) < Math.abs(pAvg) - 0.3;

    tiles.push({
      value: fSign(rAvg, 1) + '°',
      label: 'face avg', gloss: 'face_angle',
      trend: pAvg != null ? (improving ? `↑ from ${fSign(pAvg,1)}°` : `was ${fSign(pAvg,1)}°`) : null,
      good: Math.abs(rAvg) <= 2,
    });
    tiles.push({
      value: '±' + f(rSD, 1) + '°',
      label: 'spread', gloss: 'spread',
      trend: pSD != null ? (rSD < pSD - 0.2 ? '↑ tighter' : `was ±${f(pSD,1)}°`) : null,
      good: rSD < 2.5,
    });
    tiles.push({
      value: goodPct + '%',
      label: 'square',
      trend: prevGP != null && goodPct > prevGP + 3 ? `↑ from ${prevGP}%` : null,
      good: goodPct >= 40,
    });

  } else if (mainIssue.type === 'contact') {
    const rS = recent.map(s => s.smash_factor).filter(Boolean);
    const pS = prev.map(s => s.smash_factor).filter(Boolean);
    if (rS.length < 4) return '';

    const rAvg  = statAvg(rS);
    const pAvg  = pS.length >= 4 ? statAvg(pS) : null;
    const target = mainIssue.club === 'driver' ? 1.42 : 1.28;
    const goodPct = Math.round(rS.filter(s => s >= target - 0.02).length / rS.length * 100);

    tiles.push({
      value: f(rAvg, 2),
      label: 'smash avg', gloss: 'smash_factor',
      trend: pAvg != null ? (rAvg > pAvg + 0.01 ? `↑ from ${f(pAvg,2)}` : `was ${f(pAvg,2)}`) : null,
      good: rAvg >= target - 0.03,
    });
    tiles.push({ value: goodPct + '%', label: 'good hits', trend: null, good: goodPct >= 50 });
    tiles.push({ value: f(target, 2), label: 'target smash', gloss: 'smash_factor', trend: null, good: rAvg >= target });

  } else if (mainIssue.type === 'consistency') {
    const rC = recent.map(s => s.carry).filter(Boolean);
    const pC = prev.map(s => s.carry).filter(Boolean);
    if (rC.length < 4) return '';

    const rSD  = statStdDev(rC);
    const pSD  = pC.length >= 4 ? statStdDev(pC) : null;
    const rMed = statMedian(rC);
    const tgt  = ['pw','58','sw'].includes(mainIssue.club) ? 8 : 14;
    const goodPct = Math.round(rC.filter(c => Math.abs(c - rMed) <= tgt * 0.6).length / rC.length * 100);

    tiles.push({ value: f(rMed, 0) + 'm', label: 'median carry', gloss: 'carry', trend: null, good: true });
    tiles.push({
      value: '±' + f(rSD, 0) + 'm',
      label: 'spread', gloss: 'spread',
      trend: pSD != null ? (rSD < pSD - 1 ? `↑ from ±${f(pSD,0)}m` : `was ±${f(pSD,0)}m`) : null,
      good: rSD < tgt,
    });
    tiles.push({ value: goodPct + '%', label: 'within range', trend: null, good: goodPct >= 50 });
  }

  if (!tiles.length) return '';

  return `
    <div class="today-stats-card">
      <div class="today-stats-label">Your numbers · ${escapeHtml(mainIssue.clubName)} · last 10 shots</div>
      <div class="today-stats-tiles">
        ${tiles.map(t => `
          <div class="today-stat-tile">
            <div class="today-stat-value ${t.good ? 'today-stat-green' : 'today-stat-amber'}">${escapeHtml(t.value)}</div>
            ${t.trend ? `<div class="today-stat-trend ${t.good ? 'today-stat-trend-good' : ''}">${escapeHtml(t.trend)}</div>` : ''}
            <div class="today-stat-name">${escapeHtml(t.label)}${t.gloss ? `<button class="gloss-btn" onclick="showGlossaryTip('${t.gloss}')">?</button>` : ''}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Manual shot log (Feature 9) ───────────────────────────────────────────

let _manualLogState = { club: null, face: null, contact: null };

function _mergeManualShots(trackmanShots) {
  try {
    const manual  = JSON.parse(localStorage.getItem('manual_shots') || '[]');
    const cutoff  = new Date(Date.now() - 14 * 86400000).toISOString();
    const recent  = manual.filter(m => m.ts >= cutoff);
    // Qualitative logs do NOT inject synthetic numeric values.
    // They carry descriptive labels only (_face_qual, _contact_qual).
    // This prevents invented numbers from contaminating real TrackMan averages.
    const synthetic = recent.map(m => ({
      club: m.club,
      face_angle: null,    // qualitative only — not a measured value
      smash_factor: null,  // qualitative only — not a measured value
      carry: null, side: null, attack_angle: null,
      launch_angle: null, spin_rate: null, ball_speed: null,
      club_path: null, face_to_path: null,
      is_full_shot: true, exclude_from_progress: false,
      shot_time: m.ts,
      _isManual: true,
      _face_qual: m.face || null,       // 'open' | 'closed' | 'square'
      _contact_qual: m.contact || null, // 'pure' | 'ok' | 'miss'
    }));
    return [...trackmanShots, ...synthetic];
  } catch(e) {
    return trackmanShots;
  }
}

function openManualLogPanel(prefillClub) {
  _manualLogState = { club: prefillClub || null, face: null, contact: null };
  const overlay = document.getElementById('manual-log-overlay');
  if (!overlay) return;

  const clubBtns = PICKER_CLUBS.map(({ ck, label }) =>
    `<button class="manual-log-club-btn${ck === _manualLogState.club ? ' on' : ''}" data-ck="${ck}" onclick="selectManualClub('${ck}')">${label}</button>`
  ).join('');

  overlay.innerHTML = `
    <div class="manual-log-backdrop" onclick="closeManualLogPanel()"></div>
    <div class="manual-log-sheet">
      <div class="manual-log-header">
        <div class="manual-log-title">Log a shot</div>
        <button class="manual-log-close" onclick="closeManualLogPanel()">✕</button>
      </div>
      <div class="manual-log-body">
        <div class="manual-log-section-label">Club</div>
        <div class="manual-log-club-row" id="manual-log-clubs">${clubBtns}</div>

        <div class="manual-log-section-label">Face at impact</div>
        <div class="manual-log-opts" id="manual-log-face-opts">
          <button class="manual-log-opt" data-val="closed" onclick="selectManualOpt(this,'face')">← Closed</button>
          <button class="manual-log-opt" data-val="square" onclick="selectManualOpt(this,'face')">Square ✓</button>
          <button class="manual-log-opt" data-val="open"   onclick="selectManualOpt(this,'face')">Open →</button>
        </div>

        <div class="manual-log-section-label">Contact quality</div>
        <div class="manual-log-opts" id="manual-log-contact-opts">
          <button class="manual-log-opt" data-val="pure" onclick="selectManualOpt(this,'contact')">Pure</button>
          <button class="manual-log-opt" data-val="ok"   onclick="selectManualOpt(this,'contact')">OK</button>
          <button class="manual-log-opt" data-val="miss" onclick="selectManualOpt(this,'contact')">Thin / Fat</button>
        </div>

        <button class="manual-log-save-btn" onclick="submitManualLog()">Save shot</button>
        <div class="manual-log-hint">Manual shots supplement TrackMan data when sessions are short.</div>
      </div>
    </div>`;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeManualLogPanel() {
  const overlay = document.getElementById('manual-log-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function selectManualClub(ck) {
  _manualLogState.club = ck;
  document.querySelectorAll('.manual-log-club-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.ck === ck)
  );
}

function selectManualOpt(btn, field) {
  _manualLogState[field] = btn.dataset.val;
  btn.closest('.manual-log-opts')?.querySelectorAll('.manual-log-opt')
    .forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function submitManualLog() {
  if (!_manualLogState.club)  { showToast('Pick a club first');     return; }
  if (!_manualLogState.face)  { showToast('Pick face direction');   return; }
  try {
    const shots = JSON.parse(localStorage.getItem('manual_shots') || '[]');
    shots.unshift({ club: _manualLogState.club, face: _manualLogState.face, contact: _manualLogState.contact || 'ok', ts: new Date().toISOString() });
    localStorage.setItem('manual_shots', JSON.stringify(shots.slice(0, 100)));
  } catch(e) {}
  closeManualLogPanel();
  showToast('Shot logged ✓');
}

// ── Drill history card (Feature 4) ────────────────────────────────────────

function _renderDrillHistoryCard() {
  let reviews;
  try { reviews = JSON.parse(localStorage.getItem('today_reviews') || '[]'); } catch(e) { return ''; }
  if (reviews.length < 2) return '';

  const recent = reviews.slice(0, 15);

  // Aggregate per drill key
  const drillMap = {};
  for (const r of recent) {
    const k = r.issueKey || '_';
    if (!drillMap[k]) drillMap[k] = {
      label: (r.issueSimple || 'Session').split('—')[0].trim().slice(0, 38),
      hit: 0, close: 0, miss: 0, n: 0,
    };
    drillMap[k].n++;
    drillMap[k][r.result === 'hit' ? 'hit' : r.result === 'close' ? 'close' : 'miss']++;
  }

  const drills = Object.values(drillMap).filter(d => d.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);

  const drillRowsHtml = drills.map(d => {
    const hitPct = Math.round(d.hit / d.n * 100);
    const cls = hitPct >= 60 ? 'today-stat-green' : 'today-stat-amber';
    return `
      <div class="today-drill-agg-row">
        <div class="today-drill-agg-label">${escapeHtml(d.label)}</div>
        <div class="today-drill-agg-right">
          <span class="today-drill-agg-pct ${cls}">${hitPct}%</span>
          <span class="today-drill-agg-n">${d.n} sessions</span>
        </div>
      </div>`;
  }).join('');

  const recentHtml = recent.slice(0, 5).map(r => {
    const icon = r.result === 'hit' ? '✓' : r.result === 'close' ? '~' : '✗';
    const label = (r.issueSimple || 'Session').split('—')[0].trim().slice(0, 32);
    return `
      <div class="today-drill-row">
        <span class="today-drill-icon today-drill-${r.result}">${icon}</span>
        <span class="today-drill-name">${escapeHtml(label)}</span>
        <span class="today-drill-date">${r.date ? escapeHtml(r.date.slice(5)) : ''}</span>
      </div>`;
  }).join('');

  return `
    <div class="today-drill-card">
      <div class="today-section-label" style="margin-bottom:8px;">Drill history</div>
      ${drillRowsHtml}
      ${drills.length ? '<div class="today-drill-sep"></div>' : ''}
      ${recentHtml}
    </div>`;
}

// ── Coach / Stats layer toggle ────────────────────────────────────────────

function openGlossaryLibrary(activeKey = '') {
  const overlay = document.getElementById('glossary-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="glossary-backdrop" onclick="closeGlossaryTip()"></div>
    <div class="glossary-sheet glossary-sheet-library">
      <div class="glossary-header">
        <div>
          <div class="glossary-top-label">Lexikon</div>
          <div class="glossary-term-label">Golf terms & ball flight</div>
        </div>
        <button class="glossary-close" onclick="closeGlossaryTip()">✕</button>
      </div>

      <div class="glossary-body glossary-library-body">
        ${_renderGlossaryBallFlightVisual()}
        ${_renderGlossaryGroups(activeKey)}
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function _renderGlossaryGroups(activeKey = '') {
  return GLOSSARY_GROUPS.map(group => `
    <div class="glossary-group">
      <div class="glossary-group-label">${escapeHtml(group.label)}</div>
      <div class="glossary-card-grid">
        ${group.items.map(key => _renderGlossaryCard(key, activeKey)).join('')}
      </div>
    </div>
  `).join('');
}

function _renderGlossaryCard(key, activeKey = '') {
  const entry = GLOSSARY_TERMS[key];
  if (!entry) return '';

  const isActive = key === activeKey;
  return `
    <button class="glossary-card ${isActive ? 'glossary-card-active' : ''}" onclick="showGlossaryTip('${key}', true)">
      <div class="glossary-card-title">${escapeHtml(entry.term)}</div>
      <div class="glossary-card-text">${escapeHtml(_shortGlossaryText(entry.def))}</div>
    </button>
  `;
}

function _shortGlossaryText(text) {
  if (!text) return '';
  const firstSentence = text.split('. ')[0]?.trim() || text;
  return firstSentence.endsWith('.') ? firstSentence : firstSentence + '.';
}

function _renderGlossaryBallFlightVisual() {
  return `
    <div class="glossary-hero">
      <div class="glossary-hero-header">
        <div class="glossary-group-label">Ball flight visual</div>
        <button class="glossary-hero-link" onclick="showGlossaryTip('face_to_path', true)">Open explanation</button>
      </div>

      <div class="glossary-hero-sub">
        For a right-handed golfer: <b>face</b> mainly controls start direction, <b>face-to-path</b> mainly controls curve.
      </div>

      <div class="bf-grid">
        <div class="bf-corner"></div>
        <div class="bf-head">Path left<br><span>outside-in</span></div>
        <div class="bf-head">Path neutral<br><span>target line</span></div>
        <div class="bf-head">Path right<br><span>inside-out</span></div>

        <div class="bf-side">Face left<br><span>closed</span></div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Pull hook</div>
          <div class="bf-shape bf-shape-left-hard">↖</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Pull</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Pull fade</div>
          <div class="bf-shape bf-shape-right-soft">↗</div>
        </div>

        <div class="bf-side">Face square<br><span>near target</span></div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Hook</div>
          <div class="bf-shape bf-shape-left-hard">↖</div>
        </div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Straight</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Fade</div>
          <div class="bf-shape bf-shape-right-soft">↗</div>
        </div>

        <div class="bf-side">Face right<br><span>open</span></div>
        <div class="bf-cell bf-good">
          <div class="bf-name">Push draw</div>
          <div class="bf-shape bf-shape-left-soft">↖</div>
        </div>
        <div class="bf-cell bf-ok">
          <div class="bf-name">Push</div>
          <div class="bf-shape">↑</div>
        </div>
        <div class="bf-cell bf-bad">
          <div class="bf-name">Push slice</div>
          <div class="bf-shape bf-shape-right-hard">↗</div>
        </div>
      </div>

      <div class="glossary-hero-note">
        Simple rule: <b>start line = face</b>, <b>curve = face-to-path</b>.
      </div>
    </div>
  `;
}

function showGlossaryTip(key, showBackButton = false) {
  const entry = GLOSSARY_TERMS[key];
  if (!entry) return;
  const overlay = document.getElementById('glossary-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="glossary-backdrop" onclick="closeGlossaryTip()"></div>
    <div class="glossary-sheet">
      <div class="glossary-header">
        <div>
          ${showBackButton ? `<button class="glossary-back-link" onclick="openGlossaryLibrary('${key}')">← Back to lexikon</button>` : ''}
          <div class="glossary-term-label">${escapeHtml(entry.term)}</div>
        </div>
        <button class="glossary-close" onclick="closeGlossaryTip()">✕</button>
      </div>
      <div class="glossary-body">
        <div class="glossary-def">${escapeHtml(entry.def)}</div>
        ${key === 'face_to_path' ? `
          <div class="glossary-mini-rule">
            <div><b>Negative face-to-path</b> = curves left</div>
            <div><b>Positive face-to-path</b> = curves right</div>
          </div>
        ` : ''}
        ${entry.tip ? `
          <div class="glossary-tip-block">
            <div class="glossary-tip-eyebrow">Coach tip</div>
            <div class="glossary-tip-text">${escapeHtml(entry.tip)}</div>
          </div>` : ''}
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeGlossaryTip() {
  const overlay = document.getElementById('glossary-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}
