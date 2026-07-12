/**
 * QA Bot Config Tests
 *
 * Tests for the PvE fight type decision logic used by the QA bot
 * to alternate between PvP and PvE fights based on config.
 */
import { describe, it, expect } from 'vitest'

// ── Fight type decision function (mirrors qa-bot.mjs logic) ──

interface FightTypeResult {
  type: 'pvp' | 'pve'
  pvpSinceLastPve: number
}

function determineNextFightType(
  pvpSinceLastPve: number,
  pveRatio: number,
  pveOnly: boolean
): FightTypeResult {
  if (pveOnly) {
    return { type: 'pve', pvpSinceLastPve: 0 }
  }
  if (pveRatio <= 0) {
    return { type: 'pvp', pvpSinceLastPve: pvpSinceLastPve + 1 }
  }
  const pvpPerPve = Math.max(1, Math.round(1 / pveRatio) - 1)
  if (pvpSinceLastPve >= pvpPerPve) {
    return { type: 'pve', pvpSinceLastPve: 0 }
  }
  return { type: 'pvp', pvpSinceLastPve: pvpSinceLastPve + 1 }
}

/**
 * Build a full fight plan of `count` fights using the decision function.
 */
function buildFightPlan(count: number, pveRatio: number, pveOnly: boolean): string[] {
  const plan: string[] = []
  let pvpSinceLastPve = 0
  for (let i = 0; i < count; i++) {
    const result = determineNextFightType(pvpSinceLastPve, pveRatio, pveOnly)
    plan.push(result.type)
    pvpSinceLastPve = result.pvpSinceLastPve
  }
  return plan
}

// ── Tests ──

describe('QA Bot Fight Type Decision', () => {
  describe('determineNextFightType', () => {
    it('returns pvp when pveRatio is 0', () => {
      const result = determineNextFightType(0, 0, false)
      expect(result.type).toBe('pvp')
      expect(result.pvpSinceLastPve).toBe(1)
    })

    it('returns pvp when pveRatio is negative', () => {
      const result = determineNextFightType(0, -1, false)
      expect(result.type).toBe('pvp')
    })

    it('returns pve when pveOnly is true', () => {
      const result = determineNextFightType(0, 0.33, true)
      expect(result.type).toBe('pve')
      expect(result.pvpSinceLastPve).toBe(0)
    })

    it('resets counter after a pve fight', () => {
      let state = determineNextFightType(2, 0.33, false) // should be pve
      expect(state.type).toBe('pve')
      expect(state.pvpSinceLastPve).toBe(0)

      state = determineNextFightType(state.pvpSinceLastPve, 0.33, false)
      expect(state.type).toBe('pvp')
      expect(state.pvpSinceLastPve).toBe(1)
    })
  })

  describe('buildFightPlan with pveRatio=0.33 (every 3rd fight PvE)', () => {
    it('produces correct 5-fight plan', () => {
      const plan = buildFightPlan(5, 0.33, false)
      expect(plan).toEqual(['pvp', 'pvp', 'pve', 'pvp', 'pvp'])
    })

    it('produces correct 10-fight plan', () => {
      const plan = buildFightPlan(10, 0.33, false)
      expect(plan).toEqual([
        'pvp', 'pvp', 'pve',
        'pvp', 'pvp', 'pve',
        'pvp', 'pvp', 'pve',
        'pvp',
      ])
    })

    it('starts with pvp when counter is at 0', () => {
      const result = determineNextFightType(0, 0.33, false)
      expect(result.type).toBe('pvp')
    })

    it('triggers pve after 2 pvp fights', () => {
      let state = determineNextFightType(0, 0.33, false)
      expect(state.type).toBe('pvp')
      state = determineNextFightType(state.pvpSinceLastPve, 0.33, false)
      expect(state.type).toBe('pvp')
      state = determineNextFightType(state.pvpSinceLastPve, 0.33, false)
      expect(state.type).toBe('pve')
    })
  })

  describe('buildFightPlan with pveRatio=0.5 (every 2nd fight PvE)', () => {
    it('produces correct 5-fight plan', () => {
      const plan = buildFightPlan(5, 0.5, false)
      expect(plan).toEqual(['pvp', 'pve', 'pvp', 'pve', 'pvp'])
    })

    it('triggers pve after 1 pvp fight', () => {
      let state = determineNextFightType(0, 0.5, false)
      expect(state.type).toBe('pvp')
      state = determineNextFightType(state.pvpSinceLastPve, 0.5, false)
      expect(state.type).toBe('pve')
    })
  })

  describe('buildFightPlan with pveRatio=0.2 (every 5th fight PvE)', () => {
    it('produces correct 6-fight plan', () => {
      const plan = buildFightPlan(6, 0.2, false)
      expect(plan).toEqual(['pvp', 'pvp', 'pvp', 'pvp', 'pve', 'pvp'])
    })
  })

  describe('buildFightPlan with pveOnly=true', () => {
    it('produces all pve fights', () => {
      const plan = buildFightPlan(5, 0.33, true)
      expect(plan).toEqual(['pve', 'pve', 'pve', 'pve', 'pve'])
    })
  })

  describe('calculatePveRatio', () => {
    it('calculates PvE fight ratio correctly for 0.33', () => {
      const plan = buildFightPlan(100, 0.33, false)
      const pveCount = plan.filter(t => t === 'pve').length
      // ~33% should be PvE
      expect(pveCount).toBeGreaterThanOrEqual(30)
      expect(pveCount).toBeLessThanOrEqual(36)
    })

    it('calculates PvE fight ratio correctly for 0.5', () => {
      const plan = buildFightPlan(100, 0.5, false)
      const pveCount = plan.filter(t => t === 'pve').length
      // ~50% should be PvE
      expect(pveCount).toBeGreaterThanOrEqual(45)
      expect(pveCount).toBeLessThanOrEqual(55)
    })

    it('calculates PvE fight ratio correctly for pveOnly', () => {
      const plan = buildFightPlan(100, 0.33, true)
      const pveCount = plan.filter(t => t === 'pve').length
      expect(pveCount).toBe(100)
    })

    it('calculates PvE fight ratio correctly for ratio 0', () => {
      const plan = buildFightPlan(100, 0, false)
      const pveCount = plan.filter(t => t === 'pve').length
      expect(pveCount).toBe(0)
    })
  })

  describe('monsterNameFromResult extraction patterns', () => {
    function parseMonsterFromResultText(text: string): string | null {
      // Matches "Victory over Goblin", "Defeated by Ogre", "Stalemate vs Wraith"
      const patterns = [
        /(?:Victory over|Defeated by|Stalemate vs)\s+(\w+)/i,
      ]
      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[1]
      }
      return null
    }

    it('extracts monster name from Victory over pattern', () => {
      expect(parseMonsterFromResultText('Victory over Goblin')).toBe('Goblin')
    })

    it('extracts monster name from Defeated by pattern', () => {
      expect(parseMonsterFromResultText('Defeated by Ogre')).toBe('Ogre')
    })

    it('extracts monster name from Stalemate vs pattern', () => {
      expect(parseMonsterFromResultText('Stalemate vs Wraith')).toBe('Wraith')
    })

    it('extracts monster names with numbers', () => {
      expect(parseMonsterFromResultText('Victory over Dragon Spawn')).toBe('Dragon')
    })

    it('returns null when no monster pattern matches', () => {
      expect(parseMonsterFromResultText('Just some random text')).toBeNull()
    })

    it('returns null for empty text', () => {
      expect(parseMonsterFromResultText('')).toBeNull()
    })
  })

  describe('MonsterId to display name mapping', () => {
    // Mirror the MONSTER_DISPLAY_NAMES mapping from qa-bot.mjs
    const MONSTER_DISPLAY_NAMES: Record<string, string> = {
      goblin: 'Goblin',
      ogre: 'Ogre',
      wraith: 'Wraith',
      slime: 'Slime',
      wolf: 'Wolf',
      skeleton: 'Skeleton',
      chimera: 'Chimera',
      dragon_spawn: 'Dragon Spawn',
    }

    it('maps goblin to Goblin', () => {
      expect(MONSTER_DISPLAY_NAMES.goblin).toBe('Goblin')
    })

    it('maps ogre to Ogre', () => {
      expect(MONSTER_DISPLAY_NAMES.ogre).toBe('Ogre')
    })

    it('maps wraith to Wraith', () => {
      expect(MONSTER_DISPLAY_NAMES.wraith).toBe('Wraith')
    })

    it('maps slime to Slime', () => {
      expect(MONSTER_DISPLAY_NAMES.slime).toBe('Slime')
    })

    it('maps wolf to Wolf', () => {
      expect(MONSTER_DISPLAY_NAMES.wolf).toBe('Wolf')
    })

    it('maps skeleton to Skeleton', () => {
      expect(MONSTER_DISPLAY_NAMES.skeleton).toBe('Skeleton')
    })

    it('maps chimera to Chimera', () => {
      expect(MONSTER_DISPLAY_NAMES.chimera).toBe('Chimera')
    })

    it('maps dragon_spawn to Dragon Spawn', () => {
      expect(MONSTER_DISPLAY_NAMES.dragon_spawn).toBe('Dragon Spawn')
    })

    it('returns undefined for unknown monster id', () => {
      expect(MONSTER_DISPLAY_NAMES.unknown).toBeUndefined()
    })

    it('fallback formatting capitalizes first letter and replaces underscores', () => {
      const fallbackFormat = (id: string): string =>
        id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
      expect(fallbackFormat('dragon_spawn')).toBe('Dragon spawn')
      expect(fallbackFormat('goblin')).toBe('Goblin')
      expect(fallbackFormat('fire_elemental')).toBe('Fire elemental')
    })
  })
})
