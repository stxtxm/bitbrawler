import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { EssenceGauge } from '../EssenceGauge';

interface ArenaHeaderProps {
  characterName: string;
  level: number;
  essence: number;
  onOpenSettings: () => void;
  onOpenInventory: () => void;
  onOpenForge?: () => void;
  onLogout: () => void;
}

export const ArenaHeader = memo(function ArenaHeader({
  characterName,
  level,
  essence,
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
          {essence > 0 && (
            <span className="essence-badge" title="Essence">💎 {essence.toFixed(2)}</span>
          )}
        </div>
        {essence > 0 && <EssenceGauge current={essence} />}
      </div>
      <div className="header-actions">
        <button className="button icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <PixelIcon type="gear" size={26} />
        </button>
        {onOpenForge && (
          <button className="button icon-btn forge-btn" onClick={onOpenForge} title="Forge" aria-label="Forge">
            <PixelIcon type="anvil" size={26} />
          </button>
        )}
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
