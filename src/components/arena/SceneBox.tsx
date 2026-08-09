import { memo } from 'react';
import { Character } from '../../types/Character';
import { IdleRunnerScene } from '../IdleRunnerScene';
import { PixelCharacter } from '../PixelCharacter';
import { ProceduralTerrain } from '../procedural/ProceduralTerrain';
import { SceneBackground } from '../SceneBackground';
import { VOLCANIC_BACKGROUND } from '../../data/backgrounds';
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

  // Once the first raid boss is slain, the PvE training ground trades its
  // scrolling plains for the volcanic arena — the world visibly warms up.
  const volcanicArena = pveMode && (character.bossProgress?.totalKills ?? 0) > 0;

  return (
    <div className="scene-box">
      {volcanicArena ? (
        <SceneBackground def={VOLCANIC_BACKGROUND} />
      ) : (
        <ProceduralTerrain
          seed={character.seed}
          animated={pveMode}
        />
      )}
      {pveMode ? (
        <IdleRunnerScene
          character={effectiveCharacter}
          currentMonster={idle.currentMonster}
          scenePhase={idle.scenePhase}
          lastCombatResult={idle.lastCombatResult}
          lastCombatXp={idle.lastCombatXp}
          offlineGains={idle.offlineGains}
          onClearOfflineGains={idle.clearOfflineGains}
          recentLevelUp={idle.recentLevelUp}
          currentStreak={idle.currentStreak}
          streakMilestone={idle.streakMilestone}
        />
      ) : (
        <div className="scene-pvp-center">
          <PixelCharacter seed={character.seed} gender={character.gender} scale={pvpScale} />
        </div>
      )}
    </div>
  );
});
