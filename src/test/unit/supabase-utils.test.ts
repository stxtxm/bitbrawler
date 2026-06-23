import { describe, it, expect } from 'vitest'
import { convertFromSupabase, convertToSupabase } from '../../utils/supabaseUtils'
import { CharacterRow } from '../../config/supabase'
import { Character } from '../../types/Character'

describe('convertFromSupabase', () => {
  const row: CharacterRow = {
    id: 'abc-123',
    created_at: '2026-01-01T00:00:00Z',
    name: 'Test Hero',
    gender: 'male',
    seed: 'seed123',
    level: 5,
    hp: 80,
    max_hp: 120,
    strength: 12,
    vitality: 10,
    dexterity: 8,
    luck: 6,
    intelligence: 14,
    focus: 11,
    experience: 450,
    wins: 7,
    losses: 3,
    fights_left: 2,
    last_fight_reset: 1700000000000,
    fight_history: [{ opponentName: 'player1', won: true, date: 1700000000000 }],
    fought_today: ['opp-1', 'opp-2'],
    stat_points: 3,
    pending_fight: null,
    inventory: ['sword_01'],
    last_loot_roll: 1700000000000,
    lootbox_streak: 3,
    incoming_fight_history: [{ attackerName: 'player2', won: false, date: 1700000000000 }],
    is_bot: false,
    auto_mode: false,
    equipped_items: { weapon: 'rusty_sword', armor: null, accessory: null },
    pve_fights_left: 5,
    last_idle_check: null,
    last_active: null,
    idle_streak: 0,
    idle_max_streak: 0,
    idle_total_kills: 0,
    idle_total_xp: 0,
    essence: 0,
    item_upgrades: null,
  }

  it('maps all CharacterRow fields to Character correctly', () => {
    const char = convertFromSupabase(row)

    expect(char.name).toBe('Test Hero')
    expect(char.gender).toBe('male')
    expect(char.seed).toBe('seed123')
    expect(char.level).toBe(5)
    expect(char.hp).toBe(80)
    expect(char.maxHp).toBe(120)
    expect(char.strength).toBe(12)
    expect(char.vitality).toBe(10)
    expect(char.dexterity).toBe(8)
    expect(char.luck).toBe(6)
    expect(char.intelligence).toBe(14)
    expect(char.focus).toBe(11)
    expect(char.experience).toBe(450)
    expect(char.wins).toBe(7)
    expect(char.losses).toBe(3)
    expect(char.fightsLeft).toBe(2)
    expect(char.lastFightReset).toBe(1700000000000)
    expect(char.fightHistory).toEqual([{ opponentName: 'player1', won: true, date: 1700000000000 }])
    expect(char.foughtToday).toEqual(['opp-1', 'opp-2'])
    expect(char.statPoints).toBe(3)
    expect(char.pendingFight).toBeUndefined()
    expect(char.inventory).toEqual(['sword_01'])
    expect(char.lastLootRoll).toBe(1700000000000)
    expect(char.lootboxStreak).toBe(3)
    expect(char.incomingFightHistory).toEqual([{ attackerName: 'player2', won: false, date: 1700000000000 }])
    expect(char.isBot).toBe(false)
    expect(char.autoMode).toBe(false)
    expect(char.id).toBe('abc-123')
    expect(char.lastIdleCheck).toBe(0)
    expect(char.lastActive).toBe(0)
    expect(char.idleStreak).toBe(0)
    expect(char.idleMaxStreak).toBe(0)
    expect(char.idleTotalKills).toBe(0)
    expect(char.idleTotalXp).toBe(0)
  })

  it('maps essence and item_upgrades from CharacterRow to Character', () => {
    const rowWithEssence: CharacterRow = {
      ...row,
      essence: 42,
      item_upgrades: { sword_01: 2, armor_01: 1 },
    }
    const char = convertFromSupabase(rowWithEssence)

    expect(char.essence).toBe(42)
    expect(char.itemUpgrades).toEqual({ sword_01: 2, armor_01: 1 })
  })

  it('defaults essence to 0 and itemUpgrades to undefined when row has null/0', () => {
    const char = convertFromSupabase(row)

    expect(char.essence).toBe(0)
    expect(char.itemUpgrades).toBeUndefined()
  })

  it('handles a bot character correctly', () => {
    const botRow: CharacterRow = { ...row, is_bot: true, auto_mode: true, id: 'bot-1' }
    const char = convertFromSupabase(botRow)

    expect(char.isBot).toBe(true)
    expect(char.autoMode).toBe(true)
    expect(char.id).toBe('bot-1')
  })

  it('handles nullish optional fields', () => {
    const minimalRow: CharacterRow = {
      ...row,
      pending_fight: null,
      fight_history: [],
      fought_today: [],
      inventory: [],
      incoming_fight_history: [],
    }
    const char = convertFromSupabase(minimalRow)

    expect(char.pendingFight).toBeUndefined()
    expect(char.fightHistory).toEqual([])
    expect(char.inventory).toEqual([])
  })

  it('preserves fight history arrays', () => {
    const hist = [
      { opponentName: 'a', won: true, date: 1 },
      { opponentName: 'c', won: false, date: 2 },
    ]
    const incomingHist = [
      { attackerName: 'a', won: false, date: 1 },
      { attackerName: 'c', won: true, date: 2 },
    ]
    const rowWithHistory: CharacterRow = { ...row, fight_history: hist, incoming_fight_history: incomingHist }
    const char = convertFromSupabase(rowWithHistory)

    expect(char.fightHistory).toEqual(hist)
    expect(char.incomingFightHistory).toEqual(incomingHist)
  })
})

describe('convertToSupabase', () => {
  const character: Character = {
    name: 'Test Hero',
    gender: 'male',
    seed: 'seed123',
    level: 5,
    hp: 80,
    maxHp: 120,
    strength: 12,
    vitality: 10,
    dexterity: 8,
    luck: 6,
    intelligence: 14,
    focus: 11,
    experience: 450,
    wins: 7,
    losses: 3,
    fightsLeft: 2,
    lastFightReset: 1700000000000,
    fightHistory: [{ date: 1700000000000, opponentName: 'player1', won: true }],
    foughtToday: ['opp-1'],
    statPoints: 3,
    pendingFight: undefined,
    inventory: ['sword_01'],
    lastLootRoll: 1700000000000,
    lootboxStreak: 5,
    incomingFightHistory: [{ date: 1700000000000, attackerName: 'player2', won: false }],
    isBot: false,
    autoMode: true,
    equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
    id: 'abc-123',
    lastIdleCheck: 0,
    lastActive: 0,
    idleStreak: 0,
    idleMaxStreak: 0,
    idleTotalKills: 0,
    idleTotalXp: 0,
  }

  it('maps all Character fields to CharacterRow correctly', () => {
    const row = convertToSupabase(character)

    expect(row.name).toBe('Test Hero')
    expect(row.gender).toBe('male')
    expect(row.seed).toBe('seed123')
    expect(row.level).toBe(5)
    expect(row.hp).toBe(80)
    expect(row.max_hp).toBe(120)
    expect(row.strength).toBe(12)
    expect(row.vitality).toBe(10)
    expect(row.dexterity).toBe(8)
    expect(row.luck).toBe(6)
    expect(row.intelligence).toBe(14)
    expect(row.focus).toBe(11)
    expect(row.experience).toBe(450)
    expect(row.wins).toBe(7)
    expect(row.losses).toBe(3)
    expect(row.fights_left).toBe(2)
    expect(row.last_fight_reset).toBe(1700000000000)
    expect(row.fight_history).toEqual([{ date: 1700000000000, opponentName: 'player1', won: true }])
    expect(row.fought_today).toEqual(['opp-1'])
    expect(row.stat_points).toBe(3)
    expect(row.pending_fight).toBeNull()
    expect(row.inventory).toEqual(['sword_01'])
    expect(row.last_loot_roll).toBe(1700000000000)
    expect(row.lootbox_streak).toBe(5)
    expect(row.incoming_fight_history).toEqual([{ date: 1700000000000, attackerName: 'player2', won: false }])
    expect(row.is_bot).toBe(false)
    expect(row.auto_mode).toBe(true)
    expect(row.idle_streak).toBe(0)
    expect(row.idle_max_streak).toBe(0)
    expect(row.idle_total_kills).toBe(0)
    expect(row.idle_total_xp).toBe(0)
  })

  it('maps essence and item_upgrades from Character to CharacterRow', () => {
    const charWithEssence: Character = {
      ...character,
      essence: 137,
      itemUpgrades: { axe_01: 5, shield_01: 3 },
    }
    const row = convertToSupabase(charWithEssence)

    expect(row.essence).toBe(137)
    expect(row.item_upgrades).toEqual({ axe_01: 5, shield_01: 3 })
  })

  it('defaults essence and item_upgrades when not set on Character', () => {
    const row = convertToSupabase(character)

    expect(row.essence).toBe(0)
    expect(row.item_upgrades).toBeNull()
  })

  it('fills default values for missing optional fields', () => {
    const minimal: Character = {
      name: 'Min',
      gender: 'female',
      seed: 's',
      level: 1,
      hp: 100,
      maxHp: 100,
      strength: 5,
      vitality: 5,
      dexterity: 5,
      luck: 5,
      intelligence: 5,
      focus: undefined as any,
      experience: undefined as any,
      wins: undefined as any,
      losses: undefined as any,
      fightsLeft: undefined as any,
      lastFightReset: undefined as any,
      fightHistory: undefined as any,
      foughtToday: undefined as any,
      statPoints: undefined as any,
      pendingFight: undefined as any,
      inventory: undefined as any,
      lastLootRoll: undefined as any,
      lootboxStreak: undefined as any,
      incomingFightHistory: undefined as any,
      isBot: undefined as any,
      autoMode: undefined as any,
      equippedItems: undefined as any,
      lastIdleCheck: undefined as any,
      lastActive: undefined as any,
      idleStreak: undefined as any,
      idleMaxStreak: undefined as any,
      idleTotalKills: undefined as any,
      idleTotalXp: undefined as any,
      id: 'x',
    }

    const row = convertToSupabase(minimal)
    expect(row.focus).toBe(10)
    expect(row.experience).toBe(0)
    expect(row.wins).toBe(0)
    expect(row.losses).toBe(0)
    expect(row.fights_left).toBe(5)
    expect(row.fight_history).toEqual([])
    expect(row.fought_today).toEqual([])
    expect(row.stat_points).toBe(0)
    expect(row.pending_fight).toBeNull()
    expect(row.inventory).toEqual([])
    expect(row.last_loot_roll).toBe(0)
    expect(row.lootbox_streak).toBe(0)
    expect(row.incoming_fight_history).toEqual([])
    expect(row.is_bot).toBe(false)
    expect(row.auto_mode).toBe(false)
    expect(row.idle_streak).toBe(0)
    expect(row.idle_max_streak).toBe(0)
    expect(row.idle_total_kills).toBe(0)
    expect(row.idle_total_xp).toBe(0)
  })

  it('handles bot character correctly', () => {
    const botChar: Character = { ...character, isBot: true }
    const row = convertToSupabase(botChar)
    expect(row.is_bot).toBe(true)
    // auto_mode should remain whatever the character has (the base character has autoMode: true)
    expect(row.auto_mode).toBe(true)
  })

  it('maps autoMode ON with isBot true (unified state)', () => {
    const autoChar: Character = { ...character, autoMode: true, isBot: true }
    const row = convertToSupabase(autoChar)
    expect(row.is_bot).toBe(true)
    expect(row.auto_mode).toBe(true)
  })

  it('maps autoMode OFF with isBot false (unified state)', () => {
    const manualChar: Character = { ...character, autoMode: false, isBot: false }
    const row = convertToSupabase(manualChar)
    expect(row.is_bot).toBe(false)
    expect(row.auto_mode).toBe(false)
  })
})
