# Migration: Essence column from INTEGER to DOUBLE PRECISION

## Changement
- Table: `characters`
- Colonne: `essence`
- Type actuel: `INTEGER` (or `INT4`)
- Nouveau type: `DOUBLE PRECISION`
- Nullable: oui (reste inchangé)
- Défaut: `0` (reste inchangé)

## Commande SQL
```sql
ALTER TABLE characters ALTER COLUMN essence TYPE DOUBLE PRECISION USING essence::double precision;
```

## Notes
- Le code est déjà déployé et fonctionnel sans la migration (perte des décimales à l'écriture DB, mais fonctionnement correct en mémoire/session)
- Exécuter dans Supabase Dashboard > SQL Editor > New Query
- Aucun downtime nécessaire
