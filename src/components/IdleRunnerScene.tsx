import { useEffect, useMemo, useRef, useState } from 'react'
import { Character } from '../types/Character'
import { MonsterId } from '../data/monsterAssets'
import { ScenePhase } from '../types/IdleCombat'
import { AnimatedPixelCharacter } from './AnimatedPixelCharacter'
import { PixelMonster } from './PixelMonster'
import {
  generateCloudPositions,
  renderTileAsCssUrl, getSkyGradient,
  GRASS_TILE, DIRT_TILE, MOUNTAIN_TILE,
} from '../data/tileAssets'
import { ParticleSystem } from '../utils/particleSystem'
import { useLowPerformanceMode } from '../hooks/useLowPerformanceMode'

interface FloatingDamage {
  id: number
  value: number
  x: number
  createdAt: number
}

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
}

function randomDamage(playerLevel: number): { value: number; isCrit: boolean } {
  const base = 5 + playerLevel * 2
  const variance = Math.floor(base * (0.5 + Math.random() * 1.0))
  const isCrit = Math.random() < 0.15
  return { value: isCrit ? variance * 2 : variance, isCrit }
}

export const IdleRunnerScene: React.FC<IdleRunnerSceneProps> = ({
  character,
  currentMonster, scenePhase, lastCombatResult, lastCombatXp,
  offlineGains, onClearOfflineGains,
  currentStreak = 0, streakMilestone = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<ParticleSystem | null>(null)
  const [animFrame, setAnimFrame] = useState(0)
  const lowPerf = useLowPerformanceMode()
  const prevPhaseRef = useRef<ScenePhase>('running')
  const [damageNumbers, setDamageNumbers] = useState<FloatingDamage[]>([])
  const dmgIdRef = useRef(0)

  const charScale = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 768
    if (w < 480) return 6
    if (w < 768) return 7
    return 8
  }, [])
  const monsterScale = useMemo(() => Math.max(3, charScale - 2), [charScale])

  const clouds = useMemo(() => generateCloudPositions(), [])
  const skyGradient = useMemo(() => getSkyGradient(), [])

  // Animation loop 12 FPS
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimFrame(prev => prev + 1)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  // Particle system
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

  // Emit particles on phase changes + spawn damage numbers
  useEffect(() => {
    const ps = particlesRef.current
    if (!ps || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = rect.width * 0.3
    const cy = rect.height * 0.55

    if (scenePhase === 'combat' && prevPhaseRef.current === 'monster_appears') {
      ps.emit('spark', cx, cy, lowPerf ? 2 : 6)
      ps.emit('hit_ring', cx - 20, cy, lowPerf ? 4 : 12)
      if (!lowPerf) ps.emit('dust', cx, cy + 30, 2)

      // Spawn floating damage numbers
      const count = lowPerf ? 2 : 4 + Math.floor(Math.random() * 3)
      const newDmgs: FloatingDamage[] = []
      for (let i = 0; i < count; i++) {
        const dmg = randomDamage(character.level)
        newDmgs.push({
          id: dmgIdRef.current++,
          value: dmg.value,
          x: 30 + (Math.random() - 0.5) * 40,
          createdAt: Date.now(),
        })
      }
      setDamageNumbers(prev => [...prev, ...newDmgs])

      // Remove after animation
      setTimeout(() => {
        setDamageNumbers([])
      }, 1200)
    }

    if (scenePhase === 'result' && lastCombatResult) {
      ps.emit('xp_star', cx, cy - 20, lowPerf ? 1 : 3)
    }

    prevPhaseRef.current = scenePhase
  }, [scenePhase, lastCombatResult, lowPerf, character.level])

  const characterState = scenePhase === 'combat' ? 'attacking' : 'running'

  const containerStyle: React.CSSProperties = {
    background: skyGradient,
  }

  const groundCss = useMemo(() => renderTileAsCssUrl(GRASS_TILE), [])
  const dirtCss = useMemo(() => renderTileAsCssUrl(DIRT_TILE), [])
  const mountainCss = useMemo(() => renderTileAsCssUrl(MOUNTAIN_TILE), [])

  const showBigXp = scenePhase === 'result' && lastCombatXp > 0
  const showStreakBanner = streakMilestone !== null && scenePhase === 'result' && lastCombatResult === 'win'

  return (
    <div className="idle-runner-box" ref={containerRef} style={containerStyle}>
      {/* Mountain layer (slow scroll) */}
      {!lowPerf && (
        <div className="idle-layer mountains" style={{ backgroundImage: mountainCss }}>
          <div className="idle-layer-inner scroll-slow" />
        </div>
      )}

      {/* Cloud layer */}
      {!lowPerf && (
        <div className="idle-layer clouds">
          {clouds.map((cloud, i) => (
            <div key={i} className="cloud-instance" style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              transform: `scaleX(${cloud.scale})`,
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

      {/* Character */}
      <div className={`idle-character-slot ${scenePhase === 'combat' ? 'attacking' : ''} ${scenePhase === 'result' && lastCombatResult === 'win' ? 'victory' : ''}`}>
        <AnimatedPixelCharacter
          seed={character.seed}
          gender={character.gender}
          scale={charScale}
          state={characterState}
          frame={animFrame}
        />
      </div>

      {/* Monster */}
      {currentMonster && (
        <div
          className={`idle-monster-slot phase-${scenePhase}`}
          data-monster={currentMonster}
        >
          <PixelMonster monsterId={currentMonster} scale={monsterScale} />
          {scenePhase === 'combat' && <div className="combat-flash" />}

          {/* Floating damage numbers */}
          {scenePhase === 'combat' && damageNumbers.map(d => (
            <div
              key={d.id}
              className="floating-damage"
              style={{
                left: `${d.x}%`,
                animationDelay: `${(d.id % 3) * 0.15}s`,
              }}
            >
              -{d.value}
            </div>
          ))}
        </div>
      )}

      {/* Big XP popup */}
      {showBigXp && (
        <div className={`idle-big-xp ${lastCombatResult}`}>
          <span className="big-xp-value">+{lastCombatXp} XP</span>
          {lastCombatResult === 'win' && <span className="big-xp-label">VICTORY</span>}
        </div>
      )}

      {/* Streak milestone banner */}
      {showStreakBanner && (
        <div className="idle-streak-banner">
          <span className="streak-fire">🔥</span>
          <span className="streak-text">{streakMilestone} WIN STREAK!</span>
          <span className="streak-fire">🔥</span>
        </div>
      )}

      {/* Persistent streak indicator (running phase) */}
      {scenePhase === 'running' && currentStreak >= 5 && (
        <div className="idle-streak-indicator">
          <span>🔥</span>
          <span>{currentStreak}</span>
        </div>
      )}

      {/* Ground layer */}
      <div className="idle-ground-layer" style={{ backgroundImage: `${groundCss}, ${dirtCss}` }}>
        <div className="idle-ground-inner scroll-fast" />
      </div>

      {/* Offline gains notification */}
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
}
