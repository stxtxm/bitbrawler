import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { SpriteGrid, SpritePalette } from './spriteTypes';
import { spritePixelScale } from './spritePixelScale';

/**
 * Bump on every sprite-rendering change. Rendered as `data-render-rev` so
 * the deployed revision can be read straight off the production bundle.
 *
 * r1160 : pixels entiers (device) + boîtes CSS à ratio natif — le rendu
 *         précédent échantillonnait à 2,875/3,45 px et étirait les sprites de
 *         17 %, ce qui faisait « grésiller » les animations.
 * r1170 : souffle en demi-pas — le buste monte en deux paliers d'un pixel au
 *         lieu d'un saut de cellule, sur un cycle de 8 s moins « lévitation ».
 * r1174 : les mèches extérieures bougent seules (plus de frange qui claque sur
 *         le front) et l'arme reste ancrée dans le poing pendant le run.
 * r1175 : l'arme pivote autour de la paume (run, attaque, touche, victoire),
 *         avec des têtes de masse/marteau lisibles et une lame effilée.
 * r1177 : le feedback du coup (dégâts, réaction, flash) attend la frame
 *         d'impact de l'attaque au lieu de partir au début du round.
 * r1178 : la main se referme sur l'arme — la poignée ne repeint plus l'avant-
 *         bras, le pommeau dépasse sous le poing et un liseré sombre détache
 *         l'arme du fond.
 * r1179 : l'arme frappe vraiment — chambre à la verticale puis balayage
 *         jusqu'au bord de la grille, amplitude mesurée par famille d'arme
 *         (une dague balaie 49°, un bâton 14°), allonge du poing ramenée de
 *         4 à 2 px et corps calé sur la frame d'impact.
 */
export const SPRITE_RENDER_REV = 'r1180-jewel-anchor';

function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState<number>(
    () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
  );
  useEffect(() => {
    const update = () => setDpr((window.devicePixelRatio || 1));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return dpr;
}


interface PixelGridCanvasProps {
  grid: SpriteGrid;
  palette: SpritePalette;
  scale?: number;
  label?: string;
  className?: string;
  glowColor?: string | null;
  /** Purely declarative: the grid is already mirrored by the caller. Exposed as
   *  `data-flip` so the mirrored fighter can be asserted from tests / DOM. */
  flip?: boolean;
  /** Animation d'origine du sprite — rendue en `data-anim`. Le CSS s'en sert
   *  pour ne PAS superposer ses propres rebonds quand les frames animent déjà
   *  le personnage (`static` = pas de frames, ex. mode basse performance). */
  anim?: string;
}

interface BitmapEntry {
  palette: SpritePalette;
  width: number;
  height: number;
  img: ImageData;
}

const bitmapCache = new WeakMap<SpriteGrid, BitmapEntry>();

function parseHex(hex: string): [number, number, number] | null {
  if (!hex || hex === 'transparent') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  if (full.length !== 6) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function buildBitmap(grid: SpriteGrid, palette: SpritePalette, width: number, height: number): ImageData | null {
  const cached = bitmapCache.get(grid);
  if (cached && cached.palette === palette && cached.width === width && cached.height === height) {
    return cached.img;
  }
  let img: ImageData;
  try {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const offCtx = off.getContext('2d');
    if (!offCtx || typeof offCtx.createImageData !== 'function') return null;
    img = offCtx.createImageData(width, height);
  } catch {
    return null;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = parseHex(palette[grid[y][x]] ?? '');
      const i = (y * width + x) * 4;
      if (!rgb) {
        img.data[i + 3] = 0;
        continue;
      }
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  bitmapCache.set(grid, { palette, width, height, img });
  return img;
}

export const PixelGridCanvas = memo(function PixelGridCanvas({
  grid,
  palette,
  scale = 4,
  label,
  className,
  glowColor,
  flip = false,
  anim,
}: PixelGridCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const dpr = useDevicePixelRatio();

  // Boîte CSS du sprite (px), lue depuis `--sprite-box-h` : c'est le CSS du
  // contexte qui décide de la taille affichée (donc des media queries), et on
  // en déduit un nombre entier de pixels physiques par pixel de sprite.
  const [boxHeight, setBoxHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      let raw = '';
      try {
        raw = getComputedStyle(el).getPropertyValue('--sprite-box-h');
      } catch {
        raw = '';
      }
      const parsed = Number.parseFloat(raw);
      setBoxHeight((cur) => {
        const next = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        return cur === next ? cur : next;
      });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const pixelScale = spritePixelScale({ boxHeight, gridHeight: height, fallbackScale: scale, dpr });
  const deviceWidth = Math.max(1, width * pixelScale);
  const deviceHeight = Math.max(1, height * pixelScale);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width === 0 || height === 0) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.putImageData !== 'function') return;
    const img = buildBitmap(grid, palette, width, height);
    if (!img) return;
    let off: HTMLCanvasElement | null = null;
    try {
      off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d')?.putImageData(img, 0, 0);
    } catch {
      return;
    }
    if (!off) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (glowColor) {
      const rgb = parseHex(glowColor);
      if (rgb) {
        const glow = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2,
        );
        glow.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
        glow.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [grid, palette, width, height, pixelScale, glowColor]);

  // Le canvas s'affiche exactement à sa taille physique : 1 pixel du bitmap =
  // 1 pixel physique, dans les deux axes. Toute autre combinaison (taille CSS
  // différente du bitmap) ferait rééchantillonner l'image — c'est précisément
  // ce qui rendait les animations « chelou » (pixels de tailles inégales qui
  // se déplacent). La taille cible reste pilotée par le CSS via
  // `--sprite-box-h`, à ±7 % près (arrondi au nombre entier de pixels
  // physiques le plus proche).
  const style: CSSProperties = {
    imageRendering: 'pixelated',
    width: `${deviceWidth / dpr}px`,
    height: `${deviceHeight / dpr}px`,
  };

  return (
    <canvas
      ref={ref}
      width={deviceWidth}
      height={deviceHeight}
      className={className}
      aria-label={label}
      data-glow={glowColor ? 'on' : 'off'}
      data-flip={flip ? 'on' : 'off'}
      data-anim={anim ?? 'static'}
      // Deployment probe. Bump this string whenever the sprite renderer
      // changes: it is greppable inside the minified production bundle, so a
      // deployed revision can be confirmed from outside (curl on the built
      // asset) without any access to the hosting dashboard.
      data-render-rev={SPRITE_RENDER_REV}
      style={style}
    />
  );
});
