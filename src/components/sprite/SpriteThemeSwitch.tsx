import { memo } from 'react';
import { setSpriteTheme, useSpriteTheme } from './spriteTheme';

export const SpriteThemeSwitch = memo(function SpriteThemeSwitch() {
  const theme = useSpriteTheme();
  const gb = theme === 'gb';
  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-label">
          <span>GAMEBOY MODE</span>
          <span className="settings-sub">Renders every sprite in 4-shade DMG-01.</span>
        </div>
        <button
          className={`pixel-switch ${gb ? 'on' : 'off'}`}
          onClick={() => setSpriteTheme(gb ? 'color' : 'gb')}
          role="switch"
          aria-checked={gb}
          aria-label="Gameboy mode"
        >
          <span className="switch-knob" />
          <span className="switch-text">{gb ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
});
