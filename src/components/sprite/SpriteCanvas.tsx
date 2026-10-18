import { memo, useEffect, useMemo, useState } from 'react';
import { ELEMENT_COLORS, Element } from '../../types/Item';
import type { CharacterAppearance } from '../../types/Character';
import { PixelGridCanvas } from './PixelGridCanvas';
import { applyEquipmentOverlays, resolveLoadout } from './equipOverlays';
import { generateSprite16, generateSpriteFrames, SpriteAnimKind } from './spriteGenerator';
import { SPRITE_DISPLAY_SCALE } from './spriteTypes';
import { useLowPerformanceMode } from '../../hooks/useLowPerformanceMode';

export const SPRITE_RUN_MS = 120;
export const SPRITE_ATTACK_MS = 130;
export const SPRITE_IDLE_MS = 280;
export const SPRITE_HIT_MS = 140;
export const SPRITE_VICTORY_MS = 200;

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
  const frameMs =
    activeAnim === 'attack'
      ? SPRITE_ATTACK_MS
      : activeAnim === 'hit'
        ? SPRITE_HIT_MS
        : activeAnim === 'victory'
          ? SPRITE_VICTORY_MS
          : activeAnim === 'idle'
            ? SPRITE_IDLE_MS
            : SPRITE_RUN_MS;

  const [frameIdx, setFrameIdx] = useState(0);
  useEffect(() => {
    setFrameIdx(0);
    if (!frames || frames.length === 0) return;
    const isOneShot = activeAnim === 'attack' || activeAnim === 'hit';
    const timer = setInterval(() => setFrameIdx((i) => {
      if (isOneShot && i >= frames.length - 1) return i;
      return (i + 1) % frames.length;
    }), frameMs);
    return () => clearInterval(timer);
  }, [frames, frameMs, activeAnim]);

  const { grid, palette } = useMemo(() => {
    const base = frames && frames.length > 0 ? frames[frameIdx % frames.length] : generateSprite16(seed, gender, appearance);
    if (!equippedItems) return base;
    // Dynamic life: weapon and jewelry sway with stride / breathing
    const running = activeAnim === 'run' && frames && frames.length > 0;
    const idling = activeAnim === 'idle' && frames && frames.length > 0;
    const victory = activeAnim === 'victory' && frames && frames.length > 0;
    const swayX = running
      ? ([1, 1, 0, -1, -1, 0][frameIdx % frames.length] ?? 0)
      : idling
        ? ([0, 1, 1, 0, -1, 0][frameIdx % frames.length] ?? 0)
        : 0;
    const swingX = running
      ? ([-1, -1, 0, 1, 1, 0][frameIdx % frames.length] ?? 0)
      : idling
        ? ([0, 0, 1, 0, 0, 0][frameIdx % frames.length] ?? 0)
        : 0;
    const punchTrail = (activeAnim === 'attack' && frameIdx === 1) || (victory && frameIdx === 1) ? 3 : 0;
    const overlaid = applyEquipmentOverlays(base.grid, base.palette, resolveLoadout(equippedItems), { swayX, swingX, punchTrail });
    return { grid: overlaid.grid, palette: overlaid.palette };
  }, [frames, frameIdx, activeAnim, seed, gender, appearance, equippedItems]);

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
