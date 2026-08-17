import { memo } from 'react';
import { Character } from '../../types/Character';
import { IdleRunnerScene } from '../IdleRunnerScene';
import { PixelCharacter } from '../PixelCharacter';
import { ProceduralTerrain } from '../procedural/ProceduralTerrain';
import { BiomeTerrain } from '../procedural/BiomeTerrain';
import { getBiomeForCharacter } from '../../data/biomes';
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

  // Once the first raid boss is slain the character enters the volcanic biome:
  // the PvE training ground trades its scrolling plains for the flowing volcanic
  // terrain — the world visibly warms up.
  const biome = getBiomeForCharacter(character);
  const volcanicBiome = biome.id === 'volcanic';

  return (
    <div className="scene-box">
      {volcanicBiome ? (
        <BiomeTerrain
          biomeId={biome.id}
          seed={character.seed}
          animated={pveMode}
        />
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
          onMonsterTap={idle.registerTap}
          tapsUsed={idle.tapsUsed}
          tapMax={idle.tapMax}
        />
      ) : (
        <div className="scene-pvp-center">
          <PixelCharacter seed={character.seed} gender={character.gender} scale={pvpScale} />
        </div>
      )}
    </div>
  );
});
