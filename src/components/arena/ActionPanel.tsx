import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { TacticalLens } from './TacticalLens';
import type { Character } from '../../types/Character';
import type { TacticalHint } from '../../utils/tacticalLens';
import { ArenaModeTabs } from './ArenaModeTabs';
import type { ArenaMode } from './arenaTypes';
import type { SettingsLogEntry } from '../../utils/arenaUtils';
import { formatSettingsLogDate } from '../../utils/arenaUtils';

interface ActionPanelProps {
  mode?: ArenaMode;
  pveMode?: boolean;
  canFight?: boolean;
  matchmaking?: boolean;
  hasPendingFight?: boolean;
  autoMode?: boolean;
  isOfflineMode?: boolean;
  fightsLeft?: number;
  onModeChange?: (mode: ArenaMode) => void;
  onFight?: () => void;
  tacticalOpponent?: Character | null;
  tacticalHint?: TacticalHint | null;
  onOpenInventory?: (element?: string) => void;
  pvpHistory?: SettingsLogEntry[];
}

/**
 * Panneau d'action des modes PVE (idle) et PVP. Le mode BOSS a son propre écran
 * (`BossScreen`) : plus de jauge de boss ni de bouton à double libellé ici.
 */
export const ActionPanel = memo(function ActionPanel({
  mode = 'pve',
  pveMode,
  canFight = false,
  matchmaking = false,
  hasPendingFight = false,
  autoMode = false,
  isOfflineMode = false,
  fightsLeft = 0,
  onModeChange,
  onFight,
  tacticalOpponent,
  tacticalHint,
  onOpenInventory,
  pvpHistory = [],
}: ActionPanelProps) {
  const isPve = pveMode ?? mode !== 'pvp';
  const showTacticalLens = !isPve && tacticalOpponent && tacticalHint && onOpenInventory
    && !hasPendingFight && !autoMode;

  return (
    <div className="action-panel">
      <div className="daily-status-compact">
        {isPve ? (
          <div className="status-label">
            <PixelIcon type="sword" size={32} />
            <div className="label-text">
              <span className="label-main">IDLE HUNT</span>
              <span className="label-sub">
                {isOfflineMode ? 'OFFLINE SNAPSHOT' : 'AUTO-BATTLE RUNNING'}
              </span>
            </div>
          </div>
        ) : (
          <>
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
                <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {isPve ? (
        <div className="idle-hunt-strip">
          <span className="idle-hunt-dot" aria-hidden="true" />
          <span>MONSTERS FIGHT ON THEIR OWN — NO ENERGY SPENT</span>
        </div>
      ) : (
        <>
          {showTacticalLens && (
            <TacticalLens
              opponent={tacticalOpponent}
              hint={tacticalHint}
              onOpenInventory={onOpenInventory}
            />
          )}

          <div className="fight-row">
            <button
              type="button"
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
                      : fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'}
            </button>
          </div>

          <div className="pvp-feed" aria-label="PvP and defense history">
            <div className="pvp-feed-header">
              <span className="pvp-feed-title">PVP & DEFENSE LOG</span>
              <span className="pvp-feed-subtitle">REWARDS ON DEFENSE</span>
            </div>
            {pvpHistory.length === 0 ? (
              <div className="pvp-feed-empty">NO PVP ACTIVITY YET</div>
            ) : (
              <div className="pvp-feed-list">
                {pvpHistory.slice(0, 6).map((fight, i) => (
                  <div key={i} className={`history-item pvp-feed-item ${fight.won ? 'won' : 'lost'} ${fight.direction}`}>
                    <div className="history-status">
                      {fight.direction === 'incoming'
                        ? (fight.won ? 'DEFENDED' : 'HIT')
                        : (fight.won ? 'WIN' : 'LOSS')}
                    </div>
                    <div className="history-info">
                      <div className="history-opponent">
                        {fight.direction === 'incoming'
                          ? `🛡 ${fight.displayName}`
                          : `⚔ ${fight.displayName}`}
                      </div>
                      <div className="history-date">{formatSettingsLogDate(fight.date)}</div>
                    </div>
                    <div className="history-rewards pvp-feed-rewards">
                      {fight.xpGained || fight.essenceGained ? (
                        <>
                          {fight.xpGained ? <span className="pvp-feed-reward">+{fight.xpGained} XP</span> : null}
                          {fight.essenceGained ? <span className="pvp-feed-reward essence">+{fight.essenceGained} 💎</span> : null}
                        </>
                      ) : (
                        <span className="pvp-feed-reward muted">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ArenaModeTabs mode={mode} onModeChange={onModeChange} />
    </div>
  );
});
