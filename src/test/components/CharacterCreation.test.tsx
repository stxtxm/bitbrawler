import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CharacterCreation from '../../pages/CharacterCreation';
import { useGame } from '../../context/GameContext';
import { useConnectionGate } from '../../hooks/useConnectionGate';
import { generateInitialStats, generateCharacterName } from '../../utils/characterUtils';
import { prefetchArena } from '../../routes/lazyPages';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../../test/utils/supabaseMock';
import { ROUTER_FUTURE_FLAGS } from '../../test/utils/router';

// ===== Hoisted mocks =====
const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useConnectionGate', () => ({
  useConnectionGate: vi.fn(),
}));

vi.mock('../../utils/characterUtils', () => ({
  generateInitialStats: vi.fn(),
  generateCharacterName: vi.fn().mockReturnValue('GeneratedHero'),
}));

vi.mock('../../routes/lazyPages', () => ({
  prefetchArena: vi.fn(),
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {},
}));

// ===== Test data =====
const mockCharacter: Character = {
  seed: 'test-seed',
  name: 'NEW HERO',
  gender: 'male',
  level: 1,
  experience: 0,
  strength: 8,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 6,
  hp: 42,
  maxHp: 42,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
};

function renderPage() {
  return render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
      <CharacterCreation />
    </MemoryRouter>
  );
}

/**
 * Sets up mockSupabaseFrom to return two different query builders:
 * call 1 = name check (empty results => name available)
 * call 2 = insert (returns new character row)
 */
function setupSuccessfulSubmit(charId = 'char-abc-123') {
  let callIndex = 0;
  mockSupabaseFrom.mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) {
      return createQueryBuilder({ data: [], error: null });
    }
    return createQueryBuilder({
      data: characterToSupabaseRow({ ...mockCharacter, name: 'PLAYER ONE', id: charId }),
      error: null,
    });
  });
}

describe('CharacterCreation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockSupabaseFrom.mockClear();

    vi.mocked(useGame).mockReturnValue({
      setCharacter: vi.fn(),
    } as any);

    vi.mocked(useConnectionGate).mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    });

    vi.mocked(generateInitialStats).mockReturnValue(mockCharacter);

    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });
  });

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------
  describe('Rendering', () => {
    it('renders the header and all main UI elements', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      // Name input
      expect(screen.getByPlaceholderText('PLAYER 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Generate Random Name')).toBeInTheDocument();

      // Gender selection
      expect(screen.getByRole('button', { name: 'MALE' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'FEMALE' })).toBeInTheDocument();

      // Roll & Start buttons
      expect(screen.getByRole('button', { name: 'ROLL STATS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument();

      // Back button
      expect(screen.getByRole('button', { name: 'BACK' })).toBeInTheDocument();
    });

    it('renders all 6 stat labels and HP readout', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      // All stat labels
      expect(screen.getByText('VIT')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('LUK')).toBeInTheDocument();
      expect(screen.getByText('INT')).toBeInTheDocument();
      expect(screen.getByText('FOC')).toBeInTheDocument();
      expect(screen.getByText('HP')).toBeInTheDocument();

      // Stat values (use getAllByText for values that may appear in multiple places)
      expect(screen.getByText('8')).toBeInTheDocument(); // strength
      expect(screen.getByText('7')).toBeInTheDocument(); // vitality
      expect(screen.getByText('5')).toBeInTheDocument(); // luck
      expect(screen.getByText('4')).toBeInTheDocument(); // intelligence
      expect(screen.getByText('42')).toBeInTheDocument(); // hp

      // dexterity=6 and focus=6 — both render as "6"
      const sixValues = screen.getAllByText('6');
      expect(sixValues.length).toBe(2);
    });

    it('renders stat cards with correct title attributes', async () => {
      const { container } = renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const statCards = container.querySelectorAll('.stat-card');
      expect(statCards.length).toBe(6);
      expect(statCards[0]).toHaveAttribute('title', 'Strength');
      expect(statCards[1]).toHaveAttribute('title', 'Vitality');
      expect(statCards[2]).toHaveAttribute('title', 'Dexterity');
      expect(statCards[3]).toHaveAttribute('title', 'Luck');
      expect(statCards[4]).toHaveAttribute('title', 'Intelligence');
      expect(statCards[5]).toHaveAttribute('title', 'Focus');
    });

    it('MALE gender button is selected by default', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const maleBtn = screen.getByRole('button', { name: 'MALE' });
      const femaleBtn = screen.getByRole('button', { name: 'FEMALE' });
      expect(maleBtn.className).toContain('selected');
      expect(femaleBtn.className).not.toContain('selected');
    });

    it('does not show START GAME before character generation', async () => {
      vi.mocked(generateInitialStats).mockReturnValueOnce(null as unknown as Character);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'START GAME' })).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Stat rolling / Reroll
  // ----------------------------------------------------------------
  describe('Stat Rolling', () => {
    it('calls generateInitialStats on mount', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      expect(generateInitialStats).toHaveBeenCalledWith('', 'male');
    });

    it('calls generateInitialStats again when ROLL STATS is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'ROLL STATS' }));

      await waitFor(() => {
        expect(generateInitialStats).toHaveBeenCalledTimes(2);
      });
    });

    it('ROLL STATS button is enabled after generation completes', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const rollBtn = screen.getByRole('button', { name: 'ROLL STATS' });
      expect(rollBtn).not.toBeDisabled();
    });
  });

  // ----------------------------------------------------------------
  // Name Input & Validation
  // ----------------------------------------------------------------
  describe('Name Input & Validation', () => {
    it('updates name value on input change and converts to uppercase', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Conan' } });

      expect(input.value).toBe('CONAN');
    });

    it('clears name error when typing', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      // Submit with empty name to trigger the error
      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });

      // Type to clear error
      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'C' } });

      await waitFor(() => {
        expect(screen.queryByText('NAME REQUIRED')).not.toBeInTheDocument();
      });
    });

    it('has maxLength of 10', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      expect(input).toHaveAttribute('maxLength', '10');
    });

    it('shows error modal when name is empty on submit', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });

      // Error modal should have OK button
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    });

    it('shows error modal when name is only whitespace on submit', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: '   ' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });
    });

    it('dismisses error modal when OK is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      // Trigger error
      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));
      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });

      // Dismiss
      fireEvent.click(screen.getByRole('button', { name: 'OK' }));

      await waitFor(() => {
        expect(screen.queryByText('NAME REQUIRED')).not.toBeInTheDocument();
      });
    });

    it('calls generateCharacterName when random name button is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const randomBtn = screen.getByLabelText('Generate Random Name');
      fireEvent.click(randomBtn);

      expect(generateCharacterName).toHaveBeenCalled();
    });

    it('clears name error when random name is generated', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      // Trigger error
      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));
      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });

      // Click random name button
      fireEvent.click(screen.getByLabelText('Generate Random Name'));

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('NAME REQUIRED')).not.toBeInTheDocument();
      });
    });

    it('sets random name uppercase in the input', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1') as HTMLInputElement;
      fireEvent.click(screen.getByLabelText('Generate Random Name'));

      expect(input.value).toBe('GENERATEDHERO');
    });
  });

  // ----------------------------------------------------------------
  // Gender Change
  // ----------------------------------------------------------------
  describe('Gender Change', () => {
    it('switches to FEMALE when FEMALE button is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      const femaleBtn = screen.getByRole('button', { name: 'FEMALE' });
      fireEvent.click(femaleBtn);

      expect(femaleBtn.className).toContain('selected');
      expect(screen.getByRole('button', { name: 'MALE' }).className).not.toContain('selected');
    });

    it('does not re-roll stats when gender changes', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      vi.mocked(generateInitialStats).mockClear();

      fireEvent.click(screen.getByRole('button', { name: 'FEMALE' }));

      expect(generateInitialStats).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Submission
  // ----------------------------------------------------------------
  describe('Submission', () => {
    it('creates character, calls setCharacter, and navigates to /arena on success', async () => {
      setupSuccessfulSubmit();

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      // Wait for success modal (the async submit resolves)
      await waitFor(() => {
        expect(screen.getByText('SUCCESS!')).toBeInTheDocument();
      });

      // Success modal shows character name
      expect(screen.getByText('PLAYER ONE')).toBeInTheDocument();
      expect(screen.getByText('WARRIOR CREATED')).toBeInTheDocument();
      expect(screen.getByText('PREPARING ARENA...')).toBeInTheDocument();

      // setCharacter should have been called with the new character
      const setCharMock = vi.mocked(useGame).mock.results[0]?.value?.setCharacter as ReturnType<typeof vi.fn>;
      expect(setCharMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'char-abc-123',
          name: 'PLAYER ONE',
        })
      );

      // Verify Supabase was called for name check and insert
      expect(mockSupabaseFrom).toHaveBeenCalledWith('characters');
      expect(mockSupabaseFrom).toHaveBeenCalledTimes(2);

      // Navigation via setTimeout(..., 2000) — waitFor handles real timers
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/arena');
        },
        { timeout: 5000 }
      );
    });

    it('disables START GAME button while submitting', async () => {
      // Make ensureConnection slow so isSubmitting stays true
      const slowEnsure = vi.fn().mockImplementation(
        () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 500))
      );
      vi.mocked(useConnectionGate).mockReturnValue({
        ensureConnection: slowEnsure,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        connectionModal: { open: false, message: '' },
      });
      setupSuccessfulSubmit();

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      const startBtn = screen.getByRole('button', { name: 'START GAME' });
      fireEvent.click(startBtn);

      // Button should be disabled immediately (isSubmitting set synchronously)
      expect(startBtn).toBeDisabled();
    });

    it('shows error modal when name is already taken', async () => {
      mockSupabaseFrom.mockReturnValue(
        createQueryBuilder({ data: [{ id: 'existing-id' }], error: null })
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'TAKEN NAME' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('NAME ALREADY TAKEN!')).toBeInTheDocument();
      });
    });

    it('opens connection modal when Supabase insert fails', async () => {
      const openModal = vi.fn();
      vi.mocked(useConnectionGate).mockReturnValue({
        ensureConnection: vi.fn().mockResolvedValue(true),
        openModal,
        closeModal: vi.fn(),
        connectionModal: { open: false, message: '' },
      });

      let callIndex = 0;
      mockSupabaseFrom.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return createQueryBuilder({ data: [], error: null });
        }
        return createQueryBuilder({ data: null, error: new Error('DB error') });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(openModal).toHaveBeenCalledWith(expect.any(String));
      });
    });

    it('does not submit if ensureConnection returns false', async () => {
      vi.mocked(useConnectionGate).mockReturnValue({
        ensureConnection: vi.fn().mockResolvedValue(false),
        openModal: vi.fn(),
        closeModal: vi.fn(),
        connectionModal: { open: false, message: '' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      // Supabase should not have been called since ensureConnection returned false
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Success Modal
  // ----------------------------------------------------------------
  describe('Success Modal', () => {
    it('renders success modal with correct structure after submission', async () => {
      setupSuccessfulSubmit();

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('SUCCESS!')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog', { name: 'Character created successfully' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  // ----------------------------------------------------------------
  // Error Modal (general)
  // ----------------------------------------------------------------
  describe('Error Modal', () => {
    it('renders error modal with correct structure', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      // Trigger error
      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(screen.getByText('NAME REQUIRED')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog', { name: 'Error' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  // ----------------------------------------------------------------
  // Edge Cases
  // ----------------------------------------------------------------
  describe('Edge Cases', () => {
    it('calls prefetchArena after mount', async () => {
      renderPage();

      // prefetchArena is called via setTimeout(250) or requestIdleCallback
      await waitFor(() => {
        expect(prefetchArena).toHaveBeenCalled();
      });
    });

    it('does not render START GAME when no character generated', async () => {
      vi.mocked(generateInitialStats).mockReturnValue(null as unknown as Character);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('NEW GAME')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'START GAME' })).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Integration with useConnectionGate
  // ----------------------------------------------------------------
  describe('Connection Gate Integration', () => {
    it('passes correct message to ensureConnection', async () => {
      const ensureConnection = vi.fn().mockResolvedValue(true);
      vi.mocked(useConnectionGate).mockReturnValue({
        ensureConnection,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        connectionModal: { open: false, message: '' },
      });

      mockSupabaseFrom.mockReturnValue(
        createQueryBuilder({ data: [], error: null })
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('STR')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('PLAYER 1');
      fireEvent.change(input, { target: { value: 'PLAYER ONE' } });

      fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

      await waitFor(() => {
        expect(ensureConnection).toHaveBeenCalledWith(
          'Connect to create and sync your fighter.'
        );
      });
    });
  });
});
