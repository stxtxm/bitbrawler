import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';
import * as combatUtils from '../../utils/combatUtils';
import * as combatLogUtils from '../../utils/combatLogUtils';
import * as xpUtils from '../../utils/xpUtils';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

describe('CombatView Interface', () => {
    const mountedContainers = new Map<ParticleSystem, HTMLElement>();

    beforeEach(() => {
        vi.clearAllMocks();
        mountedContainers.clear();
        vi.spyOn(ParticleSystem.prototype, 'mount').mockImplementation(function (this: ParticleSystem, container: HTMLElement) {
            mountedContainers.set(this, container);
        });
        vi.spyOn(ParticleSystem.prototype, 'emit').mockImplementation(function (this: ParticleSystem, type: ParticleType, _x: number, _y: number, _count?: number, value?: number) {
            const container = mountedContainers.get(this);
            if (!container) return;

            const particle = document.createElement('span');
            particle.className = `particle particle-${type}`;
            particle.textContent = type === 'damage' ? String(value) : type === 'miss' ? 'MISS' : type;
            container.appendChild(particle);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

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

    it('should transition to combat phase after intro and vs splash', async () => {
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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(2000); });

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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1500); });
        act(() => { vi.advanceTimersByTime(600); });

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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action.action-miss');
        expect(combatAction).not.toBeNull();

        const opponentSide = container.querySelector('.fighter-side.right.action-miss');
        const playerReact = container.querySelector('.fighter-side.left.react-miss');
        expect(opponentSide).not.toBeNull();
        expect(playerReact).toBeNull();
    });

    it('should emit damage particles on the target side layer', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain for 12 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 88 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit'
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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1500); });
        act(() => { vi.advanceTimersByTime(600); });

        const leftLayer = container.querySelector('.particle-layer.left');
        const rightLayer = container.querySelector('.particle-layer.right');

        expect(leftLayer?.querySelector('.particle-damage')).toBeNull();
        expect(rightLayer?.querySelector('.particle-damage')?.textContent).toBe('12');
    });

    it('should emit miss particles on the target side layer', () => {
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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1500); });
        act(() => { vi.advanceTimersByTime(600); });

        const leftLayer = container.querySelector('.particle-layer.left');
        const rightLayer = container.querySelector('.particle-layer.right');

        expect(leftLayer?.querySelector('.particle-miss')?.textContent).toBe('MISS');
        expect(rightLayer?.querySelector('.particle-miss')).toBeNull();
    });

    it('should show XP gained in result view', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain'],
            timeline: [{ attackerHp: 100, defenderHp: 90 }]
        });

        vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(132);

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(3000); });

        expect(screen.getByText('+132 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should force-finish the fight when hard timeout is exceeded', () => {
        vi.useFakeTimers();

        // Mock simulateCombat to return a normal result quickly
        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 5,
            details: ['Round 1: Hero hits Villain', 'Round 2: Hero crits Villain', 'Round 3: Villain hits Hero', 'Round 4: Hero hits Villain', 'Round 5: Hero defeats Villain'],
            timeline: [
                { attackerHp: 100, defenderHp: 85 },
                { attackerHp: 100, defenderHp: 65 },
                { attackerHp: 85, defenderHp: 65 },
                { attackerHp: 85, defenderHp: 40 },
                { attackerHp: 85, defenderHp: 0 },
            ]
        });

        vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(75);

        const onComplete = vi.fn();
        const onClose = vi.fn();

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={onComplete}
                onClose={onClose}
            />
        );

        // Advance past intro / vs splash into combat
        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(2000); });

        // The combat animation is playing - now advance far beyond the hard timeout
        // (fightHardTimeoutMs = 60000, we've already used ~4.5s)
        act(() => { vi.advanceTimersByTime(61000); });

        // After the hard timeout, the fight should have been force-finished
        // The result phase should show XP
        expect(screen.getByText('+75 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });
});
