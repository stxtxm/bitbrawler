import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
  PASS_MAX_LEVEL,
  PASS_XP_PER_LEVEL,
  PASS_XP_PER_FIGHT,
  PASS_XP_PER_FORGE,
  PASS_XP_PER_IDLE_CLAIM,
  PASS_REWARDS,
  getPassLevel,
  getPassProgress,
  getPassRewards,
} from '../data/seasonalPass'

export const PASS_STORAGE_KEY = 'bitbrawler_pass_progress'

export interface PassProgressState {
  xp: number
  claimed: number[]
}

interface StoredPassMap {
  [characterId: string]: PassProgressState
}

const defaultState: PassProgressState = { xp: 0, claimed: [] }

let memoryStore: StoredPassMap = {}
let listeners: Array<(map: StoredPassMap) => void> = []

try {
  const raw = localStorage.getItem(PASS_STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      memoryStore = parsed as StoredPassMap
    }
  }
} catch { /* ignore */ }

function persistStore() {
  try {
    localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(memoryStore))
  } catch { /* ignore */ }
}

function notifyListeners() {
  listeners.forEach(fn => fn({ ...memoryStore }))
}

function sanitizeState(raw: unknown): PassProgressState {
  if (!raw || typeof raw !== 'object') return { ...defaultState }
  const r = raw as Record<string, unknown>
  const xp = typeof r.xp === 'number' && Number.isFinite(r.xp) && r.xp >= 0 ? Math.floor(r.xp) : 0
  const claimedRaw = Array.isArray(r.claimed) ? r.claimed : []
  const claimed = claimedRaw.filter((v): v is number => Number.isInteger(v) && v >= 1 && v <= PASS_MAX_LEVEL)
  return { xp, claimed: [...new Set(claimed)].sort((a, b) => a - b) }
}

export function getStoredPassProgress(characterId: string): PassProgressState {
  if (!characterId) return { ...defaultState }
  const entry = memoryStore[characterId]
  return entry ? sanitizeState(entry) : { ...defaultState }
}

export function setStoredPassProgress(characterId: string, state: PassProgressState): void {
  if (!characterId) return
  memoryStore[characterId] = sanitizeState(state)
  persistStore()
  notifyListeners()
}

export function addStoredPassXp(characterId: string, amount: number): PassProgressState {
  const current = getStoredPassProgress(characterId)
  const delta = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0
  const next: PassProgressState = { xp: current.xp + delta, claimed: current.claimed }
  setStoredPassProgress(characterId, next)
  return next
}

export function claimStoredPassReward(characterId: string, level: number): boolean {
  const current = getStoredPassProgress(characterId)
  const lvl = getPassLevel(current.xp)
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return false
  if (current.claimed.includes(level)) return false
  if (lvl < level) return false
  const next: PassProgressState = { xp: current.xp, claimed: [...current.claimed, level].sort((a, b) => a - b) }
  setStoredPassProgress(characterId, next)
  return true
}

export function resetStoredPassProgress(characterId: string): void {
  if (!characterId) return
  delete memoryStore[characterId]
  persistStore()
  notifyListeners()
}

export function getPassStorageSnapshot(): StoredPassMap {
  return { ...memoryStore }
}

function resolveInitialState(characterId: string | undefined, characterPass?: PassProgressState): PassProgressState {
  if (!characterId) return sanitizeState(characterPass)
  const stored = memoryStore[characterId]
  if (stored) return sanitizeState(stored)
  if (characterPass) {
    const sanitized = sanitizeState(characterPass)
    memoryStore[characterId] = sanitized
    persistStore()
    return sanitized
  }
  return { ...defaultState }
}

export function usePassProgress() {
  const { activeCharacter } = useGame()
  const charId = activeCharacter?.id ?? activeCharacter?.seed ?? ''
  const [state, setState] = useState<PassProgressState>(() => resolveInitialState(charId, activeCharacter?.passProgress as PassProgressState | undefined))

  useEffect(() => {
    const next = resolveInitialState(charId, activeCharacter?.passProgress as PassProgressState | undefined)
    setState(next)
  }, [charId])

  useEffect(() => {
    const fn = (map: StoredPassMap) => {
      if (!charId) return
      const entry = map[charId]
      setState(entry ? sanitizeState(entry) : { ...defaultState })
    }
    listeners.push(fn)
    return () => {
      listeners = listeners.filter(f => f !== fn)
    }
  }, [charId])

  const addXp = useCallback((amount: number) => {
    if (!charId) return
    const delta = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0
    if (delta <= 0) return
    addStoredPassXp(charId, delta)
  }, [charId])

  const addFightXp = useCallback(() => {
    addXp(PASS_XP_PER_FIGHT)
  }, [addXp])

  const addForgeXp = useCallback(() => {
    addXp(PASS_XP_PER_FORGE)
  }, [addXp])

  const addIdleClaimXp = useCallback(() => {
    addXp(PASS_XP_PER_IDLE_CLAIM)
  }, [addXp])

  const claimReward = useCallback((level: number): boolean => {
    if (!charId) return false
    return claimStoredPassReward(charId, level)
  }, [charId])

  const xp = state.xp
  const level = getPassLevel(xp)
  const progress = getPassProgress(xp)
  const claimed = state.claimed
  const canClaim = useCallback((lvl: number) => {
    if (claimed.includes(lvl)) return false
    return level >= lvl && lvl >= 1 && lvl <= PASS_MAX_LEVEL
  }, [claimed, level])

  const nextReward = (() => {
    const nextLvl = level + 1
    if (nextLvl > PASS_MAX_LEVEL) return null
    return getPassRewards(nextLvl)
  })()

  const claimableRewards = PASS_REWARDS.filter(r => r.level <= level && !claimed.includes(r.level))

  return {
    xp,
    level,
    claimed,
    progress,
    canClaim,
    claimReward,
    claimableRewards,
    nextReward,
    addXp,
    addFightXp,
    addForgeXp,
    addIdleClaimXp,
    xpPerFight: PASS_XP_PER_FIGHT,
    xpPerForge: PASS_XP_PER_FORGE,
    xpPerIdleClaim: PASS_XP_PER_IDLE_CLAIM,
    xpPerLevel: PASS_XP_PER_LEVEL,
    maxLevel: PASS_MAX_LEVEL,
  }
}
