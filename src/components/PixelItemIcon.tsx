import React from 'react';
import { ITEM_PALETTE } from '../data/itemAssets';

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
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
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
