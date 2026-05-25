import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import config from './qa-bot.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATS_FILE = join(__dirname, config.statsFile)
const STATE_FILE = join(__dirname, config.stateFile)
const SCREENSHOTS_DIR = join(__dirname, config.screenshotsDir)
const QA_TIME_ZONE = config.timeZone || 'Europe/Paris'

function getZonedParts(date = new Date(), timeZone = QA_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const values = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function dateKey(date = new Date(), timeZone = QA_TIME_ZONE) {
  const parts = getZonedParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getAppUrl(path) {
  return new URL(path, config.baseUrl).toString()
}

function loadStats() {
  try {
    const data = readFileSync(STATS_FILE, 'utf-8')
    console.log(`   📄 Loaded stats from ${STATS_FILE}`)
    return JSON.parse(data)
  } catch (err) {
    console.log(`   📄 No existing stats at ${STATS_FILE}, starting fresh (${err.message})`)
    return []
  }
}

function saveStats(stats) {
  try {
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2))
    console.log(`   💾 Stats written to ${STATS_FILE} (${stats.length} records)`)
  } catch (err) {
    console.error(`   ❌ Failed to write stats to ${STATS_FILE}: ${err.message}`)
    throw err
  }
}

function loadState() {
  try {
    const data = readFileSync(STATE_FILE, 'utf-8')
    console.log(`   📄 Loaded state from ${STATE_FILE}`)
    return JSON.parse(data)
  } catch (err) {
    console.log(`   📄 No existing state at ${STATE_FILE}, starting fresh (${err.message})`)
    return {}
  }
}

function saveState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
    console.log(`   💾 State written to ${STATE_FILE}`)
  } catch (err) {
    console.error(`   ❌ Failed to write state to ${STATE_FILE}: ${err.message}`)
    throw err
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function readBodyText(page) {
  return page.locator('body').innerText().catch(() => '')
}

async function readArenaStatus(page) {
  const bodyText = await readBodyText(page)
  const energyMatch = bodyText.match(/(\d+)\s*\/\s*5\s*AVAILABLE/i)
  const fightsAvailable = energyMatch ? parseInt(energyMatch[1], 10) : null
  const giantFightBtn = page.locator('button.primary-btn.giant-btn').first()
  const fightButtonVisible = await giantFightBtn.isVisible({ timeout: 1000 }).catch(() => false)
  const fightButtonLabel = fightButtonVisible
    ? ((await giantFightBtn.textContent().catch(() => '')) || '').trim().toUpperCase()
    : ''
  const isResting = bodyText.includes('REST NOW') || fightButtonLabel.includes('REST NOW')
  const isResolving = bodyText.includes('RESOLVING') || fightButtonLabel.includes('RESOLVING')
  const hasFightCta = fightButtonLabel.includes('FIGHT')

  return {
    bodyText,
    fightsAvailable,
    fightButtonVisible,
    fightButtonLabel,
    isResting,
    isResolving,
    hasFightCta,
  }
}

async function waitForArena(page, timeout = 15000) {
  const startedAt = Date.now()
  try {
    await page.waitForFunction(
      () => {
        const path = window.location.pathname || ''
        const text = document.body.innerText || ''
        return path.includes('/arena') || text.includes('BATTLE ENERGY') || text.includes('AUTO MODE')
      },
      { timeout }
    )
    return Date.now() - startedAt
  } catch {
    return null
  }
}

async function openLogin(page) {
  await page.goto(getAppUrl('/login'), { waitUntil: 'networkidle', timeout: 30000 })
}

async function loginCharacter(page, charName) {
  await openLogin(page)

  const nameInput = page.locator('input[name="name"], input[type="text"], .retro-input input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await nameInput.fill(charName)

  const submitBtn = page.locator('button:has-text("ENTER ARENA"), button:has-text("LOGIN"), button:has-text("START")').first()
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 })
  await submitBtn.click()

  const arenaLoadMs = await waitForArena(page, 12000)
  if (arenaLoadMs !== null) {
    return { outcome: 'reused', arenaLoadMs }
  }

  const bodyText = await readBodyText(page)
  const currentUrl = page.url()
  if (
    bodyText.toUpperCase().includes('FIGHTER NOT FOUND') ||
    currentUrl.includes('/login')
  ) {
    return { outcome: 'missing', arenaLoadMs: null }
  }

  throw new Error(`Unable to determine login result for ${charName} (url=${currentUrl})`)
}

async function openCharacterCreation(page) {
  await page.goto(getAppUrl('/create-character'), { waitUntil: 'networkidle', timeout: 30000 })
}

async function generateAppCharacterName(page) {
  const nameInput = page.locator('input[type="text"], .retro-input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })

  const diceBtn = page.locator('button[aria-label="Generate Random Name"], button[title="Generate Random Name"]').first()
  if (!(await diceBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new Error('Random name button not found on character creation screen')
  }

  await diceBtn.click()
  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[type="text"]')
      return Boolean(input && input.value && input.value.trim().length > 0)
    },
    { timeout: 5000 }
  )

  const generatedName = (await nameInput.inputValue()).trim().toUpperCase()
  if (!generatedName) {
    throw new Error('App-generated random name was empty')
  }

  return generatedName
}

async function createCharacterFromAppGenerator(page) {
  await openCharacterCreation(page)

  for (let attempt = 1; attempt <= 5; attempt++) {
    const charName = await generateAppCharacterName(page)
    console.log(`🎲 Generated app name: ${charName} (attempt ${attempt}/5)`)

    const rollBtn = page.locator('button:has-text("ROLL STATS"), button:has-text("ROLL"), button:has-text("REROLL"), button:has-text("RANDOM")').first()
    if (await rollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rollBtn.click()
      await page.waitForTimeout(500)
    }

    const startBtn = page.locator('button:has-text("START GAME"), button:has-text("START"), button:has-text("CREATE"), button:has-text("FIGHT")').first()
    await startBtn.waitFor({ state: 'visible', timeout: 10000 })
    await startBtn.click()

    const arenaLoadMs = await waitForArena(page, 15000)
    if (arenaLoadMs !== null) {
      return { outcome: 'created', character: charName, arenaLoadMs }
    }

    const bodyText = await readBodyText(page)
    if (bodyText.toUpperCase().includes('NAME ALREADY TAKEN')) {
      const closeErrorBtn = page.locator('button:has-text("OK"), button:has-text("CLOSE")').first()
      if (await closeErrorBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeErrorBtn.click().catch(() => {})
        await page.waitForTimeout(500)
      }
      continue
    }

    throw new Error(`Character creation did not reach arena for generated name ${charName}`)
  }

  throw new Error('Could not create a QA fighter from app-generated names after multiple attempts')
}

async function loginOrCreateDailyCharacter(page, runKey, savedCharacterName) {
  if (savedCharacterName) {
    console.log(`🎭 Reusing daily QA fighter from state: ${savedCharacterName}`)
    const loginResult = await loginCharacter(page, savedCharacterName)
    if (loginResult.outcome === 'reused') {
      return { ...loginResult, character: savedCharacterName }
    }
    console.log(`   Stored fighter ${savedCharacterName} not found for ${runKey}, creating a new one...`)
  } else {
    console.log(`🎭 No daily QA fighter stored for ${runKey}, creating a new one...`)
  }

  const createResult = await createCharacterFromAppGenerator(page)
  if (createResult.outcome === 'created') {
    return createResult
  }

  throw new Error(`Daily QA fighter for ${runKey} could not be created or reused`)
}

async function syncAutoMode(page, desiredEnabled) {
  console.log(`🔁 Setting auto mode to ${desiredEnabled ? 'ON' : 'OFF'}...`)

  const settingsBtn = page.locator('button[aria-label="Settings"], button:has-text("SETTINGS"), [class*="settings"]').first()
  if (!(await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('   Settings button not found')
    return false
  }

  await settingsBtn.click()
  await page.waitForTimeout(1000)

  const autoSwitch = page.locator('[role="switch"][aria-label="Auto mode"], [role="switch"], .pixel-switch').first()
  if (!(await autoSwitch.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('   Auto mode switch not found')
    return false
  }

  const currentValue = await autoSwitch.getAttribute('aria-checked').catch(() => null)
  const isEnabled = currentValue === 'true'
  if (isEnabled !== desiredEnabled) {
    await autoSwitch.click()
    await page.waitForTimeout(1000)
    console.log(`   Auto mode changed to ${desiredEnabled ? 'ON' : 'OFF'} ✅`)
  } else {
    console.log(`   Auto mode already ${desiredEnabled ? 'ON' : 'OFF'}`)
  }

  const closeSettings = page.locator('button[aria-label="Close settings"], button:has-text("CLOSE"), button:has-text("OK"), .modal-close, .inventory-close').first()
  if (await closeSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeSettings.click()
    await page.waitForTimeout(500)
  }

  return true
}

/**
 * Parse character stats (STR, VIT, DEX, LUK, INT, FOC) from the arena page.
 * Returns an object with stat keys or null if parsing fails.
 */
async function parseCharacterStats(page) {
  try {
    // Try structured selectors first (fastest, most reliable)
    const statLabels = page.locator('.compact-stat-label')
    const statValues = page.locator('.compact-stat-value')
    const labelCount = await statLabels.count()
    const valueCount = await statValues.count()

    if (labelCount > 0 && labelCount === valueCount) {
      const stats = {}
      for (let i = 0; i < labelCount; i++) {
        const label = ((await statLabels.nth(i).textContent().catch(() => '')) || '').trim().toLowerCase()
        const value = parseInt((await statValues.nth(i).textContent().catch(() => '0')) || '0', 10)
        if (label && !isNaN(value)) {
          stats[label] = value
        }
      }
      if (Object.keys(stats).length >= 4) return stats
    }

    // Fallback: parse from body text patterns like "STR 10" / "VIT 12"
    const text = await page.locator('body').innerText().catch(() => '')
    const statPatterns = [
      { key: 'str', patterns: [/STR\s*[:\-]?\s*(\d+)/i, /strength\s*[:\-]?\s*(\d+)/i] },
      { key: 'vit', patterns: [/VIT\s*[:\-]?\s*(\d+)/i, /vitality\s*[:\-]?\s*(\d+)/i] },
      { key: 'dex', patterns: [/DEX\s*[:\-]?\s*(\d+)/i, /dexterity\s*[:\-]?\s*(\d+)/i] },
      { key: 'luk', patterns: [/LUK\s*[:\-]?\s*(\d+)/i, /luck\s*[:\-]?\s*(\d+)/i] },
      { key: 'int', patterns: [/INT\s*[:\-]?\s*(\d+)/i, /intelligence\s*[:\-]?\s*(\d+)/i] },
      { key: 'foc', patterns: [/FOC\s*[:\-]?\s*(\d+)/i, /focus\s*[:\-]?\s*(\d+)/i] },
    ]

    const stats = {}
    for (const { key, patterns } of statPatterns) {
      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          stats[key] = parseInt(match[1], 10)
          break
        }
      }
    }
    if (Object.keys(stats).length >= 4) return stats

    return null
  } catch (err) {
    console.log(`   ⚠️ Could not parse character stats: ${err.message}`)
    return null
  }
}

/**
 * Parse max HP from the arena page.
 * The game restores HP after every fight, so current HP always equals max HP.
 * Returns the max HP number or null.
 */
async function parseMaxHp(page) {
  try {
    // The .stat-val element shows the max HP text (e.g. "164")
    const hpStatVal = page.locator('.stat-val').first()
    const maxHpText = ((await hpStatVal.textContent().catch(() => '')) || '').trim()
    const maxHp = parseInt(maxHpText, 10)
    if (!isNaN(maxHp) && maxHp > 0) return maxHp

    // Fallback: body text patterns
    const text = await page.locator('body').innerText().catch(() => '')
    const match = text.match(/HP\s*[:\-]?\s*(\d+)/i) || text.match(/(\d+)\s*HP/i)
    if (match) {
      const hp = parseInt(match[1], 10)
      if (!isNaN(hp) && hp > 0) return hp
    }

    return null
  } catch (err) {
    console.log(`   ⚠️ Could not parse max HP: ${err.message}`)
    return null
  }
}

/**
 * Parse character level from the arena page body text.
 * Returns the level number or null.
 */
function parseLevelFromText(text) {
  const match = text.match(/LVL\s*(\d+)/i)
  return match ? parseInt(match[1]) : null
}

/**
 * Parse character XP from the arena page body text.
 * Returns { current, max } or null.
 */
function parseXpFromText(text) {
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*XP/i)
  return match ? { current: parseInt(match[1]), max: parseInt(match[2]) } : null
}

async function handleDailyLootbox(page, runKey) {
  console.log('🎁 Checking lootbox...')

  const inventoryBtn = page.locator('button[aria-label="Inventory"], button[title="Inventory"]').first()
  if (!(await inventoryBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('   Inventory button not found')
    return { available: false, opened: false, reason: 'inventory-button-missing' }
  }

  await inventoryBtn.click()
  await page.waitForTimeout(800)

  const lootboxBtn = page.locator('button[aria-label="Daily lootbox roll"], .lootbox-btn').first()
  if (!(await lootboxBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('   Lootbox button not found in inventory')
    const closeInventory = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeInventory.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeInventory.click().catch(() => {})
    }
    return { available: false, opened: false, reason: 'lootbox-button-missing' }
  }

  const label = (((await lootboxBtn.textContent().catch(() => '')) || '').trim().toUpperCase())
  const enabled = await lootboxBtn.isEnabled().catch(() => false)

  if (!enabled || label.includes('COME BACK TOMORROW')) {
    console.log('   No lootbox available today')
    const closeInventory = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeInventory.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeInventory.click().catch(() => {})
    }
    return { available: false, opened: false, reason: 'already-opened' }
  }

  if (label.includes('INVENTORY FULL')) {
    console.log('   Lootbox blocked because inventory is full')
    const closeInventory = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeInventory.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeInventory.click().catch(() => {})
    }
    return { available: false, opened: false, reason: 'inventory-full' }
  }

  if (!label.includes('DAILY LOOTBOX')) {
    console.log(`   Lootbox in unexpected state: ${label || 'no label'}`)
    const closeInventory = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeInventory.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeInventory.click().catch(() => {})
    }
    return { available: false, opened: false, reason: 'unexpected-label', label }
  }

  await lootboxBtn.click()
  await page.waitForTimeout(1600)

  await page.waitForFunction(
    () => {
      const text = document.body.innerText || ''
      return text.includes('NEW ITEM') || text.includes('COME BACK TOMORROW') || text.includes('INVENTORY FULL')
    },
    { timeout: 6000 }
  ).catch(() => {})

  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-04-lootbox.png`) })

  const rewardName = ((await page.locator('.lootbox-result-name').textContent().catch(() => '')) || '').trim()
  const rewardRarity = ((await page.locator('.lootbox-result-rarity').textContent().catch(() => '')) || '').trim()
  const bodyText = await readBodyText(page)

  if (rewardName) {
    console.log(`   Lootbox opened: ${rewardName} (${rewardRarity || 'unknown rarity'})`)
  } else {
    console.log('   Lootbox opened')
  }

  const resultOverlay = page.locator('.lootbox-result-overlay').first()
  if (await resultOverlay.isVisible({ timeout: 1500 }).catch(() => false)) {
    await resultOverlay.click({ force: true }).catch(() => {})
    await page.waitForTimeout(500)
  }

  const closeInventory = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
  if (await closeInventory.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeInventory.click().catch(() => {})
    await page.waitForTimeout(500)
  }

  // Parse item stats from lootbox result if visible
  const statValues = await page.locator('.lootbox-stat-value').allTextContents().catch(() => [])
  const itemStats = statValues.length > 0
    ? statValues.map(s => s.trim()).filter(Boolean)
    : undefined

  return {
    available: true,
    opened: true,
    item: rewardName || null,
    rarity: rewardRarity || null,
    item_stats: itemStats?.length ? itemStats : undefined,
    raw_text: bodyText.includes('NEW ITEM') ? 'NEW ITEM' : undefined,
  }
}

function persistQaState(runKey, character, source, exhausted) {
  saveState({
    run: runKey,
    character,
    exhausted,
    updated_at: new Date().toISOString(),
    source,
  })
}

async function maybeReplaceExhaustedCharacter(page, runKey, runRecord, reason) {
  console.log(`♻️ Replacing QA fighter because ${reason}...`)
  const previousCharacter = runRecord.character
  const replacement = await createCharacterFromAppGenerator(page)
  runRecord.character = replacement.character
  runRecord.character_action = previousCharacter
    ? `created-after-${reason}`
    : replacement.outcome
  runRecord.replaced_character = previousCharacter
  if (replacement.arenaLoadMs !== null) {
    runRecord.load_times_ms.arena = replacement.arenaLoadMs
    console.log(`   Replacement arena loaded in ${runRecord.load_times_ms.arena}ms`)
  }
  console.log(`🎭 Active QA fighter: ${runRecord.character}`)
  persistQaState(runKey, runRecord.character, runRecord.character_action, false)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-03-arena-replacement.png`) })
}

/**
 * Handle the level-up popup overlay by allocating ALL stat points
 * and dismissing the overlay so the FIGHT button becomes clickable again.
 * Loops until all points are allocated, then clicks APPLY.
 * Returns true if the overlay was handled, false if not present.
 */
async function handleLevelUpOverlay(page) {
  const OVERLAY_TIMEOUT = 2000
  const levelUpOverlay = page.locator('.level-up-pop-overlay').first()
  if (!(await levelUpOverlay.isVisible({ timeout: OVERLAY_TIMEOUT }).catch(() => false))) {
    return false
  }

  console.log('   Level-up overlay detected, handling...')

  // 1. Loop: allocate ALL stat points until APPLY becomes enabled
  let allocatedCount = 0
  for (let attempt = 0; attempt < 10; attempt++) {
    // Check if APPLY is enabled (no more points to allocate)
    const applyBtn = page.locator('.level-up-confirm').first()
    if (await applyBtn.isEnabled({ timeout: 300 }).catch(() => false)) {
      await applyBtn.click()
      await page.waitForTimeout(500)
      console.log(`   ✅ Level-up overlay closed via APPLY (${allocatedCount} point${allocatedCount !== 1 ? 's' : ''} allocated)`)
      return true
    }

    // Allocate one point
    const statAddBtn = page.locator('.stat-add-btn').first()
    if (!(await statAddBtn.isVisible({ timeout: 300 }).catch(() => false))) {
      break // No add button and no APPLY = unexpected state
    }

    const ariaLabel = await statAddBtn.getAttribute('aria-label').catch(() => null)
    await statAddBtn.click()
    allocatedCount++
    console.log(`   Allocated point #${allocatedCount} (${ariaLabel || 'stat-add-btn'})`)
    await page.waitForTimeout(600)
  }

  // 2. Try APPLY one final time
  const applyBtn = page.locator('.level-up-confirm').first()
  if (await applyBtn.isEnabled({ timeout: 300 }).catch(() => false)) {
    await applyBtn.click()
    await page.waitForTimeout(500)
    console.log(`   ✅ Level-up overlay closed via APPLY (${allocatedCount} point${allocatedCount !== 1 ? 's' : ''} allocated)`)
    return true
  }

  // 3. Fallback: LATER button (shouldn't reach here if loop worked)
  const laterBtn = page.locator('.level-up-later').first()
  if (await laterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await laterBtn.click()
    await page.waitForTimeout(500)
    console.log(`   ⚠️ Level-up overlay deferred via LATER (${allocatedCount} point${allocatedCount !== 1 ? 's' : ''} allocated)`)
    return true
  }

  // 4. Last resort: force-click the overlay background to auto-dismiss
  console.log('   ⚠️ Force-dismissing level-up overlay')
  await levelUpOverlay.click({ force: true })
  await page.waitForTimeout(500)
  return true
}

async function runFightSequence(page, runKey, runRecord) {
  let recreatedForExhaustion = false
  let currentLevel = runRecord.initial_level

  // Dismiss any lingering level-up overlay from a previous run (reused character)
  const initialLevelUpOverlay = page.locator('.level-up-pop-overlay').first()
  if (await initialLevelUpOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('   Level-up overlay detected at start of run, dismissing...')
    const laterBtn = page.locator('.level-up-later').first()
    if (await laterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await laterBtn.click()
      await page.waitForTimeout(500)
      console.log('   Level-up overlay dismissed at start of run')
    }
  }

  for (let i = 0; i < config.fightsPerRun; i++) {
    const arenaStatus = await readArenaStatus(page)

    if (
      arenaStatus.fightsAvailable !== null &&
      arenaStatus.fightsAvailable <= 0
    ) {
      console.log('   No battle energy available for current fighter')
      if (!recreatedForExhaustion) {
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'exhausted-energy')
        recreatedForExhaustion = true
        i = -1
        continue
      }
      break
    }

    if (arenaStatus.isResting || !arenaStatus.hasFightCta) {
      console.log(`   Fight CTA not available (${arenaStatus.fightButtonLabel || 'no label'})`)
      if (!recreatedForExhaustion) {
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'missing-fight-cta')
        recreatedForExhaustion = true
        i = -1
        continue
      }
      break
    }

    // Check for level-up overlay right before FIGHT (it may appear asynchronously after CONTINUE)
    await handleLevelUpOverlay(page)

    console.log(`⚔️ Fight ${i + 1}/${config.fightsPerRun}...`)

    const fightBtn = page.locator('button.primary-btn.giant-btn').first()
    const fightStart = Date.now()
    // Retry FIGHT click with overlay handling in case overlay appears between check and click
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await handleLevelUpOverlay(page)
        await page.waitForTimeout(300)
      }
      const clicked = await fightBtn.click({ timeout: 3000 }).then(() => true).catch(() => false)
      if (clicked) break
      if (attempt === 2) {
        // Last attempt: try force click
        await fightBtn.click({ force: true }).catch(() => {})
      }
    }
    console.log('   Fight started, waiting for result...')

    await sleep(1000)

    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText
          return text.includes('VICTORY') || text.includes('DEFEAT') || text.includes('DRAW')
        },
        { timeout: config.fightTimeout }
      )
    } catch {
      console.log(`   Fight result not detected after ${config.fightTimeout}ms timeout, taking screenshot`)
      await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-timeout.png`) })
      runRecord.errors.push(`Fight ${i + 1}: timeout waiting for result (${config.fightTimeout}ms)`)

      const timeoutArenaStatus = await readArenaStatus(page)
      if (
        i === 0 &&
        runRecord.fights.length === 0 &&
        !recreatedForExhaustion &&
        (
          timeoutArenaStatus.isResting ||
          (timeoutArenaStatus.fightsAvailable !== null && timeoutArenaStatus.fightsAvailable <= 0) ||
          !timeoutArenaStatus.hasFightCta
        )
      ) {
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'timeout-on-exhausted-fighter')
        recreatedForExhaustion = true
        i = -1
        continue
      }

      await page.goto(config.baseUrl, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(3000)
      continue
    }

    const fightDuration = Date.now() - fightStart

    const pageText = await page.locator('body').innerText()
    const isVictory = pageText.includes('VICTORY')
    const isDefeat = pageText.includes('DEFEAT')

    const xpMatch = pageText.match(/\+(\d+)\s*XP/)
    const xpGained = xpMatch ? parseInt(xpMatch[1]) : null

    console.log(`   Result: ${isVictory ? '✅ VICTORY' : isDefeat ? '❌ DEFEAT' : '🤝 DRAW'} (${fightDuration}ms)`)

    // Temporarily store fight data (maxHp will be captured after arena is back)
    const thisFightData = {
      result: isVictory ? 'victory' : isDefeat ? 'defeat' : 'draw',
      xp: xpGained,
      fight_duration_ms: fightDuration,
      max_hp: null,                    // populated after CONTINUE + overlay dismiss
    }

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-${isVictory ? 'win' : isDefeat ? 'loss' : 'draw'}.png`),
    })

    const continueBtn = page.locator('button:has-text("CONTINUE"), button:has-text("CLOSE"), button:has-text("OK")').first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1500)
    }

    // Handle level-up overlay (allocate stat + dismiss) before next fight
    const hadOverlay = await handleLevelUpOverlay(page)

    // Capture max HP after returning to arena (reflects level-ups / equipment changes)
    thisFightData.max_hp = await parseMaxHp(page)
    console.log(`   max HP after fight: ${thisFightData.max_hp || '(unable to parse)'}`)

    // Push the completed fight data
    runRecord.fights.push(thisFightData)

    // Track level progression if level-up was detected
    if (hadOverlay) {
      const postFightText = await page.locator('body').innerText().catch(() => '')
      const newLevel = parseLevelFromText(postFightText)
      if (newLevel !== null && currentLevel !== null && newLevel > currentLevel) {
        const levelsGained = newLevel - currentLevel
        runRecord.level_up_events.push({
          fight_number: i + 1,
          levels_gained: levelsGained,
          points_to_allocate: levelsGained,
          previous_level: currentLevel,
          new_level: newLevel,
        })
        console.log(`   ⬆️ Level up: ${currentLevel} → ${newLevel} (+${levelsGained} level${levelsGained > 1 ? 's' : ''})`)
        currentLevel = newLevel
      } else if (newLevel !== null) {
        currentLevel = newLevel
      }
    }
  }
}

async function run() {
  const now = new Date()
  const runKey = dateKey(now)
  const state = loadState()
  const savedCharacterName = state.run === runKey && state.exhausted !== true ? state.character : null

  console.log('═══════════════════════════════════════════')
  console.log('  🤖 QA Bot starting')
  console.log('═══════════════════════════════════════════')
  console.log(`  Config:`)
  console.log(`    baseUrl:        ${config.baseUrl}`)
    console.log(`    fightsPerRun:   ${config.fightsPerRun}`)
    console.log(`    fightTimeout:   ${config.fightTimeout}ms`)
  console.log(`    statsFile:      ${STATS_FILE}`)
  console.log(`    stateFile:      ${STATE_FILE}`)
  console.log(`    screenshotsDir: ${SCREENSHOTS_DIR}`)
  console.log(`    timeZone:       ${QA_TIME_ZONE}`)
  console.log(`    runKey:         ${runKey}`)
  console.log(`    savedFighter:   ${savedCharacterName || 'none'}`)
  console.log(`    savedExhausted: ${state.run === runKey ? String(state.exhausted === true) : 'false'}`)
  console.log('    autoMode:       enable after daily fights are exhausted')
  console.log(`    headless:       ${config.headless}`)
  console.log(`    slowMo:         ${config.slowMo}`)
  console.log(`  CWD: ${process.cwd()}`)
  console.log('───────────────────────────────────────────')

  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    console.log(`   📁 Created screenshots directory: ${SCREENSHOTS_DIR}`)
  } else {
    console.log(`   📁 Screenshots directory exists: ${SCREENSHOTS_DIR}`)
  }

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`)
    }
  })

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`)
  })

  const runRecord = {
    date: now.toISOString(),
    run: runKey,
    character: null,
    character_action: null,
    replaced_character: null,
    fights: [],
    lootbox: null,
    auto_mode_enabled: false,
    auto_mode_sync_ok: false,
    initial_stats: null,            // character base stats at start of run (STR, VIT, ...)
    initial_level: null,            // character level at start of run
    initial_xp: null,               // character XP at start of run
    initial_max_hp: null,           // max HP at start of run (current=always max due to full heal)
    final_stats: null,              // parsed final stats (level, xp, w/l)
    final_character_stats: null,    // character base stats at end of run (STR, VIT, ...)
    final_max_hp: null,             // max HP at end of run
    level_up_events: [],            // { fight_number, levels_gained, points_allocated }
    errors: [],
    load_times_ms: {},
  }

  try {
    console.log(`🌐 Navigating to ${config.baseUrl}...`)
    const startLoad = Date.now()
    await page.goto(config.baseUrl, { waitUntil: 'networkidle', timeout: 30000 })
    runRecord.load_times_ms.home = Date.now() - startLoad
    console.log(`   Loaded in ${runRecord.load_times_ms.home}ms`)

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-01-home.png`) })
    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-02-pre-auth.png`) })

    const authResult = await loginOrCreateDailyCharacter(page, runKey, savedCharacterName)
    runRecord.character = authResult.character
    runRecord.character_action = authResult.outcome
    if (authResult.arenaLoadMs !== null) {
      runRecord.load_times_ms.arena = authResult.arenaLoadMs
      console.log(`   Arena loaded in ${runRecord.load_times_ms.arena}ms (${authResult.outcome})`)
    }
    console.log(`🎭 Active QA fighter: ${runRecord.character}`)
    persistQaState(runKey, runRecord.character, authResult.outcome, false)

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-03-arena.png`) })

    // Capture initial stats and HP before the fight sequence
    const preFightText = await page.locator('body').innerText().catch(() => '')
    runRecord.initial_level = parseLevelFromText(preFightText)
    runRecord.initial_xp = parseXpFromText(preFightText)
    runRecord.initial_stats = await parseCharacterStats(page)
    runRecord.initial_max_hp = await parseMaxHp(page)
    console.log(`   Initial stats: level=${runRecord.initial_level}, xp=${JSON.stringify(runRecord.initial_xp)}, stats=${JSON.stringify(runRecord.initial_stats)}, maxHp=${runRecord.initial_max_hp}`)

    await runFightSequence(page, runKey, runRecord)

    // Ensure no overlay is blocking the arena stats before reading
    await handleLevelUpOverlay(page)

    // Debug screenshot right before stats reading to diagnose W/L capture issues
    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-04-stats-debug.png`) })

    const finalText = await page.locator('body').innerText()
    console.log('   Raw body text (first 500 chars):', finalText.slice(0, 500))

    const levelMatch = finalText.match(/LVL\s*(\d+)/i)
    const xpTotalMatch = finalText.match(/(\d+)\s*\/\s*\d+\s*XP/i)
    const recordMatch  = finalText.match(/W\s*(\d+)\s+L\s*(\d+)/i)

    runRecord.final_stats = {
      level: levelMatch ? parseInt(levelMatch[1]) : null,
      xp: xpTotalMatch ? parseInt(xpTotalMatch[1]) : null,
      wins: recordMatch ? parseInt(recordMatch[1]) : null,
      losses: recordMatch ? parseInt(recordMatch[2]) : null,
    }
    console.log('   Final stats:', JSON.stringify(runRecord.final_stats))

    // Capture final character stats and HP
    runRecord.final_character_stats = await parseCharacterStats(page)
    runRecord.final_max_hp = await parseMaxHp(page)
    console.log(`   Final character stats: ${JSON.stringify(runRecord.final_character_stats)}`)
    console.log(`   Final max HP: ${runRecord.final_max_hp}`)

    const finalArenaStatus = await readArenaStatus(page)
    const fighterExhausted =
      finalArenaStatus.isResting ||
      (finalArenaStatus.fightsAvailable !== null && finalArenaStatus.fightsAvailable <= 0)
    runRecord.lootbox = await handleDailyLootbox(page, runKey)
    runRecord.auto_mode_enabled = fighterExhausted
    runRecord.auto_mode_sync_ok = await syncAutoMode(page, fighterExhausted)
    persistQaState(runKey, runRecord.character, runRecord.character_action, fighterExhausted)
    console.log(`   Fighter exhausted for today: ${fighterExhausted ? 'yes' : 'no'}`)

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-05-final.png`) })

    const stats = loadStats()
    stats.push(runRecord)
    saveStats(stats)
    console.log(`✅ Stats saved (run #${stats.length})`)

  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error(`   Stack: ${err.stack}`)
    runRecord.errors.push(err.message)

    if (typeof page !== 'undefined' && page) {
      const errorScreenshot = join(SCREENSHOTS_DIR, `${runKey}-error.png`)
      await page.screenshot({ path: errorScreenshot }).catch(e => console.error(`   Could not save error screenshot: ${e.message}`))
      console.log(`   Screenshot saved: ${errorScreenshot}`)
    }

    try {
      const stats = loadStats()
      stats.push(runRecord)
      saveStats(stats)
      console.log(`✅ Error stats saved (run #${stats.length})`)
    } catch (saveErr) {
      console.error(`❌ Could not save error stats: ${saveErr.message}`)
    }
  } finally {
    await browser.close()
    console.log('🏁 Browser closed')
    console.log('═══════════════════════════════════════════')
  }
}

run()
