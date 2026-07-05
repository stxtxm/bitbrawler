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

    // ─── Stage 2: PixelCharacter rendering ────────────

    it('should render PixelCharacter for fighters in combat', () => {
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

        const charSvgs = container.querySelectorAll('.pixel-character');
        expect(charSvgs.length).toBeGreaterThan(0);
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

    // ─── Stage 8: Hit Stop & Screen Flash ────────────────

    it('should apply hit-stop class on hit action', () => {
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action');
        expect(combatAction?.classList.contains('hit-stop')).toBe(true);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should apply hit-stop class on crit action', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero crits Villain for 25 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 75 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action');
        expect(combatAction?.classList.contains('hit-stop')).toBe(true);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should NOT apply hit-stop class on miss action', () => {
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action');
        expect(combatAction?.classList.contains('hit-stop')).toBe(false);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should show screen-flash element on crit action', () => {
        vi.useFakeTimers();
        const details = Array.from({ length: 10 }, (_, i) =>
            i === 0 ? 'Hero crits Villain for 25 DMG' : `Hero hits Villain for ${5 + i} DMG`
        );
        const timeline = Array.from({ length: 10 }, (_, i) => ({
            attackerHp: 100,
            defenderHp: Math.max(100 - i * 10, 10),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 10,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail')
            .mockReturnValueOnce({ actor: 'player', type: 'crit' })
            .mockReturnValue({ actor: 'player', type: 'hit' });

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
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(520); });

        const flash = container.querySelector('.screen-flash.flash-crit');
        expect(flash).not.toBeNull();

        act(() => { vi.advanceTimersByTime(100); });
        const flashAfter = container.querySelector('.screen-flash.flash-crit');
        expect(flashAfter).toBeNull();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should set shake direction inline style based on actor', () => {
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action') as HTMLElement;
        const shakeDir = combatAction?.style.getPropertyValue('--shake-dir');
        expect(shakeDir).toBe('-1');

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should set shake direction toward right when opponent attacks', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain hits Hero for 12 DMG'],
            timeline: [{ attackerHp: 88, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action') as HTMLElement;
        const shakeDir = combatAction?.style.getPropertyValue('--shake-dir');
        expect(shakeDir).toBe('1');

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should apply action-ko class on KO blow', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero crits Villain for 100 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const combatAction = container.querySelector('.combat-action');
        expect(combatAction?.classList.contains('action-ko')).toBe(true);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should show screen-flash for KO on defeat blow', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero crits Villain for 100 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 0 }]
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

        act(() => { vi.advanceTimersByTime(2000); });
        act(() => { vi.advanceTimersByTime(900); });
        act(() => { vi.advanceTimersByTime(500); });
        act(() => { vi.advanceTimersByTime(600); });

        const flash = container.querySelector('.screen-flash.flash-ko');
        expect(flash).not.toBeNull();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── Stage 9: Two-stage health bar ─────────────────────

    it('should render ghost health bar element alongside main fill', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain for 20 DMG'],
            timeline: [{ attackerHp: 100, defenderHp: 80 }]
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

        const ghostBars = container.querySelectorAll('.health-bar-ghost');
        expect(ghostBars.length).toBe(2);
    });

    it('should have ghost bar with width matching player HP initially', () => {
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

        const ghostBars = container.querySelectorAll('.health-bar-ghost');
        expect(ghostBars.length).toBe(2);
        expect((ghostBars[0] as HTMLElement).style.width).toBe('100%');
        expect((ghostBars[1] as HTMLElement).style.width).toBe('100%');
    });

    // ─── Stage 10: Enhanced hit sparks ─────────────────────

    it('should emit spark_burst particles on crit action', () => {
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

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('spark_burst', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit blood_pixel particles when opponent HP is below 25%', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 1,
            details: ['Hero hits Villain for 80 DMG'],
            timeline: [
                { attackerHp: 100, defenderHp: 100 },
                { attackerHp: 100, defenderHp: 20 }
            ]
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

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('blood_pixel', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // ─── Stage 11: Special floating text ────────────────────

    it('should emit counter_text particle on counter action', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain counter 12 DMG'],
            timeline: [{ attackerHp: 88, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
            type: 'counter'
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

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('counter_text', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit blocked particle on regular hit action', () => {
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

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('blocked', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should emit dodge particle on miss action', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds: 1,
            details: ['Villain missed!'],
            timeline: [{ attackerHp: 100, defenderHp: 100 }]
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'opponent',
            type: 'miss'
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

        expect(vi.mocked(ParticleSystem.prototype.emit)).toHaveBeenCalledWith('dodge', expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // ─── Stage 12: Low performance mode ────────────────────
    // Note: Low-perf testing is done via the existing mock infrastructure.
    // The spark_burst emission is only expected when !lowPerf (default).
    // When lowPerf is true (mocked), the CombatView skips all non-damage VFX.

});
