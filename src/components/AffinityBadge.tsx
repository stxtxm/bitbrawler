import React from 'react';
import { Element, ELEMENT_LABELS, ELEMENT_COLORS } from '../types/Item';

interface AffinityBadgeProps {
  element: Element;
  size?: number;
}

export const AffinityBadge: React.FC<AffinityBadgeProps> = ({ element, size = 14 }) => {
  const color = ELEMENT_COLORS[element];
  const label = ELEMENT_LABELS[element];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-label={label}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <title>{label}</title>
      {/* Diamond shape badge */}
      <rect x="3" y="0" width="2" height="1" fill={color} />
      <rect x="2" y="1" width="4" height="1" fill={color} />
      <rect x="1" y="2" width="6" height="4" fill={color} />
      <rect x="2" y="6" width="4" height="1" fill={color} />
      <rect x="3" y="7" width="2" height="1" fill={color} />
      {/* Inner pixel for contrast */}
      <rect x="3" y="3" width="2" height="2" fill="#fff" opacity="0.3" />
    </svg>
  );
};
