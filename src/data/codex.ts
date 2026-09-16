import { ITEM_ASSETS } from './itemAssets';
import type { Element, ItemRarity, ItemSlot } from '../types/Item';

export interface CodexEntry {
  id: string;
  name: string;
  rarity: ItemRarity;
  element?: Element;
  slot: ItemSlot;
  requiredLevel: number;
  setId?: string;
  shinyEligible: boolean;
}

export const CODEX_GRID_COLS = 12;
export const CODEX_GRID_ROWS = 12;
export const CODEX_GRID_SIZE = CODEX_GRID_COLS * CODEX_GRID_ROWS;

const RARITY_ORDER: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function isShinyEligible(rarity: ItemRarity, element?: Element): boolean {
  return rarity === 'epic' || rarity === 'legendary' || element !== undefined;
}

function toSetId(requiredLevel: number): string {
  return `set-lv${requiredLevel}`;
}

const sorted = [...ITEM_ASSETS].sort((a, b) => {
  const ra = RARITY_ORDER[a.rarity];
  const rb = RARITY_ORDER[b.rarity];
  if (ra !== rb) return ra - rb;
  if (a.requiredLevel !== b.requiredLevel) return a.requiredLevel - b.requiredLevel;
  return a.id.localeCompare(b.id);
});

export const CODEX_ENTRIES: CodexEntry[] = sorted.map((item) => ({
  id: item.id,
  name: item.name,
  rarity: item.rarity,
  element: item.element,
  slot: item.slot,
  requiredLevel: item.requiredLevel,
  setId: toSetId(item.requiredLevel),
  shinyEligible: isShinyEligible(item.rarity, item.element),
}));

export const CODEX_IDS: string[] = CODEX_ENTRIES.map((e) => e.id);

export const CODEX_BY_ID: Record<string, CodexEntry> = Object.fromEntries(
  CODEX_ENTRIES.map((e) => [e.id, e]),
);

export function getCodexEntry(id: string): CodexEntry | undefined {
  return CODEX_BY_ID[id];
}
