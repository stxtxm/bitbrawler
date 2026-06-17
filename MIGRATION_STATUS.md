# Migration Status: Supabase — ✅ Complete

## ✅ Configuration
- [x] Created `src/config/supabase.ts` with Supabase configuration
- [x] Removed `src/config/firebase.ts` (migration complete)
- [x] Installed `@supabase/supabase-js`
- [x] Created `.env.example` with Supabase variables

## ✅ Core code
- [x] `src/context/GameContext.tsx` — All functions adapted for Supabase
- [x] `src/utils/matchmakingUtils.ts` — Supabase queries
- [x] `src/pages/CharacterCreation.tsx` — Character creation via Supabase
- [x] `src/pages/Rankings.tsx` — Rankings via Supabase

## ✅ Server scripts
- [x] `scripts/supabaseAdmin.ts` — Supabase configuration for scripts (service_role)
- [x] `scripts/bot-engine.ts` — Bot engine adapted for Supabase
- [x] `scripts/daily-reset-engine.ts` — Daily reset adapted for Supabase
- [x] `scripts/firebaseAdmin.ts` — Removed (replaced by supabaseAdmin.ts)

## ✅ Tests
- [x] Supabase mocks (`src/test/utils/supabaseMock.ts`)
- [x] Combat, GameContext, failover tests adapted for Supabase
- [x] **459+ tests pass — 54 files**

## ✅ GitHub Actions
- [x] `bot-activity.yml` — Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] `daily-reset.yml` — Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## ✅ Validation
- [x] Build (`npm run build`) — OK
- [x] Bot engine — 12 bots created and active
- [x] Forced daily reset — 13 characters reset, spot check OK
- [x] Unit and integration tests — 459/459 OK

## 📋 Production notes
- Create the `maintenance` table in Supabase SQL Editor:
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
- Restrict RLS policies for production (currently open for development).
- The `firestoreId` field is retained in code to minimize diff.

## ✅ Cleanup (v1.1.0)
- [x] Removed `FirebaseError.tsx`, `CharacterCard.tsx` (unused components)
- [x] Removed `firebase` and `firebase-admin` dependencies from `package.json`
- [x] Removed obsolete migration docs (`MIGRATION_COMPLETE.md`, `MIGRATION_SUPABASE.md`, `SCRIPTS_MIGRATION.md`)
- [x] Renamed `firebaseAvailable` → `dbAvailable` throughout codebase
- [x] Renamed `handleFirebaseError` → `handleDbError`
- [x] Extracted shared `convertFromSupabase` in `src/utils/supabaseUtils.ts`
- [x] Removed obsolete Firebase mocks from tests
- [x] Added matchmakingUtils and supabaseUtils tests (20 new tests)
