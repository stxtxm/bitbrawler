import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompendiumPanel } from '../../components/compendium/CompendiumPanel';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { clearBestiaryRewardClaims } from '../../utils/bestiaryRewardStorage';
import { clearShopPurchases, getFreeRerolls } from '../../utils/shopStorage';
import type { Character } from '../../types/Character';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;
const notify = vi.fn();
const addEssence = vi.fn(async (amount: number) => {
  currentCharacter = { ...currentCharacter, essence: (currentCharacter.essence ?? 0) + amount };
  setupCharacter(currentCharacter);
  return currentCharacter;
});

let currentCharacter: Character;

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'test-char',
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 3,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 0,
  itemUpgrades: {},
  monsterKills: {},
  monsterEncounters: {},
  codex: [],
  ...overrides,
});

const setupCharacter = (character: Character | null) => {
  mockUseGame.mockReturnValue({ activeCharacter: character, addEssence });
};

describe('Bestiary rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBestiaryRewardClaims();
    clearShopPurchases();
    mockUseNotification.mockReturnValue({ notify });
    currentCharacter = makeCharacter({ monsterEncounters: { goblin: 1 }, monsterKills: {} });
    setupCharacter(currentCharacter);
  });

  it('shows a claimable discovery reward for a first encounter', () => {
    render(<CompendiumPanel />);
    expect(screen.getByRole('button', { name: /claim discovery/i })).toBeInTheDocument();
  });

  it('claims discovery reward and grants essence', async () => {
    render(<CompendiumPanel />);
    fireEvent.click(screen.getByRole('button', { name: /claim discovery/i }));
    expect(addEssence).toHaveBeenCalledWith(5);
  });

  it('shows hunter badge milestone at 25 kills', () => {
    currentCharacter = makeCharacter({ monsterKills: { goblin: 25 }, monsterEncounters: { goblin: 25 } });
    setupCharacter(currentCharacter);
    render(<CompendiumPanel />);
    expect(screen.getAllByText(/hunter/i).length).toBeGreaterThan(0);
  });

  it('grants global milestone reroll', async () => {
    const encounters = Object.fromEntries(
      ['goblin', 'ogre', 'wraith', 'slime', 'wolf', 'skeleton', 'chimera', 'dragon_spawn', 'magma_golem', 'lava_hound'].map((id) => [id, 1]),
    );
    currentCharacter = makeCharacter({ monsterEncounters: encounters, monsterKills: encounters });
    setupCharacter(currentCharacter);
    render(<CompendiumPanel />);
    const claimButton = screen.getByRole('button', { name: /claim 10 species/i });
    fireEvent.click(claimButton);
    await screen.findByRole('button', { name: /claim 10 species/i }).catch(() => {});
    expect(addEssence).toHaveBeenCalled();
    expect(getFreeRerolls('test-char')).toBeGreaterThan(0);
  });
});
