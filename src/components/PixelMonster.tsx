import { MONSTER_ASSETS, MonsterId } from '../data/monsterAssets';

type PixelMonsterProps = {
  monsterId: MonsterId;
  scale?: number;
};

const CELL_SIZE = 1;

export function PixelMonster({ monsterId, scale = 4 }: PixelMonsterProps) {
  const def = MONSTER_ASSETS.find(m => m.id === monsterId);
  if (!def) return null;

  const { pixels, palette } = def;
  const width = pixels[0]?.length ?? 16;
  const height = pixels.length;

  const viewWidth = width * CELL_SIZE;
  const viewHeight = height * CELL_SIZE;

  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      shapeRendering="crispEdges"
      aria-label={def.name}
    >
      {pixels.map((row, y) =>
        row.map((cell, x) => {
          if (cell === 0) return null;
          const fill = palette[cell] ?? 'transparent';
          return (
            <rect
              key={`${x}-${y}`}
              x={x * CELL_SIZE}
              y={y * CELL_SIZE}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill={fill}
            />
          );
        })
      )}
    </svg>
  );
}
