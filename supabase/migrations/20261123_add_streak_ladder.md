# Migration : table `streak_ladder` (Weekly Streak Ladder)

Cible : **`bhbpvbfvuayafygdrbgb`** (base de référence, cf. `src/config/supabase.ts`).
À exécuter dans **Supabase Dashboard > SQL Editor > New Query** — jamais par un agent.

## Changement
- Table : `streak_ladder` (nouvelle)
- Colonnes :
  - `character_id` — `UUID` — référence `characters(id)`, `ON DELETE CASCADE`
  - `week_key` — `TEXT` — clé ISO `YYYY-Www` (Europe/Paris)
  - `name` — `TEXT` — nom du personnage au moment de la soumission
  - `streak` — `INTEGER` — streak de lootbox (`characters.lootbox_streak`) au moment de la soumission
  - `tier` — `TEXT` — `gold` / `silver` / `bronze`, `NULL` tant que la semaine n'est pas finalisée
  - `updated_at` — `TIMESTAMPTZ` — défaut `now()`
- Clé primaire : `(character_id, week_key)`
- Index : `(week_key, streak DESC)`

## Pourquoi
Classement hebdomadaire en lecture seule sur une métrique déjà existante
(`lootbox_streak`). Une ligne par joueur et par semaine, écrite en `upsert` au
plus une fois par session, lue triée pour le panneau. Aucun temps réel, aucun
nouveau mode de jeu.

La semaine est calculée côté client/script avec `getWeekKey()` (ISO 8601,
fuseau `Europe/Paris`) : le « reset » est implicite, une nouvelle semaine n'a
simplement aucune ligne. Le script `npm run streak-ladder:reset` finalise les
tiers de la semaine écoulée et purge les semaines de plus de 8 semaines.

## Commande SQL
```sql
CREATE TABLE IF NOT EXISTS streak_ladder (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  name TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  tier TEXT CHECK (tier IS NULL OR tier IN ('bronze', 'silver', 'gold')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, week_key)
);

CREATE INDEX IF NOT EXISTS streak_ladder_week_streak_idx
  ON streak_ladder (week_key, streak DESC);

ALTER TABLE streak_ladder ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS streak_ladder_anon_select ON streak_ladder;
CREATE POLICY streak_ladder_anon_select ON streak_ladder
  FOR SELECT USING (true);

DROP POLICY IF EXISTS streak_ladder_anon_insert ON streak_ladder;
CREATE POLICY streak_ladder_anon_insert ON streak_ladder
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS streak_ladder_anon_update ON streak_ladder;
CREATE POLICY streak_ladder_anon_update ON streak_ladder
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE streak_ladder TO anon, authenticated, service_role;
```

## Notes
- `IF NOT EXISTS` / `DROP POLICY IF EXISTS` : ré-exécutable sans erreur.
- Aucun downtime : table neuve, aucune ligne existante touchée.
- Tant que la migration n'est pas exécutée, le code reste fonctionnel : le
  panneau affiche `LADDER OFFLINE — MIGRATION EN ATTENTE`, l'`upsert` échoue
  silencieusement (détection `42P01` / `PGRST205`) et la soumission est
  conservée en `localStorage` pour l'affichage local.
- Vérification : `SELECT count(*) FROM streak_ladder;` puis, côté anon,
  `curl -s '<project>/rest/v1/streak_ladder?select=week_key&limit=1' -H 'apikey: <anon>'`
  doit renvoyer `[]` (et non 404/42703).
- Câblage cron : `npm run streak-ladder:reset -- --dry-run` pour simuler, puis
  sans `--dry-run` chaque lundi après 00:00 (Paris). Le workflow cron n'est pas
  modifié par cette PR (voir « Suivi suggéré » de la PR).
