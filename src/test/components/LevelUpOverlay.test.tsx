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
    lastFightReset: Date.now(),
};

const defaultProps = {
    shouldShowLevelUp: true,
    activeCharacter: mockCharacter,
    lastLevelUp: { levelsGained: 1, newLevel: 5, hpGained: 10 },
    pendingStatPoints: 2,
    isOfflineMode: false,
    statOptions: [
        { key: 'strength' as const, label: 'STR', value: 10, hint: 'Damage', icon: 'strength' as const },
        { key: 'vitality' as const, label: 'VIT', value: 10, hint: 'HP / Defense', icon: 'vitality' as const },
    ],
    hasLevelInfo: true,
    handleAllocateStat: vi.fn(),
    handleCloseLevelUp: vi.fn(),
    handleDeferLevelUp: vi.fn(),
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
        expect(screen.getByText('APPLY')).toBeInTheDocument();
        expect(screen.getByText('LATER')).toBeInTheDocument();
    });

    it('does not render overlay when shouldShowLevelUp is false', () => {
        render(<LevelUpOverlay {...defaultProps} shouldShowLevelUp={false} />);
        expect(screen.queryByText('LEVEL UP')).toBeNull();
    });

    it('calls handleCloseLevelUp when APPLY is clicked', () => {
        const handleClose = vi.fn();
        render(<LevelUpOverlay {...defaultProps} handleCloseLevelUp={handleClose} />);
        act(() => {
            screen.getByText('APPLY').click();
        });
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls handleDeferLevelUp when LATER is clicked', () => {
        const handleDefer = vi.fn();
        render(<LevelUpOverlay {...defaultProps} handleDeferLevelUp={handleDefer} />);
        act(() => {
            screen.getByText('LATER').click();
        });
        expect(handleDefer).toHaveBeenCalledTimes(1);
    });

    describe('autoClose behavior', () => {
        it('calls handleCloseLevelUp after 1500ms when autoClose is true and overlay is visible', () => {
            const handleClose = vi.fn();
            render(
                <LevelUpOverlay
                    {...defaultProps}
                    autoClose={true}
                    handleCloseLevelUp={handleClose}
                />
            );

            // Overlay should be visible initially
            expect(screen.getByText('LEVEL UP')).toBeInTheDocument();
            expect(handleClose).not.toHaveBeenCalled();

            // Advance timers by 1500ms
            act(() => {
                vi.advanceTimersByTime(1500);
            });

            // handleCloseLevelUp should have been called
            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('does not call handleCloseLevelUp before 1500ms when autoClose is true', () => {
            const handleClose = vi.fn();
            render(
                <LevelUpOverlay
                    {...defaultProps}
                    autoClose={true}
                    handleCloseLevelUp={handleClose}
                />
            );

            // Advance only 1000ms (before the timeout)
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(handleClose).not.toHaveBeenCalled();
        });

        it('does not call handleCloseLevelUp when autoClose is false', () => {
            const handleClose = vi.fn();
            render(
                <LevelUpOverlay
                    {...defaultProps}
                    autoClose={false}
                    handleCloseLevelUp={handleClose}
                />
            );

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(handleClose).not.toHaveBeenCalled();
        });

        it('does not call handleCloseLevelUp when autoClose is true but overlay is not visible', () => {
            const handleClose = vi.fn();
            render(
                <LevelUpOverlay
                    {...defaultProps}
                    shouldShowLevelUp={false}
                    autoClose={true}
                    handleCloseLevelUp={handleClose}
                />
            );

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(handleClose).not.toHaveBeenCalled();
        });

        it('cleans up timeout when component unmounts before autoClose fires', () => {
            const handleClose = vi.fn();
            const { unmount } = render(
                <LevelUpOverlay
                    {...defaultProps}
                    autoClose={true}
                    handleCloseLevelUp={handleClose}
                />
            );

            // Unmount before the timeout fires
            unmount();

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            // handleCloseLevelUp should NOT be called since component was unmounted
            expect(handleClose).not.toHaveBeenCalled();
        });
    });
});
