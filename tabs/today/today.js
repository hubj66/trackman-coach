// today.js -- Today tab entry point. Data, focus, issues, render, overlays are in today-*.js

// Depends on (loaded before this): today-data.js, today-issues.js, today-focus.js,
//   today-render.js, today-overlays.js

async function initTodayTab() {
  const el = document.getElementById('today-content');
  if (!el) return;

  el.innerHTML = '<div class="today-loading"><div class="today-loading-spinner"></div>Loading your coaching summary…</div>';

  const { user } = await window.TCData.getCurrentUser();
  if (!user) {
    el.innerHTML = `
      <div class="today-empty-state">
        <div class="today-empty-icon">🏌️</div>
        <div class="today-empty-title">Sign in to see your coaching</div>
        <div class="today-empty-text">Your practice data will be analysed to show you exactly what to work on.</div>
        <button class="today-login-btn" onclick="toggleAuthPanel()">Login →</button>
      </div>`;
    return;
  }
  const CA = window.clubAliases;
  if (CA?.loadAliases) {
    await CA.loadAliases();
  }
  if (typeof window.loadWedgeWindows === 'function') {
    await window.loadWedgeWindows();
  }

  const [{ data: shots }, { data: chips }, { data: putts }] = await Promise.all([
    window.TCData.fetchTrackmanShots(
      user.id,
      'id,club,carry,total,side,smash_factor,ball_speed,face_angle,face_to_path,club_path,attack_angle,launch_angle,spin_rate,shot_type,notes,is_full_shot,exclude_from_progress,shot_time,created_at',
      { limit: 300, progressOnly: true }
    ),
    window.TCData.fetchChippingSessions(
      user.id,
      'session_date,attempts,inside_1m,between_1_2m,outside_3m',
      10
    ),
    window.TCData.fetchPuttingSessions(
      user.id,
      'session_date,distance_m,holed,total',
      20
    ),
  ]);

  const allShots = _mergeManualShots(shots || []);
  const chipSessions = chips || [];
  const puttSessions = putts || [];

  const issues    = _mergeTodayIssues(_detectTodayIssues(allShots, puttSessions), _buildClubHealthIssues(allShots));

  _todayAllShots      = allShots;
  _todayIssues        = issues;
  _todayChipSessions  = chipSessions;
  _todayPuttSessions  = puttSessions;
  _trendIssue         = issues[0] || null;
  _trendShots         = allShots;

  // Update localStorage so fixedIssues detection works on the next load
  try {
    const today10 = new Date().toISOString().slice(0,10);
    localStorage.setItem('today_prev_issues', JSON.stringify(
      issues.map(i=>({key:i.key,simple:i.simple,date:today10}))
    ));
  } catch(e) {}

  _renderTodayPage();
}
