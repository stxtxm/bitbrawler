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
  const isPveEnergy = bodyText.includes('MONSTER ENERGY')
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
    isPveEnergy,
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
  const delays = [5000, 15000] // 5s, then 15s backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(getAppUrl('/create-character'), { waitUntil: 'networkidle', timeout: 30000 })
      return // success
    } catch (err) {
      if (attempt === 3) {
        throw new Error(`Site unavailable after 3 retries (last error: ${err.message})`)
      }
      console.log(`   ⚠️ Character creation page load failed (attempt ${attempt}/3), retrying in ${delays[attempt - 1] / 1000}s... (${err.message})`)
      await sleep(delays[attempt - 1])
    }
  }
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
  } catch {
    console.log(`   ⚠️ Could not parse character stats`)
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

/**
 * Parse the idle efficiency panel (essence/min, next level ETA, ratios).
 * Returns structured data or null if panel not visible.
 */
async function parseEfficiencyPanel(page) {
  try {
    const panel = page.locator('.idle-efficiency').first()
    if (!(await panel.isVisible({ timeout: 1000 }).catch(() => false))) {
      return null
    }

    const essenceMinEl = page.locator('.eff-rate.eff-essence strong').first()
    const nextLevelEl = page.locator('.eff-rate.eff-next strong').first()
    const powerEl = page.locator('.eff-stat.eff-power strong').first()
    const speedEl = page.locator('.eff-stat.eff-speed strong').first()
    const magicEl = page.locator('.eff-stat.eff-magic strong').first()
    const intervalEl = page.locator('.eff-stat.eff-interval strong').first()
    const streakBonusEl = page.locator('.eff-streak').first()

    const essenceMinText = ((await essenceMinEl.textContent().catch(() => '')) || '').trim()
    const nextLevelText = ((await nextLevelEl.textContent().catch(() => '')) || '').trim()
    const powerText = ((await powerEl.textContent().catch(() => '')) || '').trim()
    const speedText = ((await speedEl.textContent().catch(() => '')) || '').trim()
    const magicText = ((await magicEl.textContent().catch(() => '')) || '').trim()
    const intervalText = ((await intervalEl.textContent().catch(() => '')) || '').trim()
    const streakText = ((await streakBonusEl.textContent().catch(() => '')) || '').trim()

    const essenceMatch = essenceMinText.match(/[\d.]+/)
    const intervalMatch = intervalText.match(/[\d.]+/)

    return {
      visible: true,
      essence_per_min: essenceMatch ? parseFloat(essenceMatch[0]) : null,
      next_level_eta: nextLevelText || null,
      power_ratio: powerText || null,
      speed_ratio: speedText || null,
      magic_mult: magicText || null,
      interval: intervalMatch ? intervalMatch[0] + 's' : null,
      streak_bonus: streakText || null,
    }
  } catch (err) {
    console.log(`   ⚠️ Could not parse efficiency panel: ${err.message}`)
    return null
  }
}

/**
 * Parse the essence badge value from the arena header.
 * Returns { visible, value, displayed } or null if not visible.
 */
async function parseEssenceBadge(page) {
  try {
    const badge = page.locator('.essence-badge').first()
    if (!(await badge.isVisible({ timeout: 1000 }).catch(() => false))) {
      return { badge_visible: false, value: null, displayed_as_fractional: false }
    }

    const text = ((await badge.textContent().catch(() => '')) || '').trim()
    const cleaned = text.replace(/[^\d.]/g, '')
    const value = cleaned ? parseFloat(cleaned) : null
    const isFractional = cleaned.includes('.')

    return {
      badge_visible: true,
      value,
      displayed_as_fractional: isFractional,
    }
  } catch {
    return { badge_visible: false, value: null, displayed_as_fractional: false }
  }
}

/**
 * Check if level-up FX elements are currently visible in the idle scene.
 */
async function parseLevelUpFx(page) {
  try {
    const charSlot = page.locator('.idle-character-slot').first()
    const hasGlow = (await charSlot.getAttribute('class').catch(() => '')) || ''
    const glowApplied = hasGlow.includes('glow-levelup')

    const floatText = page.locator('.levelup-float-text').first()
    const floatVisible = await floatText.isVisible({ timeout: 300 }).catch(() => false)

    let level = null
    if (floatVisible) {
      const lvlText = await page.locator('.levelup-float-lvl').first().textContent().catch(() => '')
      const match = (lvlText || '').match(/(\d+)/)
      level = match ? parseInt(match[1]) : null
    }

    return {
      detected: glowApplied || floatVisible,
      glow_class_applied: glowApplied,
      float_text_shown: floatVisible,
      level,
    }
  } catch {
    return { detected: false, glow_class_applied: false, float_text_shown: false, level: null }
  }
}

/**
 * Verify that legacy overlay elements do NOT exist in the DOM.
 * Returns { level_up_pop_overlay, stat_points_badge, all_clear }.
 */
async function verifyNoLegacyOverlay(page) {
  const levelUpOverlay = page.locator('.level-up-pop-overlay').first()
  const statPointsBadge = page.locator('.stat-points-badge').first()

  const overlayExists = await levelUpOverlay.isVisible({ timeout: 300 }).catch(() => false)
  const badgeExists = await statPointsBadge.isVisible({ timeout: 300 }).catch(() => false)

  return {
    level_up_pop_overlay: overlayExists,
    stat_points_badge: badgeExists,
    all_clear: !overlayExists && !badgeExists,
  }
}

/**
 * Capture a single snapshot of the idle PvE scene state at this moment.
 * Returns { phase, monster, xpPopup, streakBanner, levelUpFx, ... }.
 */
async function captureIdleCycleSnapshot(page) {
  const snapshot = {
    timestamp: Date.now(),
    phase: 'unknown',
    monster: null,
    xp_popup_visible: false,
    xp_value: null,
    xp_label: null,
    streak_banner_visible: false,
    streak_text: null,
    level_up_detected: false,
  }

  try {
    // Determine current phase from monster slot class
    const monsterSlot = page.locator('.idle-monster-slot').first()
    const monsterVisible = await monsterSlot.isVisible({ timeout: 200 }).catch(() => false)

    if (!monsterVisible) {
      return snapshot
    }

    const classAttr = (await monsterSlot.getAttribute('class').catch(() => '')) || ''
    if (classAttr.includes('phase-monster_appears')) snapshot.phase = 'monster_appears'
    else if (classAttr.includes('phase-combat')) snapshot.phase = 'combat'
    else if (classAttr.includes('phase-result')) snapshot.phase = 'result'
    else snapshot.phase = 'running'

    snapshot.monster = await monsterSlot.getAttribute('data-monster').catch(() => null)

    // XP popup
    const xpPopup = page.locator('.idle-big-xp').first()
    snapshot.xp_popup_visible = await xpPopup.isVisible({ timeout: 100 }).catch(() => false)
    if (snapshot.xp_popup_visible) {
      const xpValueText = await page.locator('.big-xp-value').first().textContent().catch(() => '')
      const match = (xpValueText || '').match(/(\d+)/)
      snapshot.xp_value = match ? parseInt(match[1]) : null
      snapshot.xp_label = (await page.locator('.big-xp-label').first().textContent().catch(() => '') || '').trim()
    }

    // Streak banner
    const streakBanner = page.locator('.idle-streak-banner').first()
    snapshot.streak_banner_visible = await streakBanner.isVisible({ timeout: 100 }).catch(() => false)
    if (snapshot.streak_banner_visible) {
      snapshot.streak_text = (await page.locator('.streak-text').first().textContent().catch(() => '') || '').trim()
    }

    // Level-up FX
    const fx = await parseLevelUpFx(page)
    snapshot.level_up_detected = fx.detected
  } catch {
    // Partial data better than none
  }

  return snapshot
}

/**
 * Observe idle PvE combat for a fixed duration.
 * Toggles PvE mode ON, waits for runner, polls every 500ms,
 * captures phase transitions, XP, streak, level-up FX.
 * Toggles PvE OFF at the end.
 * Returns aggregated idle_runner data.
 */
async function observeIdleCombat(page, durationMs = 30000) {
  console.log(`👁️ Observing idle PvE combat for ${durationMs}ms...`)

  const result = {
    observation_duration_ms: 0,
    cycles_observed: 0,
    monsters_faced: [],
    victories: 0,
    defeats: 0,
    xp_total: 0,
    xp_events: [],
    streak_banner_shown: false,
    level_up_fx_detected: false,
    level_up_events: [],
    phase_transition_times_ms: [],
  }

  // Toggle PvE ON
  await togglePveMode(page, true)
  await page.waitForTimeout(1000)

  // Wait for idle runner to appear
  const runnerBox = page.locator('.idle-runner-box').first()
  try {
    await runnerBox.waitFor({ state: 'visible', timeout: 8000 })
    console.log('   Idle runner scene visible')
  } catch {
    console.log('   ⚠️ Idle runner scene did not appear within 8s')
    await togglePveMode(page, false)
    return result
  }

  // Wait for first monster to appear
  try {
    await page.waitForFunction(
      () => {
        const slot = document.querySelector('.idle-monster-slot')
        return slot && slot.getAttribute('data-monster')
      },
      { timeout: 8000 }
    )
    console.log('   First monster appeared')
  } catch {
    console.log('   ⚠️ No monster appeared within 8s')
    await togglePveMode(page, false)
    return result
  }

  // Polling loop
  const startTime = Date.now()
  const endTime = startTime + durationMs
  let previousMonster = null
  let previousPhase = 'unknown'
  const countedXpKeys = new Set()

  while (Date.now() < endTime) {
    await page.waitForTimeout(500)

    const snapshot = await captureIdleCycleSnapshot(page)
    if (!snapshot.monster) continue

    // Detect new cycle (monster change)
    if (snapshot.monster !== previousMonster) {
      if (previousMonster !== null) {
        result.cycles_observed++
      }
      previousMonster = snapshot.monster
      if (!result.monsters_faced.includes(snapshot.monster)) {
        result.monsters_faced.push(snapshot.monster)
      }
    }

    // Track phase transition time
    if (snapshot.phase !== previousPhase) {
      result.phase_transition_times_ms.push(Date.now() - startTime)
      previousPhase = snapshot.phase
    }

    // Capture XP on result phase (deduped by monster+value key)
    if (snapshot.phase === 'result' && snapshot.xp_popup_visible && snapshot.xp_value !== null) {
      const xpKey = `${snapshot.monster}-${snapshot.xp_value}`
      if (!countedXpKeys.has(xpKey)) {
        countedXpKeys.add(xpKey)
        result.xp_total += snapshot.xp_value
        result.xp_events.push({
          time_ms: Date.now() - startTime,
          xp: snapshot.xp_value,
          monster: snapshot.monster,
          result: snapshot.xp_label || 'unknown',
        })
        if (snapshot.xp_label?.toUpperCase().includes('VICTORY')) result.victories++
        else result.defeats++
      }
    }

    // Track streak banner
    if (snapshot.streak_banner_visible) {
      result.streak_banner_shown = true
    }

    // Track level-up FX
    if (snapshot.level_up_detected) {
      result.level_up_fx_detected = true
      result.level_up_events.push({
        time_ms: Date.now() - startTime,
        monster: snapshot.monster,
      })
    }
  }

  result.observation_duration_ms = Date.now() - startTime
  console.log(`   Observation complete: ${result.cycles_observed} cycles, ${result.victories}W/${result.defeats}L, ${result.xp_total} XP, FX:${result.level_up_fx_detected}`)

  // Toggle PvE OFF
  await togglePveMode(page, false)
  await page.waitForTimeout(1000)

  return result
}

/**
 * Reload the page and check for offline gains notification.
 * If found, captures the data and clicks claim.
 * Returns offline gains data.
 */
async function checkOfflineGains(page, runKey) {
  console.log('💤 Checking offline gains notification...')

  const result = {
    notification_shown: false,
    offline_time: null,
    fights: null,
    xp_gained: null,
    essence_gained: null,
    levels_gained: null,
    claimed: false,
  }

  try {
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const notification = page.locator('.idle-offline-notification').first()
    const visible = await notification.isVisible({ timeout: 8000 }).catch(() => false)

    if (!visible) {
      console.log('   No offline gains notification shown')
      return result
    }

    result.notification_shown = true
    console.log('   Offline gains notification detected')

    // Capture offline time
    const timeEl = page.locator('.offline-time').first()
    result.offline_time = ((await timeEl.textContent().catch(() => '')) || '').trim()

    // Capture stat values
    const statValues = page.locator('.offline-stat-value')
    const statCount = await statValues.count().catch(() => 0)
    for (let i = 0; i < statCount; i++) {
      const text = ((await statValues.nth(i).textContent().catch(() => '')) || '').trim()
      const label = ((await page.locator('.offline-stat-label').nth(i).textContent().catch(() => '')) || '').trim().toLowerCase()
      const numMatch = text.match(/[\d.]+/)
      const num = numMatch ? parseFloat(numMatch[0]) : null

      if (label.includes('xp') && num !== null) result.xp_gained = num
      else if (label.includes('essence') && num !== null) result.essence_gained = num
      else if (label.includes('fight') && num !== null) result.fights = num
      else if (label.includes('level') && num !== null) result.levels_gained = num
    }

    // Click claim
    const claimBtn = page.locator('.offline-claim-btn').first()
    if (await claimBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await claimBtn.click()
      await page.waitForTimeout(2000)
      result.claimed = true
      console.log('   Offline rewards claimed')
    }

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-offline-gains.png`) })
  } catch (err) {
    console.log(`   ⚠️ Offline gains check failed: ${err.message}`)
  }

  return result
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
 * Toggle PvP or PvE mode by clicking the appropriate switch button.
 * Returns true on success.
 */
async function togglePveMode(page, enablePve) {
  const label = enablePve ? 'PvE mode' : 'PvP mode'
  const button = page.locator(`button[aria-label="${label}"]`)
  if (!(await button.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log(`   ${label} switch not found — cannot toggle`)
    return false
  }
  const isOn = await button.getAttribute('aria-checked').then(v => v === 'true')
  if (isOn !== enablePve) {
    await button.click()
    await page.waitForTimeout(600)

    // Verify the toggle actually took effect
    const verified = await button.getAttribute('aria-checked').then(v => v === 'true').catch(() => null)
    if (verified === enablePve) {
      console.log(`   Mode toggled to ${enablePve ? 'PVE' : 'PVP'} ✅`)
    } else {
      console.log(`   ⚠️ First toggle attempt may have failed, retrying...`)
      await button.click({ force: true }).catch(() => {})
      await page.waitForTimeout(600)
      const retryVerified = await button.getAttribute('aria-checked').then(v => v === 'true').catch(() => null)
      if (retryVerified === enablePve) {
        console.log(`   Mode toggled to ${enablePve ? 'PVE' : 'PVP'} (after retry) ✅`)
      } else {
        console.log(`   ❌ Failed to toggle to ${enablePve ? 'PVE' : 'PVP'} mode`)
        return false
      }
    }
  }
  return true
}

/**
 * Parse equipped item slots visible in the inventory (equipped section).
 * Returns an array of { slot, name, rarity? } or empty array.
 *
 * Rarity is obtained by clicking each equipped item to reveal the detail panel
 * where `.inventory-item-rarity` is visible.
 *
 * Also attempts body-text fallback if DOM-based parsing fails.
 */
async function parseEquippedItems(page) {
  try {
    // ── Strategy 1: DOM-based parsing via inventory panel ──
    const invBtn = page.locator('button[aria-label="Inventory"], button[title="Inventory"], button.icon-btn.inventory-btn').first()
    if (!(await invBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log('   Inventory button not found, trying body text fallback')
      return await parseEquippedItemsFromBody(page)
    }

    await invBtn.click()

    // Wait for inventory panel to fully open
    try {
      await page.locator('.inv-loadout-slots').waitFor({ state: 'visible', timeout: 3000 })
    } catch {
      console.log('   Inventory panel did not open, trying body text fallback')
      return await parseEquippedItemsFromBody(page)
    }

    await page.waitForTimeout(400)

    const items = []
    const filledSlots = page.locator('.inv-loadout-slot.filled')
    const count = await filledSlots.count().catch(() => 0)
    for (let i = 0; i < count; i++) {
      const slot = filledSlots.nth(i)
      const name = await slot.locator('.inv-loadout-item-name').textContent().catch(() => null)
      const slotLabel = await slot.locator('.inv-loadout-slot-icon').textContent().catch(() => null)

      // Click the equipped item to show detail panel (reveals rarity)
      let rarity = null
      if (name) {
        const clickTarget = slot.locator('.inv-loadout-item').first()
        if (await clickTarget.isVisible({ timeout: 1000 }).catch(() => false)) {
          await clickTarget.click()
          await page.waitForTimeout(400)
          rarity = ((await page.locator('.inventory-item-rarity').textContent().catch(() => '')) || '').trim() || null
        }
      }

      if (name) items.push({ slot: slotLabel?.trim() || '?', name: name.trim(), ...(rarity ? { rarity } : {}) })
    }

    // If DOM-based parsing found nothing, try body text fallback
    if (items.length === 0) {
      const bodyItems = await parseEquippedItemsFromBody(page)
      if (bodyItems.length > 0) return bodyItems
    }

    // Close inventory
    const closeBtn = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click()
      await page.waitForTimeout(500)
    }

    return items
  } catch (err) {
    console.log(`   ⚠️ Could not parse equipped items via DOM: ${err.message}`)
    return await parseEquippedItemsFromBody(page)
  }
}

/**
 * Fallback: Parse equipped items from body text patterns.
 * Scans for slot icons (⚔️, 🛡, 📿, etc.) followed by item names.
 */
async function parseEquippedItemsFromBody(page) {
  try {
    const bodyText = await page.locator('body').innerText().catch(() => '')

    // Known slot icons used in the game UI
    const lines = bodyText.split('\n')
    const items = []

    // Track whether we are inside the EQUIPPED section
    let inEquippedSection = false
    const slotNames = ['⚔️', '🛡', '📿', '💍', '👑', '🧤', '👢', '🦅', '🔮', '🌟', '🗡️', '🪄', '⛓️']

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Detect the EQUIPPED section header
      if (trimmed.toUpperCase() === 'EQUIPPED') {
        inEquippedSection = true
        continue
      }

      // Detect end of equipped section (next section header)
      if (inEquippedSection && (trimmed.toUpperCase() === 'INVENTORY' || trimmed.includes('SLOTS'))) {
        break
      }

      if (inEquippedSection) {
        for (const slotIcon of slotNames) {
          if (trimmed.includes(slotIcon)) {
            // Extract slot name (the icon character) and item name (text after icon)
            const itemNameMatch = trimmed.match(new RegExp(`${slotIcon}\\s*(.+?)(?:\\s*×|$)`))
            if (itemNameMatch) {
              const itemName = itemNameMatch[1].trim()
              // Skip "EMPTY" slots
              if (itemName && itemName.toUpperCase() !== 'EMPTY') {
                items.push({ slot: slotIcon, name: itemName })
              }
            }
            break
          }
        }
      }
    }

    // If equipped section parsing didn't work, try a broader pattern:
    // Look for item names that appear with common equipment keywords
    if (items.length === 0) {
      const equipmentKeywords = ['SWORD', 'ARMOR', 'SHIELD', 'RING', 'AMULET', 'STAFF', 'WAND', 'BOW',
        'DAGGER', 'HELMET', 'BOOTS', 'GLOVES', 'CLOAK', 'ROBE', 'CHARM']
      for (const keyword of equipmentKeywords) {
        const idx = bodyText.toUpperCase().indexOf(keyword)
        if (idx !== -1) {
          // Extract the surrounding text as item name
          const start = Math.max(0, bodyText.lastIndexOf('\n', idx) + 1)
          const end = bodyText.indexOf('\n', idx)
          const line = bodyText.substring(start, end !== -1 ? end : bodyText.length).trim()
          if (line && line.length < 40) {
            items.push({ slot: '?', name: line })
          }
        }
      }
    }

    if (items.length > 0) {
      console.log(`   Parsed ${items.length} equipment item(s) from body text: ${items.map(i => i.name).join(', ')}`)
    }
    return items
  } catch (err) {
    console.log(`   ⚠️ Could not parse equipped items from body text: ${err.message}`)
    return []
  }
}

/**
 * Parse lootbox streak indicator value.
 *
 * The streak indicator (`.streak-indicator`) lives inside the inventory panel,
 * so we may need to open inventory first.  If the indicator is visible directly
 * on the page (compact variant) we read it; otherwise we open inventory, read
 * the streak, and close inventory.
 *
 * Falls back to body text pattern scanning if DOM-based parsing fails.
 *
 * Returns the streak number or null.
 */
async function parseStreak(page) {
  try {
    // ── Strategy 1: Read from DOM elements ──

    // 1a. Try to read streak directly from the page (compact variant on arena)
    const directSelector = '.streak-indicator.compact, .idle-streak-indicator, .streak-indicator:not(.compact)'
    const directEl = page.locator(directSelector).first()
    if (await directEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const text = await directEl.textContent().catch(() => '')
      if (text) {
        const match = text.match(/(\d+)/)
        if (match) {
          const streak = parseInt(match[1], 10)
          console.log(`   Streak from DOM element: ${streak}`)
          return streak
        }
      }
    }

    // 1b. The full streak indicator is inside the inventory panel – open it
    const invBtn = page.locator('button[aria-label="Inventory"], button[title="Inventory"], button.icon-btn.inventory-btn').first()
    if (!(await invBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
      return await parseStreakFromBody(page)
    }
    await invBtn.click()
    await page.waitForTimeout(800)

    // Wait for inventory panel to open
    try {
      await page.locator('.inv-loadout-slots').waitFor({ state: 'visible', timeout: 3000 })
    } catch {
      // Inventory didn't open
      return await parseStreakFromBody(page)
    }

    // Read streak from the now-visible full indicator
    const streakEl = page.locator('.streak-indicator .streak-count').first()
    let streak = null
    if (await streakEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await streakEl.textContent().catch(() => '')
      if (text) {
        const match = text.match(/(\d+)/)
        if (match) streak = parseInt(match[1], 10)
      }
    }

    // Close inventory
    const closeBtn = page.locator('button[aria-label="Close inventory"], .inventory-close').first()
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click()
      await page.waitForTimeout(500)
    }

    if (streak !== null) {
      console.log(`   Streak from inventory panel: ${streak}`)
      return streak
    }

    // ── Strategy 2: Body text fallback ──
    return await parseStreakFromBody(page)
  } catch (err) {
    console.log(`   ⚠️ Could not parse streak via DOM: ${err.message}`)
    return await parseStreakFromBody(page)
  }
}

/**
 * Fallback: Parse streak value from body text patterns.
 */
async function parseStreakFromBody(page) {
  try {
    const bodyText = await page.locator('body').innerText().catch(() => '')

    // Pattern 1: "STREAK X DAYS" (full indicator)
    let match = bodyText.match(/STREAK\s+(\d+)\s+DAYS/i)
    if (match) {
      const streak = parseInt(match[1], 10)
      console.log(`   Streak from body text (STREAK X DAYS): ${streak}`)
      return streak
    }

    // Pattern 2: "STREAK" label followed by a number on the same or next line
    match = bodyText.match(/STREAK[^]*?(\d+)/i)
    if (match) {
      const streak = parseInt(match[1], 10)
      console.log(`   Streak from body text (STREAK + number): ${streak}`)
      return streak
    }

    // Pattern 3: Look for a small number next to a trophy icon (compact indicator)
    // In the arena, the compact streak shows just the number next to a trophy.
    // Use the trophy PixelIcon pattern: "🏆5" or similar
    match = bodyText.match(/(?:🏆|trophy)\s*(\d+)/i)
    if (match) {
      const streak = parseInt(match[1], 10)
      console.log(`   Streak from body text (trophy + number): ${streak}`)
      return streak
    }

    return null
  } catch (err) {
    console.log(`   ⚠️ Could not parse streak from body text: ${err.message}`)
    return null
  }
}

/**
 * Handle the level-up pop-overlay that appears after a fight where the
 * character gains a level.  If the overlay is visible, allocate one stat
 * point (click the first "+" button) then wait for the overlay to dismiss.
 * Returns true if the overlay was handled.
 */
async function handleLevelUpOverlay(page) {
  const levelUpOverlay = page.locator('.level-up-pop-overlay')
  const overlayVisible = await levelUpOverlay.isVisible({ timeout: 2000 }).catch(() => false)
  if (!overlayVisible) return false

  console.log('   ⬆️ Level-up overlay detected, allocating stat point...')

  const statAddBtn = page.locator('.stat-add-btn').first()
  if (await statAddBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statAddBtn.click()
    await page.waitForTimeout(300)
  } else {
    console.log('   ⚠️ Stat add button not found on level-up overlay')
  }

  // Wait for the overlay to be dismissed
  await page.waitForSelector('.level-up-pop-overlay', { state: 'hidden', timeout: 5000 }).catch(() => {
    console.log('   ⚠️ Level-up overlay did not disappear within 5s, continuing')
  })

  await page.waitForTimeout(300)
  return true
}

/**
 * Simulate a short human-like delay between actions (300-800ms).
 */
async function humanDelay(page) {
  const ms = 300 + Math.floor(Math.random() * 500)
  await page.waitForTimeout(ms)
}

/**
 * Determine whether the next fight should be PvP or PvE, and update
 * the `pvpSinceLastPve` counter accordingly.
 *
 * @param {number} pvpSinceLastPve - Number of consecutive PvP fights since last PvE.
 * @param {number} pveRatio - Fraction of fights that should be PvE (e.g. 0.33).
 * @param {boolean} pveOnly - If true, always return PvE.
 * @returns {{ type: 'pvp'|'pve', pvpSinceLastPve: number }}
 */
function determineNextFightType(pvpSinceLastPve, pveRatio, pveOnly) {
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
 * Parse monster name from the fight result screen (`.result-sub` element).
 * Patterns: "Victory over Goblin", "Defeated by Ogre", "Stalemate vs Wraith".
 * Returns the monster name or null.
 */
async function parseMonsterNameFromResult(page) {
  try {
    // Check .result-sub element first (most reliable)
    const resultSub = page.locator('.result-sub').first()
    if (await resultSub.isVisible({ timeout: 1000 }).catch(() => false)) {
      const text = ((await resultSub.textContent().catch(() => '')) || '').trim()
      const match = text.match(/^(?:Victory over|Defeated by|Stalemate vs)\s+(.+)$/i)
      if (match) {
        const name = match[1].trim()
        if (name) return name
      }
    }

    // Fallback: parse from body text
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const bodyMatch = bodyText.match(/(?:Victory over|Defeated by|Stalemate vs)\s+(.+?)(?:\n|$)/i)
    if (bodyMatch) {
      const name = bodyMatch[1].trim()
      if (name && name.length < 40) return name
    }

    return null
  } catch {
    return null
  }
}

async function runFightSequence(page, runKey, runRecord) {
  let recreatedForExhaustion = false
  let currentLevel = runRecord.initial_level
  let pvpSinceLastPve = 0

  for (let i = 0; i < config.fightsPerRun; i++) {
    await humanDelay(page)

    // Determine if this fight should be PvE
    const fightType = determineNextFightType(pvpSinceLastPve, config.pveRatio, config.pveOnly)
    const isPve = fightType.type === 'pve'
    pvpSinceLastPve = fightType.pvpSinceLastPve

    // Toggle to PvE mode if needed
    if (isPve) {
      const toggled = await togglePveMode(page, true)
      if (!toggled) {
        console.log('   ⚠️ Could not toggle PvE mode, falling back to PvP')
        pvpSinceLastPve = pvpSinceLastPve // keep counter as-is (pve attempt didn't consume)
        // Re-evaluate as PvP
      } else {
        await page.waitForTimeout(600)
      }
    }

    const arenaStatus = await readArenaStatus(page)
    const fightsAvailable = arenaStatus.fightsAvailable
    const isResting = arenaStatus.isResting

    if (fightsAvailable !== null && fightsAvailable <= 0) {
      console.log('   No battle energy available for current fighter')
      if (!recreatedForExhaustion) {
        if (isPve) await togglePveMode(page, false)
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'exhausted-energy')
        recreatedForExhaustion = true
        i = -1
        continue
      }
      if (isPve) await togglePveMode(page, false)
      break
    }

    if (isResting || !arenaStatus.hasFightCta) {
      console.log(`   Fight CTA not available (${arenaStatus.fightButtonLabel || 'no label'})`)
      if (!recreatedForExhaustion) {
        if (isPve) await togglePveMode(page, false)
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'missing-fight-cta')
        recreatedForExhaustion = true
        i = -1
        continue
      }
      if (isPve) await togglePveMode(page, false)
      break
    }

    console.log(`⚔️ ${isPve ? 'PvE' : 'PvP'} Fight ${i + 1}/${config.fightsPerRun}...`)

    const fightBtn = page.locator('button.primary-btn.giant-btn').first()
    const fightStart = Date.now()
    for (let attempt = 0; attempt < 3; attempt++) {
      const clicked = await fightBtn.click({ timeout: 3000 }).then(() => true).catch(() => false)
      if (clicked) break
      console.log(`   FIGHT click blocked (attempt ${attempt + 1}), retrying with force click...`)
      await fightBtn.click({ force: true, timeout: 3000 }).then(() => true).catch(() => false).then((ok) => {
        if (ok) console.log('   Force click succeeded')
      })
    }
    console.log('   Fight started, waiting for result...')

    await sleep(1000)

    const maxRetries = 3
    const baseTimeout = Math.floor(config.fightTimeout * 0.5)
    let resultDetected = false

    for (let retry = 0; retry < maxRetries; retry++) {
      if (retry > 0) {
        const backoff = Math.min(1000 * Math.pow(2, retry - 1), 8000)
        console.log(`   Retry ${retry + 1}/${maxRetries}: backoff ${backoff}ms then polling...`)
        await sleep(backoff)

        const preText = await page.locator('body').innerText().catch(() => '')
        if (preText.includes('VICTORY') || preText.includes('DEFEAT') || preText.includes('DRAW')) {
          resultDetected = true
          break
        }
      }

      const timeout = retry < maxRetries - 1 ? baseTimeout : config.fightTimeout - baseTimeout * (maxRetries - 1)
      try {
        await page.waitForFunction(
          () => {
            const text = document.body?.innerText || ''
            return text.includes('VICTORY') || text.includes('DEFEAT') || text.includes('DRAW')
          },
          { timeout }
        )
        resultDetected = true
        break
      } catch {
        if (retry < maxRetries - 1) {
          console.log(`   ⚠️ Fight result not yet available after attempt ${retry + 1}`)
        }
      }
    }

    if (!resultDetected) {
      console.log(`   Fight result not detected after ${config.fightTimeout}ms timeout (${maxRetries} retries), taking screenshot`)
      await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-timeout.png`) })
      runRecord.errors.push(`Fight ${i + 1}: timeout waiting for result (${config.fightTimeout}ms, ${maxRetries} retries)`)

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
        if (isPve) await togglePveMode(page, false)
        await maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'timeout-on-exhausted-fighter')
        recreatedForExhaustion = true
        i = -1
        continue
      }

      await page.evaluate(() => { window.location.href = window.location.origin }).catch(() => {})
      await page.waitForURL('**', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(3000)
      if (isPve) await togglePveMode(page, false)
      continue
    }

    const fightDuration = Date.now() - fightStart

    const pageText = await page.locator('body').innerText()
    const isVictory = pageText.includes('VICTORY')
    const isDefeat = pageText.includes('DEFEAT')

    const xpMatch = pageText.match(/\+(\d+)\s*XP/)
    const xpGained = xpMatch ? parseInt(xpMatch[1]) : null

    // Capture monster name for PvE fights
    let monsterName = null
    if (isPve) {
      monsterName = await parseMonsterNameFromResult(page)
    }

    console.log(`   Result: ${isVictory ? '✅ VICTORY' : isDefeat ? '❌ DEFEAT' : '🤝 DRAW'} (${fightDuration}ms) [${isPve ? 'PVE' : 'PVP'}]${monsterName ? ` vs ${monsterName}` : ''}`)

    const thisFightData = {
      result: isVictory ? 'victory' : isDefeat ? 'defeat' : 'draw',
      xp: xpGained,
      fight_duration_ms: fightDuration,
      max_hp: null,
      fight_type: isPve ? 'pve' : 'pvp',
      monster_name: monsterName,
    }

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-${isVictory ? 'win' : isDefeat ? 'loss' : 'draw'}-${isPve ? 'pve' : 'pvp'}.png`),
    })

    const continueBtn = page.locator('button:has-text("CONTINUE"), button:has-text("CLOSE"), button:has-text("OK")').first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1500)
    }

    // Handle level-up overlay that may appear after a fight result
    await handleLevelUpOverlay(page)

    thisFightData.max_hp = await parseMaxHp(page)
    console.log(`   max HP after fight: ${thisFightData.max_hp || '(unable to parse)'}`)

    runRecord.fights.push(thisFightData)

    // Track level-up from body text (auto-allocated, no overlay to detect)
    const postFightText = await page.locator('body').innerText().catch(() => '')
    const newLevel = parseLevelFromText(postFightText)
    if (newLevel !== null && currentLevel !== null && newLevel > currentLevel) {
      const levelsGained = newLevel - currentLevel
      runRecord.level_up_events.push({
        fight_number: i + 1,
        fight_type: isPve ? 'pve' : 'pvp',
        levels_gained,
        previous_level: currentLevel,
        new_level: newLevel,
      })
      console.log(`   ⬆️ Level up: ${currentLevel} → ${newLevel} (+${levelsGained} level${levelsGained > 1 ? 's' : ''})`)
      currentLevel = newLevel
    } else if (newLevel !== null) {
      currentLevel = newLevel
    }

    // Toggle back to PvP mode after a PvE fight
    if (isPve) {
      await togglePveMode(page, false)
      await page.waitForTimeout(500)
    }

    await humanDelay(page)
  }
}

/**
 * Parse essence value from the forge page or body text.
 */
async function parseEssence(page) {
  try {
    const essenceText = await page.locator('.forge-page-essence-value, .forge-essence-value').textContent().catch(() => '')
    if (essenceText) {
      const val = parseInt(essenceText.trim(), 10)
      if (!isNaN(val)) return val
    }
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const match = bodyText.match(/ESSENCE\s*[:\-]?\s*(\d+)/i)
    if (match) return parseInt(match[1], 10)
    return null
  } catch {
    return null
  }
}

/**
 * Parse item count from forge tab text.
 */
async function parseInventoryItemCount(page) {
  try {
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const match = bodyText.match(/(\d+)\s*ITEM/i)
    if (match) return parseInt(match[1], 10)
    return null
  } catch {
    return null
  }
}

/**
 * Navigate to the forge page via the arena header button.
 */
async function navigateToForge(page) {
  const forgeBtn = page.locator('button[aria-label="Forge"]')
  if (!(await forgeBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log('   Forge button not found in arena header')
    return false
  }
  await forgeBtn.click()
  try {
    await page.waitForURL('**/forge', { timeout: 8000 })
    await page.waitForTimeout(1000)
    return true
  } catch {
    // Fallback: direct navigation
    try {
      await page.goto(new URL('/forge', config.baseUrl).toString(), { waitUntil: 'networkidle', timeout: 10000 })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Navigate back from forge to arena.
 */
async function leaveForge(page) {
  const backBtn = page.locator('button[aria-label="Back to Arena"], .forge-back-btn')
  if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await backBtn.click()
    await page.waitForTimeout(1500)
    return true
  }
  // Fallback: navigate directly
  try {
    await page.goto(config.baseUrl, { waitUntil: 'networkidle', timeout: 10000 })
    await page.waitForTimeout(1000)
    return true
  } catch {
    return false
  }
}

/**
 * Navigate to the Shop tab, read offers, and attempt to purchase the cheapest.
 * Returns an object with shop stats or null if inaccessible.
 */
async function testShopSystem(page, runKey) {
  console.log('🏪 Testing shop system...')

  const shopResult = {
    visited: false,
    offers_count: 0,
    purchased: false,
    offer_type: null,
    item_rarity: null,
    cost: null,
    essence_before: null,
    essence_after: null,
  }

  const navigated = await navigateToForge(page)
  if (!navigated) {
    console.log('   ⚠️ Could not navigate to forge page')
    return shopResult
  }

  // Click Shop tab
  const shopTab = page.locator('button[role="tab"]:has-text("Shop"), .forge-tab:has-text("Shop")')
  if (!(await shopTab.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log('   ⚠️ Shop tab not found')
    await leaveForge(page)
    return shopResult
  }

  await shopTab.click()
  await page.waitForTimeout(800)
  shopResult.visited = true

  // Count offers
  const offerCards = page.locator('.shop-offer-card')
  shopResult.offers_count = await offerCards.count().catch(() => 0)
  console.log(`   Found ${shopResult.offers_count} shop offers`)

  // Capture essence before
  shopResult.essence_before = await parseEssence(page)
  console.log(`   Essence before: ${shopResult.essence_before ?? '?'}`)

  // Try to buy the first available (cheapest) offer
  const buyBtns = page.locator('.shop-buy-btn:not(.shop-sold-btn):not(:disabled)')
  const buyBtnCount = await buyBtns.count().catch(() => 0)

  if (buyBtnCount > 0) {
    try {
      await buyBtns.first().click()
      await page.waitForTimeout(500)

      // Confirm purchase dialog
      const confirmBtn = page.locator('button[aria-label="Confirm purchase"], .forge-confirm-ok')
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click()
        await page.waitForTimeout(2000)

        shopResult.purchased = true
        shopResult.cost = shopResult.essence_before !== null
          ? shopResult.essence_before - (await parseEssence(page) ?? shopResult.essence_before)
          : null

        console.log(`   ✅ Shop purchase completed (cost: ${shopResult.cost ?? '?'} essence)`)

        // Try to read item rarity from the purchased offer (now sold)
        const soldLabel = page.locator('.shop-offer-card.shop-sold .shop-offer-rarity')
        if (await soldLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
          shopResult.item_rarity = await soldLabel.textContent().catch(() => null)
          shopResult.item_rarity = shopResult.item_rarity ? shopResult.item_rarity.trim() : null
        }
        shopResult.offer_type = 'item'
      }
    } catch (err) {
      console.log(`   ⚠️ Shop purchase failed: ${err.message}`)
    }
  } else {
    console.log('   No purchasable offers (already bought or insufficient essence)')
  }

  // Capture essence after
  shopResult.essence_after = await parseEssence(page)
  console.log(`   Post-shop: essence=${shopResult.essence_after ?? '?'}`)

  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-08-shop.png`) })

  await leaveForge(page)
  console.log('🏪 Shop test complete')
  return shopResult
}

/**
 * Test the forge system: salvage, fusion, and upgrade.
 * Returns an object with forge stats or null if inaccessible.
 */
async function testForgeSystem(page, runKey) {
  console.log('🔨 Testing forge system...')

  const forgeResult = {
    visited: false,
    essence_before: null,
    items_before: null,
    salvage_attempted: false,
    salvage_succeeded: false,
    fusion_attempted: false,
    fusion_succeeded: false,
    upgrade_attempted: false,
    upgrade_succeeded: false,
    essence_after: null,
    items_after: null,
  }

  const navigated = await navigateToForge(page)
  if (!navigated) {
    console.log('   ⚠️ Could not navigate to forge page')
    return forgeResult
  }

  forgeResult.visited = true
  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-06-forge.png`) })

  // Capture essence and item count before forge
  forgeResult.essence_before = await parseEssence(page)
  forgeResult.items_before = await parseInventoryItemCount(page)
  console.log(`   Essence: ${forgeResult.essence_before ?? '?'}, Items: ${forgeResult.items_before ?? '?'}`)

  // ── Attempt Salvage ─────────────────────────────────────────────
  const salvageCards = page.locator('.forge-item-card:not(.salvaged-item)')
  const salvageCardCount = await salvageCards.count().catch(() => 0)
  if (salvageCardCount > 0) {
    forgeResult.salvage_attempted = true
    console.log(`   Salvaging first item (${salvageCardCount} items available)...`)
    try {
      // Click first salvageable item
      await salvageCards.first().click({ timeout: 3000 })
      await page.waitForTimeout(600)

      // Confirm salvage dialog
      const confirmOk = page.locator('.forge-confirm-ok')
      if (await confirmOk.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmOk.click()
        // Wait for salvage animation to complete
        await page.waitForTimeout(2000)
        forgeResult.salvage_succeeded = true
        console.log('   ✅ Item salvaged')
      }
    } catch (err) {
      console.log(`   ⚠️ Salvage attempt failed: ${err.message}`)
    }
  } else {
    console.log('   No items to salvage')
  }

  // ── Attempt Fusion ──────────────────────────────────────────────
  const fusionTab = page.locator('button[role="tab"]:has-text("Fusion"), .forge-tab:has-text("Fusion")')
  if (await fusionTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fusionTab.click()
    await page.waitForTimeout(800)

    const selectableCards = page.locator('.forge-item-card:not(.disabled)')
    const selectableCount = await selectableCards.count().catch(() => 0)
    if (selectableCount >= 3) {
      forgeResult.fusion_attempted = true
      console.log(`   Attempting fusion (${selectableCount} items available)...`)
      try {
        // Select first 3 items for fusion
        for (let i = 0; i < 3 && i < selectableCount; i++) {
          await selectableCards.nth(i).click()
          await page.waitForTimeout(300)
        }

        // Click FUSE button
        const fuseBtn = page.locator('button[aria-label="Fuse items"], .forge-action-btn:has-text("FUSE")')
        if (await fuseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fuseBtn.click()
          await page.waitForTimeout(3000)
          forgeResult.fusion_succeeded = true
          console.log('   ✅ Fusion completed')
        }
      } catch (err) {
        console.log(`   ⚠️ Fusion attempt failed: ${err.message}`)
      }
    } else {
      console.log(`   Not enough items for fusion (need 3, have ${selectableCount})`)
    }
  }

  // ── Attempt Upgrade ─────────────────────────────────────────────
  const upgradeTab = page.locator('button[role="tab"]:has-text("Upgrade"), .forge-tab:has-text("Upgrade")')
  if (await upgradeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await upgradeTab.click()
    await page.waitForTimeout(800)

    // Check if we have essence for upgrade
    const currentEssence = await parseEssence(page)
    const upgradeCards = page.locator('.forge-item-card:not(.maxed):not(.disabled)')
    const upgradeCardCount = await upgradeCards.count().catch(() => 0)

    if (currentEssence !== null && currentEssence >= 25 && upgradeCardCount > 0) {
      forgeResult.upgrade_attempted = true
      console.log(`   Attempting upgrade (essence: ${currentEssence})...`)
      try {
        await upgradeCards.first().click()
        await page.waitForTimeout(500)

        const upgradeBtn = page.locator('button[aria-label="Upgrade item"], .forge-action-btn:has-text("UPGRADE")')
        if (await upgradeBtn.isVisible({ timeout: 2000 }).catch(() => false) && !(await upgradeBtn.isDisabled().catch(() => true))) {
          await upgradeBtn.click()
          await page.waitForTimeout(2000)
          forgeResult.upgrade_succeeded = true
          console.log('   ✅ Upgrade completed')
        }
      } catch (err) {
        console.log(`   ⚠️ Upgrade attempt failed: ${err.message}`)
      }
    } else {
      console.log(`   Cannot upgrade: essence=${currentEssence}, items=${upgradeCardCount}`)
    }
  }

  // Capture post-forge state
  forgeResult.essence_after = await parseEssence(page)
  forgeResult.items_after = await parseInventoryItemCount(page)
  console.log(`   Post-forge: essence=${forgeResult.essence_after ?? '?'}, items=${forgeResult.items_after ?? '?'}`)

  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-07-forge-after.png`) })

  // Navigate back to arena
  await leaveForge(page)
  console.log('🔨 Forge test complete')
  return forgeResult
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
  console.log(`    fightsPerRun:   ${config.fightsPerRun} (${config.pveOnly ? 'PvE only' : config.pveRatio > 0 ? 'mixed PvP/PvE' : 'PvP only'})`)
  console.log(`    pveRatio:       ${config.pveRatio}`)
  console.log(`    pveOnly:        ${config.pveOnly}`)
  console.log(`    fightTimeout:   ${config.fightTimeout}ms`)
  console.log(`    idleObserveMs:  30000 (PvE idle observation)`)
  console.log(`    statsFile:      ${STATS_FILE}`)
  console.log(`    stateFile:      ${STATE_FILE}`)
  console.log(`    screenshotsDir: ${SCREENSHOTS_DIR}`)
  console.log(`    timeZone:       ${QA_TIME_ZONE}`)
  console.log(`    runKey:         ${runKey}`)
  console.log(`    savedFighter:   ${savedCharacterName || 'none'}`)
  console.log(`    savedExhausted: ${state.run === runKey ? String(state.exhausted === true) : 'false'}`)
  console.log('    autoMode:       enable after daily fights are exhausted')
  console.log('    offlineCheck:   after forge (page reload)')
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
    initial_stats: null,
    initial_level: null,
    initial_xp: null,
    initial_max_hp: null,
    initial_equipment: null,
    initial_streak: null,
    final_stats: null,
    final_character_stats: null,
    final_max_hp: null,
    final_equipment: null,
    final_streak: null,
    lootbox_equipment: null,
    lootbox_streak: null,
    pve_data: {
      fights: 0,
      wins: 0,
      xp_total: 0,
      monsters_faced: [],
    },
    level_up_events: [],
    idle_runner: null,
    efficiency_panel: null,
    essence: null,
    level_up_fx: null,
    offline_gains: null,
    no_legacy_overlay: null,
    forge: null,
    shop: null,
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

    // ── Capture initial stats ─────────────────────────────────────
    const preFightText = await page.locator('body').innerText().catch(() => '')
    runRecord.initial_level = parseLevelFromText(preFightText)
    runRecord.initial_xp = parseXpFromText(preFightText)
    runRecord.initial_stats = await parseCharacterStats(page)
    runRecord.initial_max_hp = await parseMaxHp(page)
    runRecord.initial_equipment = await parseEquippedItems(page)
    runRecord.initial_streak = await parseStreak(page)
    console.log(`   Initial stats: level=${runRecord.initial_level}, xp=${JSON.stringify(runRecord.initial_xp)}, stats=${JSON.stringify(runRecord.initial_stats)}, maxHp=${runRecord.initial_max_hp}`)
    if (runRecord.initial_equipment.length > 0) {
      console.log(`   Equipment: ${runRecord.initial_equipment.map(e => `${e.slot}=${e.name}`).join(', ')}`)
    }

    // ── PvE Idle Observation ──────────────────────────────────────
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  🎮 PvE Idle Combat Observation')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    runRecord.idle_runner = await observeIdleCombat(page, 30000)

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-04-pve-idle.png`) })

    // Capture efficiency panel and essence after idle observation
    runRecord.efficiency_panel = await parseEfficiencyPanel(page)
    if (runRecord.efficiency_panel) {
      console.log(`   Efficiency: essence/min=${runRecord.efficiency_panel.essence_per_min}, ETA=${runRecord.efficiency_panel.next_level_eta}, power=${runRecord.efficiency_panel.power_ratio}, interval=${runRecord.efficiency_panel.interval}`)
    }

    runRecord.essence = await parseEssenceBadge(page)
    if (runRecord.essence.badge_visible) {
      console.log(`   Essence badge: ${runRecord.essence.value} (fractional: ${runRecord.essence.displayed_as_fractional})`)
    }

    // Capture level-up FX state after idle
    runRecord.level_up_fx = await parseLevelUpFx(page)
    if (runRecord.level_up_fx.detected) {
      console.log(`   Level-up FX: glow=${runRecord.level_up_fx.glow_class_applied}, text=${runRecord.level_up_fx.float_text_shown}, level=${runRecord.level_up_fx.level}`)
    }

    // Verify no legacy overlay elements exist
    runRecord.no_legacy_overlay = await verifyNoLegacyOverlay(page)
    if (!runRecord.no_legacy_overlay.all_clear) {
      console.log(`   ⚠️ Legacy overlay elements still present: ${JSON.stringify(runRecord.no_legacy_overlay)}`)
    }

    // Ensure PvP mode for start of fight sequence
    await togglePveMode(page, false)
    await page.waitForTimeout(500)

    // ── Fight Sequence (mixed PvP/PvE) ────────────────────────────
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  ⚔️ Fight Sequence (${config.pveOnly ? 'PvE only' : config.pveRatio > 0 ? `PvP/PvE ratio: ${config.pveRatio}` : 'PvP only'})`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await runFightSequence(page, runKey, runRecord)

    // ── Final Stats ───────────────────────────────────────────────
    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-05-stats-debug.png`) })

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

    runRecord.final_character_stats = await parseCharacterStats(page)
    runRecord.final_max_hp = await parseMaxHp(page)
    runRecord.final_equipment = await parseEquippedItems(page)
    runRecord.final_streak = await parseStreak(page)
    console.log(`   Final character stats: ${JSON.stringify(runRecord.final_character_stats)}`)
    console.log(`   Final max HP: ${runRecord.final_max_hp}`)
    if (runRecord.final_equipment.length > 0) {
      console.log(`   Equipment: ${runRecord.final_equipment.map(e => `${e.slot}=${e.name}`).join(', ')}`)
    }

    // Populate pve_data from idle_runner for backward compatibility
    if (runRecord.idle_runner && runRecord.idle_runner.monsters_faced.length > 0) {
      runRecord.pve_data.fights = runRecord.idle_runner.cycles_observed
      runRecord.pve_data.wins = runRecord.idle_runner.victories
      runRecord.pve_data.xp_total = runRecord.idle_runner.xp_total
      runRecord.pve_data.monsters_faced = runRecord.idle_runner.monsters_faced
    }

    // ── Lootbox ───────────────────────────────────────────────────
    const finalArenaStatus = await readArenaStatus(page)
    const fighterExhausted =
      finalArenaStatus.isResting ||
      (finalArenaStatus.fightsAvailable !== null && finalArenaStatus.fightsAvailable <= 0)
    runRecord.lootbox = await handleDailyLootbox(page, runKey)

    // Capture equipment and streak right after lootbox (the lootbox may have
    // granted a new item).  The inventory has been closed by the lootbox handler,
    // so parseStreak will re-open it if needed.
    runRecord.lootbox_equipment = await parseEquippedItems(page)
    if (runRecord.lootbox_equipment.length > 0) {
      console.log(`   Lootbox equipment: ${runRecord.lootbox_equipment.map(e => `${e.slot}=${e.name}${e.rarity ? ` (${e.rarity})` : ''}`).join(', ')}`)
    }
    runRecord.lootbox_streak = await parseStreak(page)
    if (runRecord.lootbox_streak !== null) {
      console.log(`   Lootbox streak: ${runRecord.lootbox_streak}`)
    }

    runRecord.auto_mode_enabled = fighterExhausted
    runRecord.auto_mode_sync_ok = await syncAutoMode(page, fighterExhausted)
    persistQaState(runKey, runRecord.character, runRecord.character_action, fighterExhausted)
    console.log(`   Fighter exhausted for today: ${fighterExhausted ? 'yes' : 'no'}`)

    // ── Forge ─────────────────────────────────────────────────────
    runRecord.forge = await testForgeSystem(page, runKey)

    // ── Shop ──────────────────────────────────────────────────────
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  🏪 8-Bit Emporium')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    runRecord.shop = await testShopSystem(page, runKey)
    if (runRecord.shop.purchased) {
      console.log(`   ✅ Purchased offer (cost: ${runRecord.shop.cost}, rarity: ${runRecord.shop.item_rarity ?? 'N/A'})`)
    }

    // ── Offline Gains ─────────────────────────────────────────────
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  💤 Offline Gains Check')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    runRecord.offline_gains = await checkOfflineGains(page, runKey)
    if (runRecord.offline_gains.notification_shown) {
      console.log(`   Offline time: ${runRecord.offline_gains.offline_time}, XP=${runRecord.offline_gains.xp_gained}, essence=${runRecord.offline_gains.essence_gained}, claimed=${runRecord.offline_gains.claimed}`)
    }

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-06-final.png`) })

    // ── Save ──────────────────────────────────────────────────────
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
