import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import type { BiomeDef } from '../../data/biomes';

interface ArenaHeaderProps {
  characterName: string;
  level: number;
  essence: number;
  surgeBiome?: BiomeDef | null;
  onOpenSettings: () => void;
  onOpenInventory: () => void;
  onOpenForge?: () => void;
  onLogout: () => void;
}

const SURGE_EMOJI: Record<string, string> = {
  plains: '🌿',
  volcanic: '🌋',
  abyssal: '🌊',
  abyss: '🌊',
  forest: '🌲',
  desert: '🏜️',
};

export const ArenaHeader = memo(function ArenaHeader({
  characterName,
  level,
  essence,
  surgeBiome,
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
          {surgeBiome && (
            <span
              className="surge-badge"
              title={`Biome Surge: ${surgeBiome.label} — +25% essence & XP`}
              aria-label={`Biome Surge ${surgeBiome.label}, bonus +25%`}
            >
              <span aria-hidden="true">{SURGE_EMOJI[surgeBiome.id] ?? '✨'}</span>
              <span className="surge-badge-label">{surgeBiome.label}</span>
              <span className="surge-badge-pct">+25%</span>
            </span>
          )}
        </div>
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
