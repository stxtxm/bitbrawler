# Télémétrie joueur — D1/D7 (#1230, partie 2)

Instrumentation minimale pour mesurer la **rétention réelle** : le bot QA est un
smoke test, pas une audience. Aucun système de jeu n'est ajouté, aucun avantage
achetable, aucun PII.

## Événements

Un POST JSON par événement vers `/api/telemetry` (Cloudflare Pages Function),
payload < 1 Ko. Tous les noms et toutes les clés de props sont sur liste
blanche côté client **et** côté serveur.

| Événement | Props | Rôle |
|---|---|---|
| `session_start` | `first_session`, `return_after_hours` | une fois par chargement de page |
| `session_end` | `duration_s` | `pagehide`, transport `sendBeacon` |
| `level_up` | `from`, `to` | toute hausse de niveau (PvP, boss, idle, merge offline) |
| `lootbox_opened` | `rarity` | lootbox quotidienne |
| `purchase` | `offer`, `price` | achat shop réussi |
| `boss_attempt` | `boss`, `won` | chaque attaque de boss |
| `wall_reached` | `losses` | 3 défaites consécutives au même niveau (une fois par niveau) |

Le champ `level` est ajouté à chaque payload depuis le personnage actif.

## Stockage

Table Supabase `telemetry_events` (Postgres), écrite uniquement par la Function
avec la clé `service_role` :

| Colonne | Type | Notes |
|---|---|---|
| `id` | `bigserial` | PK |
| `created_at` | `timestamptz` | défaut `now()` |
| `install_id` | `uuid` | id anonyme généré sur l'appareil |
| `event` | `text` | liste blanche serveur |
| `level` | `integer` | nullable |
| `props` | `jsonb` | primitives uniquement, ≤ 8 clés |

RLS activée **sans policy** : la clé anon ne peut ni lire ni écrire. Seul le
`service_role` (donc la Function) écrit, et le rapport lit avec la même clé.

> La migration SQL est fournie dans l'issue de migration liée à #1230. Le code
> est déployable avant : tant que la table manque, l'endpoint répond
> `202 { stored:false, reason:"migration_pending" }` et le jeu continue.

## Vie privée / opt-out

- Identifiant = `uuid` aléatoire en `localStorage` (`bitbrawler_telemetry_v1`).
  Pas de nom de personnage, pas d'IP stockée, pas de user-agent, aucun texte libre.
- Le toggle **SETTINGS → ANONYMOUS STATS** (activé par défaut) coupe l'envoi et
  **supprime** l'install id, les timestamps et l'historique de murs : un
  ré-opt-in repart d'un nouvel appareil anonyme, impossible à relier au précédent.
- Rétention des lignes : **90 jours** (purge manuelle, voir plus bas).
- Hors build de production, le module est inerte (pas de bruit depuis `npm run dev`).
- Les navigateurs automatisés (`navigator.webdriver`, donc le bot QA Playwright) ne
  rapportent jamais : le harnais QA ne doit pas gonfler artificiellement D1/D7. Le
  bot ajoute en plus un opt-out explicite dans son contexte Playwright.

## Rapport D1/D7

```bash
npm run telemetry:report              # 90 derniers jours
npm run telemetry:report -- --days=30
npm run telemetry:report -- --json    # sortie machine (tech-lead)
```

Définitions :

- un « jour » est la date **UTC** de `created_at` ;
- seuls les `session_start` comptent pour la rétention (un par chargement) ;
- la cohorte d'un appareil est le jour de son **premier** `session_start` ;
- **Dn** = part de la cohorte qui a ouvert une session exactement `n` jours plus tard ;
- une cohorte n'entre dans le D1/D7 global que lorsque la fenêtre de données
  couvre `jour + n` (cohérent avec le fait que D7 ne peut pas exister avant 7 jours).

Le rapport imprime aussi : installs actifs par jour, distribution des niveaux
maximum par appareil, achats (nombre, installs, prix moyen), niveaux de mur et
taux de victoire boss.

## Purge 90 jours

À exécuter manuellement (ou via une tâche planifiée côté Supabase) :

```sql
DELETE FROM telemetry_events WHERE created_at < NOW() - INTERVAL '90 days';
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/utils/telemetry.ts` | client : opt-out, install id, session, événements |
| `api/telemetry.ts` | handler Web-standard : validation + insert service_role |
| `functions/api/telemetry.ts` | shim Cloudflare Pages |
| `src/utils/telemetryReport.ts` | agrégation D1/D7 (pure, testée) |
| `scripts/telemetry-report.ts` | CLI de rapport |
| `src/test/unit/telemetry*.test.ts` | tests client, API et rapport |
