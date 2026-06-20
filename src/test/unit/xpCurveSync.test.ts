import { describe, it, expect } from 'vitest';
import { getXpRequiredForNextLevel } from '../../utils/xpUtils';

describe('XP curve sync between client and server', () => {
  // Helper to compute server XP requirement using the same formula
  const serverXp = (level: number) => Math.floor(100 * Math.pow(level, 1.6));

  it('should match for levels 1 through 30', () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      const client = getXpRequiredForNextLevel(lvl);
      const server = serverXp(lvl);
      expect(client).toBe(server);
    }
  });
});
