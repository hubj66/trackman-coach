// clubAliases.js v1
// Single source of truth for club name resolution.
// Loads the club_aliases table from Supabase once and caches it.

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

let _aliasMap = null;
let _loadPromise = null;

async function loadAliases(forceRefresh=false) {
  if (_aliasMap && !forceRefresh) return _aliasMap;
  if (_loadPromise && !forceRefresh) return _loadPromise;
  _loadPromise = (async () => {
    const sb = window.supabaseClient;
    const { data, error } = await sb.from('club_aliases').select('raw_name, club_key');
    if (error) { console.warn('club_aliases load error:', error.message); _aliasMap = {}; return _aliasMap; }
    _aliasMap = {};
    (data || []).forEach(row => { _aliasMap[row.raw_name.toLowerCase().trim()] = row.club_key; });
    console.log(`[clubAliases] Loaded ${Object.keys(_aliasMap).length} aliases`);
    return _aliasMap;
  })();
  return _loadPromise;
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
  return Object.entries(_aliasMap).filter(([,v]) => v === key).map(([k]) => k);
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
  const { error } = await window.supabaseClient.from('club_aliases').insert({ raw_name: rawName.trim(), club_key: clubKey.trim() });
  if (error) return { ok: false, msg: error.message };
  await loadAliases(true);
  return { ok: true };
}

async function deleteAlias(rawName) {
  const { error } = await window.supabaseClient.from('club_aliases').delete().ilike('raw_name', rawName.trim());
  if (error) return { ok: false, msg: error.message };
  await loadAliases(true);
  return { ok: true };
}

window.clubAliases = {
  CLUB_DEFINITIONS, loadAliases, resolveClub, shotMatchesClub,
  groupShotsByClub, getRawNamesForKey, clubLabel, getActiveClubKeys,
  findUnknownClubNames, addAlias, deleteAlias,
};
