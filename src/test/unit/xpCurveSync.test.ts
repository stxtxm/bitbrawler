import { describe, it, expect } from 'vitest';
import { getXpRequiredForNextLevel } from '../../utils/xpUtils';

describe('XP curve sync between client and server', () => {
  const EARLY_SHIFT = 3;
  const serverXp = (level: number) => {
    const shifted = Math.max(1, level - EARLY_SHIFT);
    return Math.floor(120 * Math.pow(shifted, 1.65));
  };

  it('should match for levels 1 through 30', () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      const client = getXpRequiredForNextLevel(lvl);
      const server = serverXp(lvl);
      expect(client).toBe(server);
    }
  });
});
