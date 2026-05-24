import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import config from './qa-bot.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATS_FILE = join(__dirname, config.statsFile)
const SCREENSHOTS_DIR = join(__dirname, config.screenshotsDir)

const FIRST_NAMES = [
  'THUNDER', 'SHADOW', 'IRON', 'FIRE', 'SILVER', 'GOLD', 'STONE',
  'CRIMSON', 'NIGHT', 'STORM', 'BLADE', 'FROST', 'VENOM', 'STEEL',
  'ASHEN', 'BRUTAL', 'RAGING', 'WILDE', 'PHANTOM', 'DOOM',
]
const LAST_NAMES = [
  'HAWK', 'WOLF', 'VIPER', 'LION', 'BEAR', 'FOX', 'TIGER',
  'RAVEN', 'PANTHER', 'DRAGON', 'FANG', 'CLAW', 'FURY', 'STRIKE',
  'WING', 'HORN', 'BOLT', 'BLADE', 'HEART', 'SKULL',
]

function generateName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `QA-${first}${last}`
}

function dateKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadStats() {
  try {
    return JSON.parse(readFileSync(STATS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveStats(stats) {
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2))
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function run() {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
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
    date: new Date().toISOString(),
    run: dateKey(),
    character: null,
    fights: [],
    lootbox: null,
    auto_mode_enabled: false,
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

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-01-home.png`) })

    const charName = generateName()
    runRecord.character = charName
    console.log(`🎭 Using character: ${charName}`)

    const loginBtn = page.locator('a.nav-btn:has-text("LOGIN"), a.button:has-text("LOGIN"), a:has-text("LOGIN")').first()
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click()
      await page.waitForLoadState('networkidle')
      console.log('   Clicked LOGIN')
    }

    await page.waitForTimeout(2000)

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-02-login.png`) })

    const nameInput = page.locator('input[name="name"], input[type="text"], .retro-input input').first()
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(charName)
      console.log('   Entered character name')

      const submitBtn = page.locator('button:has-text("FIGHT"), button:has-text("LOGIN"), button:has-text("START")').first()
      await submitBtn.click()
      await page.waitForTimeout(2000)
      console.log('   Submitted')
    }

    await page.waitForTimeout(3000)

    const currentUrl = page.url()
    console.log(`   Current URL: ${currentUrl}`)

    if (currentUrl.includes('create-character') || currentUrl.includes('creation')) {
      console.log('   Creating new character...')

      const rollBtn = page.locator('button:has-text("ROLL"), button:has-text("REROLL"), button:has-text("RANDOM")').first()
      if (await rollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rollBtn.click()
        await page.waitForTimeout(1000)
      }

      const startBtn = page.locator('button:has-text("START"), button:has-text("CREATE"), button:has-text("FIGHT")').first()
      if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      console.log('   Character created')
    }

    await page.waitForTimeout(2000)

    const arenaLoadStart = Date.now()
    const inArena = await page.locator('text=FIGHT, text=ARENA, text=BATTLE').first().isVisible({ timeout: 10000 }).catch(() => false)
    if (inArena) {
      runRecord.load_times_ms.arena = Date.now() - arenaLoadStart
      console.log(`   Arena loaded in ${runRecord.load_times_ms.arena}ms`)
    }

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-03-arena.png`) })

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
        await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-fight-${i + 1}-timeout.png`) })
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
        path: join(SCREENSHOTS_DIR, `${dateKey()}-fight-${i + 1}-${isVictory ? 'win' : isDefeat ? 'loss' : 'draw'}.png`),
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

      await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-04-lootbox.png`) })

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

    console.log('🔁 Enabling auto mode...')
    const settingsBtn = page.locator('button:has-text("SETTINGS"), [class*="settings"]').first()
    if (await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsBtn.click()
      await page.waitForTimeout(1500)
    }

    const autoSwitch = page.locator('[role="switch"], .pixel-switch, .switch-track').first()
    if (await autoSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isOn = await autoSwitch.getAttribute('aria-checked').catch(() => null)
      if (isOn !== 'true') {
        await autoSwitch.click()
        await page.waitForTimeout(1000)
        console.log('   Auto mode enabled ✅')
      } else {
        console.log('   Auto mode already ON')
      }
      runRecord.auto_mode_enabled = true
    } else {
      console.log('   Auto mode switch not found (might be already enabled)')
    }

    const closeSettings = page.locator('button:has-text("CLOSE"), button:has-text("OK"), .modal-close').first()
    if (await closeSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeSettings.click()
      await page.waitForTimeout(1000)
    }

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

    await page.screenshot({ path: join(SCREENSHOTS_DIR, `${dateKey()}-05-final.png`) })

    const stats = loadStats()
    stats.push(runRecord)
    saveStats(stats)
    console.log('✅ Stats saved')

  } catch (err) {
    console.error('❌ Error:', err.message)
    runRecord.errors.push(err.message)
    const errorScreenshot = join(SCREENSHOTS_DIR, `${dateKey()}-error.png`)
    await page.screenshot({ path: errorScreenshot }).catch(() => {})
    console.log(`   Screenshot saved: ${errorScreenshot}`)

    const stats = loadStats()
    stats.push(runRecord)
    saveStats(stats)
  } finally {
    await browser.close()
    console.log('🏁 Browser closed')
  }
}

run()
