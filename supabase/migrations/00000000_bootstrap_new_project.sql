-- =============================================================================
-- BitBrawler — Bootstrap complet pour un NOUVEAU projet Supabase
-- =============================================================================
-- But : recréer le schéma complet (characters + maintenance + server_time)
--       sur un nouveau compte/projet Supabase.
--
-- ⚠️  Ne JAMAIS exécuter automatiquement — copier-coller dans :
--     Supabase Dashboard > SQL Editor > New Query > Run
--
-- Ordre : 1) extension  2) characters  3) maintenance/server_time
--         4) indexes  5) RLS + policies anon
-- =============================================================================

-- 1) Extension (gen_random_uuid) — natif sur PG15+, sinon pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Table characters ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  gender text NOT NULL,
  seed text NOT NULL,

  -- Stats de base
  level integer NOT NULL DEFAULT 1,
  hp integer NOT NULL DEFAULT 100,
  max_hp integer NOT NULL DEFAULT 100,
  strength integer NOT NULL DEFAULT 5,
  vitality integer NOT NULL DEFAULT 5,
  dexterity integer NOT NULL DEFAULT 5,
  luck integer NOT NULL DEFAULT 5,
  intelligence integer NOT NULL DEFAULT 5,
  focus integer NOT NULL DEFAULT 5,

  -- Progression
  experience integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  fights_left integer NOT NULL DEFAULT 5,
  pve_fights_left integer NOT NULL DEFAULT 5,
  stat_points integer NOT NULL DEFAULT 0,
  last_fight_reset bigint NOT NULL DEFAULT 0,

  -- JSONB (arrays / objects)
  fight_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  fought_today jsonb NOT NULL DEFAULT '[]'::jsonb,
  inventory jsonb NOT NULL DEFAULT '[]'::jsonb,
  incoming_fight_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_fight jsonb,
  equipped_items jsonb NOT NULL DEFAULT '{"weapon": null, "armor": null, "accessory": null}'::jsonb,
  item_upgrades jsonb NOT NULL DEFAULT '{}'::jsonb,
  medal_progress jsonb,
  boss_progress jsonb,

  -- Lootbox
  last_loot_roll bigint NOT NULL DEFAULT 0,
  lootbox_streak integer NOT NULL DEFAULT 0,
  lootbox_pity integer NOT NULL DEFAULT 0,

  -- Idle / PvE
  last_idle_check timestamptz,
  last_active timestamptz,
  idle_streak integer NOT NULL DEFAULT 0,
  idle_max_streak integer NOT NULL DEFAULT 0,
  idle_total_kills integer NOT NULL DEFAULT 0,
  idle_total_xp integer NOT NULL DEFAULT 0,

  -- Forge / Essence
  essence integer NOT NULL DEFAULT 0,

  -- Médailles
  medal_inventory_bonus integer NOT NULL DEFAULT 0,
  medal_xp_bonus integer NOT NULL DEFAULT 0,
  medal_title text,
  medal_aura boolean NOT NULL DEFAULT false,

  -- Push notifications (FCM)
  push_endpoint text,
  push_keys text,
  push_subscribed boolean,

  -- Flags
  is_bot boolean NOT NULL DEFAULT false,
  auto_mode boolean NOT NULL DEFAULT false
);

-- 3) Tables annexes -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance (
  id text PRIMARY KEY,
  last_completed_key text,
  last_completed_at bigint,
  last_completed_at_utc timestamptz,
  target_paris_midnight_utc bigint,
  reset_window text,
  scope text,
  updated_characters integer NOT NULL DEFAULT 0,
  status text
);

CREATE TABLE IF NOT EXISTS server_time (
  id integer PRIMARY KEY,
  timestamp bigint NOT NULL DEFAULT 0
);
INSERT INTO server_time (id, timestamp) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;

-- 4) Indexes (perf matchmaking / rankings / bot-engine) ----------------------
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters (level);
CREATE INDEX IF NOT EXISTS idx_characters_is_bot ON characters (is_bot);
CREATE INDEX IF NOT EXISTS idx_characters_level_is_bot ON characters (level, is_bot);

-- 5) RLS + policies permissives (client utilise la clé anon, sans auth) -------
--    Le service_role (scripts GitHub) bypass RLS automatiquement.
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

-- characters : le jeu lit/écrit/met à jour/supprime (reset ALPHA) en anon
DROP POLICY IF EXISTS "anon_chars_select" ON characters;
CREATE POLICY "anon_chars_select" ON characters FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_chars_insert" ON characters;
CREATE POLICY "anon_chars_insert" ON characters FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "anon_chars_update" ON characters;
CREATE POLICY "anon_chars_update" ON characters FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_chars_delete" ON characters;
CREATE POLICY "anon_chars_delete" ON characters FOR DELETE USING (true);

-- server_time : lecture seule pour le healthcheck
DROP POLICY IF EXISTS "anon_server_time_select" ON server_time;
CREATE POLICY "anon_server_time_select" ON server_time FOR SELECT USING (true);

-- maintenance : lu/écrit par le daily-reset
DROP POLICY IF EXISTS "anon_maintenance_all" ON maintenance;
CREATE POLICY "anon_maintenance_all" ON maintenance FOR ALL USING (true) WITH CHECK (true);
