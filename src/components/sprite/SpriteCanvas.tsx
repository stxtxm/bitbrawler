import { memo, useEffect, useMemo, useState } from 'react';
import { ELEMENT_COLORS, Element } from '../../types/Item';
import type { CharacterAppearance } from '../../types/Character';
import { PixelGridCanvas } from './PixelGridCanvas';
import { applyEquipmentOverlays, resolveLoadout } from './equipOverlays';
import { generateSprite16, generateSpriteFrames, SpriteAnimKind } from './spriteGenerator';
import { SPRITE_DISPLAY_SCALE } from './spriteTypes';
import { useLowPerformanceMode } from '../../hooks/useLowPerformanceMode';

export const SPRITE_RUN_MS = 150;
export const SPRITE_ATTACK_MS = 110;

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
  animate?: SpriteAnimKind | null;
}

export const SpriteCanvas = memo(function SpriteCanvas({
  seed,
  gender,
  scale = 4,
  className,
  appearance,
  equippedItems,
  aura,
  animate = null,
}: SpriteCanvasProps) {
  const lowPerf = useLowPerformanceMode();
  const activeAnim = !lowPerf ? animate : null;
  const frames = useMemo(
    () => (activeAnim ? generateSpriteFrames(seed, gender, appearance, activeAnim) : null),
    [activeAnim, seed, gender, appearance],
  );
  const frameMs = activeAnim === 'attack' ? SPRITE_ATTACK_MS : SPRITE_RUN_MS;
  const [frameIdx, setFrameIdx] = useState(0);
  useEffect(() => {
    setFrameIdx(0);
    if (!frames || frames.length === 0) return;
    const timer = setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), frameMs);
    return () => clearInterval(timer);
  }, [frames, frameMs]);

  const { grid, palette } = useMemo(() => {
    const base = frames && frames.length > 0 ? frames[frameIdx % frames.length] : generateSprite16(seed, gender, appearance);
    if (!equippedItems) return base;
    const overlaid = applyEquipmentOverlays(base.grid, base.palette, resolveLoadout(equippedItems));
    return { grid: overlaid.grid, palette: overlaid.palette };
  }, [frames, frameIdx, seed, gender, appearance, equippedItems]);

  return (
    <PixelGridCanvas
      grid={grid}
      palette={palette}
      scale={(scale / 2) * SPRITE_DISPLAY_SCALE}
      label={`fighter-${seed}`}
      className={className}
      glowColor={aura ? ELEMENT_COLORS[aura] : null}
    />
  );
});
