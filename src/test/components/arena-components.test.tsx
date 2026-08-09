import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArenaHeader } from '../../components/arena/ArenaHeader';
import { CharacterDisplay } from '../../components/arena/CharacterDisplay';
import { ExperienceBar } from '../../components/arena/ExperienceBar';
import { InventoryPanel } from '../../components/arena/InventoryPanel';
import { SceneBox } from '../../components/arena/SceneBox';
import { StatsPanel } from '../../components/arena/StatsPanel';
import { ArenaIdleViewModel, ArenaStatOption } from '../../components/arena/arenaTypes';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { Character } from '../../types/Character';
import { PixelItemAsset } from '../../types/Item';
import { ITEM_STAT_META, getItemStatEntries } from '../../hooks/useInventory';

vi.mock('../../components/IdleRunnerScene', () => ({
  IdleRunnerScene: () => <div data-testid="idle-runner-scene">IDLE SCENE</div>,
}));

vi.mock('../../components/procedural/BiomeTerrain', () => ({
  BiomeTerrain: (props: { seed: string; animated?: boolean }) => (
    <div
      data-testid="biome-terrain"
      data-seed={props.seed}
      data-animated={String(props.animated)}
    >
      VOLCANIC BIOME
    </div>
  ),
}));

vi.mock('../../components/procedural/ProceduralTerrain', () => ({
  ProceduralTerrain: (props: { seed: string; animated?: boolean }) => (
    <div
      data-testid="procedural-terrain"
      data-seed={props.seed}
      data-animated={String(props.animated)}
    >
      PLAINS TERRAIN
    </div>
  ),
}));

vi.mock('../../context/GameContext', () => ({
  useGame: () => ({
    activeCharacter: { level: 10 },
    essence: 100,
  }),
}));

const getItem = (id: string): PixelItemAsset => {
  const item = ITEM_ASSETS.find((asset) => asset.id === id);
  if (!item) throw new Error(`Missing test item: ${id}`);
  return item;
};

const character: Character = {
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 3,
  experience: 120,
  strength: 8,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 44,
  maxHp: 56,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: 0,
};

const statOptions: ArenaStatOption[] = [
  { key: 'strength', label: 'STR', value: 8, hint: 'Damage', icon: 'strength' },
  { key: 'vitality', label: 'VIT', value: 7, hint: 'HP / Defense', icon: 'vitality' },
];

const idle: ArenaIdleViewModel = {
  currentMonster: 'goblin',
  scenePhase: 'running',
  lastCombatResult: null,
  lastCombatXp: 18,
  offlineGains: null, // { fights: number; xp: number; levels: number; essence: number; timeAway: number } | null
  clearOfflineGains: vi.fn(),
  currentStreak: 6,
  streakMilestone: null,
  efficiency: 1.2,
  xpPerMinute: 12,
  essencePerMinute: null,
  powerRatio: 1.4,
  remainingSeconds: 125,
  recentLevelUp: null,
  idleFightsCount: 4,
  totalKills: 9,
  efficiencyData: {
    powerRatio: 1.4,
    efficiency: 1.2,
    effectiveInterval: 8,
    xpPerMinute: 12,
    essencePerMinute: 0,
    streakBonus: 0,
    streakMilestone: null,
    nextLevelTime: 125,
    speedEfficiency: 1,
    statEssenceMultiplier: 1,
  },
};

describe('arena extracted components', () => {
  it('ExperienceBar renders progress, xp gain, and max-level badge', () => {
    render(
      <ExperienceBar
        xpText="10 / 100 XP"
        xpPercentage={35}
        xpBarAnimating
        isMaxLevel
        showXpGain
        lastXpGain={25}
      />,
    );

    expect(screen.getByText('10 / 100 XP')).toBeInTheDocument();
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.getByText('★ MAX LEVEL ★')).toBeInTheDocument();
  });

  it('StatsPanel renders combat stats, HP, and PvE efficiency', () => {
    render(
      <StatsPanel
        effectiveCharacter={character}
        pveMode
        statOptions={statOptions}
        idle={idle}
      />,
    );

    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('goblin')).toBeInTheDocument();
    expect(screen.getByText(/~0/)).toBeInTheDocument();
    expect(screen.getByText(/2m 5s/)).toBeInTheDocument();
    expect(screen.getByText('💀 9 slain')).toBeInTheDocument();
  });

  it('SceneBox switches between PvE runner and PvP avatar', () => {
    const { container, rerender } = render(
      <SceneBox character={character} effectiveCharacter={character} pveMode idle={idle} />,
    );

    expect(screen.getByTestId('idle-runner-scene')).toBeInTheDocument();

    rerender(<SceneBox character={character} effectiveCharacter={character} pveMode={false} idle={idle} />);
    expect(container.querySelector('.scene-pvp-center')).toBeTruthy();
  });

  it('SceneBox renders the scrolling volcanic BiomeTerrain once the first boss is slain (PvE)', () => {
    const bossSlayer: Character = {
      ...character,
      bossProgress: {
        bossId: 'void_titan',
        attacksLeft: 4,
        lastAttackReset: 0,
        bossHp: 0,
        bossMaxHp: 7008,
        bossLevel: 31,
        totalKills: 1,
        firstEncounterAt: 1,
      },
    };
    const { container } = render(
      <SceneBox character={bossSlayer} effectiveCharacter={bossSlayer} pveMode idle={idle} />,
    );

    // Volcanic biome → the scrolling BiomeTerrain canvas replaces the plains terrain.
    const biomeTerrain = container.querySelector('[data-testid="biome-terrain"]');
    expect(biomeTerrain).not.toBeNull();
    // BiomeTerrain receives the character seed and animates while PvE is running.
    expect(biomeTerrain?.getAttribute('data-seed')).toBe('hero-seed');
    expect(biomeTerrain?.getAttribute('data-animated')).toBe('true');
    // The static volcanic SceneBackground engine is gone entirely.
    expect(container.querySelector('.scene-bg-root')).toBeNull();
    expect(container.querySelector('.scene-bg-tag')).toBeNull();
  });

  it('SceneBox keeps the scrolling plains terrain before the first boss kill (PvE)', () => {
    const { container } = render(
      <SceneBox character={character} effectiveCharacter={character} pveMode idle={idle} />,
    );

    // Plains biome → the classic scrolling ProceduralTerrain stays in place.
    const plainsTerrain = container.querySelector('[data-testid="procedural-terrain"]');
    expect(plainsTerrain).not.toBeNull();
    expect(plainsTerrain?.getAttribute('data-seed')).toBe('hero-seed');
    expect(plainsTerrain?.getAttribute('data-animated')).toBe('true');
    expect(container.querySelector('.scene-bg-root')).toBeNull();
  });

  it('CharacterDisplay composes scene, XP, and stats sections', () => {
    render(
      <CharacterDisplay
        character={character}
        effectiveCharacter={character}
        pveMode
        xpBarAnimating={false}
        showXpGain
        lastXpGain={42}
        statOptions={statOptions}
        idle={idle}
      />,
    );

    expect(screen.getByTestId('idle-runner-scene')).toBeInTheDocument();
    expect(screen.getByText('EXP')).toBeInTheDocument();
    expect(screen.getByText('+42 XP')).toBeInTheDocument();
    expect(screen.getByText('LAST XP')).toBeInTheDocument();
  });

  it('InventoryPanel renders loadout, item preview, and callbacks', () => {
    const rustySword = getItem('rusty_sword');
    const wornBracers = getItem('worn_bracers');
    const onClose = vi.fn();
    const onEquip = vi.fn();
    const onSelectItem = vi.fn();

    render(
      <InventoryPanel
        inventory={[rustySword.id]}
        inventoryCapacity={20}
        equippedItems={[wornBracers]}
        previewItem={rustySword}
        previewSlotLabel="WEAPON"
        previewStats={getItemStatEntries(rustySword)}
        totalBonusEntries={getItemStatEntries(wornBracers)}
        lootboxResult={null}
        lootboxRolling={false}
        canRollDailyLoot
        inventoryFull={false}
        streak={3}
        itemStatMeta={ITEM_STAT_META}
        isOfflineMode={false}
        onClose={onClose}
        onEquip={onEquip}
        onUnequip={vi.fn()}
        onLootboxRoll={vi.fn()}
        onCloseLootboxResult={vi.fn()}
        onSelectItem={onSelectItem}
        onHoverItem={vi.fn()}
        previewItemId={rustySword.id}
      />,
    );

    expect(screen.getByText('INVENTORY')).toBeInTheDocument();
    expect(screen.getByText('Rusty Sword')).toBeInTheDocument();
    expect(screen.getByText('TOTAL BONUS')).toBeInTheDocument();

    // Tapping an item in the grid only selects it (does not equip)
    fireEvent.click(screen.getByLabelText('View Rusty Sword'));
    expect(onSelectItem).toHaveBeenCalledWith(rustySword.id);
    expect(onEquip).not.toHaveBeenCalled();

    // Equipping is an explicit action from the detail view
    fireEvent.click(screen.getByLabelText('Equip Rusty Sword'));
    expect(onEquip).toHaveBeenCalledWith(rustySword.id, 'weapon');

    fireEvent.click(screen.getByLabelText('Close inventory'));
    expect(onClose).toHaveBeenCalled();
  });

  it('InventoryPanel allows selecting an equipped item from the loadout to view its stats', () => {
    const rustySword = getItem('rusty_sword');
    const onSelectItem = vi.fn();

    render(
<InventoryPanel
        inventory={[]}
        inventoryCapacity={20}
        equippedItems={[rustySword]}
        previewItem={null}
        previewSlotLabel=""
        previewStats={[]}
        totalBonusEntries={[]}
        lootboxResult={null}
        lootboxRolling={false}
        canRollDailyLoot
        inventoryFull={false}
        streak={0}
        itemStatMeta={ITEM_STAT_META}
        isOfflineMode={false}
        onClose={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onLootboxRoll={vi.fn()}
        onCloseLootboxResult={vi.fn()}
        onSelectItem={onSelectItem}
        onHoverItem={vi.fn()}
        previewItemId={null}
      />,
    );

    fireEvent.click(screen.getByLabelText('View equipped Rusty Sword'));
    expect(onSelectItem).toHaveBeenCalledWith(rustySword.id);
  });

  it('InventoryPanel displays lootbox rewards with stats', () => {
    const reward = getItem('flame_dagger');
    render(
      <InventoryPanel
        inventory={[]}
        inventoryCapacity={20}
        equippedItems={[]}
        previewItem={null}
        previewSlotLabel=""
        previewStats={[]}
        totalBonusEntries={[]}
        lootboxResult={reward}
        lootboxRolling={false}
        canRollDailyLoot
        inventoryFull={false}
        streak={0}
        itemStatMeta={ITEM_STAT_META}
        isOfflineMode={false}
        onClose={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onLootboxRoll={vi.fn()}
        onCloseLootboxResult={vi.fn()}
        onSelectItem={vi.fn()}
        onHoverItem={vi.fn()}
        previewItemId={null}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Lootbox reward' });
    expect(within(dialog).getByText('NEW ITEM')).toBeInTheDocument();
    expect(within(dialog).getByText('Flame Dagger')).toBeInTheDocument();
  });

  it('ArenaHeader exposes settings, inventory, logout, and stat point actions', () => {
    const onOpenSettings = vi.fn();
    const onOpenInventory = vi.fn();
    const onLogout = vi.fn();

    render(
      <ArenaHeader
        characterName="Header Hero"
        level={7}
        essence={99}
        onOpenSettings={onOpenSettings}
        onOpenInventory={onOpenInventory}
        onLogout={onLogout}
      />,
    );

    expect(screen.getByText('💎 99.00')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByLabelText('Inventory'));
    fireEvent.click(screen.getByTitle('Logout'));

    expect(onOpenSettings).toHaveBeenCalled();
    expect(onOpenInventory).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  // ─── InventoryPanel Forge Integration ──────────────────────────────────────

  describe('InventoryPanel forge integration', () => {
    it('displays upgrade level on items when itemUpgradeLevels is provided', () => {
      const rustySword = getItem('rusty_sword');
      const wornBracers = getItem('worn_bracers');

      render(
        <InventoryPanel
          inventory={[rustySword.id, wornBracers.id]}
          inventoryCapacity={20}
          equippedItems={[]}
          previewItem={null}
          previewSlotLabel=""
          previewStats={[]}
          totalBonusEntries={[]}
          lootboxResult={null}
          lootboxRolling={false}
          canRollDailyLoot
          inventoryFull={false}
          streak={0}
          itemStatMeta={ITEM_STAT_META}
          isOfflineMode={false}
          onClose={vi.fn()}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onLootboxRoll={vi.fn()}
          onCloseLootboxResult={vi.fn()}
          onSelectItem={vi.fn()}
          onHoverItem={vi.fn()}
          previewItemId={null}
          itemUpgradeLevels={{ rusty_sword: 3 }}
        />,
      );

      // The upgraded item name or card should show upgrade info
      const itemCard = screen.getByLabelText('View Rusty Sword');
      expect(itemCard).toBeInTheDocument();
      // The card should have the upgraded class (VISUALLY)
      expect(itemCard.className).toContain('upgraded');
    });

    it('renders salvage button in detail view when item is selected', () => {
      const rustySword = getItem('rusty_sword');
      const onSalvage = vi.fn();

      render(
        <InventoryPanel
          inventory={[rustySword.id]}
          inventoryCapacity={20}
          equippedItems={[]}
          previewItem={rustySword}
          previewSlotLabel="WEAPON"
          previewStats={getItemStatEntries(rustySword)}
          totalBonusEntries={[]}
          lootboxResult={null}
          lootboxRolling={false}
          canRollDailyLoot
          inventoryFull={false}
          streak={0}
          itemStatMeta={ITEM_STAT_META}
          isOfflineMode={false}
          onClose={vi.fn()}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onLootboxRoll={vi.fn()}
          onCloseLootboxResult={vi.fn()}
          onSelectItem={vi.fn()}
          onHoverItem={vi.fn()}
          previewItemId={rustySword.id}
          onSalvage={onSalvage}
          essence={50}
        />,
      );

      // Should show a salvage button in the detail view
      const salvageBtn = screen.getByRole('button', { name: /salvage/i });
      expect(salvageBtn).toBeInTheDocument();
      fireEvent.click(salvageBtn);
      expect(onSalvage).toHaveBeenCalledWith(rustySword.id);
    });

    it('shows essence yield on item hover in detail view', () => {
      const rustySword = getItem('rusty_sword');

      render(
        <InventoryPanel
          inventory={[rustySword.id]}
          inventoryCapacity={20}
          equippedItems={[]}
          previewItem={rustySword}
          previewSlotLabel="WEAPON"
          previewStats={getItemStatEntries(rustySword)}
          totalBonusEntries={[]}
          lootboxResult={null}
          lootboxRolling={false}
          canRollDailyLoot
          inventoryFull={false}
          streak={0}
          itemStatMeta={ITEM_STAT_META}
          isOfflineMode={false}
          onClose={vi.fn()}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onLootboxRoll={vi.fn()}
          onCloseLootboxResult={vi.fn()}
          onSelectItem={vi.fn()}
          onHoverItem={vi.fn()}
          previewItemId={rustySword.id}
          onSalvage={vi.fn()}
          essence={50}
        />,
      );

      // The salvage yield label should be displayed
      expect(screen.getByText('SALVAGE YIELD')).toBeInTheDocument();
      // The essence total should be shown
      expect(screen.getByText('50.00')).toBeInTheDocument();
    });

    it('renders equip button in detail view and disables it when the item is already equipped', () => {
      const rustySword = getItem('rusty_sword');
      const onEquip = vi.fn();

      render(
        <InventoryPanel
          inventory={[rustySword.id]}
          inventoryCapacity={20}
          equippedItems={[rustySword]}
          previewItem={rustySword}
          previewSlotLabel="WEAPON"
          previewStats={getItemStatEntries(rustySword)}
          totalBonusEntries={[]}
          lootboxResult={null}
          lootboxRolling={false}
          canRollDailyLoot
          inventoryFull={false}
          streak={0}
          itemStatMeta={ITEM_STAT_META}
          isOfflineMode={false}
          onClose={vi.fn()}
          onEquip={onEquip}
          onUnequip={vi.fn()}
          onLootboxRoll={vi.fn()}
          onCloseLootboxResult={vi.fn()}
          onSelectItem={vi.fn()}
          onHoverItem={vi.fn()}
          previewItemId={rustySword.id}
          onSalvage={vi.fn()}
        />,
      );

      const equipBtn = screen.getByLabelText('Equip Rusty Sword');
      expect(equipBtn).toBeInTheDocument();
      expect(equipBtn).toBeDisabled();
      expect(equipBtn).toHaveTextContent('EQUIPPED');
      fireEvent.click(equipBtn);
      expect(onEquip).not.toHaveBeenCalled();

      // Salvage stays available even when a copy is equipped
      const salvageBtn = screen.getByRole('button', { name: /salvage/i });
      expect(salvageBtn).not.toBeDisabled();
    });
  });
});
