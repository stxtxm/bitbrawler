import { memo } from 'react';
import { Character } from '../../types/Character';
import { IdleRunnerScene } from '../IdleRunnerScene';
import { PixelCharacter } from '../PixelCharacter';
import { ProceduralTerrain } from '../procedural/ProceduralTerrain';
import type { ArenaIdleViewModel } from './arenaTypes';

interface SceneBoxProps {
  character: Character;
  effectiveCharacter: Character;
  pveMode: boolean;
  idle: ArenaIdleViewModel;
}

export const SceneBox = memo(function SceneBox({
  character,
  effectiveCharacter,
  pveMode,
  idle,
}: SceneBoxProps) {
  const pvpScale = typeof window !== 'undefined' && window.innerWidth < 480 ? 6 : 8;

  return (
    <div className="scene-box">
      <ProceduralTerrain
        seed={character.seed}
        animated={pveMode}
      />
      {pveMode ? (
        <IdleRunnerScene
          character={effectiveCharacter}
          currentMonster={idle.currentMonster}
          scenePhase={idle.scenePhase}
          lastCombatResult={idle.lastCombatResult}
          lastCombatXp={idle.lastCombatXp}
          offlineGains={idle.offlineGains}
          onClearOfflineGains={idle.clearOfflineGains}
          currentStreak={idle.currentStreak}
          streakMilestone={idle.streakMilestone}
          efficiency={idle.efficiency}
          xpPerMinute={idle.xpPerMinute}
          essencePerMinute={idle.essencePerMinute}
          powerRatio={idle.powerRatio}
        />
      ) : (
        <div className="scene-pvp-center">
          <PixelCharacter seed={character.seed} gender={character.gender} scale={pvpScale} />
        </div>
      )}
    </div>
  );
});
