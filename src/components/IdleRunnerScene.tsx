import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Character } from '../types/Character'
import { MonsterId } from '../data/monsterAssets'
import { ScenePhase } from '../types/IdleCombat'
import { PixelCharacter } from './PixelCharacter'
import { PixelMonster } from './PixelMonster'
import { ParticleSystem } from '../utils/particleSystem'
import { useLowPerformanceMode } from '../hooks/useLowPerformanceMode'
import { monsterScaleFor } from '../utils/monsterVisualScale'

interface OfflineGainsData {
  fights: number
  xp: number
  levels: number
  essence: number
  timeAway: number
}

interface IdleRunnerSceneProps {
  character: Character
  appearance?: Character['appearance']
  currentMonster: MonsterId | null
  scenePhase: ScenePhase
  lastCombatResult: 'win' | 'lose' | null
  lastCombatXp: number
  offlineGains: OfflineGainsData | null
  onClearOfflineGains: () => void
  recentLevelUp: { newLevel: number; isMilestone?: boolean; count?: number } | null
  currentStreak?: number
  streakMilestone?: number | null
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
  appearance,
  currentMonster,
  scenePhase,
  lastCombatResult,
  lastCombatXp,
  offlineGains,
  onClearOfflineGains,
  currentStreak = 0,
  streakMilestone = null,
}: IdleRunnerSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<ParticleSystem | null>(null)
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showLevelUpFx, setShowLevelUpFx] = useState(false)
  const [levelUpLevel, setLevelUpLevel] = useState(0)
  const [levelUpCount, setLevelUpCount] = useState<number | null>(null)
  const [screenShake, setScreenShake] = useState(false)
  const [levelUpFlash, setLevelUpFlash] = useState(false)
  const [levelUpShockwave, setLevelUpShockwave] = useState(false)
  const [isMilestoneCeremony, setIsMilestoneCeremony] = useState(false)
  const lowPerf = useLowPerformanceMode()
  const prevPhaseRef = useRef<ScenePhase>('running')
  const characterLevelRef = useRef(character.level)
  const [animKey, setAnimKey] = useState(0)
  const [animRun, setAnimRun] = useState(true)
  const characterSlotRef = useRef<HTMLDivElement | null>(null)
  characterLevelRef.current = character.level

  // Browsers freeze CSS @keyframes when tab is hidden and don't always
  // resume them on return. Force a remount of the character slot to
  // restart the running animation cleanly.
  // Mobile lock screen / background needs extra care: the visibilitychange
  // fires before the browser has fully restored rendering. Using rAF ensures
  // the DOM update happens when the browser is ready to paint, giving the
  // CSS animation a clean restart. If rAF doesn't fire in time (mobile PWA
  // restore race), a short timeout ensures the animation restarts anyway.
  useEffect(() => {
    let rafPending = false
    let rafTimeout: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        setAnimRun(false)
        // Drop any in-flight level-up FX: if its 2s hide-timer freezes with
        // the page, the element stays mounted and the animation watchdog
        // would REPLAY it on every slot remount (per-kill float loop).
        if (levelUpTimerRef.current) {
          clearTimeout(levelUpTimerRef.current)
          levelUpTimerRef.current = null
        }
        setShowLevelUpFx(false)
        setIsMilestoneCeremony(false)
      } else if (document.visibilityState === 'visible' && !rafPending) {
        rafPending = true
        // Fallback: if rAF doesn't fire within 500ms, force the update anyway
        rafTimeout = setTimeout(() => {
          if (rafPending) {
            rafPending = false
            setAnimRun(true)
            setAnimKey(prev => prev + 1)
          }
        }, 500)
        requestAnimationFrame(() => {
          if (rafTimeout) {
            clearTimeout(rafTimeout)
            rafTimeout = null
          }
          rafPending = false
          setAnimRun(true)
          setAnimKey(prev => prev + 1)
        })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (rafTimeout) clearTimeout(rafTimeout)
    }
  }, [])

  const charScale = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 768
    if (w < 480) return 5
    if (w < 640) return 6
    if (w < 768) return 7
    return 8
  }, [])

  // ── Combat animation timing ──────────────────────────────────────────
  // The .attacking / .victory classes override runCycle via a more specific
  // selector, but their one-shot animations (350ms / 500ms) finish long
  // before the phase ends (~1.5s each). After the animation completes,
  // there's no active animation — the character freezes mid-phase.
  // Toggle the class with a timeout so runCycle resumes immediately.
  const [isAttacking, setIsAttacking] = useState(false)
  const [isVictory, setIsVictory] = useState(false)
  const prevPhaseRef2 = useRef<ScenePhase>('running')
  useEffect(() => {
    // Record the phase BEFORE checking the transition so a change of
    // `lastCombatResult` while scenePhase stays in 'combat'/'result' does not
    // re-trigger the one-shot attack/victory animation (which would reset the
    // timeout and restart the CSS animation from scratch).
    const prevPhase = prevPhaseRef2.current
    prevPhaseRef2.current = scenePhase
    if (prevPhase !== 'combat' && scenePhase === 'combat') {
      setIsAttacking(true)
      const t = setTimeout(() => setIsAttacking(false), 350)
      return () => clearTimeout(t)
    }
    if (prevPhase !== 'result' && scenePhase === 'result' && lastCombatResult === 'win') {
      setIsVictory(true)
      const t = setTimeout(() => setIsVictory(false), 500)
      return () => clearTimeout(t)
    }
  }, [scenePhase, lastCombatResult])

  // Force clean remount of the character slot each cycle transition
  // to result→running, giving the CSS animations a clean slate.
  const prevPhaseForRemount = useRef<ScenePhase>('running')
  useEffect(() => {
    if (prevPhaseForRemount.current === 'result' && scenePhase === 'running') {
      setAnimKey(prev => prev + 1)
    }
    prevPhaseForRemount.current = scenePhase
  }, [scenePhase])

  // ── Animation watchdog (PWA background recovery) ────────────────────────
  // Android can freeze CSS @keyframes AND skip the visibilitychange restart
  // event entirely. Two failure modes after a phone lock:
  //   A) animRun stuck false (.anim-paused) — the 'visible' handler never ran
  //   B) animRun true but every slot animation frozen/finished
  // Every 2s in foreground, during the running phase with no one-shot FX,
  // detect either case (2 consecutive dead samples, 1.5s grace after a
  // remount) and force a clean slot remount.
  const scenePhaseRef = useRef<ScenePhase>('running')
  scenePhaseRef.current = scenePhase
  const animRunRef = useRef(animRun)
  animRunRef.current = animRun
  // One-shot windows whose animations legitimately end early: never "heal"
  // during them (the level-up glow/float would replay in an endless loop).
  const oneShotRef = useRef(false)
  oneShotRef.current = isAttacking || isVictory || showLevelUpFx
  const lastRemountRef = useRef(Date.now())
  const deadSamplesRef = useRef(0)
  useEffect(() => {
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (scenePhaseRef.current !== 'running') return
      if (oneShotRef.current) return
      if (Date.now() - lastRemountRef.current < 1500) return

      let looksDead = false
      if (!animRunRef.current) {
        // Case A: paused flag while page is clearly visible for >2s = missed resume
        deadSamplesRef.current += 1
        looksDead = deadSamplesRef.current >= 2
      } else {
        const el = characterSlotRef.current
        if (!el || typeof el.getAnimations !== 'function') return
        const anims = el.getAnimations({ subtree: true })
        // Case B: no animations at all (Android discards keyframes after long
        // suspensions) OR they exist but all frozen/paused/finished.
        if (anims.length === 0 || !anims.some(a => a.playState === 'running')) {
          deadSamplesRef.current += 1
          looksDead = deadSamplesRef.current >= 2
        } else {
          deadSamplesRef.current = 0
        }
      }

      // Cap consecutive auto-restarts: if the sprite still cannot animate
      // (e.g. reduced-motion), stop churning until the phase changes.
      if (looksDead && deadSamplesRef.current <= 3) {
        deadSamplesRef.current = 0
        lastRemountRef.current = Date.now()
        setAnimRun(false)
        requestAnimationFrame(() => {
          setAnimKey(k => k + 1)
          requestAnimationFrame(() => setAnimRun(true))
        })
      }
    }, 2000)
    return () => clearInterval(iv)
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

    // Update the phase watermark first so the transition guards below only
    // fire on real phase changes, not when `lastCombatResult` changes while
    // scenePhase stays the same (avoids re-emitting burst particles).
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = scenePhase

    const rect = container.getBoundingClientRect()
    const cx = rect.width * 0.3
    const cy = rect.height * 0.55

    if (scenePhase === 'combat' && prevPhase === 'monster_appears') {
      ps.emit('spark', cx, cy, lowPerf ? 2 : 6)
      ps.emit('hit_ring', cx - 20, cy, lowPerf ? 4 : 12)
      if (!lowPerf) ps.emit('dust', cx, cy + 30, 2)

      const simulatedDmg = randomDamage(characterLevelRef.current)
      if (simulatedDmg.value > 0) ps.emit('damage', cx, cy, 1, simulatedDmg.value)
      if (simulatedDmg.isCrit) ps.emit('crit', cx, cy, 1)
    }

    if (scenePhase === 'result' && prevPhase !== 'result' && lastCombatResult) {
      ps.emit('xp_star', cx, cy - 20, lowPerf ? 3 : 8)
      if (!lowPerf) {
        ps.emit('spark', cx, cy, 4)
        ps.emit('hit_ring', cx - 20, cy, 6)
      }
    }
  }, [scenePhase, lastCombatResult, lowPerf])

  // Screen shake on monster defeat
  useEffect(() => {
    if (scenePhase === 'result' && lastCombatResult === 'win') {
      setScreenShake(true)
      const t = setTimeout(() => setScreenShake(false), 300)
      return () => clearTimeout(t)
    }
    setScreenShake(false)
  }, [scenePhase, lastCombatResult])

  // ── Level-up FX — derived from authoritative character.level ───────────
  // Announcements fire ONLY when character.level increases, throttled to one
  // per 8s with silent aggregation ('+N niveaux' trailing). Suppressed while
  // the welcome-back popup is up (it already aggregates background gains).
  const prevLevelRef = useRef(character.level ?? 1)
  const announceAccRef = useRef({ count: 0, target: 0 })
  const lastAnnouncedAtRef = useRef(0)
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushAnnounce = () => {
    const acc = announceAccRef.current
    if (!acc.count) return
    announceAccRef.current = { count: 0, target: 0 }
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const isMilestone = acc.target % 5 === 0
    setShowLevelUpFx(true)
    setLevelUpLevel(acc.target)
    setLevelUpCount(acc.count > 1 ? acc.count : null)
    setIsMilestoneCeremony(isMilestone)

    const ps = particlesRef.current
    const container = containerRef.current
    if (ps && container) {
      ps.emit('xp_star', container.getBoundingClientRect().width * 0.3, 160, lowPerf ? 1 : (isMilestone ? 6 : 3))
      if (!lowPerf) ps.emit('confetti', container.getBoundingClientRect().width * 0.3, 160, isMilestone ? 20 : 10)
    }

    if (!lowPerf) {
      setLevelUpFlash(true)
      setTimeout(() => setLevelUpFlash(false), isMilestone ? 500 : 300)
      setLevelUpShockwave(true)
      setTimeout(() => setLevelUpShockwave(false), 600)
    }

    levelUpTimerRef.current = setTimeout(() => {
      setShowLevelUpFx(false)
      setIsMilestoneCeremony(false)
      setLevelUpCount(null)
      levelUpTimerRef.current = null
    }, 2000)
  }

  useEffect(() => {
    const lv = character.level ?? 1
    const prev = prevLevelRef.current
    if (lv <= prev) return
    prevLevelRef.current = lv

    // Welcome-back popup covers background gains — no float on top of it
    if (offlineGains) return

    const acc = announceAccRef.current
    acc.count += lv - prev
    acc.target = Math.max(acc.target || prev, lv)

    const now = Date.now()
    if (!lastAnnouncedAtRef.current || now - lastAnnouncedAtRef.current >= 8000) {
      lastAnnouncedAtRef.current = now
      flushAnnounce()
      return
    }
    if (!trailingTimerRef.current) {
      trailingTimerRef.current = setTimeout(() => {
        trailingTimerRef.current = null
        lastAnnouncedAtRef.current = Date.now()
        flushAnnounce()
      }, 8000 - (now - lastAnnouncedAtRef.current))
    }
  }, [character.level, offlineGains])

  useEffect(() => {
    if (offlineGains) {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
      announceAccRef.current = { count: 0, target: 0 }
    }
  }, [offlineGains])

  useEffect(() => () => {
    if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current)
  }, [])

  // Click-to-dismiss: clicking anywhere on the idle runner box dismisses
  // level-up visual FX immediately so it never blocks FIGHT button clicks.
  const dismissLevelUpFx = () => {
    if (!showLevelUpFx) return
    if (levelUpTimerRef.current) {
      clearTimeout(levelUpTimerRef.current)
      levelUpTimerRef.current = null
    }
    setShowLevelUpFx(false)
    setIsMilestoneCeremony(false)
    setLevelUpCount(null)
  }

  // Offline gains popup is static — it stays on screen until the player
  // clicks (the CLAIM REWARDS button or anywhere on the popup). This is
  // deterministic for QA/bot automation.
  const animatedXp = offlineGains?.xp ?? 0

  const showBigXp = scenePhase === 'result' && lastCombatXp > 0
  const showStreakBanner = streakMilestone !== null && scenePhase === 'result' && lastCombatResult === 'win'

  return (
    <div className={`idle-runner-box${screenShake ? ' shake-screen' : ''}${levelUpFlash ? ' level-up-flash' : ''}`} ref={containerRef} onClick={dismissLevelUpFx}>
      {levelUpShockwave && <div className={`level-up-shockwave${isMilestoneCeremony ? ' milestone' : ''}`} />}
      {/* clouds rendered inside ProceduralTerrain canvas */}

      <div key={animKey} ref={characterSlotRef} className={`idle-character-slot${animRun ? '' : ' anim-paused'} ${isAttacking ? 'attacking' : ''} ${isVictory ? 'victory' : ''} ${isMilestoneCeremony ? 'ceremony-milestone' : ''}`}>
        {showLevelUpFx && <div className="idle-levelup-glow" />}
        <PixelCharacter
          seed={character.seed}
          gender={character.gender}
          appearance={appearance ?? character.appearance}
          scale={charScale}
        />
        {showLevelUpFx && (
          <div className="levelup-float-text">
            <span className="levelup-float-arrow">⬆</span>
            <span className="levelup-float-lvl">LVL {levelUpLevel}{levelUpCount && levelUpCount > 1 ? <span className="levelup-float-count"> ×{levelUpCount}</span> : null}</span>
          </div>
        )}
      </div>

      {currentMonster && (
        <div className={`idle-monster-slot phase-${scenePhase}`} data-monster={currentMonster}>
          <PixelMonster monsterId={currentMonster} scale={monsterScaleFor(currentMonster, charScale)} />
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



      {offlineGains && (
        <div className="idle-offline-notification" onClick={onClearOfflineGains}>
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
              <span className="offline-stat-value">+{animatedXp}</span>
              <span className="offline-stat-label">XP</span>
            </div>
            {offlineGains.essence > 0 && (
              <div className="offline-stat-item">
                <span className="offline-stat-value essence">💎+{offlineGains.essence.toFixed(2)}</span>
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
          <button
            type="button"
            className="offline-claim-btn"
            onClick={onClearOfflineGains}
          >
            CLAIM REWARDS
          </button>
        </div>
      )}
    </div>
  )
})

