import { CSSProperties, memo } from 'react';
import { BackgroundDef, BackgroundElement } from '../data/backgrounds';

type SceneBackgroundProps = {
  def: BackgroundDef;
};

// Custom property consumed by .bg-el-peak shaping (cone silhouette colors).
type SceneElStyle = CSSProperties & { '--bg-el-color'?: string };

const getElementStyle = (el: BackgroundElement): CSSProperties => {
  const base: SceneElStyle = {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: el.width ?? el.size,
    height: el.height ?? el.size,
    color: el.color,
    '--bg-el-color': el.color,
    boxShadow: el.glow ? `0 0 ${Math.max(6, el.size)}px ${el.glow}` : undefined,
    animationDuration: `${el.speed ?? 1}s`,
    animationDelay: `${el.delay ?? 0}s`,
  };
  if (el.type === 'halo') {
    base.background = `radial-gradient(circle, ${el.color} 0%, transparent 70%)`;
  }
  if (el.rotate !== undefined) {
    // Standalone `rotate` property — never conflicts with animation transforms.
    base.rotate = `${el.rotate}deg`;
  }
  return base as CSSProperties;
};

/**
 * Generic pixel-background engine. Renders any `BackgroundDef` as an absolute
 * layer that fills its parent (the parent must be positioned). Reusable in any
 * window: boss raid combat, biomes, menus…
 */
export const SceneBackground = memo(function SceneBackground({ def }: SceneBackgroundProps) {
  const vars = {
    '--scene-accent': def.accent,
    '--scene-accent-alt': def.accentAlt ?? def.accent,
  } as CSSProperties;
  return (
    <>
      <div className="scene-bg-root" style={vars} aria-hidden="true">
        <div className="scene-bg">
          <div className="scene-bg-gradient" style={{ background: def.gradient }} />
          <div className="scene-bg-elements">
            {def.elements.map((el, i) => (
              <div
                key={i}
                className={`scene-bg-el bg-el-${el.type}`}
                style={getElementStyle(el)}
              />
            ))}
          </div>
          <div className="scene-bg-vignette" />
        </div>
      </div>
      {/* Sibling of the root: never trapped in the root's stacking context
          (z-index 0), so the tag stays above the combat content. Carries its
          own vars since siblings don't inherit the root's custom properties. */}
      {def.label && (
        <div className="scene-bg-tag" style={vars}>
          {def.label}
        </div>
      )}
    </>
  );
});