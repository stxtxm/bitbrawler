import { describe, it, expect } from 'vitest';
import { getXpRequiredForNextLevel } from '../../utils/xpUtils';

describe('XP curve sync between client and server', () => {
  const serverXp = (level: number) => Math.floor(120 * Math.pow(level, 1.65));

  it('should match for levels 1 through 30', () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      const client = getXpRequiredForNextLevel(lvl);
      const server = serverXp(lvl);
      expect(client).toBe(server);
    }
  });
});
