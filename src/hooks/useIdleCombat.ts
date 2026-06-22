import { useState, useEffect, useRef, useCallback } from 'react'
import { Character } from '../types/Character'
import { IdleCombatEntry, ScenePhase, IdleEfficiencyData } from '../types/IdleCombat'
import { IDLE_CONFIG } from '../config/idleConfig'
import { generateMonsterForPlayer, getReferenceMonster } from '../utils/monsterUtils'
import { simulateCombat, calculateCombatStats } from '../utils/combatUtils'
import { gainXp, getXpProgress } from '../utils/xpUtils'
import { GAME_RULES } from '../config/gameRules'
import { calculateIdleXp, calculateIdleEssence } from '../utils/idleXpUtils'
import { applyEquipmentToCharacter } from '../utils/equipmentUtils'
import {
  computeEfficiency,
  computeDisplayData,
  calculateNextLevelTime,
} from '../utils/idleEfficiencyUtils'
import { MonsterId } from '../data/monsterAssets'

interface UseIdleCombatOptions {
  character: Character | null
  isPaused: boolean
  onCharacterUpdate: (char: Character) => void
  onSyncCharacter?: (char: Character) => void
  onLevelUp?: (levelsGained: number, newLevel: number) => void
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
  offlineGains: { fights: number; xp: number; levels: number; essence: number; timeAway: number } | null
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
  onLevelUp,
}: UseIdleCombatOptions): UseIdleCombatReturn {
  const [combatLog, setCombatLog] = useState<IdleCombatEntry[]>([])
  const [currentMonster, setCurrentMonster] = useState<MonsterId | null>(null)
  const [backgroundMonster, setBackgroundMonster] = useState<MonsterId | null>(null)
  const [idleXpGained, setIdleXpGained] = useState(0)
  const [lastCombatResult, setLastCombatResult] = useState<'win' | 'lose' | null>(null)
  const [lastCombatXp, setLastCombatXp] = useState(0)
  const [scenePhase, setScenePhase] = useState<ScenePhase>('running')
  const [offlineGains, setOfflineGains] = useState<{ fights: number; xp: number; levels: number; essence: number; timeAway: number } | null>(null)
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
  const essenceFracRef = useRef<number>(0)

  isPausedRef.current = isPaused || !character
  charRef.current = character ?? charRef.current
  streakRef.current = currentStreak
  killsRef.current = totalKills
  idleXpRef.current = idleTotalXp

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach(t => clearTimeout(t))
    phaseTimers.current = []
  }, [])

  // Advance idle/lastActive watermarks and sync to Supabase.
  // Called after each combat tick (both local + server sync).
  const syncWatermarks = useCallback(() => {
    const currentChar = charRef.current
    if (!currentChar) return
    const now = Date.now()
    const updated: Character = {
      ...currentChar,
      lastIdleCheck: now,
      lastActive: now,
    }
    if (onCharacterUpdate) onCharacterUpdate(updated)
    onSyncCharacter?.(updated)
  }, [onCharacterUpdate, onSyncCharacter])

  // On-demand idle processing: call server to persist gains and show popup.
  // No local preview to avoid popup flicker — server response is fast (< 1s).
  useEffect(() => {
    if (!character) return
    const lastActive = character.lastActive ?? 0
    if (lastActive <= 0) return
    const idleMs = Date.now() - lastActive
    if (idleMs <= 30_000) return

    let cancelled = false

    const processOnServer = async () => {
      try {
        const res = await fetch('/api/idle-processor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: character.id }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (data.fights > 0) {
          if (data.updated) {
            const updatedChar: Character = {
              ...character,
              ...data.updated,
              lastIdleCheck: Date.now(),
              lastActive: Date.now(),
            }
            onCharacterUpdate(updatedChar)
          }
          const serverEssence = data.essence ?? 0
          const timeAway = Date.now() - lastActive
          setOfflineGains({
            fights: data.fights,
            xp: data.xp,
            levels: data.levels,
            essence: serverEssence,
            timeAway,
          })
        }
      } catch {
        // server unreachable — silently ignore, popup won't appear but idle persists on cron
      }
    }

    processOnServer()

    return () => { cancelled = true }
  }, [character?.id, character?.lastActive, onCharacterUpdate])

  // Compute stable efficiency data — recalculates when character changes (level, stats, equip).
  useEffect(() => {
    if (!character) return
    const effectiveChar = applyEquipmentToCharacter(character)
    const playerStats = calculateCombatStats(effectiveChar)
    const refMonster = getReferenceMonster(effectiveChar.level)
    const monsterStats = calculateCombatStats(refMonster)
    const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
    effIntervalRef.current = eff.effectiveInterval
    xpBonusRef.current = eff.xpBonusMultiplier
    const avgXp = calculateIdleXp(true, effectiveChar.level)
    const avgEssencePerKill = calculateIdleEssence(true, effectiveChar.level) * eff.xpBonusMultiplier
    const fightsPerMinute = 60000 / eff.effectiveInterval
    const essencePerMinute = Math.round(avgEssencePerKill * fightsPerMinute * 100) / 100
    const display = computeDisplayData(eff.effectiveInterval, avgXp, streakRef.current, killsRef.current)
    const nextLevelTime = character.level >= 99 ? null : (() => {
      const progress = getXpProgress(character)
      return calculateNextLevelTime(
        display.xpPerMinute,
        progress.currentXpInLevel,
        progress.xpForNextLevel,
      )
    })()
    setEfficiencyData({
      powerRatio: eff.powerRatio,
      efficiency: eff.efficiency,
      effectiveInterval: eff.effectiveInterval,
      xpPerMinute: display.xpPerMinute,
      essencePerMinute,
      streakBonus: display.streakBonus,
      streakMilestone: display.streakMilestone,
      nextLevelTime,
    })
  }, [character])

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

      // Accumulate essence per kill (scales with power ratio, like XP)
      const essenceGain = calculateIdleEssence(won, currentChar.level) * xpBonusRef.current
      essenceFracRef.current += essenceGain
      let essenceToAdd = 0
      if (essenceFracRef.current >= 1) {
        essenceToAdd = Math.floor(essenceFracRef.current)
        essenceFracRef.current -= essenceToAdd
      }

      // Apply XP with updated idle stats and watermarks
      const xpResult = gainXp(currentChar, finalXp)
      const now = Date.now()
      const updatedEssence = (currentChar.essence ?? 0) + essenceToAdd
      const updatedChar: Character = {
        ...xpResult.updatedCharacter,
        essence: updatedEssence,
        idleStreak: newStreak,
        idleMaxStreak: Math.max(newStreak, (currentChar.idleMaxStreak ?? 0)),
        idleTotalKills: newKills,
        idleTotalXp: newIdleXp,
        statPoints: (xpResult.updatedCharacter.statPoints || 0) + xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL,
        lastIdleCheck: now,
        lastActive: now,
      }
      onCharacterUpdate(updatedChar)
      onSyncCharacter?.(updatedChar)
      if (xpResult.levelsGained > 0) {
        onLevelUp?.(xpResult.levelsGained, updatedChar.level)
      }

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
      syncWatermarks()
    }, IDLE_CONFIG.MONSTER_APPEAR_DURATION + IDLE_CONFIG.COMBAT_DURATION + IDLE_CONFIG.RESULT_DURATION)

    phaseTimers.current = [t1, t2, t3]
  }, [onCharacterUpdate, onSyncCharacter, onLevelUp, syncWatermarks, clearPhaseTimers])

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

  // Visibility change → sync watermarks to server only (no local update —
  // avoids triggering dbAvailable=false on background sync failures).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const currentChar = charRef.current
        if (!currentChar) return
        const now = Date.now()
        onSyncCharacter?.({
          ...currentChar,
          lastIdleCheck: now,
          lastActive: now,
        } as Character)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [onSyncCharacter])

  // Sync watermarks to Supabase on unmount (no local state update, no lastActive
  // advance — keeps idle time intact for character switching).
  useEffect(() => {
    return () => {
      const currentChar = charRef.current
      if (currentChar) {
        onSyncCharacter?.({
          ...currentChar,
          lastIdleCheck: Date.now(),
        } as Character)
      }
      clearPhaseTimers()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [onSyncCharacter, clearPhaseTimers])

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
