import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { PASS_TIERS, calculatePassXp, getProgressPct } from '../data/seasonalPass';

function getClaimedKey(charId: string): string {
  return `bitbrawler_pass_claimed_${charId}`;
}

function readClaimed(charId: string): number[] {
  try {
    const raw = localStorage.getItem(getClaimedKey(charId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n: unknown) => typeof n === 'number' && Number.isFinite(n));
  } catch {
    return [];
  }
}

function writeClaimed(charId: string, claimed: number[]): void {
  try {
    localStorage.setItem(getClaimedKey(charId), JSON.stringify(claimed));
  } catch {
    return;
  }
}

export function usePassProgress() {
  const { activeCharacter, setCharacter } = useGame();
  const charId = activeCharacter?.id ?? activeCharacter?.seed ?? '';

  const tiers = useMemo(() => PASS_TIERS, []);

  const currentXp = useMemo(() => {
    if (!activeCharacter) return 0;
    return calculatePassXp(activeCharacter);
  }, [activeCharacter]);

  const progressPct = useMemo(() => getProgressPct(currentXp), [currentXp]);

  const [claimedTiers, setClaimedTiers] = useState<number[]>(() => {
    if (!charId) return [];
    const local = readClaimed(charId);
    const fromChar = activeCharacter?.passProgress?.claimed;
    if (Array.isArray(fromChar)) {
      const merged = Array.from(new Set([...local, ...fromChar])).sort((a, b) => a - b);
      return merged;
    }
    return local.sort((a, b) => a - b);
  });

  useEffect(() => {
    if (!charId) {
      setClaimedTiers([]);
      return;
    }
    const local = readClaimed(charId);
    const fromChar = activeCharacter?.passProgress?.claimed;
    const merged = Array.isArray(fromChar)
      ? Array.from(new Set([...local, ...fromChar])).sort((a, b) => a - b)
      : local.sort((a, b) => a - b);
    setClaimedTiers(merged);
  }, [charId, activeCharacter]);

  const canClaim = useCallback(
    (tier: number) => {
      const target = tiers.find((t) => t.level === tier);
      if (!target) return false;
      if (claimedTiers.includes(tier)) return false;
      return currentXp >= target.xpRequired;
    },
    [tiers, claimedTiers, currentXp]
  );

  const claimTier = useCallback(
    (tier: number): boolean => {
      if (!canClaim(tier)) return false;
      const next = [...claimedTiers, tier].sort((a, b) => a - b);
      setClaimedTiers(next);
      if (charId) writeClaimed(charId, next);
      if (activeCharacter) {
        const nextProgress = { xp: currentXp, claimed: next };
        const updated = { ...activeCharacter, passProgress: nextProgress };
        void (async () => {
          try {
            setCharacter(updated);
          } catch {
            return;
          }
        })();
      }
      return true;
    },
    [canClaim, claimedTiers, charId, activeCharacter, currentXp, setCharacter]
  );

  return {
    tiers,
    claimedTiers,
    currentXp,
    progressPct,
    canClaim,
    claimTier,
  };
}
