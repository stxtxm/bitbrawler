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
  // screenX comes from tileScanStart(), so screenX + scrollPx*parallax is
  // mathematically an exact multiple of `spacing` (float remainder cancels).
  // Floating-point rounding can still land a hair BELOW the multiple (e.g.
  // 639.9999999999999), making Math.floor() oscillate ±1 world index on
  // consecutive frames → every hash-based sprite (clouds, volcanoes, ash,
  // pools…) teleports a full tile width and blinks. A tiny epsilon pushes
  // these exact-boundary cases up to the intended index.
  return Math.floor((screenX + scrollPx * parallax + 1e-6) / spacing);
}

export function tilesNeeded(viewWidth: number, tileWidth: number): number {
  return Math.ceil(viewWidth / tileWidth) + 2;
}

/**
 * Seamless opacity envelope for the crater smoke plume over its rise
 * cycle t ∈ [0,1]. sin(π·t) is 0 at both ends, so the plume fades in at
 * the crater mouth, peaks mid-rise and fades out at the apex — no pop/
 * blink when the cycle restarts. (A linear (1-t) envelope was at FULL
 * opacity at t=0, making the plume blink back into existence.)
 */
export function plumeOpacity(t: number, maxOpacity: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return maxOpacity * Math.sin(Math.PI * clamped);
}

/**
 * Horizontal displacement of an eruption spark: velocity × time (t ∈ [0,1]),
 * so the spark stays near its volcano crater. A previous formula used
 * velocity × raw tick, which flung sparks up to ±740px across the screen.
 */
export function eruptionDx(velocityX: number, t: number): number {
  return velocityX * Math.min(1, Math.max(0, t));
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
  scrollPx?: number,
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
    // Scroll-animated flow trickles
    const flowOffset = scrollPx ? Math.floor((scrollPx * 0.15) % 8) : 0;
    for (let i = 1; i <= 4; i++) {
      const lx = Math.round(cx + (i % 2 === 0 ? 6 : -6));
      const baseLavaY = baseY - h + ((h / 5) * i);
      const ly = Math.round(baseLavaY + flowOffset);
      ctx.fillStyle = lava;
      ctx.fillRect(lx, ly, 4, 4);
    }
    ctx.fillStyle = lava;
    ctx.fillRect(Math.round(cx), Math.round(baseY - h + 2 + (flowOffset % 3)), 4, 6);
  }
}
