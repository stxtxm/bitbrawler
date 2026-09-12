export type BurstMutatorId = 'offense' | 'defense' | 'swift'

export interface BurstMutatorDef {
  id: BurstMutatorId
  label: string
  offenseMod: number
  defenseMod: number
  speedMod: number
}

export const BURST_MUTATORS: BurstMutatorDef[] = [
  { id: 'offense', label: '+10% offense / -10% defense', offenseMod: 1.1, defenseMod: 0.9, speedMod: 1 },
  { id: 'defense', label: '+10% defense / -10% offense', offenseMod: 0.9, defenseMod: 1.1, speedMod: 1 },
  { id: 'swift', label: '+10% speed / -10% defense', offenseMod: 1, defenseMod: 0.9, speedMod: 1.1 },
]

export const BURST_MUTATOR_STORAGE_KEY = 'bitbrawler_burst_mutator'

let memoryMutator: BurstMutatorId | null = null
let listeners: Array<(id: BurstMutatorId | null) => void> = []

try {
  const raw = localStorage.getItem(BURST_MUTATOR_STORAGE_KEY)
  if (raw) {
    const parsed = raw as BurstMutatorId
    if (BURST_MUTATORS.some(m => m.id === parsed)) memoryMutator = parsed
  }
} catch { /* ignore */ }

function persistMutator() {
  try {
    if (memoryMutator) localStorage.setItem(BURST_MUTATOR_STORAGE_KEY, memoryMutator)
    else localStorage.removeItem(BURST_MUTATOR_STORAGE_KEY)
  } catch { /* ignore */ }
}

function notifyListeners() {
  listeners.forEach(fn => fn(memoryMutator))
}

export function getStoredBurstMutator(): BurstMutatorId | null {
  return memoryMutator
}

export function setStoredBurstMutator(id: BurstMutatorId | null): void {
  if (id !== null && !BURST_MUTATORS.some(m => m.id === id)) return
  memoryMutator = id
  persistMutator()
  notifyListeners()
}

export function clearStoredBurstMutator(): void {
  memoryMutator = null
  persistMutator()
  notifyListeners()
}

export function getBurstMutatorDef(id: BurstMutatorId | null | undefined): BurstMutatorDef | null {
  if (!id) return null
  return BURST_MUTATORS.find(m => m.id === id) ?? null
}

export function getBurstMutatorStorageSnapshot(): BurstMutatorId | null {
  return memoryMutator
}

export function applyBurstMutatorToStats(
  stats: { offense: number; defense: number; speed: number },
  mutatorId: BurstMutatorId | null | undefined
): { offense: number; defense: number; speed: number } {
  const def = getBurstMutatorDef(mutatorId)
  if (!def) return stats
  return {
    offense: stats.offense * def.offenseMod,
    defense: stats.defense * def.defenseMod,
    speed: stats.speed * def.speedMod,
  }
}

import { useEffect, useState, useCallback } from 'react'

export function useBurstMutator() {
  const [mutator, setMutatorState] = useState<BurstMutatorId | null>(() => getStoredBurstMutator())
  useEffect(() => {
    const fn = (id: BurstMutatorId | null) => setMutatorState(id)
    listeners.push(fn)
    return () => {
      listeners = listeners.filter(f => f !== fn)
    }
  }, [])
  const setMutator = useCallback((id: BurstMutatorId | null) => {
    setStoredBurstMutator(id)
  }, [])
  const clearMutator = useCallback(() => {
    clearStoredBurstMutator()
  }, [])
  return { mutator, setMutator, clearMutator, defs: BURST_MUTATORS, activeDef: getBurstMutatorDef(mutator) }
}
