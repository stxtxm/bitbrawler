import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';

interface ArenaHeaderProps {
  characterName: string;
  level: number;
  pointsRemaining: number;
  onOpenLevelUp: () => void;
  onOpenSettings: () => void;
  onOpenInventory: () => void;
  onOpenForge: () => void;
  onLogout: () => void;
}

export const ArenaHeader = memo(function ArenaHeader({
  characterName,
  level,
  pointsRemaining,
  onOpenLevelUp,
  onOpenSettings,
  onOpenInventory,
  onOpenForge,
  onLogout,
}: ArenaHeaderProps) {
  return (
    <header className="arena-header">
      <div className="char-info">
        <h2 className="arena-char-name">{characterName}</h2>
        <div className="arena-lvl">
          <span className="lvl-label">LVL</span>
          <span className="lvl-chip">{level}</span>
          {pointsRemaining > 0 && (
            <button className="stat-points-badge pulse" onClick={onOpenLevelUp} title="Unspent stat points">
              ⚡+{pointsRemaining}
            </button>
          )}
        </div>
      </div>
      <div className="header-actions">
        <button className="button icon-btn" onClick={onOpenForge} title="Forge" aria-label="Forge">
          <PixelIcon type="sword" size={26} />
        </button>
        <button className="button icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <PixelIcon type="gear" size={26} />
        </button>
        <button
          className="button icon-btn inventory-btn"
          onClick={onOpenInventory}
          title="Inventory"
          aria-label="Inventory"
        >
          <PixelIcon type="backpack" size={26} />
        </button>
        <button className="button icon-btn" onClick={onLogout} title="Logout">
          <PixelIcon type="power" size={26} />
        </button>
      </div>
    </header>
  );
});
