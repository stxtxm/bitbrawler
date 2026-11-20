# Migration : ajouter la colonne `last_daily_essence_claim` à `characters`

Cible : **`bhbpvbfvuayafygdrbgb`** (base de référence, cf. `src/config/supabase.ts`).
À exécuter dans **Supabase Dashboard > SQL Editor > New Query** — jamais par un agent.

## Changement
- Table : `characters`
- Colonne : `last_daily_essence_claim`
- Type : `TEXT`
- Défaut : `NULL`
- Nullable : oui

## Pourquoi
La prime quotidienne d'essence était mémorisée uniquement dans `localStorage`
(`bitbrawler_daily_essence_<id>`). Purger le stockage local suffisait donc à
réclamer la prime en boucle. La journée de réclamation (clé `Europe/Paris`)
devient autoritative en base :

- le processeur idle (`api/idle-processor.ts`) vérifie la colonne et crédite
  l'essence en mode on-demand **et** dans le chemin hors-ligne (cron) ;
- le client (`GameContext`, `dailyEssenceUtils`) considère la valeur serveur
  comme la source de vérité et reprend `localStorage` uniquement tant que la
  colonne n'existe pas.

Tant que la migration n'est pas exécutée, le code reste fonctionnel : la
sélection inclut la colonne, détecte l'erreur PostgREST `42703` / `PGRST204`,
puis rejoue sans elle. La prime reste alors locale (comportement historique).

## Commande SQL
```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_daily_essence_claim TEXT;
```

## Notes
- `IF NOT EXISTS` : ré-exécutable sans erreur.
- Aucun downtime : les lignes existantes reçoivent `NULL`, ce qui autorise une
  première réclamation serveur au prochain traitement idle.
- Vérification : `SELECT count(*) FROM characters WHERE last_daily_essence_claim IS NOT NULL;`
- Vérification API (anon, comme le fait l'app) :
  `curl -s '<project>/rest/v1/characters?select=last_daily_essence_claim&limit=0' -H 'apikey: <anon>'` → doit renvoyer `[]` et non 42703/400.
