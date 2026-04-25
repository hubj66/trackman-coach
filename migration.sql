-- ============================================================
-- Phase 1: Multi-user data isolation
-- Run this entire file in the Supabase SQL editor.
-- All statements use IF NOT EXISTS / IF EXISTS so the file is
-- safe to re-run without side effects.
-- ============================================================

-- ── Step 1: Add user_id to tables that may be missing it ───────────────────

-- club_aliases: null = global alias visible to all; uid = personal alias
ALTER TABLE club_aliases
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- clubs: existing rows keep user_id = NULL (treated as visible to all in policy)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- saved_states: existing rows keep user_id = NULL (visible to all, legacy)
ALTER TABLE saved_states
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- NOTE: trackman_shots, chipping_sessions, putting_sessions are assumed to
-- already have a user_id column (chipping/putting INSERTs set it in the app).
-- If trackman_shots is missing user_id, add it here:
-- ALTER TABLE trackman_shots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Step 2: Enable RLS on all tables ────────────────────────────────────────

ALTER TABLE trackman_shots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chipping_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE putting_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_states        ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_aliases        ENABLE ROW LEVEL SECURITY;

-- If you have a separate trackman_sessions table, uncomment:
-- ALTER TABLE trackman_sessions ENABLE ROW LEVEL SECURITY;

-- ── Step 3: Drop existing policies (idempotent re-run) ────────────────────

DROP POLICY IF EXISTS "own_trackman_shots"     ON trackman_shots;
DROP POLICY IF EXISTS "own_chipping"           ON chipping_sessions;
DROP POLICY IF EXISTS "own_putting"            ON putting_sessions;
DROP POLICY IF EXISTS "own_clubs"              ON clubs;
DROP POLICY IF EXISTS "own_saved_states"       ON saved_states;
DROP POLICY IF EXISTS "read_aliases"           ON club_aliases;
DROP POLICY IF EXISTS "insert_own_aliases"     ON club_aliases;
DROP POLICY IF EXISTS "update_own_aliases"     ON club_aliases;
DROP POLICY IF EXISTS "delete_own_aliases"     ON club_aliases;

-- ── Step 4: RLS policies ────────────────────────────────────────────────────

-- trackman_shots: each user sees and writes only their own shots
CREATE POLICY "own_trackman_shots" ON trackman_shots
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- chipping_sessions: each user sees and writes only their own sessions
CREATE POLICY "own_chipping" ON chipping_sessions
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- putting_sessions: each user sees and writes only their own sessions
CREATE POLICY "own_putting" ON putting_sessions
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- clubs: user sees their own clubs + legacy rows where user_id IS NULL.
-- Legacy NULL rows become invisible once you populate user_id on those rows.
-- Writes require user_id = auth.uid().
CREATE POLICY "own_clubs" ON clubs
  USING  (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

-- saved_states: same pattern as clubs (legacy NULL rows stay visible)
CREATE POLICY "own_saved_states" ON saved_states
  USING  (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

-- club_aliases (three-tier):
--   SELECT: global aliases (user_id IS NULL) + own personal aliases
--   INSERT: only with user_id = auth.uid() (no inserting global aliases)
--   UPDATE: only own personal aliases
--   DELETE: only own personal aliases
CREATE POLICY "read_aliases" ON club_aliases
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "insert_own_aliases" ON club_aliases
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own_aliases" ON club_aliases
  FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own_aliases" ON club_aliases
  FOR DELETE
  USING (user_id = auth.uid());

-- ── Step 5: Performance indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tm_shots_user_club   ON trackman_shots (user_id, club);
CREATE INDEX IF NOT EXISTS idx_tm_shots_user_time   ON trackman_shots (user_id, shot_time DESC);
CREATE INDEX IF NOT EXISTS idx_chip_user_date       ON chipping_sessions (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_putt_user_date       ON putting_sessions (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_clubs_user_active    ON clubs (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_aliases_user         ON club_aliases (user_id);
CREATE INDEX IF NOT EXISTS idx_aliases_raw          ON club_aliases (lower(trim(raw_name)));

-- ── Post-run checklist ───────────────────────────────────────────────────────
-- After running this migration:
-- 1. Verify trackman_shots has a user_id column (check Table Editor).
--    If not, run the commented-out ALTER TABLE above.
-- 2. Existing clubs rows have user_id = NULL. They will still be visible
--    (the policy allows it). You can leave them as-is or manually set
--    user_id = '<your-uuid>' on rows that belong to you.
-- 3. Existing club_aliases rows have user_id = NULL and become global aliases
--    visible to all users — this is correct default behaviour.
-- 4. Test with two different user accounts to confirm data isolation.

-- ── Phase 6: practice_sessions table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS practice_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_type text        NOT NULL DEFAULT 'range',  -- 'range' | 'course'
  session_date  date        NOT NULL DEFAULT current_date,
  club_key      text,
  focus_area    text,
  balls         integer,
  good_shots    integer,
  main_miss     text,
  best_cue      text,
  confidence    integer,    -- 1-5
  title         text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_practice_sessions" ON practice_sessions;
CREATE POLICY "own_practice_sessions" ON practice_sessions
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_practice_user_date
  ON practice_sessions (user_id, session_date DESC);

-- ── Phase 9: profiles table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  handicap      numeric(4,1),
  dominant_hand text        DEFAULT 'right',
  main_goal     text,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_profiles_user
  ON profiles (user_id);
