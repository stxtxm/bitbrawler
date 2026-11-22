import { memo } from 'react';
import type { ArenaMode } from './arenaTypes';

interface ArenaModeTabsProps {
  mode: ArenaMode;
  onModeChange?: (mode: ArenaMode) => void;
  /** Affiche un cadenas sur l'onglet BOSS tant qu'il n'est pas débloqué. */
  bossLocked?: boolean;
}

const TABS: Array<{ id: ArenaMode; label: string }> = [
  { id: 'pve', label: '👹 PVE' },
  { id: 'pvp', label: '⚔ PVP' },
  { id: 'boss', label: '👑 BOSS' },
];

/**
 * Barre d'onglets mobile en bas de l'arène. Un seul point d'entrée pour les
 * trois modes, partagé par l'ActionPanel (PVE/PVP) et l'écran BOSS.
 */
export const ArenaModeTabs = memo(function ArenaModeTabs({
  mode,
  onModeChange,
  bossLocked = false,
}: ArenaModeTabsProps) {
  return (
    <div className="arena-bottom-tabs" role="tablist" aria-label="Game mode">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`arena-bottom-tab ${mode === tab.id ? 'active' : ''}`}
          role="tab"
          aria-selected={mode === tab.id}
          onClick={() => onModeChange?.(tab.id)}
        >
          {tab.label}
          {tab.id === 'boss' && bossLocked && (
            <span className="arena-bottom-tab-lock" aria-hidden="true"> 🔒</span>
          )}
        </button>
      ))}
    </div>
  );
});
