import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Character } from '../../types/Character';
import { ELEMENT_COLORS, ELEMENT_LABELS, type Element } from '../../types/Item';
import { ABYSSAL_BOSS_ID, BOSS_ID, STONE_BOSS_ID, getBossDef, type BossId } from '../../data/bossAssets';
import {
  buildBossCharacter,
  createBossProgress,
  getBossRewards,
  type BossProgress,
} from '../../utils/bossUtils';
import { calculateCombatStats } from '../../utils/combatUtils';
import { estimateBossOutcome } from '../../utils/bossPreview';
import { GAME_RULES } from '../../config/gameRules';
import { PixelMonster } from '../PixelMonster';
import { SpriteCanvas } from '../sprite/SpriteCanvas';
import { ArenaModeTabs } from './ArenaModeTabs';
import type { ArenaMode } from './arenaTypes';

const ELEMENT_EMOJI: Record<Element, string> = {
  fire: '🔥',
  water: '🌊',
  wind: '🌪',
  earth: '🪨',
  light: '✨',
  dark: '🌑',
};

interface BossStatRowProps {
  label: string;
  playerValue: number;
  bossValue: number;
}

const BossStatRow = memo(function BossStatRow({ label, playerValue, bossValue }: BossStatRowProps) {
  const total = playerValue + bossValue;
  const playerPct = total > 0
    ? Math.max(6, Math.min(94, (playerValue / total) * 100))
    : 50;
  return (
    <div className="boss-stat-row">
      <div className="boss-stat-line">
        <span className="boss-stat-value player">{Math.round(playerValue)}</span>
        <span className="boss-stat-label">{label}</span>
        <span className="boss-stat-value boss">{Math.round(bossValue)}</span>
      </div>
      <div className="boss-stat-track">
        <div className="boss-stat-fill player" style={{ width: `${playerPct}%` }} />
        <div className="boss-stat-fill boss" style={{ width: `${100 - playerPct}%` }} />
      </div>
    </div>
  );
});

interface BossRewardChipProps {
  title: string;
  icon: string;
  xp: number;
  essence: number;
  tone: 'kill' | 'defeat';
  emptyLabel?: ReactNode;
}

const BossRewardChip = memo(function BossRewardChip({
  title,
  icon,
  xp,
  essence,
  tone,
  emptyLabel,
}: BossRewardChipProps) {
  const empty = xp <= 0 && essence <= 0;
  return (
    <div className={`boss-reward ${tone}`}>
      <span className="boss-reward-title">
        <span aria-hidden="true">{icon}</span> {title}
      </span>
      {empty && emptyLabel ? (
        <span className="boss-reward-empty">{emptyLabel}</span>
      ) : (
        <span className="boss-reward-pills">
          <span className="boss-reward-pill xp">+{xp} XP</span>
          <span className="boss-reward-pill essence">+{essence} 💎</span>
        </span>
      )}
    </div>
  );
});

export interface BossScreenProps {
  character: Character;
  effectiveCharacter: Character;
  mode: ArenaMode;
  onModeChange: (mode: ArenaMode) => void;
  bossId: BossId;
  bossProgress?: BossProgress | null;
  bossUnlocked: boolean;
  attacksLeft: number;
  canFight: boolean;
  onFight: () => void;
  matchmaking?: boolean;
  hasPendingFight?: boolean;
  autoMode?: boolean;
  isOfflineMode?: boolean;
  nextBossVisible?: boolean;
  stoneBossVisible?: boolean;
  abyssalBossVisible?: boolean;
  stoneUnlocked?: boolean;
  abyssalUnlocked?: boolean;
  voidTitanKills?: number;
  stoneKills?: number;
  abyssalKills?: number;
  selectedBossId?: BossId;
  onSelectBoss?: (bossId: BossId) => void;
}

/**
 * Écran BOSS dédié — volontairement différent du PvE (idle) et du PvP.
 * Il présente l'affrontement sur un autel du vide : héros + colosse côte à
 * côte, comparaison de puissance, probabilité de coup de grâce et récompenses
 * de victoire/défaite avant d'engager l'attaque.
 */
export const BossScreen = memo(function BossScreen({
  character,
  effectiveCharacter,
  mode,
  onModeChange,
  bossId,
  bossProgress,
  bossUnlocked,
  attacksLeft,
  canFight,
  onFight,
  matchmaking = false,
  hasPendingFight = false,
  autoMode = false,
  isOfflineMode = false,
  nextBossVisible = false,
  stoneBossVisible: _stoneBossVisible,
  abyssalBossVisible: _abyssalBossVisible,
  stoneUnlocked = false,
  abyssalUnlocked = false,
  voidTitanKills = 0,
  stoneKills = 0,
  abyssalKills = 0,
  selectedBossId,
  onSelectBoss,
}: BossScreenProps) {
  const bossDef = getBossDef(bossId);
  const isSummitBoss = bossId === ABYSSAL_BOSS_ID;
  const isMountainBoss = bossId === STONE_BOSS_ID;
  const accent = bossDef ? ELEMENT_COLORS[bossDef.element] : '#b678ff';
  const activeBossId = selectedBossId ?? bossId;

  // Avant la première attaque le perso n'a pas encore de bossProgress : on
  // synthétise l'état d'ouverture pour afficher un écran complet, pas une
  // coquille vide.
  const progress = useMemo(
    () => bossProgress ?? createBossProgress(character, Date.now(), bossId),
    [bossProgress, character, bossId],
  );

  const boss = useMemo(
    () => buildBossCharacter(character, progress.bossHp, bossId, progress.pityStacks ?? 0),
    [character, progress.bossHp, progress.pityStacks, bossId],
  );

  const bossMaxHp = progress.bossMaxHp > 0 ? progress.bossMaxHp : boss.maxHp;
  const bossHp = Math.max(0, Math.min(progress.bossHp, bossMaxHp));
  const bossHpPct = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
  const bossLevel = progress.bossLevel || boss.level;
  const damagePct = bossMaxHp > 0
    ? Math.round(((bossMaxHp - bossHp) / bossMaxHp) * 100)
    : 0;
  const pityStacks = progress.pityStacks ?? 0;

  const playerStats = useMemo(() => calculateCombatStats(character), [character]);
  const bossStats = useMemo(() => calculateCombatStats(boss), [boss]);

  const outcome = useMemo(
    () => (bossUnlocked ? estimateBossOutcome(character, progress) : null),
    [bossUnlocked, character, progress],
  );

  const killRewards = useMemo(
    () => getBossRewards(character, true, progress),
    [character, progress],
  );
  const defeatRewards = useMemo(
    () => getBossRewards(character, false, progress),
    [character, progress],
  );

  const compact = typeof window !== 'undefined' && window.innerWidth < 480;
  const playerScale = compact ? 7 : 9;
  const bossScale = compact ? 8 : 10;

  const bossTier = (GAME_RULES.BOSS_TIERS as any)[bossId] ?? GAME_RULES.BOSS;
  const unlockLevel = bossTier.UNLOCK_LEVEL ?? GAME_RULES.BOSS.UNLOCK_LEVEL;
  const maxAttacks = bossTier.MAX_DAILY_ATTACKS ?? GAME_RULES.BOSS.MAX_DAILY_ATTACKS;

  const buttonLabel = !bossUnlocked
    ? `LOCKED LVL ${unlockLevel}`
    : matchmaking
      ? 'SEARCHING...'
      : hasPendingFight
        ? 'RESOLVING...'
        : autoMode
          ? 'AUTO MODE'
          : isOfflineMode
            ? 'OFFLINE'
            : attacksLeft > 0
              ? 'ATTACK BOSS'
              : 'NO ATTACKS LEFT';

  const style = { '--boss-accent': accent } as CSSProperties;

  return (
    <div className={`boss-screen${bossUnlocked ? '' : ' boss-screen-locked'}`} style={style} data-boss={bossId}>
      <div className="boss-screen-head">
        <div className="boss-screen-titles">
          <span className="boss-rank">{isSummitBoss ? 'SUMMIT RAID' : isMountainBoss ? 'MOUNTAIN RAID' : 'WORLD BOSS'}</span>
          <h2 className="boss-title">{bossDef?.name ?? 'RAID BOSS'}</h2>
          {bossDef?.specialty && <span className="boss-specialty">{bossDef.specialty}</span>}
        </div>
        <div className="boss-screen-badges">
          <span className="boss-element">
            <span aria-hidden="true">{bossDef ? ELEMENT_EMOJI[bossDef.element] : '🌑'}</span>{' '}
            {bossDef ? ELEMENT_LABELS[bossDef.element] : 'Void'}
          </span>
          {progress.totalKills > 0 && (
            <span className="boss-kills">SLAIN ×{progress.totalKills}</span>
          )}
        </div>
      </div>

      {nextBossVisible && (
        <div className="boss-select" role="radiogroup" aria-label="Boss target">
          {([
            { id: BOSS_ID, label: 'VOID TITAN', sub: 'TRAIN / FARM', locked: false, kills: voidTitanKills },
            {
              id: STONE_BOSS_ID,
              label: 'STONE COLOSSUS',
              sub: stoneUnlocked ? 'MOUNTAIN RAID' : `LOCKED LVL ${(GAME_RULES.BOSS_TIERS as any).stone_colossus.UNLOCK_LEVEL}`,
              locked: !stoneUnlocked,
              kills: stoneKills,
            },
            {
              id: ABYSSAL_BOSS_ID,
              label: 'FROSTPEAK',
              sub: abyssalUnlocked ? 'SUMMIT RAID' : `LOCKED LVL ${(GAME_RULES.BOSS_TIERS as any).abyssal_monarch.UNLOCK_LEVEL}`,
              locked: !abyssalUnlocked,
              kills: abyssalKills,
            },
          ] as const)
            .map((b) => {
            const selected = activeBossId === b.id;
            const locked = b.locked;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-click-sound={locked ? 'error' : 'nav'}
                className={`boss-select-card ${selected ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => onSelectBoss?.(b.id)}
              >
                <span className="boss-select-name">{b.label}</span>
                <span className="boss-select-sub">{b.sub}</span>
                {b.kills > 0 && <span className="boss-select-kills">☠ {b.kills}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="boss-hp-strip">
        <div className="boss-hp-bar">
          <div className="boss-hp-fill" style={{ width: `${bossHpPct}%` }} />
        </div>
        <div className="boss-hp-values">
          <span className="boss-hp-name">{bossDef?.name ?? 'RAID BOSS'} LVL {bossLevel}</span>
          <span className="boss-hp-num">{Math.round(bossHp)} / {Math.round(bossMaxHp)}</span>
        </div>
        <div className="boss-hp-meta">
          <span>{damagePct}% DAMAGE DEALT</span>
          {pityStacks > 0 && <span className="boss-pity-inline">WEAKENED · {pityStacks} DEFEATS</span>}
        </div>
      </div>

      <div className="boss-stage">
        <div className="boss-stage-sky" aria-hidden="true" />
        <div className="boss-rune-ring" aria-hidden="true" />
        <div className="boss-rune-ring inner" aria-hidden="true" />
        <div className="boss-stage-shards" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>

        <div className="boss-duelist player">
          <span className="boss-duelist-tag">YOU</span>
          <div className="boss-sprite-wrap">
            <SpriteCanvas
              seed={character.seed}
              gender={character.gender}
              appearance={character.appearance}
              equippedItems={character.equippedItems}
              scale={playerScale}
              animate="idle"
              className="pixel-character boss-player-sprite"
            />
            <div className="scene-ground-shadow" aria-hidden="true" />
          </div>
          <span className="boss-duelist-name">{character.name}</span>
          <span className="boss-duelist-level">LVL {character.level}</span>
        </div>

        <div className="boss-vs-badge" aria-hidden="true">
          <span className="boss-vs-word">VS</span>
          <span className="boss-vs-element">{bossDef ? ELEMENT_EMOJI[bossDef.element] : '🌑'}</span>
        </div>

        <div className="boss-duelist enemy">
          <span className="boss-duelist-tag boss">{isSummitBoss ? "SUMMIT BOSS" : isMountainBoss ? "MOUNTAIN BOSS" : "WORLD BOSS"}</span>
          <div className="boss-sprite-wrap boss">
            <div className="boss-aura" aria-hidden="true" />
            <PixelMonster monsterId={bossId} scale={bossScale} aura={bossDef?.element ?? null} />
            <div className="scene-ground-shadow boss" aria-hidden="true" />
          </div>
          <span className="boss-duelist-name">{bossDef?.name ?? 'RAID BOSS'}</span>
          <span className="boss-duelist-level">LVL {bossLevel}</span>
        </div>

        {!bossUnlocked && (
          <div className="boss-lock-overlay">
            <span className="boss-lock-icon" aria-hidden="true">🔒</span>
            <strong>BOSS LOCKED</strong>
            <span>REACH LEVEL {unlockLevel} TO CHALLENGE</span>
          </div>
        )}
      </div>

      <div className="boss-screen-grid">
        <section className="boss-panel boss-stats-panel" aria-label="Power comparison">
          <div className="boss-panel-head">
            <span>DUEL STATS</span>
            <span className="boss-panel-side">YOU / BOSS</span>
          </div>
          <BossStatRow label="POWER" playerValue={playerStats.totalPower} bossValue={bossStats.totalPower} />
          <BossStatRow label="HP" playerValue={effectiveCharacter.maxHp} bossValue={bossMaxHp} />
          <BossStatRow label="LEVEL" playerValue={character.level} bossValue={bossLevel} />
        </section>

        <section className="boss-panel boss-odds-panel" aria-label="Win probability">
          <div className="boss-panel-head">
            <span>BATTLE ODDS</span>
            <span className="boss-panel-side">SIMULATED</span>
          </div>
          {bossUnlocked && outcome ? (
            <>
              <div className="boss-odds-values">
                <div className="boss-odds-row win">
                  <span className="boss-odds-word win">WIN</span>
                  <span className="boss-odds-win">{outcome.winChance}%</span>
                </div>
                <div className="boss-odds-row loss">
                  <span className="boss-odds-word loss">LOSS</span>
                  <span className="boss-odds-loss">{outcome.lossChance}%</span>
                </div>
              </div>
              <div className="boss-odds-track">
                <div className="boss-odds-fill" style={{ width: `${outcome.winChance}%` }} />
              </div>
              <div className="boss-odds-meta">
                <span>⚔ ~{outcome.averageDamage} DMG / ATTACK</span>
                {outcome.attacksToKill != null && outcome.attacksToKill > 0 && (
                  <span>☠ ~{outcome.attacksToKill} ATTACKS TO SLAY</span>
                )}
              </div>
            </>
          ) : (
            <div className="boss-odds-locked">
              <span className="boss-odds-unknown">??%</span>
              <span>Unlock at level {unlockLevel} to read the boss.</span>
            </div>
          )}
        </section>

        <section className="boss-panel boss-rewards-panel" aria-label="Rewards">
          <div className="boss-panel-head">
            <span>REWARDS</span>
            <span className="boss-panel-side">PER ATTACK</span>
          </div>
          <div className="boss-rewards">
            <BossRewardChip
              title="SLAY"
              icon="💀"
              xp={killRewards.xpGained}
              essence={killRewards.essenceGained}
              tone="kill"
            />
            <BossRewardChip
              title="DEFEAT"
              icon="🛡"
              xp={defeatRewards.xpGained}
              essence={defeatRewards.essenceGained}
              tone="defeat"
              emptyLabel="NO CONSOLATION LEFT TODAY"
            />
          </div>
        </section>
      </div>

      <div className="boss-action-dock">
        <div className="boss-attacks-row">
          <span className="boss-attacks-label">DAILY ATTACKS</span>
          <div className="boss-attacks-pips" aria-hidden="true">
            {Array.from({ length: maxAttacks }).map((_, i) => (
              <span key={i} className={`boss-attack-pip ${i < attacksLeft ? 'active' : 'used'}`} />
            ))}
          </div>
          <span className="boss-attacks-count">{attacksLeft} / {maxAttacks} AVAILABLE</span>
        </div>
        <button
          type="button"
          className="button primary-btn giant-btn fight-btn boss-attack-btn"
          disabled={!canFight || matchmaking}
          onClick={onFight}
        >
          {buttonLabel}
        </button>
        <ArenaModeTabs mode={mode} onModeChange={onModeChange} bossLocked={!bossUnlocked} />
      </div>
    </div>
  );
});
