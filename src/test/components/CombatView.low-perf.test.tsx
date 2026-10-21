import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';
import * as combatUtils from '../../utils/combatUtils';
import * as combatLogUtils from '../../utils/combatLogUtils';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

vi.mock('../../hooks/useLowPerformanceMode', () => ({
    useLowPerformanceMode: () => true,
}));

describe('CombatView low performance mode', () => {
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

    it('resolves the hit immediately when the attack animation is disabled', () => {
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
        act(() => { vi.advanceTimersByTime(520); });

        const rightLayer = container.querySelector('.particle-layer.right');
        expect(rightLayer?.querySelector('.particle-damage')).toBeNull();

        act(() => { vi.advanceTimersByTime(1); });

        expect(rightLayer?.querySelector('.particle-damage')?.textContent).toBe('12');
        expect(container.querySelector('.fighter-side.right.react-hit')).not.toBeNull();

        const combatAction = container.querySelector('.combat-action') as HTMLElement | null;
        expect(combatAction?.style.getPropertyValue('--impact-delay')).toBe('0ms');
    });
});
