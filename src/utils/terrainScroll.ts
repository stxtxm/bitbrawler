export function pixelRoundScroll(scroll: number): number {
  return Math.round(scroll);
}

export function layerPhase(scrollPx: number, parallax: number, period: number): number {
  const raw = Math.round(scrollPx * parallax) % period;
  return raw < 0 ? raw + period : raw;
}

export function tileWorldIndex(coord: number, spacing: number): number {
  return Math.floor(coord / spacing);
}

export function deterministicNoise(
  seedNum: number,
  index: number,
  saltA: number,
  saltB: number,
  max = 101,
): number {
  return (index * saltA + seedNum * saltB) % max;
}
