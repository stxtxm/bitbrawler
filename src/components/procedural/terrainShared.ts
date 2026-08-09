export function scrollPixels(scrollOffset: number): number {
  return Math.round(scrollOffset);
}

export function wrapPhase(scrollPx: number, multiplier: number, tileWidth: number): number {
  const phase = Math.round(scrollPx * multiplier) % tileWidth;
  return phase >= 0 ? phase : phase + tileWidth;
}

export function tileScanStart(phase: number, tileWidth: number): number {
  return -phase - tileWidth;
}

export function worldIndexAt(screenX: number, scrollPx: number, parallax: number, spacing: number): number {
  return Math.floor((screenX + scrollPx * parallax) / spacing);
}

export function tilesNeeded(viewWidth: number, tileWidth: number): number {
  return Math.ceil(viewWidth / tileWidth) + 2;
}
