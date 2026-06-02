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
-- How to run:
--   Paste the entire file into the Supabase SQL Editor and execute.
--   https://supabase.com/dashboard/project/bhbpvbfvuayafygdrbgb/sql/new
--
-- The DO block dynamically discovers existing constraint names so you don't
-- need to look them up manually.

-- Step 1: Drop old constraints and add new ones (automatic discovery)
DO $$
DECLARE
    cons RECORD;
    col_name TEXT;
    constraint_count INT := 0;
BEGIN
    -- Discover and drop all existing CHECK constraints on stat columns
    FOR cons IN
        SELECT conname, pg_get_constraintdef(oid) AS cons_def
        FROM pg_constraint
        WHERE conrelid = 'public.characters'::regclass
          AND contype = 'c'
          AND (
               pg_get_constraintdef(oid) ILIKE '%strength%'
            OR pg_get_constraintdef(oid) ILIKE '%vitality%'
            OR pg_get_constraintdef(oid) ILIKE '%dexterity%'
            OR pg_get_constraintdef(oid) ILIKE '%luck%'
            OR pg_get_constraintdef(oid) ILIKE '%intelligence%'
            OR pg_get_constraintdef(oid) ILIKE '%focus%'
          )
    LOOP
        EXECUTE format('ALTER TABLE characters DROP CONSTRAINT IF EXISTS %I', cons.conname);
        RAISE NOTICE 'Dropped constraint: % (%)', cons.conname, cons.cons_def;
        constraint_count := constraint_count + 1;
    END LOOP;

    IF constraint_count = 0 THEN
        RAISE NOTICE 'No existing CHECK constraints found on stat columns. Proceeding to add new ones.';
    ELSE
        RAISE NOTICE 'Dropped % existing constraint(s).', constraint_count;
    END IF;

    -- Add updated CHECK constraints for the 5-15 range
    ALTER TABLE characters ADD CONSTRAINT characters_strength_check CHECK (strength >= 5 AND strength <= 15);
    ALTER TABLE characters ADD CONSTRAINT characters_vitality_check CHECK (vitality >= 5 AND vitality <= 15);
    ALTER TABLE characters ADD CONSTRAINT characters_dexterity_check CHECK (dexterity >= 5 AND dexterity <= 15);
    ALTER TABLE characters ADD CONSTRAINT characters_luck_check CHECK (luck >= 5 AND luck <= 15);
    ALTER TABLE characters ADD CONSTRAINT characters_intelligence_check CHECK (intelligence >= 5 AND intelligence <= 15);
    ALTER TABLE characters ADD CONSTRAINT characters_focus_check CHECK (focus >= 5 AND focus <= 15);

    RAISE NOTICE 'Added 6 new CHECK constraints (5-15 range) on stat columns.';
END;
$$;

-- Step 2: Verify new constraints are in place
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'public.characters'::regclass
  AND contype = 'c'
  AND conname LIKE 'characters_%_check'
ORDER BY conname;

-- Step 3: Test that the new constraints accept valid stats
-- INSERT INTO characters (name, gender, seed, level, hp, max_hp,
--   strength, vitality, dexterity, luck, intelligence, focus,
--   is_bot)
-- VALUES ('TEST_HERO', 'male', 'test123', 1, 140, 140,
--   5, 10, 15, 8, 12, 6,
--   false);
-- Then delete: DELETE FROM characters WHERE name = 'TEST_HERO';

-- Step 4: If you prefer manual control, here are the equivalent statements:
-- (Run these individually instead of the DO block above)
--
-- -- 4a. Find existing CHECK constraints on stat columns
-- SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS constraint_def
-- FROM pg_constraint
-- WHERE conrelid = 'public.characters'::regclass
--   AND contype = 'c'
--   AND (pg_get_constraintdef(oid) ILIKE '%strength%'
--     OR pg_get_constraintdef(oid) ILIKE '%vitality%'
--     OR pg_get_constraintdef(oid) ILIKE '%dexterity%'
--     OR pg_get_constraintdef(oid) ILIKE '%luck%'
--     OR pg_get_constraintdef(oid) ILIKE '%intelligence%'
--     OR pg_get_constraintdef(oid) ILIKE '%focus%');
--
-- -- 4b. Drop old CHECK constraints (replace constraint names with actual names from 4a)
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_strength_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_vitality_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_dexterity_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_luck_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_intelligence_check;
-- ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_focus_check;
--
-- -- 4c. Add updated CHECK constraints for the 5-15 range
-- ALTER TABLE characters ADD CONSTRAINT characters_strength_check CHECK (strength >= 5 AND strength <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_vitality_check CHECK (vitality >= 5 AND vitality <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_dexterity_check CHECK (dexterity >= 5 AND dexterity <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_luck_check CHECK (luck >= 5 AND luck <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_intelligence_check CHECK (intelligence >= 5 AND intelligence <= 15);
-- ALTER TABLE characters ADD CONSTRAINT characters_focus_check CHECK (focus >= 5 AND focus <= 15);
