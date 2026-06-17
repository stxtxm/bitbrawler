import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LevelUpOverlay from '../../components/LevelUpOverlay';
import { Character } from '../../types/Character';

const mockCharacter: Character = {
    seed: 'test-seed',
    name: 'Test Hero',
    gender: 'male',
    level: 5,
    experience: 200,
    strength: 10,
    vitality: 10,
    dexterity: 10,
    luck: 10,
    intelligence: 10,
    focus: 10,
    hp: 55,
    maxHp: 55,
    wins: 3,
    losses: 1,
    fightsLeft: 4,
    statPoints: 2,
    lastFightReset: Date.now(),
};

const defaultProps = {
    shouldShowLevelUp: true,
    activeCharacter: mockCharacter,
    lastLevelUp: { levelsGained: 1, newLevel: 5, hpGained: 10 },
    isOfflineMode: false,
    statOptions: [
        { key: 'strength' as const, label: 'STR', value: 10, hint: 'Damage', icon: 'strength' as const },
        { key: 'vitality' as const, label: 'VIT', value: 10, hint: 'HP / Defense', icon: 'vitality' as const },
    ],
    saving: false,
    onAllocateStat: vi.fn(),
    onClose: vi.fn(),
};

describe('LevelUpOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('renders overlay when shouldShowLevelUp is true', () => {
        render(<LevelUpOverlay {...defaultProps} />);
        expect(screen.getByText('LEVEL UP')).toBeInTheDocument();
        expect(screen.getByText('CLOSE')).toBeInTheDocument();
        expect(screen.getByText('POINTS TO SPEND')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('does not render overlay when shouldShowLevelUp is false', () => {
        render(<LevelUpOverlay {...defaultProps} shouldShowLevelUp={false} />);
        expect(screen.queryByText('LEVEL UP')).toBeNull();
    });

    it('calls onClose when CLOSE is clicked', () => {
        const handleClose = vi.fn();
        render(<LevelUpOverlay {...defaultProps} onClose={handleClose} />);
        act(() => {
            screen.getByText('CLOSE').click();
        });
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onAllocateStat when + is clicked', () => {
        const handleAlloc = vi.fn();
        render(<LevelUpOverlay {...defaultProps} onAllocateStat={handleAlloc} />);
        act(() => {
            screen.getAllByText('+')[0].click();
        });
        expect(handleAlloc).toHaveBeenCalledWith('strength');
    });

    it('disables + buttons when saving is true', () => {
        render(<LevelUpOverlay {...defaultProps} saving={true} />);
        const plusButtons = screen.getAllByText('+');
        plusButtons.forEach((btn) => {
            expect(btn).toBeDisabled();
        });
    });

    it('does not call onAllocateStat when button is disabled (saving guard)', () => {
        const handleAlloc = vi.fn();
        render(<LevelUpOverlay {...defaultProps} onAllocateStat={handleAlloc} saving={true} />);
        const plusButtons = screen.getAllByText('+');
        act(() => {
            plusButtons[0].click();
        });
        expect(handleAlloc).not.toHaveBeenCalled();
    });

    it('disables + buttons when isOfflineMode is true', () => {
        render(<LevelUpOverlay {...defaultProps} isOfflineMode={true} />);
        const plusButtons = screen.getAllByText('+');
        plusButtons.forEach((btn) => {
            expect(btn).toBeDisabled();
        });
    });

    it('shows offline warning when isOfflineMode is true', () => {
        render(<LevelUpOverlay {...defaultProps} isOfflineMode={true} />);
        expect(screen.getByText('CONNECT TO ASSIGN POINTS')).toBeInTheDocument();
    });

    it('shows ALL POINTS ALLOCATED when no points remaining', () => {
        const charNoPoints = { ...mockCharacter, statPoints: 0 };
        render(<LevelUpOverlay {...defaultProps} activeCharacter={charNoPoints} />);
        expect(screen.getByText('ALL POINTS ALLOCATED')).toBeInTheDocument();
    });

    it('does not show + buttons when no points remaining', () => {
        const charNoPoints = { ...mockCharacter, statPoints: 0 };
        render(<LevelUpOverlay {...defaultProps} activeCharacter={charNoPoints} />);
        expect(screen.queryAllByText('+')).toHaveLength(0);
    });

    it('shows + buttons again after re-render with new statPoints (simulates partial allocation)', () => {
        // First render with 1 point, then re-render with 0 points after allocation
        const { rerender } = render(<LevelUpOverlay {...defaultProps} />);
        expect(screen.getAllByText('+')).toHaveLength(2);

        const charOnePoint = { ...mockCharacter, statPoints: 1 };
        rerender(<LevelUpOverlay {...defaultProps} activeCharacter={charOnePoint} />);
        expect(screen.getAllByText('+')).toHaveLength(2);

        const charZeroPoints = { ...mockCharacter, statPoints: 0 };
        rerender(<LevelUpOverlay {...defaultProps} activeCharacter={charZeroPoints} />);
        expect(screen.queryAllByText('+')).toHaveLength(0);
        expect(screen.getByText('ALL POINTS ALLOCATED')).toBeInTheDocument();
    });

    it('auto-closes after 800ms when statPoints reaches 0', () => {
        const handleClose = vi.fn();
        const { rerender } = render(
            <LevelUpOverlay {...defaultProps} onClose={handleClose} statOptions={defaultProps.statOptions} />
        );

        expect(handleClose).not.toHaveBeenCalled();

        const charZeroPoints = { ...mockCharacter, statPoints: 0 };
        rerender(
            <LevelUpOverlay
                {...defaultProps}
                activeCharacter={charZeroPoints}
                onClose={handleClose}
                statOptions={defaultProps.statOptions}
            />
        );

        act(() => {
            vi.advanceTimersByTime(800);
        });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not auto-close when statPoints > 0', () => {
        const handleClose = vi.fn();
        render(<LevelUpOverlay {...defaultProps} onClose={handleClose} />);

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not auto-close when overlay is hidden', () => {
        const handleClose = vi.fn();
        render(
            <LevelUpOverlay
                {...defaultProps}
                shouldShowLevelUp={false}
                onClose={handleClose}
            />
        );

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(handleClose).not.toHaveBeenCalled();
    });

    it('cleans up auto-close timeout on unmount', () => {
        const handleClose = vi.fn();
        const charZeroPoints = { ...mockCharacter, statPoints: 0 };
        const { unmount } = render(
            <LevelUpOverlay
                {...defaultProps}
                activeCharacter={charZeroPoints}
                onClose={handleClose}
            />
        );

        unmount();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(handleClose).not.toHaveBeenCalled();
    });
});
