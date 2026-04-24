// clubAliases.js v2
// Single source of truth for club name resolution.
// Supports global aliases (user_id IS NULL, visible to all) and
// personal aliases (user_id = current user, override global).

const CLUB_DEFINITIONS = [
  { key:'driver', label:'Driver' },
  { key:'3w',     label:'3W' },
  { key:'5w',     label:'5W' },
  { key:'4',      label:'4i' },
  { key:'5',      label:'5i' },
  { key:'6',      label:'6i' },
  { key:'7',      label:'7i' },
  { key:'8',      label:'8i' },
  { key:'9',      label:'9i' },
  { key:'pw',     label:'PW' },
  { key:'sw',     label:'SW' },
  { key:'58',     label:'58°' },
];

let _aliasMap    = null; // raw_name (lowercase) -> club_key
let _globalSet   = null; // Set<string> of raw_names (lowercase) that are global
let _loadPromise = null;
let _hasUserIdCol = null; // null=unknown, true=confirmed, false=column absent

async function loadAliases(forceRefresh = false) {
  if (_aliasMap && !forceRefresh) return _aliasMap;
  if (_loadPromise && !forceRefresh) return _loadPromise;
  _loadPromise = (async () => {
    const sb = window.supabaseClient;
    const { data: authData } = await sb.auth.getSession();
    const userId = authData?.session?.user?.id || null;

    _aliasMap  = {};
    _globalSet = new Set();

    // If not logged in or column is confirmed absent, load without user filter
    if (!userId || _hasUserIdCol === false) {
      const { data, error } = await sb.from('club_aliases').select('raw_name, club_key');
      if (error) { console.warn('[clubAliases] load error:', error.message); return _aliasMap; }
      (data || []).forEach(r => {
        const k = r.raw_name.toLowerCase().trim();
        _aliasMap[k] = r.club_key;
        _globalSet.add(k);
      });
      console.log(`[clubAliases] ${Object.keys(_aliasMap).length} aliases (no user filter)`);
      return _aliasMap;
    }

    // Attempt parallel fetch: global (user_id IS NULL) + personal (user_id = uid)
    const [globalRes, personalRes] = await Promise.all([
      sb.from('club_aliases').select('raw_name, club_key').is('user_id', null),
      sb.from('club_aliases').select('raw_name, club_key').eq('user_id', userId),
    ]);

    // Detect missing column (Postgres error code 42703 = undefined_column)
    const colMissing =
      globalRes.error?.code === '42703' ||
      globalRes.error?.message?.toLowerCase().includes('column') ||
      globalRes.error?.message?.toLowerCase().includes('user_id');

    if (colMissing) {
      _hasUserIdCol = false;
      console.warn('[clubAliases] user_id column absent — run migration.sql first. Falling back to unfiltered load.');
      const { data, error } = await sb.from('club_aliases').select('raw_name, club_key');
      if (error) { console.warn('[clubAliases] fallback error:', error.message); return _aliasMap; }
      (data || []).forEach(r => {
        const k = r.raw_name.toLowerCase().trim();
        _aliasMap[k] = r.club_key;
        _globalSet.add(k);
      });
      console.log(`[clubAliases] ${Object.keys(_aliasMap).length} aliases (fallback — migration pending)`);
      return _aliasMap;
    }

    _hasUserIdCol = true;

    // Apply global aliases first, then personal overrides
    (globalRes.data || []).forEach(r => {
      const k = r.raw_name.toLowerCase().trim();
      _aliasMap[k] = r.club_key;
      _globalSet.add(k);
    });
    (personalRes.data || []).forEach(r => {
      const k = r.raw_name.toLowerCase().trim();
      _aliasMap[k] = r.club_key;
      _globalSet.delete(k); // personal alias overrides global for same raw_name
    });

    console.log(`[clubAliases] ${Object.keys(_aliasMap).length} aliases (${globalRes.data?.length || 0} global, ${personalRes.data?.length || 0} personal)`);
    return _aliasMap;
  })();
  return _loadPromise;
}

function isGlobalAlias(rawName) {
  if (!_globalSet || !rawName) return false;
  return _globalSet.has(rawName.toLowerCase().trim());
}

function resolveClub(rawName) {
  if (!rawName || !_aliasMap) return null;
  return _aliasMap[rawName.toLowerCase().trim()] || null;
}

function shotMatchesClub(shot, clubKey) {
  return resolveClub(shot.club) === clubKey;
}

function groupShotsByClub(shots) {
  const groups = {};
  shots.forEach(s => {
    const key = resolveClub(s.club) || '__unknown__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function getRawNamesForKey(key) {
  if (!_aliasMap) return [];
  return Object.entries(_aliasMap).filter(([, v]) => v === key).map(([k]) => k);
}

function clubLabel(key) {
  return CLUB_DEFINITIONS.find(c => c.key === key)?.label || key.toUpperCase();
}

function getActiveClubKeys(shots) {
  const seen = new Set();
  shots.forEach(s => { const k = resolveClub(s.club); if (k) seen.add(k); });
  return CLUB_DEFINITIONS.filter(c => seen.has(c.key)).map(c => c.key);
}

function findUnknownClubNames(shots) {
  if (!_aliasMap) return [];
  const seen = new Set();
  shots.forEach(s => {
    const raw = (s.club || '').toLowerCase().trim();
    if (raw && !_aliasMap[raw]) seen.add(s.club);
  });
  return [...seen].sort();
}

async function addAlias(rawName, clubKey) {
  const sb = window.supabaseClient;
  const { data: authData } = await sb.auth.getSession();
  const userId = authData?.session?.user?.id;
  if (!userId) return { ok: false, msg: 'Not logged in' };
  const payload = { raw_name: rawName.trim(), club_key: clubKey.trim() };
  if (_hasUserIdCol !== false) payload.user_id = userId;
  const { error } = await sb.from('club_aliases').insert(payload);
  if (error) return { ok: false, msg: error.message };
  _loadPromise = null;
  await loadAliases(true);
  return { ok: true };
}

async function deleteAlias(rawName) {
  const k = rawName.trim().toLowerCase();
  if (_globalSet?.has(k)) return { ok: false, msg: 'Global aliases cannot be deleted — add a personal alias to override.' };
  const sb = window.supabaseClient;
  const { data: authData } = await sb.auth.getSession();
  const userId = authData?.session?.user?.id;
  if (!userId) return { ok: false, msg: 'Not logged in' };
  let q = sb.from('club_aliases').delete().ilike('raw_name', rawName.trim());
  if (_hasUserIdCol !== false) q = q.eq('user_id', userId);
  const { error } = await q;
  if (error) return { ok: false, msg: error.message };
  _loadPromise = null;
  await loadAliases(true);
  return { ok: true };
}

window.clubAliases = {
  CLUB_DEFINITIONS, loadAliases, resolveClub, shotMatchesClub,
  groupShotsByClub, getRawNamesForKey, clubLabel, getActiveClubKeys,
  findUnknownClubNames, addAlias, deleteAlias, isGlobalAlias,
};
