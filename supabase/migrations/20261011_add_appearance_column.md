# Migration : ajouter la colonne `appearance` à `characters`

Cible : **`bhbpvbfvuayafygdrbgb`** (base de référence, cf. `src/config/supabase.ts`).
À exécuter dans **Supabase Dashboard > SQL Editor > New Query** — jamais par un agent.

## Changement
- Table : `characters`
- Colonne : `appearance`
- Type : `JSONB`
- Défaut : `'{}'::jsonb`
- Nullable : oui

## Pourquoi
La création de personnage envoie systématiquement l'objet `appearance`
(`headType`, `bodyType`, `build`) construit par le générateur d'avatar.
PostgREST rejette un INSERT dont le payload contient une colonne absente du
schema cache, avec :

```
400 PGRST204 — Could not find the 'appearance' column of 'characters' in the schema cache
```

Ce code tombait dans le branche `else` du catch de `CharacterCreation.tsx`,
qui affiche la modale « connexion requise ». La connexion fonctionnait très
bien, et aucune modale ne s'affichait : la création échouait donc SANS message
visible. `src/pages/CharacterCreation.tsx` comporte désormais un retry sans
cosmétiques (personnage créé, apparence non persistée) — ce n'est pas le
comportement cible.

La colonne est optionnelle côté code, donc l'app reste fonctionnelle sans elle.

## Commande SQL
```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS appearance JSONB DEFAULT '{}'::jsonb;
```

## Notes
- `IF NOT EXISTS` : ré-exécutable sans erreur.
- Aucun downtime : les lignes existantes reçoivent simplement `{}`.
- Après exécution, les personnages créés pendant l'absence de la colonne
  garderont `{}` — l'apparence initiale sera restaurée aux valeurs par défaut
  jusqu'à ce que le joueur la règle à nouveau.
- Vérification : `SELECT count(*) FROM characters WHERE appearance IS NOT NULL;`
- Vérification API (anon, comme le fait l'app) :
  `curl -s '<project>/rest/v1/characters?select=appearance&limit=0' -H 'apikey: <anon>'` → doit renvoyer `[]` et non 42703/400.
