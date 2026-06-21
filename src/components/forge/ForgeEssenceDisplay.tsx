import { memo } from 'react';
import { ESSENCE_SOFT_CAP } from '../../data/forgeConstants';

interface ForgeEssenceDisplayProps {
  essence: number;
}

export const ForgeEssenceDisplay = memo(function ForgeEssenceDisplay({
  essence,
}: ForgeEssenceDisplayProps) {
  const isNearSoftCap = essence >= ESSENCE_SOFT_CAP - 50 && essence < ESSENCE_SOFT_CAP;
  const isAtCap = essence >= ESSENCE_SOFT_CAP;

  return (
    <div className={`forge-essence-bar ${isAtCap ? 'at-cap' : ''}`}>
      <span className="forge-essence-label">
        <span className="forge-essence-icon" aria-hidden="true">◆</span>
        {' '}ESSENCE
      </span>
      <span className="forge-essence-value">
        {essence}<span className="forge-essence-max"> / {ESSENCE_SOFT_CAP}</span>
      </span>
      {isNearSoftCap && (
        <span className="forge-essence-warning" role="status">
          ⚠ Near cap
        </span>
      )}
      {isAtCap && (
        <span className="forge-essence-warning" role="status">
          ⚠ MAXED
        </span>
      )}
    </div>
  );
});
