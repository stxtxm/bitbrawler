import { memo, useMemo } from 'react';
import { Character } from '../../types/Character';
import { formatXpDisplay, getMaxLevel, getXpProgress } from '../../utils/xpUtils';
import { ExperienceBar } from './ExperienceBar';
import { SceneBox } from './SceneBox';
import { StatsPanel } from './StatsPanel';
import type { ArenaIdleViewModel, ArenaStatOption } from './arenaTypes';

interface CharacterDisplayProps {
  character: Character;
  effectiveCharacter: Character;
  pveMode: boolean;
  xpBarAnimating: boolean;
  showXpGain: boolean;
  lastXpGain: number | null;
  statOptions: ArenaStatOption[];
  idle: ArenaIdleViewModel;
}

export const CharacterDisplay = memo(function CharacterDisplay({
  character,
  effectiveCharacter,
  pveMode,
  xpBarAnimating,
  showXpGain,
  lastXpGain,
  statOptions,
  idle,
}: CharacterDisplayProps) {
  const xpProgress = useMemo(() => getXpProgress(character), [character]);
  const xpText = useMemo(() => formatXpDisplay(character), [character]);
  const isMaxLevel = character.level >= getMaxLevel();

  return (
    <div className="character-display">
      <SceneBox
        character={character}
        effectiveCharacter={effectiveCharacter}
        pveMode={pveMode}
        idle={idle}
      />
      <ExperienceBar
        xpText={xpText}
        xpPercentage={xpProgress.percentage}
        xpBarAnimating={xpBarAnimating}
        isMaxLevel={isMaxLevel}
        showXpGain={showXpGain}
        lastXpGain={lastXpGain}
      />
      <StatsPanel
        effectiveCharacter={effectiveCharacter}
        pveMode={pveMode}
        statOptions={statOptions}
        idle={idle}
      />
    </div>
  );
});
