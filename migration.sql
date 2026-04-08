-- Migration: Add shot categorization fields to trackman_shots
-- Run this in Supabase SQL editor

ALTER TABLE trackman_shots
  ADD COLUMN IF NOT EXISTS is_full_shot    boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclude_from_progress boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shot_type       text,
  ADD COLUMN IF NOT EXISTS strike_quality  text;

-- Optional: indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_tm_shots_full      ON trackman_shots (is_full_shot);
CREATE INDEX IF NOT EXISTS idx_tm_shots_exclude   ON trackman_shots (exclude_from_progress);
CREATE INDEX IF NOT EXISTS idx_tm_shots_club_date ON trackman_shots (club, created_at DESC);
