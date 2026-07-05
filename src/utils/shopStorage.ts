const STORAGE_KEY = 'bitbrawler_shop_purchases';

interface ShopPurchases {
  [date: string]: boolean[];
}

/**
 * In-memory fallback used when localStorage is unavailable (Node.js / tests).
 */
const memoryStore = new Map<string, ShopPurchases>();

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined;
  } catch {
    return false;
  }
}

function getStoreKey(characterId: string): string {
  return `${STORAGE_KEY}_${characterId}`;
}

/**
 * Load shop purchases for a character.
 */
export function loadShopPurchases(characterId: string): ShopPurchases {
  if (!isLocalStorageAvailable()) {
    return memoryStore.get(getStoreKey(characterId)) ?? {};
  }
  try {
    const raw = localStorage.getItem(getStoreKey(characterId));
    if (!raw) return {};
    return JSON.parse(raw) as ShopPurchases;
  } catch {
    return {};
  }
}

/**
 * Save shop purchases for a character.
 */
export function saveShopPurchases(characterId: string, purchases: ShopPurchases): void {
  if (!isLocalStorageAvailable()) {
    memoryStore.set(getStoreKey(characterId), { ...purchases });
    return;
  }
  try {
    localStorage.setItem(getStoreKey(characterId), JSON.stringify(purchases));
  } catch {
    // Storage full or unavailable — silently degrade
  }
}

/**
 * Clear purchase state — both in-memory store and (when available) localStorage.
 * Useful in tests.
 */
export function clearShopPurchases(characterId?: string): void {
  if (characterId) {
    memoryStore.delete(getStoreKey(characterId));
    try {
      localStorage?.removeItem(getStoreKey(characterId));
    } catch { /* ignore */ }
  } else {
    memoryStore.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < (localStorage?.length ?? 0); i++) {
        const key = localStorage?.key(i);
        if (key?.startsWith(STORAGE_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage?.removeItem(key));
    } catch { /* ignore */ }
  }
}

/**
 * Check if a specific offer was purchased today.
 */
export function isOfferPurchased(characterId: string, index: number, dateStr?: string): boolean {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const purchases = loadShopPurchases(characterId);
  const day = purchases[today];
  if (!day) return false;
  return day[index] === true;
}

/**
 * Mark an offer as purchased today and persist.
 */
export function markOfferPurchased(characterId: string, index: number, dateStr?: string): void {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const purchases = loadShopPurchases(characterId);
  if (!purchases[today]) {
    purchases[today] = [false, false, false];
  }
  purchases[today][index] = true;
  saveShopPurchases(characterId, purchases);
}
