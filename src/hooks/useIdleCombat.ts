import { useState, useEffect, useRef, useCallback } from 'react'
import { Character } from '../types/Character'
import { IdleCombatEntry, ScenePhase } from '../types/IdleCombat'
import { IDLE_CONFIG } from '../config/idleConfig'
import { generateMonsterForPlayer } from '../utils/monsterUtils'
import { simulateCombat } from '../utils/combatUtils'
import { gainXp } from '../utils/xpUtils'
import { calculateIdleXp, calculateOfflineFights } from '../utils/idleXpUtils'
import { MonsterId } from '../data/monsterAssets'
const IDLE_LAST_KEY = 'bitbrawler_idle_last'

interface UseIdleCombatOptions {
  character: Character | null
  isPaused: boolean
  onCharacterUpdate: (char: Character) => void
  onSyncCharacter?: (char: Character) => void
}

interface UseIdleCombatReturn {
  combatLog: IdleCombatEntry[]
  currentMonster: MonsterId | null
  backgroundMonster: MonsterId | null
  idleXpGained: number
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  scenePhase: ScenePhase
  idleFightsCount: number
  offlineGains: { fights: number; xp: number } | null
  clearOfflineGains: () => void
}

export function useIdleCombat({
  character,
  isPaused,
  onCharacterUpdate,
  onSyncCharacter,
}: UseIdleCombatOptions): UseIdleCombatReturn {
  const [combatLog, setCombatLog] = useState<IdleCombatEntry[]>([])
  const [currentMonster, setCurrentMonster] = useState<MonsterId | null>(null)
  const [backgroundMonster, setBackgroundMonster] = useState<MonsterId | null>(null)
  const [idleXpGained, setIdleXpGained] = useState(0)
  const [lastCombatResult, setLastCombatResult] = useState<'win' | 'lose' | null>(null)
  const [lastCombatXp, setLastCombatXp] = useState(0)
  const [scenePhase, setScenePhase] = useState<ScenePhase>('running')
  const [offlineGains, setOfflineGains] = useState<{ fights: number; xp: number } | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(isPaused)
  const charRef = useRef(character)
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  isPausedRef.current = isPaused || !character
  charRef.current = character ?? charRef.current

  const saveTimestamp = useCallback(() => {
    try {
      localStorage.setItem(IDLE_LAST_KEY, String(Date.now()))
    } catch {
      // localStorage might be unavailable
    }
  }, [])

  const processOfflineGains = useCallback(() => {
    if (!charRef.current) return
    try {
      const lastTimestamp = Number(localStorage.getItem(IDLE_LAST_KEY) || '0')
      if (lastTimestamp <= 0) return

      const fights = calculateOfflineFights(lastTimestamp, Date.now())
      if (fights <= 0) return

      let currentChar = charRef.current
      let totalXp = 0

      for (let i = 0; i < fights; i++) {
        const { character: monster } = generateMonsterForPlayer(currentChar.level)
        const result = simulateCombat(currentChar, monster)
        const won = result.winner === 'attacker'
        const idleXp = calculateIdleXp(won, currentChar.level)

        totalXp += idleXp

        const xpResult = gainXp(currentChar, idleXp)
        currentChar = xpResult.updatedCharacter
      }

      onCharacterUpdate(currentChar)
      onSyncCharacter?.(currentChar)

      if (totalXp > 0) {
        setOfflineGains({ fights, xp: totalXp })
        setIdleXpGained(prev => prev + totalXp)
      }
    } catch (err) {
      console.error('Offline gains calculation failed:', err)
    }

    saveTimestamp()
  }, [onCharacterUpdate, saveTimestamp])

  // Offline gains on mount
  useEffect(() => {
    processOfflineGains()
  }, [processOfflineGains])

  const clearOfflineGains = useCallback(() => {
    setOfflineGains(null)
  }, [])

  const runCombatTick = useCallback(() => {
    if (isPausedRef.current) return

    const currentChar = charRef.current
    if (!currentChar) return

    // Générer monstre
    let monster
    try {
      monster = generateMonsterForPlayer(currentChar.level)
    } catch {
      return
    }

    setCurrentMonster(monster.def.id)
    setBackgroundMonster(monster.def.id)
    setScenePhase('monster_appears')

    // Phase monster_appears → combat → result
    const t1 = setTimeout(() => {
      setScenePhase('combat')

      const result = simulateCombat(currentChar, monster.character)
      const won = result.winner === 'attacker'
      const idleXp = calculateIdleXp(won, currentChar.level)

      setLastCombatResult(won ? 'win' : 'lose')
      setLastCombatXp(idleXp)
      setIdleXpGained(prev => prev + idleXp)

      // Appliquer XP (no death, no damage)
      const xpResult = gainXp(currentChar, idleXp)
      onCharacterUpdate(xpResult.updatedCharacter)
      onSyncCharacter?.(xpResult.updatedCharacter)

      // Log
      const entry: IdleCombatEntry = {
        timestamp: Date.now(),
        monsterId: monster.def.id,
        monsterName: monster.def.name,
        won,
        xpGained: idleXp,
        damageTaken: 0,
      }

      setCombatLog(prev => [...prev, entry])
    }, IDLE_CONFIG.MONSTER_APPEAR_DURATION)

    const t2 = setTimeout(() => {
      setScenePhase('result')
    }, IDLE_CONFIG.MONSTER_APPEAR_DURATION + IDLE_CONFIG.COMBAT_DURATION)

    const t3 = setTimeout(() => {
      setCurrentMonster(null)
      setScenePhase('running')
      saveTimestamp()
    }, IDLE_CONFIG.MONSTER_APPEAR_DURATION + IDLE_CONFIG.COMBAT_DURATION + IDLE_CONFIG.RESULT_DURATION)

    phaseTimers.current = [t1, t2, t3]
  }, [onCharacterUpdate, saveTimestamp])

  // Trigger first combat immediately, then repeat on interval
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // First combat after scene renders
    const firstTick = setTimeout(runCombatTick, 1500)
    timerRef.current = setInterval(runCombatTick, IDLE_CONFIG.TIMER_INTERVAL)

    return () => {
      clearTimeout(firstTick)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPaused, runCombatTick])

  // Visibility change → save timestamp when hidden, process gains when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveTimestamp()
      } else if (document.visibilityState === 'visible') {
        processOfflineGains()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [saveTimestamp, processOfflineGains])

  // Save on unmount
  useEffect(() => {
    return () => {
      saveTimestamp()
      phaseTimers.current.forEach(t => clearTimeout(t))
    }
  }, [saveTimestamp])

  return {
    combatLog,
    currentMonster,
    backgroundMonster,
    idleXpGained,
    lastCombatResult,
    lastCombatXp,
    scenePhase,
    idleFightsCount: combatLog.length,
    offlineGains,
    clearOfflineGains,
  }
}
