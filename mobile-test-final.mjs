import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SCREENSHOTS_DIR = '/home/timo/dev/bitbrawler/qa/screenshots'
const BASE = 'http://localhost:3456'

async function waitForArena(page, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const url = page.url()
    if (url.includes('/arena')) return Date.now() - start
    try {
      const count = await page.locator('.arena-header').count()
      if (count > 0) return Date.now() - start
    } catch {}
    await page.waitForTimeout(300)
  }
  return null
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.5,
})

const page = await context.newPage()
const errors = []
page.on('pageerror', err => errors.push(err.message))

// Step 1: Login
console.log('1. Login page...')
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(500)

const input = page.locator('input[type="text"]').first()
await input.fill('TESTMOBILE')

await page.locator('button:has-text("ENTER ARENA")').first().click()
await page.waitForTimeout(2000)

const bodyText = await page.evaluate(() => document.body.innerText)
console.log('2. Login response:', bodyText.substring(0, 200))

if (bodyText.includes('Fighter not found') || bodyText.includes('NOT FOUND')) {
  // Step 2: Create character
  console.log('3. Character not found, creating...')
  await page.goto(`${BASE}/create-character`, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1000)

  // Fill name
  const nameInput = page.locator('input[type="text"]').first()
  await nameInput.waitFor({ state: 'visible', timeout: 5000 })
  await nameInput.fill('')
  await nameInput.fill('TESTMOBILE')

  // Click START
  const startBtn = page.locator('button:has-text("START")').first()
  await startBtn.click()

  const loadMs = await waitForArena(page, 20000)
  console.log(`4. Arena loaded in ${loadMs ? loadMs + 'ms' : 'TIMEOUT'}`)
}

await page.waitForTimeout(2000)
const finalUrl = page.url()
console.log('5. Final URL:', finalUrl)

if (finalUrl.includes('/arena') || (await page.locator('.arena-header').count()) > 0) {
  await page.waitForTimeout(2000)
  
  // Get layout info for PvE mode
  console.log('\n=== PvE MODE LAYOUT ===')
  const scene = await page.locator('.idle-runner-scene').boundingBox().catch(() => null)
  if (scene) {
    console.log(`scene: ${Math.round(scene.width)}x${Math.round(scene.height)} @ (${Math.round(scene.x)},${Math.round(scene.y)})`)
  } else {
    console.log('⚠️ No idle-runner-scene found!')
  }
  
  const charDisplay = await page.locator('.character-display').boundingBox().catch(() => null)
  if (charDisplay) console.log(`character-display: ${Math.round(charDisplay.width)}x${Math.round(charDisplay.height)} @ (${Math.round(charDisplay.x)},${Math.round(charDisplay.y)})`)
  
  const actionPanel = await page.locator('.action-panel').boundingBox().catch(() => null)
  if (actionPanel) console.log(`action-panel: ${Math.round(actionPanel.width)}x${Math.round(actionPanel.height)} @ (${Math.round(actionPanel.x)},${Math.round(actionPanel.y)})`)
  
  const charSlot = await page.locator('.idle-character-slot').boundingBox().catch(() => null)
  if (charSlot) console.log(`character-slot: ${Math.round(charSlot.width)}x${Math.round(charSlot.height)} @ (${Math.round(charSlot.x)},${Math.round(charSlot.y)})`)
  
  const groundLayer = await page.locator('.idle-ground-layer').boundingBox().catch(() => null)
  if (groundLayer) console.log(`ground: ${Math.round(groundLayer.y)}-${Math.round(groundLayer.y + groundLayer.height)} (${Math.round(groundLayer.height)}px tall)`)
  
  const hud = await page.locator('.idle-hud').boundingBox().catch(() => null)
  if (hud) console.log(`hud: y=${Math.round(hud.y)}, ${Math.round(hud.width)}x${Math.round(hud.height)}`)
  
  // Check if monster area exists
  const monsterSlot = await page.locator('.idle-monster-slot').boundingBox().catch(() => null)
  if (monsterSlot) console.log(`monster-slot: ${Math.round(monsterSlot.width)}x${Math.round(monsterSlot.height)} @ (${Math.round(monsterSlot.x)},${Math.round(monsterSlot.y)})`)
  
  // Check if wraith scene exists
  const wraith = await page.locator('.idle-monster-slot[data-monster="wraith"]').count()
  console.log(`wraith elements: ${wraith}`)
  
  // Screenshot PvE
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-pve-final.png'), fullPage: false })
  console.log('\n✅ PvE screenshot saved')
  
  // Switch to PvP
  console.log('\n=== PvP MODE ===')
  const pvpBtn = page.locator('button[aria-label="PvP mode"]').first()
  if (await pvpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pvpBtn.click()
    await page.waitForTimeout(2000)
    
    const avatarBox = await page.locator('.avatar-box').boundingBox().catch(() => null)
    if (avatarBox) console.log(`avatar-box: ${Math.round(avatarBox.width)}x${Math.round(avatarBox.height)} @ (${Math.round(avatarBox.x)},${Math.round(avatarBox.y)})`)
    
    const pvpCharDisplay = await page.locator('.character-display').boundingBox().catch(() => null)
    if (pvpCharDisplay) console.log(`PvP character-display: ${Math.round(pvpCharDisplay.width)}x${Math.round(pvpCharDisplay.height)}`)
    
    const pvpActionPanel = await page.locator('.action-panel').boundingBox().catch(() => null)
    if (pvpActionPanel) console.log(`PvP action-panel: ${Math.round(pvpActionPanel.width)}x${Math.round(pvpActionPanel.height)}`)
    
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-pvp-final.png'), fullPage: false })
    console.log('✅ PvP screenshot saved')
    
    // Compare heights
    if (charDisplay && pvpCharDisplay) {
      const diff = Math.abs(charDisplay.height - pvpCharDisplay.height)
      console.log(`\n📐 character-display height match: PvE=${Math.round(charDisplay.height)}px, PvP=${Math.round(pvpCharDisplay.height)}px, diff=${diff}px`)
    }
    if (actionPanel && pvpActionPanel) {
      const diff = Math.abs(actionPanel.height - pvpActionPanel.height)
      console.log(`📐 action-panel height match: PvE=${Math.round(actionPanel.height)}px, PvP=${Math.round(pvpActionPanel.height)}px, diff=${diff}px`)
    }
  }
  
  // Check arena-content structure
  console.log('\n=== STRUCTURE ===')
  const arenaContent = await page.locator('.arena-content').boundingBox().catch(() => null)
  if (arenaContent) {
    console.log(`arena-content: ${Math.round(arenaContent.width)}x${Math.round(arenaContent.height)} @ (${Math.round(arenaContent.x)},${Math.round(arenaContent.y)})`)
    
    // Calculate combined height of children
    if (charDisplay && actionPanel) {
      const combined = charDisplay.height + actionPanel.height + 5 // gap
      console.log(`children combined: ~${Math.round(combined)}px`)
      console.log(`fit: ${Math.round(combined)} vs ${Math.round(arenaContent.height)}`)
    }
  }
  
  // Console errors
  if (errors.length > 0) {
    console.log('\n❌ Page errors:')
    errors.forEach(e => console.log(`  ${e}`))
  } else {
    console.log('✅ No page errors')
  }
  
  // Save body text
  const text = await page.evaluate(() => document.body.innerText)
  writeFileSync(join(SCREENSHOTS_DIR, 'body-text.txt'), text)
  console.log('\n📝 Body text:', text.substring(0, 500))
  
} else {
  console.log('⚠️ Did not reach arena!')
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-fail.png'), fullPage: false })
  const text = await page.evaluate(() => document.body.innerText)
  writeFileSync(join(SCREENSHOTS_DIR, 'body-text.txt'), text)
  console.log('Page text:', text.substring(0, 500))
}

await context.close()
await browser.close()
console.log('\nDone!')
