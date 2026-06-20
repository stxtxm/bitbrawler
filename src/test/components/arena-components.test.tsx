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
  offlineGains: null,
  clearOfflineGains: vi.fn(),
  currentStreak: 6,
  streakMilestone: null,
  efficiency: 1.2,
  xpPerMinute: 12,
  powerRatio: 1.4,
  idleFightsCount: 4,
  totalKills: 9,
  efficiencyData: {
    powerRatio: 1.4,
    efficiency: 1.2,
    effectiveInterval: 8,
    xpPerMinute: 12,
    streakBonus: 0,
    streakMilestone: null,
    nextLevelTime: 125,
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
    expect(screen.getByText('~12')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
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

    fireEvent.click(screen.getByLabelText('Equip Rusty Sword'));
    expect(onEquip).toHaveBeenCalledWith(rustySword.id, 'weapon');
    expect(onSelectItem).toHaveBeenCalledWith(rustySword.id);

    fireEvent.click(screen.getByLabelText('Close inventory'));
    expect(onClose).toHaveBeenCalled();
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
    const onOpenLevelUp = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenInventory = vi.fn();
    const onLogout = vi.fn();

    render(
      <ArenaHeader
        characterName="Header Hero"
        level={7}
        pointsRemaining={2}
        onOpenLevelUp={onOpenLevelUp}
        onOpenSettings={onOpenSettings}
        onOpenInventory={onOpenInventory}
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByTitle('Unspent stat points'));
    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByLabelText('Inventory'));
    fireEvent.click(screen.getByTitle('Logout'));

    expect(onOpenLevelUp).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
    expect(onOpenInventory).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });
});
