import { describe, it, expect } from 'vitest';
import {
  ARMORY_ENTRIES,
  BESTIARY_BY_ID,
  BESTIARY_ENTRIES,
  COMPENDIUM_TOTAL,
  getArmoryEntry,
  getBestiaryEntry,
} from '../../data/compendium';

describe('compendium data', () => {
  it('exposes the 11 monster assets as bestiary entries', () => {
    expect(BESTIARY_ENTRIES).toHaveLength(11);
    expect(new Set(BESTIARY_ENTRIES.map((entry) => entry.id)).size).toBe(11);
  });

  it('maps each monster to a biome label', () => {
    expect(getBestiaryEntry('goblin')?.biome).toBe('plains');
    expect(getBestiaryEntry('magma_golem')?.biome).toBe('volcanic');
    expect(getBestiaryEntry('chimera')?.biome).toBe('abyssal');
    expect(BESTIARY_ENTRIES.every((entry) => entry.biomeLabel.length > 0)).toBe(true);
  });

  it('keeps monster level ranges when defined', () => {
    expect(BESTIARY_BY_ID.wolf.minLevel).toBe(5);
    expect(BESTIARY_BY_ID.wolf.maxLevel).toBe(18);
  });

  it('mirrors the 141 item codex entries in the armory', () => {
    expect(ARMORY_ENTRIES).toHaveLength(141);
    expect(COMPENDIUM_TOTAL).toBe(BESTIARY_ENTRIES.length + ARMORY_ENTRIES.length);
    expect(ARMORY_ENTRIES.every((entry) => entry.pixels.length > 0)).toBe(true);
  });

  it('indexes armory entries by id', () => {
    const entry = getArmoryEntry('rusty_sword');
    expect(entry?.name).toBe('Rusty Sword');
    expect(getArmoryEntry('unknown_item')).toBeUndefined();
  });
});
