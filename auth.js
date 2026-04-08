const sb = window.supabaseClient;

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

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

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

function setLoggedInUI(user) {
  const loggedOut = document.getElementById("logged-out-view");
  const loggedIn = document.getElementById("logged-in-view");
  const userEmail = document.getElementById("user-email");

  if (loggedOut) loggedOut.style.display = "none";
  if (loggedIn) loggedIn.style.display = "block";
  if (userEmail) userEmail.textContent = user?.email || "";
}

function setLoggedOutUI() {
  const loggedOut = document.getElementById("logged-out-view");
  const loggedIn = document.getElementById("logged-in-view");
  const userEmail = document.getElementById("user-email");
  const savedList = document.getElementById("saved-list");

  if (loggedOut) loggedOut.style.display = "block";
  if (loggedIn) loggedIn.style.display = "none";
  if (userEmail) userEmail.textContent = "";
  if (savedList) savedList.innerHTML = "";
}

async function refreshSession() {
  const { data, error } = await sb.auth.getSession();

  if (error) {
    msg(error.message, true);
    return;
  }

  const session = data.session;

  if (session?.user) {
    setLoggedInUI(session.user);
    await loadSavedStates();
  } else {
    setLoggedOutUI();
  }
}

async function signUp() {
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value || "";

  const { error } = await sb.auth.signUp({
    email,
    password
  });

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Signup successful. Check your email if confirmation is enabled.");
}

async function logIn() {
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value || "";

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Logged in");
  await refreshSession();
}

async function logOut() {
  const { error } = await sb.auth.signOut();

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Logged out");
  setLoggedOutUI();
}

async function saveCurrentState() {
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    msg("Please log in first", true);
    return;
  }

  const title =
    document.getElementById("save-title")?.value?.trim() ||
    `Save ${new Date().toLocaleString()}`;

  if (!window.trackmanCoach || !window.trackmanCoach.getCurrentState) {
    msg("App state function not found", true);
    return;
  }

  const currentState = window.trackmanCoach.getCurrentState();

  const { error } = await sb.from("saved_states").insert({
    user_id: user.id,
    title,
    club: currentState.club || null,
    app_state: currentState
  });

  if (error) {
    msg(error.message, true);
    return;
  }

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

  if (error) {
    msg(error.message, true);
    return;
  }

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

  if (!window.trackmanCoach || !window.trackmanCoach.applyState) {
    msg("App load function not found", true);
    return;
  }

  window.trackmanCoach.applyState(row.app_state);
  msg(`Loaded: ${row.title}`);
}

async function deleteOneState(id) {
  const { error } = await sb
    .from("saved_states")
    .delete()
    .eq("id", id);

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Deleted");
  await loadSavedStates();
}

async function loadTrackmanSummary() {
  const el = document.getElementById("stats-trackman-summary");
  if (!el) return;

  const { data, error } = await sb
    .from("trackman_shots")
    .select("club, carry, smash_factor, ball_speed, club_speed, spin_rate, launch_angle, attack_angle, club_path, face_angle, side, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    el.innerHTML = `Error loading TrackMan stats: ${escapeHtml(error.message)}`;
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = "No TrackMan data yet.";
    return;
  }

  const shots = data.length;
  const avgCarry = avg(data.map(x => x.carry));
  const avgSmash = avg(data.map(x => x.smash_factor));
  const avgBallSpeed = avg(data.map(x => x.ball_speed));
  const avgClubSpeed = avg(data.map(x => x.club_speed));

  const clubCounts = {};
  data.forEach(row => {
    const key = row.club || "Unknown";
    clubCounts[key] = (clubCounts[key] || 0) + 1;
  });

  const clubList = Object.entries(clubCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([club, count]) => `${escapeHtml(club)}: ${count}`)
    .join("<br>");

  el.innerHTML = `
    <div class="stats-card">
      <div><strong>Total shots:</strong> ${shots}</div>
      <div><strong>Average carry:</strong> ${fmt(avgCarry, 1)}</div>
      <div><strong>Average smash:</strong> ${fmt(avgSmash, 2)}</div>
      <div><strong>Average ball speed:</strong> ${fmt(avgBallSpeed, 1)}</div>
      <div><strong>Average club speed:</strong> ${fmt(avgClubSpeed, 1)}</div>
      <div style="margin-top:12px;"><strong>Shots by club</strong><br>${clubList}</div>
    </div>
  `;
}

async function loadChippingSummary() {
  const el = document.getElementById("stats-chipping-summary");
  if (!el) return;

  const { data, error } = await sb
    .from("chipping_sessions")
    .select("session_date, distance_m, club, attempts, success_target, inside_1m, between_1_2m, between_2_3m, outside_3m")
    .order("session_date", { ascending: false })
    .limit(100);

  if (error) {
    el.innerHTML = `Error loading chipping stats: ${escapeHtml(error.message)}`;
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = "No chipping data yet.";
    return;
  }

  const sessions = data.length;
  const attempts = sum(data.map(x => x.attempts));
  const inside1m = sum(data.map(x => x.inside_1m));
  const inside2m = sum(data.map(x => (x.inside_1m || 0) + (x.between_1_2m || 0)));
  const inside3m = sum(data.map(x => (x.inside_1m || 0) + (x.between_1_2m || 0) + (x.between_2_3m || 0)));

  const latest = data.slice(0, 5).map(row => `
    <tr>
      <td>${escapeHtml(row.session_date)}</td>
      <td>${escapeHtml(row.club)}</td>
      <td>${fmt(row.distance_m, 1)}m</td>
      <td>${row.attempts}</td>
      <td>${row.inside_1m || 0}</td>
      <td>${row.between_1_2m || 0}</td>
      <td>${row.between_2_3m || 0}</td>
      <td>${row.outside_3m || 0}</td>
    </tr>
  `).join("");

  el.innerHTML = `
    <div class="stats-card">
      <div><strong>Sessions:</strong> ${sessions}</div>
      <div><strong>Total attempts:</strong> ${attempts}</div>
      <div><strong>Inside 1m:</strong> ${inside1m} (${pct(inside1m, attempts)})</div>
      <div><strong>Inside 2m:</strong> ${inside2m} (${pct(inside2m, attempts)})</div>
      <div><strong>Inside 3m:</strong> ${inside3m} (${pct(inside3m, attempts)})</div>
    </div>

    <div class="stats-table-wrap">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Club</th>
            <th>Dist</th>
            <th>Att</th>
            <th>&lt;1m</th>
            <th>1–2m</th>
            <th>2–3m</th>
            <th>&gt;3m</th>
          </tr>
        </thead>
        <tbody>
          ${latest}
        </tbody>
      </table>
    </div>
  `;
}

async function loadPuttingSummary() {
  const el = document.getElementById("stats-putting-summary");
  if (!el) return;

  const { data, error } = await sb
    .from("putting_sessions")
    .select("session_date, distance_m, holed, total")
    .order("session_date", { ascending: false })
    .limit(100);

  if (error) {
    el.innerHTML = `Error loading putting stats: ${escapeHtml(error.message)}`;
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = "No putting data yet.";
    return;
  }

  const sessions = data.length;
  const holed = sum(data.map(x => x.holed));
  const total = sum(data.map(x => x.total));

  const latest = data.slice(0, 5).map(row => `
    <tr>
      <td>${escapeHtml(row.session_date)}</td>
      <td>${fmt(row.distance_m, 1)}m</td>
      <td>${row.holed}</td>
      <td>${row.total}</td>
      <td>${pct(row.holed, row.total)}</td>
    </tr>
  `).join("");

  el.innerHTML = `
    <div class="stats-card">
      <div><strong>Sessions:</strong> ${sessions}</div>
      <div><strong>Total putts tracked:</strong> ${total}</div>
      <div><strong>Holed:</strong> ${holed}</div>
      <div><strong>Make rate:</strong> ${pct(holed, total)}</div>
    </div>

    <div class="stats-table-wrap">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Dist</th>
            <th>Holed</th>
            <th>Total</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          ${latest}
        </tbody>
      </table>
    </div>
  `;
}

async function loadClubsOverview() {
  const el = document.getElementById("clubs-overview");
  if (!el) return;

  const { data: clubsData, error: clubsError } = await sb
    .from("clubs")
    .select("club_key, club_name, club_type, brand, model, loft, is_active")
    .eq("is_active", true)
    .order("club_name", { ascending: true });

  if (clubsError) {
    el.innerHTML = `Error loading clubs: ${escapeHtml(clubsError.message)}`;
    return;
  }

  if (!clubsData || clubsData.length === 0) {
    el.innerHTML = "No clubs added yet.";
    return;
  }

  el.innerHTML = clubsData.map(row => `
    <div class="stats-card" style="margin-bottom:12px;">
      <div><strong>${escapeHtml(row.club_name)}</strong></div>
      <div>Type: ${escapeHtml(row.club_type || "")}</div>
      <div>Brand: ${escapeHtml(row.brand || "")}</div>
      <div>Model: ${escapeHtml(row.model || "")}</div>
      <div>Loft: ${row.loft ?? ""}</div>
    </div>
  `).join("");
}

async function loadStatsPage() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();

  if (sessionError) {
    msg(sessionError.message, true);
    return;
  }

  const user = sessionData.session?.user;

  if (!user) {
    const tm = document.getElementById("stats-trackman-summary");
    const ch = document.getElementById("stats-chipping-summary");
    const pt = document.getElementById("stats-putting-summary");
    const cl = document.getElementById("clubs-overview");

    if (tm) tm.innerHTML = "Please log in to view stats.";
    if (ch) ch.innerHTML = "Please log in to view stats.";
    if (pt) pt.innerHTML = "Please log in to view stats.";
    if (cl) cl.innerHTML = "Please log in to view clubs.";
    return;
  }

  await Promise.all([
    loadTrackmanSummary(),
    loadChippingSummary(),
    loadPuttingSummary(),
    loadClubsOverview()
  ]);
}

async function addChippingSession() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();

  if (sessionError) {
    msg(sessionError.message, true);
    return;
  }

  const user = sessionData.session?.user;
  if (!user) {
    msg("Please log in first", true);
    return;
  }

  const session_date = document.getElementById("chip-date")?.value;
  const distance_m = Number(document.getElementById("chip-distance")?.value);
  const club = document.getElementById("chip-club")?.value?.trim();
  const attempts = Number(document.getElementById("chip-attempts")?.value);
  const inside_1m = Number(document.getElementById("chip-in1")?.value || 0);
  const between_1_2m = Number(document.getElementById("chip-in2")?.value || 0);
  const between_2_3m = Number(document.getElementById("chip-in3")?.value || 0);
  const outside_3m = Number(document.getElementById("chip-out3")?.value || 0);
  const success_target_raw = document.getElementById("chip-success")?.value;
  const notes = document.getElementById("chip-notes")?.value?.trim() || null;

  if (!session_date || !club || !distance_m || !attempts) {
    msg("Please fill date, distance, club and attempts", true);
    return;
  }

  const bucketTotal = inside_1m + between_1_2m + between_2_3m + outside_3m;
  if (bucketTotal > attempts) {
    msg("Bucket totals cannot be more than attempts", true);
    return;
  }

  const success_target =
    success_target_raw === "" || success_target_raw == null
      ? null
      : Number(success_target_raw);

  const { error } = await sb.from("chipping_sessions").insert({
    user_id: user.id,
    session_date,
    distance_m,
    club,
    attempts,
    success_target,
    inside_1m,
    between_1_2m,
    between_2_3m,
    outside_3m,
    notes
  });

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Chipping session added");
  clearChippingForm();
  await loadChippingSummary();
}

function clearChippingForm() {
  const ids = [
    "chip-date",
    "chip-distance",
    "chip-club",
    "chip-attempts",
    "chip-in1",
    "chip-in2",
    "chip-in3",
    "chip-out3",
    "chip-success",
    "chip-notes"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function addPuttingSession() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();

  if (sessionError) {
    msg(sessionError.message, true);
    return;
  }

  const user = sessionData.session?.user;
  if (!user) {
    msg("Please log in first", true);
    return;
  }

  const session_date = document.getElementById("putt-date")?.value;
  const distance_m = Number(document.getElementById("putt-distance")?.value);
  const holed = Number(document.getElementById("putt-holed")?.value);
  const total = Number(document.getElementById("putt-total")?.value);
  const notes = document.getElementById("putt-notes")?.value?.trim() || null;

  if (!session_date || !distance_m || total <= 0 || holed < 0) {
    msg("Please fill date, distance, holed and total", true);
    return;
  }

  if (holed > total) {
    msg("Holed cannot be more than total", true);
    return;
  }

  const { error } = await sb.from("putting_sessions").insert({
    user_id: user.id,
    session_date,
    distance_m,
    holed,
    total,
    notes
  });

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Putting session added");
  clearPuttingForm();
  await loadPuttingSummary();
}

function clearPuttingForm() {
  const ids = [
    "putt-date",
    "putt-distance",
    "putt-holed",
    "putt-total",
    "putt-notes"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

window.loadOneState = loadOneState;
window.deleteOneState = deleteOneState;
window.loadStatsPage = loadStatsPage;
window.saveCurrentState = saveCurrentState;

window.addEventListener("DOMContentLoaded", async () => {
  const signupBtn = document.getElementById("signup-btn");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const saveBtn = document.getElementById("save-btn");
  const addChipBtn = document.getElementById("add-chip-btn");
  const addPuttBtn = document.getElementById("add-putt-btn");

  if (signupBtn) signupBtn.addEventListener("click", signUp);
  if (loginBtn) loginBtn.addEventListener("click", logIn);
  if (logoutBtn) logoutBtn.addEventListener("click", logOut);
  if (saveBtn) saveBtn.addEventListener("click", saveCurrentState);
  if (addChipBtn) addChipBtn.addEventListener("click", addChippingSession);
  if (addPuttBtn) addPuttBtn.addEventListener("click", addPuttingSession);

  await refreshSession();
});
