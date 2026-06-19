import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SCREENSHOTS_DIR = '/home/timo/dev/bitbrawler/qa/screenshots'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.5,
})

const page = await context.newPage()

const errors = []
page.on('pageerror', err => errors.push(err.message))

// Navigate to dev server, go directly to /login
console.log('1. Loading login page...')
await page.goto('http://localhost:3456/login', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1500)
console.log('URL:', page.url())

// Login with test character
console.log('2. Logging in...')
const input = page.locator('input[type="text"], input[name="name"]').first()
await input.waitFor({ state: 'visible', timeout: 5000 })
await input.fill('TESTMOBILE')

const btn = page.locator('button:has-text("ENTER ARENA"), button:has-text("LOGIN")').first()
await btn.click()
await page.waitForTimeout(3000)

// Wait for arena or character creation or error state
const url = page.url()
console.log('3. After login, URL:', url)

// Check for "Fighter not found!" → character doesn't exist, create it
const bodyText = await page.evaluate(() => document.body.innerText)

if (bodyText.includes('Fighter not found') || bodyText.includes('NOT FOUND')) {
  console.log('4. Character not found, clicking ENTER ARENA to create...')
  const createBtn = page.locator('button:has-text("ENTER ARENA")').first()
  await createBtn.click()
  await page.waitForTimeout(3000)
}

// If we're on character creation, create character
if (page.url().includes('/create')) {
  console.log('5. Creating character...')
  const nameInput = page.locator('input[type="text"]').first()
  await nameInput.waitFor({ state: 'visible', timeout: 5000 })
  
  // Fill with test name
  await nameInput.fill('')
  await nameInput.fill('TESTMOBILE')
  
  // Click create/start
  const startBtn = page.locator('button:has-text("START"), button:has-text("CREATE")').first()
  await startBtn.click()
  await page.waitForTimeout(5000)
}

// Try to reach arena
const arenaUrl = page.url()
console.log('5. Final URL:', arenaUrl)

await page.waitForTimeout(2000)

// Check for arena elements
const inArena = await page.locator('.arena-header, .idle-runner-scene').count()
console.log('6. Arena elements found:', inArena > 0)

if (inArena > 0) {
  await page.waitForTimeout(2000)
  
  // Take PvE screenshot
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-pve.png'), fullPage: false })
  console.log('✅ PvE screenshot saved')
  
  // Check idle scene
  const scene = await page.locator('.idle-runner-scene').boundingBox().catch(() => null)
  if (scene) console.log(`Scene: ${Math.round(scene.width)}x${Math.round(scene.height)}`)
  
  const charSlot = await page.locator('.idle-character-slot').boundingBox().catch(() => null)
  if (charSlot) console.log(`Character: x=${Math.round(charSlot.x)}, y=${Math.round(charSlot.y)}, ${Math.round(charSlot.width)}x${Math.round(charSlot.height)}`)
  
  const ground = await page.locator('.idle-ground-layer').boundingBox().catch(() => null)
  if (ground) console.log(`Ground: y=${Math.round(ground.y)}, ${Math.round(ground.width)}x${Math.round(ground.height)}`)
  
  // Check footer controls
  const statsGrid = await page.locator('.stats-grid-compact').count()
  console.log(`Stats grids found: ${statsGrid}`)
  
  // Try PvP toggle
  const pvpBtn = page.locator('button[aria-label="PvP mode"]')
  if (await pvpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pvpBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-pvp.png'), fullPage: false })
    console.log('✅ PvP screenshot saved')
    
    const avatarBox = await page.locator('.avatar-box').boundingBox().catch(() => null)
    if (avatarBox) console.log(`Avatar box: ${Math.round(avatarBox.width)}x${Math.round(avatarBox.height)}`)
    
    const pvpCharDisplay = await page.locator('.character-display').boundingBox().catch(() => null)
    if (pvpCharDisplay) console.log(`PvP character-display: ${Math.round(pvpCharDisplay.width)}x${Math.round(pvpCharDisplay.height)}`)
    
    const pveBtn = page.locator('button[aria-label="PvE mode"]')
    if (await pveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pveBtn.click()
    }
  }
  
  // Get body text for debugging
  const text = await page.evaluate(() => document.body.innerText)
  writeFileSync(join(SCREENSHOTS_DIR, 'body-text.txt'), text)
  console.log('📝 Body text:', text.substring(0, 1000))
} else {
  // Take whatever page we're on
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mobile-current.png'), fullPage: false })
  console.log('📸 Screenshot of current page saved')
  const text = await page.evaluate(() => document.body.innerText)
  writeFileSync(join(SCREENSHOTS_DIR, 'body-text.txt'), text)
  console.log('📝 Body text:', text.substring(0, 1000))
}

if (errors.length > 0) {
  console.log('\n❌ Errors:', errors)
} else {
  console.log('✅ No page errors')
}

await context.close()
await browser.close()
console.log('Done!')
