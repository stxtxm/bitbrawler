import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { TacticalLens } from './TacticalLens';
import type { Character } from '../../types/Character';
import type { TacticalHint } from '../../utils/tacticalLens';

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
  onTogglePve: () => void;
  onTogglePvp: () => void;
  onFight: () => void;
  tacticalOpponent?: Character | null;
  tacticalHint?: TacticalHint | null;
  onOpenInventory?: (element?: string) => void;
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, bossAttacksLeft, bossUnlocked,
  bossHp, bossMaxHp, bossLevel, onTogglePve, onTogglePvp, onFight,
  tacticalOpponent, tacticalHint, onOpenInventory,
}: ActionPanelProps) {

  const bossHpPct = bossMaxHp > 0 ? Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100)) : 100;

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
                {!bossUnlocked
                  ? `UNLOCK AT LVL ${GAME_RULES.BOSS.UNLOCK_LEVEL}`
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
            ? Array.from({ length: GAME_RULES.BOSS.MAX_DAILY_ATTACKS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < bossAttacksLeft ? 'active' : 'used'}`}></div>
            ))
            : Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
            ))
          }
        </div>
        {pveMode && bossUnlocked && bossMaxHp > 0 && (
          <div className="boss-hp-strip">
            <div className="boss-hp-bar">
              <div className="boss-hp-fill" style={{ width: `${bossHpPct}%` }} />
            </div>
            <div className="boss-hp-values">
              <span className="boss-hp-name">VOID TITAN LVL {bossLevel}</span>
              <span className="boss-hp-num">{Math.max(0, Math.round(bossHp))} / {bossMaxHp}</span>
            </div>
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