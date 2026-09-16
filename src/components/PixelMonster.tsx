import { MONSTER_ASSETS, MonsterId } from '../data/monsterAssets';
import { BOSS_ASSETS, BossId } from '../data/bossAssets';
import { ELEMENT_COLORS, Element } from '../types/Item';
import { PixelGridCanvas } from './sprite/PixelGridCanvas';

type PixelMonsterProps = {
  monsterId: MonsterId | BossId;
  scale?: number;
  aura?: Element | null;
};

export function PixelMonster({ monsterId, scale = 4, aura }: PixelMonsterProps) {
  const def =
    MONSTER_ASSETS.find(m => m.id === monsterId) ??
    BOSS_ASSETS.find(b => b.id === monsterId);
  if (!def) return null;

  const glow = aura ? ELEMENT_COLORS[aura] : null;

  return (
    <PixelGridCanvas
      grid={def.pixels}
      palette={def.palette as Record<number, string>}
      scale={scale}
      label={def.name}
      glowColor={glow}
    />
  );
}
