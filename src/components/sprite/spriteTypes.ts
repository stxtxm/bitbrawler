export type SpriteBuild = 'slim' | 'standard' | 'broad';

export const SPRITE_BUILDS: SpriteBuild[] = ['slim', 'standard', 'broad'];

export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 42;

export const SPRITE_PAD_TOP = 6;

export const SPRITE_DISPLAY_SCALE = 1.15;

// Cadence de la respiration d'attente, partagée entre le composant (minuteur
// des frames) et le générateur (qui date sa frame de clignement).
export const SPRITE_IDLE_MS = 400;

export const ITEM_BLIT_OFFSET = 70;

export type SpriteGrid = number[][];

export type SpritePalette = Record<number, string>;

export interface GeneratedSprite {
  grid: SpriteGrid;
  palette: SpritePalette;
  width: number;
  height: number;
  /** Durée d'affichage de cette frame (ms). Sinon la cadence de l'animation. */
  ms?: number;
}

export const SHADE_OFFSET = 30;
export const HIGHLIGHT_OFFSET = 40;
export const TRIM_INDEX = 60;
export const ACCENT_INDEX = 61;
/**
 * Trait de visage sombre, dérivé de la couleur de cheveux : sourcils et
 * pupilles. Un index à part évite de réutiliser l'ombre du vêtement (qui
 * disparaît sur les cheveux clairs) ou le blanc des yeux.
 */
export const BROW_INDEX = 62;

export const shadeIndexOf = (base: number): number => SHADE_OFFSET + base;
export const highlightIndexOf = (base: number): number => HIGHLIGHT_OFFSET + base;

export type SpriteAnimKind = 'run' | 'attack' | 'idle' | 'hit' | 'victory';
