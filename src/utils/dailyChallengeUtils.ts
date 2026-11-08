import { getDailyResetKey } from './dailyReset';

export type DailyChallengeId = 'combattant' | 'artisan' | 'chasseur';

export interface DailyChallenge {
  id: DailyChallengeId;
  label: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  monsters?: string[];
}

export interface DailyChallengeState {
  dayKey: string;
  challenges: Record<DailyChallengeId, DailyChallenge>;
  allCompletedBonusClaimed: boolean;
}

const STORAGE_PREFIX = 'bitbrawler_daily_challenges_';

function defaultChallenges(): Record<DailyChallengeId, DailyChallenge> {
  return {
    combattant: {
      id: 'combattant',
      label: 'Combattant',
      description: 'Remporter ou tenter 3 combats PvP/PvE',
      target: 3,
      progress: 0,
      completed: false,
    },
    artisan: {
      id: 'artisan',
      label: 'Artisan',
      description: 'Forger 1 item ou acheter 1 offre du shop',
      target: 1,
      progress: 0,
      completed: false,
    },
    chasseur: {
      id: 'chasseur',
      label: 'Chasseur',
      description: 'Affronter 1 monstre PvE différent',
      target: 1,
      progress: 0,
      completed: false,
      monsters: [],
    },
  };
}

function keyFor(characterId: string): string {
  return `${STORAGE_PREFIX}${characterId}`;
}

export function loadDailyChallenges(characterId: string, now = Date.now()): DailyChallengeState {
  const dayKey = getDailyResetKey(now);
  try {
    const raw = localStorage.getItem(keyFor(characterId));
    if (!raw) return { dayKey, challenges: defaultChallenges(), allCompletedBonusClaimed: false };
    const parsed = JSON.parse(raw) as Partial<DailyChallengeState> | null;
    if (!parsed || parsed.dayKey !== dayKey || !parsed.challenges) {
      return { dayKey, challenges: defaultChallenges(), allCompletedBonusClaimed: false };
    }
    const base = defaultChallenges();
    const merged: Record<DailyChallengeId, DailyChallenge> = { ...base };
    (Object.keys(base) as DailyChallengeId[]).forEach((id) => {
      const saved = parsed.challenges?.[id];
      if (saved && typeof saved === 'object') {
        merged[id] = { ...base[id], ...saved, id, target: base[id].target };
        merged[id].progress = Math.max(0, Math.min(merged[id].target, Number(merged[id].progress) || 0));
        merged[id].completed = merged[id].progress >= merged[id].target;
      }
    });
    return {
      dayKey,
      challenges: merged,
      allCompletedBonusClaimed: !!parsed.allCompletedBonusClaimed,
    };
  } catch {
    return { dayKey, challenges: defaultChallenges(), allCompletedBonusClaimed: false };
  }
}

export function saveDailyChallenges(characterId: string, state: DailyChallengeState): void {
  try {
    localStorage.setItem(keyFor(characterId), JSON.stringify(state));
  } catch {
    return;
  }
}

function withProgress(state: DailyChallengeState): DailyChallengeState {
  const challenges = { ...state.challenges };
  (Object.keys(challenges) as DailyChallengeId[]).forEach((id) => {
    const c = { ...challenges[id] };
    c.progress = Math.max(0, Math.min(c.target, c.progress));
    c.completed = c.progress >= c.target;
    challenges[id] = c;
  });
  return { ...state, challenges };
}

export function areAllDailyChallengesCompleted(state: DailyChallengeState): boolean {
  return (Object.values(state.challenges) as DailyChallenge[]).every((c) => c.completed);
}

export function recordCombatChallenge(characterId: string, now = Date.now()): DailyChallengeState {
  const state = loadDailyChallenges(characterId, now);
  state.challenges.combattant = {
    ...state.challenges.combattant,
    progress: state.challenges.combattant.progress + 1,
  };
  const next = withProgress(state);
  saveDailyChallenges(characterId, next);
  return next;
}

export function recordArtisanChallenge(characterId: string, now = Date.now()): DailyChallengeState {
  const state = loadDailyChallenges(characterId, now);
  state.challenges.artisan = {
    ...state.challenges.artisan,
    progress: state.challenges.artisan.progress + 1,
  };
  const next = withProgress(state);
  saveDailyChallenges(characterId, next);
  return next;
}

export function recordChasseurChallenge(characterId: string, monsterId: string, now = Date.now()): DailyChallengeState {
  const state = loadDailyChallenges(characterId, now);
  const ch = state.challenges.chasseur;
  const monsters = Array.isArray(ch.monsters) ? [...ch.monsters] : [];
  if (monsterId && !monsters.includes(monsterId)) monsters.push(monsterId);
  state.challenges.chasseur = {
    ...ch,
    monsters,
    progress: monsters.length,
  };
  const next = withProgress(state);
  saveDailyChallenges(characterId, next);
  return next;
}

export function consumeAllChallengesBonus(characterId: string, now = Date.now()): boolean {
  const state = loadDailyChallenges(characterId, now);
  if (!areAllDailyChallengesCompleted(state) || state.allCompletedBonusClaimed) return false;
  state.allCompletedBonusClaimed = true;
  saveDailyChallenges(characterId, state);
  return true;
}

export function isAllChallengesBonusAvailable(characterId: string, now = Date.now()): boolean {
  const state = loadDailyChallenges(characterId, now);
  return areAllDailyChallengesCompleted(state) && !state.allCompletedBonusClaimed;
}
