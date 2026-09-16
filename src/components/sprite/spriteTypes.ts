export type SpriteBuild = 'slim' | 'standard' | 'broad';

export const SPRITE_BUILDS: SpriteBuild[] = ['slim', 'standard', 'broad'];

export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 36;

export type SpriteGrid = number[][];

export type SpritePalette = Record<number, string>;

export interface GeneratedSprite {
  grid: SpriteGrid;
  palette: SpritePalette;
  width: number;
  height: number;
}

export const SHADE_OFFSET = 30;
export const HIGHLIGHT_OFFSET = 40;
export const TRIM_INDEX = 60;
export const ACCENT_INDEX = 61;

export const shadeIndexOf = (base: number): number => SHADE_OFFSET + base;
export const highlightIndexOf = (base: number): number => HIGHLIGHT_OFFSET + base;
