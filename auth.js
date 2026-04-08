const sb = window.supabaseClient;

let editingChipId = null;
let editingPuttId = null;
let chippingCache = [];
let puttingCache = [];

function msg(text, isError = false) {
  const el = document.getElementById("auth-message");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#ff4d4d" : "#00d68f";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sum(arr) { return arr.reduce((a, b) => a + (Number(b) || 0), 0); }
function avg(arr) {
  const valid = arr.map(Number).filter(v => !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
function fmt(value, dp = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(dp);
}
function pct(part, total) {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}
function stdDev(arr) {
  const v = arr.map(Number).filter(x => !isNaN(x));
  if (v.length < 2) return null;
  const a = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
}

function setLoggedInUI(user) {
  const loggedOut = document.getElementById("logged-out-view");
  const loggedIn = document.getElementById("logged-in-view");
  const userEmail = document.getElementById("user-email");
  if (loggedOut) loggedOut.style.display = "none";
  if (loggedIn)  loggedIn.style.display = "block";
  if (userEmail) userEmail.textContent = user?.email || "";
}

function setLoggedOutUI() {
  const loggedOut = document.getElementById("logged-out-view");
  const loggedIn  = document.getElementById("logged-in-view");
  const userEmail = document.getElementById("user-email");
  const savedList = document.getElementById("saved-list");
  if (loggedOut) loggedOut.style.display = "block";
  if (loggedIn)  loggedIn.style.display = "none";
  if (userEmail) userEmail.textContent = "";
  if (savedList) savedList.innerHTML = "";
}

async function refreshSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) { msg(error.message, true); return; }
  const session = data.session;
  if (session?.user) {
    setLoggedInUI(session.user);
    await loadSavedStates();
  } else {
    setLoggedOutUI();
  }
}

async function signUp() {
  const email    = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value || "";
  const { error } = await sb.auth.signUp({ email, password });
  if (error) { msg(error.message, true); return; }
  msg("Signup successful. Check your email if confirmation is enabled.");
}

async function logIn() {
  const email    = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value || "";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { msg(error.message, true); return; }
  msg("Logged in");
  await refreshSession();
}

async function logOut() {
  const { error } = await sb.auth.signOut();
  if (error) { msg(error.message, true); return; }
  msg("Logged out");
  setLoggedOutUI();
}

async function saveCurrentState() {
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) { msg("Please log in first", true); return; }
  const title = document.getElementById("save-title")?.value?.trim() || `Save ${new Date().toLocaleString()}`;
  if (!window.trackmanCoach?.getCurrentState) { msg("App state function not found", true); return; }
  const currentState = window.trackmanCoach.getCurrentState();
  const { error } = await sb.from("saved_states").insert({
    user_id: user.id, title, club: currentState.club || null, app_state: currentState
  });
  if (error) { msg(error.message, true); return; }
  msg("Saved");
  const saveTitle = document.getElementById("save-title");
  if (saveTitle) saveTitle.value = "";
  await loadSavedStates();
}

async function loadSavedStates() {
  const { data, error } = await sb
    .from("saved_states")
    .select("id, title, club, created_at, app_state")
    .order("created_at", { ascending: false });
  if (error) { msg(error.message, true); return; }
  const list = document.getElementById("saved-list");
  if (!list) return;
  if (!data || data.length === 0) {
    list.innerHTML = "<p>No saved stats yet.</p>";
    window.__savedStatesCache = [];
    return;
  }
  list.innerHTML = data.map(row => `
    <div class="stats-card" style="margin-top:10px;">
      <div><strong>${escapeHtml(row.title)}</strong></div>
      <div class="muted-line">${escapeHtml(row.club || "")} · ${new Date(row.created_at).toLocaleString()}</div>
      <div class="inline-actions" style="margin-top:10px;">
        <button onclick="loadOneState('${row.id}')">Load</button>
        <button onclick="deleteOneState('${row.id}')">Delete</button>
      </div>
    </div>
  `).join("");
  window.__savedStatesCache = data;
}

async function loadOneState(id) {
  const row = (window.__savedStatesCache || []).find(x => x.id === id);
  if (!row) return;
  if (!window.trackmanCoach?.applyState) { msg("App load function not found", true); return; }
  window.trackmanCoach.applyState(row.app_state);
  msg(`Loaded: ${row.title}`);
}

async function deleteOneState(id) {
  const { error } = await sb.from("saved_states").delete().eq("id", id);
  if (error) { msg(error.message, true); return; }
  msg("Deleted");
  await loadSavedStates();
}

// ── TrackMan summary ────────────────────────────────────────────────────────
async function loadTrackmanSummary() {
  const el = document.getElementById("stats-trackman-summary");
  if (!el) return;

  const { data, error } = await sb
    .from("trackman_shots")
    .select("club,carry,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,face_angle,club_path,face_to_path,attack_angle,side,is_full_shot,exclude_from_progress,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) { el.innerHTML = `Error: ${escapeHtml(error.message)}`; return; }
  if (!data?.length) { el.innerHTML = '<div class="stats-empty">No TrackMan data yet.</div>'; return; }

  // Sessions = group by date
  const dates = [...new Set(data.map(x => x.created_at?.slice(0,10)))];
  const progressShots = data.filter(x => x.is_full_shot !== false && x.exclude_from_progress !== true);

  const avgCarry  = avg(progressShots.map(x => x.carry).filter(Boolean));
  const avgSmash  = avg(progressShots.map(x => x.smash_factor).filter(Boolean));
  const avgBallSp = avg(progressShots.map(x => x.ball_speed).filter(Boolean));
  const carrySD   = stdDev(progressShots.map(x => x.carry).filter(Boolean));

  const clubCounts = {};
  data.forEach(r => { const k = r.club || "Unknown"; clubCounts[k] = (clubCounts[k] || 0) + 1; });
  const clubList = Object.entries(clubCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([club, count]) => `<div class="club-stat-row"><span>${escapeHtml(club)}</span><span class="muted-line">${count} shots</span></div>`)
    .join('');

  // Last 5 sessions trend
  const last5Sessions = dates.slice(0, 5);
  const sessionRows = last5Sessions.map(d => {
    const s = progressShots.filter(x => x.created_at?.startsWith(d));
    if (!s.length) return null;
    return { date: d, shots: s.length, carry: avg(s.map(x=>x.carry).filter(Boolean)), smash: avg(s.map(x=>x.smash_factor).filter(Boolean)) };
  }).filter(Boolean);

  el.innerHTML = `
    <div class="stats-card" style="margin-bottom:12px;">
      <div class="stats-kpi-row">
        <div class="stats-kpi-item"><div class="stats-kpi-label">Total Shots</div><div class="stats-kpi-value">${data.length}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Sessions</div><div class="stats-kpi-value">${dates.length}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Avg Carry</div><div class="stats-kpi-value">${fmt(avgCarry)}m</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Avg Smash</div><div class="stats-kpi-value">${fmt(avgSmash,2)}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Avg Ball Spd</div><div class="stats-kpi-value">${fmt(avgBallSp)} mph</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Carry StdDev</div><div class="stats-kpi-value">${fmt(carrySD)}m</div></div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--text3)">Progress shots only (full swing, not excluded)</div>
    </div>

    ${sessionRows.length ? `
    <div class="stats-card" style="margin-bottom:12px;">
      <div class="stats-section-label">Recent Sessions</div>
      <table class="stats-table" style="margin-top:8px;">
        <thead><tr><th>Date</th><th>Shots</th><th>Avg Carry</th><th>Smash</th></tr></thead>
        <tbody>
          ${sessionRows.map(s => `<tr>
            <td>${s.date}</td><td>${s.shots}</td><td>${fmt(s.carry,1)}m</td><td>${fmt(s.smash,2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div class="stats-card">
      <div class="stats-section-label">Shots by Club</div>
      <div style="margin-top:8px;">${clubList}</div>
    </div>
  `;
}

// ── Chipping ────────────────────────────────────────────────────────────────
async function loadChippingSummary() {
  const el     = document.getElementById("stats-chipping-summary");
  const listEl = document.getElementById("stats-chipping-list");
  if (!el) return;

  const { data, error } = await sb
    .from("chipping_sessions")
    .select("id,session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes,created_at")
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) { el.innerHTML = `Error: ${escapeHtml(error.message)}`; if (listEl) listEl.innerHTML = ""; return; }
  chippingCache = data || [];

  if (!data?.length) { el.innerHTML = '<div class="stats-empty">No chipping data yet.</div>'; if (listEl) listEl.innerHTML = ""; return; }

  const sessions  = data.length;
  const attempts  = sum(data.map(x => x.attempts));
  const inside1m  = sum(data.map(x => x.inside_1m));
  const inside2m  = sum(data.map(x => (x.inside_1m||0) + (x.between_1_2m||0)));
  const inside3m  = sum(data.map(x => (x.inside_1m||0) + (x.between_1_2m||0) + (x.between_2_3m||0)));

  el.innerHTML = `
    <div class="stats-card" style="margin-bottom:12px;">
      <div class="stats-kpi-row">
        <div class="stats-kpi-item"><div class="stats-kpi-label">Sessions</div><div class="stats-kpi-value">${sessions}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Attempts</div><div class="stats-kpi-value">${attempts}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Inside 1m</div><div class="stats-kpi-value">${pct(inside1m,attempts)}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Inside 2m</div><div class="stats-kpi-value">${pct(inside2m,attempts)}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Inside 3m</div><div class="stats-kpi-value">${pct(inside3m,attempts)}</div></div>
      </div>
    </div>
  `;

  if (listEl) {
    listEl.innerHTML = `
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr><th>Date</th><th>Club</th><th>Dist</th><th>Att</th><th>&lt;1m</th><th>1–2m</th><th>2–3m</th><th>&gt;3m</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.slice(0,10).map(row => `<tr>
              <td>${escapeHtml(row.session_date)}</td>
              <td>${escapeHtml(row.club)}</td>
              <td>${fmt(row.distance_m,1)}m</td>
              <td>${row.attempts}</td>
              <td>${row.inside_1m||0}</td>
              <td>${row.between_1_2m||0}</td>
              <td>${row.between_2_3m||0}</td>
              <td>${row.outside_3m||0}</td>
              <td><div class="inline-actions">
                <button onclick="startEditChippingSession('${row.id}')">Edit</button>
                <button onclick="deleteChippingSession('${row.id}')">Delete</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

// ── Putting ─────────────────────────────────────────────────────────────────
async function loadPuttingSummary() {
  const el     = document.getElementById("stats-putting-summary");
  const listEl = document.getElementById("stats-putting-list");
  if (!el) return;

  const { data, error } = await sb
    .from("putting_sessions")
    .select("id,session_date,distance_m,holed,total,notes,created_at")
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) { el.innerHTML = `Error: ${escapeHtml(error.message)}`; if (listEl) listEl.innerHTML = ""; return; }
  puttingCache = data || [];

  if (!data?.length) { el.innerHTML = '<div class="stats-empty">No putting data yet.</div>'; if (listEl) listEl.innerHTML = ""; return; }

  const sessions = data.length;
  const holed    = sum(data.map(x => x.holed));
  const total    = sum(data.map(x => x.total));

  // Group by distance
  const byDist = {};
  data.forEach(r => {
    const d = fmt(r.distance_m, 1);
    if (!byDist[d]) byDist[d] = { holed: 0, total: 0 };
    byDist[d].holed += r.holed || 0;
    byDist[d].total += r.total || 0;
  });
  const distRows = Object.entries(byDist).sort((a,b) => parseFloat(a[0]) - parseFloat(b[0]));

  el.innerHTML = `
    <div class="stats-card" style="margin-bottom:12px;">
      <div class="stats-kpi-row">
        <div class="stats-kpi-item"><div class="stats-kpi-label">Sessions</div><div class="stats-kpi-value">${sessions}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Total Putts</div><div class="stats-kpi-value">${total}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Holed</div><div class="stats-kpi-value">${holed}</div></div>
        <div class="stats-kpi-item"><div class="stats-kpi-label">Make Rate</div><div class="stats-kpi-value">${pct(holed,total)}</div></div>
      </div>
    </div>
    ${distRows.length > 1 ? `
    <div class="stats-card" style="margin-bottom:12px;">
      <div class="stats-section-label">Make Rate by Distance</div>
      <table class="stats-table" style="margin-top:8px;">
        <thead><tr><th>Dist</th><th>Holed</th><th>Total</th><th>Rate</th></tr></thead>
        <tbody>
          ${distRows.map(([d,v]) => `<tr><td>${d}m</td><td>${v.holed}</td><td>${v.total}</td><td>${pct(v.holed,v.total)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;

  if (listEl) {
    listEl.innerHTML = `
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr><th>Date</th><th>Dist</th><th>Holed</th><th>Total</th><th>Rate</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.slice(0,10).map(row => `<tr>
              <td>${escapeHtml(row.session_date)}</td>
              <td>${fmt(row.distance_m,1)}m</td>
              <td>${row.holed}</td>
              <td>${row.total}</td>
              <td>${pct(row.holed,row.total)}</td>
              <td><div class="inline-actions">
                <button onclick="startEditPuttingSession('${row.id}')">Edit</button>
                <button onclick="deletePuttingSession('${row.id}')">Delete</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

// ── Clubs overview ──────────────────────────────────────────────────────────
async function loadClubsOverview() {
  const el = document.getElementById("clubs-overview");
  if (!el) return;

  const [clubsRes, shotsRes] = await Promise.all([
    sb.from("clubs").select("club_key,club_name,club_type,brand,model,loft,is_active").eq("is_active", true).order("club_name"),
    sb.from("trackman_shots").select("club,carry,smash_factor,ball_speed,spin_rate,launch_angle,face_angle,club_path,side,is_full_shot,exclude_from_progress").limit(1000)
  ]);

  if (clubsRes.error || !clubsRes.data?.length) {
    el.innerHTML = '<div class="stats-empty">No clubs added yet.</div>';
    return;
  }

  // Index shot stats by club key
  const shotsByClub = {};
  (shotsRes.data || []).filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true).forEach(s => {
    const k = (s.club || '').toLowerCase();
    if (!shotsByClub[k]) shotsByClub[k] = [];
    shotsByClub[k].push(s);
  });

  function clubStats(key) {
    const shots = shotsByClub[key.toLowerCase()] || [];
    if (!shots.length) return null;
    const carries  = shots.map(s => s.carry).filter(Boolean);
    const smashes  = shots.map(s => s.smash_factor).filter(Boolean);
    const spins    = shots.map(s => s.spin_rate).filter(Boolean);
    const launches = shots.map(s => s.launch_angle).filter(Boolean);
    const faces    = shots.map(s => s.face_angle).filter(x => x!=null);
    const sides    = shots.map(s => s.side).filter(x => x!=null);
    const avgSide  = avg(sides);
    const missTend = !avgSide ? '–' : avgSide > 3 ? 'Right' : avgSide < -3 ? 'Left' : 'Straight';
    return {
      n: shots.length,
      avgCarry: avg(carries), medCarry: carries.sort((a,b)=>a-b)[Math.floor(carries.length/2)],
      carrySD: stdDev(carries), avgSmash: avg(smashes),
      avgSpin: avg(spins), avgLaunch: avg(launches),
      miss: missTend
    };
  }

  el.innerHTML = clubsRes.data.map(row => {
    const s = clubStats(row.club_key || row.club_name);
    return `<div class="club-card" onclick="openClubInAnalysis('${escapeHtml(row.club_key || '')}')">
      <div class="club-card-header">
        <div class="club-card-name">${escapeHtml(row.club_name)}</div>
        ${s ? `<div class="club-card-sample">${s.n} shots</div>` : '<div class="club-card-sample muted-line">No data</div>'}
      </div>
      ${s ? `
      <div class="club-stats-grid">
        <div class="club-stat"><div class="club-stat-label">Avg Carry</div><div class="club-stat-val">${fmt(s.avgCarry)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">Median</div><div class="club-stat-val">${fmt(s.medCarry)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">StdDev</div><div class="club-stat-val">${fmt(s.carrySD)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">Smash</div><div class="club-stat-val">${fmt(s.avgSmash,2)}</div></div>
        <div class="club-stat"><div class="club-stat-label">Spin</div><div class="club-stat-val">${s.avgSpin ? Math.round(s.avgSpin) : '–'}</div></div>
        <div class="club-stat"><div class="club-stat-label">Miss</div><div class="club-stat-val">${s.miss}</div></div>
      </div>
      <div class="club-card-footer">Tap to deep-dive →</div>
      ` : '<div class="muted-line" style="padding:8px 0">No TrackMan shots yet</div>'}
    </div>`;
  }).join('');
}

function openClubInAnalysis(clubKey) {
  if (!clubKey) return;
  showPage('analysis');
  if (typeof setAnalysisClub === 'function') setAnalysisClub(clubKey);
}

async function loadStatsPage() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) { msg(sessionError.message, true); return; }
  const user = sessionData.session?.user;
  if (!user) {
    ['stats-trackman-summary','stats-chipping-summary','stats-putting-summary','clubs-overview'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = 'Please log in to view stats.';
    });
    return;
  }
  await Promise.all([loadTrackmanSummary(), loadChippingSummary(), loadPuttingSummary(), loadClubsOverview()]);
}

// ── Chipping CRUD ───────────────────────────────────────────────────────────
async function addChippingSession() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) { msg(sessionError.message, true); return; }
  const user = sessionData.session?.user;
  if (!user) { msg("Please log in first", true); return; }

  const session_date = document.getElementById("chip-date")?.value;
  const distance_m   = Number(document.getElementById("chip-distance")?.value);
  const club         = document.getElementById("chip-club")?.value?.trim();
  const attempts     = Number(document.getElementById("chip-attempts")?.value);
  const inside_1m    = Number(document.getElementById("chip-in1")?.value || 0);
  const between_1_2m = Number(document.getElementById("chip-in2")?.value || 0);
  const between_2_3m = Number(document.getElementById("chip-in3")?.value || 0);
  const outside_3m   = Number(document.getElementById("chip-out3")?.value || 0);
  const success_target_raw = document.getElementById("chip-success")?.value;
  const notes        = document.getElementById("chip-notes")?.value?.trim() || null;

  if (!session_date || !club || !distance_m || !attempts) { msg("Please fill date, distance, club and attempts", true); return; }
  if (inside_1m + between_1_2m + between_2_3m + outside_3m > attempts) { msg("Bucket totals cannot exceed attempts", true); return; }

  const success_target = success_target_raw === "" || success_target_raw == null ? null : Number(success_target_raw);
  const { error } = await sb.from("chipping_sessions").insert({ user_id:user.id, session_date, distance_m, club, attempts, success_target, inside_1m, between_1_2m, between_2_3m, outside_3m, notes });
  if (error) { msg(error.message, true); return; }
  msg("Chipping session added");
  clearChippingForm();
  await loadChippingSummary();
}

async function updateChippingSession() {
  if (!editingChipId) return;
  const session_date = document.getElementById("chip-date")?.value;
  const distance_m   = Number(document.getElementById("chip-distance")?.value);
  const club         = document.getElementById("chip-club")?.value?.trim();
  const attempts     = Number(document.getElementById("chip-attempts")?.value);
  const inside_1m    = Number(document.getElementById("chip-in1")?.value || 0);
  const between_1_2m = Number(document.getElementById("chip-in2")?.value || 0);
  const between_2_3m = Number(document.getElementById("chip-in3")?.value || 0);
  const outside_3m   = Number(document.getElementById("chip-out3")?.value || 0);
  const success_target_raw = document.getElementById("chip-success")?.value;
  const notes = document.getElementById("chip-notes")?.value?.trim() || null;
  if (!session_date || !club || !distance_m || !attempts) { msg("Please fill date, distance, club and attempts", true); return; }
  if (inside_1m + between_1_2m + between_2_3m + outside_3m > attempts) { msg("Bucket totals cannot exceed attempts", true); return; }
  const success_target = success_target_raw === "" || success_target_raw == null ? null : Number(success_target_raw);
  const { error } = await sb.from("chipping_sessions").update({ session_date, distance_m, club, attempts, success_target, inside_1m, between_1_2m, between_2_3m, outside_3m, notes }).eq("id", editingChipId);
  if (error) { msg(error.message, true); return; }
  msg("Chipping session updated");
  cancelEditChippingSession();
  await loadChippingSummary();
}

function startEditChippingSession(id) {
  const row = chippingCache.find(x => x.id === id);
  if (!row) return;
  editingChipId = id;
  document.getElementById("chip-date").value     = row.session_date || "";
  document.getElementById("chip-distance").value = row.distance_m ?? "";
  document.getElementById("chip-club").value     = row.club || "";
  document.getElementById("chip-attempts").value = row.attempts ?? "";
  document.getElementById("chip-in1").value      = row.inside_1m ?? 0;
  document.getElementById("chip-in2").value      = row.between_1_2m ?? 0;
  document.getElementById("chip-in3").value      = row.between_2_3m ?? 0;
  document.getElementById("chip-out3").value     = row.outside_3m ?? 0;
  document.getElementById("chip-success").value  = row.success_target ?? "";
  document.getElementById("chip-notes").value    = row.notes || "";
  document.getElementById("add-chip-btn").style.display    = "none";
  document.getElementById("update-chip-btn").style.display = "inline-block";
  document.getElementById("cancel-chip-edit-btn").style.display = "inline-block";
}

function cancelEditChippingSession() {
  editingChipId = null;
  clearChippingForm();
  document.getElementById("add-chip-btn").style.display    = "inline-block";
  document.getElementById("update-chip-btn").style.display = "none";
  document.getElementById("cancel-chip-edit-btn").style.display = "none";
}

async function deleteChippingSession(id) {
  const { error } = await sb.from("chipping_sessions").delete().eq("id", id);
  if (error) { msg(error.message, true); return; }
  if (editingChipId === id) cancelEditChippingSession();
  msg("Chipping session deleted");
  await loadChippingSummary();
}

function clearChippingForm() {
  ["chip-date","chip-distance","chip-club","chip-attempts","chip-in1","chip-in2","chip-in3","chip-out3","chip-success","chip-notes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// ── Putting CRUD ─────────────────────────────────────────────────────────────
async function addPuttingSession() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) { msg(sessionError.message, true); return; }
  const user = sessionData.session?.user;
  if (!user) { msg("Please log in first", true); return; }
  const session_date = document.getElementById("putt-date")?.value;
  const distance_m   = Number(document.getElementById("putt-distance")?.value);
  const holed        = Number(document.getElementById("putt-holed")?.value);
  const total        = Number(document.getElementById("putt-total")?.value);
  const notes        = document.getElementById("putt-notes")?.value?.trim() || null;
  if (!session_date || !distance_m || total <= 0 || holed < 0) { msg("Please fill date, distance, holed and total", true); return; }
  if (holed > total) { msg("Holed cannot exceed total", true); return; }
  const { error } = await sb.from("putting_sessions").insert({ user_id:user.id, session_date, distance_m, holed, total, notes });
  if (error) { msg(error.message, true); return; }
  msg("Putting session added");
  clearPuttingForm();
  await loadPuttingSummary();
}

async function updatePuttingSession() {
  if (!editingPuttId) return;
  const session_date = document.getElementById("putt-date")?.value;
  const distance_m   = Number(document.getElementById("putt-distance")?.value);
  const holed        = Number(document.getElementById("putt-holed")?.value);
  const total        = Number(document.getElementById("putt-total")?.value);
  const notes        = document.getElementById("putt-notes")?.value?.trim() || null;
  if (!session_date || !distance_m || total <= 0 || holed < 0) { msg("Please fill date, distance, holed and total", true); return; }
  if (holed > total) { msg("Holed cannot exceed total", true); return; }
  const { error } = await sb.from("putting_sessions").update({ session_date, distance_m, holed, total, notes }).eq("id", editingPuttId);
  if (error) { msg(error.message, true); return; }
  msg("Putting session updated");
  cancelEditPuttingSession();
  await loadPuttingSummary();
}

function startEditPuttingSession(id) {
  const row = puttingCache.find(x => x.id === id);
  if (!row) return;
  editingPuttId = id;
  document.getElementById("putt-date").value     = row.session_date || "";
  document.getElementById("putt-distance").value = row.distance_m ?? "";
  document.getElementById("putt-holed").value    = row.holed ?? "";
  document.getElementById("putt-total").value    = row.total ?? "";
  document.getElementById("putt-notes").value    = row.notes || "";
  document.getElementById("add-putt-btn").style.display    = "none";
  document.getElementById("update-putt-btn").style.display = "inline-block";
  document.getElementById("cancel-putt-edit-btn").style.display = "inline-block";
}

function cancelEditPuttingSession() {
  editingPuttId = null;
  clearPuttingForm();
  document.getElementById("add-putt-btn").style.display    = "inline-block";
  document.getElementById("update-putt-btn").style.display = "none";
  document.getElementById("cancel-putt-edit-btn").style.display = "none";
}

async function deletePuttingSession(id) {
  const { error } = await sb.from("putting_sessions").delete().eq("id", id);
  if (error) { msg(error.message, true); return; }
  if (editingPuttId === id) cancelEditPuttingSession();
  msg("Putting session deleted");
  await loadPuttingSummary();
}

function clearPuttingForm() {
  ["putt-date","putt-distance","putt-holed","putt-total","putt-notes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────
window.loadOneState               = loadOneState;
window.deleteOneState             = deleteOneState;
window.loadStatsPage              = loadStatsPage;
window.saveCurrentState           = saveCurrentState;
window.startEditChippingSession   = startEditChippingSession;
window.deleteChippingSession      = deleteChippingSession;
window.cancelEditChippingSession  = cancelEditChippingSession;
window.startEditPuttingSession    = startEditPuttingSession;
window.deletePuttingSession       = deletePuttingSession;
window.cancelEditPuttingSession   = cancelEditPuttingSession;
window.openClubInAnalysis         = openClubInAnalysis;

window.addEventListener("DOMContentLoaded", async () => {
  const btn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  btn("signup-btn", signUp);
  btn("login-btn",  logIn);
  btn("logout-btn", logOut);
  btn("save-btn",   saveCurrentState);
  btn("add-chip-btn",          addChippingSession);
  btn("update-chip-btn",       updateChippingSession);
  btn("cancel-chip-edit-btn",  cancelEditChippingSession);
  btn("add-putt-btn",          addPuttingSession);
  btn("update-putt-btn",       updatePuttingSession);
  btn("cancel-putt-edit-btn",  cancelEditPuttingSession);
  await refreshSession();
});
