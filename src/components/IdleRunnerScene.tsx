import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Character } from '../types/Character'
import { MonsterId } from '../data/monsterAssets'
import { ScenePhase } from '../types/IdleCombat'
import { AnimatedPixelCharacter } from './AnimatedPixelCharacter'
import { PixelMonster } from './PixelMonster'
import { ProceduralTerrain } from './procedural/ProceduralTerrain'
import {
  generateCloudPositions,
} from '../data/tileAssets'
import { ParticleSystem } from '../utils/particleSystem'
import { useLowPerformanceMode } from '../hooks/useLowPerformanceMode'

interface IdleRunnerSceneProps {
  character: Character
  currentMonster: MonsterId | null
  scenePhase: ScenePhase
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  offlineGains: { fights: number; xp: number; levels: number } | null
  onClearOfflineGains: () => void
  currentStreak?: number
  streakMilestone?: number | null
  efficiency?: number | null
  xpPerMinute?: number | null
  powerRatio?: number | null
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
  const clouds = useMemo(() => generateCloudPositions(character.seed), [character.seed])
  const containerStyle = useMemo(() => ({ background: 'transparent' }), []);

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
    <div className="idle-runner-box" ref={containerRef} style={containerStyle}>
      <ProceduralTerrain
        width={containerRef.current?.clientWidth || 800}
        height={containerRef.current?.clientHeight || 400}
        parallaxLayers={3}
        mobileQuality={lowPerf}
        seed={character.seed}
      />

      {!lowPerf && (
        <div className="idle-layer clouds">
          {clouds.map((cloud, i) => (
            <div key={i} className="cloud-instance" style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              ['--scale' as string]: cloud.scale,
              opacity: cloud.opacity,
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                cloud.type.pixels.map((row, y) =>
                  row.map((cell, x) => cell ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${cloud.type.palette[cell] || '#fff'}"/>` : '').join('')
                ).join('')
              )}")`,
            }} />
          ))}
        </div>
      )}

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
          <button className="idle-offline-close" onClick={onClearOfflineGains} aria-label="Dismiss">×</button>
          <div className="offline-title">WELCOME BACK!</div>
          <div className="offline-stats">
            <span>{offlineGains.fights} fights</span>
            <span>+{offlineGains.xp} XP</span>
            {offlineGains.levels > 0 && <span>⬆ +{offlineGains.levels} LVL</span>}
          </div>
        </div>
      )}
    </div>
  )
})

