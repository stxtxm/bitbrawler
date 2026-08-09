/**
 * QA Analysis Tests
 *
 * Tests for the QA stats analysis aggregation logic that handles:
 * - PvE monster data
 * - Equipment data 
 * - Streak data
 *
 * These test the pure computation logic used in scripts/analyze-qa-stats.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Types matching RunRecord from analyze-qa-stats.ts ──

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  max_hp?: number | null
  fight_type?: 'pvp' | 'pve'
  monster_name?: string | null
}

interface LootboxResult {
  available: boolean
  opened?: boolean
  item?: string | null
  rarity?: string | null
  item_stats?: string[]
  reason?: string
  raw_text?: string
}

interface RunRecord {
  date: string
  run: string
  character: string
  fights: FightRecord[]
  lootbox?: LootboxResult | null
  initial_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  final_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  lootbox_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  initial_streak?: number | null
  final_streak?: number | null
  lootbox_streak?: number | null
  pve_data?: { fights: number; wins: number; xp_total: number; monsters_faced: string[] }
  errors: string[]
}

interface EquipmentAnalysis {
  runs_with_data: number
  item_names: string[]
  unique_item_count: number
}

interface StreakAnalysis {
  avg_initial_streak: number
  avg_final_streak: number
  runs_with_data: number
}

// ── Pure analysis functions (mirroring analyze-qa-stats.ts logic) ──

function computePveMonsters(fights: FightRecord[]): Record<string, number> {
  const pveFights = fights.filter(f => f.fight_type === 'pve')
  const monsters: Record<string, number> = {}
  for (const f of pveFights) {
    if (f.monster_name) {
      const name = f.monster_name.trim()
      monsters[name] = (monsters[name] || 0) + 1
    }
  }
  return monsters
}

function computeEquipmentAnalysis(runs: RunRecord[]): EquipmentAnalysis | null {
  const runsWithEquipment = runs.filter(
    (r) => r.initial_equipment !== null && r.initial_equipment !== undefined && r.initial_equipment.length > 0
  )
  const runsWithLootboxEquipment = runs.filter(
    (r) => r.lootbox_equipment !== null && r.lootbox_equipment !== undefined && r.lootbox_equipment.length > 0
  )
  const allEquippedItems = [
    ...runsWithEquipment.flatMap(r => r.initial_equipment!.map(e => e.name)),
    ...runsWithLootboxEquipment.flatMap(r => r.lootbox_equipment!.map(e => e.name)),
  ]
  if (allEquippedItems.length === 0) return null

  return {
    runs_with_data: runsWithEquipment.length + runsWithLootboxEquipment.length,
    item_names: [...new Set(allEquippedItems)],
    unique_item_count: new Set(allEquippedItems).size,
  }
}

function computeStreakAnalysis(runs: RunRecord[]): StreakAnalysis | null {
  const runsWithInitStreak = runs.filter(
    (r): r is RunRecord & { initial_streak: number } => typeof r.initial_streak === 'number'
  )
  const runsWithFinalStreak = runs.filter(
    (r): r is RunRecord & { final_streak: number } => typeof r.final_streak === 'number'
  )
  const runsWithLootboxStreak = runs.filter(
    (r): r is RunRecord & { lootbox_streak: number } => typeof r.lootbox_streak === 'number'
  )

  if (runsWithInitStreak.length === 0 && runsWithLootboxStreak.length === 0) return null

  return {
    avg_initial_streak: runsWithInitStreak.length > 0
      ? runsWithInitStreak.reduce((s, r) => s + r.initial_streak, 0) / runsWithInitStreak.length
      : 0,
    avg_final_streak: runsWithFinalStreak.length > 0
      ? runsWithFinalStreak.reduce((s, r) => s + r.final_streak, 0) / runsWithFinalStreak.length
      : (runsWithLootboxStreak.length > 0
        ? runsWithLootboxStreak.reduce((s, r) => s + r.lootbox_streak, 0) / runsWithLootboxStreak.length
        : 0),
    runs_with_data: Math.max(runsWithInitStreak.length, runsWithLootboxStreak.length),
  }
}

function computePveWinRate(pveFights: FightRecord[]): number {
  if (pveFights.length === 0) return 0
  const wins = pveFights.filter(f => f.result === 'victory')
  return wins.length / pveFights.length
}

// ── Tests ──

describe('QA PvE Analysis', () => {
  describe('computePveMonsters', () => {
    it('returns empty object when no PvE fights exist', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
      ]
      expect(computePveMonsters(fights)).toEqual({})
    })

    it('aggregates monster names from PvE fights', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Goblin: 2, Ogre: 1 })
    })

    it('ignores PvE fights with null monster_name', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: null },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Goblin: 1, Ogre: 1 })
    })

    it('ignores PvP fights even if they have monster_name', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Ogre: 1 })
    })

    it('trims whitespace from monster names', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: '  Goblin  ' },
      ]
      const result = computePveMonsters(fights)
      expect(result).toEqual({ Goblin: 1 })
    })

    it('handles empty fights array', () => {
      expect(computePveMonsters([])).toEqual({})
    })
  })

  describe('computePveWinRate', () => {
    it('returns 0 for no PvE fights', () => {
      expect(computePveWinRate([])).toBe(0)
    })

    it('calculates correct win rate', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Ogre' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Wraith' },
      ]
      expect(computePveWinRate(fights)).toBeCloseTo(2 / 3, 5)
    })

    it('returns 1.0 for all wins', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(1.0)
    })

    it('returns 0 for all losses', () => {
      const fights: FightRecord[] = [
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(0)
    })

    it('counts draws as non-wins', () => {
      const fights: FightRecord[] = [
        { result: 'draw', xp: 50, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(0.5)
    })
  })
})

describe('QA Equipment Analysis', () => {
  it('returns null when no equipment data exists', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [] },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })

  it('aggregates equipment from initial_equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword', rarity: 'common' },
          { slot: 'armor', name: 'Leather Armor', rarity: 'common' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(2)
    expect(result!.item_names).toContain('Iron Sword')
    expect(result!.item_names).toContain('Leather Armor')
  })

  it('aggregates equipment from lootbox_equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        lootbox_equipment: [
          { slot: 'weapon', name: 'Steel Sword', rarity: 'rare' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(1)
    expect(result!.item_names).toContain('Steel Sword')
  })

  it('combines both initial and lootbox equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
        lootbox_equipment: [
          { slot: 'armor', name: 'Steel Armor' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.unique_item_count).toBe(2)
    expect(result!.runs_with_data).toBe(2) // both initial and lootbox count as separate
  })

  it('deduplicates item names across runs', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
      },
      {
        date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.unique_item_count).toBe(1)
    expect(result!.item_names).toEqual(['Iron Sword'])
  })

  it('handles runs with empty equipment arrays', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [],
      },
      {
        date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [],
        lootbox_equipment: [
          { slot: 'weapon', name: 'Bronze Dagger' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(1)
  })

  it('ignores null equipment fields', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: null,
        lootbox_equipment: null,
      },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })
})

describe('QA Streak Analysis', () => {
  it('returns null when no streak data exists', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [] },
    ]
    expect(computeStreakAnalysis(runs)).toBeNull()
  })

  it('calculates average initial streak', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4 },
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 6 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(4)
    expect(result!.runs_with_data).toBe(3)
  })

  it('calculates average final streak from final_streak', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2, final_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4, final_streak: 5 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(3)
    expect(result!.avg_final_streak).toBe(4)
    expect(result!.runs_with_data).toBe(2)
  })

  it('falls back to lootbox_streak for final streak when final_streak is missing', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2, lootbox_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4, lootbox_streak: 6 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBe(4.5)
    expect(result!.runs_with_data).toBe(2)
  })

  it('prefers final_streak over lootbox_streak', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_streak: 2, final_streak: 3, lootbox_streak: 5,
      },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBe(3)
  })

  it('handles zero streak values', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 0, final_streak: 1 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(0)
    expect(result!.avg_final_streak).toBe(0.5)
  })

  it('handles mixed presence of streak data', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [] }, // no streak data
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 5 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(4)
    expect(result!.runs_with_data).toBe(2)
  })

  it('returns null when all initial streak values are null/undefined', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: null },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: undefined },
    ]
    expect(computeStreakAnalysis(runs)).toBeNull()
  })
})

describe('QA Level-Up Event Contract', () => {
  it('qa-bot.mjs binds levels_gained to the camelCase local (no ReferenceError shorthand)', () => {
    const source = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')
    // The fight-loop level-up event must emit the snake_case key the analyzer
    // expects (analyze-qa-stats.ts LevelUpEvent.levels_gained). A bare shorthand
    // `levels_gained,` would reference a non-existent variable (the local is
    // `levelsGained`) → ReferenceError that crashes every QA run on level-up (#630).
    expect(source).toContain('levels_gained: levelsGained,')
    expect(source).not.toMatch(/levels_gained,\s*\n/)
  })
})

describe('QA Bot Overlay Deadlock Contract', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  it('registers a locator handler for .inventory-overlay that force-closes it', () => {
    // Without this handler (unlike the level-up one) the inventory overlay can
    // stay open and intercept pointer events on Settings/Inventory (#637).
    expect(qaBotSource).toContain("page.addLocatorHandler(")
    expect(qaBotSource).toContain("page.locator('.inventory-overlay')")
    expect(qaBotSource).toContain('.inventory-close')
  })

  it('defines a dismissModals(page) helper that polls for overlay detach', () => {
    const fn = requireAsyncFunction('dismissModals')
    expect(fn).toContain("keyboard.press('Escape')")
    expect(fn).toContain("page.locator('.retro-modal-overlay').first()")
    expect(fn).toContain("page.locator('.lootbox-result-overlay').first()")
    expect(fn).toContain("state: 'detached'")
  })

  it('syncAutoMode dismisses open modals before clicking Settings', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const dismissIdx = fn.indexOf('dismissModals(page)')
    const settingsClickIdx = fn.indexOf('settingsBtn.click()')
    expect(dismissIdx).toBeGreaterThan(-1)
    expect(settingsClickIdx).toBeGreaterThan(dismissIdx)
  })

  it('handleDailyLootbox waits for inventory-overlay detach and does not silently swallow close errors', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    expect(fn).toContain("waitForSelector('.inventory-overlay'")
    expect(fn).toContain("state: 'detached'")
    expect(fn).not.toMatch(/closeInventory\.click\(\)\.catch\(\(\) => \{\}\)/)
  })

  it('guards the .inventory-overlay locator handler with suppressInventoryHandler + noWaitAfter (deadlock v2 #645)', () => {
    // The #637 handler dismisses the inventory on EVERY intercepted action. During
    // handleDailyLootbox the overlay must stay OPEN (the lootbox button lives inside
    // it), so the handler fights the flow → infinite retry → 30s timeout (#645).
    // A bare `return` guard is NOT enough: Playwright waits for the selector to be
    // hidden after the handler unless noWaitAfter is set, which would still block.
    expect(qaBotSource).toContain('let suppressInventoryHandler = false')
    const overlayLocatorIdx = qaBotSource.indexOf("page.locator('.inventory-overlay')")
    expect(overlayLocatorIdx).toBeGreaterThan(-1)
    const handlerBlock = qaBotSource.slice(overlayLocatorIdx, overlayLocatorIdx + 700)
    expect(handlerBlock).toContain('if (suppressInventoryHandler) return')
    expect(handlerBlock).toContain('noWaitAfter: true')
  })

  it('handleDailyLootbox suppresses the inventory handler before opening inventory and re-arms it on every exit path (#645)', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const clickIdx = fn.indexOf('inventoryBtn.click()')
    expect(setIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeLessThan(clickIdx)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/return \{/g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBe(returnsAfter)
  })

  it('syncAutoMode targets the Auto mode switch with a strict locator, never the generic [role="switch"] fallback (#653)', () => {
    // The composite locator '[role="switch"][aria-label="Auto mode"], [role="switch"],
    // .pixel-switch' .first() resolved to the PvE switch (ActionPanel, higher in DOM)
    // instead of the Auto mode switch inside the settings modal → click intercepted by
    // the settings-overlay → 30s timeout on every run (#653).
    const fn = requireAsyncFunction('syncAutoMode')
    expect(fn).toContain("getByRole('switch', { name: 'Auto mode' })")
    expect(fn).not.toContain('[role="switch"][aria-label="Auto mode"], [role="switch"], .pixel-switch')
    expect(fn).not.toMatch(/,\s*\[role="switch"\]/)
  })

  it('syncAutoMode verifies the settings overlay is open before clicking the Auto mode switch (#653)', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const overlayCheckIdx = fn.indexOf('settings-overlay')
    const clickIdx = fn.indexOf('autoSwitch.click()')
    expect(overlayCheckIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(overlayCheckIdx)
  })

  it('syncAutoMode retries the toggle with force click when aria-checked does not change after click (#653)', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const firstClick = fn.indexOf('autoSwitch.click()')
    const forceClick = fn.indexOf('autoSwitch.click({ force: true })')
    expect(firstClick).toBeGreaterThan(-1)
    expect(forceClick).toBeGreaterThan(firstClick)
    const retryChecked = fn.indexOf("getAttribute('aria-checked')", forceClick)
    expect(retryChecked).toBeGreaterThan(forceClick)
  })
})

describe('QA Bot Locked Tab Skip Contract', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  it('defines an isTabLocked helper that detects disabled tabs or "Unlocks at LVL" titles (#685)', () => {
    const fn = extractAsyncFunction(qaBotSource, 'isTabLocked')
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error('qa-bot.mjs missing async function isTabLocked()')
    expect(fn).toContain('isDisabled()')
    expect(fn).toContain('Unlocks at LVL')
    expect(fn).toContain("getAttribute('title')")
  })

  it('testForgeSystem guards the Fusion tab click with isTabLocked and skips via createSkippedForgeResult (#685)', () => {
    const fn = requireAsyncFunction('testForgeSystem')
    const lockIdx = fn.indexOf('isTabLocked(fusionTab)')
    const clickIdx = fn.indexOf('fusionTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedForgeResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })

  it('testForgeSystem guards the Upgrade tab click with isTabLocked and skips via createSkippedForgeResult (#685)', () => {
    const fn = requireAsyncFunction('testForgeSystem')
    const lockIdx = fn.indexOf('isTabLocked(upgradeTab)')
    const clickIdx = fn.indexOf('upgradeTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedForgeResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })

  it('testShopSystem guards the Shop tab click with isTabLocked and returns createSkippedShopResult (#685)', () => {
    const fn = requireAsyncFunction('testShopSystem')
    const lockIdx = fn.indexOf('isTabLocked(shopTab)')
    const clickIdx = fn.indexOf('shopTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedShopResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })
})
