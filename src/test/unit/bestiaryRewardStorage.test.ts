import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadBestiaryRewardClaims,
  saveBestiaryRewardClaims,
  claimBestiaryRewardId,
  isBestiaryRewardClaimed,
  clearBestiaryRewardClaims,
} from '../../utils/bestiaryRewardStorage';

describe('bestiaryRewardStorage', () => {
  beforeEach(() => {
    clearBestiaryRewardClaims();
  });

  it('loads empty claims by default', () => {
    expect(loadBestiaryRewardClaims('char-1')).toEqual([]);
  });

  it('saves and loads claims', () => {
    saveBestiaryRewardClaims('char-1', ['monster:goblin:1']);
    expect(loadBestiaryRewardClaims('char-1')).toEqual(['monster:goblin:1']);
  });

  it('claims a reward id idempotently', () => {
    expect(claimBestiaryRewardId('char-1', 'monster:goblin:1')).toBe(true);
    expect(claimBestiaryRewardId('char-1', 'monster:goblin:1')).toBe(false);
    expect(loadBestiaryRewardClaims('char-1')).toEqual(['monster:goblin:1']);
  });

  it('checks claimed state', () => {
    claimBestiaryRewardId('char-1', 'global:10');
    expect(isBestiaryRewardClaimed('char-1', 'global:10')).toBe(true);
    expect(isBestiaryRewardClaimed('char-1', 'global:25')).toBe(false);
  });

  it('keeps claims per character', () => {
    claimBestiaryRewardId('char-1', 'monster:goblin:1');
    claimBestiaryRewardId('char-2', 'monster:ogre:1');
    expect(loadBestiaryRewardClaims('char-1')).toEqual(['monster:goblin:1']);
    expect(loadBestiaryRewardClaims('char-2')).toEqual(['monster:ogre:1']);
  });
});
