const sb = window.supabaseClient;

function msg(text, isError = false) {
  const el = document.getElementById("auth-message");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "red" : "green";
}

function setLoggedInUI(user) {
  document.getElementById("logged-out-view").style.display = "none";
  document.getElementById("logged-in-view").style.display = "block";
  document.getElementById("user-email").textContent = user?.email || "";
}

function setLoggedOutUI() {
  document.getElementById("logged-out-view").style.display = "block";
  document.getElementById("logged-in-view").style.display = "none";
  document.getElementById("user-email").textContent = "";
  document.getElementById("saved-list").innerHTML = "";
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
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

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
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

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
    document.getElementById("save-title").value.trim() ||
    `Save ${new Date().toLocaleString()}`;

  if (!window.trackmanCoach || !window.trackmanCoach.getCurrentState) {
    msg("App state function not found", true);
    return;
  }

  const currentState = window.trackmanCoach.getCurrentState();

  const { error } = await sb.from("saved_states").insert({
    user_id: user.id,
    title: title,
    club: currentState.club || null,
    app_state: currentState
  });

  if (error) {
    msg(error.message, true);
    return;
  }

  msg("Saved");
  document.getElementById("save-title").value = "";
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

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No saved stats yet.</p>";
    return;
  }

  list.innerHTML = data.map(row => `
    <div style="margin:8px 0; padding:8px; border:1px solid #ccc;">
      <strong>${escapeHtml(row.title)}</strong><br>
      <small>${escapeHtml(row.club || "")} · ${new Date(row.created_at).toLocaleString()}</small><br>
      <button onclick="loadOneState('${row.id}')">Load</button>
      <button onclick="deleteOneState('${row.id}')">Delete</button>
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.loadOneState = loadOneState;
window.deleteOneState = deleteOneState;

window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("signup-btn").addEventListener("click", signUp);
  document.getElementById("login-btn").addEventListener("click", logIn);
  document.getElementById("logout-btn").addEventListener("click", logOut);
  document.getElementById("save-btn").addEventListener("click", saveCurrentState);

  await refreshSession();
});


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

  el.innerHTML = `
    <div class="stats-card">
      <div><strong>Sessions:</strong> ${sessions}</div>
      <div><strong>Total attempts:</strong> ${attempts}</div>
      <div><strong>Inside 1m:</strong> ${inside1m} (${pct(inside1m, attempts)})</div>
      <div><strong>Inside 2m:</strong> ${inside2m} (${pct(inside2m, attempts)})</div>
      <div><strong>Inside 3m:</strong> ${inside3m} (${pct(inside3m, attempts)})</div>
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

  el.innerHTML = `
    <div class="stats-card">
      <div><strong>Sessions:</strong> ${sessions}</div>
      <div><strong>Total putts tracked:</strong> ${total}</div>
      <div><strong>Holed:</strong> ${holed}</div>
      <div><strong>Make rate:</strong> ${pct(holed, total)}</div>
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

window.loadStatsPage = loadStatsPage;
