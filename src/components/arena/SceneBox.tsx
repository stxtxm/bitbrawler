import { memo } from 'react';
import { Character } from '../../types/Character';
import { IdleRunnerScene } from '../IdleRunnerScene';
import { SpriteCanvas } from '../sprite/SpriteCanvas';
import { ProceduralTerrain } from '../procedural/ProceduralTerrain';
import { BiomeTerrain } from '../procedural/BiomeTerrain';
import { getBiomeForCharacter } from '../../data/biomes';
import { useLowPerformanceMode } from '../../hooks/useLowPerformanceMode';
import { getBiomeLighting, sceneLightingStyle } from './sceneLighting';
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
  const lowPerf = useLowPerformanceMode();

  // Once the first raid boss is slain the character enters the volcanic biome:
  // the PvE training ground trades its scrolling plains for the flowing volcanic
  // terrain — the world visibly warms up.
  const biome = getBiomeForCharacter(character);
  const volcanicBiome = biome.id === 'volcanic';
  const lighting = getBiomeLighting(biome.id);

  return (
    <div
      className={`scene-box${lowPerf ? ' scene-low-perf' : ''}`}
      data-biome={biome.id}
      data-low-perf={lowPerf ? 'true' : 'false'}
      style={sceneLightingStyle(lighting, lowPerf)}
    >
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
      <div
        className="scene-lighting"
        data-biome={biome.id}
        data-low-perf={lowPerf ? 'true' : 'false'}
        aria-hidden="true"
      />
      {/* La key force le remontage du wrapper uniquement à la bascule de
          mode : l'animation sceneSwap (fade CSS) se rejoue à chaque swap,
          sans jamais interférer avec le screen-shake des combats (fils). */}
      <div className="scene-swap" key={pveMode ? 'pve' : 'pvp'}>
        {pveMode ? (
          <IdleRunnerScene
            character={effectiveCharacter}
            appearance={effectiveCharacter.appearance}
            currentMonster={idle.currentMonster}
            scenePhase={idle.scenePhase}
            lastCombatResult={idle.lastCombatResult}
            lastCombatXp={idle.lastCombatXp}
            offlineGains={idle.offlineGains}
            onClearOfflineGains={idle.clearOfflineGains}
            recentLevelUp={idle.recentLevelUp}
            currentStreak={idle.currentStreak}
            streakMilestone={idle.streakMilestone}
            eliteName={idle.eliteName ?? null}
            eliteElement={idle.eliteElement ?? null}
          />
        ) : (
          <div className="scene-pvp-center">
            <div className="fighter-character-wrap">
              <SpriteCanvas
                seed={character.seed}
                gender={character.gender}
                appearance={character.appearance}
                equippedItems={character.equippedItems}
                scale={pvpScale}
                animate="idle"
                className="pixel-character"
              />
              <div className="scene-ground-shadow" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
