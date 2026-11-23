import { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { getWeekKey, normalizeLadderStreak } from '../utils/streakLadderUtils';
import { submitStreakLadderEntryIfChanged } from '../utils/streakLadderStorage';

export function useStreakLadderSubmission(): void {
  const { activeCharacter } = useGame();
  const characterId = activeCharacter?.id;
  const characterName = activeCharacter?.name;
  const lootboxStreak = activeCharacter?.lootboxStreak ?? 0;

  useEffect(() => {
    if (!characterId) return;

    void submitStreakLadderEntryIfChanged(
      {
        characterId,
        name: characterName ?? 'UNKNOWN',
        streak: normalizeLadderStreak(lootboxStreak),
      },
      getWeekKey(Date.now()),
    );
  }, [characterId, characterName, lootboxStreak]);
}
