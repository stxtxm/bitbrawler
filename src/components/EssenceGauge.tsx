import { memo } from 'react';
import { ESSENCE_SOFT_CAP, ESSENCE_HARD_CAP } from '../data/forgeConstants';

interface EssenceGaugeProps {
  current: number;
}

/**
 * Essence progression gauge showing where the player is relative to
 * the soft cap (750) and hard cap (1000).
 *
 * Colors:
 *   0–750    green
 *   750–1000 orange
 *   1000     red (full)
 */
export const EssenceGauge = memo(function EssenceGauge({ current }: EssenceGaugeProps) {
  const pct = Math.min((current / ESSENCE_HARD_CAP) * 100, 100);
  const atHardCap = current >= ESSENCE_HARD_CAP;
  const aboveSoftCap = current >= ESSENCE_SOFT_CAP;

  const barClass = atHardCap
    ? 'essence-gauge-fill essence-gauge-red'
    : aboveSoftCap
      ? 'essence-gauge-fill essence-gauge-orange'
      : 'essence-gauge-fill essence-gauge-green';

  return (
    <div className="essence-gauge">
      <div className="essence-gauge-bar">
        <div
          className={barClass}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="essence-gauge-text">
        {atHardCap ? `Essence au maximum! (${current}/${ESSENCE_HARD_CAP})` : `${current}/${ESSENCE_HARD_CAP}`}
      </span>
    </div>
  );
});
