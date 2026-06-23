const SNAPSHOT_KEY = 'bitbrawler_idle_snapshot'

export interface IdleSnapshot {
  essence: number
  experience: number
  level: number
}

export function saveIdleSnapshot(essence: number, experience: number, level: number): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ essence, experience, level }))
  } catch { }
}

export function loadIdleSnapshot(): IdleSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearIdleSnapshot(): void {
  try { localStorage.removeItem(SNAPSHOT_KEY) } catch { }
}
