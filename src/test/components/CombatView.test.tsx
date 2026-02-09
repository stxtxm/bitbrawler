import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';
import * as combatUtils from '../../utils/combatUtils';
import * as combatLogUtils from '../../utils/combatLogUtils';

describe('CombatView Interface', () => {
    const player: Character = {
        name: 'Hero',
        level: 5,
        hp: 100, maxHp: 100,
        strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
        experience: 0, wins: 0, losses: 0, fightsLeft: 5, lastFightReset: 0,
        gender: 'male', seed: 'abc'
    };

    const opponent: Character = {
        ...player,
        name: 'Villain',
        seed: 'def'
    };

    it('should render correct match type and opponent name only', () => {
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
        expect(screen.getAllByText('Villain').length).toBeGreaterThan(0);
        expect(screen.queryByText('Hero')).toBeNull();
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

    it('should apply action and reaction classes during combat', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero lands a critical hit!'],
            timeline: [{ attackerHp: 100, defenderHp: 80 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'crit'
        });

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => {
            vi.advanceTimersByTime(2500);
        });

        act(() => {
            vi.advanceTimersByTime(600);
        });

        const combatAction = container.querySelector('.combat-action.action-crit');
        expect(combatAction).not.toBeNull();

        const playerSide = container.querySelector('.fighter-side.left.action-crit');
        const opponentSide = container.querySelector('.fighter-side.right.react-crit');

        expect(playerSide).not.toBeNull();
        expect(opponentSide).not.toBeNull();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should skip reaction class on miss actions', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain missed the attack!'],
            timeline: [{ attackerHp: 100, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
            type: 'miss'
        });

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => {
            vi.advanceTimersByTime(2500);
        });

        act(() => {
            vi.advanceTimersByTime(600);
        });

        const combatAction = container.querySelector('.combat-action.action-miss');
        expect(combatAction).not.toBeNull();

        const opponentSide = container.querySelector('.fighter-side.right.action-miss');
        const playerReact = container.querySelector('.fighter-side.left.react-miss');
        expect(opponentSide).not.toBeNull();
        expect(playerReact).toBeNull();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should show XP gained in result view', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain'],
            timeline: [{ attackerHp: 100, defenderHp: 90 }]
        });

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => {
            vi.advanceTimersByTime(2500);
        });

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(screen.getByText('+50 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });
});
