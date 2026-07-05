import { describe, it, expect } from 'vitest';
import { isMilestoneLevel } from '../../hooks/useArenaLevelUp';

describe('isMilestoneLevel', () => {
  it('returns true for level 5', () => {
    expect(isMilestoneLevel(5)).toBe(true);
  });

  it('returns true for level 10', () => {
    expect(isMilestoneLevel(10)).toBe(true);
  });

  it('returns true for level 15', () => {
    expect(isMilestoneLevel(15)).toBe(true);
  });

  it('returns true for level 20', () => {
    expect(isMilestoneLevel(20)).toBe(true);
  });

  it('returns false for level 1', () => {
    expect(isMilestoneLevel(1)).toBe(false);
  });

  it('returns false for level 4', () => {
    expect(isMilestoneLevel(4)).toBe(false);
  });

  it('returns false for level 6', () => {
    expect(isMilestoneLevel(6)).toBe(false);
  });

  it('returns false for level 11', () => {
    expect(isMilestoneLevel(11)).toBe(false);
  });

  it('returns false for level 0', () => {
    expect(isMilestoneLevel(0)).toBe(false);
  });

  it('returns true for level 25 (future milestone)', () => {
    expect(isMilestoneLevel(25)).toBe(true);
  });
});
