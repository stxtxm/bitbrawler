-- Migration: Update stat CHECK constraints for 5-15 range
--
-- Background:
--   gameRules.ts STATS was updated: MIN_VALUE 6→5, MAX_VALUE 14→15, TOTAL_POINTS 60→66
--   ("Increased spread for more unique character builds")
--
--   The characters table likely has CHECK constraints that enforce stat values
--   within the old range (6-14), causing INSERT to fail when stats include 5 or 15.
--
-- Impact:
--   - New players cannot create characters
--   - Bot engine cannot create bots
--   - QA tester cannot validate the app
--
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/bhbpvbfvuayafygdrbgb/sql/new)

-- Step 1: Find existing CHECK constraints on stat columns
-- Run this first to discover constraint names if they exist
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'public.characters'::regclass
  AND contype = 'c'
  AND (pg_get_constraintdef(oid) ILIKE '%strength%'
    OR pg_get_constraintdef(oid) ILIKE '%vitality%'
    OR pg_get_constraintdef(oid) ILIKE '%dexterity%'
    OR pg_get_constraintdef(oid) ILIKE '%luck%'
    OR pg_get_constraintdef(oid) ILIKE '%intelligence%'
    OR pg_get_constraintdef(oid) ILIKE '%focus%');

-- Step 2: Drop old CHECK constraints (replace constraint names with actual names from Step 1)
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_strength_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_vitality_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_dexterity_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_luck_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_intelligence_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_focus_check;

-- Step 3: Add updated CHECK constraints for the 5-15 range
-- ALTER TABLE characters ADD CONSTRAINT characters_strength_check CHECK (strength >= 5 AND strength <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_vitality_check CHECK (vitality >= 5 AND vitality <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_dexterity_check CHECK (dexterity >= 5 AND dexterity <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_luck_check CHECK (luck >= 5 AND luck <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_intelligence_check CHECK (intelligence >= 5 AND intelligence <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_focus_check CHECK (focus >= 5 AND focus <= 15);

-- Alternative (if no existing CHECK constraints exist, just add new ones):
-- ALTER TABLE characters ADD CONSTRAINT characters_stat_range_check
--   CHECK (
--     strength >= 5 AND strength <= 15
--     AND vitality >= 5 AND vitality <= 15
--     AND dexterity >= 5 AND dexterity <= 15
--     AND luck >= 5 AND luck <= 15
--     AND intelligence >= 5 AND intelligence <= 15
--     AND focus >= 5 AND focus <= 15
--   );

-- Verification: Test that the new constraints accept valid stats
-- INSERT INTO characters (name, gender, seed, level, hp, max_hp,
--   strength, vitality, dexterity, luck, intelligence, focus,
--   is_bot)
-- VALUES ('TEST_HERO', 'male', 'test123', 1, 140, 140,
--   5, 10, 15, 8, 12, 6,
--   false);
-- Then delete: DELETE FROM characters WHERE name = 'TEST_HERO';
