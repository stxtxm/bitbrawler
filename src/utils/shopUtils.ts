import { Character } from '../types/Character';
import { PixelItemAsset } from '../types/Item';
import { SHOP_OFFERS } from '../data/shopConstants';
import { rollSimpleLootbox } from './lootboxUtils';

export interface ShopOffer {
  index: number;
  type: 'item' | 'lootbox';
  price: number;
  label: string;
  item: { id: string; name: string; rarity: string } | null;
}

/**
 * Simple seeded PRNG (mulberry32).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic seed for a given date and character id.
 */
function getDailySeed(charId: string, dateStr: string): number {
  let hash = 0;
  const str = `${charId}-${dateStr}`;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Pick a random item from a filtered pool using seeded RNG.
 */
function pickItem(pool: PixelItemAsset[], rng: () => number): PixelItemAsset | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Array of length 3 (one per offer) — same day + same char = same offers.
 * Offers are deterministic per day (seeded by char id + date).
 */
export function getShopOffers(
  character: Character,
  items: PixelItemAsset[],
  dateStr?: string,
  rng?: () => number,
): ShopOffer[] {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const seed = getDailySeed(character.id ?? character.seed, today);
  const rand = rng ?? seededRandom(seed);

  const charLevel = character.level;

  return SHOP_OFFERS.map((config, index) => {
    if (config.type === 'lootbox') {
      return {
        index,
        type: 'lootbox' as const,
        price: config.price,
        label: config.label,
        item: null,
      };
    }

    // Filter items by level eligibility
    const eligible = items.filter(
      (item) => item.requiredLevel <= charLevel && item.rarity !== 'legendary',
    );

    // Filter by rarity pool for this offer
    const pool = eligible.filter((item) =>
      config.rarityPool ? config.rarityPool.includes(item.rarity) : true,
    );

    // Ensure we don't offer items already owned
    const owned = new Set(character.inventory ?? []);
    const fresh = pool.filter((item) => !owned.has(item.id));

    const source = fresh.length > 0 ? fresh : pool;
    const picked = pickItem(source, rand);

    return {
      index,
      type: 'item' as const,
      price: config.price,
      label: config.label,
      item: picked ? { id: picked.id, name: picked.name, rarity: picked.rarity } : null,
    };
  });
}

/**
 * Check if character has enough essence for a given offer.
 */
export function canBuyOffer(index: number, character: Character): boolean {
  const config = SHOP_OFFERS[index];
  if (!config) return false;
  return (character.essence ?? 0) >= config.price;
}

/**
 * Check if an offer has already been purchased today.
 */
export function isOfferSoldOut(
  index: number,
  character: Character,
  dateStr?: string,
): boolean {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const purchases = (character as any).shopPurchases?.[today];
  if (!purchases) return false;
  return purchases[index] === true;
}

/**
 * Ensure today's purchase slots exist.
 */
export function resetDailyPurchases(
  character: Character,
  dateStr?: string,
): Character {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const shopPurchases = { ...((character as any).shopPurchases ?? {}) };
  if (shopPurchases[today]) return character;

  return {
    ...character,
    shopPurchases: {
      ...shopPurchases,
      [today]: [false, false, false],
    },
  } as Character;
}

/**
 * Purchase a shop offer.
 * Returns updated character or null if purchase is not possible.
 */
export function buyShopOffer(
  index: number,
  character: Character,
  items: PixelItemAsset[],
  dateStr?: string,
  rng?: () => number,
): Character | null {
  if (!canBuyOffer(index, character)) return null;
  if (isOfferSoldOut(index, character, dateStr)) return null;

  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const offer = SHOP_OFFERS[index];
  if (!offer) return null;

  // Ensure daily purchases tracking
  const withReset = resetDailyPurchases(character, today);

  const cost = offer.price;
  const newEssence = (withReset.essence ?? 0) - cost;

  let newInventory: string[];
  if (offer.type === 'lootbox') {
    const rolled = rollSimpleLootbox(items, character.level, rng);
    if (!rolled) return null;
    newInventory = [...(withReset.inventory ?? []), rolled.id];
  } else {
    const offers = getShopOffers(character, items, today, rng);
    const shopItem = offers[index].item;
    if (!shopItem) return null;
    newInventory = [...(withReset.inventory ?? []), shopItem.id];
  }

  const shopPurchases = { ...(withReset as any).shopPurchases };
  shopPurchases[today] = [...shopPurchases[today]];
  shopPurchases[today][index] = true;

  return {
    ...withReset,
    essence: newEssence,
    inventory: newInventory,
    shopPurchases,
  } as Character;
}
