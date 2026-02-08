export type CombatActionType = 'hit' | 'crit' | 'magic' | 'miss' | 'counter';
export type CombatActor = 'player' | 'opponent';

export interface CombatAction {
    actor: CombatActor;
    type: CombatActionType;
}

export function parseCombatDetail(detail: string, playerName: string, opponentName: string): CombatAction | null {
    const lowerDetail = detail.toLowerCase();
    if (
        lowerDetail.includes(' vs ') ||
        lowerDetail.includes('gagne') ||
        lowerDetail.includes('match') ||
        lowerDetail.includes('limite')
    ) {
        return null;
    }

    const lowerPlayer = playerName.toLowerCase();
    const lowerOpponent = opponentName.toLowerCase();
    let actor: CombatActor | null = null;

    if (lowerDetail.includes(lowerPlayer)) {
        actor = 'player';
    } else if (lowerDetail.includes(lowerOpponent)) {
        actor = 'opponent';
    }

    if (!actor) return null;

    if (lowerDetail.includes('missed')) return { actor, type: 'miss' };
    if (lowerDetail.includes('magic surge')) return { actor, type: 'magic' };
    if (lowerDetail.includes('crit')) return { actor, type: 'crit' };
    if (lowerDetail.includes('counter')) return { actor, type: 'counter' };
    if (lowerDetail.includes('hit')) return { actor, type: 'hit' };

    return null;
}
