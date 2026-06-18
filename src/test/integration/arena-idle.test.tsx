import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Arena from '../../pages/Arena';
import { useGame } from '../../context/GameContext';
import { useConnectionGate } from '../../hooks/useConnectionGate';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Character } from '../../types/Character';

vi.mock('../../context/GameContext', () => ({
    useGame: vi.fn(),
}));

vi.mock('../../hooks/useConnectionGate', () => ({
    useConnectionGate: vi.fn(),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
    useOnlineStatus: vi.fn(),
}));

// Mock idle combat to avoid timers during tests
vi.mock('../../hooks/useIdleCombat', () => ({
    useIdleCombat: () => ({
        idleState: {
            isRunning: true,
            combatLog: [],
            currentMonsterName: null,
            currentMonsterId: null,
            currentResult: null,
            lastActiveTimestamp: Date.now(),
            totalIdleXpGained: 0,
            totalIdleFights: 0,
            totalIdleWins: 0,
        },
        offlineGains: null,
        dismissOfflineRecap: vi.fn(),
    }),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseConnectionGate = useConnectionGate as unknown as ReturnType<typeof vi.fn>;
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>;

const baseCharacter: Character = {
    seed: 'test-seed',
    name: 'IdleHero',
    gender: 'male',
    level: 3,
    experience: 200,
    strength: 10,
    vitality: 10,
    dexterity: 10,
    luck: 10,
    intelligence: 10,
    focus: 10,
    hp: 100,
    maxHp: 100,
    wins: 3,
    losses: 1,
    fightsLeft: 5,
    lastFightReset: Date.now(),
    id: 'test-id',
    statPoints: 0,
    inventory: [],
    lastLootRoll: 0,
    lastIdleTimestamp: Date.now(),
};

function setupGameMock(char: Character = baseCharacter) {
    mockUseGame.mockReturnValue({
        activeCharacter: char,
        logout: vi.fn(),
        useFight: vi.fn(),
        usePveFight: vi.fn(),
        startMatchmaking: vi.fn(),
        lastXpGain: null,
        lastLevelUp: null,
        clearXpNotifications: vi.fn(),
        dbAvailable: true,
        allocateStatPoint: vi.fn(),
        saveStatAllocations: vi.fn().mockResolvedValue(undefined),
        saveEquipment: vi.fn().mockResolvedValue(undefined),
        rollLootbox: vi.fn(),
        setAutoMode: vi.fn(),
        deleteCharacter: vi.fn(),
        setCharacter: vi.fn(),
    });
}

describe('Arena Idle PvE Mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseConnectionGate.mockReturnValue({
            ensureConnection: vi.fn().mockResolvedValue(true),
            openModal: vi.fn(),
            closeModal: vi.fn(),
            connectionModal: { open: false, message: '' },
        });
        mockUseOnlineStatus.mockReturnValue(true);
        setupGameMock();
    });

    it('should default to PvE mode on load', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        await waitFor(() => {
            const pveSwitch = screen.getByRole('switch', { name: /PvE mode/i });
            expect(pveSwitch).toBeInTheDocument();
            expect(pveSwitch).toHaveClass('on');
        });
    });

    it('should show IdleRunner in PvE mode', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/IDLE MODE/i)).toBeInTheDocument();
        });
    });

    it('should show SPEND POINT button when stat points are available', async () => {
        const charWithPoints: Character = { ...baseCharacter, statPoints: 3 };
        setupGameMock(charWithPoints);

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('SPEND POINT')).toBeInTheDocument();
        });
    });

    it('should hide IdleRunner when switching to PvP mode', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/IDLE MODE/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('switch', { name: /PvP mode/i }));

        await waitFor(() => {
            expect(screen.queryByText(/IDLE MODE/i)).toBeNull();
        });
    });

    it('should show PvP fight button when toggled to PvP', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('switch', { name: /PvP mode/i }));

        await waitFor(() => {
            expect(screen.getByText(/FIGHT!/i)).toBeInTheDocument();
        });
    });

    it('should show battle energy info in PvP mode', async () => {
        const charWithLowFights: Character = { ...baseCharacter, fightsLeft: 3 };
        setupGameMock(charWithLowFights);

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('switch', { name: /PvP mode/i }));

        await waitFor(() => {
            expect(screen.getByText(/BATTLE ENERGY/i)).toBeInTheDocument();
            expect(screen.getByText(/3 \/ 5 AVAILABLE/i)).toBeInTheDocument();
        });
    });

    it('should show character name and level in PvE mode', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Arena />
            </MemoryRouter>
        );

        await waitFor(() => {
            const nameElements = screen.getAllByText('IdleHero');
            expect(nameElements.length).toBeGreaterThanOrEqual(1);
        });
        expect(screen.getByText(/LVL 3/)).toBeInTheDocument();
    });
});
