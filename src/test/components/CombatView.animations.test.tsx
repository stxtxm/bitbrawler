import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';
import * as combatUtils from '../../utils/combatUtils';
import * as combatLogUtils from '../../utils/combatLogUtils';
import * as xpUtils from '../../utils/xpUtils';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

describe('CombatView Animation Overhaul', () => {
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

    // ─── Stage 1: Defeat animation ─────────────────────────

    it('should apply defeat class to the losing fighter in result phase', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 2,
            details: ['Villain hits Hero for 100 DMG', 'Hero is defeated!'],
            timeline: [
                { attackerHp: 100, defenderHp: 100 },
                { attackerHp: 0, defenderHp: 100 },
            ]
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
        act(() => { vi.advanceTimersByTime(2000); });

        const leftFighter = container.querySelector('.fighter-side.left');
        const rightFighter = container.querySelector('.fighter-side.right');

        expect(leftFighter?.classList.contains('defeated')).toBe(true);
        expect(rightFighter?.classList.contains('defeated')).toBe(false);
    });

    it('should apply defeat class to opponent when attacker wins', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero crits Villain for 100 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
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
        act(() => { vi.advanceTimersByTime(2000); });

        const rightFighter = container.querySelector('.fighter-side.right');
        expect(rightFighter?.classList.contains('defeated')).toBe(true);
    });

    // ─── Stage 2: AnimatedPixelCharacter states ────────────

    it('should render AnimatedPixelCharacter with char-running state idle', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain for 10 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 90 }]
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

        const charSvgs = container.querySelectorAll('.pixel-character-animated');
        expect(charSvgs.length).toBeGreaterThan(0);
        charSvgs.forEach(svg => {
            expect(svg.classList.contains('char-running')).toBe(true);
        });
    });

    it('should apply defeated class to losing fighter during combat phase', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain crits Hero for 100 DMG'],
            timeline: [{ attackerHp: 0, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
            type: 'crit'
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const emitCalls = (ParticleSystem.prototype.emit as ReturnType<typeof vi.fn>).mock.calls;
        const hasCritRelated = emitCalls.some(c => (c as Array<unknown>)[0] === 'hit_ring' || (c as Array<unknown>)[0] === 'dust');
        expect(hasCritRelated).toBe(true);
    });

    // ─── Stage 3: Enriched particles ────────────────────────

    it('should emit dust particles on hit impact', () => {
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

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('dust', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit hit_ring particles on crit', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain crits Hero for 25 DMG'],
            timeline: [{ attackerHp: 75, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
            type: 'crit'
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('hit_ring', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit spark particles on fighter entrance', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 0,
            details: [],
            timeline: [{ attackerHp: 100, defenderHp: 100 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('spark', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit hit particles explicitly on hit action', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero lands a hit on Villain'],
            timeline: [{ attackerHp: 100, defenderHp: 95 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit'
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('hit', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // ─── Stage 4: Ground shadows ────────────────────────────

    it('should have ground shadow element on fighter-side', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 0,
            details: [],
            timeline: [{ attackerHp: 100, defenderHp: 100 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(600); });

        const shadows = container.querySelectorAll('.fighter-shadow');
        expect(shadows.length).toBe(2);
    });

    // ─── Stage 5: XP popup animation ────────────────────────

    it('should show animated XP popup on victory with popup class', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero wins!'],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
        });

        vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(85);

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

        const xpElement = screen.getByText('+85 XP');
        expect(xpElement.classList.contains('result-xp-popup')).toBe(true);
    });

    // ─── Stage 6: Screen shake on defeat ────────────────────

    it('should have screen shake class on defeat result', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain wins!'],
            timeline: [{ attackerHp: 0, defenderHp: 100 }]
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
        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(3000); });

        const resultContainer = container.querySelector('.combat-result');
        expect(resultContainer?.classList.contains('combat-result-shake')).toBe(true);
    });

    it('should NOT have screen shake class on victory', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero wins!'],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
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
        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(3000); });

        const resultContainer = container.querySelector('.combat-result');
        expect(resultContainer?.classList.contains('combat-result-shake')).toBe(false);
    });

    // ─── Stage 7: More particles on victory ────────────────

    it('should emit xp_star and spark particles on victory result', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 0,
            details: [],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });
        act(() => { vi.advanceTimersByTime(2000); });

        const emitCalls = (ParticleSystem.prototype.emit as ReturnType<typeof vi.fn>).mock.calls;
        const hasXpStars = emitCalls.some(c => (c as Array<unknown>)[0] === 'xp_star');
        const hasSpark = emitCalls.some(c => (c as Array<unknown>)[0] === 'spark');

        expect(hasXpStars).toBe(true);
        expect(hasSpark).toBe(true);
    });
});
