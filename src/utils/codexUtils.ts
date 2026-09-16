import { Character } from '../types/Character';
import type { ItemRarity } from '../types/Item';
import { CODEX_ENTRIES, CODEX_BY_ID } from '../data/codex';

export const SHINY_PITY_THRESHOLD = 20;

type CodexCharacter = Character & { codex?: string[]; codexPity?: number; shinyCodex?: string[] };

const RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function isRarePlus(rarity: ItemRarity): boolean {
  return (RARITY_RANK[rarity] ?? 0) >= RARITY_RANK.rare;
}

function getStoredCodex(character: CodexCharacter): string[] | undefined {
  if (character.codex !== undefined) return character.codex;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('codex');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function getCodexIds(character: CodexCharacter): string[] {
  const stored = getStoredCodex(character);
  return stored ?? [];
}

export function isCodexDiscovered(character: CodexCharacter, id: string): boolean {
  return getCodexIds(character).includes(id);
}

export function getCodexHint(id: string, seenSet: Set<string>): string {
  const entry = CODEX_BY_ID[id];
  if (!entry) return '???';
  if (seenSet.has(id)) return entry.name;
  const idx = CODEX_ENTRIES.findIndex((e) => e.id === id);
  if (idx < 0) return '???';
  const prevId = idx > 0 ? CODEX_ENTRIES[idx - 1].id : null;
  const nextId = idx + 1 < CODEX_ENTRIES.length ? CODEX_ENTRIES[idx + 1].id : null;
  const neighborSeen = (prevId !== null && seenSet.has(prevId)) || (nextId !== null && seenSet.has(nextId));
  if (neighborSeen) return '✦';
  return '???';
}

export function registerLoot(
  itemId: string,
  character: CodexCharacter
): { character: CodexCharacter; newlyDiscovered: string[] } {
  const current = getCodexIds(character);
  if (current.includes(itemId)) {
    return { character: { ...character, codex: [...current] }, newlyDiscovered: [] };
  }
  const next = [...current, itemId];
  return { character: { ...character, codex: next }, newlyDiscovered: [itemId] };
}

export function getCodexProgress(character: CodexCharacter): {
  seen: number;
  owned: number;
  total: number;
  completionPct: number;
} {
  const ids = getCodexIds(character);
  const seen = ids.length;
  const total = CODEX_ENTRIES.length;
  const seenSet = new Set(ids);
  const inventory = character.inventory ?? [];
  const owned = inventory.filter((id) => seenSet.has(id)).length;
  const completionPct = total > 0 ? Math.round((seen / total) * 100) : 0;
  return { seen, owned, total, completionPct };
}

export function getShinyEligible(character: CodexCharacter): string[] {
  const ids = getCodexIds(character);
  const seenSet = new Set(ids);
  return CODEX_ENTRIES.filter((e) => e.shinyEligible && seenSet.has(e.id)).map((e) => e.id);
}

export function rollShinyWithPity(
  pityCounter: number,
  rarity: ItemRarity
): { isShiny: boolean; nextPity: number } {
  const safePity = Number.isFinite(pityCounter) ? Math.max(0, Math.floor(pityCounter)) : 0;
  if (safePity >= SHINY_PITY_THRESHOLD) {
    return { isShiny: true, nextPity: 0 };
  }
  const rarePlus = isRarePlus(rarity);
  if (rarePlus) {
    return { isShiny: false, nextPity: 0 };
  }
  return { isShiny: false, nextPity: safePity + 1 };
}
