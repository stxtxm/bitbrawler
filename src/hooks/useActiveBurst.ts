import { useCallback, useEffect, useMemo, useState } from 'react'
import { BURST_MUTATORS, isBurstActive, isIdlePaused, logDepthToIdleRatio, applyBurstMutator, type BurstMutatorId } from '../data/liveOps'
import { GAME_RULES } from '../config/gameRules'

export function useActiveBurst() {
  const [selected, setSelected] = useState<BurstMutatorId | null>(null)
  const [depthCount, setDepthCount] = useState(0)
  const [idleCount, setIdleCount] = useState(0)

  const burstActive = useMemo(() => isBurstActive(new Date()), [])
  const idlePaused = useMemo(() => isIdlePaused(new Date()), [])
  const effectiveMaxFights = burstActive ? GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1 : GAME_RULES.COMBAT.MAX_DAILY_FIGHTS

  useEffect(() => {
    if (!burstActive) return
    const id = setInterval(() => {
      logDepthToIdleRatio(depthCount, idleCount, new Date())
    }, 30000)
    logDepthToIdleRatio(depthCount, idleCount, new Date())
    return () => clearInterval(id)
  }, [burstActive, depthCount, idleCount])

  const draftOptions = BURST_MUTATORS

  const selectMutator = useCallback((id: BurstMutatorId) => {
    setSelected(id)
  }, [])

  const consumeMutator = useCallback(() => {
    const cur = selected
    setSelected(null)
    return cur
  }, [selected])

  const applyToStats = useCallback((base: { offense: number; defense: number; xp: number }) => {
    if (!burstActive || !selected) return base
    return applyBurstMutator(base, selected)
  }, [burstActive, selected])

  const recordDepth = useCallback(() => setDepthCount(c => c + 1), [])
  const recordIdle = useCallback(() => setIdleCount(c => c + 1), [])

  return {
    burstActive,
    idlePaused,
    effectiveMaxFights,
    draftOptions,
    selected,
    selectMutator,
    consumeMutator,
    applyToStats,
    recordDepth,
    recordIdle,
  }
}
