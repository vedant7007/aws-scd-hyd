/**
 * Screenshots and behavioural checks for the landing page. Dev only.
 *
 *   npm start -- --port 3110
 *   node scripts/shoot.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.SHOOT_URL ?? 'http://localhost:3110'
const OUT = process.env.SHOOT_OUT ?? '.'

const browser = await chromium.launch({ channel: 'chrome' })

async function shoot(name, { width, height, theme, reduced = false, path = '/', full = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (full) {
    // Let every reveal fire before capturing the whole page.
    await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight
      for (let y = 0; y < total; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(700)
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log(`  wrote ${name}.png`)
  await context.close()
}

async function checks() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const header = await page.evaluate(async () => {
    const el = document.querySelector('.site-header')
    const before = el?.getAttribute('data-stuck')
    window.scrollTo(0, 800)
    await new Promise((r) => setTimeout(r, 400))
    const after = el?.getAttribute('data-stuck')
    window.scrollTo(0, 0)
    return { before, after }
  })
  console.log(`  header data-stuck at top: ${header.before}, after scrolling: ${header.after}`)

  const stage = await page.evaluate(async () => {
    const el = document.querySelector('.tracks-stage')
    if (!el) return null
    const top = el.getBoundingClientRect().top + window.scrollY
    const seen = new Set()
    for (let i = 0; i <= 10; i++) {
      window.scrollTo(0, top + (el.getBoundingClientRect().height * i) / 10)
      await new Promise((r) => setTimeout(r, 220))
      seen.add(el.dataset.active)
    }
    return { ready: el.dataset.ready, heightVh: Math.round(el.getBoundingClientRect().height / window.innerHeight), advancedThrough: [...seen].filter(Boolean).sort() }
  })
  console.log(`  tracks stage ready=${stage?.ready} height=${stage?.heightVh}vh advanced through panels ${JSON.stringify(stage?.advancedThrough)}`)

  await context.close()

  // Reduced motion must leave nothing half animated.
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const rmPage = await rm.newPage()
  await rmPage.goto(BASE + '/', { waitUntil: 'networkidle' })
  await rmPage.waitForTimeout(1200)
  const motion = await rmPage.evaluate(() => {
    const stage = document.querySelector('.tracks-stage')
    const items = [...document.querySelectorAll('.track-item')]
    const animated = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el)
      return s.animationName !== 'none' && s.animationDuration !== '0s'
    })
    return {
      runningAnimations: animated.length,
      stagePinned: stage ? getComputedStyle(stage.querySelector('.tracks-pin')).position : 'n/a',
      allTracksVisible: items.every((el) => getComputedStyle(el).opacity === '1'),
      tickerAnimation: getComputedStyle(document.querySelector('.ticker-track')).animationName,
    }
  })
  console.log(`  reduced motion: ${motion.runningAnimations} animated elements, pin=${motion.stagePinned}, all tracks visible=${motion.allTracksVisible}, ticker=${motion.tickerAnimation}`)
  await rm.close()
}

console.log('checks:')
await checks()
console.log('screenshots:')
await shoot('home-desktop-light', { width: 1440, height: 900, theme: 'light' })
await shoot('home-desktop-dark', { width: 1440, height: 900, theme: 'dark' })
await shoot('home-mobile-light', { width: 412, height: 915, theme: 'light' })
await shoot('home-full-light', { width: 1440, height: 900, theme: 'light', full: true })



// Sections captured in the viewport, because a fullPage capture renders the
// whole document at once and content-visibility legitimately skips whatever is
// off screen, which looks like blank sections in the image.
async function section(name, id, { width = 1440, height = 900, theme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme })
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), id)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const text = await page.evaluate((sel) => document.querySelector(sel)?.innerText?.slice(0, 90), id)
  console.log(`  ${name}: ${JSON.stringify(text)}`)
  await context.close()
}

console.log('sections:')
await section('sec-passes', '#passes')
await section('sec-speakers', '#speakers')
await section('sec-sponsors', '#sponsors')
await browser.close()
