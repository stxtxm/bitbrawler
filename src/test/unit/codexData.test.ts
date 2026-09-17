import { describe, it, expect } from 'vitest';
import { CODEX_ENTRIES, CODEX_IDS, CODEX_BY_ID, CODEX_GRID_COLS, getCodexEntry } from '../../data/codex';
import { ITEM_ASSETS } from '../../data/itemAssets';

describe('codex data', () => {
  it('exports 141 entries', () => {
    expect(CODEX_ENTRIES.length).toBe(141);
    expect(CODEX_IDS.length).toBe(141);
    expect(Object.keys(CODEX_BY_ID).length).toBe(141);
  });

  it('all ids exist in itemAssets', () => {
    const assetIds = new Set(ITEM_ASSETS.map((a) => a.id));
    for (const entry of CODEX_ENTRIES) {
      expect(assetIds.has(entry.id)).toBe(true);
    }
    for (const id of CODEX_IDS) {
      expect(assetIds.has(id)).toBe(true);
    }
  });

  it('CODEX_IDS matches CODEX_ENTRIES order', () => {
    expect(CODEX_IDS).toEqual(CODEX_ENTRIES.map((e) => e.id));
  });

  it('CODEX_BY_ID is indexed correctly', () => {
    for (const entry of CODEX_ENTRIES) {
      expect(CODEX_BY_ID[entry.id]).toEqual(entry);
    }
  });

  it('getCodexEntry returns entry or undefined', () => {
    const first = CODEX_ENTRIES[0];
    expect(getCodexEntry(first.id)).toEqual(first);
    expect(getCodexEntry('unknown_id_xyz')).toBeUndefined();
  });

  it('rarity is coherent with itemAssets', () => {
    const byId = new Map(ITEM_ASSETS.map((a) => [a.id, a]));
    for (const entry of CODEX_ENTRIES) {
      const asset = byId.get(entry.id)!;
      expect(entry.rarity).toBe(asset.rarity);
      expect(entry.element).toBe(asset.element);
      expect(entry.slot).toBe(asset.slot);
      expect(entry.requiredLevel).toBe(asset.requiredLevel);
      expect(entry.name).toBe(asset.name);
    }
  });

  it('shinyEligible = epic/legendary || element defined', () => {
    for (const entry of CODEX_ENTRIES) {
      const expected = entry.rarity === 'epic' || entry.rarity === 'legendary' || entry.element !== undefined;
      expect(entry.shinyEligible).toBe(expected);
    }
  });

  it('setId groups by level tier', () => {
    for (const entry of CODEX_ENTRIES) {
      expect(entry.setId).toBe(`set-lv${entry.requiredLevel}`);
    }
    const distinctLevels = new Set(ITEM_ASSETS.map((a) => a.requiredLevel));
    const distinctSetIds = new Set(CODEX_ENTRIES.map((e) => e.setId));
    expect(distinctSetIds.size).toBe(distinctLevels.size);
  });

  it('is ordered by rarity then level', () => {
    const order: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    for (let i = 1; i < CODEX_ENTRIES.length; i += 1) {
      const prev = CODEX_ENTRIES[i - 1];
      const cur = CODEX_ENTRIES[i];
      const prevRank = order[prev.rarity];
      const curRank = order[cur.rarity];
      if (prevRank !== curRank) {
        expect(prevRank).toBeLessThan(curRank);
      } else if (prev.requiredLevel !== cur.requiredLevel) {
        expect(prev.requiredLevel).toBeLessThanOrEqual(cur.requiredLevel);
      } else {
        expect(prev.id.localeCompare(cur.id)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('grid is complete: 12x12 covers 141 entries', () => {
    expect(CODEX_GRID_COLS).toBe(12);
    const rows = Math.ceil(CODEX_ENTRIES.length / CODEX_GRID_COLS);
    expect(rows).toBe(12);
    expect(CODEX_GRID_COLS * 12).toBeGreaterThanOrEqual(CODEX_ENTRIES.length);
    expect(CODEX_GRID_COLS * 12).toBe(144);
  });

  it('all items have unique ids', () => {
    expect(new Set(CODEX_IDS).size).toBe(141);
  });

  it('does not duplicate pixels', () => {
    for (const entry of CODEX_ENTRIES) {
      expect((entry as unknown as Record<string, unknown>).pixels).toBeUndefined();
    }
  });

  it('requiredLevel range valid', () => {
    for (const entry of CODEX_ENTRIES) {
      expect(entry.requiredLevel).toBeGreaterThanOrEqual(1);
      expect(entry.requiredLevel).toBeLessThanOrEqual(99);
    }
  });
});
