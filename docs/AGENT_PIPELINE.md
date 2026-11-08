# Pipeline Agents OpenCode × GitHub Actions

> Référence du flux autonome : issue → dev agent → PR → CI → reviewer → merge.
> Toute modification des workflows DOIT mettre à jour ce document.

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. DÉCLENCHEMENT                                                  │
│    Issue body contient /oc (ou /Oc, /OC, /oC)                    │
│    → issues:opened/edited → opencode.yml                         │
│    ⚠️ Issue CRÉÉE PAR UN AGENT (GITHUB_TOKEN) = event ignoré     │
│       par GitHub (anti-récursion) → fix manuel : éditer          │
│       l'issue (+espace) OU gh workflow run opencode.yml          │
│       -f issue_number=N                                          │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. DEV AGENT (opencode.yml, deepseek → … → Z.AI)                │
│    • Charge mémoires: dev.json + shared.json                     │
│      ↳ AUTO-COMPACTÉES avant injection (scripts/                 │
│        compact-memories.mjs, budgets shared 6KB / agent 4.5KB)   │
│    • TDD: tests d'abord, code, lint+tsc+tests+build              │
│    • Branche feat/auto-N, commit, PUSH (pas de PR directe)       │
│    • GitHub crée la PR automatiquement                           │
│    • Si commit de tête [skip ci] → re-dispatch ci.yml explicite  │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. CI (ci.yml) — lint, tsc, vitest, build                        │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. REVIEWER (reviewer.yml, même chaîne de modèles)                │
│    • Verify branch integrity: checkout -f (le compactor peut     │
│      avoir dirty le tree mémoire), conflict markers, puis si     │
│      aucun check CI → gate complète locale avant merge           │
│    • PR_DIFF plafonné à 40k chars dans le prompt (ARG_MAX!)      │
│    • Agent review → approve+merge squash, ou request-changes     │
│      (déclenche une correction dev au prochain tour)             │
│    • PRs créées par le bot: SKIP_APPROVAL=true (merge sans       │
│      approval humaine, après CI verte vérifiée à l'instant T)    │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
                    5. Cloudflare Pages deploy
```

## Mémoires d'agents — cycle de vie

| Fichier | Rôle | Budget |
|---|---|---|
| `shared.json` | known_issues one-liners, contraintes transverses | 6 KB |
| `dev.json` / `reviewer.json` / … | notes de session, limitations | 4,5 KB |

- **Auto-compaction** (`scripts/compact-memories.mjs`, alias `npm run mem:compact`)
  exécutée avant chaque injection mémoire dans `opencode.yml` et `reviewer.yml`.
- Règle : les mémoires sont des **pointeurs courts** — les détails vont dans
  AGENTS.md, docs/ et l'historique git. Sinon → `Argument list too long`
  (argv ~128 KB) et **tous les modèles échouent instantanément**.
- Le reviewer force-checkout la branche PR : le compactor dirty le workspace
  mémoire, un checkout simple aborterait sur les PR touchant ces fichiers.

## Modèles

- Chaîne prioritaire (opencode.json + frontmatter `.opencode/agents/*.md` +
  tableaux `MODELS=(...)` des workflows) :
  `opencode/deepseek-v4.1-flash-free` → `opencode/glm-5.3-flash-free` →
  `opencode/nemotron-3.5-lightning-free`.
- Dernier recours : `zai/glm-4.5-flash` (Z.AI, gratuit, tool-calling, pas de
  Google), obtenu via le **broker OIDC Cloudflare** `functions/api/zai-key.ts`
  (`/api/zai-key`). Les workflows demandent un jeton OIDC GitHub
  (`id-token: write`, audience `bitbrawler-zai`) ; la fonction vérifie la
  signature (JWKS GitHub) et le dépôt (`stxtxm/bitbrawler`), puis renvoie la
  clé stockée dans le secret Cloudflare `ZAI_API_KEY`. Aucun secret GitHub.
  Provider déclaré dans `opencode.json` (`@ai-sdk/openai-compatible` vers
  `https://api.z.ai/api/paas/v4`). Si le broker est indisponible, le repli est
  sauté avec un warning.
- **Toute tentative passe par `scripts/run-agent-model.sh`** (jamais
  `timeout … opencode run`). Le watchdog lit le log en continu et coupe dès
  l'erreur fatale au lieu de laisser le CLI retenter ~2 min :
  `0` succès, `42` quota gratuit épuisé, `43` credential refusé, `44` slug
  retiré, `124` budget dépassé. Un test (`run-agent-model.test.ts`) verrouille
  ces codes ; `workflow-integrity.test.ts` interdit l'appel direct.
- Si un modèle disparaît : vérifier `opencode models | grep '^opencode/'`,
  puis `sed` global du slug, push, relancer
  `gh workflow run reviewer.yml -f pr_number=N`.
  ⚠ Symptôme d'un slug retiré : `UnknownError: Unexpected server error` en <5s
  sur TOUS les modèles du tableau de fallback (≠ timeout, ≠ 401/429).
- ⚠ **Quota gratuit par IP et par jour UTC** (incident 2026-11-01 → 04) : les
  slugs `*-free` partagent un même bucket, et les runners GitHub partagent leurs
  IP. Le bucket est donc vide avant la première requête : changer de slug ne
  sert à rien, d'où le watchdog (~3 s par slug) et le repli Z.AI.

## Incidents connus & procédures (2026-08-23)

| Incident | Cause | Fix / procédure |
|---|---|---|
| Tous les modèles échouent en <100 ms | Mémoires verbeuses → ARG_MAX | Auto-compaction (#782) |
| Reviewer exit 1 au checkout PR | Compactor dirty `.opencode/memory/dev.json`, PR touche le même fichier | `checkout -f` + re-compaction post-switch |
| Issue /oc d'un agent jamais déclenchée | Events GITHUB_TOKEN bloqués | Éditer l'issue ou dispatch manuel (sweeper retiré, non souhaité) |
| Review CHANGES_REQUESTED obsolète bloque | Review prise avant fix | `gh api -X PUT .../reviews/RID/dismissals` puis re-dispatch reviewer |
| SQL migration détectée → blocage | Guard volontaire reviewer | Issue dédiée SANS /oc, exécuter dans Supabase SQL Editor |
| idle-processor « Character not found » | Secrets serveur périmés (erreur DB avalée) | Réponse inclut `db_target`+`detail`; tester avec un ID existant |
| PR bot sans run CI | Event GITHUB_TOKEN / skip-ci | `gh workflow run ci.yml -f pr_number=N` ; runs bot = `action_required` → `POST /actions/runs/{id}/approve` |
| Agents muets, 8 min/modèle puis échec | Quota `*-free` épuisé par IP (runners partagés) | watchdog `scripts/run-agent-model.sh` + repli `zai/glm-4.5-flash` via broker OIDC Cloudflare `/api/zai-key` |

## Checklist « une PR est bloquée »

1. `gh pr view N --json statusCheckRollup` — le job `check` est le seul verdict qui compte pour le merge
2. Aucun check CI ? → approuver runs `action_required` (`POST /actions/runs/{id}/approve`) puis `gh workflow run ci.yml -f pr_number=N`
3. CI verte mais CHANGES_REQUESTED ? → dismisser les reviews obsolètes puis re-dispatch reviewer
4. Reviewer échoue en <5 s sur tous les modèles ? → vérifier la taille des mémoires (`npm run mem:compact`)
