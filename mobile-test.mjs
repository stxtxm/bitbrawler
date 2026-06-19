import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'qa', 'screenshots')
mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const BASE_URL = 'https://bitbrawler.vercel.app'
const CHAR_NAME = 'NOVAORACLE'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.5,
})

const page = await context.newPage()

// Collect console errors
const errors = []
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', err => errors.push(err.message))

// 1. Login
console.log('Navigating to login...')
await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)

const nameInput = page.locator('input[name="name"], input[type="text"], .retro-input input').first()
await nameInput.waitFor({ state: 'visible', timeout: 10000 })
await nameInput.fill(CHAR_NAME)

const submitBtn = page.locator('button:has-text("ENTER ARENA"), button:has-text("LOGIN")').first()
await submitBtn.click()

// Wait for arena to load
await page.waitForTimeout(3000)
await page.waitForSelector('.arena-header, .arena-container', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(2000)

// Save full page screenshot
await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-arena-pve.png'), fullPage: false })
console.log('✅ PvE screenshot saved (mobile-arena-pve.png)')

// Get page content snapshot
const html = await page.content()
writeFileSync(join(SCREENSHOTS_DIR, 'arena-html.txt'), html)

// Get visible text
const bodyText = await page.evaluate(() => document.body.innerText)
writeFileSync(join(SCREENSHOTS_DIR, 'arena-text.txt'), bodyText)
console.log('📝 Body text:\n', bodyText.substring(0, 2000))

// Check for idle scene elements
const idleSceneExists = await page.locator('.idle-runner-scene').count()
console.log(`🏃 IdleRunnerScene found: ${idleSceneExists > 0}`)

const footerControls = await page.locator('.idle-footer-controls').count()
console.log(`📦 .idle-footer-controls found: ${footerControls > 0}`)

// Check if arena-content and character-display structure is correct
const arenaContent = await page.locator('.arena-content').count()
const charDisplay = await page.locator('.character-display').count()
const actionPanel = await page.locator('.action-panel').count()
console.log(`📐 arena-content: ${arenaContent}, character-display: ${charDisplay}, action-panel: ${actionPanel}`)

// Idle scene dimensions
const sceneRect = await page.locator('.idle-runner-scene').boundingBox().catch(() => null)
if (sceneRect) {
  console.log(`📐 IdleRunnerScene: ${Math.round(sceneRect.width)}x${Math.round(sceneRect.height)} @ (${Math.round(sceneRect.x)}, ${Math.round(sceneRect.y)})`)
}

const charSlotRect = await page.locator('.idle-character-slot').boundingBox().catch(() => null)
if (charSlotRect) {
  console.log(`🧑 Character slot: ${Math.round(charSlotRect.width)}x${Math.round(charSlotRect.height)} @ (${Math.round(charSlotRect.x)}, ${Math.round(charSlotRect.y)})`)
}

const hudRect = await page.locator('.idle-hud').boundingBox().catch(() => null)
if (hudRect) {
  console.log(`📊 HUD: ${Math.round(hudRect.width)}x${Math.round(hudRect.height)} @ (${Math.round(hudRect.x)}, ${Math.round(hudRect.y)})`)
}

const groundRect = await page.locator('.idle-ground-layer').boundingBox().catch(() => null)
if (groundRect) {
  console.log(`🌍 Ground: ${Math.round(groundRect.width)}x${Math.round(groundRect.height)} @ (${Math.round(groundRect.x)}, ${Math.round(groundRect.y)})`)
}

// Check console errors
if (errors.length > 0) {
  console.log('\n❌ Console errors:')
  errors.forEach(e => console.log(`  - ${e}`))
} else {
  console.log('\n✅ No console errors')
}

// 2. Switch to PvP mode and screenshot
console.log('\nSwitching to PvP mode...')
const pvpToggle = page.locator('button[aria-label="PvP mode"]')
const pvpCount = await pvpToggle.count()
console.log(`PvP toggle buttons found: ${pvpCount}`)
if (pvpCount > 0) {
  const pvpBtn = pvpToggle.first()
  await pvpBtn.click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-arena-pvp.png'), fullPage: false })
  console.log('✅ PvP screenshot saved (mobile-arena-pvp.png)')
  
  const pvpSceneRect = await page.locator('.avatar-box').boundingBox().catch(() => null)
  if (pvpSceneRect) {
    console.log(`📐 PvP avatar-box: ${Math.round(pvpSceneRect.width)}x${Math.round(pvpSceneRect.height)} @ (${Math.round(pvpSceneRect.x)}, ${Math.round(pvpSceneRect.y)})`)
  }
  
  const pvpCharDisplay = await page.locator('.character-display').boundingBox().catch(() => null)
  if (pvpCharDisplay) {
    console.log(`📐 PvP character-display: ${Math.round(pvpCharDisplay.width)}x${Math.round(pvpCharDisplay.height)} @ (${Math.round(pvpCharDisplay.x)}, ${Math.round(pvpCharDisplay.y)})`)
  }
}

await browser.close()
console.log('\nDone!')
