const STORAGE_KEY = 'bitbrawler_bestiary_rewards';

interface BestiaryRewardClaims {
  [characterId: string]: string[];
}

const memoryStore = new Map<string, string[]>();

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined;
  } catch {
    return false;
  }
}

function readAll(): BestiaryRewardClaims {
  if (!isLocalStorageAvailable()) {
    const result: BestiaryRewardClaims = {};
    memoryStore.forEach((value, key) => {
      result[key] = [...value];
    });
    return result;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BestiaryRewardClaims;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeAll(claims: BestiaryRewardClaims): void {
  if (!isLocalStorageAvailable()) {
    memoryStore.clear();
    Object.entries(claims).forEach(([key, value]) => {
      memoryStore.set(key, [...value]);
    });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
  } catch {
    // ignore storage failures
  }
}

export function loadBestiaryRewardClaims(characterId: string): string[] {
  if (!characterId) return [];
  if (!isLocalStorageAvailable()) {
    return [...(memoryStore.get(characterId) ?? [])];
  }
  const claims = readAll();
  const ids = claims[characterId];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

export function saveBestiaryRewardClaims(characterId: string, claimIds: string[]): void {
  if (!characterId) return;
  const normalized = [...new Set(claimIds.filter((id): id is string => typeof id === 'string'))];
  if (!isLocalStorageAvailable()) {
    memoryStore.set(characterId, normalized);
    return;
  }
  const claims = readAll();
  claims[characterId] = normalized;
  writeAll(claims);
}

export function isBestiaryRewardClaimed(characterId: string, rewardId: string): boolean {
  if (!characterId || !rewardId) return false;
  return loadBestiaryRewardClaims(characterId).includes(rewardId);
}

export function claimBestiaryRewardId(characterId: string, rewardId: string): boolean {
  if (!characterId || !rewardId) return false;
  const current = loadBestiaryRewardClaims(characterId);
  if (current.includes(rewardId)) return false;
  saveBestiaryRewardClaims(characterId, [...current, rewardId]);
  return true;
}

export function clearBestiaryRewardClaims(characterId?: string): void {
  if (!characterId) {
    memoryStore.clear();
    try {
      localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  if (!isLocalStorageAvailable()) {
    memoryStore.delete(characterId);
    return;
  }
  const claims = readAll();
  delete claims[characterId];
  writeAll(claims);
}
