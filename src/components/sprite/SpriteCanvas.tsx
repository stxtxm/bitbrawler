import { memo, useMemo } from 'react';
import { ELEMENT_COLORS, Element } from '../../types/Item';
import type { CharacterAppearance } from '../../types/Character';
import { PixelGridCanvas } from './PixelGridCanvas';
import { applyEquipmentOverlays, resolveLoadout } from './equipOverlays';
import { generateSprite16 } from './spriteGenerator';

interface SpriteCanvasProps {
  seed: string;
  gender: 'male' | 'female';
  scale?: number;
  className?: string;
  appearance?: CharacterAppearance | null;
  equippedItems?: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  } | null;
  aura?: Element | null;
}

export const SpriteCanvas = memo(function SpriteCanvas({
  seed,
  gender,
  scale = 4,
  className,
  appearance,
  equippedItems,
  aura,
}: SpriteCanvasProps) {
  const { grid, palette } = useMemo(() => {
    const base = generateSprite16(seed, gender, appearance);
    if (!equippedItems) return base;
    const overlaid = applyEquipmentOverlays(base.grid, base.palette, resolveLoadout(equippedItems));
    return { grid: overlaid.grid, palette: overlaid.palette };
  }, [seed, gender, appearance, equippedItems]);

  return (
    <PixelGridCanvas
      grid={grid}
      palette={palette}
      scale={scale}
      label={`fighter-${seed}`}
      className={className}
      glowColor={aura ? ELEMENT_COLORS[aura] : null}
    />
  );
});
