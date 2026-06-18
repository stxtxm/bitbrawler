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
}

interface UseIdleCombatReturn {
  combatLog: IdleCombatEntry[]
  currentMonster: MonsterId | null
  isDead: boolean
  idleHp: number
  idleMaxHp: number
  idleXpGained: number
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  scenePhase: ScenePhase
  resume: () => void
  idleFightsCount: number
  offlineGains: { fights: number; xp: number } | null
  clearOfflineGains: () => void
}

export function useIdleCombat({
  character,
  isPaused,
  onCharacterUpdate,
}: UseIdleCombatOptions): UseIdleCombatReturn {
  const [combatLog, setCombatLog] = useState<IdleCombatEntry[]>([])
  const [currentMonster, setCurrentMonster] = useState<MonsterId | null>(null)
  const [isDead, setIsDead] = useState(false)
  const [idleHp, setIdleHp] = useState(character?.maxHp ?? 100)
  const [idleMaxHp] = useState(character?.maxHp ?? 100)
  const [idleXpGained, setIdleXpGained] = useState(0)
  const [lastCombatResult, setLastCombatResult] = useState<'win' | 'lose' | null>(null)
  const [lastCombatXp, setLastCombatXp] = useState(0)
  const [scenePhase, setScenePhase] = useState<ScenePhase>('running')
  const [offlineGains, setOfflineGains] = useState<{ fights: number; xp: number } | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(isPaused)
  const charRef = useRef(character)
  const idleHpRef = useRef(idleHp)
  const isDeadRef = useRef(isDead)
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  isPausedRef.current = isPaused || !character
  charRef.current = character ?? charRef.current
  idleHpRef.current = idleHp
  isDeadRef.current = isDead

  const saveTimestamp = useCallback(() => {
    try {
      localStorage.setItem(IDLE_LAST_KEY, String(Date.now()))
    } catch {
      // localStorage might be unavailable
    }
  }, [])

  // Offline gains on mount
  useEffect(() => {
    try {
      if (!character) return
      const lastTimestamp = Number(localStorage.getItem(IDLE_LAST_KEY) || '0')
      if (lastTimestamp <= 0) return

      const fights = calculateOfflineFights(lastTimestamp, Date.now())
      if (fights <= 0) return

      let currentChar = character
      let totalXp = 0
      let hp = character.maxHp
      let died = false

      for (let i = 0; i < fights; i++) {
        if (hp <= 0) { died = true; break }
        const { character: monster } = generateMonsterForPlayer(currentChar.level)
        const result = simulateCombat(currentChar, monster)
        const won = result.winner === 'attacker'
        const idleXp = calculateIdleXp(won, currentChar.level)

        totalXp += idleXp

        const xpResult = gainXp(currentChar, idleXp)
        currentChar = xpResult.updatedCharacter

        const lastTimeline = result.timeline[result.timeline.length - 1]
        if (lastTimeline) {
          const dmg = won ? monster.maxHp - lastTimeline.defenderHp : currentChar.maxHp - lastTimeline.attackerHp
          hp -= dmg
        } else {
          hp -= 10
        }
      }

      setIdleHp(Math.max(0, hp))
      setIsDead(hp <= 0 || died)
      onCharacterUpdate(currentChar)

      if (totalXp > 0) {
        setOfflineGains({ fights, xp: totalXp })
        setIdleXpGained(totalXp)
      }
    } catch (err) {
      console.error('Offline gains calculation failed:', err)
    }

    saveTimestamp()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clearOfflineGains = useCallback(() => {
    setOfflineGains(null)
  }, [])

  const runCombatTick = useCallback(() => {
    if (isDeadRef.current || isPausedRef.current) return

    const currentChar = charRef.current
    if (!currentChar) return
    const hp = idleHpRef.current
    if (hp <= 0) {
      setIsDead(true)
      return
    }

    // Générer monstre
    let monster
    try {
      monster = generateMonsterForPlayer(currentChar.level)
    } catch {
      return
    }

    setCurrentMonster(monster.def.id)
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

      const lastTimeline = result.timeline[result.timeline.length - 1]
      let damageTaken = 0
      if (lastTimeline) {
        damageTaken = won
          ? monster.character.maxHp - lastTimeline.defenderHp
          : (currentChar.maxHp - lastTimeline.attackerHp)
      } else {
        damageTaken = won ? 5 : 15
      }

      const newHp = Math.max(0, idleHpRef.current - damageTaken)
      idleHpRef.current = newHp
      setIdleHp(newHp)

      // Appliquer XP
      const xpResult = gainXp(currentChar, idleXp)
      onCharacterUpdate(xpResult.updatedCharacter)

      // Log
      const entry: IdleCombatEntry = {
        timestamp: Date.now(),
        monsterId: monster.def.id,
        monsterName: monster.def.name,
        won,
        xpGained: idleXp,
        damageTaken,
      }

      setCombatLog(prev => [...prev, entry])

      // Vérifier mort
      if (newHp <= 0) {
        setIsDead(true)
        setScenePhase('running')
        return
      }
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

  // Timer principal
  useEffect(() => {
    if (isPaused || isDead) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(runCombatTick, IDLE_CONFIG.TIMER_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPaused, isDead, runCombatTick])

  // Visibility change → save timestamp
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveTimestamp()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [saveTimestamp])

  // Save on unmount
  useEffect(() => {
    return () => {
      saveTimestamp()
      phaseTimers.current.forEach(t => clearTimeout(t))
    }
  }, [saveTimestamp])

  const resume = useCallback(() => {
    const maxHp = charRef.current?.maxHp ?? 100
    setIsDead(false)
    idleHpRef.current = maxHp
    setIdleHp(maxHp)
    setScenePhase('running')
    setCurrentMonster(null)
    setLastCombatResult(null)
    setLastCombatXp(0)
    saveTimestamp()
  }, [saveTimestamp])

  return {
    combatLog,
    currentMonster,
    isDead,
    idleHp,
    idleMaxHp,
    idleXpGained,
    lastCombatResult,
    lastCombatXp,
    scenePhase,
    resume,
    idleFightsCount: combatLog.length,
    offlineGains,
    clearOfflineGains,
  }
}
