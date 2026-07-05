import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { PROGRESSION_GATES, isFeatureUnlocked } from '../../config/progressionConfig';

interface ActionPanelProps {
  pveMode: boolean;
  canFight: boolean;
  matchmaking: boolean;
  hasPendingFight: boolean;
  autoMode: boolean;
  isOfflineMode: boolean;
  fightsLeft: number;
  pveFightsLeft: number;
  level: number;
  onTogglePve: () => void;
  onTogglePvp: () => void;
  onFight: () => void;
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, pveFightsLeft, level, onTogglePve, onTogglePvp, onFight,
}: ActionPanelProps) {
  const pvpUnlocked = isFeatureUnlocked(level, PROGRESSION_GATES.PVP_UNLOCK_LEVEL);

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
          className={`pixel-switch pve-switch ${!pveMode ? 'on' : 'off'}${!pvpUnlocked ? ' locked' : ''}`}
          onClick={pvpUnlocked ? onTogglePvp : undefined}
          role="switch"
          aria-checked={!pveMode && pvpUnlocked}
          aria-label="PvP mode"
          disabled={!pvpUnlocked}
          title={pvpUnlocked ? 'PvP mode' : `Unlocks at LVL ${PROGRESSION_GATES.PVP_UNLOCK_LEVEL}`}
        >
          <span className="switch-knob" />
          <span className="switch-text">{pvpUnlocked ? '⚔ PVP' : `🔒 PVP LVL ${PROGRESSION_GATES.PVP_UNLOCK_LEVEL}`}</span>
        </button>
      </div>

      <div className={`daily-status-compact ${pveMode ? 'boss-status-compact' : ''}`}>
        {pveMode ? (
          <div className="status-label">
            <span className="boss-icon">👑</span>
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
          {pveMode
            ? Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_PVE_FIGHTS }).map((_, i) => (
              <div key={i} className="mini-pip used"></div>
            ))
            : Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
            ))
          }
        </div>
      </div>

      <div className="fight-row">
        <button
          className="button primary-btn giant-btn fight-btn"
          disabled={pveMode || !canFight || matchmaking}
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
                    ? 'BOSS FIGHT'
                    : fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'}
        </button>
      </div>
    </div>
  );
});
