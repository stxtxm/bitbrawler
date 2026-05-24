import { vi } from 'vitest';

export type MockSupabaseResolvedValue = {
  data?: any[] | any;
  error?: any;
  count?: number;
  reject?: boolean;
};

export function createQueryBuilder(initialValue?: MockSupabaseResolvedValue) {
  const currentData = initialValue?.data ?? [];
  const currentError = initialValue?.error ?? null;
  const shouldReject = initialValue?.reject ?? false;
  const currentCount = initialValue?.count;

  const builder: Record<string, any> = {
    then: vi.fn((onFulfilled?: any, onRejected?: any) => {
      if (shouldReject && currentError) {
        return Promise.reject(currentError).then(onFulfilled, onRejected);
      }
      return Promise.resolve({ data: currentData, error: currentError, count: currentCount }).then(onFulfilled, onRejected);
    }),
    catch: vi.fn(),
    finally: vi.fn(),
  };

  const chainMethods = ['select', 'eq', 'neq', 'order', 'limit', 'range', 'or', 'contains', 'overlaps', 'not', 'single'];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);

  builder._setResult = (data: any, error?: any) => {
    const p = error
      ? Promise.resolve({ data, error })
      : Promise.resolve({ data, error: null });
    builder.then = vi.fn((onFulfilled?: any, onRejected?: any) => p.then(onFulfilled, onRejected));
  };

  builder._setRejection = (err: any) => {
    builder.then = vi.fn((onFulfilled?: any, onRejected?: any) => Promise.reject(err).then(onFulfilled, onRejected));
  };

  return builder;
}

export function characterToSupabaseRow(char: any): any {
  return {
    id: char.id || 'test-id',
    name: char.name,
    gender: char.gender,
    seed: char.seed,
    level: char.level,
    hp: char.hp,
    max_hp: char.maxHp,
    strength: char.strength,
    vitality: char.vitality,
    dexterity: char.dexterity,
    luck: char.luck,
    intelligence: char.intelligence,
    focus: char.focus ?? 10,
    experience: char.experience ?? 0,
    wins: char.wins ?? 0,
    losses: char.losses ?? 0,
    fights_left: char.fightsLeft ?? 5,
    last_fight_reset: char.lastFightReset ?? 0,
    fight_history: char.fightHistory ?? [],
    fought_today: char.foughtToday ?? [],
    stat_points: char.statPoints ?? 0,
    pending_fight: char.pendingFight ?? null,
    inventory: char.inventory ?? [],
    last_loot_roll: char.lastLootRoll ?? 0,
    incoming_fight_history: char.incomingFightHistory ?? [],
    is_bot: typeof char.isBot === 'boolean' ? char.isBot : false,
    auto_mode: false,
    created_at: new Date().toISOString(),
  };
}
