-- Migration: Drop stat CHECK constraints (removing 5–15 limits)
--
-- Background:
--   Stat caps have been removed from the game (v3.1.0).
--   Characters can now progress stats without any upper limit.
--   The CHECK constraints that enforced the 5–15 range must be dropped
--   to allow values above 15 and below 5.
--
-- Impact:
--   - Players can allocate stat points above 15 without DB rejection
--   - Character generation no longer requires range validation
--   - Bot engine can freely allocate stats
--
-- How to run:
--   Paste the entire file into the Supabase SQL Editor and execute.
--   https://supabase.com/dashboard/project/bhbpvbfvuayafygdrbgb/sql/new

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_strength_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_vitality_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_dexterity_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_luck_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_intelligence_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_focus_check;

-- Verify that no stat constraints remain
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'public.characters'::regclass
  AND contype = 'c'
  AND conname LIKE 'characters_%_check'
ORDER BY conname;
