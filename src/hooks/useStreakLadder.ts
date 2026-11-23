import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  buildStreakLadder,
  findOwnEntry,
  getWeekKey,
  normalizeLadderStreak,
  type StreakLadderEntry,
} from '../utils/streakLadderUtils';
import {
  fetchStreakLadder,
  loadLadderBadges,
  recordLadderBadge,
  submitStreakLadderEntryIfChanged,
  type LadderBadgeMap,
} from '../utils/streakLadderStorage';

export interface UseStreakLadderResult {
  weekKey: string;
  entries: StreakLadderEntry[];
  ownEntry: StreakLadderEntry | null;
  badges: LadderBadgeMap;
  loading: boolean;
  available: boolean;
  refresh: () => Promise<void>;
}

export function useStreakLadder(): UseStreakLadderResult {
  const { activeCharacter } = useGame();
  const characterId = activeCharacter?.id;
  const characterName = activeCharacter?.name;
  const lootboxStreak = activeCharacter?.lootboxStreak ?? 0;

  const [weekKey, setWeekKey] = useState(() => getWeekKey(Date.now()));
  const [entries, setEntries] = useState<StreakLadderEntry[]>([]);
  const [badges, setBadges] = useState<LadderBadgeMap>({});
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    const currentWeek = getWeekKey(Date.now());
    setWeekKey(currentWeek);
    setLoading(true);

    try {
      if (characterId) {
        await submitStreakLadderEntryIfChanged(
          {
            characterId,
            name: characterName ?? 'UNKNOWN',
            streak: normalizeLadderStreak(lootboxStreak),
          },
          currentWeek,
        );
      }

      const result = await fetchStreakLadder(currentWeek);
      const ladder = buildStreakLadder(result.entries);
      setEntries(ladder);
      setAvailable(result.available);

      if (characterId) {
        const own = findOwnEntry(ladder, characterId);
        setBadges(recordLadderBadge(characterId, currentWeek, own?.tier ?? null));
      }
    } catch {
      setEntries([]);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [characterId, characterName, lootboxStreak]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setBadges(characterId ? loadLadderBadges(characterId) : {});
  }, [characterId]);

  const ownEntry = useMemo(
    () => (characterId ? findOwnEntry(entries, characterId) : null),
    [entries, characterId],
  );

  return { weekKey, entries, ownEntry, badges, loading, available, refresh };
}
