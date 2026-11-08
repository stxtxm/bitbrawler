import { describe, it, expect, beforeEach } from 'vitest';
import { getNewlyReachedMilestones, loadClaimedStreakMilestones, saveClaimedStreakMilestones } from '../../utils/lootboxUtils';

describe('streak milestone helpers (#1359)', () => {
  beforeEach(() => localStorage.clear());

  it('detects newly reached milestones', () => {
    expect(getNewlyReachedMilestones(2, [])).toEqual([]);
    expect(getNewlyReachedMilestones(3, [])).toEqual([3]);
    expect(getNewlyReachedMilestones(7, [3])).toEqual([7]);
    expect(getNewlyReachedMilestones(30, [3, 7, 14])).toEqual([30]);
  });

  it('persists claimed milestones per character', () => {
    saveClaimedStreakMilestones('c1', [3, 7]);
    expect(loadClaimedStreakMilestones('c1')).toEqual([3, 7]);
    expect(loadClaimedStreakMilestones('c2')).toEqual([]);
  });
});
