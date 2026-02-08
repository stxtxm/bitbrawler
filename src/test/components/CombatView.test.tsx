import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';

describe('CombatView Interface', () => {
    const player: Character = {
        name: 'Hero',
        level: 5,
        hp: 100, maxHp: 100,
        strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10,
        experience: 0, wins: 0, losses: 0, fightsLeft: 5, lastFightReset: 0,
        gender: 'male', seed: 'abc'
    };

    const opponent: Character = {
        ...player,
        name: 'Villain',
        seed: 'def'
    };

    it('should render correct match type and names', () => {
        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText('BALANCED MATCH')).toBeInTheDocument();
        expect(screen.getByText('Hero')).toBeInTheDocument();
        expect(screen.getByText('Villain')).toBeInTheDocument();
    });

    it('should transition to combat phase after intro', async () => {
        vi.useFakeTimers();

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="similar"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        // Intro is 2 seconds
        act(() => {
            vi.advanceTimersByTime(2500);
        });

        // Fight logic runs and we should see "Round 1" in logs eventually
        // We know simulateCombat runs immediately after 2s
        // Combat animation takes time (400ms per round)

        // Wait for combat animation to start revealing logs
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // Check if logs container appears
        const logs = document.querySelector('.combat-log');
        expect(logs).toBeInTheDocument();

        vi.useRealTimers();
    });
});
