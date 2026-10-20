// Head silhouettes with a full human face. Helmets, masks and visors are kept
// in the catalogue (old characters and specialist opponents still use them),
// but random generation should not turn most new fighters into anonymous
// ninjas/cyborgs. Create a fresh character with a natural face nine times out
// of ten.
export const EXOTIC_HEAD_TYPES: ReadonlySet<string> = new Set([
  'male_helmet',
  'female_helmet',
  'male_paladin',
  'female_valkyrie',
  'female_warrior',
  'male_cyber',
  'female_cyber',
  'male_ninja',
  'female_ninja',
]);

export const isExoticHead = (headType: string): boolean => EXOTIC_HEAD_TYPES.has(headType);

export function pickHeadType(pool: readonly string[], rng: () => number): string {
  const natural = pool.filter((head) => !isExoticHead(head));
  const exotic = pool.filter(isExoticHead);
  if (natural.length === 0) return pool[Math.floor(rng() * pool.length)];
  if (exotic.length === 0 || rng() < 0.9) {
    return natural[Math.floor(rng() * natural.length)];
  }
  return exotic[Math.floor(rng() * exotic.length)];
}

// Body silhouettes that read as ordinary clothing. Armour, cyber suits and
// assassin/ninja outfits stay available, but random fighters should mostly
// look like people rather than a costume rack.
export const EXOTIC_BODY_TYPES: ReadonlySet<string> = new Set([
  'armor',
  'paladin',
  'cyber_suit',
  'ninja_gi',
  'assassin',
]);

export const isExoticBody = (bodyType: string): boolean => EXOTIC_BODY_TYPES.has(bodyType);

export function pickBodyType(pool: readonly string[], rng: () => number): string {
  const natural = pool.filter((body) => !isExoticBody(body));
  const exotic = pool.filter(isExoticBody);
  if (natural.length === 0) return pool[Math.floor(rng() * pool.length)];
  if (exotic.length === 0 || rng() < 0.85) {
    return natural[Math.floor(rng() * natural.length)];
  }
  return exotic[Math.floor(rng() * exotic.length)];
}
