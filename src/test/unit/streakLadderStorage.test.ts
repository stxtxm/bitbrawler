import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../config/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

import {
  fetchStreakLadder,
  isMissingStreakLadderTable,
  loadLadderBadges,
  loadLocalLadderEntry,
  recordLadderBadge,
  saveLocalLadderEntry,
  submitStreakLadderEntry,
  submitStreakLadderEntryIfChanged,
} from '../../utils/streakLadderStorage';

function mockSelect(data: unknown, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const secondOrder = { order: vi.fn().mockReturnValue({ limit }) };
  const firstOrder = vi.fn().mockReturnValue(secondOrder);
  const eq = vi.fn().mockReturnValue({ order: firstOrder });
  const select = vi.fn().mockReturnValue({ eq });
  fromMock.mockReturnValue({ select });
  return { select, eq, firstOrder, limit };
}

function mockUpsert(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  fromMock.mockReturnValue({ upsert });
  return upsert;
}

describe('streakLadderStorage', () => {
  beforeEach(() => {
    fromMock.mockReset();
    localStorage.clear();
  });

  it('detects a missing streak_ladder table', () => {
    expect(isMissingStreakLadderTable({ code: '42P01' })).toBe(true);
    expect(isMissingStreakLadderTable({ code: 'PGRST205' })).toBe(true);
    expect(
      isMissingStreakLadderTable({
        code: 'PGRST205',
        message: "Could not find the table 'public.streak_ladder' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingStreakLadderTable({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingStreakLadderTable(null)).toBe(false);
  });

  it('fetches and normalizes ladder rows', async () => {
    const chain = mockSelect([
      { character_id: 'a', name: 'Alpha', streak: 12, updated_at: '2026-11-23T10:00:00.000Z' },
      { character_id: 'b', name: 'Bravo', streak: -4, updated_at: null },
    ]);

    const result = await fetchStreakLadder('2026-W48');

    expect(fromMock).toHaveBeenCalledWith('streak_ladder');
    expect(chain.eq).toHaveBeenCalledWith('week_key', '2026-W48');
    expect(result.available).toBe(true);
    expect(result.entries).toEqual([
      {
        characterId: 'a',
        name: 'Alpha',
        streak: 12,
        updatedAt: Date.parse('2026-11-23T10:00:00.000Z'),
      },
      { characterId: 'b', name: 'Bravo', streak: 0, updatedAt: undefined },
    ]);
  });

  it('reports the ladder as unavailable when the table is missing', async () => {
    mockSelect(null, { code: 'PGRST205', message: 'table missing' });

    const result = await fetchStreakLadder('2026-W48');

    expect(result.available).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it('upserts the player entry and keeps a local copy', async () => {
    const upsert = mockUpsert(null);

    const ok = await submitStreakLadderEntry(
      { characterId: 'a', name: 'Alpha', streak: 7.9 },
      '2026-W48',
    );

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: 'a',
        week_key: '2026-W48',
        name: 'Alpha',
        streak: 7,
      }),
      { onConflict: 'character_id,week_key' },
    );
    expect(loadLocalLadderEntry('a', '2026-W48')?.streak).toBe(7);
  });

  it('still stores locally when the table is missing', async () => {
    mockUpsert({ code: '42P01', message: 'relation "streak_ladder" does not exist' });

    const ok = await submitStreakLadderEntry(
      { characterId: 'b', name: 'Bravo', streak: 3 },
      '2026-W48',
    );

    expect(ok).toBe(false);
    expect(loadLocalLadderEntry('b', '2026-W48')).toMatchObject({ characterId: 'b', streak: 3 });
  });

  it('returns null when no local entry exists', () => {
    expect(loadLocalLadderEntry('missing', '2026-W48')).toBeNull();
  });

  it('records only upgrades to the weekly badge', () => {
    const first = recordLadderBadge('a', '2026-W48', 'bronze');
    expect(first['2026-W48']).toBe('bronze');

    const same = recordLadderBadge('a', '2026-W48', 'bronze');
    expect(same['2026-W48']).toBe('bronze');

    const better = recordLadderBadge('a', '2026-W48', 'gold');
    expect(better['2026-W48']).toBe('gold');

    const worse = recordLadderBadge('a', '2026-W48', 'silver');
    expect(worse['2026-W48']).toBe('gold');

    const none = recordLadderBadge('a', '2026-W48', null);
    expect(none['2026-W48']).toBe('gold');
    expect(loadLadderBadges('a')['2026-W48']).toBe('gold');
  });

  it('saves local entries through the public helper', () => {
    saveLocalLadderEntry('c', '2026-W48', {
      characterId: 'c',
      name: 'Charlie',
      streak: 5,
    });
    expect(loadLocalLadderEntry('c', '2026-W48')).toMatchObject({
      characterId: 'c',
      name: 'Charlie',
      streak: 5,
    });
  });

  it('submits at most once per week per streak value', async () => {
    const upsert = mockUpsert(null);
    const input = { characterId: 'd', name: 'Delta', streak: 5 };

    expect(await submitStreakLadderEntryIfChanged(input, '2026-W48')).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);

    expect(await submitStreakLadderEntryIfChanged(input, '2026-W48')).toBe(false);
    expect(upsert).toHaveBeenCalledTimes(1);

    expect(await submitStreakLadderEntryIfChanged({ ...input, streak: 6 }, '2026-W48')).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('does not gate a failed submit so it retries', async () => {
    const input = { characterId: 'e', name: 'Echo', streak: 4 };

    mockUpsert({ code: '42P01', message: 'relation "streak_ladder" does not exist' });
    expect(await submitStreakLadderEntryIfChanged(input, '2026-W48')).toBe(false);

    mockUpsert(null);
    expect(await submitStreakLadderEntryIfChanged(input, '2026-W48')).toBe(true);
  });
});
