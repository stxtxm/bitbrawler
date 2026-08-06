# Boss PvE — VOID TITAN (Raid Boss)

Documentation de référence du système de boss PvE. À lire **avant toute modification** d'équilibrage ou de persistance du boss.

## Gameplay

- Le boss se débloque au **niveau 30** (`GAME_RULES.BOSS.UNLOCK_LEVEL`).
- Un 3e mode est ajouté dans l'Arène (switch PVE / **BOSS** / PVP).
- Le joueur dispose de **5 attaques/jour** contre le boss (jauges indépendantes du PvP et du PvE). La jauge se recharge au reset quotidien Paris (même logique que `dailyReset.shouldResetDaily`).
- Le boss a un **pool de HP persistant** : chaque attaque joue un combat complet. En cas de défaite, le boss **garde le HP restant** du combat — le pool ne se régénère pas entre les attaques ni entre les jours.
- Un **kill** = le pool tombe à 0 pendant un combat. Il relance immédiatement un nouveau cycle (pool plein, niveau recalculé), en conservant les attaques restantes du jour.
- Récompenses **uniquement au kill** : XP `getBossKillXp` + `ESSENCE_REWARD` (60). Une défaite ne rapporte rien.
- Les attaques non-kill **n'incrémentent pas le compteur de défaites** (`losses`), les kills incrémentent `wins`.

## Constantes d'équilibrage (`src/config/gameRules.ts` → `GAME_RULES.BOSS`)

| Constante | Valeur | Effet |
|---|---|---|
| `UNLOCK_LEVEL` | 30 | Niveau requis pour afficher le mode BOSS |
| `MAX_DAILY_ATTACKS` | 5 | Attaques/jour, reset à minuit Paris |
| `LEVEL_BOOST` | 2 | Le boss combat à `playerLevel + 2` |
| `STAT_MULTIPLIER` | 1.2 | Stats du boss = stats brutes du joueur × 1.2 |
| `HP_MULTIPLIER` | 12.0 | Pool HP = `player.maxHp × 12` |
| `XP_MODIFIER` | 4.0 | XP de kill = `XP_WIN × levelScaling × 4` |
| `ESSENCE_REWARD` | 60 | Essence au kill |

## Invariants de design (NE PAS "corriger")

Mesurés par le test Monte-Carlo `src/test/unit/bossBalance.test.ts` (250 campagnes/profil) :

- ⚠️ **Un kill en 1 jour est impossible par construction** : le pool (12× maxHp) ne peut pas être drainé en un seul combat (limite de rounds de `COMBAT_BALANCE.roundLimit`) et le boss scale toujours à 1.2×. Ce n'est pas un bug, c'est le design voulu ("victoire non garantie en 5 coups").
- Médiane de kill : **~4 jours** de campagnes (5 attaques/jour). Objectif : 2-4 jours.
- 100 % des campagnes se terminent par un kill avant 10 jours.
- Un joueur plus fort n'est PAS significativement plus rapide (le boss scale avec lui). La "victoire" finale arrive quand le pool restant est assez bas pour être drainé en un combat.

Si ces chiffres dérivent (par ex. après une modification de `combatBalance.ts`), ajuster `HP_MULTIPLIER`/`STAT_MULTIPLIER` et relancer `npm test -- src/test/unit/bossBalance.test.ts`.

## Persistance (`boss_progress`)

- La migration **#625** a été exécutée : `ALTER TABLE characters ADD COLUMN IF NOT EXISTS boss_progress JSONB;`
- La colonne contient un objet `BossProgress` : `{ bossId, attacksLeft, lastAttackReset, bossHp, bossMaxHp, bossLevel, totalKills, lastKillAt?, firstEncounterAt }`.
- Sync de bout en bout :
  - `config/supabase.ts` → `CharacterRow.boss_progress: BossProgress | null`
  - `utils/supabaseUtils.ts` → `convertFromSupabase` (lecture) et `convertToSupabase` (**champ omis si `undefined`** pour ne jamais écraser la donnée serveur avec null).
  - `context/GameContext.tsx` → `useBossFight` écrit `boss_progress` dans le payload ; la sync debounced (convertToSupabase complet) l'inclut aussi.
- Merge au chargement (`loadCharacter`) : `bestChar.bossProgress ?? localChar.bossProgress ?? undefined` — le fallback localStorage protège le pool HP en cas de serveur vide.
- `normalizeCharacter` (`utils/persistenceUtils.ts`) ajoute `bossProgress: character.bossProgress ?? undefined`.

## Code map

| Fichier | Rôle |
|---|---|
| `src/config/gameRules.ts` | Bloc `BOSS` (constantes ci-dessus) |
| `src/data/bossAssets.ts` | `BossId`, `BOSS_ID` (`void_titan`), sprite 16×16 + palette, `getBossDef` |
| `src/utils/bossUtils.ts` | `BossProgress`, `isBossUnlocked`, `buildBossCharacter`, `createBossProgress`, `ensureBossDailyReset`, `getBossAttacksLeft`, `resolveBossAttack`, `getBossKillXp`, `getBossRewards`, `simulateBossAttack` |
| `src/hooks/useArenaCombat.ts` | `ArenaMode = 'pvp' \| 'pve'`, flux `onFight`/`onCombatComplete` (passe `bossHpLeft`) ; en mode PvE le bouton FIGHT lance directement le boss |
| `src/context/GameContext.tsx` | `useBossFight` (récompenses, cycle, sync Supabase) |
| `src/components/arena/ActionPanel.tsx` | Panneau PvE = statut boss (attaques restantes + barre HP pool) et bouton ATTACK BOSS (plus de toggle BOSS) |
| `src/components/CombatView.tsx` | Intro "A RAID BOSS", rendu boss, écrans de résultat kill/défaite |
| `src/components/PixelMonster.tsx` | Affiche les assets boss (`MonsterId \| BossId`) |
| `src/utils/matchmakingUtils.ts` | `MatchType` inclut `'boss'`, label "RAID BOSS" |
| `src/types/Character.ts` | `bossProgress?: BossProgress` ; `PendingFight.matchType` inclut `'boss'` |

## Tests

- `src/test/unit/bossUtils.test.ts` (26) — logique pure : scaling, reset quotidien, résolution win/loss, récompenses, simulation.
- `src/test/unit/bossBalance.test.ts` (3) — Monte-Carlo : invariants ci-dessus.
- `src/test/integration/arena-boss.test.tsx` (4) — `useBossFight` réel : création du progress, perte (pool persiste, `losses` intact), kill (nouveau cycle, essence, wins), payload Supabase `boss_progress`, refill quotidien.
- `src/test/unit/supabase-utils.test.ts` — round-trip `boss_progress` (omis si `undefined`).

## Pièges connus

- **Round limit** : un combat qui atteint `COMBAT_BALANCE.roundLimit` se termine en draw → `simulateBossAttack` retourne `won=false` avec le HP restant. C'est ce qui rend le kill 1-jour impossible (voir invariants).
- **Mock Supabase dans les tests d'intégration** : `src/test/utils/supabaseMock.ts` (`characterToSupabaseRow`) n'émet PAS `essence` ni `boss_progress`. Au chargement, si la XP locale n'est pas strictement supérieure à la XP serveur, le merge garde le personnage serveur (essence=0). Pour tester les récompenses, donner au personnage local une XP légèrement supérieure (`experience: 5001`) comme dans `arena-boss.test.tsx`.
- **Ne pas sync « null »** : ne jamais écrire `boss_progress: null` quand le personnage n'a pas de progress (via `convertToSupabase` le champ est simplement omis).
- Les imports `type` depuis `bossUtils` dans `config/supabase.ts` sont volontaires (pas de cycle runtime).
