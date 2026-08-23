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
│ 2. DEV AGENT (opencode.yml, modèle x-preview-f-free)             │
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
│ 4. REVIEWER (reviewer.yml, même modèle)                          │
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
                    5. Vercel deploy production
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

- Modèle par défaut : `opencode/x-preview-f-free` (opencode.json + frontmatter
  `.opencode/agents/*.md` + tableaux de fallback dans les workflows).
- Si un modèle disparaît : `sed` global du slug, push, relancer
  `gh workflow run reviewer.yml -f pr_number=N`.

## Incidents connus & procédures (2026-08-23)

| Incident | Cause | Fix / procédure |
|---|---|---|
| Tous les modèles échouent en <100 ms | Mémoires verbeuses → ARG_MAX | Auto-compaction (#782) |
| Reviewer exit 1 au checkout PR | Compactor dirty `.opencode/memory/dev.json`, PR touche le même fichier | `checkout -f` + re-compaction post-switch |
| Issue /oc d'un agent jamais déclenchée | Events GITHUB_TOKEN bloqués | Éditer l'issue ou dispatch manuel (sweeper retiré, non souhaité) |
| Review CHANGES_REQUESTED obsolète bloque | Review prise avant fix | `gh api -X PUT .../reviews/RID/dismissals` puis re-dispatch reviewer |
| SQL migration détectée → blocage | Guard volontaire reviewer | Issue dédiée SANS /oc, exécuter dans Supabase SQL Editor |
| idle-processor « Character not found » | Vars serveur Vercel périmées (erreur DB avalée) | Réponse inclut `db_target`+`detail`; tester avec un ID existant |
| PR bot sans run CI | Event GITHUB_TOKEN / skip-ci | `gh workflow run ci.yml -f pr_number=N` ; runs bot = `action_required` → `POST /actions/runs/{id}/approve` |

## Checklist « une PR est bloquée »

1. `gh pr view N --json statusCheckRollup` — ignorer les checks Vercel (pending à vie sur compte gratuit)
2. Aucun check CI ? → approuver runs `action_required` (`POST /actions/runs/{id}/approve`) puis `gh workflow run ci.yml -f pr_number=N`
3. CI verte mais CHANGES_REQUESTED ? → dismisser les reviews obsolètes puis re-dispatch reviewer
4. Reviewer échoue en <5 s sur tous les modèles ? → vérifier la taille des mémoires (`npm run mem:compact`)
