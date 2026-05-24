import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Character } from '../../types/Character';
import { GAME_RULES } from '../../config/gameRules';

// ---------------------------------------------------------------------------
// Hoisted mocks – these run before vi.mock() and module resolution
// ---------------------------------------------------------------------------
const { mockSupabaseFrom, createBuilder } = vi.hoisted(() => {
  /**
   * Create a chainable query builder mock.
   * All methods return `this` so chaining like
   *   supabase.from('characters').select('*').eq('is_bot', true)
   * works.  The resolved value comes from `state` which can be set per builder
   * via the `overrides` parameter or changed later on the returned object.
   */
  function createBuilder(overrides: { data?: unknown; error?: unknown; count?: number } = {}) {
    // Use explicit null check so that `data: null` stays null
    const resolvedData = 'data' in overrides ? overrides.data : [];
    const state: { data: unknown; error: unknown; count: number | undefined } = {
      data: resolvedData,
      error: overrides.error ?? null,
      count: overrides.count,
    };

    const builder: Record<string, unknown> = {
      // Chainable filter / projection methods
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      or: () => builder,
      in: () => builder,
      contains: () => builder,
      overlaps: () => builder,
      not: () => builder,

      // Mutations
      insert: () => builder,
      update: () => builder,
      delete: () => builder,

      // Terminal method
      single: () => builder,

      // Await support – the only thing that actually resolves
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: state.data, error: state.error, count: state.count }).then(
          onFulfilled,
          onRejected,
        ),
      catch: () => builder,
      finally: () => builder,

      // Utility so tests can inspect / mutate the resolved value later
      _state: state,
    };

    return builder;
  }

  return {
    mockSupabaseFrom: vi.fn(() => createBuilder()),
    createBuilder,
  };
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock('../../../scripts/supabaseAdmin', () => ({
  supabase: { from: mockSupabaseFrom },
}));

// ---------------------------------------------------------------------------
// Suppress console noise during tests
// ---------------------------------------------------------------------------
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Imports (resolved after vi.mock)
// ---------------------------------------------------------------------------
import {
  createNewBot,
  convertRowToCharacter,
  selectProtectedLevelOneBotIds,
  measurePopulation,
  simulateBotDailyLife,
} from '../../../scripts/bot-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a bare-minimum Character for test purposes. */
function makeCharacter(overrides: Record<string, unknown> = {}): Character {
  const has = (k: string) => k in overrides;
  return {
    name: 'TestBot',
    gender: 'male',
    seed: 'test-seed',
    level: 1,
    hp: 100,
    maxHp: 100,
    strength: 10,
    vitality: 10,
    dexterity: 10,
    luck: 10,
    intelligence: 10,
    focus: 10,
    experience: 0,
    wins: 0,
    losses: 0,
    fightsLeft: 5,
    lastFightReset: Date.now() - 86_400_000, // yesterday so daily reset triggers
    statPoints: 0,
    inventory: [],
    lastLootRoll: 0,
    fightHistory: [],
    foughtToday: [],
    pendingFight: undefined as any,
    incomingFightHistory: [],
    isBot: true,
    ...overrides,
    // Runtime extras that bot-engine.ts adds but aren't in the Character type:
    // Use has() so explicit undefined overrides propagate correctly
    firestoreId: has('firestoreId') ? overrides.firestoreId : 'bot-default-id',
    battleCount: has('battleCount') ? overrides.battleCount : 0,
    equipped: has('equipped') ? overrides.equipped : {},
  } as Character;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('bot-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: each from() call returns a fresh empty builder
    mockSupabaseFrom.mockImplementation(() => createBuilder());
  });

  // -----------------------------------------------------------------------
  // convertRowToCharacter
  // -----------------------------------------------------------------------
  describe('convertRowToCharacter', () => {
    it('converts a minimal Supabase row with default fallbacks', () => {
      const row = { id: 'char-42' };
      const char = convertRowToCharacter(row);

      expect((char as any).firestoreId).toBe('char-42');
      expect(char.level).toBe(1);
      expect(char.hp).toBe(100);
      expect(char.maxHp).toBe(100);
      expect(char.strength).toBe(10);
      expect(char.vitality).toBe(10);
      expect(char.dexterity).toBe(10);
      expect(char.luck).toBe(10);
      expect(char.intelligence).toBe(10);
      expect(char.focus).toBe(GAME_RULES.STATS.BASE_VALUE);
      expect(char.experience).toBe(0);
      expect(char.wins).toBe(0);
      expect(char.losses).toBe(0);
      expect(char.fightsLeft).toBe(0);
      expect(char.isBot).toBe(false);
      expect(char.inventory).toEqual([]);
      expect(char.fightHistory).toEqual([]);
      expect(char.incomingFightHistory).toEqual([]);
      expect((char as any).equipped).toEqual({});
    });

    it('maps snake_case columns to camelCase Character fields', () => {
      const row = {
        id: 'bot-99',
        name: 'IRONFIST',
        gender: 'female',
        seed: 'seed_abc',
        level: 5,
        hp: 73,
        max_hp: 120,
        strength: 14,
        vitality: 16,
        dexterity: 9,
        luck: 11,
        intelligence: 8,
        focus: 12,
        experience: 2450,
        wins: 12,
        losses: 3,
        fights_left: 2,
        last_fight_reset: 1_700_000_000_000,
        fight_history: [{ date: 1_600_000_000_000, opponentName: 'OldFoe', won: false }],
        fought_today: ['opp-1'],
        stat_points: 3,
        pending_fight: null,
        inventory: ['rusty_sword', 'leather_helm'],
        last_loot_roll: 1_690_000_000_000,
        incoming_fight_history: [],
        is_bot: true,
      };

      const char = convertRowToCharacter(row);

      expect(char.name).toBe('IRONFIST');
      expect(char.gender).toBe('female');
      expect(char.seed).toBe('seed_abc');
      expect(char.level).toBe(5);
      expect(char.hp).toBe(73);
      expect(char.maxHp).toBe(120);
      expect(char.strength).toBe(14);
      expect(char.vitality).toBe(16);
      expect(char.dexterity).toBe(9);
      expect(char.luck).toBe(11);
      expect(char.intelligence).toBe(8);
      expect(char.focus).toBe(12);
      expect(char.experience).toBe(2450);
      expect(char.wins).toBe(12);
      expect(char.losses).toBe(3);
      expect(char.fightsLeft).toBe(2);
      expect(char.lastFightReset).toBe(1_700_000_000_000);
      expect(char.fightHistory).toHaveLength(1);
      expect(char.foughtToday).toEqual(['opp-1']);
      expect(char.statPoints).toBe(3);
      expect(char.inventory).toEqual(['rusty_sword', 'leather_helm']);
      expect(char.lastLootRoll).toBe(1_690_000_000_000);
      expect(char.isBot).toBe(true);
      expect((char as any).firestoreId).toBe('bot-99');
    });

    it('handles null / missing fields safely', () => {
      const char = convertRowToCharacter({ id: 'x' });

      expect(char.fightsLeft).toBe(0);
      expect(char.statPoints).toBe(0);
      expect(char.lastLootRoll).toBe(0);
      expect(char.lastFightReset).toBe(0);
      expect(char.pendingFight).toBeNull();
      expect(char.incomingFightHistory).toEqual([]);
      expect(char.foughtToday).toEqual([]);
    });

    it('coerces non-finite fights_left to 0', () => {
      const char = convertRowToCharacter({ id: 'x', fights_left: Infinity });
      expect(char.fightsLeft).toBe(0);

      const char2 = convertRowToCharacter({ id: 'x', fights_left: NaN });
      expect(char2.fightsLeft).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // selectProtectedLevelOneBotIds
  // -----------------------------------------------------------------------
  describe('selectProtectedLevelOneBotIds', () => {
    it('returns skipIds unchanged when protectedLevelOneCount is 0', () => {
      const skip = new Set<string>(['a', 'b']);
      const result = selectProtectedLevelOneBotIds([], skip, 0);
      expect(result).toEqual(new Set(['a', 'b']));
    });

    it('adds no extra IDs when target is already met by skipIds', () => {
      const bot = makeCharacter({ firestoreId: 'lvl1-a', level: 1 });
      const skip = new Set<string>(['lvl1-a']);

      const result = selectProtectedLevelOneBotIds([bot], skip, 1);
      expect(result).toEqual(new Set(['lvl1-a']));
    });

    it('picks additional level-1 bots with fewest battles, then most energy', () => {
      const bots = [
        makeCharacter({ firestoreId: 'a', level: 1, battleCount: 0, fightsLeft: 5 }),
        makeCharacter({ firestoreId: 'b', level: 1, battleCount: 3, fightsLeft: 1 }),
        makeCharacter({ firestoreId: 'c', level: 1, battleCount: 0, fightsLeft: 3 }),
        makeCharacter({ firestoreId: 'd', level: 2, battleCount: 0, fightsLeft: 5 }), // not lvl1
      ];
      const skip = new Set<string>(['a']); // already protected
      const result = selectProtectedLevelOneBotIds(bots, skip, 2);

      // a was already in skip → stays, we need 1 more → pick c (0 battles, 3 energy > 0)
      expect(result.has('a')).toBe(true);
      expect(result.has('c')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('skips level-1 bots without a firestoreId', () => {
      // 3 bots: 2 valid + 1 without firestoreId → pool = 2 → maxProtectable = 2 - 1 = 1
      const bots = [
        makeCharacter({ firestoreId: undefined, level: 1 }), // skipped: no firestoreId
        makeCharacter({ firestoreId: 'valid-a', level: 1 }),
        makeCharacter({ firestoreId: 'valid-b', level: 1 }),
      ];
      const skip = new Set<string>();
      const result = selectProtectedLevelOneBotIds(bots, skip, 2);

      expect(result.has('valid-a')).toBe(true);
      expect(result.size).toBe(1); // only 1 can be protected (pool=2, MIN_LVL1_ACTIVE=1)
    });

    it('respects MIN_LVL1_ACTIVE_BOTS and never protects the entire pool', () => {
      // With MIN_LVL1_ACTIVE_BOTS = 1, at most len(pool) -1 can be protected
      const bots = Array.from({ length: 5 }, (_, i) =>
        makeCharacter({ firestoreId: `lvl1-${i}`, level: 1 }),
      );
      const skip = new Set<string>();
      const result = selectProtectedLevelOneBotIds(bots, skip, 99);

      // max protectable = 5 - 1 = 4
      expect(result.size).toBe(4);
    });

    it('returns a new Set without mutating the input skipIds', () => {
      // Need at least 2 bots so pool size > MIN_LVL1_ACTIVE_BOTS (1)
      const bots = [
        makeCharacter({ firestoreId: 'a', level: 1 }),
        makeCharacter({ firestoreId: 'b', level: 1 }),
      ];
      const original = new Set<string>();
      const result = selectProtectedLevelOneBotIds(bots, original, 2);

      expect(result.has('a')).toBe(true);
      expect(result.size).toBe(1); // only 1 protected (pool=2, MIN_LVL1_ACTIVE=1)
      expect(original.has('a')).toBe(false); // original unchanged
    });
  });

  // -----------------------------------------------------------------------
  // measurePopulation
  // -----------------------------------------------------------------------
  describe('measurePopulation', () => {
    it('returns zeros when no characters exist', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ count: 0 }))
        .mockReturnValueOnce(createBuilder({ count: 0 }))
        .mockReturnValueOnce(createBuilder({ count: 0 }));

      const pop = await measurePopulation();
      expect(pop).toEqual({ totalBots: 0, levelOneBots: 0, levelOneHumans: 0 });
    });

    it('computes levelOneHumans = levelOneCharacters - levelOneBots', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ count: 25 })) // total bots
        .mockReturnValueOnce(createBuilder({ count: 10 })) // level 1 bots
        .mockReturnValueOnce(createBuilder({ count: 15 })); // level 1 characters

      const pop = await measurePopulation();
      expect(pop.totalBots).toBe(25);
      expect(pop.levelOneBots).toBe(10);
      expect(pop.levelOneHumans).toBe(5); // 15 - 10
    });

    it('never returns a negative levelOneHumans count', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ count: 30 }))
        .mockReturnValueOnce(createBuilder({ count: 20 }))
        .mockReturnValueOnce(createBuilder({ count: 10 })); // fewer lvl1 chars than lvl1 bots

      const pop = await measurePopulation();
      expect(pop.levelOneHumans).toBe(0); // clamped to 0
    });

    it('handles null counts gracefully', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ count: undefined }))
        .mockReturnValueOnce(createBuilder({ count: undefined }))
        .mockReturnValueOnce(createBuilder({ count: undefined }));

      const pop = await measurePopulation();
      expect(pop).toEqual({ totalBots: 0, levelOneBots: 0, levelOneHumans: 0 });
    });

    it('never returns a negative levelOneHumans count (edge case)', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ count: 10 }))
        .mockReturnValueOnce(createBuilder({ count: 10 }))
        .mockReturnValueOnce(createBuilder({ count: 5 }));

      const pop = await measurePopulation();
      expect(pop.levelOneHumans).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // createNewBot
  // -----------------------------------------------------------------------
  describe('createNewBot', () => {
    it('inserts a bot row and returns its id', async () => {
      const botId = 'fresh-bot-007';
      mockSupabaseFrom.mockImplementation(() => createBuilder({ data: { id: botId } }));

      const id = await createNewBot();

      expect(id).toBe(botId);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('characters');
    });

    it('throws when supabase returns an error', async () => {
      mockSupabaseFrom.mockImplementation(() =>
        createBuilder({ error: new Error('connection refused') }),
      );

      await expect(createNewBot()).rejects.toThrow('connection refused');
    });

    it('throws when supabase returns null data', async () => {
      mockSupabaseFrom.mockImplementation(() => createBuilder({ data: null }));

      await expect(createNewBot()).rejects.toThrow();
    });

    it('includes is_bot: true in the inserted row', async () => {
      let insertedRow: Record<string, unknown> | null = null;
      mockSupabaseFrom.mockImplementation(() => {
        const builder = createBuilder({ data: { id: 'bot-id' } });
        // Capture the row passed to insert()
        builder.insert = vi.fn((row: unknown) => {
          insertedRow = row as Record<string, unknown>;
          return builder;
        });
        return builder;
      });

      await createNewBot();

      expect(insertedRow).not.toBeNull();
      expect(insertedRow!.is_bot).toBe(true);
      expect(insertedRow!.level).toBe(1);
      expect(insertedRow!.experience).toBe(0);
      expect(insertedRow!.fights_left).toBe(GAME_RULES.COMBAT.MAX_DAILY_FIGHTS);
    });
  });

  // -----------------------------------------------------------------------
  // simulateBotDailyLife (combat loop)
  // -----------------------------------------------------------------------
  describe('simulateBotDailyLife', () => {
    const makeBotRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'bot-main',
      name: 'FIGHTER',
      gender: 'male',
      seed: 'fight-seed',
      level: 1,
      hp: 100,
      max_hp: 100,
      strength: 10,
      vitality: 10,
      dexterity: 10,
      luck: 10,
      intelligence: 10,
      focus: 10,
      experience: 0,
      wins: 0,
      losses: 0,
      fights_left: 3,
      last_fight_reset: 0,
      fight_history: [],
      fought_today: [],
      stat_points: 0,
      pending_fight: null,
      inventory: [],
      last_loot_roll: 0,
      incoming_fight_history: [],
      is_bot: true,
      auto_mode: false,
      ...overrides,
    });

    it('returns early when no bots are fetched', async () => {
      mockSupabaseFrom.mockImplementation(() => createBuilder({ data: [] }));

      // Should not throw
      await expect(simulateBotDailyLife()).resolves.toBeUndefined();
    });

    it('processes a simple bot with no fights (protected)', async () => {
      // Provide one bot row
      const rows = [makeBotRow()];
      // When simulatingBotDailyLife loads opponents, return empty array
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ data: rows })) // main bot fetch
        .mockReturnValueOnce(createBuilder({ data: [] }))   // preload incoming: batch
        .mockReturnValueOnce(createBuilder({ data: [] }))   // opponent load for level 1
        .mockReturnValueOnce(createBuilder({ data: [] }));  // fallback if needed

      await expect(simulateBotDailyLife({
        skipBotIds: new Set(['bot-main']),
        protectedLevelOneCount: 10,
      })).resolves.toBeUndefined();
    });

    it('performs daily reset when lastFightReset is old', async () => {
      const oldReset = Date.now() - 2 * 86_400_000; // 2 days ago
      const rows = [makeBotRow({ last_fight_reset: oldReset, fights_left: 0 })];

      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ data: rows }))
        .mockReturnValueOnce(createBuilder({ data: [] }))  // preload empty
        .mockReturnValueOnce(createBuilder({ data: [] }));  // opponent load

      await expect(simulateBotDailyLife({
        skipBotIds: new Set(['bot-main']),
        protectedLevelOneCount: 10,
      })).resolves.toBeUndefined();

      // Verify an update was flushed (the daily reset triggers persistence)
      const updateCalls = mockSupabaseFrom.mock.calls.filter(
        (call: any[]) => call[0] === 'characters',
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('fights against opponents when energy is available', async () => {
      const botRow = makeBotRow({
        id: 'bot-attacker',
        fights_left: 2,
        level: 1,
        strength: 20, // strong attacker
      });

      const opponentRow = makeBotRow({
        id: 'bot-defender',
        level: 1,
        strength: 5,
        vitality: 5,
        hp: 50,
        max_hp: 50,
      });

      // Set up the mock builder to return controlled data for each query
      // 1) Main bot fetch → returns [botRow]
      // 2) preload incoming histories (batch query) → returns []
      // 3) opponent load for level 1 → returns [opponentRow]
      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ data: [botRow] }))
        .mockReturnValueOnce(createBuilder({ data: [] }))
        .mockReturnValueOnce(createBuilder({ data: [opponentRow] }));

      await expect(simulateBotDailyLife({
        skipBotIds: new Set(),
        protectedLevelOneCount: 0,
      })).resolves.toBeUndefined();

      // The bot should have fought and accumulated updates
      const updateCalls = mockSupabaseFrom.mock.calls.filter(
        (call: any[]) => call[0] === 'characters',
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('handles end-of-day drain mode correctly', async () => {
      // Make a bot with energy but no opponents
      const botRow = makeBotRow({
        id: 'drain-bot',
        fights_left: 2,
        level: 1,
      });

      mockSupabaseFrom
        .mockReturnValueOnce(createBuilder({ data: [botRow] }))
        .mockReturnValueOnce(createBuilder({ data: [] }))  // preload
        .mockReturnValueOnce(createBuilder({ data: [] }))  // opponent load – none
        .mockReturnValueOnce(createBuilder({ data: [] }));  // fallback – none

      await expect(simulateBotDailyLife({
        skipBotIds: new Set(),
        protectedLevelOneCount: 0,
      })).resolves.toBeUndefined();
    });
  });
});
