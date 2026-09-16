import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { isSalvageSurgeActive, SALVAGE_SURGE_BONUS, LIVEOPS_TIMEZONE } from '../../data/liveOps';
import { rollSalvageJackpot, getSalvageYieldWithSurge } from '../../utils/forgeUtils';
import { SALVAGE_JACKPOT_RATE, SALVAGE_JACKPOT_MEGA_RATE, SALVAGE_SURGE_JACKPOT_RATE, SALVAGE_SURGE_MEGA_RATE } from '../../data/forgeConstants';
import { CodexBadge, isCodexBadgeEligible } from '../../components/forge/CodexBadge';

function parisToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const getOffset = (ts: number) => {
    const d = new Date(ts);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: LIVEOPS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(d);
    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    const zonedAsUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return (zonedAsUtc - ts) / 60000;
  };
  let offset = getOffset(guessUtc);
  let utc = guessUtc - offset * 60000;
  const secondOffset = getOffset(utc);
  if (secondOffset !== offset) {
    offset = secondOffset;
    utc = guessUtc - offset * 60000;
  }
  return new Date(utc);
}

describe('Salvage Surge LiveOps', () => {
  describe('isSalvageSurgeActive 72h Fri 18h -> Mon 18h', () => {
    it('returns true Friday 19h Paris', () => {
      const d = parisToUtc(2026, 9, 11, 19, 0);
      expect(isSalvageSurgeActive(d)).toBe(true);
    });
    it('returns false Tuesday 12h Paris', () => {
      const d = parisToUtc(2026, 9, 15, 12, 0);
      expect(isSalvageSurgeActive(d)).toBe(false);
    });
    it('returns false Friday 17:59 Paris', () => {
      const d = parisToUtc(2026, 9, 11, 17, 59);
      expect(isSalvageSurgeActive(d)).toBe(false);
    });
    it('returns true Saturday noon Paris', () => {
      const d = parisToUtc(2026, 9, 12, 12, 0);
      expect(isSalvageSurgeActive(d)).toBe(true);
    });
    it('returns true Sunday noon Paris (72h window includes Sunday)', () => {
      const d = parisToUtc(2026, 9, 13, 12, 0);
      expect(isSalvageSurgeActive(d)).toBe(true);
    });
    it('returns true Monday 17h Paris', () => {
      const d = parisToUtc(2026, 9, 14, 17, 0);
      expect(isSalvageSurgeActive(d)).toBe(true);
    });
    it('returns false Monday 18h Paris', () => {
      const d = parisToUtc(2026, 9, 14, 18, 0);
      expect(isSalvageSurgeActive(d)).toBe(false);
    });
    it('returns false Monday 19h Paris', () => {
      const d = parisToUtc(2026, 9, 14, 19, 0);
      expect(isSalvageSurgeActive(d)).toBe(false);
    });
  });

  describe('SALVAGE_SURGE_BONUS', () => {
    it('exports essencePerFight 0.04', () => {
      expect(SALVAGE_SURGE_BONUS.essencePerFight).toBe(0.04);
    });
  });

  describe('forgeConstants jackpot rates', () => {
    it('defines base rates 0.05 x2 and 0.01 x10', () => {
      expect(SALVAGE_JACKPOT_RATE).toBe(0.05);
      expect(SALVAGE_JACKPOT_MEGA_RATE).toBe(0.01);
    });
    it('defines surge doubled rates 0.10 x2 and 0.02 x10', () => {
      expect(SALVAGE_SURGE_JACKPOT_RATE).toBe(0.10);
      expect(SALVAGE_SURGE_MEGA_RATE).toBe(0.02);
    });
  });

  describe('rollSalvageJackpot', () => {
    it('rng 0.03 -> x2', () => {
      const r = rollSalvageJackpot(() => 0.03, false);
      expect(r.multiplier).toBe(2);
      expect(r.isJackpot).toBe(true);
    });
    it('rng 0.005 -> x10', () => {
      const r = rollSalvageJackpot(() => 0.005, false);
      expect(r.multiplier).toBe(10);
      expect(r.isJackpot).toBe(true);
    });
    it('rng 0.5 -> x1', () => {
      const r = rollSalvageJackpot(() => 0.5, false);
      expect(r.multiplier).toBe(1);
      expect(r.isJackpot).toBe(false);
    });
    it('surge doubles rate: 0.07 is x1 normal but x2 in surge', () => {
      const normal = rollSalvageJackpot(() => 0.07, false);
      const surge = rollSalvageJackpot(() => 0.07, true);
      expect(normal.multiplier).toBe(1);
      expect(surge.multiplier).toBe(2);
    });
    it('surge mega doubled: 0.015 is x2 normal but x10 in surge', () => {
      const normal = rollSalvageJackpot(() => 0.015, false);
      const surge = rollSalvageJackpot(() => 0.015, true);
      expect(normal.multiplier).toBe(2);
      expect(surge.multiplier).toBe(10);
    });
  });

  describe('getSalvageYieldWithSurge', () => {
    it('common 5 ->10 with x2', () => {
      const item = { id: 'c', name: 'c', rarity: 'common', slot: 'weapon', stats: {}, pixels: [[1]], requiredLevel: 1 } as any;
      const res = getSalvageYieldWithSurge(item, () => 0.03, false);
      expect(res.essenceYield).toBe(10);
      expect(res.multiplier).toBe(2);
    });
    it('common 5 ->50 with x10', () => {
      const item = { id: 'c', name: 'c', rarity: 'common', slot: 'weapon', stats: {}, pixels: [[1]], requiredLevel: 1 } as any;
      const res = getSalvageYieldWithSurge(item, () => 0.005, false);
      expect(res.essenceYield).toBe(50);
    });
    it('epic 80 ->160 with x2', () => {
      const item = { id: 'e', name: 'e', rarity: 'epic', slot: 'weapon', stats: {}, pixels: [[1]], requiredLevel: 1 } as any;
      const res = getSalvageYieldWithSurge(item, () => 0.03, false);
      expect(res.essenceYield).toBe(160);
    });
    it('epic 80 ->800 with x10', () => {
      const item = { id: 'e', name: 'e', rarity: 'epic', slot: 'weapon', stats: {}, pixels: [[1]], requiredLevel: 1 } as any;
      const res = getSalvageYieldWithSurge(item, () => 0.005, false);
      expect(res.essenceYield).toBe(800);
    });
  });

  describe('CodexBadge', () => {
    it('is eligible at 10% not claimed', () => {
      expect(isCodexBadgeEligible(10, false)).toBe(true);
    });
    it('not eligible at 15% not claimed', () => {
      expect(isCodexBadgeEligible(15, false)).toBe(false);
    });
    it('not eligible at 10% when claimed', () => {
      expect(isCodexBadgeEligible(10, true)).toBe(false);
    });
    it('not eligible at 0%', () => {
      expect(isCodexBadgeEligible(0, false)).toBe(false);
    });
    it('badge visible at 10% (pulse)', () => {
      const { container } = render(React.createElement(CodexBadge, { completionPct: 10, claimed: false } as any));
      const badge = document.body.querySelector('.codex-badge') ?? container.querySelector('.codex-badge');
      expect(badge).not.toBeNull();
      expect(badge?.className).toContain('codex-badge--pulse');
    });
    it('badge hidden at 15%', () => {
      const { container } = render(React.createElement(CodexBadge, { completionPct: 15, claimed: false } as any));
      const badge = container.querySelector('.codex-badge');
      expect(badge).toBeNull();
    });
  });
});
