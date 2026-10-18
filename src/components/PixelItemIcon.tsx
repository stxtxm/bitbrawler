import React from 'react';
import { ITEM_PALETTE } from '../data/itemAssets';
import { ITEM_PIXEL_GRID_SIZE, getIntegerIconScale } from '../utils/equipmentPresentation';

interface PixelItemIconProps {
  pixels: number[][];
  size?: number;
  palette?: Record<number, string>;
  className?: string;
}

export const PixelItemIcon: React.FC<PixelItemIconProps> = ({
  pixels,
  size = 32,
  palette = ITEM_PALETTE,
  className,
}) => {
  const scale = getIntegerIconScale(size);
  const renderedSize = scale * ITEM_PIXEL_GRID_SIZE;

  return (
    <svg
      className={className}
      width={renderedSize}
      height={renderedSize}
      viewBox={`0 0 ${ITEM_PIXEL_GRID_SIZE} ${ITEM_PIXEL_GRID_SIZE}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
      data-scale={scale}
    >
      {pixels.map((row, y) =>
        row.map((cell, x) => {
          if (!cell) return null;
          const color = palette[cell];
          if (!color || color === 'transparent') return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />;
        })
      )}
    </svg>
  );
};
