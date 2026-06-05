// data.js
// Thin Supabase access helpers. These keep screen code from repeating auth and
// current-user query boilerplate as the app gets split further.

(function () {
  function client() {
    return window.supabaseClient;
  }

  async function getSession() {
    return client().auth.getSession();
  }

  async function getCurrentUser() {
    const { data, error } = await getSession();
    return { user: data?.session?.user || null, error };
  }

  async function requireUser() {
    const { user, error } = await getCurrentUser();
    if (error) return { user: null, error };
    if (!user) return { user: null, error: { message: 'Not logged in' } };
    return { user, error: null };
  }

  function ownRows(table, userId, select = '*') {
    return client().from(table).select(select).eq('user_id', userId);
  }

  async function fetchOwnRows(table, userId, select, configure) {
    let query = client().from(table).select(select).eq('user_id', userId);
    if (configure) query = configure(query);
    const { data, error } = await query;
    return { data: data || [], error };
  }

  async function fetchTrackmanShots(userId, select, { limit = 300, progressOnly = false } = {}) {
    return fetchOwnRows('trackman_shots', userId, select, query => {
      if (progressOnly) query = query.eq('exclude_from_progress', false);
      return query.order('shot_time', { ascending: false }).limit(limit);
    });
  }

  async function fetchChippingSessions(userId, select, limit = 10) {
    return fetchOwnRows('chipping_sessions', userId, select, query =>
      query.order('session_date', { ascending: false }).limit(limit)
    );
  }

  async function fetchPuttingSessions(userId, select, limit = 20) {
    return fetchOwnRows('putting_sessions', userId, select, query =>
      query.order('session_date', { ascending: false }).limit(limit)
    );
  }

  window.TCData = {
    client,
    getSession,
    getCurrentUser,
    requireUser,
    ownRows,
    fetchOwnRows,
    fetchTrackmanShots,
    fetchChippingSessions,
    fetchPuttingSessions,
  };
})();
