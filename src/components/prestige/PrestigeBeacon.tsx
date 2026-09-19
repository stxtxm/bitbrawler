import { memo, useMemo } from 'react';
import { calcFaith, capOfflineHours, getFaithBonus, faithPerHour as calcFaithPerHour } from '../../utils/prestigeUtils';

interface PrestigeBeaconProps {
  faith: number;
  nextFaith: number;
  faithPerHour: number;
  xpTotal: number;
  hoursPlayed: number;
  onPrestige: () => void;
  isPeak: boolean;
}

function getPaybackFraction(faith: number, nextFaith: number, hoursPlayed: number): number {
  if (nextFaith <= faith) return 1;
  const capped = capOfflineHours(hoursPlayed);
  const mult = getFaithBonus(nextFaith) / getFaithBonus(faith);
  if (mult <= 1) return 1;
  const ratio = mult / (mult - 1);
  const rebuildTime = 100 / ratio;
  const horizon = capped + 20;
  return rebuildTime / horizon;
}

function getSignal(fraction: number): { text: string; cls: string } {
  if (fraction < 0.25) return { text: 'Reset now (<25% horizon)', cls: 'prestige-beacon-signal--green' };
  if (fraction < 0.6) return { text: 'Good but not urgent (25-60%)', cls: 'prestige-beacon-signal--yellow' };
  return { text: 'Borderline/delay (>60%)', cls: 'prestige-beacon-signal--gray' };
}

export const PrestigeBeacon = memo(function PrestigeBeacon({
  faith,
  nextFaith,
  faithPerHour,
  xpTotal,
  hoursPlayed,
  onPrestige,
  isPeak,
}: PrestigeBeaconProps) {
  const bonusPct = Math.round((getFaithBonus(faith) - 1) * 100);
  const cappedHours = capOfflineHours(hoursPlayed);
  const signal = useMemo(() => getSignal(getPaybackFraction(faith, nextFaith, hoursPlayed)), [faith, nextFaith, hoursPlayed]);
  const projected = useMemo(() => {
    const xpPerHour = cappedHours > 0 ? xpTotal / cappedHours : 0;
    const xpPerMin = xpPerHour / 60;
    const projXp = xpTotal + xpPerMin * 12;
    const projFaith = calcFaith(projXp);
    const projRate = calcFaithPerHour(projFaith, cappedHours + 0.2);
    return { projFaith, projRate };
  }, [xpTotal, cappedHours]);

  return (
    <div className="prestige-beacon">
      <div className="prestige-beacon-faith">
        Faith +{faith} (→ +{bonusPct}% global)
      </div>
      <div className="prestige-beacon-rate">
        Faith/hour {faithPerHour.toFixed(2)} — Faith/hour peak dans 12min ({projected.projFaith} → {projected.projRate.toFixed(2)}/h)
      </div>
      <div data-testid="payback-signal" className={`prestige-beacon-signal ${signal.cls}`}>
        {signal.text}
      </div>
      {isPeak && (
        <button
          className="prestige-beacon-btn prestige-beacon-btn--pulse"
          onClick={onPrestige}
          title="second run 40-60% faster"
          aria-label="Prestige now"
        >
          Prestige
        </button>
      )}
    </div>
  );
});
