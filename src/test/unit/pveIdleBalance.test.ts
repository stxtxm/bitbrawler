import { describe, it, expect } from 'vitest'
import { GAME_RULES } from '../../config/gameRules'
import { generateMonster } from '../../utils/monsterUtils'
import { simulateCombat } from '../../utils/combatUtils'

const makePlayer = (level: number) => ({
  seed: 'pve-balance',
  name: 'BalanceTester',
  gender: 'male' as const,
  level,
  experience: 0,
  strength: 14,
  vitality: 14,
  dexterity: 14,
  luck: 14,
  intelligence: 14,
  focus: 14,
  hp: 180,
  maxHp: 180,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  equippedItems: { weapon: null, armor: null, accessory: null },
})

describe('PVE idle balance — STAT_MULTIPLIER 2.1 #1093', () => {
  it('STAT_MULTIPLIER is 2.1', () => {
    expect(GAME_RULES.PVE.STAT_MULTIPLIER).toBe(2.1)
  })

  it('HP_MULTIPLIER and LEVEL_BOOST unchanged', () => {
    expect(GAME_RULES.PVE.HP_MULTIPLIER).toBe(1.0)
    expect(GAME_RULES.PVE.LEVEL_BOOST).toBe(4)
  })

  it('2.1 — monster raw stats scale at 2.1x vs 1.8', () => {
    const m = generateMonster('goblin', 8)
    expect(m.strength).toBeGreaterThan(14 * 1.2)
  })

  it('WR idle simule a lvl 8 reste <80% sur 30 runs (casse le 100% last15)', () => {
    const level = 8
    let wins = 0
    const N = 30
    for (let i = 0; i < N; i++) {
      const player = makePlayer(level)
      const monster = generateMonster('goblin', level)
      const result = simulateCombat(player, monster)
      if (result.winner === 'attacker') wins++
    }
    const wr = wins / N
    expect(wr).toBeLessThan(0.8)
    expect(wr).toBeGreaterThan(0.15)
  })
})
