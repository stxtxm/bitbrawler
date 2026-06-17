import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Character } from '../../types/Character'
import { createQueryBuilder, characterToSupabaseRow } from '../utils/supabaseMock'

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}))

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
}))

async function getMatchDifficultyLabel(matchType: 'balanced' | 'similar' | 'pve') {
  const { getMatchDifficultyLabel: fn } = await import('../../utils/matchmakingUtils')
  return fn(matchType)
}

async function findOpponent(player: Character) {
  const { findOpponent: fo } = await import('../../utils/matchmakingUtils')
  return fo(player)
}

const BASE_CHARACTER: Character = {
  name: 'Player',
  gender: 'male' as const,
  seed: 'player-seed',
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
  lastFightReset: Date.now(),
  fightHistory: [],
  foughtToday: [],
  statPoints: 0,
  pendingFight: undefined,
  inventory: [],
  lastLootRoll: 0,
  incomingFightHistory: [],
  isBot: false,
  id: 'player-1',
}

function makePlayer(overrides: Partial<Character> = {}): Character {
  return { ...BASE_CHARACTER, ...overrides }
}

describe('getMatchDifficultyLabel', () => {
  it('returns BALANCED MATCH for balanced type', async () => {
    expect(await getMatchDifficultyLabel('balanced')).toBe('BALANCED MATCH')
  })

  it('returns FAIR MATCH for similar type', async () => {
    expect(await getMatchDifficultyLabel('similar')).toBe('FAIR MATCH')
  })

  it('returns MONSTER BATTLE for pve type', async () => {
    expect(await getMatchDifficultyLabel('pve')).toBe('MONSTER BATTLE')
  })

  it('returns MATCH for unknown type', async () => {
    expect(await getMatchDifficultyLabel('unknown' as any)).toBe('MATCH')
  })
})

describe('findOpponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no opponents exist', async () => {
    const builder = createQueryBuilder({ data: [] })
    mockSupabaseFrom.mockReturnValue(builder)

    const result = await findOpponent(makePlayer())
    expect(result).toBeNull()
  })

  it('returns null when query errors', async () => {
    const builder = createQueryBuilder({ data: null, error: { message: 'DB error' } })
    mockSupabaseFrom.mockReturnValue(builder)

    const result = await findOpponent(makePlayer())
    expect(result).toBeNull()
  })

  it('returns null when data array is empty', async () => {
    const builder = createQueryBuilder({ data: [] })
    mockSupabaseFrom.mockReturnValue(builder)

    const result = await findOpponent(makePlayer())
    expect(result).toBeNull()
  })

  it('returns match result with opponent at same level', async () => {
    const rows = [characterToSupabaseRow(makePlayer({ id: 'opp-1', name: 'Opponent' }))]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ level: 5 })
    const result = await findOpponent(player)

    expect(result).not.toBeNull()
    expect(result!.opponent.id).toBe('opp-1')
    expect(['balanced', 'similar']).toContain(result!.matchType)
    expect(result!.candidates).toHaveLength(1)
  })

  it('excludes the player from candidates', async () => {
    const rows = [
      characterToSupabaseRow(makePlayer({ id: 'player-1', name: 'Self' })),
      characterToSupabaseRow(makePlayer({ id: 'opp-1', name: 'Opponent' })),
    ]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ id: 'player-1' })
    const result = await findOpponent(player)

    expect(result).not.toBeNull()
    expect(result!.opponent.id).toBe('opp-1')
  })

  it('excludes opponents already fought today', async () => {
    const rows = [
      characterToSupabaseRow(makePlayer({ id: 'opp-1', name: 'Already Fought' })),
      characterToSupabaseRow(makePlayer({ id: 'opp-2', name: 'Fresh Opponent' })),
    ]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ id: 'player-1', foughtToday: ['opp-1'] })
    const result = await findOpponent(player)

    expect(result).not.toBeNull()
    expect(result!.opponent.id).toBe('opp-2')
  })

  it('returns null when all candidates are filtered out', async () => {
    const rows = [characterToSupabaseRow(makePlayer({ id: 'player-1' }))]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ id: 'player-1' })
    const result = await findOpponent(player)

    expect(result).toBeNull()
  })

  it('returns null when all candidates were fought today', async () => {
    const rows = [
      characterToSupabaseRow(makePlayer({ id: 'opp-1' })),
      characterToSupabaseRow(makePlayer({ id: 'opp-2' })),
    ]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ id: 'player-1', foughtToday: ['opp-1', 'opp-2'] })
    const result = await findOpponent(player)

    expect(result).toBeNull()
  })

  it('queries characters at the player level', async () => {
    const builder = createQueryBuilder({ data: [characterToSupabaseRow(makePlayer({ id: 'opp-1' }))] })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ level: 7 })
    await findOpponent(player)

    expect(mockSupabaseFrom).toHaveBeenCalledWith('characters')
  })

  it('sorts candidates by closest combat power', async () => {
    const rows = [
      characterToSupabaseRow(makePlayer({ id: 'opp-weak', strength: 1, level: 3 })),
      characterToSupabaseRow(makePlayer({ id: 'opp-mid', strength: 8, level: 3 })),
      characterToSupabaseRow(makePlayer({ id: 'opp-strong', strength: 15, level: 3 })),
    ]
    const builder = createQueryBuilder({ data: rows })
    mockSupabaseFrom.mockReturnValue(builder)

    const player = makePlayer({ level: 3 })
    const result = await findOpponent(player)

    expect(result).not.toBeNull()
    expect(result!.candidates).toHaveLength(3)
  })
})
