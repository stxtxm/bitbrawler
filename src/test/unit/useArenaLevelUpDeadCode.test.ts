import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('useArenaLevelUp dead code', () => {
  it('ne contient plus lastQueuedRef (code mort depuis MIN_ANNOUNCE_INTERVAL)', () => {
    const src = readFileSync(resolve('src/hooks/useArenaLevelUp.ts'), 'utf8');
    expect(src).not.toContain('lastQueuedRef');
  });
});
