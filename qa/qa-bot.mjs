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
const AUTO_MODE_START_HOUR = Number.isFinite(config.autoModeStartHour) ? config.autoModeStartHour : 19

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

function shouldEnableAutoMode(date = new Date(), timeZone = QA_TIME_ZONE) {
  const { hour } = getZonedParts(date, timeZone)
  return hour >= AUTO_MODE_START_HOUR
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

async function run() {
  const now = new Date()
  const runKey = dateKey(now)
  const enableAutoMode = shouldEnableAutoMode(now)
  const state = loadState()
  const savedCharacterName = state.run === runKey ? state.character : null

  console.log('═══════════════════════════════════════════')
  console.log('  🤖 QA Bot starting')
  console.log('═══════════════════════════════════════════')
  console.log(`  Config:`)
  console.log(`    baseUrl:        ${config.baseUrl}`)
  console.log(`    fightsPerRun:   ${config.fightsPerRun}`)
  console.log(`    statsFile:      ${STATS_FILE}`)
  console.log(`    stateFile:      ${STATE_FILE}`)
  console.log(`    screenshotsDir: ${SCREENSHOTS_DIR}`)
  console.log(`    timeZone:       ${QA_TIME_ZONE}`)
  console.log(`    runKey:         ${runKey}`)
  console.log(`    savedFighter:   ${savedCharacterName || 'none'}`)
  console.log(`    autoMode:       ${enableAutoMode ? 'ON' : 'OFF'}`)
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
    fights: [],
    lootbox: null,
    auto_mode_enabled: false,
    auto_mode_sync_ok: false,
    final_stats: null,
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

    saveState({
      run: runKey,
      character: runRecord.character,
      updated_at: new Date().toISOString(),
      source: authResult.outcome,
    })

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-03-arena.png`) })

    for (let i = 0; i < config.fightsPerRun; i++) {
      console.log(`⚔️ Fight ${i + 1}/${config.fightsPerRun}...`)

      const fightBtn = page.locator('button:has-text("FIGHT"), button:has-text("BATTLE")').first()
      if (!(await fightBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('   No FIGHT button (might be out of fights or in cooldown)')
        break
      }

      const fightStart = Date.now()
      await fightBtn.click()
      console.log('   Fight started, waiting for result...')

      await sleep(1000)

      try {
        await page.waitForFunction(
          () => {
            const text = document.body.innerText
            return text.includes('VICTORY') || text.includes('DEFEAT') || text.includes('DRAW')
          },
          { timeout: 25000 }
        )
      } catch {
        console.log('   Fight result not detected, taking screenshot')
        await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-timeout.png`) })
        runRecord.errors.push(`Fight ${i + 1}: timeout waiting for result`)
        await page.goto(config.baseUrl, { waitUntil: 'networkidle' }).catch(() => {})
        await page.waitForTimeout(3000)
        continue
      }

      const fightDuration = Date.now() - fightStart

      const pageText = await page.locator('body').innerText()
      const isVictory = pageText.includes('VICTORY')
      const isDefeat = pageText.includes('DEFEAT')

      const xpMatch = pageText.match(/(\d+)\s*XP/)
      const xpGained = xpMatch ? parseInt(xpMatch[1]) : null

      console.log(`   Result: ${isVictory ? '✅ VICTORY' : isDefeat ? '❌ DEFEAT' : '🤝 DRAW'} (${fightDuration}ms)`)

      runRecord.fights.push({
        result: isVictory ? 'victory' : isDefeat ? 'defeat' : 'draw',
        xp: xpGained,
        fight_duration_ms: fightDuration,
      })

      await page.screenshot({
        path: join(SCREENSHOTS_DIR, `${runKey}-fight-${i + 1}-${isVictory ? 'win' : isDefeat ? 'loss' : 'draw'}.png`),
      })

      const continueBtn = page.locator('button:has-text("CONTINUE"), button:has-text("CLOSE"), button:has-text("OK")').first()
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    console.log('🎁 Checking lootbox...')
    const lootboxBtn = page.locator('button:has-text("LOOT"), button:has-text("LOOTBOX"), [class*="loot"]').first()
    if (await lootboxBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lootboxBtn.click()
      await page.waitForTimeout(2000)

      await page.screenshot({ path: join(SCREENSHOTS_DIR, `${runKey}-04-lootbox.png`) })

      const lootText = await page.locator('body').innerText()
      const itemMatch = lootText.match(/you got:?\s*(.+)/i) || lootText.match(/obtained:?\s*(.+)/i)

      runRecord.lootbox = {
        available: true,
        item: itemMatch ? itemMatch[1].trim() : 'unknown',
      }
      console.log(`   Lootbox opened: ${runRecord.lootbox.item}`)

      const closeModal = page.locator('button:has-text("CLOSE"), button:has-text("OK"), .modal-close').first()
      if (await closeModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeModal.click()
        await page.waitForTimeout(1000)
      }
    } else {
      runRecord.lootbox = { available: false }
      console.log('   No lootbox available')
    }

    runRecord.auto_mode_enabled = enableAutoMode
    runRecord.auto_mode_sync_ok = await syncAutoMode(page, enableAutoMode)

    const finalText = await page.locator('body').innerText()
    const levelMatch = finalText.match(/LEVEL\s*(\d+)/i)
    const xpTotalMatch = finalText.match(/XP\s*[:]\s*(\d+)/i) || finalText.match(/(\d+)\s*\/\s*\d+\s*XP/i)
    const winsMatch = finalText.match(/WINS\s*[:]\s*(\d+)/i)
    const lossesMatch = finalText.match(/LOSSES\s*[:]\s*(\d+)/i)

    runRecord.final_stats = {
      level: levelMatch ? parseInt(levelMatch[1]) : null,
      xp: xpTotalMatch ? parseInt(xpTotalMatch[1]) : null,
      wins: winsMatch ? parseInt(winsMatch[1]) : null,
      losses: lossesMatch ? parseInt(lossesMatch[1]) : null,
    }
    console.log('   Final stats:', JSON.stringify(runRecord.final_stats))

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
