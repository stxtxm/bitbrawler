# Bitbrawler - Plan Complet Restant (Phases 3-7)

## Contexte du Projet

Bitbrawler est un jeu RPG pixel-art web (React + TypeScript + Vite) déployé sur Vercel.
Backend: Supabase. Style: rétro/pixel avec SCSS.

**Commits récents:**
```
3de7fc1 feat(terrain): rewrite procedural terrain + begin arena refactoring
200b9f3 feat(phases 1-6): notifications, idle overlay, mobile UX, graphics
eb0bfca phase-0: Complete terrain system overhaul
```

**État actuel du build:** ✓ passe (tsc + vite build)

---

## Ce Qui Est Déjà Fait

### Phase 0 - Terrain ✅
- Système de terrain procédural avec parallax 4 couches
- `src/generation/Noise.ts`: Cache permutation tables + fBm 3 octaves
- `src/generation/BiomeGenerator.ts`: 5 biomes avec blending large (40px)
- `src/components/procedural/ProceduralTerrain.tsx`: Formes organiques (quadratic curves, roundRect, arcs), alpha blending
- `src/config/terrainConfig.ts`: Config centralisée, quality scaling par viewport
- `src/hooks/useTerrainNoise.ts`: Cache LRU des noise maps
- `src/hooks/useTerrainAnimation.ts`: RAF avec FPS control + ResizeObserver

### Phase 1 - Notifications ✅
- `src/context/NotificationContext.tsx`: Queue, auto-dismiss, vibration API, max 3
- `src/hooks/useNotification.ts`: Hook consumer
- `src/components/NotificationDisplay.tsx`: Composant d'affichage
- `src/styles/components/_notifications.scss`: Animations slide-in
- `src/test/unit/notifications.test.tsx`: 9 tests ✓

### Phase 2 - Idle ✅
- Overlay d'efficacité dans IdleRunnerScene (XP/min, EFF, PWR)
- Props efficiency/xpPerMinute/powerRatio ajoutées

### Phase 3 - Refactoring ✅
- `src/pages/Arena.tsx` réduit de 1066 à **244 lignes** (78% de réduction)
- `src/components/arena/ActionPanel.tsx` ✓ (extrait)
- `src/components/arena/SettingsPanel.tsx` ✓ (extrait)
- `src/components/arena/InventoryPanel.tsx` ✓ (extrait, inclut le Shop tab)
- `src/components/arena/CharacterDisplay.tsx` ✓ (extrait: scene + XP bar + stats)
- `src/components/arena/SceneBox.tsx` ✓ (extrait: PvE idle runner vs PvP avatar)
- `src/components/arena/StatsPanel.tsx` ✓ (extrait: stat grid + HP + efficiency)
- `src/components/arena/ExperienceBar.tsx` ✓ (extrait: XP bar + gain popup + max level)
- `src/components/arena/ArenaHeader.tsx` ✓ (extrait: nom, level, nav buttons)
- `src/hooks/useInventory.ts` ✓ (créé: état inventory/lootbox/équipement)
- `src/hooks/useSettings.ts` ✓ (créé: modal settings + auto-mode + delete)
- `src/components/arena/arenaTypes.ts` ✓ (types partagés)
- Test: `src/test/components/arena-components.test.tsx` ✓ (15 tests)

---

## Ce Qu'il Faut Terminer

### Phase 3 - Refactoring ✅ COMPLÈTE
Arena.tsx fait **1066 lignes**. Objectif: **~200 lignes**.
**Résultat:** `src/pages/Arena.tsx` = **244 lignes** ✓
#### Fichiers à créer:
**1. ✅ `src/components/arena/InventoryPanel.tsx`** (créé, 420 lignes — inclut Shop tab + salvage + upgrade badges)
Extraire les lignes 709-913 de Arena.tsx (modal inventory).
Props nécessaires:
```ts
interface InventoryPanelProps {
  inventory: string[];
  inventoryCapacity: number;
  equippedItems: PixelItemAsset[];
  previewItem: PixelItemAsset | null;
  previewSlotLabel: string;
  previewStats: [StatKey, number][];
  totalBonusEntries: { key: StatKey; value: number }[];
  lootboxResult: PixelItemAsset | null;
  lootboxRolling: boolean;
  canRollDailyLoot: boolean;
  inventoryFull: boolean;
  streak: number;
  itemStatMeta: Record<string, { icon: string; label: string }>;
  isOfflineMode: boolean;
  onClose: () => void;
  onEquip: (itemId: string, slot: ItemSlot) => void;
  onUnequip: (slot: ItemSlot) => void;
  onLootboxRoll: () => void;
  onCloseLootboxResult: () => void;
  onSelectItem: (itemId: string) => void;
  onHoverItem: (id: string | null) => void;
  previewItemId: string | null;
}
```

**2. ✅ `src/components/arena/CharacterDisplay.tsx`** (créé, 58 lignes)
Extraire les lignes 526-637 (scene box + XP section + stats panel).
Props: effectiveCharacter, pveMode, xpProgress, xpBarAnimating, isMaxLevel, showXpGain, lastXpGain, statOptions, idle data, handlers.

**3. ✅ `src/components/arena/SceneBox.tsx`** (créé, 65 lignes)
Extraire les lignes 528-549 (PvE idle runner vs PvP avatar).

**4. ✅ `src/components/arena/StatsPanel.tsx`** (créé, 130 lignes)
Extraire les lignes 572-637 (stat grid + HP bar + efficiency + PvE stats).

**5. ✅ `src/components/arena/ExperienceBar.tsx`** (créé, 40 lignes)
Extraire les lignes 552-569 (XP bar + gain popup + max level badge).

#### Hooks à créer:

**6. ✅ `src/hooks/useInventory.ts`** (créé, 247 lignes)
État: inventoryOpen, inventoryHoveredId, inventorySelectedId, lootboxRolling, lootboxResult.
Fonctions: handleLootboxRoll, handleSelectItem, handleEquipItem, handleUnequipItem.
Dérivés: inventory, inventoryCapacity, inventoryFull, canRollDailyLoot, equippedItems, previewItem, previewStats, totalBonusEntries.

**7. ✅ `src/hooks/useSettings.ts`** (créé, 164 lignes)
État: settingsOpen, settingsView, autoModeUpdating, deleteStep, deletePending.
Fonctions: handleToggleAutoMode, handleDeleteCharacter, handleOpenHistoryFromSettings, handleReturnToSettings.
Dérivés: autoModeEnabled, combinedHistory.

#### Modifications Arena.tsx: ✅ FAIT
- Importer les nouveaux composants et hooks ✓
- Remplacer le JSX inline par `<InventoryPanel {...inventoryProps} />` etc. ✓
- Réduire de 1066 lignes à ~200 lignes ✓ (244 lignes, commit `2dbb4dc`)

### Phase 4 - Performance (PRIORITÉ MOYENNE) ✅ COMPLÈTE

**8. ✅ React.memo sur les sous-composants**
Wrap tous les composants arena/ avec `React.memo` pour éviter les re-rendus inutiles.
**Résultat:** Vérifié — les 8 composants (`ActionPanel`, `ArenaHeader`, `CharacterDisplay`, `ExperienceBar`, `InventoryPanel`, `SceneBox`, `SettingsPanel`, `StatsPanel`) sont DÉJÀ enveloppés dans `React.memo`. Aucune modification nécessaire.

**9. ✅ Optimisation particle system**
`src/utils/particleSystem.ts`: Vérifier que le pool d'objets fonctionne bien, réduire les allocations.
**Résultat:** Pool d'objets implémenté — les objets `ParticleDef` morts (et leurs éléments DOM détachés) sont recyclés via une `freeList` bornée par `maxParticles`, au lieu d'être alloués/détruits à chaque émission. Suppression de l'allocation de copie (`{ ...partial, el }`) au profit d'un `Object.assign` sur l'objet poolé. Les éléments `<span>` sont réutilisés (reset `className`/`cssText`/`textContent`) → plus de `createElement` par particule. `clear()`/`tick()` renvoient les particules mortes au pool. Tests ✓ (13).

**10. ✅ Optimisation IdleRunnerScene**
`src/components/IdleRunnerScene.tsx`: Vérifier les deps des useEffect, éviter les re-rendus quand scenePhase ne change pas.
**Résultat:** Les 2 effets de transition (`isAttacking`/`isVictory` et émission de particules) mettent maintenant à jour leur ref de phase AVANT de tester la transition, avec guards `prevPhase`. Un changement de `lastCombatResult` pendant que `scenePhase` reste `'combat'`/`'result'` ne re-déclenche plus l'animation one-shot ni la ré-émission des particules (pas de re-rendu / re-timer inutile). Tests ✓ (12).

### Phase 7 - Documentation ✅ COMPLÈTE

**11. ✅ Mettre à jour README.md**
- Architecture overview (diagram + data flow)
- Tech stack (1482 tests, 99 files)
- Setup instructions
- Agent workflow (dev-agent, reviewer, tech-lead, qa-tester + orchestrator/supervisor)
- Project structure mis à jour (arena/, forge/, procedural/, hooks, data)

**12. ✅ Mettre à jour AGENTS.md**
- Référence les nouveaux fichiers créés (composants arena/, hooks useInventory/useSettings/useArenaCombat, particleSystem)
- Documente le workflow de refactoring (Arena.tsx 1066 → 244 lignes, pattern hooks + props-only components)

**13. ✅ Vérifier et compléter ARCHITECTURE.md** (le fichier existait déjà)
- Structure des dossiers (components/arena, forge, procedural, hooks, data, test)
- Data flow (GameContext → hooks → components)
- Système de combat (PvP + PvE idle + Boss VOID TITAN)
- Système d'équipement/loot (inventory, forge, essence, shop, medals, achievements)
- Déploiement Vercel (vercel.json, rewrites, env vars, pipeline)

---

## Conventions du Projet

- **Tests:** Vitest + React Testing Library. Fichiers dans `src/test/unit/`. Pattern: `*.test.ts(x)`
- **Styles:** SCSS avec `@use '../variables' as *` dans chaque fichier composant. BEM-like: `.component-name__element--modifier`
- **Composants:** React.FC avec interface Props. Fonctionnels, pas de classes.
- **Types:** TypeScript strict. Pas de `any`. Interfaces pour les props.
- **Build:** `npm run build` (tsc + vite build). doit passer avant chaque commit.
- **Lint:** `npx eslint src/path/to/file.ts` doit passer.
- **Commits:** Message descriptif en anglais. Un commit = une feature/fix.

## Fichiers Clés à Connaître

| Fichier | Lignes | Description |
|---------|--------|-------------|
| `src/pages/Arena.tsx` | 244 | Page principale - refactoring terminé (était 1066, commit `2dbb4dc`) |
| `src/components/arena/*.tsx` | - | Sous-composants extraits (ActionPanel, SettingsPanel, InventoryPanel, CharacterDisplay, SceneBox, StatsPanel, ExperienceBar, ArenaHeader) |
| `src/hooks/useInventory.ts` | 247 | État inventory/lootbox/équipement |
| `src/hooks/useSettings.ts` | 164 | État settings modal + auto-mode + delete |
| `src/context/GameContext.tsx` | ~900 | "God context" - tous les états du jeu |
| `src/hooks/useIdleCombat.ts` | 414 | Moteur combat idle PvE |
| `src/components/IdleRunnerScene.tsx` | 250+ | Scène visuelle idle mode |
| `src/utils/equipmentUtils.ts` | - | Équipement, loot, inventory |
| `src/utils/combatBalance.ts` | - | Calculs de combat |
| `src/config/gameRules.ts` | - | Constantes du jeu |
| `src/data/itemAssets.ts` | - | Items, stats, rarity |
| `src/styles/pages/_arena.scss` | - | Styles de la page arena |
| `src/styles/components/_idle-runner.scss` | 530+ | Styles idle runner |

## Commandes Utiles

```bash
npm run build          # Build complet (tsc + vite)
npx vitest run src/test/unit/notifications.test.tsx  # Tests individuels
npx eslint src/pages/Arena.tsx  # Lint
npm test               # Tous les tests (peut timeout)
```

## IMPORTANT

- Le build DOIT passer avant de committer
- Ne pas casser l'existant: les tests existants doivent continuer à passer
- Garder le style pixel-art/retro du jeu
- TOUT nouveau composant doit avoir un test unitaire
- Les imports doivent être vérifiés (pas de circular deps)
- `src/components/arena/ActionPanel.tsx` et `SettingsPanel.tsx` sont DÉJÀ extraits et fonctionnels
- Tous les sous-composants `arena/*` et les hooks `useInventory.ts` / `useSettings.ts` sont créés et fonctionnels (Phase 3 ✅)
