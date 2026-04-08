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
