import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { TacticalLens } from './TacticalLens';
import type { Character } from '../../types/Character';
import type { TacticalHint } from '../../utils/tacticalLens';

import { BossId } from '../../data/bossAssets';

interface ActionPanelProps {
  pveMode: boolean;
  canFight: boolean;
  matchmaking: boolean;
  hasPendingFight: boolean;
  autoMode: boolean;
  isOfflineMode: boolean;
  fightsLeft: number;
  bossAttacksLeft: number;
  bossUnlocked: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossLevel: number;
  bossPityStacks?: number;
  bossPityReduction?: number;
  onTogglePve: () => void;
  onTogglePvp: () => void;
  onFight: () => void;
  tacticalOpponent?: Character | null;
  tacticalHint?: TacticalHint | null;
  onOpenInventory?: (element?: string) => void;
  bossId?: BossId;
  abyssalUnlocked?: boolean;
  abyssalAttacksLeft?: number;
  abyssalProgress?: any;
  bossProgress?: any;
  onSelectBoss?: (id: BossId) => void;
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, bossAttacksLeft, bossUnlocked,
  bossHp, bossMaxHp, bossLevel, bossPityStacks = 0, bossPityReduction = 0, onTogglePve, onTogglePvp, onFight,
  tacticalOpponent, tacticalHint, onOpenInventory,
  bossId, abyssalUnlocked, abyssalProgress, onSelectBoss,
}: ActionPanelProps) {

  const bossHpPct = bossMaxHp > 0 ? Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100)) : 100;
  const abyssalHpPct = abyssalProgress ? Math.max(0, Math.min(100, (abyssalProgress.bossHp / abyssalProgress.bossMaxHp) * 100)) : 100;

  return (
    <div className="action-panel">
      <div className="pve-toggle-row">
        <button
          className={`pixel-switch pve-switch ${pveMode ? 'on' : 'off'}`}
          onClick={onTogglePve}
          role="switch"
          aria-checked={pveMode}
          aria-label="PvE mode"
        >
          <span className="switch-knob" />
          <span className="switch-text">👹 PVE</span>
        </button>
        <button
          className={`pixel-switch pve-switch ${!pveMode ? 'on' : 'off'}`}
          onClick={onTogglePvp}
          role="switch"
          aria-checked={!pveMode}
          aria-label="PvP mode"
          title="PvP mode"
        >
          <span className="switch-knob" />
          <span className="switch-text">⚔ PVP</span>
        </button>
      </div>

      <div className={`daily-status-compact ${pveMode ? 'boss-status-compact' : ''}`}>
        {pveMode ? (
          <div className="status-label">
            <span className="boss-icon">👑</span>
            <div className="label-text">
              <span className="label-main">BOSS ATTACKS</span>
              <span className="label-sub">
                {!bossUnlocked && !abyssalUnlocked
                  ? `UNLOCK AT LVL ${GAME_RULES.BOSS.UNLOCK_LEVEL}`
                  : abyssalUnlocked && bossId === 'abyssal_monarch'
                    ? `${bossAttacksLeft} / ${GAME_RULES.BOSS_TIERS.abyssal_monarch.MAX_DAILY_ATTACKS} AVAILABLE — ABYSS`
                    : `${bossAttacksLeft} / ${GAME_RULES.BOSS.MAX_DAILY_ATTACKS} AVAILABLE`}
              </span>
            </div>
          </div>
        ) : (
          <div className="status-label">
            <PixelIcon type="sword" size={32} />
            <div className="label-text">
              <span className="label-main">BATTLE ENERGY</span>
              <span className="label-sub">
                {isOfflineMode
                  ? 'OFFLINE SNAPSHOT'
                  : `${fightsLeft} / ${GAME_RULES.COMBAT.MAX_DAILY_FIGHTS} AVAILABLE`}
              </span>
            </div>
          </div>
        )}
        <div className="mini-pips">
          {pveMode
            ? Array.from({ length: (bossId === 'abyssal_monarch' ? GAME_RULES.BOSS_TIERS.abyssal_monarch.MAX_DAILY_ATTACKS : GAME_RULES.BOSS.MAX_DAILY_ATTACKS) }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < bossAttacksLeft ? 'active' : 'used'}`}></div>
            ))
            : Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
            ))
          }
        </div>
        {pveMode && bossUnlocked && bossMaxHp > 0 && (
          <div className={`boss-hp-strip ${bossId === 'abyssal_monarch' ? 'abyssal' : ''}`}>
            <div className="boss-hp-bar">
              <div className="boss-hp-fill" style={{ width: `${bossId === 'void_titan' ? bossHpPct : abyssalProgress ? abyssalHpPct : bossHpPct}%` }} />
            </div>
            <div className="boss-hp-values">
              <span className="boss-hp-name">{bossId === 'abyssal_monarch' ? `ABYSSAL MONARCH LVL ${abyssalProgress?.bossLevel ?? bossLevel}` : `VOID TITAN LVL ${bossLevel}`}</span>
              <span className="boss-hp-num">{bossId === 'abyssal_monarch' && abyssalProgress ? `${Math.max(0, Math.round(abyssalProgress.bossHp))} / ${abyssalProgress.bossMaxHp}` : `${Math.max(0, Math.round(bossHp))} / ${bossMaxHp}`}</span>
            </div>
            {bossPityStacks > 0 && (
              <div className="boss-pity-badge">Titan affaibli -{bossPityReduction}% ({bossPityStacks} {bossPityStacks === 1 ? 'defeat' : 'defeats'})</div>
            )}
          </div>
        )}
        {pveMode && abyssalUnlocked && onSelectBoss && (
          <div className="boss-selector-row" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className={`pixel-btn small ${bossId === 'void_titan' ? 'active' : ''}`} onClick={() => onSelectBoss('void_titan')}>VOID TITAN</button>
            <button className={`pixel-btn small abyssal ${bossId === 'abyssal_monarch' ? 'active' : ''}`} onClick={() => onSelectBoss('abyssal_monarch')}>ABYSSAL MONARCH</button>
          </div>
        )}
        {pveMode && abyssalUnlocked && bossId === 'abyssal_monarch' && (
          <div className="abyssal-reward-hint" style={{ fontSize: 11, opacity: 0.85, marginTop: 4, color: '#f0c040' }}>
            ♛ Récompense : {GAME_RULES.BOSS_TIERS.abyssal_monarch.ESSENCE_REWARD} essence + {(GAME_RULES.COMBAT.XP_WIN * (1 + (59*0.06)) * GAME_RULES.BOSS_TIERS.abyssal_monarch.XP_MODIFIER).toFixed(0)} XP + cache abyssal
          </div>
        )}
      </div>

      {tacticalOpponent && tacticalHint && onOpenInventory && !pveMode && !hasPendingFight && !autoMode && (
        <TacticalLens opponent={tacticalOpponent} hint={tacticalHint} onOpenInventory={onOpenInventory} />
      )}

      <div className="fight-row">
        <button
          className="button primary-btn giant-btn fight-btn"
          disabled={!canFight || matchmaking}
          onClick={onFight}
        >
          {matchmaking
            ? 'SEARCHING...'
            : hasPendingFight
              ? 'RESOLVING...'
              : autoMode
                ? 'AUTO MODE'
                : isOfflineMode
                  ? 'OFFLINE'
                  : pveMode
                    ? bossUnlocked
                      ? bossAttacksLeft > 0 ? 'ATTACK BOSS' : 'NO ATTACKS LEFT'
                      : `LOCKED LVL ${GAME_RULES.BOSS.UNLOCK_LEVEL}`
                    : fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'}
        </button>
      </div>
    </div>
  );
});