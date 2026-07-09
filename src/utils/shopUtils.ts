import { Character } from '../types/Character';
import { PixelItemAsset } from '../types/Item';
import { SHOP_OFFERS } from '../data/shopConstants';
import { rollSimpleLootbox } from './lootboxUtils';
import { isOfferPurchased, markOfferPurchased, isRerollUsed, markRerollUsed, loadShopPurchases, saveShopPurchases } from './shopStorage';

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
 * Generate a single shop offer from a given config index, reusing the helper.
 */
function buildOffer(
  configIndex: number,
  character: Character,
  items: PixelItemAsset[],
  rand: () => number,
): ShopOffer {
  const config = SHOP_OFFERS[configIndex];
  if (config.type === 'lootbox') {
    return {
      index: configIndex,
      type: 'lootbox' as const,
      price: config.price,
      label: config.label,
      item: null,
    };
  }

  const charLevel = character.level;

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
    index: configIndex,
    type: 'item' as const,
    price: config.price,
    label: config.label,
    item: picked ? { id: picked.id, name: picked.name, rarity: picked.rarity } : null,
  };
}

/**
 * Array of length 3 (one per offer) — same day + same char = same offers.
 * Offers are deterministic per day (seeded by char id + date).
 * Guarantees exactly 1 epic-rarity item among the 3 daily offers:
 * - If Pièce rare (index 1) naturally rolls epic, the 3 standard offers are used.
 * - Otherwise, Pièce rare is replaced by Objet épique (index 3, epic-only).
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

  // Build the first 3 standard offers (config indices 0, 1, 2)
  const standardOffers: ShopOffer[] = [0, 1, 2].map((i) => buildOffer(i, character, items, rand));

  // Check if any item offer among the standard 3 is epic
  const hasNaturalEpic = standardOffers.some(
    (o) => o.type === 'item' && o.item?.rarity === 'epic',
  );

  if (hasNaturalEpic) {
    return standardOffers;
  }

  // No epic found — replace the second offer (Pièce rare, index 1) with Objet épique (index 3)
  const epicOffer = buildOffer(3, character, items, rand);
  return [standardOffers[0], epicOffer, standardOffers[2]];
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
 * Check if an offer has already been purchased today (persisted in localStorage).
 */
export function isOfferSoldOut(
  index: number,
  character: Character,
  dateStr?: string,
): boolean {
  return isOfferPurchased(character.id ?? character.seed, index, dateStr);
}

/**
 * Ensure today's purchase slots exist (no-op with localStorage-backed storage).
 */
export function resetDailyPurchases(
  character: Character,
  _dateStr?: string,
): Character {
  // No-op: purchases stored in localStorage separately.
  // Only ensure the local storage entry exists for today.
  const today = _dateStr ?? new Date().toISOString().slice(0, 10);
  const charId = character.id ?? character.seed;
  const purchases = loadShopPurchases(charId);
  if (!purchases[today]) {
    purchases[today] = [false, false, false];
    saveShopPurchases(charId, purchases);
  }
  return character;
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

  const cost = offer.price;
  const newEssence = (character.essence ?? 0) - cost;

  let newInventory: string[];
  if (offer.type === 'lootbox') {
    const rolled = rollSimpleLootbox(items, character.level, rng);
    if (!rolled) return null;
    newInventory = [...(character.inventory ?? []), rolled.id];
  } else {
    const offers = getShopOffers(character, items, today, rng);
    const shopItem = offers.find(o => o.index === index)?.item;
    if (!shopItem) return null;
    newInventory = [...(character.inventory ?? []), shopItem.id];
  }

  // Persist purchase to localStorage after successful computation
  const charId = character.id ?? character.seed;
  markOfferPurchased(charId, index, today);

  return {
    ...character,
    essence: newEssence,
    inventory: newInventory,
  } as Character;
}

const REROLL_COST = 25;

/**
 * Reroll today's shop offers for 25 essence.
 * Checks that the player has enough essence and has not already rerolled today.
 * Returns the updated character (with essence deducted) and new offers, or null.
 */
export function rerollShopOffers(
  character: Character,
  items: PixelItemAsset[],
  dateStr?: string,
): { character: Character; offers: ShopOffer[] } | null {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const charId = character.id ?? character.seed;

  // Check essence
  if ((character.essence ?? 0) < REROLL_COST) return null;

  // Check reroll not already used today
  if (isRerollUsed(charId, today)) return null;

  // Generate new offers with a reroll seed (append '-reroll')
  const rerollSeed = getDailySeed(charId, `${today}-reroll`);
  const rand = seededRandom(rerollSeed);

  const charLevel = character.level;

  const offers: ShopOffer[] = SHOP_OFFERS.map((config, index) => {
    if (config.type === 'lootbox') {
      return {
        index,
        type: 'lootbox' as const,
        price: config.price,
        label: config.label,
        item: null,
      };
    }

    const eligible = items.filter(
      (item) => item.requiredLevel <= charLevel && item.rarity !== 'legendary',
    );

    const pool = eligible.filter((item) =>
      config.rarityPool ? config.rarityPool.includes(item.rarity) : true,
    );

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

  // Deduct essence
  const newEssence = (character.essence ?? 0) - REROLL_COST;

  // Mark reroll used
  markRerollUsed(charId, today);

  return {
    character: {
      ...character,
      essence: newEssence,
    } as Character,
    offers,
  };
}
