import { memo, useEffect, useMemo, useState } from 'react';
import { ELEMENT_COLORS, Element } from '../../types/Item';
import type { CharacterAppearance } from '../../types/Character';
import { PixelGridCanvas } from './PixelGridCanvas';
import { applyEquipmentOverlays, resolveLoadout } from './equipOverlays';
import { generateSprite16, generateSpriteFrames, mirrorSpriteGrid, ATTACK_IMPACT_FRAME, SpriteAnimKind } from './spriteGenerator';
import { SPRITE_DISPLAY_SCALE, SPRITE_IDLE_MS } from './spriteTypes';
import { useLowPerformanceMode } from '../../hooks/useLowPerformanceMode';

export const SPRITE_RUN_MS = 120;
export const SPRITE_ATTACK_MS = 130;
// Respiration d'attente : 400 ms par palier (constante partagée avec le
// générateur, qui date sa frame de clignement). L'ancien réglage (280 ms)
// faisait gigoter le buste — un souffle posé tient ses poses plus longtemps.
export { SPRITE_IDLE_MS };
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
  /** Mirror the sprite horizontally (PvP opponent: faces the player, weapon in
   *  the other hand). Applied to the pixel grid, so CSS animations cannot
   *  cancel it. */
  flip?: boolean;
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
  flip = false,
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
    // Chaîne de timeouts (et non un intervalle fixe) : une frame peut imposer
    // sa propre durée — le clignement d'œil dure 140 ms là où la respiration
    // tient 400 ms, sinon le personnage cligne au ralenti.
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (index + 1 >= frames.length) {
          if (isOneShot) return; // l'animation reste sur sa dernière image
          index = 0;
        } else {
          index += 1;
        }
        setFrameIdx(index);
        schedule();
      }, frames[index]?.ms ?? frameMs);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [frames, frameMs, activeAnim]);

  const { grid, palette } = useMemo(() => {
    const base = frames && frames.length > 0 ? frames[frameIdx % frames.length] : generateSprite16(seed, gender, appearance);
    if (!equippedItems) {
      return flip ? { grid: mirrorSpriteGrid(base.grid), palette: base.palette } : base;
    }
    // Dynamic life: jewelry swings with the stride. The weapon does NOT get a
    // fake horizontal sway: the run keeps the arms glued, so a ±1 px weapon
    // offset slid the hilt through a stationary fist. The palm anchors are
    // recomputed on the animated grid, so the weapon still follows breathing,
    // recoil and the punch without ever leaving the hand.
    const running = activeAnim === 'run' && frames && frames.length > 0;
    const victory = activeAnim === 'victory' && frames && frames.length > 0;
    const swingX = running ? ([-1, -1, 0, 1, 1, 0][frameIdx % frames.length] ?? 0) : 0;
    const punchTrail = (activeAnim === 'attack' && frameIdx === ATTACK_IMPACT_FRAME) || (victory && frameIdx === 1) ? 3 : 0;
    const overlaid = applyEquipmentOverlays(base.grid, base.palette, resolveLoadout(equippedItems), { swingX, punchTrail });
    return {
      grid: flip ? mirrorSpriteGrid(overlaid.grid) : overlaid.grid,
      palette: overlaid.palette,
    };
  }, [frames, frameIdx, activeAnim, seed, gender, appearance, equippedItems, flip]);

  return (
    <PixelGridCanvas
      grid={grid}
      palette={palette}
      scale={(scale / 2) * SPRITE_DISPLAY_SCALE}
      label={`fighter-${seed}`}
      className={className}
      glowColor={aura ? ELEMENT_COLORS[aura] : null}
      flip={flip}
      anim={frames && frames.length > 0 ? (activeAnim ?? 'static') : 'static'}
    />
  );
});
