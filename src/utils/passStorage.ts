export interface PassProgress {
  xp: number
  claimed: number[]
}

const STORAGE_PREFIX = 'pass_progress'

const memoryStore = new Map<string, PassProgress>()

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined
  } catch {
    return false
  }
}

export function getPassStorageKey(seasonId: string, characterId?: string): string {
  if (characterId) return `${STORAGE_PREFIX}_${seasonId}_${characterId}`
  return `${STORAGE_PREFIX}_${seasonId}`
}

export function loadPassProgress(seasonId: string, characterId?: string): PassProgress {
  const key = getPassStorageKey(seasonId, characterId)
  if (!isLocalStorageAvailable()) {
    return memoryStore.get(key) ?? { xp: 0, claimed: [] }
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { xp: 0, claimed: [] }
    const parsed = JSON.parse(raw) as PassProgress
    if (typeof parsed.xp !== 'number' || !Array.isArray(parsed.claimed)) return { xp: 0, claimed: [] }
    return { xp: parsed.xp, claimed: [...parsed.claimed] }
  } catch {
    return { xp: 0, claimed: [] }
  }
}

export function savePassProgress(seasonId: string, data: PassProgress, characterId?: string): void {
  const key = getPassStorageKey(seasonId, characterId)
  const normalized: PassProgress = { xp: Math.max(0, data.xp), claimed: [...data.claimed] }
  if (!isLocalStorageAvailable()) {
    memoryStore.set(key, normalized)
    return
  }
  try {
    localStorage.setItem(key, JSON.stringify(normalized))
  } catch {
    // ignore
  }
  memoryStore.set(key, normalized)
}

export function clearPassProgress(seasonId?: string, characterId?: string): void {
  if (seasonId) {
    const key = getPassStorageKey(seasonId, characterId)
    memoryStore.delete(key)
    try {
      localStorage?.removeItem(key)
    } catch { /* ignore */ }
    if (!characterId) {
      const prefix = `${STORAGE_PREFIX}_${seasonId}`
      for (const k of Array.from(memoryStore.keys())) {
        if (k.startsWith(prefix)) memoryStore.delete(k)
      }
      try {
        const keys: string[] = []
        for (let i = 0; i < (localStorage?.length ?? 0); i++) {
          const lk = localStorage.key(i)
          if (lk?.startsWith(prefix)) keys.push(lk)
        }
        keys.forEach(k => localStorage.removeItem(k))
      } catch { /* ignore */ }
    }
  } else {
    memoryStore.clear()
    try {
      const keys: string[] = []
      for (let i = 0; i < (localStorage?.length ?? 0); i++) {
        const lk = localStorage.key(i)
        if (lk?.startsWith(STORAGE_PREFIX)) keys.push(lk)
      }
      keys.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
  }
}

export function addPassXpStorage(seasonId: string, amount: number, characterId?: string): PassProgress {
  const current = loadPassProgress(seasonId, characterId)
  const next: PassProgress = { xp: current.xp + Math.max(0, amount), claimed: current.claimed }
  savePassProgress(seasonId, next, characterId)
  return next
}

export function claimPassTierStorage(seasonId: string, tier: number, characterId?: string): boolean {
  const current = loadPassProgress(seasonId, characterId)
  if (current.claimed.includes(tier)) return false
  const next: PassProgress = { xp: current.xp, claimed: [...current.claimed, tier].sort((a, b) => a - b) }
  savePassProgress(seasonId, next, characterId)
  return true
}

export function isPassTierClaimed(seasonId: string, tier: number, characterId?: string): boolean {
  const current = loadPassProgress(seasonId, characterId)
  return current.claimed.includes(tier)
}
