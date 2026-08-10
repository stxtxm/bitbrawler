export function scrollPixels(scrollOffset: number): number {
  return Math.round(scrollOffset);
}

export function wrapPhase(scrollPx: number, multiplier: number, tileWidth: number): number {
  // Continuous float remainder — never round. Math.round() here made the
  // phase jump a whole tile (e.g. 43 → 0) while worldIndexAt() was still
  // sweeping the same tile → visible blink/teleport on every layer.
  const phase = (scrollPx * multiplier) % tileWidth;
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

/**
 * Draws a pixel-art volcano cone, apex (narrow) at the top, base (wide)
 * on the ground line. The widest row sits at the bottom — a previous
 * (1 - i/steps) formula drew the widest row at the top, upside down.
 */
export function drawVolcano(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  color: string,
  crater: string,
  lava: string | null,
): void {
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const rowW = Math.max(2, Math.round(w * ((i + 1) / steps)));
    const rowX = Math.round(cx - rowW / 2);
    const rowY = Math.round(baseY - h + (i * h) / steps);
    const rowH = Math.round(h / steps) + 1;
    ctx.fillStyle = color;
    ctx.fillRect(rowX, rowY, rowW, rowH);
  }
  ctx.fillStyle = crater;
  ctx.fillRect(Math.round(cx - 4), Math.round(baseY - h - 3), 8, 4);
  if (lava) {
    for (let i = 1; i <= 4; i++) {
      const lx = Math.round(cx + (i % 2 === 0 ? 6 : -6));
      const ly = Math.round(baseY - h + ((h / 5) * i));
      ctx.fillStyle = lava;
      ctx.fillRect(lx, ly, 4, 4);
    }
    ctx.fillStyle = lava;
    ctx.fillRect(Math.round(cx), Math.round(baseY - h + 2), 4, 6);
  }
}
