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

interface IdleRunnerSceneProps {
  character: Character
  isDead: boolean
  idleHp: number
  idleMaxHp: number
  idleXpGained: number
  idleFightsCount: number
  currentMonster: MonsterId | null
  scenePhase: ScenePhase
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  onResume: () => void
  offlineGains: { fights: number; xp: number } | null
  onClearOfflineGains: () => void
}

export const IdleRunnerScene: React.FC<IdleRunnerSceneProps> = ({
  character, isDead, idleHp, idleMaxHp, idleXpGained, idleFightsCount,
  currentMonster, scenePhase, lastCombatResult, lastCombatXp,
  onResume, offlineGains, onClearOfflineGains,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<ParticleSystem | null>(null)
  const [animFrame, setAnimFrame] = useState(0)
  const lowPerf = useLowPerformanceMode()
  const prevPhaseRef = useRef<ScenePhase>('running')

  const clouds = useMemo(() => generateCloudPositions(), [])
  const skyGradient = useMemo(() => getSkyGradient(), [])

  // Animation loop 8 FPS
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimFrame(prev => prev + 1)
    }, 125)
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

  // Emit particles on phase changes
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
    }

    if (scenePhase === 'result' && lastCombatResult) {
      ps.emit('xp_star', cx, cy - 20, 1)
    }

    prevPhaseRef.current = scenePhase
  }, [scenePhase, lastCombatResult, lowPerf])

  const hpPercent = idleMaxHp > 0 ? (idleHp / idleMaxHp) * 100 : 0

  const characterState = isDead ? 'dead' : scenePhase === 'combat' ? 'attacking' : 'running'

  const containerStyle: React.CSSProperties = {
    background: skyGradient,
  }

  const groundCss = useMemo(() => renderTileAsCssUrl(GRASS_TILE), [])
  const dirtCss = useMemo(() => renderTileAsCssUrl(DIRT_TILE), [])
  const mountainCss = useMemo(() => renderTileAsCssUrl(MOUNTAIN_TILE), [])

  return (
    <div className="idle-runner-scene" ref={containerRef} style={containerStyle}>
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
          scale={4}
          state={characterState}
          frame={animFrame}
        />
      </div>

      {/* Monster */}
      {currentMonster && !isDead && (
        <div className={`idle-monster-slot phase-${scenePhase}`} data-monster={currentMonster}>
          <PixelMonster monsterId={currentMonster} scale={3} />
          {scenePhase === 'combat' && <div className="combat-flash" />}
        </div>
      )}

      {/* Combat result text */}
      {scenePhase === 'result' && lastCombatResult && !isDead && (
        <div className={`idle-combat-result ${lastCombatResult}`}>
          <span className="result-label">{lastCombatResult === 'win' ? 'VICTORY' : 'DEFEAT'}</span>
          <span className="result-xp">+{lastCombatXp} XP</span>
        </div>
      )}

      {/* Ground layer (fast scroll) */}
      <div className="idle-ground-layer" style={{ backgroundImage: `${groundCss}, ${dirtCss}` }}>
        <div className="idle-ground-inner scroll-fast" />
      </div>

      {/* HUD overlay */}
      <div className="idle-hud">
        <div className="idle-hp-bar">
          <div className="idle-hp-fill" style={{ width: `${hpPercent}%` }} />
          <span className="idle-hp-text">{idleHp}/{idleMaxHp}</span>
        </div>
        <div className="idle-xp-counter">
          <span className="idle-fights">{idleFightsCount} FIGHTS</span>
          <span className="idle-xp-total">+{idleXpGained} XP</span>
        </div>
      </div>

      {/* Offline gains notification */}
      {offlineGains && (
        <div className="idle-offline-notification">
          <button className="idle-offline-close" onClick={onClearOfflineGains} aria-label="Dismiss">×</button>
          <div className="offline-title">WELCOME BACK!</div>
          <div className="offline-stats">
            <span>{offlineGains.fights} fights</span>
            <span>+{offlineGains.xp} XP</span>
          </div>
        </div>
      )}

      {/* Death overlay */}
      {isDead && (
        <div className="idle-death-overlay">
          <div className="death-content">
            <div className="death-title">YOU FELL IN BATTLE</div>
            <div className="death-stats">
              {idleFightsCount > 0 && (
                <span>{idleFightsCount} fights • +{idleXpGained} XP</span>
              )}
            </div>
            <button className="resume-btn" onClick={onResume}>
              ⚔ RESUME ⚔
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
