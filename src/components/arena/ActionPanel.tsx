import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { TacticalLens } from './TacticalLens';
import type { Character } from '../../types/Character';
import type { TacticalHint } from '../../utils/tacticalLens';
import { ArenaModeTabs } from './ArenaModeTabs';
import type { ArenaMode } from './arenaTypes';
import type { SettingsLogEntry } from '../../utils/arenaUtils';
import { formatRelativeLogDate, formatSettingsLogDate } from '../../utils/arenaUtils';

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
  const visibleHistory = pvpHistory.slice(0, 8);

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

          <div className="pvp-feed" aria-label="PvP and defense history">
            <div className="pvp-feed-head">
              <span className="pvp-feed-title">
                <span className="pvp-feed-live" aria-hidden="true" />
                PVP &amp; DEFENSE LOG
              </span>
              <span className="pvp-feed-badge">
                {visibleHistory.length > 0 ? `${visibleHistory.length} RECENT` : 'STANDBY'}
              </span>
            </div>

            {visibleHistory.length === 0 ? (
              <div className="pvp-feed-empty">
                <span className="pvp-feed-empty-icon" aria-hidden="true">🛡</span>
                <span>NO ACTIVITY YET — DEFEND TO EARN XP &amp; 💎</span>
              </div>
            ) : (
              <ul className="pvp-feed-list" role="list">
                {visibleHistory.map((fight, i) => {
                  const incoming = fight.direction === 'incoming';
                  const outcome = incoming
                    ? (fight.won ? 'HELD' : 'BREACHED')
                    : (fight.won ? 'VICTORY' : 'DEFEAT');
                  const fullDate = formatSettingsLogDate(fight.date);

                  return (
                    <li
                      key={`${fight.date}-${fight.direction}-${i}`}
                      className={`pvp-feed-item ${fight.won ? 'won' : 'lost'} ${incoming ? 'incoming' : 'outgoing'}`}
                      title={`${incoming ? 'DEFENSE' : 'ATTACK'} · ${fight.displayName} · ${fullDate}`}
                    >
                      <span className="pvp-feed-icon" aria-hidden="true">
                        {incoming ? '🛡' : '⚔'}
                      </span>

                      <div className="pvp-feed-main">
                        <div className="pvp-feed-line">
                          <span className="pvp-feed-direction">{incoming ? 'DEFENSE' : 'ATTACK'}</span>
                          <span className="pvp-feed-opponent">{fight.displayName}</span>
                        </div>
                        <div className="pvp-feed-meta">
                          <span className={`pvp-feed-outcome ${fight.won ? 'won' : 'lost'}`}>{outcome}</span>
                          <span className="pvp-feed-date">{formatRelativeLogDate(fight.date)}</span>
                        </div>
                      </div>

                      <div className="pvp-feed-rewards">
                        {fight.xpGained ? (
                          <span className="pvp-feed-reward xp">+{fight.xpGained} XP</span>
                        ) : null}
                        {fight.essenceGained ? (
                          <span className="pvp-feed-reward essence">+{fight.essenceGained} 💎</span>
                        ) : null}
                        {!fight.xpGained && !fight.essenceGained ? (
                          <span className="pvp-feed-reward muted">—</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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
        </>
      )}

      <ArenaModeTabs mode={mode} onModeChange={onModeChange} />
    </div>
  );
});
