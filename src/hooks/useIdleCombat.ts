import { useState, useEffect, useRef, useCallback } from 'react'
import { Character } from '../types/Character'
import { IdleCombatEntry, ScenePhase, IdleEfficiencyData } from '../types/IdleCombat'
import { IDLE_CONFIG } from '../config/idleConfig'
import { generateMonsterForPlayer } from '../utils/monsterUtils'
import { simulateCombat, calculateCombatStats } from '../utils/combatUtils'
import { gainXp } from '../utils/xpUtils'
import { GAME_RULES } from '../config/gameRules'
import { calculateIdleXp } from '../utils/idleXpUtils'
import { applyEquipmentToCharacter } from '../utils/equipmentUtils'
import {
  computeEfficiency,
  computeDisplayData,
  calculateOfflineFightsWithEfficiency,
} from '../utils/idleEfficiencyUtils'
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
  offlineGains: { fights: number; xp: number; levels: number } | null
  clearOfflineGains: () => void
  currentStreak: number
  totalKills: number
  idleTotalXp: number
  efficiencyData: IdleEfficiencyData | null
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
  const [offlineGains, setOfflineGains] = useState<{ fights: number; xp: number; levels: number } | null>(null)
  const [currentStreak, setCurrentStreak] = useState(character?.idleStreak ?? 0)
  const [totalKills, setTotalKills] = useState(character?.idleTotalKills ?? 0)
  const [idleTotalXp, setIdleTotalXp] = useState(character?.idleTotalXp ?? 0)
  const [efficiencyData, setEfficiencyData] = useState<IdleEfficiencyData | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPausedRef = useRef(isPaused)
  const charRef = useRef(character)
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const streakRef = useRef(currentStreak)
  const killsRef = useRef(totalKills)
  const idleXpRef = useRef(idleTotalXp)
  const effIntervalRef = useRef<number>(IDLE_CONFIG.TIMER_INTERVAL)
  const xpBonusRef = useRef<number>(0)

  isPausedRef.current = isPaused || !character
  charRef.current = character ?? charRef.current
  streakRef.current = currentStreak
  killsRef.current = totalKills
  idleXpRef.current = idleTotalXp

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach(t => clearTimeout(t))
    phaseTimers.current = []
  }, [])

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

      // Calculate effective interval for offline gains based on current stats
      const sampleMonster = generateMonsterForPlayer(charRef.current.level)
      const effectiveChar = applyEquipmentToCharacter(charRef.current)
      const playerStats = calculateCombatStats(charRef.current)
      const monsterStats = calculateCombatStats(sampleMonster.character)
      const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
      const effectiveInterval = eff.effectiveInterval

      const fights = calculateOfflineFightsWithEfficiency(lastTimestamp, Date.now(), effectiveInterval)
      if (fights <= 0) return

      let currentChar = charRef.current
      let totalXp = 0
      let totalLevels = 0
      let localStreak = streakRef.current
      let localKills = killsRef.current
      let localIdleXp = idleXpRef.current

      for (let i = 0; i < fights; i++) {
        const { character: monster } = generateMonsterForPlayer(currentChar.level)
        const result = simulateCombat(currentChar, monster)
        const won = result.winner === 'attacker'
        const xpBonus = 1 + computeEfficiency(
          calculateCombatStats(currentChar),
          calculateCombatStats(monster),
          currentChar.dexterity,
        ).xpBonusMultiplier - 1
        const idleXp = Math.floor(calculateIdleXp(won, currentChar.level) * (1 + xpBonus))
        const streakBonus = Math.min(localStreak * IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_PER_STEP, IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_CAP)
        const finalXp = Math.floor(idleXp * (1 + streakBonus))

        totalXp += finalXp
        localIdleXp += finalXp
        if (won) {
          localStreak++
          localKills++
        } else {
          localStreak = 0
        }

        const xpResult = gainXp(currentChar, finalXp)
        totalLevels += xpResult.levelsGained
        currentChar = {
          ...xpResult.updatedCharacter,
          idleStreak: localStreak,
          idleMaxStreak: Math.max(localStreak, (currentChar.idleMaxStreak ?? 0)),
          idleTotalKills: localKills,
          idleTotalXp: localIdleXp,
          statPoints: (xpResult.updatedCharacter.statPoints || 0) + xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL,
        }
      }

      onCharacterUpdate(currentChar)
      onSyncCharacter?.(currentChar)

      setCurrentStreak(localStreak)
      setTotalKills(localKills)
      setIdleTotalXp(localIdleXp)

      if (totalXp > 0) {
        setOfflineGains({ fights, xp: totalXp, levels: totalLevels })
        setIdleXpGained(prev => prev + totalXp)
      }
    } catch (err) {
      console.error('Offline gains calculation failed:', err)
    }

    saveTimestamp()
  }, [onCharacterUpdate, onSyncCharacter, saveTimestamp])

  // Offline gains on mount
  useEffect(() => {
    processOfflineGains()
  }, [processOfflineGains])

  // Also process offline gains once character becomes available (async load)
  useEffect(() => {
    if (character) {
      processOfflineGains()
    }
  }, [character, processOfflineGains])

  // Compute stable efficiency data based on player stats (not per-combat monster).
  // Only changes when level or equipment changes — giving a stable XP/min display.
  useEffect(() => {
    if (!character) return
    const effectiveChar = applyEquipmentToCharacter(character)
    const playerStats = calculateCombatStats(character)
    const refMonster = generateMonsterForPlayer(character.level)
    const monsterStats = calculateCombatStats(refMonster.character)
    const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
    effIntervalRef.current = eff.effectiveInterval
    xpBonusRef.current = eff.xpBonusMultiplier
    const avgXp = calculateIdleXp(true, character.level)
    const display = computeDisplayData(eff.effectiveInterval, avgXp, streakRef.current, killsRef.current)
    setEfficiencyData({
      powerRatio: eff.powerRatio,
      efficiency: eff.efficiency,
      effectiveInterval: eff.effectiveInterval,
      xpPerMinute: display.xpPerMinute,
      streakBonus: display.streakBonus,
      streakMilestone: display.streakMilestone,
    })
  }, [character?.level, character?.equippedItems, character?.strength, character?.dexterity, character?.vitality, character?.luck, character?.intelligence])

  const clearOfflineGains = useCallback(() => {
    setOfflineGains(null)
  }, [])

  const runCombatTick = useCallback(() => {
    if (isPausedRef.current) return

    clearPhaseTimers()

    const currentChar = charRef.current
    if (!currentChar) return

    // Generate monster
    let monster
    try {
      monster = generateMonsterForPlayer(currentChar.level)
    } catch {
      return
    }

    setCurrentMonster(monster.def.id)
    setBackgroundMonster(monster.def.id)
    setScenePhase('monster_appears')

    const t1 = setTimeout(() => {
      setScenePhase('combat')

      const result = simulateCombat(currentChar, monster.character)
      const won = result.winner === 'attacker'

      // Calculate XP with bonuses
      const baseXp = calculateIdleXp(won, currentChar.level)
      const xpBonus = xpBonusRef.current - 1
      const streakBonus = Math.min(
        streakRef.current * IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_PER_STEP,
        IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_CAP,
      )
      const finalXp = Math.floor(baseXp * (1 + xpBonus) * (1 + streakBonus))

      setLastCombatResult(won ? 'win' : 'lose')
      setLastCombatXp(finalXp)
      setIdleXpGained(prev => prev + finalXp)

      // Update streak and kill counters
      let newStreak = streakRef.current
      let newKills = killsRef.current
      let newIdleXp = idleXpRef.current
      if (won) {
        newStreak++
        newKills++
      } else {
        newStreak = 0
      }
      newIdleXp += finalXp

      // Apply XP with updated idle stats
      const xpResult = gainXp(currentChar, finalXp)
      const updatedChar: Character = {
        ...xpResult.updatedCharacter,
        idleStreak: newStreak,
        idleMaxStreak: Math.max(newStreak, (currentChar.idleMaxStreak ?? 0)),
        idleTotalKills: newKills,
        idleTotalXp: newIdleXp,
        statPoints: (xpResult.updatedCharacter.statPoints || 0) + xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL,
      }
      onCharacterUpdate(updatedChar)
      onSyncCharacter?.(updatedChar)

      setCurrentStreak(newStreak)
      setTotalKills(newKills)
      setIdleTotalXp(newIdleXp)

      // Log
      const entry: IdleCombatEntry = {
        timestamp: Date.now(),
        monsterId: monster.def.id,
        monsterName: monster.def.name,
        won,
        xpGained: finalXp,
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
  }, [onCharacterUpdate, onSyncCharacter, saveTimestamp, clearPhaseTimers])

  // Trigger first combat immediately, then repeat on dynamic interval
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const tickLoop = () => {
      runCombatTick()
      // Schedule next tick with latest effective interval
      if (!isPausedRef.current) {
        const delay = effIntervalRef.current
        timerRef.current = setTimeout(tickLoop, delay)
      }
    }

    const firstTick = setTimeout(tickLoop, 1500)

    return () => {
      clearTimeout(firstTick)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
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
      clearPhaseTimers()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [saveTimestamp, clearPhaseTimers])

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
    currentStreak,
    totalKills,
    idleTotalXp,
    efficiencyData,
  }
}
