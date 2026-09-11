import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../context/GameContext'
import { getPassLevel, getPassRewards, getPassProgress, getSeasonWindowForPass, PASS_MAX_LEVEL } from '../data/seasonalPass'

const STORAGE_KEY = 'bitbrawler_pass_progress'

interface PassSnapshot {
  xp: number
  claimed: number[]
  seasonId: string
}

const defaultSnapshot = (seasonId: string): PassSnapshot => ({ xp: 0, claimed: [], seasonId })

let state: PassSnapshot = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PassSnapshot>
      return {
        xp: typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) ? parsed.xp : 0,
        claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter((v): v is number => typeof v === 'number') : [],
        seasonId: typeof parsed.seasonId === 'string' ? parsed.seasonId : getSeasonWindowForPass().seasonId,
      }
    }
  } catch { /* ignore */ }
  return defaultSnapshot(getSeasonWindowForPass().seasonId)
})()

let listeners: Array<(s: PassSnapshot) => void> = []

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function notify() { listeners.forEach(fn => fn({ ...state, claimed: [...state.claimed] })) }

function ensureSeason() {
  const cur = getSeasonWindowForPass().seasonId
  if (state.seasonId !== cur) {
    state = defaultSnapshot(cur)
    persist()
    notify()
  }
}

function readSnapshot(): PassSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PassSnapshot>
      const cur = getSeasonWindowForPass().seasonId
      if (parsed.seasonId !== cur && typeof parsed.seasonId === 'string') {
        return defaultSnapshot(cur)
      }
      return {
        xp: typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) ? parsed.xp : 0,
        claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter((v): v is number => typeof v === 'number') : [],
        seasonId: typeof parsed.seasonId === 'string' ? parsed.seasonId : cur,
      }
    }
  } catch { /* ignore */ }
  return defaultSnapshot(getSeasonWindowForPass().seasonId)
}

export function getPassSnapshot(): PassSnapshot {
  ensureSeason()
  return { ...state, claimed: [...state.claimed] }
}

export function setPassXp(xp: number): PassSnapshot {
  ensureSeason()
  const safe = Number.isFinite(xp) && xp >= 0 ? Math.floor(xp) : 0
  state = { ...state, xp: safe }
  persist()
  notify()
  return getPassSnapshot()
}

export function addPassXp(amount: number): PassSnapshot {
  ensureSeason()
  if (!Number.isFinite(amount) || amount <= 0) return getPassSnapshot()
  state = { ...state, xp: state.xp + Math.floor(amount) }
  persist()
  notify()
  return getPassSnapshot()
}

export function claimPassReward(level: number): PassSnapshot | null {
  ensureSeason()
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return null
  if (state.claimed.includes(level)) return null
  const lvl = getPassLevel(state.xp)
  if (lvl < level) return null
  if (!getPassRewards(level)) return null
  state = { ...state, claimed: [...state.claimed, level].sort((a, b) => a - b) }
  persist()
  notify()
  return getPassSnapshot()
}

export function resetPassProgress(): PassSnapshot {
  state = defaultSnapshot(getSeasonWindowForPass().seasonId)
  persist()
  notify()
  return getPassSnapshot()
}

export function usePassProgress() {
  const { activeCharacter } = useGame()
  const [local, setLocal] = useState<PassSnapshot>(readSnapshot)

  useEffect(() => {
    const fn = (s: PassSnapshot) => setLocal({ ...s, claimed: [...s.claimed] })
    listeners.push(fn)
    return () => { listeners = listeners.filter(f => f !== fn) }
  }, [])

  useEffect(() => {
    ensureSeason()
    const curLocal = getPassSnapshot()
    const remote = activeCharacter?.passProgress
    if (!remote) {
      if (curLocal.xp !== local.xp || curLocal.claimed.length !== local.claimed.length) {
        setLocal(curLocal)
      }
      return
    }
    const remoteXp = typeof remote.xp === 'number' && Number.isFinite(remote.xp) ? remote.xp : 0
    const remoteClaimed = Array.isArray(remote.claimed) ? remote.claimed.filter((v): v is number => typeof v === 'number') : []
    const remoteSeason = typeof remote.seasonId === 'string' ? remote.seasonId : getSeasonWindowForPass().seasonId
    const curSeason = getSeasonWindowForPass().seasonId
    if (remoteSeason !== curSeason) return
    const mergedXp = Math.max(curLocal.xp, remoteXp)
    const mergedClaimed = Array.from(new Set([...curLocal.claimed, ...remoteClaimed])).sort((a, b) => a - b)
    if (mergedXp !== curLocal.xp || mergedClaimed.length !== curLocal.claimed.length || mergedClaimed.some((v, i) => v !== curLocal.claimed[i])) {
      state = { xp: mergedXp, claimed: mergedClaimed, seasonId: curSeason }
      persist()
      setLocal(getPassSnapshot())
      notify()
    }
  }, [activeCharacter?.passProgress?.xp, activeCharacter?.passProgress?.claimed?.join(','), activeCharacter?.passProgress?.seasonId])

  const level = getPassLevel(local.xp)
  const progress = getPassProgress(local.xp)

  const addXp = useCallback((amount: number) => addPassXp(amount), [])
  const claim = useCallback((lvl: number) => claimPassReward(lvl), [])
  const canClaim = useCallback((lvl: number) => {
    if (local.claimed.includes(lvl)) return false
    if (level < lvl) return false
    return !!getPassRewards(lvl)
  }, [local.claimed, level])

  return {
    xp: local.xp,
    level,
    nextXp: progress.nextXp,
    progress: progress.progress,
    claimed: local.claimed,
    seasonId: local.seasonId,
    addXp,
    claim,
    canClaim,
    setXp: useCallback((xp: number) => setPassXp(xp), []),
    reset: useCallback(() => resetPassProgress(), []),
  }
}
