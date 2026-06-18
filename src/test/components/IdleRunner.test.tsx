import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdleRunner } from '../../components/IdleRunner';
import { IdleCombatState } from '../../types/IdleCombat';
import { Character } from '../../types/Character';

const baseCharacter: Character = {
    seed: 'test',
    name: 'TestHero',
    gender: 'male',
    level: 5,
    experience: 500,
    strength: 12,
    vitality: 10,
    dexterity: 8,
    luck: 9,
    intelligence: 7,
    focus: 6,
    hp: 85,
    maxHp: 100,
    wins: 10,
    losses: 5,
    fightsLeft: 5,
    lastFightReset: Date.now(),
};

const defaultIdleState: IdleCombatState = {
    isRunning: true,
    combatLog: [],
    currentMonsterName: null,
    currentMonsterId: null,
    currentResult: null,
    lastActiveTimestamp: Date.now(),
    totalIdleXpGained: 0,
    totalIdleFights: 0,
    totalIdleWins: 0,
};

describe('IdleRunner', () => {
    it('should render the character name', () => {
        render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        expect(screen.getByText('TestHero')).toBeInTheDocument();
    });

    it('should show character level', () => {
        render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        expect(screen.getByText(/LVL 5/)).toBeInTheDocument();
    });

    it('should show HP bar with current/max values', () => {
        render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        expect(screen.getByText('85 / 100')).toBeInTheDocument();
    });

    it('should show XP bar with progress', () => {
        render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        const xpElements = screen.getAllByText(/XP/);
        expect(xpElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display total idle fights count', () => {
        const stateWithFights: IdleCombatState = {
            ...defaultIdleState,
            totalIdleFights: 42,
            totalIdleXpGained: 1200,
        };
        render(<IdleRunner character={baseCharacter} idleState={stateWithFights} />);
        expect(screen.getByText(/42/)).toBeInTheDocument();
    });

    it('should show monster name when combat is active', () => {
        const stateWithMonster: IdleCombatState = {
            ...defaultIdleState,
            currentMonsterName: 'GOBLIN',
            currentMonsterId: 'goblin',
        };
        render(<IdleRunner character={baseCharacter} idleState={stateWithMonster} />);
        expect(screen.getByText(/GOBLIN/)).toBeInTheDocument();
    });

    it('should show combat result when available', () => {
        const stateWithResult: IdleCombatState = {
            ...defaultIdleState,
            currentMonsterName: 'OGRE',
            currentMonsterId: 'ogre',
            currentResult: { won: true, xpGained: 34 },
        };
        render(<IdleRunner character={baseCharacter} idleState={stateWithResult} />);
        expect(screen.getByText(/34/)).toBeInTheDocument();
    });

    it('should render PixelCharacter for the player', () => {
        const { container } = render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        // The PixelCharacter renders an SVG
        const svg = container.querySelector('svg.pixel-character');
        expect(svg).not.toBeNull();
    });

    it('should still render when idleState has empty log', () => {
        render(<IdleRunner character={baseCharacter} idleState={defaultIdleState} />);
        expect(screen.getByText('IDLE MODE')).toBeInTheDocument();
    });
});
