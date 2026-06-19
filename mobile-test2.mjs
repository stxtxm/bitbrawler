import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'url'

const SCREENSHOTS_DIR = '/home/timo/dev/bitbrawler/qa/screenshots'

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

// Navigate to local dev server
console.log('Navigating to local dev server...')
await page.goto('http://localhost:3456/arena', { waitUntil: 'networkidle', timeout: 20000 })
  .catch(e => console.log('Navigation error:', e.message))
await page.waitForTimeout(3000)

console.log('Current URL:', page.url())

// Take initial screenshot
await page.screenshot({ path: join(SCREENSHOTS_DIR, 'dev-arena-1.png'), fullPage: false })
console.log('Screenshot 1 saved')

// Log in with a character name
const currentUrl = page.url()
console.log('URL after load:', currentUrl)

// Try different approaches to login
if (currentUrl.includes('/login') || currentUrl.includes('/create')) {
  console.log('On login/creation page, trying to login...')
  
  // Find input
  const inputs = await page.locator('input').all()
  console.log(`Found ${inputs.length} inputs`)
  
  for (const input of inputs) {
    const name = await input.getAttribute('name')
    const type = await input.getAttribute('type')
    const placeholder = await input.getAttribute('placeholder')
    console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}`)
  }
  
  // Look for buttons
  const buttons = await page.locator('button, a[role="button"]').all()
  console.log(`Found ${buttons.length} buttons`)
  for (const btn of buttons) {
    const text = await btn.textContent()
    console.log(`  Button: "${text?.trim()}"`)
  }
}

// Check for JS errors
if (errors.length > 0) {
  console.log('\n❌ Console errors:')
  errors.forEach(e => console.log(`  - ${e}`))
} else {
  console.log('\n✅ No console errors')
}

// Get body text
const bodyText = await page.evaluate(() => document.body.innerText)
writeFileSync(join(SCREENSHOTS_DIR, 'dev-body-text.txt'), bodyText)
console.log('\n📝 Page text:', bodyText.substring(0, 1000))

await context.close()
await browser.close()
console.log('\nDone!')
