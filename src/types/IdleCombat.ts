export interface IdleCombatEntry {
    timestamp: number;
    monsterName: string;
    monsterId: string;
    won: boolean;
    xpGained: number;
    rounds: number;
}

export interface IdleCombatState {
    isRunning: boolean;
    combatLog: IdleCombatEntry[];
    currentMonsterName: string | null;
    currentMonsterId: string | null;
    currentResult: { won: boolean; xpGained: number } | null;
    lastActiveTimestamp: number;
    totalIdleXpGained: number;
    totalIdleFights: number;
    totalIdleWins: number;
}

export interface OfflineGains {
    fightsSimulated: number;
    wins: number;
    totalXpGained: number;
    levelsGained: number;
    elapsedHours: number;
}
