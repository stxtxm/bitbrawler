import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Character } from '../types/Character'
import { MonsterId } from '../data/monsterAssets'
import { ScenePhase } from '../types/IdleCombat'
import { AnimatedPixelCharacter } from './AnimatedPixelCharacter'
import { PixelMonster } from './PixelMonster'
import { ParticleSystem } from '../utils/particleSystem'
import { useLowPerformanceMode } from '../hooks/useLowPerformanceMode'

interface OfflineGainsData {
  fights: number
  xp: number
  levels: number
  essence: number
  timeAway: number
}

interface IdleRunnerSceneProps {
  character: Character
  currentMonster: MonsterId | null
  scenePhase: ScenePhase
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  offlineGains: OfflineGainsData | null
  onClearOfflineGains: () => void
  currentStreak?: number
  streakMilestone?: number | null
  efficiency?: number | null
  xpPerMinute?: number | null
  powerRatio?: number | null
}

function formatTimeAway(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function randomDamage(playerLevel: number): { value: number; isCrit: boolean } {
  const base = 5 + playerLevel * 2
  const variance = Math.floor(base * (0.5 + Math.random() * 1.0))
  const isCrit = Math.random() < 0.15
  return { value: isCrit ? variance * 2 : variance, isCrit }
}

export const IdleRunnerScene = memo(function IdleRunnerScene({
  character,
  currentMonster,
  scenePhase,
  lastCombatResult,
  lastCombatXp,
  offlineGains,
  onClearOfflineGains,
  currentStreak = 0,
  streakMilestone = null,
  efficiency = null,
  xpPerMinute = null,
  powerRatio = null,
}: IdleRunnerSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<ParticleSystem | null>(null)
  const [animFrame, setAnimFrame] = useState(0)
  const lowPerf = useLowPerformanceMode()
  const prevPhaseRef = useRef<ScenePhase>('running')
  const characterLevelRef = useRef(character.level)
  characterLevelRef.current = character.level

  const charScale = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 768
    if (w < 480) return 6
    if (w < 768) return 7
    return 8
  }, [])
  const monsterScale = useMemo(() => Math.max(3, charScale - 2), [charScale])

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimFrame(prev => prev + 1)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const ps = new ParticleSystem(lowPerf ? 20 : 60)
    ps.mount(containerRef.current)
    particlesRef.current = ps

    return () => {
      ps.destroy()
      particlesRef.current = null
    }
  }, [lowPerf])

  useEffect(() => {
    const ps = particlesRef.current
    const container = containerRef.current
    if (!ps || !container) return

    const rect = container.getBoundingClientRect()
    const cx = rect.width * 0.3
    const cy = rect.height * 0.55

    if (scenePhase === 'combat' && prevPhaseRef.current === 'monster_appears') {
      ps.emit('spark', cx, cy, lowPerf ? 2 : 6)
      ps.emit('hit_ring', cx - 20, cy, lowPerf ? 4 : 12)
      if (!lowPerf) ps.emit('dust', cx, cy + 30, 2)

      const simulatedDmg = randomDamage(characterLevelRef.current)
      if (simulatedDmg.value > 0) ps.emit('damage', cx, cy, 1, simulatedDmg.value)
      if (simulatedDmg.isCrit) ps.emit('crit', cx, cy, 1)
    }

    if (scenePhase === 'result' && lastCombatResult) {
      ps.emit('xp_star', cx, cy - 20, lowPerf ? 1 : 3)
    }

    prevPhaseRef.current = scenePhase
  }, [scenePhase, lastCombatResult, lowPerf])

  const characterState = scenePhase === 'combat' ? 'attacking' : 'running'
  const showBigXp = scenePhase === 'result' && lastCombatXp > 0
  const showStreakBanner = streakMilestone !== null && scenePhase === 'result' && lastCombatResult === 'win'

  return (
    <div className="idle-runner-box" ref={containerRef}>
      {/* clouds rendered inside ProceduralTerrain canvas */}

      <div className={`idle-character-slot ${scenePhase === 'combat' ? 'attacking' : ''} ${scenePhase === 'result' && lastCombatResult === 'win' ? 'victory' : ''}`}>
        <AnimatedPixelCharacter
          seed={character.seed}
          gender={character.gender}
          scale={charScale}
          state={characterState}
          frame={animFrame}
        />
      </div>

      {currentMonster && (
        <div className={`idle-monster-slot phase-${scenePhase}`} data-monster={currentMonster}>
          <PixelMonster monsterId={currentMonster} scale={monsterScale} />
          {scenePhase === 'combat' && <div className="combat-flash" />}
        </div>
      )}

      {showBigXp && (
        <div className={`idle-big-xp ${lastCombatResult}`}>
          <span className="big-xp-value">+{lastCombatXp} XP</span>
          {lastCombatResult === 'win' && <span className="big-xp-label">VICTORY</span>}
        </div>
      )}

      {showStreakBanner && (
        <div className="idle-streak-banner">
          <span className="streak-fire">🔥</span>
          <span className="streak-text">{streakMilestone} WIN STREAK!</span>
          <span className="streak-fire">🔥</span>
        </div>
      )}

      {scenePhase === 'running' && currentStreak >= 5 && (
        <div className="idle-streak-indicator">
          <span>🔥</span>
          <span>{currentStreak}</span>
        </div>
      )}

      {scenePhase === 'running' && xpPerMinute != null && (
        <div className="idle-efficiency-overlay">
          <span className="eff-xp-rate">⚡ ~{xpPerMinute} XP/min</span>
          {efficiency != null && efficiency > 1 && (
            <span className="eff-multiplier">{efficiency.toFixed(1)}x EFF</span>
          )}
          {powerRatio != null && powerRatio > 1 && (
            <span className="eff-power">⚔ {powerRatio.toFixed(1)}x PWR</span>
          )}
        </div>
      )}

      {offlineGains && (
        <div className="idle-offline-notification">
          <div className="offline-glow" />
          <div className="offline-title">
            <span className="offline-title-icon">⚔</span>
            WELCOME BACK!
            <span className="offline-title-icon">⚔</span>
          </div>
          <div className="offline-subtitle">
            Your brawler trained while you were away
          </div>
          <div className="offline-time">
            ⏰ {formatTimeAway(offlineGains.timeAway)}
          </div>
          <div className="offline-stats">
            <div className="offline-stat-item">
              <span className="offline-stat-value">+{offlineGains.xp}</span>
              <span className="offline-stat-label">XP</span>
            </div>
            {offlineGains.essence > 0 && (
              <div className="offline-stat-item">
                <span className="offline-stat-value essence">⚡+{offlineGains.essence}</span>
                <span className="offline-stat-label">Essence</span>
              </div>
            )}
            <div className="offline-stat-item">
              <span className="offline-stat-value">{offlineGains.fights}</span>
              <span className="offline-stat-label">Fights</span>
            </div>
            {offlineGains.levels > 0 && (
              <div className="offline-stat-item">
                <span className="offline-stat-value levels">⬆+{offlineGains.levels}</span>
                <span className="offline-stat-label">Levels</span>
              </div>
            )}
          </div>
          <button className="offline-claim-btn" onClick={onClearOfflineGains}>
            CLAIM REWARDS
          </button>
        </div>
      )}
    </div>
  )
})

