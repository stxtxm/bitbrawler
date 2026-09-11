import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { GAME_RULES } from '../../config/gameRules';
import { TacticalLens } from './TacticalLens';
import type { Character } from '../../types/Character';
import type { TacticalHint } from '../../utils/tacticalLens';

import { BossId } from '../../data/bossAssets';
import type { BurstMutatorOption, BurstMutatorId } from '../../data/liveOps';

interface ActionPanelProps {
  pveMode: boolean;
  canFight: boolean;
  matchmaking: boolean;
  hasPendingFight: boolean;
  autoMode: boolean;
  isOfflineMode: boolean;
  fightsLeft: number;
  effectiveMaxFights?: number;
  burstActive?: boolean;
  draftOptions?: BurstMutatorOption[];
  selectedMutator?: BurstMutatorId | null;
  onSelectMutator?: (id: BurstMutatorId) => void;
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
}

export const ActionPanel = memo(function ActionPanel({
  pveMode, canFight, matchmaking, hasPendingFight, autoMode,
  isOfflineMode, fightsLeft, effectiveMaxFights, burstActive, draftOptions, selectedMutator, onSelectMutator, bossAttacksLeft, bossUnlocked,
  bossHp, bossMaxHp, bossLevel, bossPityStacks = 0, bossPityReduction = 0, onTogglePve, onTogglePvp, onFight,
  tacticalOpponent, tacticalHint, onOpenInventory,
  bossId, abyssalUnlocked,
}: ActionPanelProps) {

  const bossHpPct = bossMaxHp > 0 ? Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100)) : 100;
  const isAbyssal = abyssalUnlocked && bossId === 'abyssal_monarch';
  const maxFights = effectiveMaxFights ?? GAME_RULES.COMBAT.MAX_DAILY_FIGHTS

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
            <span className="boss-icon">{isAbyssal ? '🌊' : '👑'}</span>
            <div className="label-text">
              <span className="label-main">{isAbyssal ? 'ABYSSAL MONARCH' : 'BOSS ATTACKS'}</span>
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
                  : `${fightsLeft} / ${maxFights} AVAILABLE`}
              </span>
            </div>
          </div>
        )}
        {burstActive && !pveMode && (
          <div className="burst-indicator" data-testid="burst-indicator">⚡ Active Burst: +1 fight + draft</div>
        )}
        <div className="mini-pips">
          {pveMode
            ? Array.from({ length: GAME_RULES.BOSS.MAX_DAILY_ATTACKS }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < bossAttacksLeft ? 'active' : 'used'}`}></div>
            ))
            : Array.from({ length: maxFights }).map((_, i) => (
              <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
            ))
          }
        </div>
        {pveMode && bossUnlocked && bossMaxHp > 0 && (
          <div className={`boss-hp-strip ${isAbyssal ? 'abyssal' : ''}`}>
            <div className="boss-hp-bar">
              <div className="boss-hp-fill" style={{ width: `${bossHpPct}%` }} />
            </div>
            <div className="boss-hp-values" style={{ flexWrap: 'wrap', gap: 4 }}>
              <span className="boss-hp-name" style={{ fontSize: isAbyssal ? 11 : 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{isAbyssal ? `ABYSSAL LVL ${bossLevel}` : `VOID TITAN LVL ${bossLevel}`}</span>
              <span className="boss-hp-num" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{Math.max(0, Math.round(bossHp))} / {bossMaxHp}</span>
            </div>
            {bossPityStacks > 0 && (
              <div className="boss-pity-badge" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isAbyssal ? 'Abyss affaibli' : 'Titan affaibli'} -{bossPityReduction}% ({bossPityStacks})</div>
            )}
          </div>
        )}
      </div>

      {tacticalOpponent && tacticalHint && onOpenInventory && !pveMode && !hasPendingFight && !autoMode && (
        <TacticalLens opponent={tacticalOpponent} hint={tacticalHint} onOpenInventory={onOpenInventory} />
      )}

      {burstActive && !pveMode && draftOptions && draftOptions.length > 0 && onSelectMutator && (
        <div className="burst-draft" data-testid="burst-draft">
          {draftOptions.map(opt => (
            <button
              key={opt.id}
              className={`burst-mutator ${selectedMutator === opt.id ? 'selected' : ''}`}
              onClick={() => onSelectMutator(opt.id)}
              data-testid={`mutator-${opt.id}`}
            >
              {opt.label} {opt.description}
            </button>
          ))}
        </div>
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