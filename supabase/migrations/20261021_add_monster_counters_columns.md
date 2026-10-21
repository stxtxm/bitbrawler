# Migration : ajouter les compteurs de monstres à `characters`

Cible : **`bhbpvbfvuayafygdrbgb`** (base de référence, cf. `src/config/supabase.ts`).
Issue de suivi : **#1293**.
À exécuter dans **Supabase Dashboard > SQL Editor > New Query** — jamais par un agent.

## Changement
- Table : `characters`
- Colonnes : `monster_kills`, `monster_encounters`
- Type : `JSONB`
- Défaut : `'{}'::jsonb`
- Nullable : oui

## Pourquoi
Le bestiaire (kills / rencontres par monstre) était persisté uniquement en
`localStorage`. Le code de synchronisation envoie désormais ces deux colonnes
(`convertToSupabase`), et les relit au chargement (`convertFromSupabase`) ainsi
que dans la projection de fusion serveur (`SERVER_MERGE_SELECT_COLUMNS`).

Aucune des deux colonnes n'existe sur la base de référence : vérifié via
`GET /rest/v1/characters?select=monster_kills,monster_encounters&limit=0`,
qui répond `42703 column characters.monster_kills does not exist`.

Tant que la migration n'est pas exécutée, les écritures restent sûres : si
PostgREST rejette le payload (`PGRST204` / `42703`), le client retire les deux
champs et rejoue l'update une fois. Seuls les compteurs ne sont pas encore
persistés.

## Commande SQL
```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS monster_kills JSONB DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS monster_encounters JSONB DEFAULT '{}'::jsonb;
```

## Notes
- `IF NOT EXISTS` : ré-exécutable sans erreur.
- Aucun downtime : les lignes existantes reçoivent simplement `{}`.
- Vérification : `SELECT count(*) FROM characters WHERE monster_kills IS NOT NULL;`
- Vérification API (anon, comme le fait l'app) :
  `curl -s '<project>/rest/v1/characters?select=monster_kills,monster_encounters&limit=0' -H 'apikey: <anon>'` → doit renvoyer `[]` et non 42703.
