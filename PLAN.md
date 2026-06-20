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

### Phase 3 - Refactoring (EN COURS)
- `src/components/arena/ActionPanel.tsx` ✓ (extrait)
- `src/components/arena/SettingsPanel.tsx` ✓ (extrait)
- **Reste à faire:** InventoryPanel, CharacterDisplay, sous-composants

---

## Ce Qu'il Faut Terminer

### Phase 3 - Refactoring (PRIORITÉ HAUTE)

Arena.tsx fait **1066 lignes**. Objectif: **~200 lignes**.

#### Fichiers à créer:

**1. `src/components/arena/InventoryPanel.tsx` (~200 lignes)**
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

**2. `src/components/arena/CharacterDisplay.tsx` (~120 lignes)**
Extraire les lignes 526-637 (scene box + XP section + stats panel).
Props: effectiveCharacter, pveMode, xpProgress, xpBarAnimating, isMaxLevel, showXpGain, lastXpGain, statOptions, idle data, handlers.

**3. `src/components/arena/SceneBox.tsx` (~30 lignes)**
Extraire les lignes 528-549 (PvE idle runner vs PvP avatar).

**4. `src/components/arena/StatsPanel.tsx` (~70 lignes)**
Extraire les lignes 572-637 (stat grid + HP bar + efficiency + PvE stats).

**5. `src/components/arena/ExperienceBar.tsx` (~20 lignes)**
Extraire les lignes 552-569 (XP bar + gain popup + max level badge).

#### Hooks à créer:

**6. `src/hooks/useInventory.ts`**
État: inventoryOpen, inventoryHoveredId, inventorySelectedId, lootboxRolling, lootboxResult.
Fonctions: handleLootboxRoll, handleSelectItem, handleEquipItem, handleUnequipItem.
Dérivés: inventory, inventoryCapacity, inventoryFull, canRollDailyLoot, equippedItems, previewItem, previewStats, totalBonusEntries.

**7. `src/hooks/useSettings.ts`**
État: settingsOpen, settingsView, autoModeUpdating, deleteStep, deletePending.
Fonctions: handleToggleAutoMode, handleDeleteCharacter, handleOpenHistoryFromSettings, handleReturnToSettings.
Dérivés: autoModeEnabled, combinedHistory.

#### Modifications Arena.tsx:
- Importer les nouveaux composants et hooks
- Remplacer le JSX inline par `<InventoryPanel {...inventoryProps} />` etc.
- Réduire de 1066 lignes à ~200 lignes

### Phase 4 - Performance (PRIORITÉ MOYENNE)

**8. React.memo sur les sous-composants**
Wrap tous les composants arena/ avec `React.memo` pour éviter les re-rendus inutiles.

**9. Optimisation particle system**
`src/utils/particleSystem.ts`: Vérifier que le pool d'objets fonctionne bien, réduire les allocations.

**10. Optimisation IdleRunnerScene**
`src/components/IdleRunnerScene.tsx`: Vérifier les deps des useEffect, éviter les re-rendus quand scenePhase ne change pas.

### Phase 7 - Documentation (PRIORITÉ BASSE)

**11. Mettre à jour README.md**
- Architecture overview
- Tech stack
- Setup instructions
- Agent workflow (dev-agent, reviewer, tech-lead, qa-tester)

**12. Mettre à jour AGENTS.md**
- Référencer les nouveaux fichiers créés
- Documenter le workflow de refactoring

**13. Créer ARCHITECTURE.md**
- Structure des dossiers
- Data flow (GameContext → hooks → components)
- Système de combat (PvP + PvE idle)
- Système d'équipement/loot
- Déploiement Vercel

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
| `src/pages/Arena.tsx` | 1066 | Page principale - CIBLE PRINCIPALE du refactoring |
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
- Les fichiers `src/hooks/useInventory.ts` et `src/hooks/useSettings.ts` n'existent PAS ENCORE - il faut les créer
