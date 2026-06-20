import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';

interface ActionPanelProps {
  pveMode: boolean;
  canFight: boolean;
  matchmaking: boolean;
  hasPendingFight: boolean;
  autoMode: boolean;
  isOfflineMode: boolean;
  fightsLeft: number;
  onTogglePve: () => void;
  onTogglePvp: () => void;
  onFight: () => void;
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, onTogglePve, onTogglePvp, onFight,
}: ActionPanelProps) {
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
        >
          <span className="switch-knob" />
          <span className="switch-text">⚔ PVP</span>
        </button>
      </div>

      <div className="daily-status-compact" aria-hidden={pveMode} style={pveMode ? { visibility: 'hidden', pointerEvents: 'none' } : {}}>
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
        <div className="mini-pips">
          {Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
            <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
          ))}
        </div>
      </div>

      <button
        className="button primary-btn giant-btn"
        disabled={!canFight || matchmaking}
        onClick={onFight}
        aria-hidden={pveMode}
        style={pveMode ? { visibility: 'hidden', pointerEvents: 'none' } : {}}
        tabIndex={pveMode ? -1 : 0}
      >
        {matchmaking
          ? 'SEARCHING...'
          : hasPendingFight
            ? 'RESOLVING...'
            : autoMode
              ? 'AUTO MODE'
              : isOfflineMode
                ? 'OFFLINE'
                : fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'}
      </button>
    </div>
  );
});
