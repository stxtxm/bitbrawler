import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';

interface ActionPanelProps {
  pveMode: boolean;
  bossMode: boolean;
  canFight: boolean;
  matchmaking: boolean;
  hasPendingFight: boolean;
  autoMode: boolean;
  isOfflineMode: boolean;
  fightsLeft: number;
  pveFightsLeft: number;
  bossAttacksLeft: number;
  bossUnlocked: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossLevel: number;
  onTogglePve: () => void;
  onTogglePvp: () => void;
  onToggleBoss: () => void;
  onFight: () => void;
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, bossMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, pveFightsLeft, bossAttacksLeft, bossUnlocked,
  bossHp, bossMaxHp, bossLevel, onTogglePve, onTogglePvp, onToggleBoss, onFight,
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
          className={`pixel-switch pve-switch ${bossMode ? 'on' : 'off'}`}
          onClick={onToggleBoss}
          role="switch"
          aria-checked={bossMode}
          aria-label="Boss mode"
          title="Raid boss mode (unlocks at level 30)"
        >
          <span className="switch-knob" />
          <span className="switch-text">👑 BOSS</span>
        </button>
        <button
          className={`pixel-switch pve-switch ${!pveMode && !bossMode ? 'on' : 'off'}`}
          onClick={onTogglePvp}
          role="switch"
          aria-checked={!pveMode && !bossMode}
          aria-label="PvP mode"
          title="PvP mode"
        >
          <span className="switch-knob" />
          <span className="switch-text">⚔ PVP</span>
        </button>
      </div>

      <div className={`daily-status-compact ${bossMode ? 'boss-status-compact' : pveMode ? 'pve-status-compact' : ''}`}>
        {bossMode ? (
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
        ) : pveMode ? (
          <div className="status-label">
            <span className="boss-icon">👹</span>
            <div className="label-text">
              <span className="label-main">BOSS FIGHTS</span>
              <span className="label-sub">{pveFightsLeft} / {GAME_RULES.COMBAT.MAX_DAILY_PVE_FIGHTS} AVAILABLE</span>
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
          {bossMode
            ? Array.from({ length: GAME_RULES.BOSS.MAX_DAILY_ATTACKS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < bossAttacksLeft ? 'active' : 'used'}`}></div>
            ))
            : pveMode
              ? Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_PVE_FIGHTS }).map((_, i) => (
                <div key={i} className="mini-pip used"></div>
              ))
              : Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
                <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
              ))
          }
        </div>
        {bossMode && bossUnlocked && bossMaxHp > 0 && (
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
                  : bossMode
                    ? bossUnlocked
                      ? bossAttacksLeft > 0 ? 'ATTACK BOSS' : 'NO ATTACKS LEFT'
                      : `LOCKED LVL ${GAME_RULES.BOSS.UNLOCK_LEVEL}`
                    : pveMode
                      ? 'BOSS FIGHT'
                      : fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'}
        </button>
      </div>
    </div>
  );
});
