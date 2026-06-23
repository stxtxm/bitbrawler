-- Migration: Add all missing columns to characters table
--
-- Colonnes ajoutées dans CharacterRow (src/config/supabase.ts) mais
-- sans fichier de migration dédié, ou dont la migration n'a pas été exécutée.
--
-- Exécuter dans Supabase Dashboard > SQL Editor > New Query
-- https://supabase.com/dashboard/project/bhbpvbfvuayafygdrbgb/sql/new
--
-- Toutes les colonnes utilisent IF NOT EXISTS pour être ré-exécutables.

BEGIN;

-- ── Idle / PvE System ──────────────────────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS idle_streak INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS idle_max_streak INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS idle_total_kills INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS idle_total_xp INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_idle_check TIMESTAMP;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_active TIMESTAMP;

-- ── Forge / Essence System ─────────────────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS essence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS item_upgrades JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Lootbox Streak System ──────────────────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS lootbox_streak INTEGER DEFAULT 0;

-- ── Equipment System ───────────────────────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_items JSONB DEFAULT '{"weapon": null, "armor": null, "accessory": null}'::jsonb;

-- ── PvE Fights System ──────────────────────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pve_fights_left INTEGER DEFAULT 5;

-- ── Stats: Drop CHECK constraints (stat caps removed in v3.1.0) ─
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_strength_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_vitality_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_dexterity_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_luck_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_intelligence_check;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_focus_check;

COMMIT;

-- ── Vérification ───────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'characters'
ORDER BY ordinal_position;
