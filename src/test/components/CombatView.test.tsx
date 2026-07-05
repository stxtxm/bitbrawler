import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

        // Mock simulateCombat with enough rounds to prevent early auto-completion
        const rounds = 200;
        const details = Array.from({ length: rounds }, (_, i) => `Round ${i + 1}: Hero hits Villain for ${5 + i} DMG`);
        const timeline = Array.from({ length: rounds }, (_, i) => ({
            attackerHp: Math.max(100 - i * 2, 10),
            defenderHp: Math.max(100 - i * 3, 5),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
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
        // (fightHardTimeoutMs = 45000, we've already used ~4.5s)
        act(() => { vi.advanceTimersByTime(61000); });

        // After the hard timeout, the fight should have been force-finished
        // The result phase should show XP
        expect(screen.getByText('+75 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should fire hard timeout from mount time, not reset on phase transitions', () => {
        vi.useFakeTimers();

        // Many rounds so combat does NOT auto-finish before the hard timeout
        const rounds = 200;
        const details = Array.from({ length: rounds }, (_, i) => `Hero hits Villain for ${5 + i} DMG`);
        const timeline = Array.from({ length: rounds }, (_, i) => ({
            attackerHp: Math.max(100 - i * 2, 10),
            defenderHp: Math.max(100 - i * 3, 5),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
        });

        vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(50);

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        // Advance through intro (2000ms) and vs (1400ms) = ~3400ms total, now in combat
        act(() => { vi.advanceTimersByTime(3500); });

        // Advance 57000ms more during combat.
        // Total elapsed from mount: 3500 + 57000 = 60500ms.
        //
        // With the FIX (mount-level timeout fires at 60000ms):
        //   We are at 60500ms, 500ms AFTER the timeout → result should be visible.
        //
        // With the BUG (timeout resets on each phase change):
        //   Timeout was reset at combat start (3500ms from mount).
        //   It would fire at 3500 + 60000 = 63500ms.
        //   We are at 60500ms, 3000ms BEFORE the timeout → result should NOT be visible.
        act(() => { vi.advanceTimersByTime(57000); });

        // The hard timeout (mount-level) should have fired, force-finishing the fight
        expect(screen.getByText('+50 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── Phase 1: Round counter & Progress bar ────────────

    it('should display round counter during combat phase', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 5,
            details: Array.from({ length: 5 }, (_, i) => `Round ${i + 1}: Hero hits Villain`),
            timeline: Array.from({ length: 5 }, (_, i) => ({
                attackerHp: Math.max(100 - i * 20, 20),
                defenderHp: Math.max(100 - i * 25, 0),
            })),
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

        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1500); });
        act(() => { vi.advanceTimersByTime(600); });

        const roundCounter = document.querySelector('.round-counter');
        expect(roundCounter).not.toBeNull();
        expect(roundCounter?.textContent).toMatch(/ROUND/i);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should render combat progress bar with correct width', () => {
        vi.useFakeTimers();

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds: 10,
            details: Array.from({ length: 10 }, (_, i) => `Round ${i + 1}: Hero hits Villain`),
            timeline: Array.from({ length: 10 }, (_, i) => ({
                attackerHp: Math.max(100 - i * 10, 10),
                defenderHp: Math.max(100 - i * 12, 0),
            })),
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
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

        const progressFill = container.querySelector('.combat-progress-fill') as HTMLElement;
        expect(progressFill).not.toBeNull();
        const width = progressFill?.style.width;
        expect(width).toBeTruthy();
        expect(parseFloat(width || '0')).toBeGreaterThan(0);

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── Phase 2: Auto-resolve warning at 30s ────────────

    it('should not show auto-resolve warning before 30s of combat', () => {
        vi.useFakeTimers();

        const rounds = 200;
        const details = Array.from({ length: rounds }, (_, i) => `Round ${i + 1}: Hero hits Villain for ${5 + i} DMG`);
        const timeline = Array.from({ length: rounds }, (_, i) => ({
            attackerHp: Math.max(100 - i * 2, 10),
            defenderHp: Math.max(100 - i * 3, 5),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
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

        // Step through phases gradually so React commits state at each step
        act(() => { vi.advanceTimersByTime(2000); }); // intro fires → phase='vs'
        act(() => { vi.advanceTimersByTime(1000); }); // vs timer fires at ~900ms into vs
        act(() => { vi.advanceTimersByTime(1000); }); // entrance timer → phase='combat'
        act(() => { vi.advanceTimersByTime(5000); }); // 5s into combat, before 30s warning

        expect(container.querySelector('.auto-resolve-banner')).toBeNull();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should show auto-resolve warning after 30s of combat', () => {
        vi.useFakeTimers();

        const rounds = 200;
        const details = Array.from({ length: rounds }, (_, i) => `Round ${i + 1}: Hero hits Villain for ${5 + i} DMG`);
        const timeline = Array.from({ length: rounds }, (_, i) => ({
            attackerHp: Math.max(100 - i * 2, 10),
            defenderHp: Math.max(100 - i * 3, 5),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'defender',
            rounds,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
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

        // Step through phases gradually
        act(() => { vi.advanceTimersByTime(2000); }); // intro fires → phase='vs'
        act(() => { vi.advanceTimersByTime(1000); }); // vs timer fires → fighterEntrance + nested timer
        act(() => { vi.advanceTimersByTime(1000); }); // nested timer → phase='combat'
        // Now combat phase auto-resolve timer is set at current time (~4000ms) for 30000ms
        act(() => { vi.advanceTimersByTime(30000); }); // auto-resolve fires at ~34000ms (4000+30000)

        const banner = container.querySelector('.auto-resolve-banner') as HTMLElement;
        expect(banner).not.toBeNull();

        // Hard timeout at 45000ms hasn't fired yet ✓

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── Phase 3: Combo Ring ──────────────────────────

    it('should show combo ring when comboCount >= 2', () => {
        vi.useFakeTimers();

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                comboCount={3}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const comboRing = container.querySelector('.combo-ring');
        expect(comboRing).not.toBeNull();
        expect(comboRing?.textContent).toContain('3');
        expect(comboRing?.textContent).toContain('COMBO');

        vi.useRealTimers();
    });

    it('should not show combo ring when comboCount < 2', () => {
        vi.useFakeTimers();

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                comboCount={1}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(container.querySelector('.combo-ring')).toBeNull();

        vi.useRealTimers();
    });

    it('should apply correct combo size class for count 3', () => {
        vi.useFakeTimers();

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                comboCount={3}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const comboRing = container.querySelector('.combo-ring');
        expect(comboRing).not.toBeNull();
        expect(comboRing?.classList.contains('combo-medium')).toBe(true);
        expect(comboRing?.classList.contains('combo-small')).toBe(false);
        expect(comboRing?.classList.contains('combo-large')).toBe(false);

        vi.useRealTimers();
    });

    it('should apply combo-large class for count 5+', () => {
        vi.useFakeTimers();

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                comboCount={7}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const comboRing = container.querySelector('.combo-ring');
        expect(comboRing).not.toBeNull();
        expect(comboRing?.classList.contains('combo-large')).toBe(true);

        vi.useRealTimers();
    });

    it('should emit combo particles on vs transition when combo active', () => {
        vi.useFakeTimers();

        render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                comboCount={3}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        // Advance past intro (2000ms) + VS timer (900ms) to trigger particle emission
        act(() => { vi.advanceTimersByTime(2500); });
        act(() => { vi.advanceTimersByTime(1000); });

        // Combo emit should have been called with 'combo' type
        const emitSpy = vi.mocked(ParticleSystem.prototype.emit);
        const comboEmitCalls = emitSpy.mock.calls.filter(([type]) => type === 'combo');
        expect(comboEmitCalls.length).toBeGreaterThanOrEqual(2);

        vi.useRealTimers();
    });

    it('should show combo ring in PvE intro when comboCount >= 2', () => {
        vi.useFakeTimers();

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="pve"
                monsterId="goblin"
                comboCount={2}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const comboRing = container.querySelector('.combo-ring');
        expect(comboRing).not.toBeNull();
        expect(comboRing?.classList.contains('combo-small')).toBe(true);

        vi.useRealTimers();
    });

    it('should skip to result phase when auto-resolve is clicked', () => {
        vi.useFakeTimers();

        const rounds = 200;
        const details = Array.from({ length: rounds }, (_, i) => `Round ${i + 1}: Hero hits Villain for ${5 + i} DMG`);
        const timeline = Array.from({ length: rounds }, (_, i) => ({
            attackerHp: Math.max(100 - i * 2, 10),
            defenderHp: Math.max(100 - i * 3, 5),
        }));

        vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
            winner: 'attacker',
            rounds,
            details,
            timeline,
        });

        vi.spyOn(combatLogUtils, 'parseCombatDetail').mockReturnValue({
            actor: 'player',
            type: 'hit',
        });

        vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(75);

        const { container } = render(
            <CombatView
                player={player}
                opponent={opponent}
                matchType="balanced"
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />
        );

        act(() => { vi.advanceTimersByTime(2000); }); // intro fires → phase='vs'
        act(() => { vi.advanceTimersByTime(1000); }); // vs timer fires
        act(() => { vi.advanceTimersByTime(1000); }); // phase='combat'
        act(() => { vi.advanceTimersByTime(30000); }); // auto-resolve fires

        const autoResolveBtn = container.querySelector('.auto-resolve-btn') as HTMLElement;
        expect(autoResolveBtn).not.toBeNull();

        act(() => {
            fireEvent.click(autoResolveBtn);
        });

        // After auto-resolve, the result phase should show XP
        expect(screen.getByText('+75 XP')).toBeInTheDocument();

        vi.useRealTimers();
        vi.restoreAllMocks();
    });
});
