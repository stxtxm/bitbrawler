import { CSSProperties, memo } from 'react';
import { BossBackgroundDef, BossBgElement } from '../data/bossAssets';

type BossBackgroundProps = {
  def: BossBackgroundDef;
};

const getElementStyle = (el: BossBgElement): CSSProperties => {
  const base: CSSProperties = {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: el.size,
    height: el.size,
    color: el.color,
    boxShadow: el.glow ? `0 0 ${Math.max(6, el.size)}px ${el.glow}` : undefined,
    animationDuration: `${el.speed ?? 1}s`,
    animationDelay: `${el.delay ?? 0}s`,
  };
  if (el.type === 'halo') {
    base.background = `radial-gradient(circle, ${el.color} 0%, transparent 70%)`;
  }
  return base;
};

export const BossBackground = memo(function BossBackground({ def }: BossBackgroundProps) {
  const vars = {
    '--boss-accent': def.accent,
    '--boss-accent-alt': def.accentAlt ?? def.accent,
  } as CSSProperties;
  return (
    <>
      <div
        className="boss-bg"
        style={vars}
        aria-hidden="true"
      >
        <div className="boss-bg-gradient" style={{ background: def.gradient }} />
        <div className="boss-bg-elements">
          {def.elements.map((el, i) => (
            <div
              key={i}
              className={`boss-bg-el bg-el-${el.type}`}
              style={getElementStyle(el)}
            />
          ))}
        </div>
        <div className="boss-bg-vignette" />
      </div>
      {def.label && <div className="boss-bg-tag">{def.label}</div>}
    </>
  );
});