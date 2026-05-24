# État de la Migration vers Supabase — ✅ Terminée

## ✅ Configuration
- [x] Créé `src/config/supabase.ts` avec la configuration Supabase
- [x] Supprimé `src/config/firebase.ts` (migration terminée)
- [x] Installé `@supabase/supabase-js`
- [x] Créé `.env.example` avec les variables Supabase

## ✅ Code principal
- [x] `src/context/GameContext.tsx` — Toutes les fonctions adaptées pour Supabase
- [x] `src/utils/matchmakingUtils.ts` — Requêtes Supabase
- [x] `src/pages/CharacterCreation.tsx` — Création personnage via Supabase
- [x] `src/pages/Rankings.tsx` — Classements via Supabase

## ✅ Scripts serveur
- [x] `scripts/supabaseAdmin.ts` — Configuration Supabase pour les scripts (service_role)
- [x] `scripts/bot-engine.ts` — Moteur de bots adapté Supabase
- [x] `scripts/daily-reset-engine.ts` — Reset quotidien adapté Supabase
- [x] `scripts/firebaseAdmin.ts` — Supprimé (remplacé par supabaseAdmin.ts)

## ✅ Tests
- [x] Mocks Supabase (`src/test/utils/supabaseMock.ts`)
- [x] Tests combat, GameContext, failover adaptés pour Supabase
- [x] **190 tests passent — 35 fichiers**

## ✅ GitHub Actions
- [x] `bot-activity.yml` — Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] `daily-reset.yml` — Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## ✅ Validation
- [x] Build (`npm run build`) — OK
- [x] Bot engine — 12 bots créés et actifs
- [x] Daily reset forcé — 13 personnages reset, spot check OK
- [x] Tests unitaires et d'intégration — 190/190 OK

## 📋 Notes de production
- Créer la table `maintenance` dans Supabase SQL Editor :
  ```sql
  CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    last_completed_key TEXT,
    last_completed_at BIGINT,
    last_completed_at_utc TEXT,
    target_paris_midnight_utc BIGINT,
    reset_window TEXT,
    scope TEXT,
    updated_characters INTEGER,
    status TEXT
  );
  ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON TABLE maintenance TO anon, authenticated, service_role;
  ```
- Restreindre les politiques RLS pour la production (actuellement ouvert pour le développement).
- Le champ `firestoreId` est conservé dans le code pour minimiser le diff.

## ✅ Cleanup (v1.1.0)
- [x] Supprimé `FirebaseError.tsx`, `CharacterCard.tsx` (composants inutilisés)
- [x] Supprimé les dépendances `firebase` et `firebase-admin` de `package.json`
- [x] Supprimé les documents de migration obsolètes (`MIGRATION_COMPLETE.md`, `MIGRATION_SUPABASE.md`, `SCRIPTS_MIGRATION.md`)
- [x] Renommage `firebaseAvailable` → `dbAvailable` dans tout le code
- [x] Renommage `handleFirebaseError` → `handleDbError`
- [x] Extraction de `convertFromSupabase` partagé dans `src/utils/supabaseUtils.ts`
- [x] Suppression des mocks Firebase obsolètes des tests
- [x] Ajout de tests pour `matchmakingUtils` et `supabaseUtils` (20 nouveaux tests)
